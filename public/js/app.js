import { views, projects, projectDetails, generalTodos, milestones as sampleMilestones, contacts } from "./data.js";
import * as store from "./store.js";

const icons = {
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
  brush: '<path d="M14 4l6 6-8 8H6v-6z"/><path d="M4 20h4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  check: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/>',
  timeline: '<path d="M4 6h10M8 12h12M4 18h8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  comment: '<path d="M4 5h16v11H9l-5 4z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24">${icons[name]}</svg>`;

const DAY = 86400000;
const today = new Date();
today.setHours(0, 0, 0, 0);
const parse = (s) => new Date(s + "T00:00:00");
const daysUntil = (s) => Math.round((parse(s) - today) / DAY);
const fmt = (s) => parse(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const projectById = (id) => projects.find((p) => p.id === id);
const byDue = (a, b) => (a.due ? parse(a.due) : Infinity) - (b.due ? parse(b.due) : Infinity);
const isPersonal = (p) => p.type === "personal";
// Projects and Personal works share one list screen; the hash says which section is showing.
const isListScreen = () => location.hash === "#projects" || location.hash === "#personal";
const listSection = () => (location.hash === "#personal" ? "personal" : "projects");
const inSection = (p, section) => isPersonal(p) === (section === "personal");
const activeProjects = () => projects.filter((p) => p.active).sort(byDue);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const initials = (n) => n.replace(/^Dr\.\s*/, "").split(" ").map((w) => w[0]).slice(0, 2).join("");

function dueLabel(s) {
  if (!s) return `<span class="due">No due date</span>`;
  const d = daysUntil(s);
  if (d < 0) return `<span class="due overdue">${-d}d overdue</span>`;
  if (d === 0) return `<span class="due soon">Today</span>`;
  if (d <= 7) return `<span class="due soon">${d}d left</span>`;
  return `<span class="due">${fmt(s)}</span>`;
}

function renderNav(active) {
  document.getElementById("nav").innerHTML = views
    .map((v) => `<a href="#${v.id}" class="nav-item${v.id === active ? " active" : ""}">${svg(v.icon)}<span>${v.label}</span></a>`)
    .join("");
  document.getElementById("nav-projects").innerHTML = activeProjects()
    .map((p) => `<li><a href="#project/${p.id}"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</a></li>`)
    .join("");
}

const LAYOUT_KEY = "ost.overview.layout";
const defaultLayout = [
  { id: "views", hidden: false },
  { id: "stats", hidden: false },
  { id: "projects", hidden: false },
  { id: "today", hidden: false },
  { id: "milestones", hidden: false },
  { id: "uploads", hidden: false },
  { id: "clients", hidden: false },
];
let customizing = false;

function loadLayout() {
  try {
    const saved = store.get(LAYOUT_KEY);
    if (Array.isArray(saved)) {
      const known = saved.filter((s) => defaultLayout.some((d) => d.id === s.id));
      const missing = defaultLayout.filter((d) => !known.some((s) => s.id === d.id));
      return [...known, ...missing];
    }
  } catch {}
  return defaultLayout.map((s) => ({ ...s }));
}
function saveLayout(layout) {
  store.set(LAYOUT_KEY, layout);
}

function sections() {
  const projects = activeProjects();
  const tasks = allTasks().filter((t) => t.project.active);
  const open = tasks.filter((t) => t.status !== "Done");
  const overdue = open.filter((t) => t.due && daysUntil(t.due) < 0).length;
  const soon = open.filter((t) => t.due && daysUntil(t.due) <= 7).sort(byDue);
  const upcoming = projects.flatMap((p) => p.milestones.map((m) => ({ ...m, p }))).filter((m) => m.date && daysUntil(m.date) >= 0).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  const dueSoon = projects.filter((p) => daysUntil(p.due) >= 0 && daysUntil(p.due) <= 14).length;
  const clientCount = new Set(projects.filter((p) => p.type === "client").map((p) => p.client).filter(Boolean)).size;
  const stats = [
    { label: "Active projects", value: projects.length, note: `${projects.filter((p) => p.type === "personal").length} personal` },
    { label: "Open tasks", value: open.length, note: overdue ? `${overdue} overdue` : `${tasks.length - open.length} done` },
    { label: "Deadlines in 14 days", value: dueSoon, note: "projects" },
    { label: "Clients", value: clientCount, note: `${contacts.length} contacts` },
  ];

  return {
    views: { title: "Views", span: 3, bare: true, html: `
      <div class="view-cards">
        ${views.filter((v) => v.step).map((v) => `
          <a class="view-card" href="#${v.id}">
            <span class="view-icon">${svg(v.icon)}</span>
            <b>${v.label}</b>
            <span>${v.step}</span>
          </a>`).join("")}
      </div>` },

    stats: { title: "Summary", span: 3, bare: true, html: `
      <div class="stats">
        ${stats.map((s) => `
          <div class="stat">
            <div class="stat-label">${s.label}</div>
            <div class="stat-value">${s.value}</div>
            <div class="stat-note">${s.note}</div>
          </div>`).join("")}
      </div>` },

    projects: { title: "Projects", span: 2, link: ["#projects", "All projects"], html: `
      ${projects.length ? "" : '<p class="group-empty">No active projects. <a class="link" href="#projects">Add one</a></p>'}
      <ul class="project-list">
        ${projects.map((p) => `
          <li class="project-row">
            <span class="swatch" style="background:${p.color}"></span>
            <div class="project-main">
              <div class="project-name">${esc(p.name)}</div>
              <div class="project-meta">${esc([p.client, plural(openTasks(p).length, "open task")].filter(Boolean).join(" · "))}</div>
            </div>
            <div class="progress"><span style="width:${p.progress}%;background:${p.color}"></span></div>
            <div class="pct">${p.progress}%</div>
            ${dueLabel(p.due)}
          </li>`).join("")}
      </ul>` },

    today: { title: "Due this week", span: 1, link: ["#tasks", "Tasks"], html: soon.length ? `
      <ul class="due-list">
        ${soon.map((t) => `
          <li class="todo" data-taskedit="${t.project.id}:${t.id}">
            <button type="button" class="box" data-taskcheck="${t.project.id}:${t.id}" aria-label="Mark done"></button>
            <div>
              <div class="todo-text">${esc(t.name)}</div>
              <div class="todo-meta"><span class="dot" style="background:${t.project.color}"></span>${esc(t.project.name)} · ${dueLabel(t.due)}</div>
            </div>
          </li>`).join("")}
      </ul>` : '<p class="group-empty">Nothing due in the next 7 days.</p>' },

    milestones: { title: "Upcoming milestones", span: 1, link: ["#timeline", "Timeline"], html: `
      ${upcoming.length ? "" : '<p class="group-empty">No upcoming milestones.</p>'}
      <ol class="milestones">
        ${upcoming.map((m) => {
          const p = m.p;
          return `
          <li>
            <div class="ms-date"><span>${parse(m.date).toLocaleDateString(undefined, { month: "short" })}</span><b>${parse(m.date).getDate()}</b></div>
            <div class="ms-body">
              <div class="ms-title">${esc(m.title)}</div>
              <div class="todo-meta"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</div>
            </div>
          </li>`;
        }).join("")}
      </ol>` },

    uploads: { title: "Recent uploads", span: 1, link: ["#gallery", "Gallery"], html: `
      <div class="uploads">
        ${galleryItems().slice(0, 4).map((g) => galleryFigure(g)).join("") || '<p class="group-empty">No uploads yet.</p>'}
      </div>` },

    clients: { title: "Clients", span: 1, link: ["#contacts", "Contacts"], html: `
      ${contacts.length ? "" : '<p class="group-empty">No contacts yet.</p>'}
      <ul class="contacts">
        ${contacts.map((c) => `
          <li>
            ${avatar(c)}
            <div>
              <a class="contact-name" href="#contacts/${c.id}">${esc(c.name)}</a>
              <div class="todo-meta">${esc([c.role, c.org].filter(Boolean).join(", "))}</div>
            </div>
            <span class="phone">${esc(c.phone || "")}</span>
          </li>`).join("")}
      </ul>` },
  };
}

function overview() {
  const all = sections();
  const layout = loadLayout();
  const shown = layout.filter((s) => customizing || !s.hidden);

  const toolbar = customizing
    ? `<div class="customize-bar">
         <span>Use the arrows to reorder sections. Hidden sections stay listed here until you show them again.</span>
         <button class="btn ghost" data-act="reset" type="button">Reset</button>
         <button class="btn" data-act="done" type="button">Done</button>
       </div>`
    : "";

  return `${toolbar}
  <section class="grid${customizing ? " customizing" : ""}">
    ${shown.map((entry, i) => {
      const sec = all[entry.id];
      const controls = customizing ? `
        <div class="sec-controls">
          <button type="button" data-act="up" data-id="${entry.id}" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
          <button type="button" data-act="down" data-id="${entry.id}" ${i === shown.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
          <button type="button" data-act="toggle" data-id="${entry.id}">${entry.hidden ? "Show" : "Hide"}</button>
        </div>` : "";
      const head = `<div class="card-head"><h2>${sec.title}</h2>${controls}${!customizing && sec.link ? `<a href="${sec.link[0]}" class="link">${sec.link[1]}</a>` : ""}</div>`;
      return `<div class="section span-${sec.span}${sec.bare ? " bare" : " card"}${entry.hidden ? " is-hidden" : ""}">${head}${sec.html}</div>`;
    }).join("")}
  </section>`;
}

function onOverviewClick(e) {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const layout = loadLayout();
  const act = btn.dataset.act;
  if (act === "done") customizing = false;
  else if (act === "reset") saveLayout(defaultLayout);
  else {
    const i = layout.findIndex((s) => s.id === btn.dataset.id);
    if (act === "toggle") layout[i].hidden = !layout[i].hidden;
    if (act === "up" && i > 0) [layout[i - 1], layout[i]] = [layout[i], layout[i - 1]];
    if (act === "down" && i < layout.length - 1) [layout[i + 1], layout[i]] = [layout[i], layout[i + 1]];
    saveLayout(layout);
  }
  document.getElementById("view").innerHTML = overview();
}

const BRAND_KEY = "ost.brand";
const defaultBrand = { name: "OST Planner", logo: "", theme: "light", accent: "" };

function loadBrand() {
  return { ...defaultBrand, ...store.get(BRAND_KEY) };
}

function paintMark(el, brand) {
  el.classList.toggle("has-logo", !!brand.logo);
  el.innerHTML = brand.logo ? `<img src="${brand.logo}" alt="">` : (brand.name.trim()[0] || "O").toUpperCase();
}

// Theme: light, dark or the system setting. Accent "" means the default (near-black in light, near-white in dark).
const accentChoices = [["", "Graphite"], ["#4C6EF5", "Blue"], ["#2F9E77", "Green"], ["#E8833A", "Orange"], ["#AE3EC9", "Purple"], ["#D6453D", "Red"], ["#1098AD", "Teal"]];
const systemDark = matchMedia("(prefers-color-scheme: dark)");

function applyTheme(brand = loadBrand()) {
  const dark = brand.theme === "dark" || (brand.theme === "auto" && systemDark.matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  if (brand.accent) {
    const n = parseInt(brand.accent.slice(1), 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    root.style.setProperty("--accent", brand.accent);
    root.style.setProperty("--on-accent", lum > 0.62 ? "#111" : "#fff");
  } else {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--on-accent");
  }
}

function applyBrand(brand = loadBrand()) {
  applyTheme(brand);
  document.getElementById("brand-name").textContent = brand.name;
  paintMark(document.getElementById("brand-mark"), brand);
  document.title = brand.name;
}

// Shrinks an image before it is saved (logo: 256px PNG, covers: 640px JPEG, gallery: 2400px JPEG).
function readImage(file, size = 256, type = "image/png") {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, size / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL(type, 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function setupBrandDialog() {
  const dialog = document.getElementById("brand-dialog");
  const input = document.getElementById("brand-input");
  const preview = document.getElementById("logo-preview");
  let draft;

  const paintAppearance = () => {
    document.querySelectorAll("[data-theme-mode]").forEach((b) => b.classList.toggle("on", b.dataset.themeMode === draft.theme));
    const custom = draft.accent && !accentChoices.some(([c]) => c.toLowerCase() === draft.accent.toLowerCase());
    document.getElementById("accent-swatches").innerHTML = accentChoices.map(([c, label]) => `<button type="button" class="accent-swatch${(draft.accent || "").toLowerCase() === c.toLowerCase() ? " on" : ""}" data-accent="${c}" style="--c:${c || "var(--text)"}" title="${label}" aria-label="${label}"></button>`).join("")
      + `<label class="accent-swatch accent-custom${custom ? " on" : ""}" title="Custom color"${custom ? ` style="background:${draft.accent}"` : ""}><input type="color" id="accent-custom" value="${draft.accent || "#4c6ef5"}" aria-label="Custom accent color"></label>`;
    applyTheme(draft);
  };
  document.getElementById("brand").addEventListener("click", () => {
    draft = loadBrand();
    input.value = draft.name;
    paintMark(preview, draft);
    paintAppearance();
    dialog.showModal();
  });
  dialog.addEventListener("click", (e) => {
    const mode = e.target.closest("[data-theme-mode]");
    const sw = e.target.closest("[data-accent]");
    if (mode) { draft.theme = mode.dataset.themeMode; paintAppearance(); }
    else if (sw) { draft.accent = sw.dataset.accent; paintAppearance(); }
  });
  dialog.addEventListener("input", (e) => { if (e.target.id === "accent-custom") { draft.accent = e.target.value; applyTheme(draft); } });
  dialog.addEventListener("change", (e) => { if (e.target.id === "accent-custom") paintAppearance(); });
  systemDark.addEventListener("change", () => applyTheme());
  input.addEventListener("input", () => { draft.name = input.value; if (!draft.logo) paintMark(preview, draft); });
  document.getElementById("logo-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    draft.logo = await readImage(file);
    paintMark(preview, draft);
    e.target.value = "";
  });
  document.getElementById("logo-remove").addEventListener("click", () => { draft.logo = ""; paintMark(preview, draft); });
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "save") { applyTheme(); return; }
    draft.name = input.value.trim() || defaultBrand.name;
    store.set(BRAND_KEY, draft);
    applyBrand(draft);
  });
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function toast(text, ms = 6000, action = null) {
  const el = document.getElementById("toast");
  el.textContent = text;
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toast-action";
    b.textContent = action.label;
    b.addEventListener("click", () => { el.hidden = true; action.fn(); });
    el.append(b);
  }
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), ms);
}

// Storage and backups, in Dashboard settings. Backups are downloads; restoring reloads the app.
function paintStorage() {
  const st = store.info.status || {};
  const u = store.info.usage || {};
  document.getElementById("lib-path").textContent = st.hostPath || "";
  const size = (u.bytes || 0) < 1024 * 1024 ? `${Math.ceil((u.bytes || 0) / 1024)} KB` : mb(u.bytes);
  document.getElementById("lib-usage").textContent = `${size} used · ${plural(u.files || 0, "stored file")}`;
  const sel = document.getElementById("backup-project");
  const keep = sel.value;
  sel.innerHTML = projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  if (projects.some((p) => String(p.id) === keep)) sel.value = keep;
  paintBackupLink();
}
function paintBackupLink() {
  const id = document.getElementById("backup-project").value;
  const link = document.getElementById("backup-one");
  link.toggleAttribute("aria-disabled", !id);
  if (id) link.href = `/api/backup/project/${id}`;
  else link.removeAttribute("href");
}

function setupBackups() {
  const brandDialog = document.getElementById("brand-dialog");
  const dialog = document.getElementById("restore-dialog");
  const fileInput = document.getElementById("restore-file");
  let file = null;
  document.getElementById("brand").addEventListener("click", paintStorage);
  document.getElementById("backup-project").addEventListener("change", paintBackupLink);
  // A backup includes what's been saved, so wait for saves still on their way to the server.
  for (const id of ["backup-all", "backup-one"]) {
    document.getElementById(id).addEventListener("click", (e) => {
      if (!store.isSaving()) return toast("Backup started. Your browser saves it to your downloads folder.");
      e.preventDefault();
      toast("Finishing saving first…");
      const link = e.currentTarget;
      const wait = setInterval(() => { if (!store.isSaving()) { clearInterval(wait); link.click(); } }, 300);
    });
  }
  fileInput.addEventListener("change", async () => {
    file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    let info;
    try {
      info = await store.api("/api/restore?apply=0", { method: "POST", headers: { "Content-Type": "application/zip" }, body: file });
    } catch (e) { alert(e.message); return; }
    const m = info.manifest;
    const made = new Date(m.created).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    const c = m.counts || {};
    const body = document.getElementById("restore-body");
    const actions = document.getElementById("restore-actions");
    const cancel = `<button class="btn ghost" value="cancel">Cancel</button>`;
    if (m.type === "collection") {
      document.getElementById("restore-title").textContent = "Restore the whole library?";
      body.innerHTML = `<p><b>${esc(file.name)}</b>, made ${esc(made)}: ${plural(c.projects || 0, "project")}, ${plural(c.contacts || 0, "contact")}, ${plural(c.images || 0, "image")}.</p>
        <p>This replaces everything in <code>${esc(store.info.status.hostPath)}</code>. A copy of the current library is saved first in its <code>backups</code> folder.</p>`;
      actions.innerHTML = `${cancel}<button class="btn danger" value="replace">Replace library</button>`;
    } else {
      document.getElementById("restore-title").textContent = `Restore "${m.project.name}"?`;
      body.innerHTML = `<p><b>${esc(file.name)}</b>, made ${esc(made)}: ${plural(c.todos || 0, "to-do card")}, ${plural(c.galleryItems || 0, "gallery file")}, ${plural(c.images || 0, "image")}, ${plural(c.contacts || 0, "contact")}.</p>
        ${info.exists
          ? `<p>This library already has a project with the same id. Replace it with the backup, or add the backup as a separate copy?</p>`
          : `<p>The project is added to this library. Contacts that aren't here yet are added too.</p>`}`;
      actions.innerHTML = info.exists
        ? `${cancel}<button class="btn ghost" value="copy">Add as a copy</button><button class="btn danger" value="replace">Replace it</button>`
        : `${cancel}<button class="btn" value="copy">Add project</button>`;
    }
    brandDialog.close("cancel");
    dialog.returnValue = "";
    dialog.showModal();
  });
  dialog.addEventListener("close", async () => {
    const mode = dialog.returnValue;
    if (!file || !["copy", "replace"].includes(mode)) return;
    toast("Restoring…", 60000);
    try {
      await store.api(`/api/restore?apply=1&mode=${mode}`, { method: "POST", headers: { "Content-Type": "application/zip" }, body: file });
      sessionStorage.setItem("ost.restored", file.name);
      location.reload();
    } catch (e) { toast(`Restore failed: ${e.message}`, 10000); }
  });
}

