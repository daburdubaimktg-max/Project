'use strict';
/* NEE package export / import (schema NEE-v1). Media files are copied as stored, never re-encoded. */

const Exporter = (() => {
  const COLOURS = ['', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];
  const needsWarning = v => v.consent_stated !== 'yes' && v.media.some(m => !m.deleted_at && (m.kind === 'audio' || m.kind === 'video'));
  const byTime = (a, b) => a.date.localeCompare(b.date) || (a.created_at || '').localeCompare(b.created_at || '') || a.visit_id.localeCompare(b.visit_id);

  function toJson(v) {
    const j = {
      visit_id: v.visit_id, schema_version: 'NEE-v1', app_version: v.app_version,
      country: v.country, city: v.city, suburb: v.suburb, date: v.date,
      start_time: v.start_time, end_time: v.end_time,
      visit_type: v.visit_type, outlet_type: v.outlet_type, who_role: v.who_role,
      consent_stated: v.consent_stated, date_edit_reason: v.date_edit_reason,
      labels: v.labels, pinned: !!v.pinned, colour: v.colour,
      summary: v.summary || '', text_raw: v.text_raw, typed_notes: v.typed_notes,
      checklist: v.checklist.map(c => ({ text: c.text, done: !!c.done })),
      media: v.media.filter(m => !m.deleted_at).map(m => ({
        id: m.id, kind: m.kind, filename: m.filename, mime: m.mime,
        captured_at: m.captured_at, duration_s: m.duration_s,
      })),
    };
    if (v.visit_type_name) j.visit_type_name = v.visit_type_name;   // only for categories the user added
    return j;
  }

  function toMd(v) {
    const j = toJson(v);
    const lines = [
      `SRC:PACKAGE NEE-v1 ${j.visit_id}`,
      `Type: ${j.visit_type}${j.visit_type_name ? ` (${j.visit_type_name})` : ''}`, `Country: ${j.country}`, `City: ${j.city}`, `Suburb: ${j.suburb}`,
      `Outlet: ${j.outlet_type}`, `Who: ${j.who_role}`, `Consent: ${j.consent_stated}`,
      `Date: ${j.date}`, `Times: ${j.start_time}–${j.end_time}`,
    ];
    if (needsWarning(v)) lines.push('WARNING: audio or video was captured with consent = no');
    if (j.date_edit_reason) lines.push(`Date edit reason: ${j.date_edit_reason}`);
    if (j.labels.length) lines.push(`Labels: ${j.labels.join(' | ')}`);
    if (j.summary) lines.push('', '## Summary', j.summary);
    lines.push('', '## Raw text (verbatim)', j.text_raw, '', '## Notes', j.typed_notes, '', '## Checklist');
    for (const c of j.checklist) lines.push(`- [${c.done ? 'x' : ' '}] ${c.text}`);
    lines.push('', '## Media');
    for (const m of j.media) lines.push(`${m.id} — ${m.kind} — ${m.filename} — ${m.captured_at}`);
    return lines.join('\n') + '\n';
  }

  // Returns how many media files listed for the visit could not be found on this device.
  async function addVisit(folder, v) {
    const j = toJson(v);
    let missing = 0;
    folder.file('visit.json', JSON.stringify(j, null, 2));
    folder.file('visit.md', toMd(v));
    for (const m of j.media) {
      const blob = await DB.getBlob(m.id);
      if (blob) folder.file(m.filename, blob, { binary: true }); else missing++;
    }
    return missing;
  }

  const build = async (zip, name) =>
    new File([await zip.generateAsync({ type: 'blob', compression: 'STORE' })], name, { type: 'application/zip' });

  async function visitZip(v) {
    const zip = new JSZip();
    const missing = await addVisit(zip, v);
    return { files: [await build(zip, `${v.visit_id}.zip`)], ids: [v.visit_id], text: toMd(v), missing };
  }

  // One package per country for the day, each visit in its own folder, in the order the visits were made.
  async function dayZips(date) {
    const visits = (await DB.getVisits()).filter(v => !v.deleted_at && v.date === date).sort(byTime);
    const byCountry = {};
    for (const v of visits) (byCountry[v.country] = byCountry[v.country] || []).push(v);
    const files = [];
    let missing = 0;
    for (const c of Object.keys(byCountry).sort()) {
      const zip = new JSZip();
      for (const v of byCountry[c]) missing += await addVisit(zip.folder(v.visit_id), v);
      files.push(await build(zip, `AFC-${c}-${date.replace(/-/g, '')}_DAY.zip`));
    }
    return { files, ids: visits.map(v => v.visit_id), text: visits.map(toMd).join('\n---\n\n'), missing };
  }

  const str = x => (typeof x === 'string' ? x : '');
  const same = (a, j) => ['text_raw', 'typed_notes', 'summary', 'city', 'suburb', 'who_role', 'consent_stated'].every(k => (a[k] || '') === str(j[k])) &&
    a.media.filter(m => !m.deleted_at).length === (Array.isArray(j.media) ? j.media.length : 0);

  // Everything read from a package is checked before it is stored: IDs, dates, colours and media
  // must be well-formed and must belong to the visit they claim to belong to.
  async function importZip(file) {
    const zip = await JSZip.loadAsync(file);
    const entries = Object.keys(zip.files).filter(n => /(^|\/)visit\.json$/.test(n) && !n.startsWith('__MACOSX'));
    const res = { added: [], skipped: [], differs: [], invalid: 0, missingMedia: 0, typeNames: {}, found: entries.length };
    for (const name of entries) {
      let j;
      try { j = JSON.parse(await zip.file(name).async('string')); } catch (e) { res.invalid++; continue; }
      const idm = j && typeof j.visit_id === 'string' && U.ID_RE.exec(j.visit_id);
      if (!idm || j.schema_version !== 'NEE-v1') { res.invalid++; continue; }
      // Already on this device (including in the bin): never overwrite, and do not load its media.
      const existing = await DB.getVisit(j.visit_id);
      if (existing) { res.skipped.push(j.visit_id); if (!same(existing, j)) res.differs.push(j.visit_id); continue; }

      const dir = name.slice(0, name.length - 'visit.json'.length);
      const now = U.iso();
      const seq = { A: 0, P: 0, V: 0 };
      const media = [], blobs = [], seen = new Set();
      for (const m of Array.isArray(j.media) ? j.media : []) {
        const mm = m && typeof m.id === 'string' && /^(.+)-([APV])(\d+)$/.exec(m.id);
        if (!mm || mm[1] !== j.visit_id || U.KIND_LETTER[m.kind] !== mm[2] || seen.has(m.id)) continue;
        seen.add(m.id);
        const f = typeof m.filename === 'string' && !m.filename.includes('/') && !m.filename.includes('\\') ? zip.file(dir + m.filename) : null;
        if (!f) { res.missingMedia++; continue; }
        const ext = (/\.([A-Za-z0-9]{1,5})$/.exec(m.filename) || [])[1] || 'bin';
        const mime = /^[\w.+-]+\/[\w.+-]+$/.test(str(m.mime)) ? m.mime : 'application/octet-stream';
        blobs.push({ id: m.id, mime, blob: new Blob([await f.async('blob')], { type: mime }) });
        media.push({ id: m.id, kind: m.kind, filename: `${m.id}.${ext.toLowerCase()}`, mime,
          captured_at: str(m.captured_at), duration_s: typeof m.duration_s === 'number' ? m.duration_s : null, deleted_at: null });
        seq[mm[2]] = Math.max(seq[mm[2]], +mm[3]);
      }
      const idDate = `${idm[2].slice(0, 4)}-${idm[2].slice(4, 6)}-${idm[2].slice(6, 8)}`;
      const time = x => (/^\d{2}:\d{2}$/.test(str(x)) ? x : '');
      const typeName = str(j.visit_type_name).replace(/\s+/g, ' ').trim().slice(0, 30);
      const v = {
        visit_id: j.visit_id, schema_version: 'NEE-v1', app_version: str(j.app_version),
        country: idm[1], city: str(j.city), suburb: str(j.suburb),
        date: /^\d{4}-\d{2}-\d{2}$/.test(str(j.date)) ? j.date : idDate,
        start_time: time(j.start_time), end_time: time(j.end_time),
        visit_type: idm[3], visit_type_name: typeName, outlet_type: str(j.outlet_type), who_role: str(j.who_role),
        consent_stated: j.consent_stated === 'yes' ? 'yes' : 'no', date_edit_reason: str(j.date_edit_reason),
        labels: Array.isArray(j.labels) ? j.labels.filter(l => typeof l === 'string' && l) : [],
        pinned: !!j.pinned, colour: COLOURS.includes(j.colour) ? j.colour : '',
        summary: str(j.summary), text_raw: str(j.text_raw), typed_notes: str(j.typed_notes),
        checklist: (Array.isArray(j.checklist) ? j.checklist : []).map(c => ({ text: str(c && c.text), done: !!(c && c.done) })),
        media, created_at: now, updated_at: now, exported_at: now, imported_at: now, deleted_at: null, media_seq: seq,
      };
      if (await DB.importVisit(v, blobs)) {
        res.added.push(v.visit_id);
        if (typeName) res.typeNames[v.visit_type] = typeName;
      } else res.skipped.push(v.visit_id);
    }
    return res;
  }

  return { toJson, toMd, visitZip, dayZips, importZip };
})();
