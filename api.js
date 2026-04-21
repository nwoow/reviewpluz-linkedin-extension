const BASE_URL = "https://reviewpluzsss.com";

async function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get("apiToken", (result) => resolve(result.apiToken || null));
  });
}

async function request(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export async function getQueue() {
  return request("/api/crm/linkedin/queue");
}

export async function markDone(leadId, action) {
  return request("/api/crm/linkedin/queue", {
    method: "POST",
    body: JSON.stringify({ leadId, action, result: "done" }),
  });
}

export async function addLead(data) {
  return request("/api/crm/leads", {
    method: "POST",
    body: JSON.stringify({ ...data, connectionStatus: "none", dmSequenceStep: 0 }),
  });
}
