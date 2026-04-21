// ── DOM refs ──
const tokenInput = document.getElementById("token-input");
const saveTokenBtn = document.getElementById("save-token");
const tokenMsg = document.getElementById("token-msg");
const statusDot = document.getElementById("status-dot");
const connectCountEl = document.getElementById("connect-count");
const dmCountEl = document.getElementById("dm-count");
const queueConnectsEl = document.getElementById("queue-connects");
const queueDmsEl = document.getElementById("queue-dms");
const refreshBtn = document.getElementById("refresh-btn");
const runBtn = document.getElementById("run-btn");
const runMsg = document.getElementById("run-msg");

// ── Helpers ──

function setStatus(valid) {
  statusDot.className = `status-dot ${valid ? "status-ok" : "status-error"}`;
  statusDot.title = valid ? "Token saved" : "Token not set";
}

function flash(el, text, className) {
  el.textContent = text;
  el.className = `helper-text center ${className}`;
  setTimeout(() => {
    el.textContent = "";
    el.className = "helper-text center";
  }, 3000);
}

// ── Load saved state ──

chrome.storage.local.get(
  ["apiToken", "connectCount", "dmCount", "counterDay", "queue"],
  (data) => {
    if (data.apiToken) {
      tokenInput.value = data.apiToken;
      setStatus(true);
    } else {
      setStatus(false);
    }

    // Counters (reset if new day)
    const today = getTodayKey();
    if (data.counterDay === today) {
      connectCountEl.textContent = data.connectCount || 0;
      dmCountEl.textContent = data.dmCount || 0;
    }

    updateQueueDisplay(data.queue || []);
  }
);

function getTodayKey() {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const d = new Date(Date.now() + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function updateQueueDisplay(queue) {
  const connects = queue.filter((q) => q.action === "connect").length;
  const dms = queue.filter((q) => q.action === "dm1" || q.action === "dm3").length;
  queueConnectsEl.textContent = connects;
  queueDmsEl.textContent = dms;
}

// ── Save token ──

saveTokenBtn.addEventListener("click", () => {
  const token = tokenInput.value.trim();
  if (!token) {
    flash(tokenMsg, "Please enter a token.", "text-error");
    return;
  }
  chrome.storage.local.set({ apiToken: token }, () => {
    setStatus(true);
    flash(tokenMsg, "Token saved.", "text-success");
  });
});

// ── Refresh queue ──

refreshBtn.addEventListener("click", () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing…";
  chrome.runtime.sendMessage({ type: "poll_queue" }, () => {
    chrome.storage.local.get("queue", (data) => {
      updateQueueDisplay(data.queue || []);
      refreshBtn.disabled = false;
      refreshBtn.textContent = "Refresh Queue";
    });
  });
});

// ── Run Now ──

runBtn.addEventListener("click", () => {
  const token = tokenInput.value.trim();
  if (!token) {
    flash(runMsg, "Save your API token first.", "text-error");
    return;
  }
  runBtn.disabled = true;
  runBtn.textContent = "Running…";
  chrome.runtime.sendMessage({ type: "execute_action" }, (res) => {
    runBtn.disabled = false;
    runBtn.textContent = "▶ Run Now";
    if (res && res.ok) {
      flash(runMsg, "Action executed.", "text-success");
    } else {
      flash(runMsg, "Nothing to run or limit reached.", "text-muted");
    }
    // Refresh displayed counters
    chrome.storage.local.get(["connectCount", "dmCount", "counterDay", "queue"], (data) => {
      const today = getTodayKey();
      if (data.counterDay === today) {
        connectCountEl.textContent = data.connectCount || 0;
        dmCountEl.textContent = data.dmCount || 0;
      }
      updateQueueDisplay(data.queue || []);
    });
  });
});

// ── Listen for background updates ──
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "action_done") {
    chrome.storage.local.get(["connectCount", "dmCount", "counterDay", "queue"], (data) => {
      const today = getTodayKey();
      if (data.counterDay === today) {
        connectCountEl.textContent = data.connectCount || 0;
        dmCountEl.textContent = data.dmCount || 0;
      }
      updateQueueDisplay(data.queue || []);
    });
  }
});
