# OST Planner: guide for working on your own copy

OST Planner is a self-hosted dashboard for tracking creative and client work: projects, personal works, tasks, a to-do board, a timeline with calendar, client contacts, and a progress gallery with a markup/review tool for images. It runs in Docker on your own computer and keeps everything as plain files in a folder you choose.

This guide covers how it runs, how the code is laid out, where the data lives, and how to change it at home using the free version of Claude.

---

## 1. Read this first

- **No accounts or passwords.** Anyone who can reach the port (1820) on your network can see and change everything. Only run it on a home network, or bind it to your own machine (see section 3).
- **No automated tests and no build step.** You check changes by opening the page and clicking through it.
- **Fonts:** `public/fonts/` holds Helvetica Neue, which is a commercial font. If you publish your copy (for example a public GitHub repo), remove those files and switch to a free font (section 7, "Change the font").
- **No license file yet.** Ask the original author how you may use and share the code before publishing it.
- **Built one screen at a time.** Some parts still show sample data (see section 8).

---

## 2. What you need

- **Docker Desktop** (Mac/Windows) or Docker Engine (Linux). This is the normal way to run it.
- Or **Node.js 22 or newer**, if you want to run it without Docker while editing (quicker to try changes).
- A text editor. VS Code is free and works well.
- A browser.

No `npm install` is needed. The server uses only what ships with Node.

---

## 3. Running it

### With Docker (normal use)

From the `ost-planner/` folder:

```sh
docker compose up -d --build
```

Open http://localhost:1820. On first launch a setup screen asks for a library folder name and what to start with: the sample projects, an empty library, or a backup .zip.

- Stop: `docker compose down`
- After changing any file: `docker compose up -d --build` (the files are copied into the image, so a rebuild is required)
- Port 1820 already taken: in `docker-compose.yml` change `"1820:1820"` to e.g. `"8090:1820"`
- Only reachable from your own computer: change it to `"127.0.0.1:1820:1820"`
- See server errors: `docker compose logs -f`

### Without Docker (faster while editing)

From the `ost-planner/` folder:

```sh
DATA_ROOT=./data PUBLIC_DIR=./public node server/server.js
```

(On Windows PowerShell: `$env:DATA_ROOT="./data"; $env:PUBLIC_DIR="./public"; node server/server.js`)

Open http://localhost:1820. Front-end changes (HTML/CSS/JS) only need a browser refresh. Changes to `server/*.js` need the server stopped (Ctrl+C) and started again. If the browser seems to show old code, do a hard refresh (Ctrl+Shift+R / Cmd+Shift+R).

---

## 4. How it works

```
Browser (public/)                         Node server (server/server.js)            Disk (data/)
-----------------                         ------------------------------            ------------
index.html  page shell + all dialogs      serves public/ files                      ost-config.json   which library folder
boot.js     first-launch setup  ───────►  /api/status, /api/setup                   <library>/state/*.json  one file per key
store.js    load/save all data  ───────►  /api/state, /api/state/<key>  ─────────►  <library>/files/   images and PDFs
app.js      every screen        ───────►  /api/files (uploads)                       <library>/backups/ copy before restore
                                          /api/backup, /api/restore (zip.js)
```

