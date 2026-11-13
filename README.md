# Nishant's Eyes and Ears (NEE)

A personal field-capture web app for market visits. It installs to the iPhone Home Screen, works with no signal, and keeps all data on the device until you export it.

## Install

**iPhone:** open the app address in **Safari** → **Share** → **Add to Home Screen** → **Add**. Always open it from the new icon. Allow microphone and camera when asked.

**Laptop:** open the same address in Edge or Chrome → click **Install app** in the address bar.

## Daily use

1. **+ New visit** → choose the type → **Create**. The visit gets an ID such as `AFC-ZAF-20261117-HV01`.
2. Dictate into the big text box with the Wispr Flow keyboard or iOS dictation. Use **Record**, **Photo** and **Video** at the bottom of the screen.
3. Every evening: **Export day** → **Share…** → the Claude app (type `PACKAGE`) and a backup copy to Files or OneDrive.
4. On the laptop: **Settings → Import .zip**.

## Limits to know

- Recording stops if the screen locks or you switch apps. Keep the screen on.
- Data lives on the phone until exported. Export every evening.
- Open from the Home Screen icon, not a Safari tab, or storage may not be kept.
- No automatic phone-to-laptop sync. Transfer is export, then import.

## Privacy

No accounts, no server, no location, no analytics, no third-party scripts (JSZip is stored in `vendor/`). Nothing leaves the device except through your own export.

## Package format (NEE-v1)

- **Export visit** → `<visit_id>.zip` containing `visit.json`, `visit.md` and the media files.
- **Export day** → `AFC-<COUNTRY>-<YYYYMMDD>_DAY.zip` with one folder per visit, each holding the same three kinds of file.

## Releasing a change

No build step. Edit the files, raise `CACHE_VERSION` in `sw.js` and `APP_VERSION` in `app.js`, add a line to `CHANGELOG.md`, and push. On the phone, close and reopen the app, then tap **Update available**.

To run locally: `python -m http.server 8000`, then open `http://localhost:8000/`.
