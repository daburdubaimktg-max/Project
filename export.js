'use strict';
/* NEE package export / import (schema NEE-v1). Media bytes are copied as stored, never re-encoded. */

const Exporter = (() => {
  function toJson(v) {
    return {
      visit_id: v.visit_id, schema_version: 'NEE-v1', app_version: v.app_version,
      country: v.country, city: v.city, suburb: v.suburb, date: v.date,
      start_time: v.start_time, end_time: v.end_time,
      visit_type: v.visit_type, outlet_type: v.outlet_type, who_role: v.who_role,
      consent_stated: v.consent_stated, date_edit_reason: v.date_edit_reason,
      labels: v.labels, pinned: !!v.pinned, colour: v.colour,
      text_raw: v.text_raw, typed_notes: v.typed_notes,
      checklist: v.checklist.map(c => ({ text: c.text, done: !!c.done })),
      media: v.media.filter(m => !m.deleted_at).map(m => ({
        id: m.id, kind: m.kind, filename: m.filename, mime: m.mime,
        captured_at: m.captured_at, duration_s: m.duration_s,
      })),
    };
  }

  function toMd(v) {
    const j = toJson(v);
    const lines = [
      `SRC:PACKAGE NEE-v1 ${j.visit_id}`,
      `Type: ${j.visit_type}`, `Country: ${j.country}`, `City: ${j.city}`, `Suburb: ${j.suburb}`,
      `Outlet: ${j.outlet_type}`, `Who: ${j.who_role}`, `Consent: ${j.consent_stated}`,
      `Date: ${j.date}`, `Times: ${j.start_time}–${j.end_time}`,
    ];
    if (j.date_edit_reason) lines.push(`Date edit reason: ${j.date_edit_reason}`);
    if (j.labels.length) lines.push(`Labels: ${j.labels.join(', ')}`);
    lines.push('', '## Raw text (verbatim)', j.text_raw, '', '## Notes', j.typed_notes, '', '## Checklist');
    for (const c of j.checklist) lines.push(`- [${c.done ? 'x' : ' '}] ${c.text}`);
    lines.push('', '## Media');
    for (const m of j.media) lines.push(`${m.id} — ${m.kind} — ${m.filename} — ${m.captured_at}`);
    return lines.join('\n') + '\n';
  }

  async function addVisit(folder, v) {
    const j = toJson(v);
    folder.file('visit.json', JSON.stringify(j, null, 2));
    folder.file('visit.md', toMd(v));
    for (const m of j.media) {
      const bytes = await DB.getBytes(m.id);
      if (bytes) folder.file(m.filename, bytes, { binary: true });
    }
  }

  const build = async (zip, name) =>
    new File([await zip.generateAsync({ type: 'blob', compression: 'STORE' })], name, { type: 'application/zip' });

  async function visitZip(v) {
    const zip = new JSZip();
    await addVisit(zip, v);
    return { files: [await build(zip, `${v.visit_id}.zip`)], ids: [v.visit_id] };
  }

  // One package per country for the day, each visit in its own folder.
  async function dayZips(date) {
    const visits = (await DB.getVisits()).filter(v => !v.deleted_at && v.date === date)
      .sort((a, b) => a.visit_id.localeCompare(b.visit_id));
    const byCountry = {};
    for (const v of visits) (byCountry[v.country] = byCountry[v.country] || []).push(v);
    const files = [];
    for (const c of Object.keys(byCountry).sort()) {
      const zip = new JSZip();
      for (const v of byCountry[c]) await addVisit(zip.folder(v.visit_id), v);
      files.push(await build(zip, `AFC-${c}-${date.replace(/-/g, '')}_DAY.zip`));
    }
    return { files, ids: visits.map(v => v.visit_id) };
  }

  const str = x => (typeof x === 'string' ? x : '');

  async function importZip(file) {
    const zip = await JSZip.loadAsync(file);
    const entries = Object.keys(zip.files).filter(n => /(^|\/)visit\.json$/.test(n) && !n.startsWith('__MACOSX'));
    const res = { added: [], skipped: [], invalid: 0 };
    for (const name of entries) {
      let j;
      try { j = JSON.parse(await zip.file(name).async('string')); } catch (e) { res.invalid++; continue; }
      if (!j || typeof j.visit_id !== 'string' || !U.ID_RE.test(j.visit_id) || j.schema_version !== 'NEE-v1') { res.invalid++; continue; }
      const dir = name.slice(0, name.length - 'visit.json'.length);
      const now = U.iso();
      const seq = { A: 0, P: 0, V: 0 };
      const media = [], blobs = [];
      for (const m of Array.isArray(j.media) ? j.media : []) {
        if (!m || typeof m.id !== 'string' || !U.KIND_LETTER[m.kind]) continue;
        const f = zip.file(dir + m.filename);
        if (!f) continue;
        const mime = str(m.mime) || 'application/octet-stream';
        blobs.push({ id: m.id, data: await f.async('arraybuffer'), mime });
        media.push({ id: m.id, kind: m.kind, filename: str(m.filename), mime,
          captured_at: str(m.captured_at), duration_s: typeof m.duration_s === 'number' ? m.duration_s : null, deleted_at: null });
        const n = /-([APV])(\d+)$/.exec(m.id);
        if (n) seq[n[1]] = Math.max(seq[n[1]], +n[2]);
      }
      const v = {
        visit_id: j.visit_id, schema_version: 'NEE-v1', app_version: str(j.app_version),
        country: str(j.country), city: str(j.city), suburb: str(j.suburb), date: str(j.date),
        start_time: str(j.start_time), end_time: str(j.end_time),
        visit_type: str(j.visit_type), outlet_type: str(j.outlet_type), who_role: str(j.who_role),
        consent_stated: j.consent_stated === 'yes' ? 'yes' : 'no', date_edit_reason: str(j.date_edit_reason),
        labels: Array.isArray(j.labels) ? j.labels.filter(l => typeof l === 'string') : [],
        pinned: !!j.pinned, colour: str(j.colour),
        text_raw: str(j.text_raw), typed_notes: str(j.typed_notes),
        checklist: (Array.isArray(j.checklist) ? j.checklist : []).map(c => ({ text: str(c && c.text), done: !!(c && c.done) })),
        media, created_at: now, updated_at: now, exported_at: now, imported_at: now, deleted_at: null, media_seq: seq,
      };
      (await DB.importVisit(v, blobs) ? res.added : res.skipped).push(v.visit_id);
    }
    return res;
  }

  return { toJson, toMd, visitZip, dayZips, importZip };
})();