// First run on a new library: write the starting data so backups and restores have it.
function seedLibrary() {
  if (!store.has(PROJECTS_KEY)) saveProjects();
  if (!store.has(CONTACTS_KEY)) saveContacts();
  if (!store.has(GALLERY_KEY)) saveGallery();
  if (!store.has(TODOS_KEY)) {
    const all = {};
    for (const id of [...projects.map((p) => p.id), "general"]) all[id] = loadTodos(id);
    store.set(TODOS_KEY, all);
  }
}

// Projects (list, added and removed ones, edits, uploaded covers) are saved in the library on the server.
const PROJECTS_KEY = "ost.projects";
const PROJECT_LAYOUT_KEY = "ost.projects.layout";
const projectColors = ["#E8833A", "#4C6EF5", "#2F9E77", "#AE3EC9", "#E0A100", "#D6453D", "#5C7080", "#1098AD"];
const projectDefaults = projects.map((p) => ({ ...p }));
let editingProjects = false;

function loadProjects() {
  let st = null;
  st = store.get(PROJECTS_KEY);
  let list;
  if (st && Array.isArray(st.list)) list = st.list;
  else if (st) {
    // Older format: an order plus edits to the placeholder projects.
    const order = st.order || [];
    const items = st.items || {};
    const rank = (p) => (order.includes(p.id) ? order.indexOf(p.id) : order.length + projectDefaults.indexOf(p));
    list = projectDefaults.slice().sort((a, b) => rank(a) - rank(b)).map((d) => ({ ...d, ...items[d.id] }));
  } else list = projectDefaults.map((d) => ({ ...d }));
  projects.splice(0, projects.length, ...list);
  // Tasks, milestones and the start date used to be fixed sample data; they now live on each project.
  let moved = false;
  for (const p of projects) {
    const d = projectDetails[p.id] || {};
    if (!Array.isArray(p.tasks)) { p.tasks = (d.tasks || []).map((t, i) => ({ id: i + 1, ...t })); moved = true; }
    if (!Array.isArray(p.milestones)) { p.milestones = sampleMilestones.filter((m) => m.project === p.id).map((m, i) => ({ id: i + 1, title: m.title, date: m.date })); moved = true; }
    if (p.created === undefined) { p.created = d.created || ""; moved = true; }
    if (p.description === undefined) {
      p.description = d.description || "";
      p.invoice = d.invoice ? { name: d.invoice, url: "" } : null;
      p.amount = d.amount ?? null;
      moved = true;
    }
  }
  if (moved && store.has(PROJECTS_KEY)) saveProjects();
}

const openTasks = (p) => p.tasks.filter((t) => t.status !== "Done");
const nextId = (list) => Math.max(0, ...list.map((x) => +x.id || 0)) + 1;

function saveProjects() {
  store.set(PROJECTS_KEY, { list: projects });
  return true;
}

function loadProjectLayout() {
  return store.get(PROJECT_LAYOUT_KEY) === "rows" ? "rows" : "squares";
}

// Moves a project next to another one (or to the end of a group) and sets its group.
function moveProject(id, active, targetId = null, before = true) {
  const p = projectById(id);
  projects.splice(projects.indexOf(p), 1);
  p.active = active;
  let i;
  if (targetId != null && targetId !== id) i = projects.indexOf(projectById(targetId)) + (before ? 0 : 1);
  else {
    const last = projects.filter((x) => x.active === active && isPersonal(x) === isPersonal(p)).pop();
    i = last ? projects.indexOf(last) + 1 : projects.length;
  }
  projects.splice(i, 0, p);
  saveProjects();
}

const projectDue = (p) => (!p.due ? `<span class="due">No due date</span>` : p.active ? dueLabel(p.due) : `<span class="due">${fmt(p.due)}</span>`);
const projectCover = (p) => (p.image
  ? `<img src="${p.image}" alt="" loading="lazy" draggable="false">`
  : `<div class="cover-blank" style="--c:${p.color}">${svg("image")}</div>`);

function projectCard(p, i, list) {
  const rows = loadProjectLayout() === "rows";
  const tag = editingProjects ? "article" : "a";
  const attrs = editingProjects ? ' draggable="true"' : ` href="#project/${p.id}"`;
  const title = editingProjects
    ? `<input class="title-input" value="${esc(p.name)}" maxlength="60" data-pact="name" aria-label="Project name">`
    : `<h3>${esc(p.name)}</h3>`;
  const upload = editingProjects ? `<label class="cover-upload">${svg("image")}<span>Change image</span><input type="file" accept="image/*" data-pact="image" hidden></label>` : "";
  const tools = editingProjects ? `
    <div class="card-tools">
      <button type="button" data-pact="left" ${i === 0 ? "disabled" : ""} aria-label="Move ${rows ? "up" : "left"}">${rows ? "↑" : "←"}</button>
      <button type="button" data-pact="right" ${i === list.length - 1 ? "disabled" : ""} aria-label="Move ${rows ? "down" : "right"}">${rows ? "↓" : "→"}</button>
      <button type="button" data-pact="toggle">${p.active ? "Deactivate" : "Activate"}</button>
    </div>` : "";
  const remove = editingProjects ? `<button type="button" class="remove-btn" data-pact="remove">Remove</button>` : "";

  if (rows) return `
  <${tag} class="project-card as-row${p.active ? "" : " inactive"}" data-id="${p.id}"${attrs}>
    <div class="row-thumb">${projectCover(p)}<div class="row-title">${title}</div>${upload}</div>
    <div class="row-stage"><span>Stage or timeline</span></div>
    <div class="row-due">${projectDue(p)}</div>
    ${editingProjects ? `<div class="row-tools">${tools}${remove}</div>` : ""}
  </${tag}>`;

  return `
  <${tag} class="project-card${p.active ? "" : " inactive"}" data-id="${p.id}"${attrs}>
    <div class="cover">
      ${projectCover(p)}
      <div class="cover-title">${title}</div>
      ${tools}${upload}
    </div>
    <div class="project-card-body">
      <div class="project-card-due">${projectDue(p)}</div>
      ${remove}
    </div>
  </${tag}>`;
}

function projectsView() {
  const section = listSection();
  const layout = loadProjectLayout();
  const groups = [
    { title: "Active", active: true },
    { title: "Not active", active: false },
  ];
  const toolbar = editingProjects
    ? `<div class="customize-bar">
         <span>Drag cards to reorder them or move them to the other group. Click a title to rename it. Changes are saved in your library.</span>
         <button class="btn ghost" data-pact="reset" type="button">Reset</button>
         <button class="btn" data-pact="done" type="button">Done</button>
       </div>`
    : "";
  const controls = `
  <div class="projects-toolbar">
    <div class="segmented" role="group" aria-label="Layout">
      <button type="button" data-pact="layout" data-layout="squares" class="${layout === "squares" ? "on" : ""}" aria-pressed="${layout === "squares"}">Squares</button>
      <button type="button" data-pact="layout" data-layout="rows" class="${layout === "rows" ? "on" : ""}" aria-pressed="${layout === "rows"}">Rows</button>
    </div>
    <button type="button" class="btn" data-pact="new">${section === "personal" ? "+ New personal work" : "+ New project"}</button>
  </div>`;
  return toolbar + controls + groups.map((g) => {
    const list = projects.filter((p) => p.active === g.active && inSection(p, section));
    return `
  <section class="project-group${editingProjects ? " editing" : ""}" data-active="${g.active}">
    <div class="group-head"><h2>${g.title}</h2><span class="count">${list.length}</span></div>
    ${list.length || editingProjects
      ? `<div class="${layout === "rows" ? "project-rows" : "project-grid"}">${list.map(projectCard).join("")}</div>`
      : `<p class="group-empty">No ${g.title.toLowerCase()} ${section === "personal" ? "personal works" : "projects"}.</p>`}
  </section>`;
  }).join("");
}

function renderProjects() {
  document.getElementById("view").innerHTML = projectsView();
  renderNav(listSection());
}

function onProjectsClick(e) {
  const btn = e.target.closest("button[data-pact]");
  if (!btn) return;
  const act = btn.dataset.pact;
  if (act === "done") editingProjects = false;
  else if (act === "new") return openProjectDialog();
  else if (act === "layout") {
    store.set(PROJECT_LAYOUT_KEY, btn.dataset.layout);
  } else if (act === "reset") {
    if (!confirm("Reset all projects to the original placeholders? Projects you added, removed, renamed or gave an image will be lost.")) return;
    store.remove(PROJECTS_KEY);
    loadProjects();
    saveProjects();
  } else {
    const p = projectById(+btn.closest(".project-card").dataset.id);
    const group = projects.filter((x) => x.active === p.active && isPersonal(x) === isPersonal(p));
    const i = group.indexOf(p);
    if (act === "toggle") moveProject(p.id, !p.active);
    if (act === "left") moveProject(p.id, p.active, group[i - 1].id, true);
    if (act === "right") moveProject(p.id, p.active, group[i + 1].id, false);
    if (act === "remove") {
      if (!confirm(`Remove "${p.name}"? It's deleted from the library and can't be undone. Back it up first in Dashboard settings if you might want it later.`)) return;
      projects.splice(projects.indexOf(p), 1);
      saveProjects();
    }
  }
  renderProjects();
}

async function onProjectsChange(e) {
  const el = e.target.closest("[data-pact]");
  if (!el || !el.closest(".project-card")) return;
  const p = projectById(+el.closest(".project-card").dataset.id);
  if (el.dataset.pact === "name") {
    p.name = el.value.trim() || p.name;
  } else if (el.dataset.pact === "image" && el.files[0]) {
    p.image = await readImage(el.files[0], 640, "image/jpeg");
  } else return;
  saveProjects();
  renderProjects();
}

function setupProjectDrag(view) {
  let dragId = null;
  const clear = () => view.querySelectorAll(".drop-before, .drop-after, .drop-end").forEach((el) => el.classList.remove("drop-before", "drop-after", "drop-end"));
  const target = (e) => {
    const group = e.target.closest(".project-group.editing");
    if (!group) return null;
    const card = e.target.closest(".project-card");
    let before = false;
    if (card) {
      const r = card.getBoundingClientRect();
      before = card.classList.contains("as-row") ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
    }
    return { group, card, before };
  };
  view.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".project-card[draggable]");
    if (!card) return;
    dragId = +card.dataset.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(dragId));
    requestAnimationFrame(() => card.classList.add("dragging"));
  });
  view.addEventListener("dragover", (e) => {
    const t = dragId != null && target(e);
    if (!t) return;
    e.preventDefault();
    clear();
    if (t.card) t.card.classList.add(t.before ? "drop-before" : "drop-after");
    else t.group.classList.add("drop-end");
  });
  view.addEventListener("drop", (e) => {
    const t = dragId != null && target(e);
    if (!t) return;
    e.preventDefault();
    moveProject(dragId, t.group.dataset.active === "true", t.card ? +t.card.dataset.id : null, t.before);
    dragId = null;
    renderProjects();
  });
  view.addEventListener("dragend", () => { dragId = null; clear(); view.querySelectorAll(".dragging").forEach((el) => el.classList.remove("dragging")); });
}

function openProjectDialog(section = isListScreen() ? listSection() : "projects") {
  const dialog = document.getElementById("project-dialog");
  document.getElementById("project-form").reset();
  dialog.dataset.section = section;
  document.getElementById("project-start").value = new Date().toISOString().slice(0, 10);
  document.getElementById("project-dialog-title").textContent = section === "personal" ? "New personal work" : "New project";
  dialog.showModal();
}

function setupProjectDialog() {
  const dialog = document.getElementById("project-dialog");
  dialog.addEventListener("close", async () => {
    if (dialog.returnValue !== "save") return;
    const name = document.getElementById("project-name").value.trim();
    if (!name) return;
    const file = document.getElementById("project-image").files[0];
    const personal = dialog.dataset.section === "personal";
    const p = {
      id: Date.now(),
      name,
      type: personal ? "personal" : "client",
      client: personal ? "Personal" : "",
      color: projectColors[projects.length % projectColors.length],
      progress: 0,
      due: document.getElementById("project-due").value || "",
      active: document.getElementById("project-active").checked,
      image: file ? await readImage(file, 640, "image/jpeg") : "",
      created: document.getElementById("project-start").value || "",
      tasks: [],
      milestones: [],
      contactIds: [],
    };
    projects.push(p);
    // Keep it at the end of its own group.
    projects.splice(projects.indexOf(p), 1);
    const last = projects.filter((x) => x.active === p.active && isPersonal(x) === isPersonal(p)).pop();
    projects.splice(last ? projects.indexOf(last) + 1 : projects.length, 0, p);
    saveProjects();
    if (isListScreen() && listSection() === dialog.dataset.section) renderProjects();
    else location.hash = `#project/${p.id}`;
  });
}

const fmtFull = (s) => (s ? parse(s).toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "numeric" }) : "—");
const money = (n) => (n == null ? "—" : n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }));

// To-do cards are stored per project (plus "general" for loose to-dos).
// The project page shows one project's cards; the To-do screen shows them all on one board.
const TODOS_KEY = "ost.projectTodos";
const todoColumns = ["In progress", "On hold", "Done"];
let addingTo = null;
let todoFilter = "all";
let todoProject = "";
const HIDE_DONE_KEY = "ost.todos.hideDone";
let openCard = null;

function hideDone() {
  return store.get(HIDE_DONE_KEY) === "1";
}

function loadTodos(projectId) {
  const all = store.get(TODOS_KEY) || {};
  if (all[projectId]) return all[projectId];
  const seed = projectId === "general" ? generalTodos : (projectDetails[projectId] || {}).todos || [];
  return seed.map((t, i) => ({ id: i + 1, ...t }));
}

function saveTodos(projectId, list) {
  const all = store.get(TODOS_KEY) || {};
  all[projectId] = list;
  store.set(TODOS_KEY, all);
}

// Which projects' cards the combined board shows, in sidebar order, with "general" last.
function boardSources() {
  if (todoProject) return [todoProject];
  const ids = projects
    .filter((p) => todoFilter === "all" || (todoFilter === "personal") === isPersonal(p))
    .map((p) => String(p.id));
  return todoFilter === "all" ? [...ids, "general"] : ids;
}

function todoCard(t, pid, col, combined) {
  const check = '<svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/></svg>';
  const p = pid !== "general" && projectById(+pid);
  const tag = combined
    ? `<a class="card-project" href="${p ? `#project/${p.id}` : "#todo"}" draggable="false"><span class="dot" style="background:${p ? p.color : "#a3a3a8"}"></span>${p ? esc(p.name) : "General"}</a>`
    : "";
  return `
        <div class="todo-card${col === "Done" ? " done" : ""}" draggable="true" data-tid="${t.id}" data-project="${pid}">
          ${col === "Done" ? `<span class="box">${check}</span>` : ""}
          <div class="todo-card-body"><span class="todo-card-text">${esc(t.text)}</span>${tag}${t.comments?.length ? `<span class="card-comments">${svg("comment")}${t.comments.length}</span>` : ""}</div>
          <button class="icon-btn del" type="button" data-tact="delete" aria-label="Delete card">×</button>
        </div>`;
}

function todoBoard(projectId = null) {
  const combined = projectId == null;
  const sources = combined ? boardSources() : [String(projectId)];
  const cards = sources.flatMap((pid) => loadTodos(pid).map((t) => ({ t, pid })));
  const picker = combined
    ? `<select class="add-card-project" aria-label="Project">
         ${projects.filter((p) => p.active).map((p) => `<option value="${p.id}"${String(p.id) === (todoProject || sources[0]) ? " selected" : ""}>${esc(p.name)}</option>`).join("")}
         <option value="general"${(todoProject || sources[0]) === "general" ? " selected" : ""}>General</option>
       </select>`
    : "";
  return todoColumns.map((col) => {
    const items = cards.filter(({ t }) => t.column === col);
    const hidden = col === "Done" && hideDone();
    const doneTools = col === "Done"
      ? `<span class="list-tools">
           <button type="button" data-tact="toggle-done">${hidden ? "Show" : "Hide"}</button>
           <button type="button" data-tact="clear-done" ${items.length ? "" : "disabled"}>Clear</button>
         </span>`
      : "";
    const adder = addingTo === col
      ? `<form class="add-card" data-col="${col}">
           <textarea rows="2" placeholder="Enter a title for this card…" maxlength="200"></textarea>
           ${picker}
           <div><button class="btn" type="submit">Add card</button><button class="icon-btn" type="button" data-tact="cancel" aria-label="Cancel">×</button></div>
         </form>`
      : `<button class="add-card-btn" type="button" data-tact="add" data-col="${col}">+ Add a card</button>`;
    return `
    <div class="todo-list" data-col="${col}">
      <h3>${col}<span>${items.length}</span>${doneTools}</h3>
      <div class="todo-cards">
        ${hidden
          ? `<p class="col-empty">${items.length ? `${items.length} done card${items.length === 1 ? "" : "s"} hidden` : "Nothing done yet"}</p>`
          : items.map(({ t, pid }) => todoCard(t, pid, col, combined)).join("")}
      </div>
      ${adder}
    </div>`;
  }).join("");
}

