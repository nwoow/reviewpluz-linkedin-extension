# ReviewPluz LinkedIn Extension

A Chrome extension that automates LinkedIn outreach from your [ReviewPluz](https://reviewpluzsss.com) CRM.  
Sends connection requests, follow-up DMs, and tracks every lead — safely, at human speed.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Install the Extension](#install-the-extension)
- [Connect to Your ReviewPluz Account](#connect-to-your-reviewpluz-account)
- [Daily Workflow](#daily-workflow)
- [Multi-Business / Team Usage](#multi-business--team-usage)
- [Safety Rules & Limits](#safety-rules--limits)
- [Deploy to GitHub](#deploy-to-github)
- [File Structure](#file-structure)
- [Troubleshooting](#troubleshooting)

---

## What It Does

| Action | How |
|---|---|
| Add leads from LinkedIn search | Injects "Add to CRM" button next to every profile card |
| Send connection requests | Clicks LinkedIn's connect button at human pace |
| Send DM 1 on accept | Types and sends opener message automatically |
| Send DM 3 after 5 days no reply | Follow-up sent automatically from the queue |
| Track every action | Logged to your ReviewPluz CRM with timestamps |

The extension runs inside your **real browser session** — LinkedIn sees a human, not a bot.

---

## Install the Extension

The extension is not on the Chrome Web Store. It loads directly from a folder on your computer.

### Step 1 — Download the code

**Option A — from GitHub (recommended):**
```
1. Go to the repository on GitHub
2. Click the green "Code" button → "Download ZIP"
3. Extract the ZIP to a permanent folder on your computer
   e.g. C:\Users\YourName\reviewpluz-linkedin-extension\
```

**Option B — clone with Git:**
```bash
git clone https://github.com/YOUR_USERNAME/reviewpluz-linkedin-extension.git
```

> **Important:** Do not move or delete the folder after loading — Chrome links to it directly.

### Step 2 — Load in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Toggle **Developer mode** ON (top-right corner)
3. Click **Load unpacked**
4. Select the folder you extracted/cloned (the one containing `manifest.json`)
5. The "ReviewPluz LinkedIn" extension appears with its icon in your toolbar

> **After a code update:** Go back to `chrome://extensions` and click the refresh icon on the extension card. No need to re-enter your token.

---

## Connect to Your ReviewPluz Account

Every user connects the extension to their own ReviewPluz account using a personal API token. The token tells the extension which CRM account to read from and write to.

### Step 1 — Generate your API token

1. Log in to [reviewpluzsss.com](https://reviewpluzsss.com)
2. Go to **Settings → API Token**
3. Click **Generate Token**
4. Copy the token (64-character hex string)

> The token is tied to your account and your organization. Keep it private — treat it like a password.

### Step 2 — Paste it into the extension

1. Click the **ReviewPluz LinkedIn** icon in your Chrome toolbar
2. Paste the token into the **API Token** field
3. Click **Save**
4. The status dot in the top-right of the popup turns **green** ✅

You are now connected. The extension will start pulling your lead queue automatically.

---

## Daily Workflow

### Adding leads from LinkedIn

1. Go to `linkedin.com/search/results/people` and search for your target audience  
   *(e.g. "restaurant owner Mumbai", "salon owner Delhi")*
2. An **"+ Add to CRM"** button appears next to each profile card
3. Click it — the lead is added to your ReviewPluz LinkedIn pipeline instantly
4. The button turns green with "✓ Added" to confirm

### Running outreach actions

1. Click the extension icon to open the popup
2. Check the **Queue** section — it shows pending connects and DMs
3. Click **▶ Run Now**
4. The extension picks the next action, waits a random 30–90 seconds, and executes it on LinkedIn
5. The action is logged in your CRM automatically

> You need to have LinkedIn open in an active Chrome tab for DM and connect actions to execute. The extension acts on the currently open LinkedIn page.

### Checking your pipeline

Open your ReviewPluz dashboard → CRM → LinkedIn to see all leads organized in 6 columns:

```
Find → Connect → DM 1 Sent → Follow-up → Replied → Demo / Won
```

Leads with a **⚠ Follow up** badge haven't replied in 5+ days — those are next in queue.

---

## Multi-Business / Team Usage

Each business and each team member uses their **own API token** tied to their own ReviewPluz account. There is no shared login for the extension.

### If you are a business owner onboarding your team

| Who | What they do |
|---|---|
| **You (owner)** | Generate your token from Settings → use it in your browser |
| **Team member A** | Logs into ReviewPluz with their own credentials → generates their own token → pastes it into their copy of the extension |
| **Team member B** | Same as above |

All leads created by any team member go into the **same shared CRM pipeline** for your organization. Each person's LinkedIn outreach is tracked separately by their user account.

### If you are a different business (different ReviewPluz account)

If you run a separate business with its own ReviewPluz account:

1. Log in to ReviewPluz with **your business account** (different email/password)
2. Go to Settings → API Token → Generate Token
3. Open the extension popup
4. **Replace** the existing token with your new one and click Save
5. The extension now reads from and writes to **your organization's CRM** — completely separate from any other business

> **One token = one organization.** The token is organization-scoped. Swapping the token in the popup is all you need to switch between accounts.

### What gets separated per business

| Data | Separated? |
|---|---|
| CRM leads | ✅ Each org sees only their own leads |
| LinkedIn queue | ✅ Based on your org's leads only |
| DM templates | ✅ Personalized with your leads' names |
| Daily counters | ✅ Per browser (resets midnight IST) |
| LinkedIn account | ✅ Each person uses their own LinkedIn login |

---

## Safety Rules & Limits

These limits are enforced in `background.js` and cannot be overridden from the popup.

| Rule | Value | Why |
|---|---|---|
| Max connection requests/day | 25 | LinkedIn's safe threshold |
| Max DMs/day | 20 | LinkedIn's safe threshold |
| Delay between actions | 30–90s random | Mimics human behavior |
| Quiet hours (no actions) | 11pm–7am IST | Normal human hours |
| On CAPTCHA | Stops immediately | Manual review needed |
| LinkedIn password stored | Never | Only API token is stored |

Counters reset automatically at midnight IST each day.

---

## Deploy to GitHub

Follow these steps to publish the extension code to GitHub so your team can always download the latest version.

### Step 1 — Create a GitHub repository

1. Go to [github.com](https://github.com) and log in
2. Click **New repository** (top-right "+" icon)
3. Name it: `reviewpluz-linkedin-extension`
4. Set visibility to **Private** (recommended — the code contains your API base URL)
5. Do **not** initialize with README (you already have one)
6. Click **Create repository**

### Step 2 — Push the code

Open a terminal in the extension folder and run:

```bash
git init
git add .
git commit -m "Initial extension build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/reviewpluz-linkedin-extension.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

### Step 3 — Share with your team

1. Go to the repository → **Settings → Collaborators**
2. Click **Add people** and invite team members by their GitHub username or email
3. They accept the invite and can then download/clone the repo

### Step 4 — How team members install from GitHub

Team members who aren't developers can use the ZIP download method:

```
1. Go to github.com/YOUR_USERNAME/reviewpluz-linkedin-extension
2. Click the green "Code" button
3. Click "Download ZIP"
4. Extract it anywhere (e.g. Desktop)
5. Follow the "Load in Chrome" steps above
```

### Releasing updates

When you update the extension code:

```bash
git add .
git commit -m "Update: describe what changed"
git push
```

Team members then:
1. Re-download the ZIP (or `git pull` if they cloned)
2. Go to `chrome://extensions`
3. Click the **refresh** icon on the ReviewPluz LinkedIn card

Their token is saved in Chrome storage and survives updates — they do not need to re-enter it.

---

## File Structure

```
reviewpluz-linkedin-extension/
│
├── manifest.json       — Extension config (Manifest V3)
├── background.js       — Service worker: queue polling, rate limits, action execution
├── content.js          — Runs on linkedin.com: injects CRM buttons, sends DMs/connects
├── api.js              — API calls to reviewpluzsss.com (getQueue, markDone, addLead)
├── popup.html          — Extension popup UI
├── popup.js            — Popup logic: token save, stats display, Run Now button
└── styles/
    └── popup.css       — Popup styling (300px, dark blue header, Inter font)
```

### How the pieces connect

```
popup.js  ──(chrome.runtime.sendMessage)──▶  background.js
                                                  │
                                            api.js (fetch)
                                                  │
                                       reviewpluzsss.com/api/crm/*
                                                  │
                                            MongoDB (CRM leads)

background.js  ──(chrome.tabs.sendMessage)──▶  content.js
                                                    │
                                             LinkedIn DOM
                                          (clicks buttons, types DMs)
```

---

## Troubleshooting

**Status dot is red / staying grey**  
→ Token not saved. Open popup, paste your token, click Save.

**"Add to CRM" buttons not appearing on LinkedIn**  
→ Make sure you are on `linkedin.com/search/results/people` (people search, not jobs or companies).  
→ Try refreshing the LinkedIn page after the extension loads.

**Run Now does nothing**  
→ Check that LinkedIn is open in an active tab in the same Chrome window.  
→ Check the Queue numbers in the popup — if both show 0, your queue is empty. Click Refresh Queue first.

**Actions stop after a few days**  
→ Daily counters may have hit the limit. Check the "Today's Activity" numbers. They reset at midnight IST.  
→ LinkedIn may have shown a CAPTCHA — complete it manually, then try again.

**Extension disappeared from toolbar**  
→ Go to `chrome://extensions` and make sure it is still enabled. If it shows an error, click the refresh icon.

**Token rejected (API returns 401)**  
→ Your token may have been regenerated. Go to ReviewPluz Settings → API Token and copy the current token, then re-paste it in the popup.

---

## Support

- ReviewPluz dashboard: [reviewpluzsss.com](https://reviewpluzsss.com)  
- LinkedIn automation docs: [reviewpluzsss.com/linkedin-automation](https://reviewpluzsss.com/linkedin-automation)
