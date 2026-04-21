// ── Helpers ──

function getText(el, selector) {
  const node = el.querySelector(selector);
  return node ? node.textContent.trim() : "";
}

// ── Search results: inject "Add to CRM" buttons ──

function parseProfileCard(card) {
  const name = getText(card, ".entity-result__title-text") ||
               getText(card, "span[aria-hidden='true']") || "";
  const headline = getText(card, ".entity-result__primary-subtitle") || "";
  const locationRaw = getText(card, ".entity-result__secondary-subtitle") || "";

  // Try to extract company from headline (e.g. "Software Engineer at Acme")
  const atIdx = headline.lastIndexOf(" at ");
  const company = atIdx !== -1 ? headline.slice(atIdx + 4) : "";
  const title = atIdx !== -1 ? headline.slice(0, atIdx) : headline;

  // Profile link
  const anchor = card.querySelector("a.app-aware-link") || card.querySelector("a");
  const profileUrl = anchor ? anchor.href.split("?")[0] : "";

  return {
    title: name || "LinkedIn Lead",
    contactPerson: name,
    companyName: company,
    linkedInUrl: profileUrl,
    linkedInHeadline: title,
    city: locationRaw,
  };
}

function injectCrmButton(card) {
  if (card.querySelector(".rlp-add-crm")) return; // already injected

  const btn = document.createElement("button");
  btn.className = "rlp-add-crm";
  btn.textContent = "+ Add to CRM";
  btn.style.cssText =
    "margin-left:8px;padding:4px 10px;font-size:12px;border-radius:4px;" +
    "background:#2563eb;color:#fff;border:none;cursor:pointer;font-family:inherit;";

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const data = parseProfileCard(card);
    btn.textContent = "Adding…";
    btn.disabled = true;
    chrome.runtime.sendMessage({ type: "add_lead", data }, (res) => {
      if (res && res.ok) {
        btn.textContent = "✓ Added";
        btn.style.background = "#16a34a";
      } else {
        btn.textContent = "Failed";
        btn.style.background = "#dc2626";
        setTimeout(() => {
          btn.textContent = "+ Add to CRM";
          btn.style.background = "#2563eb";
          btn.disabled = false;
        }, 2000);
      }
    });
  });

  // Attach to the action buttons row if it exists, otherwise append to card
  const actionsRow =
    card.querySelector(".entity-result__actions") ||
    card.querySelector(".search-results__result-item") ||
    card;
  actionsRow.appendChild(btn);
}

function injectSearchButtons() {
  const cards = document.querySelectorAll(
    ".entity-result__item, li.reusable-search__result-container"
  );
  cards.forEach(injectCrmButton);
}

// ── Messaging page: send DM ──

function getMessageInput() {
  return (
    document.querySelector(".msg-form__contenteditable") ||
    document.querySelector("[data-testid='msg-form__msg-content-area']") ||
    document.querySelector("div[contenteditable='true']")
  );
}

function getSendButton() {
  return (
    document.querySelector(".msg-form__send-button") ||
    document.querySelector("button[type='submit']") ||
    document.querySelector("[data-testid='msg-form__send-btn']")
  );
}

async function sendDm(text) {
  const input = getMessageInput();
  if (!input) {
    console.warn("[ReviewPluz] Message input not found");
    return false;
  }

  input.focus();
  // Insert text using execCommand so LinkedIn's React state picks it up
  document.execCommand("selectAll", false, null);
  document.execCommand("insertText", false, text);

  await new Promise((r) => setTimeout(r, 500));

  const sendBtn = getSendButton();
  if (sendBtn && !sendBtn.disabled) {
    sendBtn.click();
    return true;
  }
  return false;
}

// ── Invitation manager page: send connect ──

async function sendConnect(profileUrl) {
  // Find the connect button for the matching profile
  const cards = document.querySelectorAll(
    ".invitation-card, .mn-invitation-card"
  );
  for (const card of cards) {
    const link = card.querySelector("a");
    if (link && link.href.includes(profileUrl)) {
      const connectBtn =
        card.querySelector("button[aria-label*='Connect']") ||
        card.querySelector("button[data-control-name='connect']");
      if (connectBtn) {
        connectBtn.click();
        return true;
      }
    }
  }
  return false;
}

// ── Observe DOM changes (LinkedIn is a SPA) ──

let searchObserver = null;

function setupSearchObserver() {
  if (searchObserver) searchObserver.disconnect();
  searchObserver = new MutationObserver(() => {
    if (window.location.pathname.startsWith("/search/results/people")) {
      injectSearchButtons();
    }
  });
  searchObserver.observe(document.body, { childList: true, subtree: true });
}

// ── Message listener (from background.js) ──

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

(function init() {
  if (window.location.pathname.startsWith("/search/results/people")) {
    injectSearchButtons();
    setupSearchObserver();
  }
})();
