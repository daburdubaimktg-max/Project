'use strict';
/* NEE storage layer. Everything lives in IndexedDB on this device.
   Stores: visits (records + media metadata), blobs (original media, untouched), meta (settings, counters),
   rec (audio being recorded, written as it arrives so an interruption keeps what was captured). */

const U = {
  pad: (n, l = 2) => String(n).padStart(l, '0'),
  ymd(d = new Date()) { return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`; },
  hm(d = new Date()) { return `${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`; },
  iso(d = new Date()) {
    const o = -d.getTimezoneOffset(), a = Math.abs(o);
    return `${U.ymd(d)}T${U.hm(d)}:${U.pad(d.getSeconds())}${o >= 0 ? '+' : '-'}${U.pad(Math.floor(a / 60))}:${U.pad(a % 60)}`;
  },
  ID_RE: /^AFC-([A-Z]{3})-(\d{8})-([A-Z]{2})(\d+)$/,
  KIND_LETTER: { audio: 'A', photo: 'P', video: 'V' },
  BIN_DAYS: 30,
};

const DB = (() => {
  const NAME = 'nee-db', VER = 2;
  let dbp = null;

  function open() {
    if (!dbp) {
      dbp = new Promise((res, rej) => {
        const r = indexedDB.open(NAME, VER);
        r.onupgradeneeded = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains('visits')) d.createObjectStore('visits', { keyPath: 'visit_id' });
          if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
          if (!d.objectStoreNames.contains('rec')) d.createObjectStore('rec', { keyPath: 'k' });
        };
        r.onsuccess = () => {
          // If another tab upgrades the database, let go so it is not blocked.
          r.result.onversionchange = () => { r.result.close(); dbp = null; };
          res(r.result);
        };
        r.onerror = () => { dbp = null; rej(r.error); };
      });
    }
    return dbp;
  }

  // Run fn(transaction, setResult) and resolve once the transaction has fully committed.
  async function run(stores, mode, fn) {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(stores, mode);
      let out;
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('Storage transaction aborted'));
      try { fn(t, v => { out = v; }); } catch (e) { try { t.abort(); } catch (_) { /* already closed */ } rej(e); }
    });
  }

  // end_time follows capture: it moves only for dictation and new media, on the visit's own day,
  // and only while the visit is still going (within 3 hours of the last capture).
  function touch(v, capture) {
    const now = new Date();
    v.updated_at = U.iso(now);
    if (!capture || U.ymd(now) !== v.date) return;
    const [h, m] = (v.end_time || v.start_time || '00:00').split(':').map(Number);
    const mins = now.getHours() * 60 + now.getMinutes() - (h * 60 + m);
    if (mins >= 0 && mins <= 180) v.end_time = U.hm(now);
  }

  const getVisits = () => run(['visits'], 'readonly', (t, set) => {
    const r = t.objectStore('visits').getAll(); r.onsuccess = () => set(r.result);
  });

  const getVisit = id => run(['visits'], 'readonly', (t, set) => {
    const r = t.objectStore('visits').get(id); r.onsuccess = () => set(r.result || null);
  });

  // Whole-record write. Used for import and seeding only; the app edits through patchVisit.
  function putVisit(v, bump = true) {
    if (bump) touch(v, true);
    return run(['visits'], 'readwrite', t => { t.objectStore('visits').put(v); });
  }

  // Change only the named fields, inside one transaction, on top of whatever is stored now.
  // The media list and counters are never taken from the caller, so a stale screen cannot erase captured media.
  // patch.media_deleted = { mediaId: isoStamp | null } marks or restores single media items.
  function patchVisit(id, patch, bump = true) {
    return run(['visits'], 'readwrite', (t, set) => {
      const vs = t.objectStore('visits'), r = vs.get(id);
      r.onsuccess = () => {
        const v = r.result;
        if (!v) { set(null); return; }
        for (const k of Object.keys(patch)) {
          if (k === 'media_deleted') {
            for (const m of v.media) if (m.id in patch.media_deleted) m.deleted_at = patch.media_deleted[m.id];
          } else if (k !== 'media' && k !== 'media_seq' && k !== 'visit_id') v[k] = patch[k];
        }
        if (bump) touch(v, 'text_raw' in patch);
        vs.put(v);
        set(v);
      };
    });
  }

  // New visit. NN is numbered per day per country across all types and is never reused.
  function createVisit(f, appVersion) {
    const now = new Date(), date = U.ymd(now), compact = date.replace(/-/g, '');
    const key = `seq:${f.country}:${compact}`, prefix = `AFC-${f.country}-${compact}-`;
    return run(['visits', 'meta'], 'readwrite', (t, set) => {
      const vs = t.objectStore('visits'), ms = t.objectStore('meta');
      const r1 = ms.get(key);
      r1.onsuccess = () => {
        let n = r1.result ? r1.result.value : 0;
        const r2 = vs.getAllKeys();
        r2.onsuccess = () => {
          for (const k of r2.result) {
            if (k.startsWith(prefix)) { const m = /(\d+)$/.exec(k); if (m) n = Math.max(n, +m[1]); }
          }
          n += 1;
          const visit = {
            visit_id: `${prefix}${f.visit_type}${U.pad(n)}`,
            schema_version: 'NEE-v1', app_version: appVersion,
            country: f.country, city: f.city || '', suburb: f.suburb || '',
            date, start_time: U.hm(now), end_time: U.hm(now),
            visit_type: f.visit_type, visit_type_name: f.visit_type_name || '', outlet_type: f.outlet_type || '',
            who_role: f.who_role || '', consent_stated: f.consent_stated === 'yes' ? 'yes' : 'no',
            date_edit_reason: '', labels: [], pinned: false, colour: '',
            summary: '', text_raw: '', typed_notes: '', checklist: [], media: [],
            created_at: U.iso(now), updated_at: U.iso(now),
            exported_at: null, imported_at: null, deleted_at: null,
            media_seq: { A: 0, P: 0, V: 0 },
          };
          vs.add(visit);
          ms.put({ key, value: n });
          set(visit);
        };
      };
    });
  }

  // Stores the original file untouched (as a Blob, so large videos are not copied into memory)
  // and returns the updated visit record. Falls back to raw bytes if this browser cannot store Blobs.
  async function addMedia(visitId, kind, blob, ext, durationS) {
    const mime = (blob.type || '').split(';')[0] || 'application/octet-stream';
    const write = payload => run(['visits', 'blobs'], 'readwrite', (t, set) => {
      const vs = t.objectStore('visits');
      const r = vs.get(visitId);
      r.onsuccess = () => {
        const v = r.result;
        if (!v) throw new Error('Visit not found');
        const L = U.KIND_LETTER[kind];
        v.media_seq = v.media_seq || { A: 0, P: 0, V: 0 };
        v.media_seq[L] = (v.media_seq[L] || 0) + 1;
        const id = `${v.visit_id}-${L}${v.media_seq[L]}`;
        v.media.push({
          id, kind, filename: `${id}.${ext}`, mime,
          captured_at: U.iso(), duration_s: durationS == null ? null : durationS, deleted_at: null,
        });
        touch(v, true);
        vs.put(v);
        t.objectStore('blobs').put({ id, mime, ...payload });
        set(v);
      };
    });
    try { return await write({ blob }); }
    catch (e) {
      if (e && (e.name === 'DataCloneError' || e.name === 'UnknownError')) return write({ data: await blob.arrayBuffer() });
      throw e;
    }
  }

  const getBlob = id => run(['blobs'], 'readonly', (t, set) => {
    const r = t.objectStore('blobs').get(id);
    r.onsuccess = () => {
      const x = r.result;
      set(!x ? null : x.blob ? (x.blob.type ? x.blob : x.blob.slice(0, x.blob.size, x.mime)) : new Blob([x.data], { type: x.mime }));
    };
  });

  function deleteVisitForever(id) {
    return run(['visits', 'blobs'], 'readwrite', t => {
      const vs = t.objectStore('visits'), r = vs.get(id);
      r.onsuccess = () => {
        const v = r.result; if (!v) return;
        for (const m of v.media) t.objectStore('blobs').delete(m.id);
        vs.delete(id);
      };
    });
  }

  function deleteMediaForever(visitId, mediaId) {
    return run(['visits', 'blobs'], 'readwrite', t => {
      const vs = t.objectStore('visits'), r = vs.get(visitId);
      r.onsuccess = () => {
        const v = r.result; if (!v) return;
        v.media = v.media.filter(m => m.id !== mediaId);
        vs.put(v);
        t.objectStore('blobs').delete(mediaId);
      };
    });
  }

  // Import never overwrites: returns false when the visit_id is already on this device.
  // Only media whose ids belong to this visit are written, so no other visit's file can be replaced.
  function importVisit(v, blobs) {
    const m = U.ID_RE.exec(v.visit_id);
    return run(['visits', 'blobs', 'meta'], 'readwrite', (t, set) => {
      const vs = t.objectStore('visits');
      const r = vs.get(v.visit_id);
      r.onsuccess = () => {
        if (r.result) { set(false); return; }
        vs.add(v);
        for (const b of blobs) if (b.id.startsWith(`${v.visit_id}-`)) t.objectStore('blobs').put(b);
        if (m) {
          const ms = t.objectStore('meta'), key = `seq:${m[1]}:${m[2]}`, r2 = ms.get(key);
          r2.onsuccess = () => {
            const n = Math.max(r2.result ? r2.result.value : 0, +m[4]);
            ms.put({ key, value: n });
          };
        }
        set(true);
      };
    });
  }

  function markExported(ids) {
    const stamp = U.iso();
    return run(['visits'], 'readwrite', t => {
      const vs = t.objectStore('visits');
      for (const id of ids) {
        const r = vs.get(id);
        r.onsuccess = () => { if (r.result) { r.result.exported_at = stamp; vs.put(r.result); } };
      }
    }).then(() => stamp);
  }

  const getMeta = (key, dflt) => run(['meta'], 'readonly', (t, set) => {
    const r = t.objectStore('meta').get(key); r.onsuccess = () => set(r.result ? r.result.value : dflt);
  });
  const setMeta = (key, value) => run(['meta'], 'readwrite', t => { t.objectStore('meta').put({ key, value }); });

  /* Recording in progress: each chunk is written as it arrives. */
  const recPut = (recId, n, visitId, mime, t0, data) => run(['rec'], 'readwrite', t => {
    t.objectStore('rec').put({ k: `${recId}:${String(n).padStart(6, '0')}`, recId, visitId, mime, t0, at: Date.now(), data });
  });
  const recClear = recId => run(['rec'], 'readwrite', t => {
    const s = t.objectStore('rec'), r = s.openCursor();
    r.onsuccess = () => { const c = r.result; if (!c) return; if (c.value.recId === recId) c.delete(); c.continue(); };
  });
  // Recordings that were interrupted before Stop (app closed, phone died): returned in order, grouped.
  const recPending = () => run(['rec'], 'readonly', (t, set) => {
    const r = t.objectStore('rec').getAll();
    r.onsuccess = () => {
      const by = {};
      for (const x of r.result) (by[x.recId] = by[x.recId] || []).push(x);
      set(Object.values(by).map(a => ({ recId: a[0].recId, visitId: a[0].visitId, mime: a[0].mime, t0: a[0].t0,
        last: a[a.length - 1].at, parts: a.map(x => x.data) })));
    };
  });

  // Empty the bin of anything deleted more than 30 days ago.
  async function purgeExpired() {
    const cutoff = Date.now() - U.BIN_DAYS * 86400000;
    const old = s => s && Date.parse(s) < cutoff;
    for (const v of await getVisits()) {
      if (old(v.deleted_at)) { await deleteVisitForever(v.visit_id); continue; }
      for (const m of v.media) if (old(m.deleted_at)) await deleteMediaForever(v.visit_id, m.id);
    }
  }

  return { getVisits, getVisit, putVisit, patchVisit, createVisit, addMedia, getBlob, deleteVisitForever,
    deleteMediaForever, importVisit, markExported, getMeta, setMeta, recPut, recClear, recPending, purgeExpired };
})();
