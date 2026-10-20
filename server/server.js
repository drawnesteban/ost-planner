// OST Planner server: serves the app and keeps its data in a folder on disk.
// No npm packages; Node 22 or newer.
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { writeZip, readZip } from "./zip.js";

const PORT = +process.env.PORT || 1820;
const DATA_ROOT = path.resolve(process.env.DATA_ROOT || "/data");
// What the person sees as the folder on their own computer (set in docker-compose.yml).
const HOST_DATA_DIR = process.env.HOST_DATA_DIR || DATA_ROOT;
const PUBLIC = path.resolve(process.env.PUBLIC_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "public"));
const CONFIG = path.join(DATA_ROOT, "ost-config.json");
const MAX_JSON = 50 * 1024 * 1024;
const MAX_UPLOAD = 100 * 1024 * 1024;
const MAX_BACKUP = 4 * 1024 * 1024 * 1024;
const KEY_RE = /^ost\.[a-zA-Z0-9.]+$/;
const FILE_RE = /^[a-f0-9]{24}\.(jpg|png|gif|webp|svg|pdf)$/;
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "application/pdf": "pdf" };
const MIME = {
  html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", json: "application/json",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  pdf: "application/pdf", otf: "font/otf", ttf: "font/ttf", woff: "font/woff", woff2: "font/woff2", ico: "image/x-icon",
};

// ---------- library folder ----------

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, "utf8")); } catch { return null; }
}
function libraryDir() {
  const c = readConfig();
  return c && c.library ? path.join(DATA_ROOT, c.library) : null;
}
const stateDir = (lib) => path.join(lib, "state");
const filesDir = (lib) => path.join(lib, "files");

async function writeAtomic(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, file);
}

async function readState(lib) {
  const out = {};
  let names = [];
  try { names = await fsp.readdir(stateDir(lib)); } catch {}
  for (const n of names) {
    if (!n.endsWith(".json")) continue;
    const key = n.slice(0, -5);
    if (!KEY_RE.test(key)) continue;
    try { out[key] = JSON.parse(await fsp.readFile(path.join(stateDir(lib), n), "utf8")); } catch {}
  }
  return out;
}

async function dirSize(dir) {
  let total = 0;
  let entries = [];
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += await dirSize(p);
    else try { total += (await fsp.stat(p)).size; } catch {}
  }
  return total;
}

async function usage(lib) {
  let files = 0;
  try { files = (await fsp.readdir(filesDir(lib))).filter((n) => FILE_RE.test(n)).length; } catch {}
  return { bytes: (await dirSize(stateDir(lib))) + (await dirSize(filesDir(lib))), files };
}

// Folders under DATA_ROOT that already hold a library (from an earlier setup or a copied folder).
async function existingLibraries() {
  let entries = [];
  try { entries = await fsp.readdir(DATA_ROOT, { withFileTypes: true }); } catch {}
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (fs.existsSync(path.join(DATA_ROOT, e.name, "state"))) out.push(e.name);
  }
  return out;
}

function hostPath(library) {
  const base = HOST_DATA_DIR.replace(/[\\/]+$/, "");
  const sep = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  return library ? `${base}${sep}${library}` : base;
}

function validFolderName(name) {
  return typeof name === "string" && name.trim() === name && name.length > 0 && name.length <= 80
    && !/[\\/:*?"<>|\0]/.test(name) && name !== "." && name !== ".." && !name.startsWith(".");
}

async function writable(dir) {
  try {
    await fsp.mkdir(dir, { recursive: true });
    const probe = path.join(dir, `.write-test-${process.pid}`);
    await fsp.writeFile(probe, "ok");
    await fsp.unlink(probe);
    return true;
  } catch { return false; }
}

async function status() {
  const c = readConfig();
  const lib = libraryDir();
  return {
    configured: !!(c && lib && fs.existsSync(lib)),
    library: c ? c.library : null,
    hostDataDir: HOST_DATA_DIR,
    hostPath: hostPath(c && c.library),
    existing: await existingLibraries(),
    writable: await writable(DATA_ROOT),
    usage: lib && fs.existsSync(lib) ? await usage(lib) : null,
  };
}

// ---------- files (uploaded images) ----------

async function saveFile(lib, buf, type) {
  const ext = EXT[type];
  if (!ext) throw httpError(415, "Only PDF files and JPEG, PNG, GIF, WebP or SVG images can be stored.");
  const name = `${crypto.createHash("sha256").update(buf).digest("hex").slice(0, 24)}.${ext}`;
  const file = path.join(filesDir(lib), name);
  if (!fs.existsSync(file)) await writeAtomic(file, buf);
  return name;
}

// Every /files/<name> mentioned anywhere in some saved data.
function referencedFiles(value, out = new Set()) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  for (const m of text.matchAll(/\/files\/([a-f0-9]{24}\.(?:jpg|png|gif|webp|svg|pdf))/g)) out.add(m[1]);
  return out;
}