function renderTodoBoard(board) {
  board.innerHTML = board.dataset.project ? todoBoard(board.dataset.project) : todoBoard();
  board.querySelector(".add-card textarea")?.focus();
}

function addTodo(form) {
  const board = form.closest(".todo-board");
  const text = form.querySelector("textarea").value.trim();
  if (text) {
    const pid = board.dataset.project || form.querySelector(".add-card-project").value;
    const list = loadTodos(pid);
    list.push({ id: Date.now(), text, column: form.dataset.col });
    saveTodos(pid, list);
  }
  addingTo = null;
  renderTodoBoard(board);
}

function onTodoBoardClick(e) {
  const btn = e.target.closest("[data-tact]");
  const board = e.target.closest(".todo-board");
  if (!board) return;
  const card = e.target.closest(".todo-card");
  if (!btn && card && !e.target.closest("a")) return openCardDialog(card.dataset.project, +card.dataset.tid, board);
  if (!btn) return;
  const act = btn.dataset.tact;
  if (act === "toggle-done") {
    store.set(HIDE_DONE_KEY, hideDone() ? "0" : "1");
  }
  if (act === "clear-done") {
    const sources = board.dataset.project ? [board.dataset.project] : boardSources();
    const n = sources.reduce((sum, pid) => sum + loadTodos(pid).filter((t) => t.column === "Done").length, 0);
    if (!confirm(`Delete ${n} done card${n === 1 ? "" : "s"}${board.dataset.project ? " from this project" : " shown on this board"}? This can't be undone.`)) return;
    sources.forEach((pid) => saveTodos(pid, loadTodos(pid).filter((t) => t.column !== "Done")));
  }
  if (act === "add") addingTo = btn.dataset.col;
  if (act === "cancel") addingTo = null;
  if (act === "delete") {
    const card = btn.closest(".todo-card");
    const pid = card.dataset.project;
    saveTodos(pid, loadTodos(pid).filter((t) => t.id !== +card.dataset.tid));
  }
  renderTodoBoard(board);
}

function openCardDialog(pid, tid, board) {
  openCard = { pid, tid, board };
  renderCardDialog();
  document.getElementById("card-dialog").showModal();
}

function renderCardDialog() {
  const { pid, tid } = openCard;
  const t = loadTodos(pid).find((x) => x.id === tid);
  if (!t) return;
  const p = pid !== "general" && projectById(+pid);
  const comments = t.comments || [];
  document.getElementById("card-title").value = t.text;
  document.getElementById("card-meta").innerHTML = `<span class="dot" style="background:${p ? p.color : "#a3a3a8"}"></span>${p ? esc(p.name) : "General"} · ${t.column}`;
  document.getElementById("card-comments").innerHTML = comments.length
    ? comments.map((c) => `
      <li data-cid="${c.id}">
        <div class="comment-head"><span>${new Date(c.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><button type="button" class="icon-btn" data-cdel aria-label="Delete comment">×</button></div>
        <p>${esc(c.text)}</p>
      </li>`).join("")
    : `<li class="col-empty">No comments yet.</li>`;
}

function updateOpenCard(change) {
  const { pid, tid } = openCard;
  const list = loadTodos(pid);
  const t = list.find((x) => x.id === tid);
  if (!t) return;
  change(t);
  saveTodos(pid, list);
}

function setupCardDialog() {
  const dialog = document.getElementById("card-dialog");
  const input = document.getElementById("card-comment-input");
  const addComment = () => {
    const text = input.value.trim();
    if (!text) return;
    updateOpenCard((t) => { t.comments = [...(t.comments || []), { id: Date.now(), text, at: new Date().toISOString() }]; });
    input.value = "";
    renderCardDialog();
  };
  document.getElementById("card-comment-add").addEventListener("click", addComment);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addComment(); }
  });
  document.getElementById("card-comments").addEventListener("click", (e) => {
    const del = e.target.closest("[data-cdel]");
    if (!del) return;
    const cid = +del.closest("li").dataset.cid;
    updateOpenCard((t) => { t.comments = (t.comments || []).filter((c) => c.id !== cid); });
    renderCardDialog();
  });
  document.getElementById("card-title").addEventListener("change", (e) => {
    const text = e.target.value.trim();
    if (text) updateOpenCard((t) => { t.text = text; });
  });
  dialog.addEventListener("close", () => {
    if (openCard && document.body.contains(openCard.board)) renderTodoBoard(openCard.board);
    openCard = null;
    input.value = "";
  });
}

function todoView() {
  const filters = [["all", "All"], ["projects", "Projects"], ["personal", "Personal works"]];
  const options = projects.filter((p) => todoFilter === "all" || (todoFilter === "personal") === isPersonal(p));
  return `
  <div class="projects-toolbar">
    <div class="segmented" role="group" aria-label="Show to-dos from">
      ${filters.map(([k, label]) => `<button type="button" data-todofilter="${k}" class="${todoFilter === k ? "on" : ""}" aria-pressed="${todoFilter === k}">${label}</button>`).join("")}
    </div>
    <select class="select" data-todoproject aria-label="Project">
      <option value="">${todoFilter === "personal" ? "All personal works" : todoFilter === "projects" ? "All projects" : "Everything"}</option>
      ${options.map((p) => `<option value="${p.id}"${String(p.id) === todoProject ? " selected" : ""}>${esc(p.name)}</option>`).join("")}
      ${todoFilter === "all" ? `<option value="general"${todoProject === "general" ? " selected" : ""}>General</option>` : ""}
    </select>
  </div>
  <div class="todo-board combined">${todoBoard()}</div>`;
}

function onTodoViewClick(e) {
  const f = e.target.closest("[data-todofilter]");
  if (f) {
    todoFilter = f.dataset.todofilter;
    todoProject = "";
    addingTo = null;
    document.getElementById("view").innerHTML = todoView();
  } else onTodoBoardClick(e);
}

function setupTodoBoard(view) {
  let drag = null;
  const clear = () => view.querySelectorAll(".todo-board .drop-before, .todo-board .drop-after, .todo-list.drop-end").forEach((el) => el.classList.remove("drop-before", "drop-after", "drop-end"));
  const target = (e) => {
    const list = e.target.closest(".todo-board .todo-list");
    if (!list) return null;
    const card = e.target.closest(".todo-card");
    const before = card ? e.clientY < card.getBoundingClientRect().top + card.offsetHeight / 2 : false;
    return { list, card, before };
  };
  view.addEventListener("submit", (e) => {
    if (!e.target.matches(".add-card")) return;
    e.preventDefault();
    addTodo(e.target);
  });
  view.addEventListener("keydown", (e) => {
    if (!e.target.matches(".add-card textarea")) return;
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addTodo(e.target.form); }
    if (e.key === "Escape") { addingTo = null; renderTodoBoard(e.target.closest(".todo-board")); }
  });
  view.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".todo-card");
    if (!card) return;
    drag = { tid: +card.dataset.tid, pid: card.dataset.project, board: card.closest(".todo-board") };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.dataset.tid);
    requestAnimationFrame(() => card.classList.add("dragging"));
  });
  view.addEventListener("dragover", (e) => {
    const t = drag && target(e);
    if (!t) return;
    e.preventDefault();
    clear();
    if (t.card) t.card.classList.add(t.before ? "drop-before" : "drop-after");
    else t.list.classList.add("drop-end");
  });
  view.addEventListener("drop", (e) => {
    const t = drag && target(e);
    if (!t) return;
    e.preventDefault();
    // A card always stays in its own project; only its column and place within that project change.
    const list = loadTodos(drag.pid);
    const item = list.find((x) => x.id === drag.tid);
    list.splice(list.indexOf(item), 1);
    item.column = t.list.dataset.col;
    let i;
    const sameProject = t.card && t.card.dataset.project === drag.pid;
    const targetId = sameProject ? +t.card.dataset.tid : null;
    if (targetId != null && targetId !== item.id) i = list.findIndex((x) => x.id === targetId) + (t.before ? 0 : 1);
    else {
      const last = list.filter((x) => x.column === item.column).pop();
      i = last ? list.indexOf(last) + 1 : list.length;
    }
    list.splice(i, 0, item);
    saveTodos(drag.pid, list);
    const board = drag.board;
    drag = null;
    renderTodoBoard(board);
  });
  view.addEventListener("dragend", () => {
    drag = null;
    clear();
    view.querySelectorAll(".todo-card.dragging").forEach((el) => el.classList.remove("dragging"));
  });
}

function projectDetail(id) {
  const p = projectById(id);
  if (!p) return `
  <div class="card empty">
    <h2>Project not found</h2>
    <p>It may have been removed.</p>
    <a class="btn" href="#projects">Back to projects</a>
  </div>`;
  const tasks = p.tasks.slice().sort((a, b) => (a.status === "Done") - (b.status === "Done") || byDue(a, b));
  const gallery = galleryItems().filter((g) => g.project === p.id);
  const statusClass = { Done: "done", "In progress": "progress" };
  const people = projectContacts(p);
  const addable = contacts.filter((c) => !p.contactIds.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name));

  return `
  <div class="detail-banner${p.banner ? " has-image" : ""}"${p.banner ? ` style="--banner:url('${esc(p.banner)}');--banner-y:${p.bannerY ?? 50}%"` : ""}>
    <div class="banner-top">
      <a href="${isPersonal(p) ? "#personal" : "#projects"}" class="back">← ${isPersonal(p) ? "Personal works" : "Projects"}</a>
      <button type="button" class="banner-btn" data-banner="${p.id}">${svg("image")}<span>${p.banner ? "Change banner" : "Add banner image"}</span></button>
    </div>
    <h1>${esc(p.name)}</h1>
  </div>
  <div class="detail-grid">
    <div class="detail-main">
      <section class="card">
        <div class="card-head"><h2>Tasks</h2><button type="button" class="btn ghost" data-taskadd="${p.id}">+ Add task</button></div>
        ${tasks.length ? `
        <div class="table-wrap"><table class="task-table">
          <thead><tr><th>Name</th><th>Due date</th><th>Task progress</th><th>Priority</th><th class="task-actions"><span class="sr-only">Delete</span></th></tr></thead>
          <tbody>
            ${tasks.map((t) => `
            <tr class="task-row" data-taskedit="${p.id}:${t.id}" title="Click to edit">
              <td><span class="task-name">${taskCheck(p, t)}${esc(t.name)}</span></td>
              <td>${fmtFull(t.due)}</td>
              <td><span class="pill ${statusClass[t.status] || ""}">${esc(t.status)}</span></td>
              <td><span class="prio ${t.priority.toLowerCase()}">${esc(t.priority)}</span></td>
              <td class="task-actions">${taskRemove(p, t)}</td>
            </tr>`).join("")}
          </tbody>
        </table></div>` : `<p class="group-empty">No tasks yet. Add the first one to start tracking this project.</p>`}
      </section>

      <section class="card">
        <div class="card-head"><h2>Contacts <span class="count">${people.length}</span></h2>
          <div class="pc-actions">
            ${addable.length ? `<select class="select" data-pcontact="${p.id}" aria-label="Add an existing contact"><option value="">Add a contact…</option>${addable.map((c) => `<option value="${c.id}">${esc(c.name)}${c.org ? ` · ${esc(c.org)}` : ""}</option>`).join("")}</select>` : ""}
            <button type="button" class="btn ghost" data-pcnew="${p.id}">+ New contact</button>
          </div>
        </div>
        ${people.length ? `
        <div class="pc-grid">
          ${people.map((c) => `
          <div class="pc-card">
            <a class="pc-main" href="#contacts/${c.id}">
              ${avatar(c)}
              <span><b>${esc(c.name)}</b><small>${esc([c.role, c.org].filter(Boolean).join(", ") || "No role or organization")}</small></span>
            </a>
            <div class="pc-links">
              ${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : ""}
              ${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ""}
            </div>
            <button type="button" class="pc-remove" data-pcremove="${p.id}:${c.id}" aria-label="Remove ${esc(c.name)} from this project" title="Remove from project">×</button>
          </div>`).join("")}
        </div>` : `<p class="group-empty">${contacts.length ? "No contacts on this project yet. Add one from your contacts or create a new one." : "No contacts yet. Create one to add it here."}</p>`}
      </section>

      <section class="card">
        <div class="card-head"><h2>To-do</h2></div>
        <div class="todo-board" data-project="${p.id}">${todoBoard(p.id)}</div>
      </section>

      <section>
        <div class="card-head detail-gallery-head"><h2>Progress gallery</h2><button class="btn ghost" data-gupload="${p.id}">Upload</button></div>
        ${gallery.length ? `
        <div class="detail-gallery">${gallery.map((g) => galleryFigure(g, { project: false })).join("")}</div>` : `<p class="group-empty">No images yet.</p>`}
      </section>
    </div>

    <aside class="card detail-side">
      <div class="side-head"><h2>Project description</h2><button type="button" class="btn ghost small" data-details="${p.id}">Edit details</button></div>
      <p class="description">${p.description ? esc(p.description) : '<span class="muted">No description yet.</span>'}</p>
      <dl class="facts">
        <div><dt>Start date</dt><dd>${fmtFull(p.created)}</dd></div>
        <div><dt>Project deadline</dt><dd>${fmtFull(p.due)}</dd></div>
        <div><dt>Milestones</dt><dd>${p.milestones.length ? p.milestones.slice().sort((a, b) => a.date.localeCompare(b.date)).map((m) => `<span class="ms-fact">${esc(m.title)} <span class="muted">${fmt(m.date)}</span></span>`).join("") : '<span class="muted">None</span>'}</dd></div>
        <div><dt></dt><dd><button type="button" class="btn ghost small" data-sched="${p.id}">Edit dates and milestones</button></dd></div>
        <div><dt>Client</dt><dd>${p.client ? esc(p.client) : "—"}</dd></div>
        <div><dt>Invoice file</dt><dd>${invoiceLink(p.invoice)}</dd></div>
        <div><dt>Amount</dt><dd>${money(p.amount)}</dd></div>
      </dl>
      <div class="detail-progress">
        <div class="detail-progress-head"><h2>Progress</h2><span>${p.progress}%</span></div>
        <div class="progress big"><span style="width:${p.progress}%;background:${p.color}"></span></div>
      </div>
    </aside>
  </div>`;
}

// Tasks: every task from Projects and Personal works in one place. Tasks are stored on their project.
let taskFilter = "all";
let showDoneTasks = false;

function allTasks() {
  return projects.flatMap((p) => p.tasks.map((t) => ({ ...t, project: p })));
}

