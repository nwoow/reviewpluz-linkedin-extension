// ── Helpers ──

function getText(el, selectors) {
  for (const sel of selectors) {
    const node = el.querySelector(sel);
    if (node && node.textContent.trim()) return node.textContent.trim();
  }
  return "";
}

// ── Search results: inject "Add to CRM" buttons ──

function parseProfileCard(card) {
  // Profile link — LinkedIn 2024/2025 uses app-aware-link with /in/ href
  const anchor =
    card.querySelector('a[href*="/in/"]') ||
    card.querySelector("a.app-aware-link") ||
    card.querySelector("a");
  const profileUrl = anchor ? anchor.href.split("?")[0] : "";

  // Name — multiple fallback selectors for different LinkedIn layouts
  const name = getText(card, [
    ".entity-result__title-text a span[aria-hidden='true']",
    ".entity-result__title-text span[aria-hidden='true']",
    "span[aria-hidden='true']",
    ".artdeco-entity-lockup__title span",
    "a[href*='/in/'] span[aria-hidden='true']",
  ]);

  // Headline / subtitle
  const headline = getText(card, [
    ".entity-result__primary-subtitle",
    ".artdeco-entity-lockup__subtitle span",
    ".entity-result__summary",
  ]);

  // Location
  const location = getText(card, [
    ".entity-result__secondary-subtitle",
    ".artdeco-entity-lockup__caption span",
  ]);

  // Extract company from headline "Job Title at Company"
  const atIdx = headline.lastIndexOf(" at ");
  const company = atIdx !== -1 ? headline.slice(atIdx + 4) : "";
  const jobTitle = atIdx !== -1 ? headline.slice(0, atIdx) : headline;

  return {
    title: name || "LinkedIn Lead",
    contactPerson: name,
    companyName: company,
    linkedInUrl: profileUrl,
    linkedInHeadline: jobTitle,
    city: location,
  };
}

function injectCrmButton(card) {
  if (card.querySelector(".rlp-add-crm")) return;

  const btn = document.createElement("button");
  btn.className = "rlp-add-crm";
  btn.textContent = "+ Add to CRM";
  btn.style.cssText =
    "margin-left:8px;padding:4px 10px;font-size:12px;border-radius:4px;" +
    "background:#2563eb;color:#fff;border:none;cursor:pointer;font-family:inherit;" +
    "white-space:nowrap;z-index:9999;position:relative;";

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const data = parseProfileCard(card);
    console.log("[ReviewPluz] Adding lead:", data);
    btn.textContent = "Adding…";
    btn.disabled = true;

    chrome.runtime.sendMessage({ type: "add_lead", data }, (res) => {
      if (chrome.runtime.lastError) {
        console.error("[ReviewPluz] sendMessage error:", chrome.runtime.lastError.message);
        btn.textContent = "Error";
        btn.style.background = "#dc2626";
        setTimeout(() => { btn.textContent = "+ Add to CRM"; btn.style.background = "#2563eb"; btn.disabled = false; }, 2000);
        return;
      }
      if (res && res.ok) {
        btn.textContent = "✓ Added";
        btn.style.background = "#16a34a";
        console.log("[ReviewPluz] Lead added:", res.lead?._id);
      } else {
        const errMsg = res?.error || "Failed";
        console.error("[ReviewPluz] addLead failed:", errMsg);
        btn.textContent = "Failed";
        btn.style.background = "#dc2626";
        btn.title = errMsg;
        setTimeout(() => { btn.textContent = "+ Add to CRM"; btn.style.background = "#2563eb"; btn.disabled = false; }, 2000);
      }
    });
  });

  // Attach near action buttons — try multiple slots, always fall back to card
  const actionsRow =
    card.querySelector(".entity-result__actions") ||
    card.querySelector(".entity-result__simple-insight") ||
    card.querySelector(".artdeco-entity-lockup__metadata") ||
    card.querySelector(".entity-result__summary") ||
    card.querySelector("div[class*='entity-result']") ||
    card;
  actionsRow.style.position = "relative";
  actionsRow.appendChild(btn);
}

