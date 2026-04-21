import { getQueue, markDone, addLead } from "./api.js";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const QUIET_START_HOUR = 23;
const QUIET_END_HOUR = 7;
const MAX_CONNECTS = 25;
const MAX_DMS = 20;

const log = (...args) => console.log("[ReviewPluz]", ...args);
const warn = (...args) => console.warn("[ReviewPluz]", ...args);

function nowIST() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function isQuietHours() {
  const h = nowIST().getUTCHours();
  const quiet = h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
  if (quiet) log(`Quiet hours active (IST hour: ${h}). No actions.`);
  return quiet;
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
        const reset = { connectCount: 0, dmCount: 0, counterDay: today };
        chrome.storage.local.set(reset);
        log("Daily counters reset (new IST day)");
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
  log(`Counter updated — connects: ${updated.connectCount}, dms: ${updated.dmCount}`);
  return updated;
}

async function pollQueue() {
  log("Polling queue from API...");
  try {
    const data = await getQueue();
    const queue = data.queue || [];
    chrome.storage.local.set({ queue });
    log(
      `Queue refreshed — ${queue.length} item(s):`,
      queue.map((q) => `${q.action}:${q.lead?.contactPerson || q.lead?._id}`)
    );
    chrome.runtime.sendMessage({ type: "queue_refreshed", count: queue.length }).catch(() => {});
  } catch (e) {
    warn("Poll failed:", e.message);
  }
}

function randomDelay() {
  const ms = (30 + Math.floor(Math.random() * 61)) * 1000;
  log(`Waiting ${Math.round(ms / 1000)}s before action...`);
  return ms;
}

async function findLinkedInTab() {
  return new Promise((resolve) => {
    // Search ALL windows, not just the active tab
    chrome.tabs.query({ url: "https://www.linkedin.com/*" }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        warn("No LinkedIn tab found. Open linkedin.com in Chrome first.");
        resolve(null);
        return;
      }
      log(`Found ${tabs.length} LinkedIn tab(s). Using tab id=${tabs[0].id} url=${tabs[0].url}`);
      resolve(tabs[0]);
    });
  });
}

async function executeNextAction() {
  if (isQuietHours()) return;

  const counters = await getCounters();
  log(`Today — connects: ${counters.connectCount}/${MAX_CONNECTS}, dms: ${counters.dmCount}/${MAX_DMS}`);

  // Always refresh queue from API first so we have the latest data
  log("Refreshing queue from API before executing...");
  await pollQueue();

  const queue = await new Promise((r) =>
    chrome.storage.local.get("queue", (d) => r(d.queue || []))
  );

  log(`Queue has ${queue.length} item(s) after refresh`);

  if (!queue.length) {
    log("Queue is empty. Add LinkedIn leads in your CRM (with a LinkedIn URL set) then try again.");
    return;
  }

  const item = queue.find((q) => {
    if (q.action === "connect" && counters.connectCount >= MAX_CONNECTS) {
      log(`Skipping connect for "${q.lead?.contactPerson}" — daily limit reached`);
      return false;
    }
    if ((q.action === "dm1" || q.action === "dm3") && counters.dmCount >= MAX_DMS) {
      log(`Skipping DM for "${q.lead?.contactPerson}" — daily limit reached`);
      return false;
    }
    return true;
  });

  if (!item) {
    log("All queue items are blocked by daily limits.");
    return;
  }

  const leadName = item.lead?.contactPerson || item.lead?.companyName || item.lead?._id;
  log(`Next action: "${item.action}" for lead "${leadName}" (url: ${item.lead?.linkedInUrl})`);

  await new Promise((r) => setTimeout(r, randomDelay()));

  const tab = await findLinkedInTab();
  if (!tab) {
    warn("Cannot execute — open linkedin.com in a Chrome tab first, then click Run Now again.");
    return;
  }

  try {
    if (item.action === "connect") {
      log(`Sending connect request to content.js on tab ${tab.id}...`);
      const resp = await chrome.tabs.sendMessage(tab.id, {
        action: "send_connect",
        profileUrl: item.lead.linkedInUrl,
      });
      log("connect → content.js response:", resp);

    } else if (item.action === "dm1" || item.action === "dm3") {
      const firstName = (item.lead.contactPerson || "there").split(" ")[0];
      const company = item.lead.companyName || "your business";
      const text =
        item.action === "dm1"
          ? `Hi ${firstName}, saw your ${company} — looks great. Quick question: do you actively ask customers for Google reviews or does it just happen organically?`
          : `Hey ${firstName} — following up in case my message got buried. Happy to share a free trial if you'd like to test it this week.`;

      log(`Sending DM to content.js on tab ${tab.id}. Preview: "${text.slice(0, 60)}..."`);
      const resp = await chrome.tabs.sendMessage(tab.id, { action: "send_dm", text });
      log("dm → content.js response:", resp);
    }

    log(`Marking done — leadId: ${item.lead._id}, action: ${item.action}`);
    await markDone(item.lead._id, item.action);
    await incrementCounter(item.action === "connect" ? "connect" : "dm");

    const remaining = queue.filter(
      (q) => !(q.lead._id === item.lead._id && q.action === item.action)
    );
    chrome.storage.local.set({ queue: remaining });
    log(`Done. Queue now has ${remaining.length} item(s) remaining.`);

    chrome.runtime.sendMessage({ type: "action_done", action: item.action }).catch(() => {});

  } catch (e) {
    warn(`Action "${item.action}" failed:`, e.message);
    warn("Common causes: (1) LinkedIn tab not open, (2) wrong page for this action type, (3) LinkedIn changed their DOM.");
  }
}

// ── Install ──
chrome.runtime.onInstalled.addListener(() => {
  log("Extension installed — setting up 5-min poll alarm.");
  chrome.alarms.create("poll", { periodInMinutes: 5 });
  pollQueue();
});

// ── Alarm ──
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "poll") pollQueue();
});

// ── Messages ──
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  log("Message received:", message.type);

  if (message.type === "execute_action") {
    executeNextAction()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => {
        warn("executeNextAction error:", e.message);
        sendResponse({ ok: false, error: e.message });
      });
    return true;
  }

  if (message.type === "add_lead") {
    log("Adding lead to CRM:", message.data?.contactPerson || message.data?.title);
    addLead(message.data)
      .then((res) => {
        log("Lead added:", res?.lead?._id);
        sendResponse({ ok: true, lead: res.lead });
      })
      .catch((e) => {
        warn("addLead failed:", e.message);
        sendResponse({ ok: false, error: e.message });
      });
    return true;
  }
});