function tasksView() {
  const tasks = allTasks().filter((t) => taskFilter === "all" || (taskFilter === "personal") === isPersonal(t.project));
  const open = tasks.filter((t) => t.status !== "Done");
  const overdue = open.filter((t) => t.due && daysUntil(t.due) < 0);
  const thisWeek = open.filter((t) => t.due && daysUntil(t.due) >= 0 && daysUntil(t.due) <= 7);
  const high = open.filter((t) => t.priority === "High");
  const done = tasks.length - open.length;
  const stats = [
    { label: "Open tasks", value: open.length, note: `${done} done` },
    { label: "Overdue", value: overdue.length, note: "past their due date", tone: overdue.length ? "danger" : "" },
    { label: "Due in 7 days", value: thisWeek.length, note: "including today", tone: thisWeek.length ? "warn" : "" },
    { label: "High priority", value: high.length, note: "open" },
  ];
  const rows = (showDoneTasks ? tasks : open).slice().sort((a, b) =>
    (a.status === "Done") - (b.status === "Done") || byDue(a, b));

  const perProject = projects
    .map((p) => ({ p, n: open.filter((t) => t.project === p).length }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...perProject.map((x) => x.n));
  const statusClass = { Done: "done", "In progress": "progress" };
  const filters = [["all", "All"], ["projects", "Projects"], ["personal", "Personal works"]];

  return `
  <div class="projects-toolbar">
    <div class="segmented" role="group" aria-label="Show tasks from">
      ${filters.map(([k, label]) => `<button type="button" data-tfilter="${k}" class="${taskFilter === k ? "on" : ""}" aria-pressed="${taskFilter === k}">${label}</button>`).join("")}
    </div>
    <div class="tl-actions">
      <label class="check-field inline"><input type="checkbox" data-tdone ${showDoneTasks ? "checked" : ""}><span>Show done</span></label>
      ${projects.length ? `<button type="button" class="btn" data-taskadd="">+ New task</button>` : ""}
    </div>
  </div>

  <div class="stats">
    ${stats.map((s) => `
      <div class="stat">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value${s.tone ? ` ${s.tone}` : ""}">${s.value}</div>
        <div class="stat-note">${s.note}</div>
      </div>`).join("")}
  </div>

  <div class="tasks-grid">
    <section class="card">
      <div class="card-head"><h2>${showDoneTasks ? "All tasks" : "Open tasks"}</h2><span class="link">${rows.length}</span></div>
      ${rows.length ? `
      <div class="table-wrap"><table class="task-table">
        <thead><tr><th>Name</th><th>Project</th><th>Due date</th><th>Task progress</th><th>Priority</th><th class="task-actions"><span class="sr-only">Delete</span></th></tr></thead>
        <tbody>
          ${rows.map((t) => `
          <tr class="task-row" data-taskedit="${t.project.id}:${t.id}" title="Click to edit">
            <td><span class="task-name">${taskCheck(t.project, t)}${esc(t.name)}</span></td>
            <td><a class="task-project" href="#project/${t.project.id}"><span class="dot" style="background:${t.project.color}"></span>${esc(t.project.name)}<span class="tag">${isPersonal(t.project) ? "Personal" : "Project"}</span></a></td>
            <td>${t.status === "Done" ? `<span class="due">${fmt(t.due)}</span>` : dueLabel(t.due)}</td>
            <td><span class="pill ${statusClass[t.status] || ""}">${esc(t.status)}</span></td>
            <td><span class="prio ${t.priority.toLowerCase()}">${esc(t.priority)}</span></td>
            <td class="task-actions">${taskRemove(t.project, t)}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>` : `<p class="group-empty">${projects.length ? "No tasks here." : "Add a project first, then its tasks."}</p>`}
    </section>

    <section class="card">
      <div class="card-head"><h2>Open tasks by project</h2></div>
      ${perProject.length ? `
      <ul class="bar-list">
        ${perProject.map(({ p, n }) => `
        <li title="${esc(p.name)}: ${n} open">
          <a href="#project/${p.id}">${esc(p.name)}</a>
          <div class="bar-track"><span style="width:${(n / max) * 100}%;background:${p.color}"></span></div>
          <b>${n}</b>
        </li>`).join("")}
      </ul>` : `<p class="group-empty">No open tasks.</p>`}
    </section>
  </div>`;
}

// ---------- Editing: tasks, dates and milestones, Quick add ----------
const taskStatuses = ["To do", "In progress", "On hold", "Done"];
const taskPriorities = ["High", "Medium", "Low"];
const CHECK = '<svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/></svg>';

function taskCheck(p, t) {
  const done = t.status === "Done";
  return `<button type="button" class="sq-box${done ? " checked" : ""}" data-taskcheck="${p.id}:${t.id}" aria-label="${done ? "Mark not done" : "Mark done"}">${done ? CHECK : ""}</button>`;
}

const TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';
const taskRemove = (p, t) => `<button type="button" class="task-remove" data-taskremove="${p.id}:${t.id}" aria-label="Delete task ${esc(t.name)}" title="Delete task">${TRASH}</button>`;

// Deletes right away; the toast offers Undo instead of asking first.
function removeTask(ref) {
  const { p, t } = findTask(ref);
  if (!t) return;
  const i = p.tasks.indexOf(t);
  p.tasks.splice(i, 1);
  saveProjects();
  refreshView();
  toast(`Deleted "${t.name}".`, 8000, { label: "Undo", fn: () => { p.tasks.splice(Math.min(i, p.tasks.length), 0, t); saveProjects(); refreshView(); } });
}

const findTask = (ref) => {
  const [pid, tid] = ref.split(":").map(Number);
  const p = projectById(pid);
  return { p, t: p && p.tasks.find((x) => x.id === tid) };
};

// Re-renders the current screen without jumping to the top.
function refreshView() {
  const sx = document.querySelector(".tl-scroll")?.scrollLeft;
  const y = window.scrollY;
  route(true);
  const tl = document.querySelector(".tl-scroll");
  if (tl && sx != null) tl.scrollLeft = sx;
  window.scrollTo(0, y);
}

function projectSelect(selected, { general = false } = {}) {
  const group = (title, list) => list.length ? `<optgroup label="${title}">${list.map((p) => `<option value="${p.id}"${String(p.id) === String(selected) ? " selected" : ""}>${esc(p.name)}${p.active ? "" : " (not active)"}</option>`).join("")}</optgroup>` : "";
  return (general ? `<option value="general"${selected === "general" ? " selected" : ""}>General (no project)</option>` : "")
    + group("Projects", projects.filter((p) => !isPersonal(p))) + group("Personal works", projects.filter(isPersonal));
}

// The project a new item should default to: the open project page, else the first active one.
function contextProject() {
  const m = location.hash.match(/^#project\/(\d+)$/);
  return (m && projectById(+m[1])) || activeProjects()[0] || projects[0] || null;
}

// Invoice: any PDF or image, stored in the library's files folder; samples have a name but no file.
function invoiceLink(inv) {
  if (!inv) return '<span class="muted">No file</span>';
  return inv.url
    ? `<a class="file" href="${esc(inv.url)}" target="_blank" rel="noopener" download="${esc(inv.name)}">${svg("folder")}${esc(inv.name)}</a>`
    : `<span class="file" title="Sample name only, no file attached">${svg("folder")}${esc(inv.name)}</span>`;
}

// Banner image at the top of a project page: upload, paste an image, or give a web address.
let bannerDraft = null;
function openBannerDialog(pid) {
  const p = projectById(+pid);
  if (!p) return;
  bannerDraft = { id: p.id, banner: p.banner || "", y: p.bannerY ?? 50 };
  document.getElementById("banner-url").value = "";
  document.getElementById("banner-error").hidden = true;
  paintBannerPreview();
  document.getElementById("banner-dialog").showModal();
}

function paintBannerPreview() {
  const prev = document.getElementById("banner-preview");
  prev.classList.toggle("has-image", !!bannerDraft.banner);
  prev.style.backgroundImage = bannerDraft.banner ? `url("${bannerDraft.banner}")` : "";
  prev.style.backgroundPosition = `center ${bannerDraft.y}%`;
  document.getElementById("banner-y").value = bannerDraft.y;
  document.getElementById("banner-y-field").hidden = !bannerDraft.banner;
  document.getElementById("banner-remove").hidden = !bannerDraft.banner;
}

function setupBannerDialog() {
  const dialog = document.getElementById("banner-dialog");
  const err = document.getElementById("banner-error");
  const save = dialog.querySelector("button[value=save]");
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  const useFile = async (file) => {
    err.hidden = true;
    try { bannerDraft.banner = await readImage(file, 2400, "image/jpeg"); } catch { return fail("That file couldn't be read as an image."); }
    bannerDraft.y = 50;
    paintBannerPreview();
  };
  document.getElementById("banner-file").addEventListener("change", (e) => { if (e.target.files[0]) useFile(e.target.files[0]); e.target.value = ""; });
  dialog.addEventListener("paste", (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (item) { e.preventDefault(); useFile(item.getAsFile()); }
  });
  document.getElementById("banner-fetch").addEventListener("click", async () => {
    const url = document.getElementById("banner-url").value.trim();
    if (!url) return fail("Paste an image address first.");
    err.hidden = true;
    save.disabled = true;
    const btn = document.getElementById("banner-fetch");
    btn.textContent = "Getting…";
    try {
      const r = await store.api("/api/files/fetch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      bannerDraft.banner = r.url;
      bannerDraft.y = 50;
      document.getElementById("banner-url").value = "";
      paintBannerPreview();
    } catch (e) { fail(e.message); }
    btn.textContent = "Use link";
    save.disabled = false;
  });
  document.getElementById("banner-url").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("banner-fetch").click(); } });
  document.getElementById("banner-y").addEventListener("input", (e) => { bannerDraft.y = +e.target.value; paintBannerPreview(); });
  document.getElementById("banner-remove").addEventListener("click", () => { bannerDraft.banner = ""; paintBannerPreview(); });
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "save") return;
    const p = projectById(bannerDraft.id);
    if (!p) return;
    p.banner = bannerDraft.banner;
    p.bannerY = bannerDraft.y;
    saveProjects();
    refreshView();
  });
}

let detailsDraft = null;
function openDetailsDialog(pid) {
  const p = projectById(+pid);
  if (!p) return;
  detailsDraft = { id: p.id, invoice: p.invoice ? { ...p.invoice } : null };
  document.getElementById("details-name").value = p.name;
  document.getElementById("details-client").value = isPersonal(p) ? "" : p.client || "";
  document.getElementById("details-client-field").hidden = isPersonal(p);
  document.getElementById("details-orgs").innerHTML = [...new Set(contacts.map((c) => c.org).filter(Boolean))].map((o) => `<option value="${esc(o)}">`).join("");
  document.getElementById("details-description").value = p.description || "";
  document.getElementById("details-amount").value = p.amount ?? "";
  document.getElementById("details-error").hidden = true;
  paintInvoiceField();
  document.getElementById("details-dialog").showModal();
}

function paintInvoiceField() {
  document.getElementById("details-invoice").innerHTML = invoiceLink(detailsDraft.invoice);
  document.getElementById("details-invoice-remove").hidden = !detailsDraft.invoice;
}

function setupDetailsDialog() {
  const dialog = document.getElementById("details-dialog");
  const err = document.getElementById("details-error");
  const save = dialog.querySelector("button[value=save]");
  document.getElementById("details-invoice-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    err.hidden = true;
    save.disabled = true;
    document.getElementById("details-invoice").textContent = `Uploading ${file.name}…`;
    try {
      const type = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
      const { url } = await store.api("/api/files", { method: "POST", headers: { "Content-Type": type }, body: file });
      detailsDraft.invoice = { name: file.name, url };
    } catch (e2) {
      err.textContent = e2.message;
      err.hidden = false;
    }
    save.disabled = false;
    paintInvoiceField();
  });
  document.getElementById("details-invoice-remove").addEventListener("click", () => { detailsDraft.invoice = null; paintInvoiceField(); });
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "save") return;
    const p = projectById(detailsDraft.id);
    if (!p) return;
    p.name = document.getElementById("details-name").value.trim() || p.name;
    if (!isPersonal(p)) p.client = document.getElementById("details-client").value.trim();
    p.description = document.getElementById("details-description").value.trim();
    const amount = document.getElementById("details-amount").value;
    p.amount = amount === "" ? null : Math.max(0, +amount);
    p.invoice = detailsDraft.invoice;
    saveProjects();
    renderNav(isPersonal(p) ? "personal" : "projects");
    refreshView();
  });
}

let editingTask = null; // { pid, tid } or null for a new task
function openTaskDialog(pid, tid = null) {
  if (!projects.length) { alert("Add a project first. Tasks belong to a project or personal work."); return; }
  const p = projectById(+pid) || contextProject();
  const t = tid != null ? p.tasks.find((x) => x.id === tid) : null;
  editingTask = t ? { pid: p.id, tid: t.id } : null;
  document.getElementById("task-dialog-title").textContent = t ? "Edit task" : "New task";
  document.getElementById("task-name").value = t ? t.name : "";
  document.getElementById("task-project").innerHTML = projectSelect(p.id);
  document.getElementById("task-due").value = t ? t.due || "" : "";
  document.getElementById("task-status").innerHTML = taskStatuses.map((s) => `<option${(t ? t.status : "To do") === s ? " selected" : ""}>${s}</option>`).join("");
  document.getElementById("task-priority").innerHTML = taskPriorities.map((s) => `<option${(t ? t.priority : "Medium") === s ? " selected" : ""}>${s}</option>`).join("");
  document.getElementById("task-delete").hidden = !t;
  document.getElementById("task-dialog").showModal();
}

function setupTaskDialog() {
  const dialog = document.getElementById("task-dialog");
  document.getElementById("task-delete").addEventListener("click", () => {
    const p = projectById(editingTask.pid);
    const t = p.tasks.find((x) => x.id === editingTask.tid);
    if (!confirm(`Delete the task "${t.name}"?`)) return;
    p.tasks.splice(p.tasks.indexOf(t), 1);
    saveProjects();
    dialog.close("deleted");
    refreshView();
  });
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "save") return;
    const name = document.getElementById("task-name").value.trim();
    if (!name) return;
    const fields = {
      name,
      due: document.getElementById("task-due").value || "",
      status: document.getElementById("task-status").value,
      priority: document.getElementById("task-priority").value,
    };
    const target = projectById(+document.getElementById("task-project").value);
    if (editingTask) {
      const from = projectById(editingTask.pid);
      const t = from.tasks.find((x) => x.id === editingTask.tid);
      Object.assign(t, fields);
      if (target !== from) {
        from.tasks.splice(from.tasks.indexOf(t), 1);
        t.id = nextId(target.tasks);
        target.tasks.push(t);
      }
    } else target.tasks.push({ id: nextId(target.tasks), ...fields });
    saveProjects();
    refreshView();
    if (!editingTask) toast(`Task added to ${target.name}.`, 3000);
  });
}

function toggleTask(ref) {
  const { t } = findTask(ref);
  if (!t) return;
  // Unchecking puts a task back to To do unless it had another status before it was done.
  if (t.status === "Done") t.status = t.before && t.before !== "Done" ? t.before : "To do";
  else { t.before = t.status; t.status = "Done"; }
  saveProjects();
  refreshView();
}

// Dates and milestones of one project, from the timeline, the project page or Quick add.
let schedProject = null;
function msRow(m = {}) {
  return `<div class="ms-edit" data-msid="${m.id || ""}">
    <input type="text" placeholder="Milestone" value="${esc(m.title || "")}" maxlength="80" aria-label="Milestone name">
    <input type="date" value="${m.date || ""}" aria-label="Milestone date">
    <button type="button" class="btn ghost icon" data-msremove aria-label="Remove milestone" title="Remove">×</button>
  </div>`;
}

function openScheduleDialog(pid, { addMilestone = false } = {}) {
  const p = projectById(+pid);
  if (!p) return;
  schedProject = p;
  document.getElementById("sched-project").innerHTML = projectSelect(p.id);
  document.getElementById("sched-start").value = p.created || "";
  document.getElementById("sched-due").value = p.due || "";
  document.getElementById("sched-progress").value = p.progress || 0;
  document.getElementById("sched-progress-out").textContent = `${p.progress || 0}%`;
  const list = document.getElementById("sched-ms");
  list.innerHTML = p.milestones.slice().sort((a, b) => (a.date || "").localeCompare(b.date || "")).map(msRow).join("");
  if (addMilestone || !p.milestones.length) list.insertAdjacentHTML("beforeend", msRow());
  document.getElementById("sched-error").hidden = true;
  const dialog = document.getElementById("sched-dialog");
  dialog.dataset.addms = addMilestone ? "1" : "";
  if (!dialog.open) dialog.showModal();
  if (addMilestone) list.lastElementChild.querySelector("input").focus();
}

function setupScheduleDialog() {
  const dialog = document.getElementById("sched-dialog");
  const list = document.getElementById("sched-ms");
  const err = document.getElementById("sched-error");
  document.getElementById("sched-project").addEventListener("change", (e) => openScheduleDialog(e.target.value, { addMilestone: !!dialog.dataset.addms }));
  document.getElementById("sched-progress").addEventListener("input", (e) => (document.getElementById("sched-progress-out").textContent = `${e.target.value}%`));
  document.getElementById("sched-addms").addEventListener("click", () => { list.insertAdjacentHTML("beforeend", msRow()); list.lastElementChild.querySelector("input").focus(); });
  list.addEventListener("click", (e) => { if (e.target.closest("[data-msremove]")) e.target.closest(".ms-edit").remove(); });
  document.getElementById("sched-form").addEventListener("submit", (e) => {
    if (e.submitter?.value !== "save") return;
    const start = document.getElementById("sched-start").value;
    const due = document.getElementById("sched-due").value;
    if (start && due && due < start) {
      e.preventDefault();
      err.textContent = "The due date is before the start date.";
      err.hidden = false;
    }
  });
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "save" || !schedProject) return;
    const p = schedProject;
    p.created = document.getElementById("sched-start").value || "";
    p.due = document.getElementById("sched-due").value || "";
    p.progress = +document.getElementById("sched-progress").value || 0;
    const kept = [];
    for (const row of list.querySelectorAll(".ms-edit")) {
      const [title, date] = [...row.querySelectorAll("input")].map((i) => i.value.trim());
      if (!title && !date) continue;
      const old = p.milestones.find((m) => String(m.id) === row.dataset.msid);
      kept.push({ id: old ? old.id : 0, title: title || "Milestone", date });
    }
    for (const m of kept) if (!m.id) m.id = nextId([...p.milestones, ...kept]);
    p.milestones = kept;
    saveProjects();
    refreshView();
  });
}

// Quick add: a to-do card without opening the board.
function openQuickTodo() {
  const p = contextProject();
  document.getElementById("qtodo-text").value = "";
  document.getElementById("qtodo-project").innerHTML = projectSelect(p ? p.id : "general", { general: true });
  document.getElementById("qtodo-column").innerHTML = todoColumns.map((c) => `<option>${c}</option>`).join("");
  document.getElementById("qtodo-dialog").showModal();
}

function setupQuickTodo() {
  const dialog = document.getElementById("qtodo-dialog");
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "save") return;
    const text = document.getElementById("qtodo-text").value.trim();
    if (!text) return;
    const raw = document.getElementById("qtodo-project").value;
    const pid = raw === "general" ? "general" : +raw;
    const list = loadTodos(pid);
    list.push({ id: Date.now(), text, column: document.getElementById("qtodo-column").value });
    saveTodos(pid, list);
    refreshView();
    toast(`To-do added to ${pid === "general" ? "General" : projectById(pid).name}.`, 3000);
  });
}

const quickActions = [
  ["task", "Task", "list"],
  ["todo", "To-do card", "check"],
  ["milestone", "Milestone", "timeline"],
  ["project", "Project", "folder"],
  ["personal", "Personal work", "brush"],
  ["contact", "Contact", "user"],
  ["upload", "Images", "image"],
];

function setupQuickAdd() {
  const btn = document.getElementById("quick-add");
  const menu = document.getElementById("quick-menu");
  menu.innerHTML = quickActions.map(([k, label, icon]) => `<button type="button" role="menuitem" data-quick="${k}">${svg(icon)}<span>${label}</span></button>`).join("");
  const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    btn.setAttribute("aria-expanded", String(!menu.hidden));
    if (!menu.hidden) menu.querySelector("button").focus();
  });
  document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { close(); btn.focus(); } });
  menu.addEventListener("click", (e) => {
    const k = e.target.closest("[data-quick]")?.dataset.quick;
    if (!k) return;
    close();
    const p = contextProject();
    const needsProject = ["task", "milestone", "upload"].includes(k);
    if (needsProject && !p) { alert("Add a project first."); return openProjectDialog("projects"); }
    if (k === "task") openTaskDialog(p.id);
    else if (k === "todo") openQuickTodo();
    else if (k === "milestone") openScheduleDialog(p.id, { addMilestone: true });
    else if (k === "project" || k === "personal") openProjectDialog(k === "personal" ? "personal" : "projects");
    else if (k === "contact") { linkNewContactTo = location.hash.startsWith("#project/") ? p?.id : null; openContactDialog(null); }
    else if (k === "upload") openUploadDialog(p.id);
  });
}

// Clicks shared by every screen: task checkboxes and rows, add-task buttons, date editing.
function onEditClick(e) {
  const rm = e.target.closest("[data-taskremove]");
  if (rm) { removeTask(rm.dataset.taskremove); return true; }
  const check = e.target.closest("[data-taskcheck]");
  if (check) { toggleTask(check.dataset.taskcheck); return true; }
  const add = e.target.closest("[data-taskadd]");
  if (add) { openTaskDialog(add.dataset.taskadd || contextProject()?.id); return true; }
  const pcr = e.target.closest("[data-pcremove]");
  if (pcr) {
    const [pid, cid] = pcr.dataset.pcremove.split(":").map(Number);
    const p = projectById(pid);
    const c = contacts.find((x) => x.id === cid);
    p.contactIds = p.contactIds.filter((id) => id !== cid);
    saveProjects();
    refreshView();
    if (c) toast(`Removed ${c.name} from ${p.name}. The contact card is kept.`, 8000, { label: "Undo", fn: () => { linkContact(p, c); refreshView(); } });
    return true;
  }
  const pcn = e.target.closest("[data-pcnew]");
  if (pcn) { linkNewContactTo = +pcn.dataset.pcnew; openContactDialog(null); return true; }
  const ban = e.target.closest("[data-banner]");
  if (ban) { openBannerDialog(ban.dataset.banner); return true; }
  const det = e.target.closest("[data-details]");
  if (det) { openDetailsDialog(det.dataset.details); return true; }
  const sched = e.target.closest("[data-sched]");
  if (sched) { openScheduleDialog(sched.dataset.sched); return true; }
  if (e.target.closest("[data-msadd]")) {
    const p = contextProject();
    if (p) openScheduleDialog(p.id, { addMilestone: true });
    return true;
  }
  const row = !e.target.closest("a, button") && e.target.closest("[data-taskedit]");
  if (row) { const { p, t } = findTask(row.dataset.taskedit); if (t) openTaskDialog(p.id, t.id); return true; }
  return false;
}

function onTasksClick(e) {
  const f = e.target.closest("[data-tfilter]");
  if (f) {
    taskFilter = f.dataset.tfilter;
    document.getElementById("view").innerHTML = tasksView();
  }
}

// Timeline: each project as a bar from its start to its due date, grouped into Projects and Personal works.
let timelineFilter = "all";
let timelineShowInactive = false;
const TL_DAY = 5; // pixels per day
let calMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let calSelected = new Date(today);
let calMode = "month";
const spanDays = (a, b) => Math.round((parse(b) - parse(a)) / DAY) + 1;
const dkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
const CAL_LANES = 4; // project bars shown per week before "more"
const CAL_ITEMS = 2; // one-day items shown per day before "more"

// One-day items (starts, due dates, task due dates, milestones), grouped by day.
function calItems(list, start) {
  const byDay = {};
  const add = (date, item) => date && (byDay[date] ||= []).push(item);
  for (const p of list) {
    const base = { color: p.color, href: `#project/${p.id}`, project: p.name };
    if (start(p)) add(start(p), { ...base, title: `${p.name} starts`, kind: "start" });
    if (p.due) add(p.due, { ...base, title: `${p.name} due`, kind: "due" });
    for (const t of p.tasks) add(t.due, { ...base, title: t.name, kind: "task", done: t.status === "Done" });
    for (const m of p.milestones) add(m.date, { ...base, title: m.title, kind: "milestone" });
  }
  return byDay;
}

function miniMonth(month, items, { selectable = true } = {}) {
  const start = mondayOf(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const dows = ["M", "T", "W", "T", "F", "S", "S"];
  return `
  <div class="mini-grid">
    ${dows.map((d) => `<span class="mini-dow">${d}</span>`).join("")}
    ${days.map((d) => {
      const its = items[dkey(d)] || [];
      const cls = [d.getMonth() !== month.getMonth() && "out", d.getTime() === today.getTime() && "today", selectable && d.getTime() === calSelected.getTime() && "sel"].filter(Boolean).join(" ");
      return `<button type="button" class="mini-day ${cls}" data-calday="${dkey(d)}" title="${its.map((x) => esc(x.title)).join(", ")}">
        <span>${d.getDate()}</span>
        <i>${its.slice(0, 3).map((x) => `<b style="background:${x.color}"></b>`).join("")}</i>
      </button>`;
    }).join("")}
  </div>`;
}

function calSidebar(spans, items) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(calSelected, i));
  return `
  <aside class="cal-side">
    <div class="cal-side-head">
      <h3>${calMonth.toLocaleDateString(undefined, { month: "long" })} <span>${calMonth.getFullYear()}</span></h3>
      <div><button type="button" class="icon-btn" data-calnav="-1" aria-label="Previous">‹</button><button type="button" class="icon-btn" data-calnav="1" aria-label="Next">›</button></div>
    </div>
    ${miniMonth(calMonth, items)}
    <div class="agenda">
      ${days.map((d) => {
        const running = spans.filter((x) => x.s <= d && x.e >= d);
        const its = items[dkey(d)] || [];
        return `
        <section>
          <h4>${d.toLocaleDateString(undefined, { weekday: "long" })} <span>${d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}</span></h4>
          ${running.length ? `<div class="agenda-chips">${running.map((x) => `<a href="#project/${x.p.id}" style="--c:${x.p.color}">${esc(x.p.name)}</a>`).join("")}</div>` : ""}
          ${its.map((x) => `<a class="agenda-item${x.done ? " done" : ""}" href="${x.href}"><b style="background:${x.color}"></b><span>${esc(x.title)}${x.kind === "task" || x.kind === "milestone" ? `<small>${esc(x.project)}</small>` : ""}</span></a>`).join("")}
          ${!running.length && !its.length ? `<p class="muted">Nothing scheduled</p>` : ""}
        </section>`;
      }).join("")}
    </div>
  </aside>`;
}