function injectSearchButtons() {
  // Try specific selectors first
  let cards = document.querySelectorAll([
    "li.reusable-search__result-container",
    "li.scaffold-layout__list-item",
    ".entity-result__item",
    "ul.reusable-search__entity-result-list > li",
    ".search-results-container li",
  ].join(", "));

  // Nuclear fallback: any <li> that contains a /in/ profile link and is big enough
  if (cards.length === 0) {
    const allLi = document.querySelectorAll("li");
    const filtered = [];
    allLi.forEach((li) => {
      if (li.querySelector('a[href*="/in/"]') && li.offsetHeight > 40) {
        filtered.push(li);
      }
    });
    cards = filtered;
    if (filtered.length > 0) {
      console.log(`[ReviewPluz] Used fallback selector — found ${filtered.length} cards`);
    }
  }

  console.log(`[ReviewPluz] Found ${cards.length} profile cards`);
  cards.forEach(injectCrmButton);
}

// ── Messaging: send DM ──

function getMessageInput() {
  return (
    document.querySelector(".msg-form__contenteditable[contenteditable='true']") ||
    document.querySelector("div.msg-form__contenteditable") ||
    document.querySelector("[data-testid='msg-form__msg-content-area']") ||
    document.querySelector("div[contenteditable='true'][role='textbox']")
  );
}

function getSendButton() {
  return (
    document.querySelector("button.msg-form__send-button") ||
    document.querySelector("[data-testid='msg-form__send-btn']") ||
    document.querySelector("button[type='submit'][aria-label*='Send']")
  );
}

async function sendDm(text) {
  const input = getMessageInput();
  if (!input) {
    console.warn("[ReviewPluz] DM input not found — make sure a conversation is open on this page");
    return false;
  }
  input.focus();
  document.execCommand("selectAll", false, null);
  document.execCommand("insertText", false, text);
  await new Promise((r) => setTimeout(r, 600));
  const sendBtn = getSendButton();
  if (sendBtn && !sendBtn.disabled) {
    sendBtn.click();
    console.log("[ReviewPluz] DM sent");
    return true;
  }
  console.warn("[ReviewPluz] Send button not found or disabled");
  return false;
}

// ── Invitation manager: click Connect ──

async function sendConnect(profileUrl) {
  const cards = document.querySelectorAll(
    ".invitation-card, .mn-invitation-card, [data-view-name='invitation-card']"
  );
  for (const card of cards) {
    const link = card.querySelector("a");
    if (link && link.href.includes(profileUrl)) {
      const connectBtn =
        card.querySelector("button[aria-label*='Connect']") ||
        card.querySelector("button[data-control-name='connect']");
      if (connectBtn) {
        connectBtn.click();
        console.log("[ReviewPluz] Connect clicked for", profileUrl);
        return true;
      }
    }
  }
  console.warn("[ReviewPluz] Could not find connect button for", profileUrl);
  return false;
}

// ── SPA navigation observer ──

let lastPath = location.pathname;
const navObserver = new MutationObserver(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    if (location.pathname.startsWith("/search/results/people")) {
      setTimeout(injectSearchButtons, 800);
    }
  }
  if (location.pathname.startsWith("/search/results/people")) {
    injectSearchButtons();
  }
});
navObserver.observe(document.body, { childList: true, subtree: true });

// ── Message listener ──

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "send_dm") {
    sendDm(message.text).then((ok) => sendResponse({ ok }));
    return true;
  }
  if (message.action === "send_connect") {
    sendConnect(message.profileUrl).then((ok) => sendResponse({ ok }));
    return true;
  }
});

// ── Init ──

console.log("[ReviewPluz] content.js loaded on", location.pathname);
if (location.pathname.startsWith("/search/results/people")) {
  setTimeout(() => {
    // Debug: log what LinkedIn's list container looks like so we can fix selectors
    const ul = document.querySelector("ul.reusable-search__entity-result-list") ||
               document.querySelector("ul[class*='reusable-search']") ||
               document.querySelector("ul[class*='search']");
    if (ul) {
      const firstLi = ul.querySelector("li");
      console.log("[ReviewPluz] List container:", ul.className);
      console.log("[ReviewPluz] First li classes:", firstLi?.className || "none");
    } else {
      console.log("[ReviewPluz] No <ul> search list found — logging body snippet:", document.body.innerHTML.slice(0, 500));
    }
    injectSearchButtons();
  }, 1500);
}
