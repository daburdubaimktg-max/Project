# CLAUDE.md — Nishant's Eyes and Ears (NEE)

## Role
You are the lead engineer for NEE, a personal field-capture Progressive Web App for
Nishant Sukumaran (Head of Marketing, Dabur International). A Dabur digital team member
is supervising the build. Explain each step in plain language, one short paragraph.
Ask before anything paid, irreversible, or that sends data off the device.

## Product
One web app, hosted on GitHub Pages, installed on iPhone via Safari > Share > Add to
Home Screen, and on a Windows laptop via Edge/Chrome "Install app". Personal use. No App
Store, no Mac, no accounts, no backend, no server code.

## Users and conditions
One user, walking through shops, salons and homes in Africa: one hand, poor or no signal,
bright sun, low battery. Every capture action is one tap. Fully offline after first load.

## v1 features
1. Visits: type (MV, HV, TR, SL, IN, MT, TH), country (default ZAF; also NGA, GHA, KEN, EGY,
   editable list), city, suburb, outlet type (spaza, informal/hawker, salon, pharmacy chain,
   independent pharmacy, supermarket chain, discounter, wholesaler/cash & carry, beauty
   store, home, office, other), who (role / first name only), consent stated (yes/no).
   Auto ID: AFC-[COUNTRY]-[YYYYMMDD]-[TYPE][NN], NN numbered per day per country across
   all types. Date from device clock at creation. Editing the date requires a reason,
   stored with the visit.
2. In a visit: large text area for dictation (the user dictates with the Wispr Flow
   keyboard or iOS dictation; do NOT build speech recognition in v1); audio recording
   (MediaRecorder; show elapsed time and a "keep screen on" hint; use the Screen Wake Lock
   API where supported); photos and videos (input type=file with capture); typed notes;
   checklist. Media IDs: visit ID + -A1/-P1/-V1, numbered per visit.
3. Keep layer: home list of visits newest first, grouped by date; pin; colour; labels;
   full-text search across text and notes; filter by type, country, label.
4. Offline: service worker caches all app files. Data in IndexedDB. Call
   navigator.storage.persist(); show a banner if not granted. Show storage used.
5. Export: "Export visit" and "Export day" produce a .zip named by ID or
   AFC-[COUNTRY]-[YYYYMMDD]_DAY, containing visit.json, visit.md and media files.
   Share with navigator.share({files}); fallback to download.
6. Import: accept a .zip on any device; skip duplicates by visit_id; never overwrite.
7. Daily export reminder: banner after 18:00 local time if today's visits are not exported.
8. Recently deleted: 30-day bin, restore, confirm before permanent delete.

## Data rules (non-negotiable)
- Store user text exactly as entered. No auto-correct, trimming of words, or rewriting.
- Never alter media. Never compress originals.
- No location capture. No analytics. No third-party scripts except JSZip (vendored
  locally in the repo, not loaded from a CDN, so offline works).
- Audio/video with consent = no → visible warning badge on the visit.
- No fields for surnames, phone numbers, addresses or ID numbers.

## Package schema NEE-v1 (visit.json)
visit_id, schema_version "NEE-v1", app_version, country, city, suburb, date (YYYY-MM-DD),
start_time, end_time, visit_type, outlet_type, who_role, consent_stated, date_edit_reason,
labels[], pinned, colour, text_raw, typed_notes, checklist[{text, done}],
media[{id, kind: audio|photo|video, filename, mime, captured_at, duration_s}].

visit.md format:
  SRC:PACKAGE NEE-v1 <visit_id>
  Type / Country / City / Suburb / Outlet / Who / Consent / Date / Times
  ## Raw text (verbatim)
  <text_raw exactly>
  ## Notes
  <typed_notes>
  ## Checklist
  ## Media
  <id — kind — filename — captured_at>

## Tech
Plain HTML, CSS, JavaScript. No build step, no framework, no npm needed to deploy.
Files at repo root: index.html, app.js, db.js, export.js, styles.css, sw.js,
manifest.webmanifest, icons/, vendor/jszip.min.js, README.md, BACKLOG.md, CHANGELOG.md.
manifest: name "Nishant's Eyes and Ears", short_name "Eyes & Ears", display standalone,
start_url and scope "./" (GitHub Pages subpath safe). Apple touch icon and status bar meta.
Mobile-first, large targets (min 48px), high contrast, dark mode, iPhone safe areas.
Bump a CACHE_VERSION constant in sw.js on every release; show "Update available — tap to
reload" when a new version is waiting.

## Working method
- Plan first: list files and the deploy steps; wait for approval.
- Build v1 in one pass, then run it locally (localhost) for laptop testing.
- Commit with clear messages; push only when the builder says "push".
- After every change, report 5 lines: what changed, how to test on iPhone, known gaps.
- Keep BACKLOG.md: Nishant's feedback arrives as lines starting #APP; add each with
  date, priority (P1/P2/P3) and a one-line proposed fix. Do not build backlog items
  without approval.
- Never invent requirements. Ask one question at a time, with a recommended default.
