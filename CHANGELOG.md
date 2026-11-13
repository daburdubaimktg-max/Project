# Changelog

## 1.5.0 — 2026-11-13

- Add a country by name: the Country list in New visit ends with "Add another country…", which opens a searchable list of African, Middle Eastern and South Asian countries (or type any 3-letter code). The same picker is in Settings.
- The category tile in New visit now reads "Add your own category".
- The app version is shown at the bottom of the Visits list.

## 1.4.1 — 2026-11-13

- Photo, Record and Video stay visible while typing, lifted to sit just above the keyboard. The Visits/Summary tabs and New visit button still step aside while the keyboard is up.

## 1.4.0 — 2026-11-13

Fixes from a 15-tester audit (simulated testers in a test browser, not real iPhones).

Data safety
- Saves now change only the fields that were edited, so typing can no longer erase a photo, video or recording that is being saved, and a second open copy of the app can no longer wipe media.
- A photo, video or recording always lands in the visit it was captured in.
- A failed save is retried; text typed just before the app closes is recovered on next open.
- Recordings are written to the phone as they are made and recovered if the app is closed mid-recording. Double taps on Record or Stop are safe.
- If a photo, video or recording cannot be stored, it is held with Try again / Share / Discard instead of being dropped.
- "Copy text for Claude" no longer marks a visit as exported; only sharing or saving the .zip does.
- Updating the app stops and saves a running recording first.

Import
- Imported files are validated: no script can run, and no other visit's media can be overwritten. Clear messages for duplicates that differ, missing media and unreadable files.
- Media is stored without loading whole files into memory.

Everyday use
- Recording timer and Stop are always visible in the header; the page no longer jumps when recording starts.
- Messages appear below the header and never block taps. Add buttons work on the first tap.
- Search ignores accents and finds by date and country; "Clear search and filters"; every day keeps its Export day button; pinned cards show their date.
- Categories keep the name a visit was created with; codes cannot be silently reused; removal asks first.
- Summary: refreshes on a new day, lists in date order, by-country breakdown, seconds for short audio, copy button at the top.
- Photo viewer opens full screen with zoom. Empty files are refused. Checklist items wrap.
- Stronger outlines for sunlight, proper dialogs for keyboard and screen-reader use, larger tap targets, plain-language export sheet.
- The reminder also covers unexported visits from earlier days. End time only follows capture, not later edits.

Package changes: `Labels:` in visit.md are separated by ` | `; a `WARNING:` line is added when audio or video exists with consent = no.

## 1.3.0 — 2026-11-13

- Written summary inside each visit ("Visit summary"). It shows on the visit card, is searchable, appears on the Summary tab, and is exported as `summary` in visit.json and a `## Summary` section in visit.md (only when filled in).

## 1.2.0 — 2026-11-13

- Custom visit categories: add your own (name + 2-letter code) from New visit or Settings; the seven built-in ones stay.
- Summary tab: visits, media, categories, places, labels, open to-dos and export status for today, this week, this month or all time.
- Send to Claude Project: copy the package text (with the PACKAGE command) or the summary, then open the project from a saved link.
- Package change: visits in a custom category carry `visit_type_name` in visit.json and show as `Type: CS (Name)` in visit.md.

## 1.1.0 — 2026-11-13

Clearer flow, same data and features. Visit cards are titled by visit type and place, with the ID underneath. The visit screen shows a title, place, saved status and the text box first; photos and videos appear as a grid that opens full size; export, details, date change and delete moved into a ··· menu. One-tap type filters, Today / Yesterday headings, a guided empty state, and outlet type pre-filled for home and salon visits.

## 1.0.2 — 2026-11-13

Stability on iPhone: bottom bars hide while the keyboard is up and a tap on empty space dismisses it; text boxes grow with their content; no double-tap or focus zoom; content no longer scrolls under the status bar; the page behind an open sheet is locked; media list no longer flickers when items are added; the visit list keeps its scroll position; quick taps can no longer mix two screens.

## 1.0.1 — 2026-11-13

Visual refresh: warmer notebook look, icons, softer cards tinted by colour, clearer capture bar. No change to data or features.

## 1.0.0 — 2026-11-13

First version: visits with auto IDs, dictation text box, audio recording, photos, videos, notes, checklist, labels, pin, colour, search and filters, offline use, export visit / export day as .zip, import, evening export reminder, 30-day bin.
