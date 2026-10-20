// Starts the app once the server's library folder is ready; on first launch, asks where it should be.
import * as store from "./store.js";

const setup = document.getElementById("setup");
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// Kept as plain text by the old browser-only version; everything else was JSON.
const RAW_KEYS = ["ost.projects.layout", "ost.todos.hideDone"];

async function start() {
  await store.loadAll();
  setup.hidden = true;
  document.body.classList.remove("booting");
  await import("./app.js");
}

// What the browser-only version left in this browser, if anything.
function browserData() {
  const keys = [];
  try { for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i).startsWith("ost.")) keys.push(localStorage.key(i)); } catch {}
  if (!keys.length) return null;
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const projects = read("ost.projects")?.list?.length;
  const contacts = read("ost.contacts")?.length;
  const images = (read("ost.gallery") || []).reduce((n, g) => n + (g.versions || []).filter((v) => v.image).length, 0);
  const parts = [projects && `${projects} projects`, contacts && `${contacts} contacts`, images && `${images} images`].filter(Boolean);
  return { keys, summary: parts.length ? parts.join(", ") : "your settings" };
}

async function migrateBrowserData(keys, progress) {
  let i = 0;
  for (const k of keys) {
    progress(`Copying ${++i} of ${keys.length}…`);
    const raw = localStorage.getItem(k);
    let value = raw;
    if (!RAW_KEYS.includes(k)) { try { value = JSON.parse(raw); } catch { continue; } }
    await store.uploadImages(value);
    await store.api(`/api/state/${k}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  }
}

function screen(html) {
  setup.innerHTML = `<div class="setup-card">${html}</div>`;
  setup.hidden = false;
}

function showError(message) {
  screen(`<div class="setup-mark">O</div><h1>Can't reach the OST Planner server</h1><p>${esc(message)}</p><p class="muted">Check that the container is running (<code>docker compose ps</code>), then reload this page.</p>`);
}

function showSetup(st) {
  const local = browserData();
  const onHostDefault = /^\.[\\/]/.test(st.hostDataDir) || st.hostDataDir === "./data";
  const where = onHostDefault
    ? `the <b>data</b> folder next to <code>docker-compose.yml</code>`
    : `<code>${esc(st.hostDataDir)}</code>`;
  const choices = [
    local && ["browser", `Bring in what's saved in this browser`, `${esc(local.summary)}. Images are moved into the library folder. This browser's copy is left as it is.`],
    ["sample", "Start with the sample projects", "The same placeholder projects and contacts you've seen so far."],
    ["empty", "Start with an empty library", "No projects, contacts, tasks or images. Add your own from the first screen."],
    ["restore", "Restore from a backup", "A .zip made with Back up everything or Back up project, for example from another computer."],
  ].filter(Boolean);
  screen(`
    <div class="setup-mark">O</div>
    <h1>Where should OST Planner keep your projects?</h1>
    <p>Your projects, contacts, to-dos and uploaded images will be saved as files in one library folder on this computer, inside ${where}.</p>
    <form id="setup-form">
      <label class="field">
        <span>Library folder name</span>
        <input type="text" id="setup-folder" value="${esc(st.existing[0] || "OST Library")}" maxlength="80" required list="setup-existing" autocomplete="off">
        <datalist id="setup-existing">${st.existing.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
        <small id="setup-path"></small>
      </label>
      <fieldset class="setup-choices" id="setup-choices">
        <legend>What to start with</legend>
        ${choices.map(([v, t, d], i) => `
        <label class="setup-choice"><input type="radio" name="start" value="${v}"${i === 0 ? " checked" : ""}><span><b>${t}</b><small>${d}</small></span></label>`).join("")}
        <input type="file" id="setup-backup" accept=".zip,application/zip" hidden>
      </fieldset>
      <details class="setup-help">
        <summary>Keep the library somewhere else (another drive, a synced folder)</summary>
        <p>The app runs inside Docker, which can only see folders you share with it, so the location on your computer is set outside the app. Open the <code>.env</code> file next to <code>docker-compose.yml</code>, set <code>OST_DATA_DIR</code> to the full path of the folder you want (for example <code>/Users/you/Documents/OST Planner</code>), then run <code>docker compose up -d</code> and reload this page.</p>
        <p>Right now it is <code>${esc(st.hostDataDir)}</code>.</p>
      </details>
      ${st.writable ? "" : `<p class="setup-error">Docker can't write to ${where}. Check that the folder exists and isn't read-only.</p>`}
      <p class="setup-error" id="setup-error" hidden></p>
      <div class="setup-actions"><span class="muted" id="setup-progress"></span><button class="btn" id="setup-go">Set up library</button></div>
    </form>`);

  const folder = document.getElementById("setup-folder");
  const choicesEl = document.getElementById("setup-choices");
  const fileInput = document.getElementById("setup-backup");
  const sep = st.hostDataDir.includes("\\") && !st.hostDataDir.includes("/") ? "\\" : "/";
  const paint = () => {
    const name = folder.value.trim();
    const exists = st.existing.includes(name);
    document.getElementById("setup-path").innerHTML = exists
      ? `This library already exists and will be opened as it is: <code>${esc(st.hostDataDir.replace(/[\\/]+$/, ""))}${sep}${esc(name)}</code>`
      : `Will be created at <code>${esc(st.hostDataDir.replace(/[\\/]+$/, ""))}${sep}${esc(name)}</code>`;
    choicesEl.hidden = exists;
    document.getElementById("setup-go").textContent = exists ? "Open library" : "Set up library";
  };
  folder.addEventListener("input", paint);
  paint();

  const form = document.getElementById("setup-form");
  const err = document.getElementById("setup-error");
  const progress = (t) => (document.getElementById("setup-progress").textContent = t);
  const fail = (e) => { err.textContent = e.message || String(e); err.hidden = false; progress(""); form.querySelector("button").disabled = false; };

  choicesEl.addEventListener("change", (e) => {
    if (e.target.value === "restore" && !fileInput.files[0]) fileInput.click();
  });
  fileInput.addEventListener("change", () => {
    const opt = choicesEl.querySelector('[value="restore"]').closest("label").querySelector("small");
    opt.textContent = fileInput.files[0] ? `Selected: ${fileInput.files[0].name}` : opt.textContent;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.hidden = true;
    const name = folder.value.trim();
    const exists = st.existing.includes(name);
    const choice = form.start?.value || "sample";
    if (!exists && choice === "restore" && !fileInput.files[0]) { fileInput.click(); return; }
    form.querySelector("button").disabled = true;
    try {
      progress("Creating the library folder…");
      await store.api("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder: name }) });
      if (!exists && choice === "browser") await migrateBrowserData(local.keys, progress);
      if (!exists && choice === "empty") {
        progress("Creating an empty library…");
        const empty = { "ost.projects": { list: [] }, "ost.contacts": [], "ost.gallery": [], "ost.projectTodos": { general: [] } };
        for (const [k, v] of Object.entries(empty)) {
          await store.api(`/api/state/${k}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
        }
      }
      if (!exists && choice === "restore") {
        progress("Restoring the backup…");
        await store.api("/api/restore?apply=1&mode=copy", { method: "POST", headers: { "Content-Type": "application/zip" }, body: fileInput.files[0] });
      }
      await store.loadStatus();
      await start();
    } catch (e2) { fail(e2); }
  });
}

try {
  const st = await store.loadStatus();
  if (st.configured) await start();
  else showSetup(st);
} catch (e) {
  showError(e.message);
}
