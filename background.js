import { getQueue, markDone, addLead } from "./api.js";

// IST offset is UTC+5:30 = 330 minutes
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const QUIET_START_HOUR = 23; // 11pm IST
const QUIET_END_HOUR = 7;    // 7am IST
const MAX_CONNECTS = 25;
const MAX_DMS = 20;

function nowIST() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function isQuietHours() {
  const h = nowIST().getUTCHours();
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

function todayKeyIST() {
  const d = nowIST();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

async function getCounters() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["connectCount", "dmCount", "counterDay"], (r) => {
      const today = todayKeyIST();
      if (r.counterDay !== today) {
        // New day — reset
        const reset = { connectCount: 0, dmCount: 0, counterDay: today };
        chrome.storage.local.set(reset);
        resolve(reset);
      } else {
        resolve({ connectCount: r.connectCount || 0, dmCount: r.dmCount || 0, counterDay: today });
      }
    });
  });
}

async function incrementCounter(type) {
  const counters = await getCounters();
  const key = type === "connect" ? "connectCount" : "dmCount";
  const updated = { ...counters, [key]: counters[key] + 1 };
  chrome.storage.local.set(updated);
  return updated;
}

async function pollQueue() {
  try {
    const data = await getQueue();
    chrome.storage.local.set({ queue: data.queue || [] });
  } catch (e) {
    console.warn("[ReviewPluz] Poll failed:", e.message);
  }
}

function randomDelay() {
  // Random 30–90 seconds in ms
  return (30 + Math.floor(Math.random() * 61)) * 1000;
}

async function executeNextAction() {
  if (isQuietHours()) {
    console.log("[ReviewPluz] Quiet hours — skipping action");
    return;
  }

  const counters = await getCounters();
  const queue = await new Promise((r) => chrome.storage.local.get("queue", (d) => r(d.queue || [])));

  if (!queue.length) {
    console.log("[ReviewPluz] Queue empty");
    return;
  }

  const item = queue.find((q) => {
    if (q.action === "connect" && counters.connectCount >= MAX_CONNECTS) return false;
    if ((q.action === "dm1" || q.action === "dm3") && counters.dmCount >= MAX_DMS) return false;
    return true;
  });

  if (!item) {
    console.log("[ReviewPluz] Daily limits reached");
    return;
  }

  await new Promise((r) => setTimeout(r, randomDelay()));

  try {
    const [tab] = await chrome.tabs.query({ url: "https://www.linkedin.com/*", active: true });

    if (item.action === "connect") {
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, {
          action: "send_connect",
          profileUrl: item.lead.linkedInUrl,
        });
      }
    } else if (item.action === "dm1" || item.action === "dm3") {
      const firstName = (item.lead.contactPerson || "there").split(" ")[0];
      const company = item.lead.companyName || "your business";
      const text =
        item.action === "dm1"
          ? `Hi ${firstName}, saw your ${company} — looks great. Quick question: do you actively ask customers for Google reviews or does it just happen organically?`
          : `Hey ${firstName} — following up in case my message got buried. Happy to share a free trial if you'd like to test it this week.`;

      if (tab) {
        await chrome.tabs.sendMessage(tab.id, { action: "send_dm", text });
      }
    }

    await markDone(item.lead._id, item.action);
    await incrementCounter(item.action === "connect" ? "connect" : "dm");

    // Remove from local queue
    const remaining = queue.filter((q) => q.lead._id !== item.lead._id || q.action !== item.action);
    chrome.storage.local.set({ queue: remaining });

    // Notify popup
    chrome.runtime.sendMessage({ type: "action_done", action: item.action }).catch(() => {});
  } catch (e) {
    console.error("[ReviewPluz] Execute failed:", e.message);
  }
}

// ── Install: set up 5-min poll alarm ──
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("poll", { periodInMinutes: 5 });
  pollQueue();
});

// ── Alarm handler ──
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "poll") pollQueue();
});

// ── Message handler ──
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "execute_action") {
    executeNextAction().then(() => sendResponse({ ok: true }));
    return true; // keep channel open for async
  }
  if (message.type === "add_lead") {
    addLead(message.data)
      .then((res) => sendResponse({ ok: true, lead: res.lead }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});
