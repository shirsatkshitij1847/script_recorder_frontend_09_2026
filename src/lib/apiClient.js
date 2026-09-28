const DEFAULT_BASE_URL = "http://localhost:7000";
const STORAGE_KEY = "mes-base-url";

// Falls back to localStorage in browser/dev mode when no Electron bridge is available.
export async function getBaseUrl() {
  if (window.electronAPI?.getBaseUrl) return window.electronAPI.getBaseUrl();
  return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_BASE_URL;
}

export async function setBaseUrl(url) {
  const trimmed = String(url || "").trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Base URL is required");
  if (window.electronAPI?.setBaseUrl) return window.electronAPI.setBaseUrl(trimmed);
  window.localStorage.setItem(STORAGE_KEY, trimmed);
  return trimmed;
}

export async function callApi(path, options) {
  const baseUrl = await getBaseUrl();
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, options);
  } catch {
    throw new Error(`Cannot reach backend at ${baseUrl}. Check the Team Setup page and confirm the backend is running.`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `API returned ${response.status}`);
  return data;
}

// Pings /api/health so the Team Setup page can confirm a base URL before it's saved/used elsewhere.
// Prefers the Electron main process (Node fetch) since browser fetch() is subject to CORS.
export async function checkHealth(url) {
  const target = (url ?? await getBaseUrl()).trim().replace(/\/+$/, "");
  if (!target) return { ok: false, error: "Base URL is required" };
  if (window.electronAPI?.checkHealth) return window.electronAPI.checkHealth(target);
  try {
    const response = await fetch(`${target}/api/health`);
    if (!response.ok) return { ok: false, error: `Server responded with status ${response.status}` };
    const data = await response.json().catch(() => ({}));
    return { ok: data.status === "ok" || response.ok, data };
  } catch {
    return { ok: false, error: "Could not reach this base URL. Check the host, port, and that the backend is running." };
  }
}