async function zipFileEntries(lib, names) {
  const out = [];
  for (const n of names) {
    try { out.push({ name: `files/${n}`, data: await fsp.readFile(path.join(filesDir(lib), n)) }); } catch {}
  }
  return out;
}

// ---------- backups ----------

const today = () => new Date().toISOString().slice(0, 10);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "project";

async function collectionZip(lib) {
  const state = await readState(lib);
  const projects = state["ost.projects"]?.list || [];
  const gallery = Array.isArray(state["ost.gallery"]) ? state["ost.gallery"] : [];
  const contacts = Array.isArray(state["ost.contacts"]) ? state["ost.contacts"] : [];
  const files = [...referencedFiles(state)];
  const manifest = {
    app: "ost-planner", format: 1, type: "collection", created: new Date().toISOString(),
    counts: { projects: projects.length, contacts: contacts.length, galleryItems: gallery.length, images: files.length },
  };
  return writeZip([
    { name: "manifest.json", data: JSON.stringify(manifest, null, 2) },
    ...Object.entries(state).map(([k, v]) => ({ name: `state/${k}.json`, data: JSON.stringify(v, null, 2) })),
    ...(await zipFileEntries(lib, files)),
  ]);
}

function projectBundle(state, id) {
  const project = (state["ost.projects"]?.list || []).find((p) => p.id === id);
  if (!project) return null;
  const todos = (state["ost.projectTodos"] || {})[id] || null;
  const gallery = (Array.isArray(state["ost.gallery"]) ? state["ost.gallery"] : []).filter((g) => g.project === id);
  const all = Array.isArray(state["ost.contacts"]) ? state["ost.contacts"] : [];
  // Linked contacts; older libraries linked by organization name.
  const org = (project.client || "").trim();
  const contacts = Array.isArray(project.contactIds)
    ? all.filter((c) => project.contactIds.includes(c.id))
    : org ? all.filter((c) => c.org === org) : [];
  return { project, todos, gallery, contacts };
}

async function projectZip(lib, id) {
  const state = await readState(lib);
  const bundle = projectBundle(state, id);
  if (!bundle) throw httpError(404, "That project isn't in the library.");
  const files = [...referencedFiles(bundle)];
  const manifest = {
    app: "ost-planner", format: 1, type: "project", created: new Date().toISOString(),
    project: { id, name: bundle.project.name },
    counts: { todos: bundle.todos ? bundle.todos.length : 0, galleryItems: bundle.gallery.length, contacts: bundle.contacts.length, images: files.length },
  };
  return {
    name: bundle.project.name,
    zip: writeZip([
      { name: "manifest.json", data: JSON.stringify(manifest, null, 2) },
      { name: "project.json", data: JSON.stringify(bundle, null, 2) },
      ...(await zipFileEntries(lib, files)),
    ]),
  };
}