function calMonthGrid(spans, items) {
  const start = mondayOf(calMonth);
  const dows = Array.from({ length: 7 }, (_, i) => addDays(start, i).toLocaleDateString(undefined, { weekday: "short" }));
  const weeks = Array.from({ length: 6 }, (_, w) => addDays(start, w * 7));
  return `
  <div class="cal-dows">${dows.map((d, i) => `<span class="${i > 4 ? "wknd" : ""}">${d}</span>`).join("")}</div>
  ${weeks.map((ws) => {
    const we = addDays(ws, 6);
    const segsAll = spans.filter((x) => x.s <= we && x.e >= ws);
    const segs = segsAll.slice(0, CAL_LANES).map((x, lane) => {
      const a = x.s < ws ? ws : x.s;
      const b = x.e > we ? we : x.e;
      return { ...x, lane, col: Math.round((a - ws) / DAY) + 1, span: Math.round((b - a) / DAY) + 1, openL: x.s < ws, openR: x.e > we };
    });
    const hiddenSpans = segsAll.slice(CAL_LANES);
    return `
    <div class="cal-week" style="--lanes:${segs.length}">
      ${Array.from({ length: 7 }, (_, i) => {
        const d = addDays(ws, i);
        const its = items[dkey(d)] || [];
        // A project bar that didn't fit is counted once, on the first day it shows in this week.
        const extra = Math.max(0, its.length - CAL_ITEMS) + hiddenSpans.filter((x) => (x.s < ws ? ws : x.s).getTime() === d.getTime()).length;
        const cls = [d.getMonth() !== calMonth.getMonth() && "out", i > 4 && "wknd", d.getTime() === today.getTime() && "today", d.getTime() === calSelected.getTime() && "sel"].filter(Boolean).join(" ");
        return `
        <div class="cal-day ${cls}" style="grid-column:${i + 1}" data-calday="${dkey(d)}">
          <span class="cal-num">${d.getDate() === 1 ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : d.getDate()}</span>
          <div class="cal-items">
            ${its.slice(0, CAL_ITEMS).map((x) => `<a class="cal-item${x.done ? " done" : ""}" href="${x.href}" title="${esc(x.title)} (${esc(x.project)})"><b style="background:${x.color}"></b>${esc(x.title)}</a>`).join("")}
            ${extra ? `<span class="cal-more">${extra} more…</span>` : ""}
          </div>
        </div>`;
      }).join("")}
      ${segs.map((g) => `
      <a class="cal-seg${g.openL ? " open-l" : ""}${g.openR ? " open-r" : ""}${g.p.active ? "" : " inactive"}" href="#project/${g.p.id}"
        style="grid-column:${g.col} / span ${g.span};grid-row:${g.lane + 2};--c:${g.p.color}"
        title="${esc(g.p.name)}: ${fmt(dkey(g.s))} to ${fmt(dkey(g.e))}, ${spanDays(dkey(g.s), dkey(g.e))} days">${esc(g.p.name)}</a>`).join("")}
    </div>`;
  }).join("")}`;
}

function calYearGrid(items) {
  const y = calMonth.getFullYear();
  return `
  <div class="cal-year">
    ${Array.from({ length: 12 }, (_, m) => {
      const month = new Date(y, m, 1);
      return `
      <div class="year-month">
        <button type="button" class="year-title${m === today.getMonth() && y === today.getFullYear() ? " now" : ""}" data-calmonth="${m}">${month.toLocaleDateString(undefined, { month: "long" })}</button>
        ${miniMonth(month, items, { selectable: false })}
      </div>`;
    }).join("")}
  </div>`;
}

// Calendar under the timeline, laid out like a desktop calendar app: mini month + agenda on the left, Month or Year on the right.
function calendarView(list, start) {
  const spans = list.filter((p) => start(p) && p.due).map((p) => ({ p, s: parse(start(p)), e: parse(p.due) }));
  const items = calItems(list, start);
  const title = calMode === "year"
    ? `${calMonth.getFullYear()}`
    : calMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return `
  <div class="card cal">
    ${calSidebar(spans, items)}
    <div class="cal-main">
      <div class="cal-head">
        <div class="cal-nav">
          <button type="button" class="btn ghost" data-calnav="-1" aria-label="Previous">‹</button>
          <button type="button" class="btn ghost" data-calnav="0">Today</button>
          <button type="button" class="btn ghost" data-calnav="1" aria-label="Next">›</button>
        </div>
        <h2>${title}</h2>
        <div class="segmented" role="group" aria-label="Calendar view">
          ${[["month", "Month"], ["year", "Year"]].map(([k, l]) => `<button type="button" data-calmode="${k}" class="${calMode === k ? "on" : ""}" aria-pressed="${calMode === k}">${l}</button>`).join("")}
        </div>
      </div>
      ${calMode === "year" ? calYearGrid(items) : calMonthGrid(spans, items)}
    </div>
  </div>`;
}

function timelineView() {
  const iso = (d) => d.toISOString().slice(0, 10);
  const start = (p) => p.created;
  const shown = projects.filter((p) =>
    (timelineFilter === "all" || (timelineFilter === "personal") === isPersonal(p)) && (timelineShowInactive || p.active));
  const dated = shown.filter((p) => start(p) && p.due);

  // Range: whole months around every bar, always including today.
  const times = [today, ...dated.flatMap((p) => [parse(start(p)), parse(p.due)])];
  const from = new Date(Math.min(...times)); from.setDate(1); from.setMonth(from.getMonth() - 1);
  const to = new Date(Math.max(...times)); to.setMonth(to.getMonth() + 2, 1);
  const x = (d) => Math.round((d - from) / DAY) * TL_DAY;
  const width = x(to);
  const months = [];
  for (let m = new Date(from); m < to; m.setMonth(m.getMonth() + 1)) {
    const next = new Date(m); next.setMonth(next.getMonth() + 1);
    months.push({ label: m.toLocaleDateString(undefined, { month: "short", year: m.getMonth() === 0 || !months.length ? "numeric" : undefined }), left: x(m), w: x(next) - x(m) });
  }

  const row = (p) => {
    const s0 = start(p);
    const ms = p.milestones.filter((m) => m.date);
    let bar = `<button type="button" class="tl-missing" data-sched="${p.id}">${!p.due && !s0 ? "Set dates" : !p.due ? "Set a due date" : "Set a start date"}</button>`;
    if (s0 && p.due) {
      const left = x(parse(s0));
      const w = Math.max(x(parse(p.due)) - left + TL_DAY, 12);
      const late = p.active && daysUntil(p.due) < 0;
      bar = `<button type="button" class="tl-bar${p.active ? "" : " inactive"}${late ? " late" : ""}" data-sched="${p.id}" style="left:${left}px;width:${w}px;--c:${p.color}"
          title="${esc(p.name)}: ${fmt(s0)} to ${fmt(p.due)}, ${spanDays(s0, p.due)} days (${p.progress}% done). Drag to move, drag an end to change that date, click to edit.">
          <span class="tl-fill" style="width:${p.progress}%"></span>
          <span class="tl-label">${esc(p.name)}</span>
          <span class="tl-handle start" data-handle="start"></span><span class="tl-handle end" data-handle="end"></span>
        </button>`;
    }
    return `
    <div class="tl-row" data-pid="${p.id}">
      <a class="tl-name" href="#project/${p.id}"><span class="dot" style="background:${p.color}"></span><span>${esc(p.name)}</span></a>
      <div class="tl-track" style="width:${width}px">
        ${bar}
        ${ms.map((m) => `<button type="button" class="tl-milestone" data-sched="${p.id}" data-msid="${m.id}" style="left:${x(parse(m.date))}px;--c:${p.color}" title="${esc(m.title)}: ${fmt(m.date)}. Drag to move, click to edit." aria-label="${esc(m.title)}"></button>`).join("")}
      </div>
    </div>`;
  };

  const groups = [
    { title: "Projects", list: shown.filter((p) => !isPersonal(p)) },
    { title: "Personal works", list: shown.filter(isPersonal) },
  ].filter((g) => g.list.length && (timelineFilter === "all" || (timelineFilter === "personal") === (g.title === "Personal works")));
  const filters = [["all", "All"], ["projects", "Projects"], ["personal", "Personal works"]];

  return `
  <div class="projects-toolbar">
    <div class="segmented" role="group" aria-label="Show">
      ${filters.map(([k, label]) => `<button type="button" data-tlfilter="${k}" class="${timelineFilter === k ? "on" : ""}" aria-pressed="${timelineFilter === k}">${label}</button>`).join("")}
    </div>
    <div class="tl-actions">
      <label class="check-field inline"><input type="checkbox" data-tlinactive ${timelineShowInactive ? "checked" : ""}><span>Show not active</span></label>
      <button type="button" class="btn ghost" data-tltoday>Today</button>
      ${projects.length ? `<button type="button" class="btn" data-msadd>+ Milestone</button>` : ""}
    </div>
  </div>
  <div class="card tl">
    <div class="tl-scroll">
      <div class="tl-head">
        <div class="tl-name tl-corner">Project</div>
        <div class="tl-months" style="width:${width}px">
          ${months.map((m) => `<span style="left:${m.left}px;width:${m.w}px">${m.label}</span>`).join("")}
        </div>
      </div>
      <div class="tl-body">
        <div class="tl-grid" style="width:${width}px">
          ${months.map((m) => `<span style="left:${m.left}px"></span>`).join("")}
          <span class="tl-today" style="left:${x(today)}px"><b>Today</b></span>
        </div>
        ${groups.map((g) => `
        <div class="tl-group"><span class="tl-name">${g.title}</span></div>
        ${g.list.map(row).join("")}`).join("") || `<p class="group-empty tl-empty">Nothing to show.</p>`}
      </div>
    </div>
    <div class="tl-legend"><span><i class="tl-key-bar"></i>Start to due date, darker part is progress. Drag a bar, its ends or a milestone to change dates; click to edit.</span><span><i class="tl-key-ms"></i>Milestone</span><span><i class="tl-key-today"></i>Today</span></div>
  </div>
  ${calendarView(shown, start)}`;
}

function scrollTimelineToToday(smooth = false) {
  const el = document.querySelector(".tl-scroll");
  const line = document.querySelector(".tl-today");
  if (!el || !line) return;
  // Put today about a third of the way into the visible track.
  const nameW = el.querySelector(".tl-corner").offsetWidth;
  el.scrollTo({ left: Math.max(0, line.offsetLeft - (el.clientWidth - nameW) * 0.35), behavior: smooth ? "smooth" : "auto" });
}

function onTimelineClick(e) {
  const f = e.target.closest("[data-tlfilter]");
  if (f) {
    timelineFilter = f.dataset.tlfilter;
    document.getElementById("view").innerHTML = timelineView();
    scrollTimelineToToday();
  }
  if (e.target.closest("[data-tltoday]")) scrollTimelineToToday(true);
  const nav = e.target.closest("[data-calnav]");
  const day = !nav && e.target.closest("[data-calday]");
  const mode = e.target.closest("[data-calmode]");
  const month = e.target.closest("[data-calmonth]");
  if (e.target.closest("a")) return;
  if (nav) {
    const step = +nav.dataset.calnav;
    const inSide = !!nav.closest(".cal-side");
    if (!step) { calMonth = new Date(today.getFullYear(), today.getMonth(), 1); calSelected = new Date(today); }
    else if (calMode === "year" && !inSide) calMonth = new Date(calMonth.getFullYear() + step, calMonth.getMonth(), 1);
    else calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + step, 1);
  } else if (day) {
    calSelected = parse(day.dataset.calday);
    if (day.closest(".cal-year")) calMode = "month";
    if ((calMode === "month" || day.closest(".cal-side")) && calSelected.getMonth() !== calMonth.getMonth()) calMonth = new Date(calSelected.getFullYear(), calSelected.getMonth(), 1);
  } else if (mode) calMode = mode.dataset.calmode;
  else if (month) {
    calMonth = new Date(calMonth.getFullYear(), +month.dataset.calmonth, 1);
    calMode = "month";
  } else return;
  const sx = document.querySelector(".tl-scroll")?.scrollLeft;
  const sy = window.scrollY;
  document.getElementById("view").innerHTML = timelineView();
  document.querySelector(".tl-scroll").scrollLeft = sx;
  window.scrollTo(0, sy);
}

