// Everything the app saves goes to the server's library folder through here.
// Values are kept in memory, so reads are instant; writes are sent in the background.
const cache = {};
const uploaded = new Map(); // data URL -> /files/… URL, so the same image is sent once
const saving = {}; // key -> { running, again }
let pending = 0;
export const info = { status: null, usage: null };
let onProblem = () => {};

export async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) throw new Error((body && body.error) || `The server answered ${res.status}.`);
  return body;
}

export async function loadStatus() {
  info.status = await api("/api/status");
  info.usage = info.status.usage;
  return info.status;
}

export async function loadAll() {
  for (const k of Object.keys(cache)) delete cache[k];
  Object.assign(cache, await api("/api/state"));
}

export const has = (key) => key in cache;
export const get = (key) => (key in cache ? cache[key] : null);
export const isSaving = () => pending > 0;
export function onSaveProblem(fn) { onProblem = fn; }

export function set(key, value) {
  cache[key] = value;
  const s = (saving[key] ||= { running: false, again: false });
  if (s.running) { s.again = true; return; }
  run(key, s);
}

export function remove(key) {
  delete cache[key];
  pending++;
  api(`/api/state/${key}`, { method: "DELETE" }).catch((e) => onProblem(e)).finally(() => pending--);
}

async function run(key, s) {
  s.running = true;
  pending++;
  try {
    do {
      s.again = false;
      const value = cache[key];
      await uploadImages(value);
      const r = await api(`/api/state/${key}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      info.usage = r.usage;
    } while (s.again);
  } catch (e) {
    onProblem(e);
  } finally {
    s.running = false;
    pending--;
  }
}

// Swaps every embedded image (data: URL) in a saved value for a file on the server, in place,
// so the app's own objects point at the file from then on.
export async function uploadImages(value) {
  const slots = [];
  const walk = (obj) => {
    if (!obj || typeof obj !== "object") return;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === "string" && v.startsWith("data:image/")) slots.push([obj, k, v]);
      else if (v && typeof v === "object") walk(v);
    }
  };
  walk(value);
  for (const [obj, k, dataUrl] of slots) {
    let url = uploaded.get(dataUrl);
    if (!url) {
      const blob = await (await fetch(dataUrl)).blob();
      url = (await api("/api/files", { method: "POST", headers: { "Content-Type": blob.type }, body: blob })).url;
      uploaded.set(dataUrl, url);
    }
    if (obj[k] === dataUrl) obj[k] = url;
  }
}

window.addEventListener("beforeunload", (e) => {
  if (pending > 0) e.preventDefault();
});