function openBackup(buf) {
  let entries;
  try { entries = readZip(buf); } catch { throw httpError(400, "That file isn't an OST Planner backup (it couldn't be opened as a zip)."); }
  // A backup that was unzipped and zipped again (e.g. in Finder) has everything inside one folder.
  if (!entries.has("manifest.json")) {
    const inner = [...entries.keys()].find((n) => /^[^/]+\/manifest\.json$/.test(n) && !n.startsWith("__MACOSX/"));
    if (inner) {
      const prefix = inner.slice(0, -"manifest.json".length);
      entries = new Map([...entries].filter(([n]) => n.startsWith(prefix)).map(([n, d]) => [n.slice(prefix.length), d]));
    }
  }
  const manifestEntry = entries.get("manifest.json");
  let manifest = null;
  try { manifest = JSON.parse(manifestEntry.toString("utf8")); } catch {}
  if (!manifest || manifest.app !== "ost-planner") throw httpError(400, "That zip isn't an OST Planner backup (no OST Planner manifest inside).");
  if (manifest.format > 1) throw httpError(400, "That backup was made by a newer version of OST Planner. Update this copy first.");
  return { manifest, entries };
}

async function restoreFiles(lib, entries, wanted) {
  for (const [name, data] of entries) {
    if (!name.startsWith("files/")) continue;
    const n = name.slice(6);
    if (!FILE_RE.test(n) || (wanted && !wanted.has(n))) continue;
    const file = path.join(filesDir(lib), n);
    if (!fs.existsSync(file)) await writeAtomic(file, data);
  }
}

async function restoreCollection(lib, entries) {
  // Keep a copy of what's being replaced, in the library's backups folder.
  const current = await readState(lib);
  if (Object.keys(current).length) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    await writeAtomic(path.join(lib, "backups", `before-restore-${stamp}.zip`), await collectionZip(lib));
  }
  const state = {};
  for (const [name, data] of entries) {
    const m = name.match(/^state\/(ost\.[a-zA-Z0-9.]+)\.json$/);
    if (!m) continue;
    try { state[m[1]] = JSON.parse(data.toString("utf8")); } catch { throw httpError(400, `The backup is damaged: ${name} can't be read.`); }
  }
  await restoreFiles(lib, entries);
  await fsp.rm(stateDir(lib), { recursive: true, force: true });
  for (const [k, v] of Object.entries(state)) await writeAtomic(path.join(stateDir(lib), `${k}.json`), JSON.stringify(v));
  return { keys: Object.keys(state).length };
}

async function restoreProject(lib, entries, mode) {
  let bundle;
  try { bundle = JSON.parse(entries.get("project.json").toString("utf8")); } catch { throw httpError(400, "The backup is damaged: project.json can't be read."); }
  const state = await readState(lib);
  const projectsState = state["ost.projects"] && Array.isArray(state["ost.projects"].list) ? state["ost.projects"] : { list: [] };
  const list = projectsState.list;
  const existing = list.find((p) => p.id === bundle.project.id);
  const project = { ...bundle.project };
  let gallery = Array.isArray(state["ost.gallery"]) ? state["ost.gallery"] : [];
  const todos = state["ost.projectTodos"] || {};

  if (existing && mode === "replace") {
    list.splice(list.indexOf(existing), 1, project);
    gallery = gallery.filter((g) => g.project !== project.id);
  } else {
    if (existing) {
      project.id = Math.max(0, ...list.map((p) => +p.id || 0)) + 1;
      project.name = `${project.name} (restored)`;
    }
    list.push(project);
  }
  if (bundle.todos) todos[project.id] = bundle.todos;
  // Gallery ids are shared across all projects, so give clashing ones new ids.
  const used = new Set(gallery.map((g) => g.id));
  let next = Date.now();
  for (const g of bundle.gallery || []) {
    const item = { ...g, project: project.id };
    if (used.has(item.id)) { while (used.has(next)) next++; item.id = next; }
    used.add(item.id);
    gallery.push(item);
  }
  // Contacts: add the ones this library doesn't have yet (same name and organization), and point the project's links at them.
  const contacts = Array.isArray(state["ost.contacts"]) ? state["ost.contacts"] : [];
  const cids = new Set(contacts.map((c) => c.id));
  const idMap = new Map();
  let addedContacts = 0;
  for (const c of bundle.contacts || []) {
    const same = contacts.find((x) => x.name === c.name && x.org === c.org);
    if (same) { idMap.set(c.id, same.id); continue; }
    const item = { ...c };
    while (cids.has(item.id)) item.id = next++;
    cids.add(item.id);
    idMap.set(c.id, item.id);
    contacts.push(item);
    addedContacts++;
  }
  if (Array.isArray(project.contactIds)) project.contactIds = project.contactIds.filter((id) => idMap.has(id)).map((id) => idMap.get(id));
  else project.contactIds = [...idMap.values()];
  await restoreFiles(lib, entries, referencedFiles(bundle));
  const put = (k, v) => writeAtomic(path.join(stateDir(lib), `${k}.json`), JSON.stringify(v));
  await put("ost.projects", projectsState);
  await put("ost.projectTodos", todos);
  await put("ost.gallery", gallery);
  await put("ost.contacts", contacts);
  return { id: project.id, name: project.name, replaced: !!(existing && mode === "replace"), addedContacts };
}