// Search (sidebar, or press /): projects, tasks, milestones, to-do cards, contacts and gallery files.
let searchHits = [];
let searchSel = 0;

// Goes to a screen, then runs the follow-up once that screen is showing.
function goThen(hash, fn) {
  if (location.hash === hash) { fn && fn(); return; }
  if (fn) window.addEventListener("hashchange", () => setTimeout(fn), { once: true });
  location.hash = hash;
}

function searchIndex() {
  const out = [];
  for (const p of projects) {
    const kind = isPersonal(p) ? "Personal work" : "Project";
    out.push({ group: "Projects", title: p.name, meta: [kind, p.client && !isPersonal(p) ? p.client : ""].filter(Boolean).join(" · "), text: `${p.name} ${p.client || ""} ${p.description || ""}`, color: p.color, go: () => goThen(`#project/${p.id}`) });
    for (const t of p.tasks) out.push({ group: "Tasks", title: t.name, meta: `${p.name}${t.status === "Done" ? " · Done" : t.due ? ` · due ${fmt(t.due)}` : ""}`, text: t.name, color: p.color, go: () => goThen(`#project/${p.id}`, () => openTaskDialog(p.id, t.id)) });
    for (const m of p.milestones) out.push({ group: "Milestones", title: m.title, meta: `${p.name}${m.date ? ` · ${fmt(m.date)}` : ""}`, text: m.title, color: p.color, go: () => goThen("#timeline", () => openScheduleDialog(p.id)) });
  }
  for (const pid of [...projects.map((p) => p.id), "general"]) {
    const p = pid === "general" ? null : projectById(pid);
    for (const c of loadTodos(pid)) out.push({ group: "To-do cards", title: c.text, meta: `${p ? p.name : "General"} · ${c.column}`, text: c.text, color: p ? p.color : "var(--muted)", go: () => goThen(p ? `#project/${p.id}` : "#todo") });
  }
  for (const c of contacts) out.push({ group: "Contacts", title: c.name, meta: [c.role, c.org].filter(Boolean).join(", "), text: `${c.name} ${c.org || ""} ${c.role || ""} ${c.email || ""} ${c.phone || ""}`, color: c.color, go: () => goThen(`#contacts/${c.id}`) });
  for (const g of gallery) {
    const p = projectById(g.project);
    if (!p) continue;
    out.push({ group: "Gallery", title: g.title, meta: `${p.name} · ${g.kind}`, text: `${g.title} ${g.kind}`, color: p.color, go: () => goThen("#gallery", () => { lightboxList = [g.id]; lightboxIndex = 0; openLightbox(); }) });
  }
  return out;
}

function paintSearch() {
  const q = document.getElementById("search-input").value.trim().toLowerCase();
  const box = document.getElementById("search-results");
  if (!q) { searchHits = []; box.innerHTML = '<p class="search-hint">Type to search projects, tasks, milestones, to-do cards, contacts and gallery files.</p>'; return; }
  const words = q.split(/\s+/);
  const all = searchIndex().filter((h) => words.every((w) => h.text.toLowerCase().includes(w) || h.meta.toLowerCase().includes(w)));
  // Up to 6 per group, groups in a fixed order.
  const groups = ["Projects", "Contacts", "Tasks", "Milestones", "To-do cards", "Gallery"];
  searchHits = groups.flatMap((g) => all.filter((h) => h.group === g).slice(0, 6));
  searchSel = Math.min(searchSel, Math.max(0, searchHits.length - 1));
  let i = 0;
  box.innerHTML = searchHits.length ? groups.map((g) => {
    const hits = searchHits.filter((h) => h.group === g);
    if (!hits.length) return "";
    return `<div class="search-group"><h3>${g}</h3>${hits.map((h) => {
      const n = i++;
      return `<button type="button" class="search-hit${n === searchSel ? " sel" : ""}" data-hit="${n}"><span class="dot" style="background:${h.color}"></span><span><b>${esc(h.title)}</b><small>${esc(h.meta)}</small></span></button>`;
    }).join("")}</div>`;
  }).join("") : `<p class="search-hint">Nothing matches "${esc(q)}".</p>`;
  box.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
}

function openSearch() {
  const dialog = document.getElementById("search-dialog");
  document.getElementById("search-input").value = "";
  searchSel = 0;
  paintSearch();
  if (!dialog.open) dialog.showModal();
  document.getElementById("search-input").focus();
}

function setupSearch() {
  const dialog = document.getElementById("search-dialog");
  const input = document.getElementById("search-input");
  const pick = (n) => { const h = searchHits[n]; if (!h) return; dialog.close(); h.go(); };
  document.querySelector(".sidebar .search").addEventListener("click", () => { document.getElementById("sidebar").classList.remove("open"); openSearch(); });
  input.addEventListener("input", () => { searchSel = 0; paintSearch(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!searchHits.length) return;
      searchSel = (searchSel + (e.key === "ArrowDown" ? 1 : -1) + searchHits.length) % searchHits.length;
      paintSearch();
    } else if (e.key === "Enter") { e.preventDefault(); pick(searchSel); }
  });
  document.getElementById("search-results").addEventListener("click", (e) => { const b = e.target.closest("[data-hit]"); if (b) pick(+b.dataset.hit); });
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest("input, textarea, select, [contenteditable]") || document.querySelector("dialog[open]")) return;
    e.preventDefault();
    openSearch();
  });
}

// Dragging on the timeline: move a bar (both dates), drag its ends (start or due), or move a milestone. Snaps to days.
function setupTimelineDrag(view) {
  let drag = null;
  let suppressClick = false;
  const tip = document.createElement("div");
  tip.className = "tl-drag-tip";
  tip.hidden = true;
  document.body.append(tip);
  const iso = (d) => dkey(d);

  view.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    const el = e.target.closest(".tl-bar, .tl-milestone");
    if (!el || !el.closest(".tl-track")) return;
    const p = projectById(+el.dataset.sched);
    if (!p) return;
    const ms = el.dataset.msid ? p.milestones.find((m) => String(m.id) === el.dataset.msid) : null;
    const mode = ms ? "ms" : e.target.dataset.handle || "move";
    drag = { el, p, ms, mode, x0: e.clientX, left: el.offsetLeft, width: el.offsetWidth, days: 0, moved: false, id: e.pointerId };
  });
  view.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    if (!drag.moved && Math.abs(dx) < 4) return;
    if (!drag.moved) { drag.moved = true; drag.el.setPointerCapture(e.pointerId); drag.el.classList.add("dragging"); }
    const { p, mode } = drag;
    let days = Math.round(dx / TL_DAY);
    // Keep at least one day between start and due.
    const span = spanDays(p.created || p.due || iso(today), p.due || p.created || iso(today)) - 1;
    if (mode === "start") days = Math.min(days, span);
    if (mode === "end") days = Math.max(days, -span);
    drag.days = days;
    const px = days * TL_DAY;
    if (mode === "move" || mode === "ms") drag.el.style.left = `${drag.left + px}px`;
    else if (mode === "start") { drag.el.style.left = `${drag.left + px}px`; drag.el.style.width = `${drag.width - px}px`; }
    else drag.el.style.width = `${drag.width + px}px`;
    const shift = (s, n) => iso(addDays(parse(s), n));
    const text = mode === "ms" ? `${drag.ms.title}: ${fmt(shift(drag.ms.date, days))}`
      : mode === "start" ? `Start ${fmt(shift(p.created, days))}`
      : mode === "end" ? `Due ${fmt(shift(p.due, days))}`
      : `${fmt(shift(p.created, days))} – ${fmt(shift(p.due, days))}`;
    tip.textContent = text;
    tip.style.left = `${e.clientX}px`;
    tip.style.top = `${drag.el.getBoundingClientRect().top - 8}px`;
    tip.hidden = false;
  });
  const end = (e, cancel) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { p, ms, mode, days, moved } = drag;
    drag = null;
    tip.hidden = true;
    if (!moved) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    if (!cancel && days) {
      const shift = (s, n) => iso(addDays(parse(s), n));
      if (mode === "ms") ms.date = shift(ms.date, days);
      if (mode === "move" || mode === "start") p.created = shift(p.created, days);
      if (mode === "move" || mode === "end") p.due = shift(p.due, days);
      saveProjects();
    }
    refreshView();
  };
  view.addEventListener("pointerup", (e) => end(e, false));
  view.addEventListener("pointercancel", (e) => end(e, true));
  // The click that ends a drag shouldn't also open the dates form.
  view.addEventListener("click", (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
}

// Contacts: client and vendor cards.
// Contacts are linked to projects one by one (project.contactIds), from either side.
const CONTACTS_KEY = "ost.contacts";
const contactDefaults = contacts.map((c) => ({ ...c }));
let contactQuery = "";
let contactGroup = "name";
let contactSelected = null;
let editingContact = null;
let linkNewContactTo = null; // project id when "+ New contact" was used on a project page

function avatar(c, cls = "") {
  return c.photo
    ? `<span class="avatar ${cls} photo" style="background-image:url(${c.photo})"></span>`
    : `<span class="avatar ${cls}" style="background:${c.color}">${esc(initials(c.name) || "?")}</span>`;
}

function loadContacts() {
  let list = null;
  list = store.get(CONTACTS_KEY);
  contacts.splice(0, contacts.length, ...(Array.isArray(list) ? list : contactDefaults.map((c) => ({ ...c }))));
}

function saveContacts() {
  store.set(CONTACTS_KEY, contacts);
  return true;
}

const contactProjects = (c) => projects.filter((p) => p.contactIds.includes(c.id)).sort(byDue);
const projectContacts = (p) => p.contactIds.map((id) => contacts.find((c) => c.id === id)).filter(Boolean);

// Older libraries linked by organization name; turn that into explicit links once.
function migrateContactLinks() {
  let moved = false;
  for (const p of projects) {
    if (Array.isArray(p.contactIds)) continue;
    p.contactIds = !isPersonal(p) && p.client ? contacts.filter((c) => c.org && c.org === p.client).map((c) => c.id) : [];
    moved = true;
  }
  if (moved && store.has(PROJECTS_KEY)) saveProjects();
}

function linkContact(p, c) {
  if (!p.contactIds.includes(c.id)) p.contactIds.push(c.id);
  if (!isPersonal(p) && !p.client && c.org) p.client = c.org;
  saveProjects();
}
const byName = (a, b) => a.name.replace(/^Dr\.\s*/, "").localeCompare(b.name.replace(/^Dr\.\s*/, ""));

function visibleContacts() {
  const q = contactQuery.trim().toLowerCase();
  return contacts
    .filter((c) => !q || [c.name, c.org, c.role, c.phone, c.email].some((f) => (f || "").toLowerCase().includes(q)))
    .sort(byName);
}

function contactList() {
  const list = visibleContacts();
  if (!list.length) return `<p class="group-empty">${contacts.length ? "No contacts match your search." : "No contacts yet."}</p>`;
  const groups = new Map();
  for (const c of list) {
    const key = contactGroup === "org" ? c.org || "No organization" : (c.name.replace(/^Dr\.\s*/, "")[0] || "#").toUpperCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === "No organization") - (b === "No organization") || a.localeCompare(b));
  return keys.map((k) => `
    <h3 class="contact-group">${esc(k)}</h3>
    <ul class="contact-rows">
      ${groups.get(k).map((c) => `
      <li><a href="#contacts/${c.id}" class="contact-row${c.id === contactSelected ? " selected" : ""}">
        ${avatar(c)}
        <span><b>${esc(c.name)}</b><small>${esc(contactGroup === "org" ? c.phone || c.role || "" : c.phone || c.org || "")}</small></span>
      </a></li>`).join("")}
    </ul>`).join("");
}

function contactDetail(c) {
  if (!c) return `<div class="contact-none"><span class="view-icon big">${svg("user")}</span><p>${contacts.length ? "Pick a contact to see their details." : "Add your first contact."}</p></div>`;
  const linked = contactProjects(c);
  const linkable = projects.filter((p) => !linked.includes(p));
  const action = (href, label, icon) => href
    ? `<a class="contact-action" href="${href}">${icon}<span>${label}</span></a>`
    : `<span class="contact-action disabled">${icon}<span>${label}</span></span>`;
  const phone = (c.phone || "").replace(/[^\d+]/g, "");
  return `
  <a href="#contacts" class="back contact-back">← All contacts</a>
  <div class="contact-hero">
    ${avatar(c, "huge")}
    <h2>${esc(c.name)}</h2>
    <p>${esc([c.role, c.org].filter(Boolean).join(" · ")) || '<span class="muted">No role or organization</span>'}</p>
    <div class="contact-actions">
      ${action(phone && `tel:${phone}`, "Call", '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>')}
      ${action(phone && `sms:${phone}`, "Message", '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>')}
      ${action(c.email && `mailto:${esc(c.email)}`, "Email", '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>')}
    </div>
  </div>
  <dl class="contact-fields">
    <div><dt>Phone</dt><dd>${c.phone ? `<a href="tel:${phone}">${esc(c.phone)}</a>` : '<span class="muted">—</span>'}</dd></div>
    <div><dt>Email</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '<span class="muted">—</span>'}</dd></div>
    <div><dt>Notes</dt><dd class="contact-notes">${c.notes ? esc(c.notes) : '<span class="muted">—</span>'}</dd></div>
  </dl>
  <div class="contact-projects">
    <h3>Projects <span class="count">${linked.length}</span></h3>
    ${linked.length ? `
    <ul>
      ${linked.map((p) => `
      <li>
        <a href="#project/${p.id}"><span class="dot" style="background:${p.color}"></span><b>${esc(p.name)}</b>${p.active ? dueLabel(p.due) : '<span class="due">Inactive</span>'}</a>
        <button class="icon-btn" data-cunlink="${p.id}" aria-label="Unlink ${esc(p.name)}" title="Unlink">×</button>
      </li>`).join("")}
    </ul>` : `<p class="group-empty">Not linked to any projects yet.</p>`}
    ${linkable.length ? `
    <select class="select" data-clink aria-label="Link a project">
      <option value="">Link a project…</option>
      ${linkable.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}
    </select>` : ""}
  </div>
  <div class="contact-buttons">
    <button class="btn ghost" data-cedit>Edit</button>
    <button class="btn ghost danger" data-cdelete>Delete</button>
  </div>`;
}

function contactsView() {
  const list = visibleContacts();
  const c = contacts.find((x) => x.id === contactSelected) || (matchMedia("(max-width: 760px)").matches ? null : list[0]);
  if (c && contactSelected == null) contactSelected = c.id;
  return `
  <div class="contacts-screen${location.hash.startsWith("#contacts/") ? " open" : ""}">
    <section class="card contact-list-pane">
      <div class="contact-tools">
        <input type="search" class="contact-search" data-csearch placeholder="Search contacts" value="${esc(contactQuery)}" aria-label="Search contacts">
        <button class="btn" data-cadd>+ New</button>
      </div>
      <div class="segmented" role="group" aria-label="Group contacts by">
        <button data-cgroup="name" class="${contactGroup === "name" ? "on" : ""}">Name</button>
        <button data-cgroup="org" class="${contactGroup === "org" ? "on" : ""}">Organization</button>
      </div>
      <div class="contact-list">${contactList()}</div>
    </section>
    <section class="card contact-detail">${contactDetail(c)}</section>
  </div>`;
}

function renderContacts() {
  const y = window.scrollY;
  document.getElementById("view").innerHTML = contactsView();
  window.scrollTo(0, y);
}

function onContactsClick(e) {
  const t = e.target;
  const c = contacts.find((x) => x.id === contactSelected);
  if (t.closest("[data-cgroup]")) {
    contactGroup = t.closest("[data-cgroup]").dataset.cgroup;
    renderContacts();
  } else if (t.closest("[data-cadd]")) openContactDialog(null);
  else if (t.closest("[data-cedit]") && c) openContactDialog(c);
  else if (t.closest("[data-cdelete]") && c) {
    const n = contactProjects(c).length;
    if (!confirm(`Delete ${c.name}?${n ? ` They'll be removed from ${plural(n, "project")}.` : ""}`)) return;
    contacts.splice(contacts.indexOf(c), 1);
    if (n) { projects.forEach((p) => (p.contactIds = p.contactIds.filter((id) => id !== c.id))); saveProjects(); }
    contactSelected = null;
    if (saveContacts()) location.hash = "#contacts";
    if (location.hash === "#contacts") renderContacts();
  } else if (t.closest("[data-cunlink]")) {
    const p = projectById(+t.closest("[data-cunlink]").dataset.cunlink);
    p.contactIds = p.contactIds.filter((id) => id !== c.id);
    if (saveProjects()) renderContacts();
  }
}

function openContactDialog(c) {
  editingContact = c;
  const dialog = document.getElementById("contact-dialog");
  const form = document.getElementById("contact-form");
  form.reset();
  form.dataset.photo = c?.photo || "";
  document.getElementById("contact-dialog-title").textContent = c ? "Edit contact" : "New contact";
  document.getElementById("contact-save").textContent = c ? "Save" : "Add contact";
  for (const f of ["name", "org", "role", "phone", "email", "notes"]) document.getElementById(`contact-${f}`).value = c?.[f] || "";
  const orgs = [...new Set([...projects.filter((p) => !isPersonal(p) && p.client).map((p) => p.client), ...contacts.map((x) => x.org).filter(Boolean)])].sort();
  document.getElementById("contact-orgs").innerHTML = orgs.map((o) => `<option value="${esc(o)}">`).join("");
  paintContactPreview();
  dialog.showModal();
}

function paintContactPreview() {
  const form = document.getElementById("contact-form");
  const name = document.getElementById("contact-name").value.trim();
  const draft = { name, photo: form.dataset.photo, color: editingContact?.color || projectColors[contacts.length % projectColors.length] };
  const el = document.getElementById("contact-photo-preview");
  el.outerHTML = avatar(draft, "large").replace("<span", '<span id="contact-photo-preview"');
}

function setupContactDialog() {
  const dialog = document.getElementById("contact-dialog");
  const form = document.getElementById("contact-form");
  document.getElementById("contact-name").addEventListener("input", paintContactPreview);
  document.getElementById("contact-photo").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    form.dataset.photo = await readImage(file, 256, "image/jpeg");
    paintContactPreview();
    e.target.value = "";
  });
  document.getElementById("contact-photo-remove").addEventListener("click", () => { form.dataset.photo = ""; paintContactPreview(); });
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "save") { linkNewContactTo = null; return; }
    const v = (f) => document.getElementById(`contact-${f}`).value.trim();
    if (!v("name")) return;
    const fields = { name: v("name"), org: v("org"), role: v("role"), phone: v("phone"), email: v("email"), notes: v("notes"), photo: form.dataset.photo || "" };
    let c = editingContact;
    if (c) {
      // Renaming an organization carries its projects along, unless another contact still uses the old name.
      const oldOrg = c.org;
      Object.assign(c, fields);
      if (oldOrg && oldOrg !== c.org && !contacts.some((x) => x !== c && x.org === oldOrg)) {
        projects.forEach((p) => { if (p.client === oldOrg) p.client = c.org; });
        saveProjects();
      }
    } else {
      c = { id: Date.now(), color: projectColors[contacts.length % projectColors.length], ...fields };
      contacts.push(c);
    }
    if (!saveContacts()) return;
    const linkTo = linkNewContactTo && projectById(linkNewContactTo);
    linkNewContactTo = null;
    if (linkTo && !editingContact) { linkContact(linkTo, c); refreshView(); return; }
    contactSelected = c.id;
    if (location.hash === `#contacts/${c.id}`) renderContacts();
    else location.hash = `#contacts/${c.id}`;
  });
}