1. `index.html` loads `boot.js`.
2. `boot.js` asks the server if a library exists. If not, it shows the setup screen. Then it calls `store.loadAll()` and imports `app.js`.
3. `store.js` keeps every saved value in memory. `store.get(key)` is instant; `store.set(key, value)` updates memory and sends the value to the server in the background. Before saving, it finds any embedded images (`data:image/...`), uploads them to `/api/files`, and replaces them with a `/files/<hash>.ext` link.
4. `app.js` draws each screen as an HTML string and puts it in `#view`. Navigation is the URL hash: `#overview`, `#projects`, `#personal`, `#tasks`, `#todo`, `#timeline`, `#contacts`, `#contacts/<id>`, `#gallery`, `#project/<id>`. The `route()` function near the bottom of `app.js` picks the screen.
5. The server writes each key as `state/<key>.json` (written to a temp file then renamed, so a crash doesn't leave half a file). Uploaded files are named by a hash of their content, so the same image is stored once.

### Where the data folder is

`docker-compose.yml` mounts the host folder set in `.env` (`OST_DATA_DIR`, default `./data`) at `/data` inside the container. To keep the data somewhere else (e.g. Documents), set a full path in `.env` and run `docker compose up -d`.

### Saved keys (files in `state/`)

| Key | What it holds |
|-----|---------------|
| `ost.projects` | `{ list: [...] }` every project and personal work, including its tasks, milestones and details |
| `ost.projectTodos` | to-do board cards per project id, plus `general` |
| `ost.contacts` | contact list |
| `ost.gallery` | gallery items, each with `versions` (image, markup strokes, notes) |
| `ost.brand` | dashboard name, logo, theme (light/dark/system), accent color |
| `ost.overview.layout` | order and visibility of Overview sections |
| `ost.projects.layout` | Squares or Rows layout |
| `ost.todos.hideDone` | hide Done column on the to-do board |

A project looks roughly like this:

```json
{
  "id": 1, "name": "Harbor Street Mural", "client": "City Arts Council",
  "type": "client", "active": true, "color": "#E8833A", "progress": 62,
  "created": "2026-09-01", "due": "2026-11-14", "image": "/files/....jpg",
  "description": "", "amount": "", "invoice": { "name": "", "url": "" },
  "tasks": [{ "id": 1, "name": "...", "due": "2026-10-20", "status": "In progress", "priority": "High" }],
  "milestones": [{ "id": 1, "title": "Proofs", "date": "2026-10-25" }]
}
```

`type` is `"client"` (Projects screen) or `"personal"` (Personal works screen). A contact is linked to projects whose `client` equals the contact's `org`.

The quickest way to see the real shapes is to open the `.json` files in `data/<library>/state/` after using the app a bit.

### Backups

Click the logo/name at the top of the sidebar to open Dashboard settings, then Storage and backups.

- Whole library: a .zip of everything. Restoring it replaces the library (the current one is copied to `backups/` first).
- One project: a .zip with that project, its to-do cards, gallery images and its client's contacts. Restoring adds it, or replaces/copies if it already exists.

Each zip has a `manifest.json`. The zip reading/writing is hand-written in `server/zip.js` (no packages).

### Starting over

Stop the server, delete `data/ost-config.json` (and the library folder if you don't want the data), start again. The setup screen comes back.

---

## 5. File map

| File | Lines (approx.) | What's in it |
|------|-----------------|--------------|
| `server/server.js` | 460 | web server, all `/api/...` routes, library folder, backup/restore |
| `server/zip.js` | 100 | creating and reading .zip files |
| `public/index.html` | 320 | sidebar, header, and every `<dialog>` (project, contact, task, upload, review viewer, search, settings…) |
| `public/js/boot.js` | 150 | first-launch setup screen |
| `public/js/store.js` | 90 | saving/loading through the server |
| `public/js/data.js` | 170 | the list of screens (`views`) and the sample data |
| `public/js/app.js` | 2,790 | all screens and their behavior |
| `public/css/app.css` | 900 | all styles; colors are CSS variables on `:root`, dark theme under `:root[data-theme="dark"]` |
| `Dockerfile`, `docker-compose.yml`, `.env` | | container setup |

### Finding your way around `app.js`

It's one long file, organized by screen. Functions follow a pattern:

- `xxxView()` returns the HTML for a screen (`projectsView`, `tasksView`, `todoView`, `timelineView`, `contactsView`, `galleryView`, `overview`, `projectDetail`).
- `onXxxClick(e)` handles clicks on that screen (one click listener on `#view` hands clicks to these).
- `setupXxxDialog()` wires up a dialog from `index.html`; `openXxxDialog()` opens it.
- `loadXxx()` / `saveXxx()` read and write a key through `store`.

Rough order in the file: helpers and nav → Overview → Dashboard settings/theme/backups → Projects → To-do board → Project detail → Tasks → edit dialogs (task, schedule, details, quick add) → Timeline and calendar → Search → Timeline drag → Contacts → Gallery and review viewer → `route()` and startup.

To find something, search the file for the function name or for the text you see on screen (a button label, a heading). In a terminal: `grep -n "function timelineView" public/js/app.js`.

---

## 6. Working on it with the free version of Claude

The free plan at claude.ai is a normal chat: Claude can't open your files or run the app, and you have a limited number of messages before you have to wait. Claude Code (the tool that edits files directly) is not included in the free plan as of this writing; check claude.ai/pricing. So the job is to give Claude small, precise pieces and get back small, precise changes.

### The main rule: don't paste the whole project

`app.js` alone is about 136 KB. Pasting it in every chat uses up your limit fast and makes answers worse. Instead, give Claude only what the change touches.

### Recipe for one change

1. **Write down the change in one sentence.** "Add a 'Phone' column to the contacts list." One change per chat.
2. **Find the code.** Search `app.js` for the on-screen text or the screen's function (section 5). Usually you need:
   - the `xxxView()` function that draws it,
   - its `onXxxClick` handler, if it has buttons,
   - the matching `<dialog>` in `index.html`, if it has a dialog,
   - the related CSS rules in `app.css` (search for the class name).
3. **Start a new chat and paste this first message**, filled in:

   ```
   I'm working on a small self-hosted web app (plain HTML/CSS/JavaScript ES modules,
   no framework, no build step; a Node 22 server with no npm packages).
   Screens are HTML strings rendered by functions in app.js; data is saved with
   store.get(key) / store.set(key, value), which sync to JSON files on the server.

   Change I want: <one sentence>

   Here is the relevant code:
   <paste functions / HTML / CSS>

   Please:
   - Keep the same style and naming as the code I pasted.
   - Don't add libraries or frameworks.
   - Reply with only the functions or blocks that change, each complete,
     and say which file each goes in and what it replaces.
   - If you need to see another function, ask me for it by name instead of guessing.
   ```
4. **Paste the changes in, refresh, test.** Click through the screen you changed and one or two neighbors.
5. **If it breaks**, open the browser console (F12 → Console), copy the red error, and send it back in the same chat with the function it points to.
6. **Save a working copy** before the next change (see "Keep a safety net").

### Tips that save messages

- Ask for **complete replacement functions**, not "add this after line 340". Line numbers drift and you can't see Claude's numbering.
- If a chat gets long or Claude starts going in circles, start a new chat with the latest version of the code. A fresh chat with the right 100 lines beats a long one with stale code.
- For anything that changes saved data (new fields on projects, a new key), say so up front and include an example of the current JSON from `data/<library>/state/`. Ask Claude to handle old saved data that doesn't have the new field yet.
- For a new screen, paste `views` from `data.js`, the `route()` function, and one existing simple screen (e.g. `contactsView` + `onContactsClick`) as the model to copy.
- For a server change, paste the `handle()` function from `server.js` plus whatever helper it calls.
- Uploading files to the chat also works, but a single small file or a pasted excerpt costs much less than all of `app.js`.
- Keep a short `NOTES.md` of what you changed and why. Paste its relevant lines into new chats so Claude has context you'd otherwise retype.

### Keep a safety net

Use git, even just locally (free, built into VS Code):

```sh
git init
git add -A
git commit -m "Starting point"
# after each change that works:
git add -A
git commit -m "Contacts: add phone column"
# to throw away a change that broke things:
git checkout -- .
```

Add a `.gitignore` with `data/` in it so your personal data isn't committed. If you don't want git, copy the folder before each change.

---

## 7. Common changes and where they live

| Change | Where to look |
|--------|---------------|
| Colors, spacing, fonts | `public/css/app.css` (`:root` variables at the top; dark theme under `:root[data-theme="dark"]` further down) |
| Change the font | `@font-face` rules at the top of `app.css` and the files in `public/fonts/`; replace with a free font (e.g. Inter) |
| Add or rename a sidebar item | `views` in `public/js/data.js`, then `screens` inside `route()` in `app.js` |
| Add a field to projects | `ost.projects` shape (section 4), `openDetailsDialog` / `setupDetailsDialog` in `app.js`, `#details-dialog` in `index.html`, `projectDetail()` to show it |
| Change the sample data | `public/js/data.js` (only used when starting with sample projects) |
| Add a contact field | `#contact-dialog` in `index.html`, `setupContactDialog` and `contactDetail` in `app.js` |
| Gallery / review tool | `galleryView`, `setupGalleryDialogs`, `paintReview`, `setupReview` in `app.js`; `#upload-dialog` and `#lightbox` in `index.html` |
| New API route | `handle()` in `server/server.js` |
| Change the port | `docker-compose.yml` (`ports`) or the `PORT` environment variable |

---

## 8. Known gaps (as of 2026-10-18)

- No login; see section 1.
- Images deleted in the app stay in `files/` (no cleanup yet). Backups only include images still in use.
- Gallery images are resized to 2400px on upload; originals aren't kept.
- No separate Settings screen or onboarding tour; settings are in the Dashboard settings dialog (click the sidebar logo).
- Everything is in one big `app.js`. Splitting it into a file per screen would make working with the free Claude plan easier, but it's a bigger job; do it as its own change if at all.
- No automated tests.