// ---------- http ----------

function httpError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(httpError(413, "That's too large to upload.")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req, MAX_JSON);
  try { return JSON.parse(buf.toString("utf8")); } catch { throw httpError(400, "Couldn't read the data that was sent."); }
}

function send(res, code, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const data = isBuf ? body : JSON.stringify(body);
  res.writeHead(code, { "Content-Type": isBuf ? "application/octet-stream" : "application/json", "Content-Length": Buffer.byteLength(data), "Cache-Control": "no-store", ...headers });
  res.end(data);
}

function sendZip(res, zip, filename) {
  send(res, 200, zip, { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"` });
}

function requireLibrary() {
  const lib = libraryDir();
  if (!lib || !fs.existsSync(lib)) throw httpError(409, "Storage isn't set up yet.");
  return lib;
}

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.join(PUBLIC, path.normalize(rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 404, { error: "Not found" });
  let stat;
  try { stat = await fsp.stat(file); } catch {}
  // Unknown paths fall back to the app page, like the old nginx setup did.
  const target = stat && stat.isFile() ? file : path.join(PUBLIC, "index.html");
  const ext = path.extname(target).slice(1).toLowerCase();
  const data = await fsp.readFile(target);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Content-Length": data.length, "Cache-Control": "no-cache" });
  res.end(req.method === "HEAD" ? undefined : data);
}

// One write at a time, so two saves can't interleave on disk.
let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));