function placeholder(v) {
  return `
  <div class="card empty">
    <span class="view-icon big">${svg(v.icon)}</span>
    <h2>${v.label}</h2>
    <p>${v.step}. This screen isn't built yet; it comes in a later step.</p>
    <a class="btn" href="#overview">Back to overview</a>
  </div>`;
}

// Progress gallery: images per project, stored in the library as resized JPEGs.
// Browsers give a site about 5 MB of storage, so this holds roughly 20–40 images in total.
const GALLERY_KEY = "ost.gallery";
const galleryKinds = ["Photo", "Drawing", "Render"];
const gallery = [];
let galleryProject = "";
let galleryKind = "all";
let galleryGroup = "date";
let lightboxList = [];
let lightboxIndex = 0;

function loadGallery() {
  let list = null;
  list = store.get(GALLERY_KEY);
  if (!Array.isArray(list)) {
    // Start from the placeholder entries (no image yet) so the screen isn't empty.
    let id = 1;
    list = Object.entries(projectDetails).flatMap(([pid, d]) => (d.gallery || []).map((g) => ({ id: id++, project: +pid, image: "", note: "", ...g })));
  }
  // Each gallery item is one file with versions (v1, v2, …). Older saves had a single image and note.
  for (const g of list) {
    if (Array.isArray(g.versions)) continue;
    g.versions = [{ id: 1, image: g.image || "", date: g.date, strokes: [], notes: g.note ? [{ id: 1, text: g.note, date: g.date }] : [] }];
    delete g.image;
    delete g.note;
  }
  gallery.splice(0, gallery.length, ...list);
}

function saveGallery() {
  store.set(GALLERY_KEY, gallery);
  return true;
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

const galleryItems = () => gallery.filter((g) => projectById(g.project)).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

const versionImage = (g, v) => v.image || g.versions.find((x) => x.id === v.src)?.image || "";
const latestVersion = (g) => g.versions[g.versions.length - 1];
const noteCount = (g) => g.versions.reduce((n, v) => n + v.notes.length, 0);

function galleryFigure(g, { project = true } = {}) {
  const p = projectById(g.project);
  const img = versionImage(g, latestVersion(g));
  const badges = `${g.versions.length > 1 ? `<span class="ver">v${g.versions.length}</span>` : ""}${noteCount(g) ? `<span class="notes-badge">${svg("comment")}${noteCount(g)}</span>` : ""}`;
  const del = `<button type="button" class="g-delete" data-gdelete="${g.id}" aria-label="Delete ${esc(g.title)}" title="Delete image">${TRASH}</button>`;
  return `
  <figure class="upload" data-gopen="${g.id}" tabindex="0">
    ${img
      ? `<div class="thumb photo" style="background-image:url(${img})"><span class="kind">${g.kind}</span>${badges}${del}</div>`
      : `<div class="thumb" style="--c:${p.color}">${svg("image")}<span>${g.kind}</span>${badges}${del}</div>`}
    <figcaption><b>${esc(g.title)}</b><span>${fmt(g.date)}</span></figcaption>
    ${project ? `<div class="upload-project"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</div>` : ""}
  </figure>`;
}

function visibleGallery() {
  return galleryItems().filter((g) => (!galleryProject || g.project === +galleryProject) && (galleryKind === "all" || g.kind === galleryKind));
}

function galleryView() {
  const list = visibleGallery();
  const groups = new Map();
  for (const g of list) {
    const key = galleryGroup === "project" ? projectById(g.project).name : parse(g.date).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  }
  const keys = [...groups.keys()];
  if (galleryGroup === "project") keys.sort((a, b) => a.localeCompare(b));
  const withImages = gallery.reduce((n, g) => n + g.versions.filter((v) => v.image).length, 0);
  return `
  <div class="projects-toolbar gallery-toolbar">
    <select class="select" data-gproject aria-label="Filter by project">
      <option value="">All projects</option>
      ${projects.map((p) => `<option value="${p.id}"${String(p.id) === galleryProject ? " selected" : ""}>${esc(p.name)}</option>`).join("")}
    </select>
    <div class="segmented" role="group" aria-label="Kind">
      ${["all", ...galleryKinds].map((k) => `<button data-gkind="${k}" class="${galleryKind === k ? "on" : ""}">${k === "all" ? "All" : k + "s"}</button>`).join("")}
    </div>
    <div class="segmented" role="group" aria-label="Group by">
      <button data-ggroup="date" class="${galleryGroup === "date" ? "on" : ""}">By month</button>
      <button data-ggroup="project" class="${galleryGroup === "project" ? "on" : ""}">By project</button>
    </div>
    <button class="btn" data-gupload="${esc(galleryProject)}">+ Upload</button>
  </div>
  <div class="storage-meter">
    <span>${withImages} uploaded image${withImages === 1 ? "" : "s"} · library uses ${mb(store.info.usage?.bytes || 0)} in <b>${esc(store.info.status?.hostPath || "")}</b></span>
  </div>
  ${list.length ? keys.map((k) => `
  <section class="gallery-group">
    <h3 class="section-title">${esc(k)} <span class="count">${groups.get(k).length}</span></h3>
    <div class="gallery-grid">${groups.get(k).map((g) => galleryFigure(g, { project: galleryGroup !== "project" })).join("")}</div>
  </section>`).join("") : `<div class="card empty"><span class="view-icon big">${svg("image")}</span><h2>No images here yet</h2><p>Upload drawings, photos or renders to track a project's progress.</p></div>`}`;
}

function renderGallery() {
  const y = window.scrollY;
  document.getElementById("view").innerHTML = galleryView();
  window.scrollTo(0, y);
}

// Re-renders whichever screen is showing gallery items after a change.
function refreshGalleryViews() {
  if (location.hash === "#gallery") renderGallery();
  else if (location.hash.startsWith("#project/") || location.hash === "#overview" || location.hash === "") {
    const y = window.scrollY;
    route();
    window.scrollTo(0, y);
  }
}

function onGalleryClick(e) {
  const t = e.target;
  if (t.closest("[data-gkind]")) { galleryKind = t.closest("[data-gkind]").dataset.gkind; renderGallery(); }
  else if (t.closest("[data-ggroup]")) { galleryGroup = t.closest("[data-ggroup]").dataset.ggroup; renderGallery(); }
}

// Deletes right away; the toast offers Undo instead of asking first.
function removeGalleryItem(g) {
  const i = gallery.indexOf(g);
  if (i < 0) return;
  gallery.splice(i, 1);
  saveGallery();
  refreshGalleryViews();
  toast(`Deleted "${g.title}".`, 8000, { label: "Undo", fn: () => { gallery.splice(Math.min(i, gallery.length), 0, g); saveGallery(); refreshGalleryViews(); } });
}

// Shared by the gallery screen, project pages and the Overview card.
function onGalleryItemClick(e) {
  const del = e.target.closest("[data-gdelete]");
  if (del) { removeGalleryItem(gallery.find((g) => g.id === +del.dataset.gdelete)); return true; }
  const up = e.target.closest("[data-gupload]");
  if (up) { openUploadDialog(up.dataset.gupload); return true; }
  const fig = e.target.closest("[data-gopen]");
  if (!fig) return false;
  // Arrows step through the images shown on the current screen, in screen order.
  lightboxList = [...new Set([...view.querySelectorAll("[data-gopen]")].map((el) => +el.dataset.gopen))];
  lightboxIndex = lightboxList.indexOf(+fig.dataset.gopen);
  openLightbox();
  return true;
}

const projectOptions = (selected) => projects.map((p) => `<option value="${p.id}"${p.id === +selected ? " selected" : ""}>${esc(p.name)}</option>`).join("");

function openUploadDialog(projectId) {
  document.getElementById("upload-form").reset();
  document.getElementById("upload-project").innerHTML = projectOptions(projectId || activeProjects()[0]?.id || projects[0]?.id);
  document.getElementById("upload-date").value = new Date().toISOString().slice(0, 10);
  document.getElementById("upload-hint").textContent = `Each image is resized to at most 2400px and saved in your library (${store.info.status?.hostPath || "the data folder"}).`;
  document.getElementById("upload-dialog").showModal();
}

function setupGalleryDialogs() {
  const up = document.getElementById("upload-dialog");
  up.addEventListener("close", async () => {
    if (up.returnValue !== "save") return;
    const files = [...document.getElementById("upload-files").files];
    const project = +document.getElementById("upload-project").value;
    const kind = document.getElementById("upload-kind").value;
    const date = document.getElementById("upload-date").value || new Date().toISOString().slice(0, 10);
    let saved = 0;
    for (const file of files) {
      let image;
      try { image = await readImage(file, 2400, "image/jpeg"); } catch { continue; }
      const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 80) || "Untitled";
      gallery.push({ id: Date.now() + saved, project, kind, date, title, versions: [{ id: 1, image, date, strokes: [], notes: [] }] });
      saveGallery();
      saved++;
    }
    refreshGalleryViews();
  });

  setupReview();
}

// Review viewer: versions on the left, markup tools on top, notes on the right.
// Markup is stored as vector strokes in 0–1 image coordinates, so it costs almost no storage.
// A "markup copy" version reuses its source image instead of storing it twice.
const reviewColors = ["#E03131", "#F2C94C", "#2F9E44", "#FFFFFF", "#111111", "#9B30D9"];
const rv = { tool: "view", color: "#9B30D9", size: 4, show: true, compare: "", tab: "notes", noteScope: "version", versionId: null, redo: [], pin: null, drawing: null };
const rvGallery = () => gallery.find((x) => x.id === lightboxList[lightboxIndex]);
const rvVersion = (g = rvGallery()) => g && (g.versions.find((v) => v.id === rv.versionId) || latestVersion(g));
const rvToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const rvIcons = {
  view: '<path d="M5 3l14 8-6 2-2 6z"/>',
  pen: '<path d="M4 20c4-1 5-5 8-8l4-4 3 3-4 4c-3 3-7 4-8 8"/><path d="m14 6 3 3"/>',
  arrow: '<path d="M5 19 19 5"/><path d="M10 5h9v9"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="6.5"/>',
  pin: '<path d="M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  eraser: '<path d="m8 20-5-5 10-10 8 8-7 7z"/><path d="M8 20h12M7 11l7 7"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
};
const rvIcon = (n) => `<svg viewBox="0 0 24 24">${rvIcons[n]}</svg>`;
const toolNames = { view: "Look (no drawing)", pen: "Pen", arrow: "Arrow", rect: "Box", ellipse: "Circle", pin: "Pin a note", eraser: "Eraser" };

function openLightbox() {
  rv.versionId = null;
  rv.compare = "";
  rv.redo = [];
  rv.pin = null;
  rv.tool = "view";
  paintReview();
  document.getElementById("lightbox").showModal();
}

function strokeSvg(s, i, w, h) {
  const pts = s.p.map(([x, y]) => [x * w, y * h]);
  const attrs = `data-si="${i}" stroke="${s.c}" stroke-width="${s.w}" fill="none" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"`;
  if (s.t === "pen") return `<polyline ${attrs} points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
  const [[x1, y1], [x2, y2]] = [pts[0], pts[pts.length - 1]];
  if (s.t === "rect") return `<rect ${attrs} x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}"/>`;
  if (s.t === "ellipse") return `<ellipse ${attrs} cx="${(x1 + x2) / 2}" cy="${(y1 + y2) / 2}" rx="${Math.abs(x2 - x1) / 2}" ry="${Math.abs(y2 - y1) / 2}"/>`;
  // Arrow: the head scales with the image so it reads the same at any size.
  const len = Math.max(w, h) * 0.025, a = Math.atan2(y2 - y1, x2 - x1);
  const head = [a - 0.5, a + 0.5].map((t) => `${x2 - len * Math.cos(t)},${y2 - len * Math.sin(t)}`);
  return `<g data-si="${i}"><line ${attrs} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><polyline ${attrs} points="${head[0]} ${x2},${y2} ${head[1]}"/></g>`;
}

function frameHtml(g, v, editable) {
  const img = versionImage(g, v);
  const p = projectById(g.project);
  if (!img) return `<div class="rv-frame rv-empty"><div class="thumb" style="--c:${p.color}">${svg("image")}<span>No image in this version. Use "Upload revision" to add one.</span></div></div>`;
  const pinned = v.notes.filter((n) => n.x != null);
  return `
  <div class="rv-frame${editable ? ` tool-${rv.tool}` : ""}" data-vid="${v.id}">
    <img src="${img}" alt="${esc(g.title)} v${g.versions.indexOf(v) + 1}" draggable="false">
    <svg class="rv-ink"${rv.show ? "" : " hidden"}></svg>
    <div class="rv-pins"${rv.show ? "" : " hidden"}>
      ${pinned.map((n) => `<span class="rv-pin" style="left:${n.x * 100}%;top:${n.y * 100}%" title="${esc(n.text)}">${v.notes.indexOf(n) + 1}</span>`).join("")}
      ${editable && rv.pin ? `<span class="rv-pin pending" style="left:${rv.pin.x * 100}%;top:${rv.pin.y * 100}%">+</span>` : ""}
    </div>
  </div>`;
}

// The ink layer is drawn after the image loads, using its real size for the viewBox.
function paintInk(frame, v) {
  const img = frame.querySelector("img"), ink = frame.querySelector(".rv-ink");
  if (!img || !ink) return;
  const draw = () => {
    const w = img.naturalWidth || 1, h = img.naturalHeight || 1;
    ink.setAttribute("viewBox", `0 0 ${w} ${h}`);
    ink.innerHTML = v.strokes.map((s, i) => strokeSvg(s, i, w, h)).join("") + (rv.drawing && frame.dataset.vid == rv.versionId ? strokeSvg(rv.drawing, -1, w, h) : "");
  };
  if (img.complete) draw(); else img.onload = draw;
}

function paintReview() {
  const g = rvGallery();
  if (!g) return;
  const v = rvVersion(g);
  rv.versionId = v.id;
  const vi = g.versions.indexOf(v);
  const p = projectById(g.project);
  const cmp = rv.compare && g.versions.find((x) => x.id === +rv.compare && x !== v);
  const hasImg = !!versionImage(g, v);

  document.getElementById("rv-head").innerHTML = `
    <div class="rv-file"><small><span class="dot" style="background:${p.color}"></span>${esc(p.name)} · ${g.kind}</small><b>${esc(g.title)}</b></div>
    <span class="rv-chip">v${vi + 1} of ${g.versions.length}</span>
    <span class="rv-count">File ${lightboxIndex + 1} of ${lightboxList.length}</span>
    <button type="button" class="rv-tool rv-delfile" data-rvdelfile title="Delete this file" aria-label="Delete this file">${TRASH}</button>`;
  document.querySelectorAll("[data-rvfile]").forEach((b) => (b.disabled = lightboxList.length < 2));

  document.getElementById("rv-tools").innerHTML = `
    <div class="rv-group">${Object.keys(toolNames).map((t) => `<button type="button" class="rv-tool${rv.tool === t ? " on" : ""}" data-rvtool="${t}" title="${toolNames[t]}" aria-label="${toolNames[t]}"${hasImg ? "" : " disabled"}>${rvIcon(t)}</button>`).join("")}</div>
    <label class="rv-size" title="Line size"><span>${rv.size}</span><input type="range" min="1" max="16" value="${rv.size}" data-rvsize aria-label="Line size"></label>
    <div class="rv-group rv-colors">${reviewColors.map((c) => `<button type="button" class="rv-color${rv.color === c ? " on" : ""}" data-rvcolor="${c}" style="--c:${c}" aria-label="Color ${c}"></button>`).join("")}</div>
    <div class="rv-group">
      <button type="button" class="rv-tool" data-rvundo title="Undo" aria-label="Undo"${v.strokes.length ? "" : " disabled"}>${rvIcon("undo")}</button>
      <button type="button" class="rv-tool" data-rvredo title="Redo" aria-label="Redo"${rv.redo.length ? "" : " disabled"}>${rvIcon("redo")}</button>
    </div>
    <label class="rv-check"><input type="checkbox" data-rvshow${rv.show ? " checked" : ""}> Show markup</label>
    <select class="rv-select" data-rvcompare aria-label="Compare with another version"${g.versions.length > 1 ? "" : " disabled"}>
      <option value="">Compare</option>
      ${g.versions.filter((x) => x !== v).map((x) => `<option value="${x.id}"${cmp === x ? " selected" : ""}>Side by side with v${g.versions.indexOf(x) + 1}</option>`).join("")}
    </select>`;

  document.getElementById("rv-versions").innerHTML = `
    <ol>
      ${g.versions.map((x, i) => {
        const img = versionImage(g, x);
        return `
        <li><button type="button" class="rv-ver${x === v ? " on" : ""}" data-rvver="${x.id}">
          <span class="rv-ver-thumb"${img ? ` style="background-image:url(${img})"` : ""}>${img ? "" : svg("image")}</span>
          <span class="rv-ver-meta"><b>v${i + 1}</b><small>${x.label ? esc(x.label) : x.src ? `Markup of v${g.versions.findIndex((y) => y.id === x.src) + 1}` : "Image"}</small><small>${fmt(x.date)}</small></span>
          <span class="rv-ver-badges">${x.notes.length ? `<span>${svg("comment")}${x.notes.length}</span>` : ""}${x.strokes.length ? `<span title="Has drawings">${rvIcon("pen")}</span>` : ""}</span>
        </button></li>`;
      }).join("")}
    </ol>
    <label class="btn ghost rv-add">+ Upload revision<input type="file" accept="image/*" data-rvupload hidden></label>
    <button type="button" class="btn ghost rv-add" data-rvcopy${hasImg ? "" : " disabled"} title="New version with the same image and empty markup">+ Markup copy of v${vi + 1}</button>`;

  const stage = document.getElementById("rv-stage");
  stage.classList.toggle("compare", !!cmp);
  stage.innerHTML = cmp
    ? `<div class="rv-col"><span class="rv-col-label">v${g.versions.indexOf(cmp) + 1}</span>${frameHtml(g, cmp, false)}</div><div class="rv-col"><span class="rv-col-label">v${vi + 1} · drawing here</span>${frameHtml(g, v, true)}</div>`
    : frameHtml(g, v, true);
  stage.querySelectorAll(".rv-frame[data-vid]").forEach((f) => paintInk(f, g.versions.find((x) => x.id === +f.dataset.vid)));

  paintReviewSide(g, v);
}

function paintReviewSide(g = rvGallery(), v = rvVersion(g)) {
  const side = document.getElementById("rv-side");
  const vi = g.versions.indexOf(v);
  const tabs = `
    <div class="rv-tabs">
      <button type="button" data-rvtab="notes" class="${rv.tab === "notes" ? "on" : ""}">${svg("comment")} Notes <span>${noteCount(g)}</span></button>
      <button type="button" data-rvtab="info" class="${rv.tab === "info" ? "on" : ""}">Details</button>
    </div>`;
  if (rv.tab === "info") {
    side.innerHTML = `${tabs}
    <div class="rv-info">
      <label class="field"><span>Title</span><input type="text" id="rv-title" maxlength="80" value="${esc(g.title)}"></label>
      <label class="field"><span>Project</span><select class="select" id="rv-project">${projectOptions(g.project)}</select></label>
      <label class="field"><span>Kind</span><select class="select" id="rv-kind">${galleryKinds.map((k) => `<option${k === g.kind ? " selected" : ""}>${k}</option>`).join("")}</select></label>
      <label class="field"><span>v${vi + 1} label</span><input type="text" id="rv-vlabel" maxlength="40" placeholder="${v.src ? "Markup" : "Image"}" value="${esc(v.label || "")}"></label>
      <label class="field"><span>v${vi + 1} date</span><input type="date" id="rv-vdate" value="${v.date}"></label>
      <button type="button" class="btn" data-rvsave>Save details</button>
      <div class="rv-danger">
        ${g.versions.length > 1 ? `<button type="button" class="btn ghost danger" data-rvdelver>Delete v${vi + 1}</button>` : ""}
        <button type="button" class="btn ghost danger" data-rvdelfile>Delete file</button>
      </div>
    </div>`;
    return;
  }
  const list = rv.noteScope === "all"
    ? g.versions.flatMap((x, i) => x.notes.map((n, j) => ({ n, j, x, i }))).reverse()
    : v.notes.map((n, j) => ({ n, j, x: v, i: vi })).reverse();
  side.innerHTML = `${tabs}
    <div class="rv-notes-head">
      <select class="rv-select" data-rvscope aria-label="Which notes">
        <option value="version"${rv.noteScope === "version" ? " selected" : ""}>Notes on v${vi + 1}</option>
        <option value="all"${rv.noteScope === "all" ? " selected" : ""}>All versions</option>
      </select>
    </div>
    <ul class="rv-notes">
      ${list.map(({ n, j, x, i }) => `
      <li${x === v ? "" : ` class="other" data-rvver="${x.id}"`}>
        <div class="rv-note-meta">
          ${n.x != null ? `<span class="rv-pin small">${j + 1}</span>` : ""}
          <b>v${i + 1}</b><span>${fmt(n.date)}</span>
          ${x === v ? `<button type="button" class="icon-btn" data-rvdelnote="${n.id}" aria-label="Delete note">×</button>` : ""}
        </div>
        <p>${esc(n.text)}</p>
      </li>`).join("") || `<li class="rv-notes-empty">No notes yet. Pick the pin tool to place a note on the image, or just write one below.</li>`}
    </ul>
    <div class="rv-compose">
      <textarea id="rv-note" rows="3" maxlength="1000" placeholder="Add a note to v${vi + 1}…"></textarea>
      <div class="rv-compose-row">
        <span class="muted">${rv.pin ? "Pinned to the spot you clicked" : rv.tool === "pin" ? "Click the image to pin this note" : "Not pinned"}</span>
        <button type="button" class="btn" data-rvnote>Add note</button>
      </div>
    </div>`;
}

function rvSave() {
  return saveGallery();
}

function rvPoint(e, frame) {
  const r = frame.querySelector("img").getBoundingClientRect();
  return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))].map((n) => Math.round(n * 1000) / 1000);
}

function rvErase(e) {
  const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-si]");
  if (!hit || hit.dataset.si === "-1") return;
  const v = rvVersion();
  const i = +hit.dataset.si;
  rv.redo = [];
  v.strokes.splice(i, 1);
  rvSave();
  paintReview();
}

async function rvAddVersion(fields) {
  const g = rvGallery();
  const v = { id: Math.max(...g.versions.map((x) => x.id)) + 1, date: rvToday(), strokes: [], notes: [], ...fields };
  g.versions.push(v);
  g.date = v.date;
  if (!rvSave()) return;
  rv.versionId = v.id;
  rv.redo = [];
  rv.compare = "";
  paintReview();
  refreshGalleryViews();
}

function setupReview() {
  const dlg = document.getElementById("lightbox");
  dlg.addEventListener("close", () => refreshGalleryViews());

  dlg.addEventListener("click", (e) => {
    const t = e.target;
    const g = rvGallery();
    if (!g) return;
    const v = rvVersion(g);
    const q = (sel) => t.closest(sel);
    if (q("[data-rvclose]")) dlg.close();
    else if (q("[data-rvfile]")) {
      lightboxIndex = (lightboxIndex + +q("[data-rvfile]").dataset.rvfile + lightboxList.length) % lightboxList.length;
      rv.versionId = null; rv.compare = ""; rv.redo = []; rv.pin = null;
      paintReview();
    } else if (q("[data-rvtool]")) { rv.tool = q("[data-rvtool]").dataset.rvtool; if (rv.tool !== "pin") rv.pin = null; paintReview(); }
    else if (q("[data-rvcolor]")) { rv.color = q("[data-rvcolor]").dataset.rvcolor; if (rv.tool === "view" || rv.tool === "eraser" || rv.tool === "pin") rv.tool = "pen"; paintReview(); }
    else if (q("[data-rvundo]")) { if (v.strokes.length) { rv.redo.push(v.strokes.pop()); rvSave(); paintReview(); } }
    else if (q("[data-rvredo]")) { if (rv.redo.length) { v.strokes.push(rv.redo.pop()); rvSave(); paintReview(); } }
    else if (q("[data-rvver]")) { rv.versionId = +q("[data-rvver]").dataset.rvver; rv.redo = []; rv.pin = null; if (+rv.compare === rv.versionId) rv.compare = ""; paintReview(); }
    else if (q("[data-rvcopy]")) rvAddVersion({ src: v.src || v.id });
    else if (q("[data-rvtab]")) { rv.tab = q("[data-rvtab]").dataset.rvtab; paintReviewSide(); }
    else if (q("[data-rvnote]")) {
      const text = document.getElementById("rv-note").value.trim();
      if (!text) return;
      const n = { id: Date.now(), text, date: rvToday() };
      if (rv.pin) Object.assign(n, rv.pin);
      v.notes.push(n);
      rv.pin = null;
      if (rvSave()) paintReview();
    } else if (q("[data-rvdelnote]")) {
      v.notes = v.notes.filter((n) => n.id !== +q("[data-rvdelnote]").dataset.rvdelnote);
      if (rvSave()) paintReview();
    } else if (q("[data-rvsave]")) {
      g.title = document.getElementById("rv-title").value.trim() || g.title;
      g.project = +document.getElementById("rv-project").value;
      g.kind = document.getElementById("rv-kind").value;
      v.label = document.getElementById("rv-vlabel").value.trim();
      v.date = document.getElementById("rv-vdate").value || v.date;
      if (v === latestVersion(g)) g.date = v.date;
      if (rvSave()) paintReview();
    } else if (q("[data-rvdelver]")) {
      if (!confirm(`Delete v${g.versions.indexOf(v) + 1} with its drawings and notes? This can't be undone.`)) return;
      // Markup copies that reuse this version's image take the image over before it goes.
      const heirs = g.versions.filter((x) => x.src === v.id);
      if (heirs.length && v.image) { heirs[0].image = v.image; delete heirs[0].src; heirs.slice(1).forEach((x) => (x.src = heirs[0].id)); }
      g.versions.splice(g.versions.indexOf(v), 1);
      g.date = latestVersion(g).date;
      rv.versionId = null; rv.compare = "";
      if (rvSave()) paintReview();
    } else if (q("[data-rvdelfile]")) {
      dlg.close();
      removeGalleryItem(g);
    }
  });

  dlg.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.matches("[data-rvshow]")) { rv.show = t.checked; paintReview(); }
    else if (t.matches("[data-rvcompare]")) { rv.compare = t.value; paintReview(); }
    else if (t.matches("[data-rvscope]")) { rv.noteScope = t.value; paintReviewSide(); }
    else if (t.matches("[data-rvupload]") && t.files[0]) {
      let image;
      try { image = await readImage(t.files[0], 2400, "image/jpeg"); } catch { alert("That file couldn't be read as an image."); return; }
      rvAddVersion({ image });
    }
  });
  dlg.addEventListener("input", (e) => {
    if (!e.target.matches("[data-rvsize]")) return;
    rv.size = +e.target.value;
    e.target.previousElementSibling.textContent = rv.size;
  });

  // Drawing happens on the version being edited (the right-hand one when comparing).
  const stage = document.getElementById("rv-stage");
  stage.addEventListener("pointerdown", (e) => {
    const frame = e.target.closest(".rv-frame[data-vid]");
    if (!frame || +frame.dataset.vid !== rv.versionId || rv.tool === "view" || e.button > 0) return;
    e.preventDefault();
    if (rv.tool === "eraser") { stage.setPointerCapture(e.pointerId); rv.erasing = true; rvErase(e); return; }
    if (rv.tool === "pin") {
      const [x, y] = rvPoint(e, frame);
      rv.pin = { x, y };
      paintReview();
      document.getElementById("rv-note")?.focus();
      return;
    }
    stage.setPointerCapture(e.pointerId);
    const p = rvPoint(e, frame);
    rv.drawing = { t: rv.tool, c: rv.color, w: rv.size, p: [p, p] };
    rv.frame = frame;
  });
  stage.addEventListener("pointermove", (e) => {
    if (rv.erasing) { rvErase(e); return; }
    if (!rv.drawing) return;
    const p = rvPoint(e, rv.frame);
    if (rv.drawing.t === "pen") {
      const last = rv.drawing.p[rv.drawing.p.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.002) rv.drawing.p.push(p);
    } else rv.drawing.p[1] = p;
    paintInk(rv.frame, rvVersion());
  });
  const finish = () => {
    rv.erasing = false;
    if (!rv.drawing) return;
    const s = rv.drawing;
    rv.drawing = null;
    const [a, b] = [s.p[0], s.p[s.p.length - 1]];
    const tiny = s.t === "pen" ? s.p.length < 2 : Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.005;
    if (s.t === "pen" && s.p.length === 2 && a === b) s.p = [a, [a[0] + 0.001, a[1]]];
    if (!tiny || s.t === "pen") {
      rvVersion().strokes.push(s);
      rv.redo = [];
      rvSave();
    }
    paintReview();
  };
  stage.addEventListener("pointerup", finish);
  stage.addEventListener("pointercancel", finish);

  dlg.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      lightboxIndex = (lightboxIndex + (e.key === "ArrowRight" ? 1 : -1) + lightboxList.length) % lightboxList.length;
      rv.versionId = null; rv.compare = ""; rv.redo = []; rv.pin = null;
      paintReview();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      dlg.querySelector(e.shiftKey ? "[data-rvredo]" : "[data-rvundo]")?.click();
    }
  });
}

let lastView = null;

function route(keep = false) {
  const id = location.hash.slice(1) || "overview";
  const detail = id.match(/^project\/(\d+)$/);
  const detailProject = detail && projectById(+detail[1]);
  const contactMatch = id.match(/^contacts(?:\/(\d+))?$/);
  if (contactMatch) contactSelected = contactMatch[1] ? +contactMatch[1] : contactSelected;
  const v = detail ? views.find((x) => x.id === (detailProject && isPersonal(detailProject) ? "personal" : "projects")) : views.find((x) => x.id === (contactMatch ? "contacts" : id)) || views[0];
  renderNav(v.id);
  document.getElementById("page-title").textContent = v.id === "overview" ? "Overview" : v.label;
  if (!keep) {
    editingProjects = false;
    addingTo = null;
  }
  const screens = { overview, projects: projectsView, personal: projectsView, tasks: tasksView, todo: todoView, timeline: timelineView, contacts: contactsView, gallery: galleryView };
  document.getElementById("view").innerHTML = detail ? projectDetail(+detail[1]) : screens[v.id] ? screens[v.id]() : placeholder(v);
  document.body.classList.toggle("is-detail", !!detail);
  if (v.id === "timeline" && !detail && !keep) scrollTimelineToToday();
  document.getElementById("customize-btn").hidden = !!detail || !["overview", "projects", "personal"].includes(v.id);
  document.getElementById("sidebar").classList.remove("open");
  // Picking another contact keeps the list where it was; any other screen change starts at the top.
  if (!keep && !(contactMatch && lastView === "contacts")) window.scrollTo(0, 0);
  lastView = detail ? null : v.id;
}

document.getElementById("today").textContent = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
document.getElementById("menu-btn").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
applyBrand();
setupBrandDialog();
setupProjectDialog();
setupContactDialog();
setupGalleryDialogs();
setupTaskDialog();
setupSearch();
setupDetailsDialog();
setupBannerDialog();
setupScheduleDialog();
setupQuickTodo();
setupQuickAdd();
setupBackups();
loadProjects();
loadContacts();
migrateContactLinks();
loadGallery();
seedLibrary();
store.onSaveProblem((e) => toast(`Not saved: ${e.message} Your last change is still on screen; it will be sent again with the next change.`, 12000));
try {
  const restored = sessionStorage.getItem("ost.restored");
  if (restored) { sessionStorage.removeItem("ost.restored"); toast(`Restored from ${restored}.`); }
} catch {}
const view = document.getElementById("view");
view.addEventListener("click", (e) => {
  if (onEditClick(e)) return;
  if (onGalleryItemClick(e)) return;
  if (location.hash === "#gallery") onGalleryClick(e);
  else if (isListScreen()) onProjectsClick(e);
  else if (location.hash === "#tasks") onTasksClick(e);
  else if (location.hash.startsWith("#project/")) onTodoBoardClick(e);
  else if (location.hash === "#todo") onTodoViewClick(e);
  else if (location.hash === "#timeline") onTimelineClick(e);
  else if (location.hash.startsWith("#contacts")) onContactsClick(e);
  else onOverviewClick(e);
});
view.addEventListener("change", (e) => {
  if (e.target.matches("[data-todoproject]")) {
    todoProject = e.target.value;
    addingTo = null;
    view.innerHTML = todoView();
  } else if (e.target.matches("[data-tlinactive]")) {
    timelineShowInactive = e.target.checked;
    view.innerHTML = timelineView();
    scrollTimelineToToday();
  } else if (e.target.matches("[data-gproject]")) {
    galleryProject = e.target.value;
    renderGallery();
  } else if (e.target.matches("[data-pcontact]")) {
    const p = projectById(+e.target.dataset.pcontact);
    const c = contacts.find((x) => x.id === +e.target.value);
    if (!p || !c) return;
    linkContact(p, c);
    refreshView();
  } else if (e.target.matches("[data-clink]")) {
    const p = projectById(+e.target.value);
    const c = contacts.find((x) => x.id === contactSelected);
    if (!p || !c) return;
    linkContact(p, c);
    renderContacts();
  } else if (e.target.matches("[data-tdone]")) {
    showDoneTasks = e.target.checked;
    view.innerHTML = tasksView();
  } else onProjectsChange(e);
});
view.addEventListener("input", (e) => {
  if (!e.target.matches("[data-csearch]")) return;
  contactQuery = e.target.value;
  view.querySelector(".contact-list").innerHTML = contactList();
});
setupProjectDrag(view);
setupTimelineDrag(view);
setupTodoBoard(view);
setupCardDialog();
document.getElementById("customize-btn").addEventListener("click", () => {
  if (isListScreen()) {
    editingProjects = !editingProjects;
    renderProjects();
  } else {
    customizing = !customizing;
    view.innerHTML = overview();
  }
});
window.addEventListener("hashchange", () => route());
route();