async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  const m = req.method;

  if (p === "/api/status" && m === "GET") return send(res, 200, await status());

  if (p === "/api/setup" && m === "POST") {
    const { folder } = await readJson(req);
    if (!validFolderName(folder)) throw httpError(400, "Use a folder name without slashes or special characters.");
    const lib = path.join(DATA_ROOT, folder);
    if (!(await writable(lib))) throw httpError(500, `Can't write to ${hostPath(folder)}. Check that the folder is shared with Docker and not read-only.`);
    await fsp.mkdir(stateDir(lib), { recursive: true });
    await fsp.mkdir(filesDir(lib), { recursive: true });
    await writeAtomic(CONFIG, JSON.stringify({ library: folder, created: new Date().toISOString() }, null, 2));
    return send(res, 200, await status());
  }

  if (p === "/api/state" && m === "GET") return send(res, 200, await readState(requireLibrary()));

  const key = p.match(/^\/api\/state\/(ost\.[a-zA-Z0-9.]+)$/);
  if (key) {
    const lib = requireLibrary();
    const file = path.join(stateDir(lib), `${key[1]}.json`);
    if (m === "PUT") {
      const value = await readJson(req);
      if (JSON.stringify(value).includes("data:image/")) throw httpError(400, "Images must be uploaded as files first.");
      await serial(() => writeAtomic(file, JSON.stringify(value)));
      return send(res, 200, { ok: true, usage: await usage(lib) });
    }
    if (m === "DELETE") {
      await serial(() => fsp.rm(file, { force: true }));
      return send(res, 200, { ok: true });
    }
  }

  if (p === "/api/files" && m === "POST") {
    const lib = requireLibrary();
    const type = (req.headers["content-type"] || "").split(";")[0].trim();
    const name = await saveFile(lib, await readBody(req, MAX_UPLOAD), type);
    return send(res, 200, { url: `/files/${name}` });
  }

  // Download an image from a web address into the library, so it keeps working offline and goes into backups.
  if (p === "/api/files/fetch" && m === "POST") {
    const lib = requireLibrary();
    const { url: src } = await readJson(req);
    let u;
    try { u = new URL(src); } catch { throw httpError(400, "That isn't a valid web address."); }
    if (!/^https?:$/.test(u.protocol)) throw httpError(400, "Use an http:// or https:// image address.");
    let r;
    try { r = await fetch(u, { signal: AbortSignal.timeout(20000), redirect: "follow", headers: { "User-Agent": "OST-Planner" } }); }
    catch { throw httpError(502, "Couldn't download that image. Check the address, or that this computer is online."); }
    if (!r.ok) throw httpError(502, `The image site answered ${r.status}. Try another address, or download the image and upload it.`);
    const type = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!EXT[type] || type === "application/pdf") throw httpError(415, "That address isn't an image (it may be a web page). Right-click the image and copy the image address instead.");
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_UPLOAD) throw httpError(413, "That image is too large.");
    return send(res, 200, { url: `/files/${await saveFile(lib, buf, type)}` });
  }

  const f = p.match(/^\/files\/([^/]+)$/);
  if (f && (m === "GET" || m === "HEAD")) {
    if (!FILE_RE.test(f[1])) return send(res, 404, { error: "Not found" });
    const lib = requireLibrary();
    let data;
    try { data = await fsp.readFile(path.join(filesDir(lib), f[1])); } catch { return send(res, 404, { error: "Not found" }); }
    // Names are content hashes, so a file never changes.
    res.writeHead(200, { "Content-Type": MIME[path.extname(f[1]).slice(1)], "Content-Length": data.length, "Cache-Control": "public, max-age=31536000, immutable" });
    return res.end(m === "HEAD" ? undefined : data);
  }

  if (p === "/api/backup" && m === "GET") {
    return sendZip(res, await collectionZip(requireLibrary()), `ost-planner-backup-${today()}.zip`);
  }
  const bp = p.match(/^\/api\/backup\/project\/(-?\d+)$/);
  if (bp && m === "GET") {
    const { name, zip } = await projectZip(requireLibrary(), +bp[1]);
    return sendZip(res, zip, `ost-project-${slug(name)}-${today()}.zip`);
  }

  // Restore: ?apply=0 only reads the backup and says what's in it; ?apply=1 restores it.
  if (p === "/api/restore" && m === "POST") {
    const lib = requireLibrary();
    const { manifest, entries } = openBackup(await readBody(req, MAX_BACKUP));
    const apply = url.searchParams.get("apply") === "1";
    if (manifest.type === "collection") {
      if (!apply) return send(res, 200, { manifest });
      return send(res, 200, { manifest, result: await serial(() => restoreCollection(lib, entries)) });
    }
    if (manifest.type === "project") {
      const state = await readState(lib);
      const exists = (state["ost.projects"]?.list || []).some((x) => x.id === manifest.project.id);
      if (!apply) return send(res, 200, { manifest, exists });
      const mode = url.searchParams.get("mode") === "replace" ? "replace" : "copy";
      return send(res, 200, { manifest, result: await serial(() => restoreProject(lib, entries, mode)) });
    }
    throw httpError(400, "Unknown kind of backup.");
  }

  if (p.startsWith("/api/")) return send(res, 404, { error: "Not found" });
  if (m === "GET" || m === "HEAD") return serveStatic(req, res, p);
  return send(res, 405, { error: "Method not allowed" });
}

http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    if (!e.code || typeof e.code !== "number") console.error(e);
    if (!res.headersSent) send(res, typeof e.code === "number" ? e.code : 500, { error: e.message || "Server error" });
    else res.end();
  });
}).listen(PORT, () => console.log(`OST Planner on port ${PORT}, data in ${DATA_ROOT} (${HOST_DATA_DIR} on the host)`));
