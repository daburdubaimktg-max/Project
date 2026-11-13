'use strict';
/* NEE — Nishant's Eyes and Ears. UI layer. Keep APP_VERSION in step with CACHE_VERSION in sw.js. */
const APP_VERSION = '1.0.1';

(function () {
  const TYPES = [['MV', 'Market visit'], ['HV', 'Home visit'], ['TR', 'Trade'], ['SL', 'Salon'],
    ['IN', 'Informal'], ['MT', 'Meeting'], ['TH', 'Thought']];
  const TYPE_NAME = Object.fromEntries(TYPES);
  const OUTLETS = ['spaza', 'informal/hawker', 'salon', 'pharmacy chain', 'independent pharmacy', 'supermarket chain',
    'discounter', 'wholesaler/cash & carry', 'beauty store', 'home', 'office', 'other'];
  const DEFAULT_COUNTRIES = ['ZAF', 'NGA', 'GHA', 'KEN', 'EGY'];
  const COLOURS = ['', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];
  const EXT = { 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm', 'audio/ogg': 'ogg',
    'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic',
    'image/heif': 'heif', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
    'video/webm': 'webm' };

  const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON = {
    settings: svg('<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/>'),
    pin: svg('<path d="M7 4h10v16l-5-4-5 4z"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    stop: svg('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>'),
    camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    video: svg('<rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 10l6-3v10l-6-3z"/>'),
    book: svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>'),
  };
  const REC_IDLE = `${ICON.mic}<span>Record</span>`, REC_ON = `${ICON.stop}<span>Stop</span>`;

  const root = document.getElementById('app');
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const live = v => v.media.filter(m => !m.deleted_at);
  const needsWarning = v => v.consent_stated !== 'yes' && live(v).some(m => m.kind === 'audio' || m.kind === 'video');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

  let countries = DEFAULT_COUNTRIES.slice();
  let filters = { q: '', type: '', country: '', label: '' };
  let cur = null;            // visit open in the editor
  let saveTimer = null;
  let urls = [];             // object URLs to release when leaving a screen
  let persisted = null;
  let drawToken = 0;

  /* ---------- small helpers ---------- */
  function fmtDate(ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d) return ymd;
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtBytes(n) {
    if (n == null) return '?';
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
    if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 ** 3).toFixed(2)} GB`;
  }
  const fmtDur = s => `${Math.floor(s / 60)}:${U.pad(s % 60)}`;

  let toastTimer = null;
  function toast(msg, ms = 3500) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }
  function overlay(html) {
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(o);
    return o;
  }
  function confirmDlg(title, msg, okLabel, danger) {
    return new Promise(res => {
      const o = overlay(`<h2>${esc(title)}</h2><p>${esc(msg)}</p><div class="row end">
        <button class="btn" data-x="0">Cancel</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-x="1">${esc(okLabel)}</button></div>`);
      o.addEventListener('click', e => {
        const b = e.target.closest('[data-x]');
        if (b) { o.remove(); res(b.dataset.x === '1'); } else if (e.target === o) { o.remove(); res(false); }
      });
    });
  }
  const options = (list, sel, blank) => (blank != null ? `<option value="">${esc(blank)}</option>` : '') +
    list.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`; }).join('');

  /* ---------- saving ---------- */
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 400); }
  async function flushSave() {
    if (saveTimer == null || !cur) { clearTimeout(saveTimer); saveTimer = null; return; }
    clearTimeout(saveTimer); saveTimer = null;
    try { await DB.putVisit(cur); } catch (e) { toast('Could not save — storage error. Export now.', 8000); }
  }
  async function saveNow() { clearTimeout(saveTimer); saveTimer = 0; await flushSave(); }

  /* ---------- routing ---------- */
  async function route() {
    await leave();
    const h = location.hash;
    if (h.startsWith('#/v/')) return renderVisit(decodeURIComponent(h.slice(4)));
    if (h === '#/settings') return renderSettings();
    if (h === '#/bin') return renderBin();
    return renderHome();
  }
  async function leave() {
    await flushSave();
    if (Rec.mr) await stopRec();
    urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
    cur = null; drawToken++; root.onclick = null;
    document.querySelectorAll('.overlay,.lightbox').forEach(n => n.remove());
    window.scrollTo(0, 0);
  }
  const go = h => { if (location.hash === h) route(); else location.hash = h; };

  /* ---------- home (Keep-style list) ---------- */
  async function renderHome() {
    const all = (await DB.getVisits()).filter(v => !v.deleted_at);
    const labels = [...new Set(all.flatMap(v => v.labels))].sort();
    const ctry = [...new Set([...countries, ...all.map(v => v.country)])];
    root.innerHTML = `
      <header class="bar home"><div class="grow"><h1>Eyes &amp; Ears</h1>
        <div class="today">${esc(fmtDate(U.ymd()))} · ${all.length} visit${all.length === 1 ? '' : 's'}</div></div>
        <button class="btn icon" id="toSettings" aria-label="Settings">${ICON.settings}</button></header>
      <div id="banners"></div>
      <input id="q" type="search" placeholder="Search text, notes, places, labels" aria-label="Search visits"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" value="${esc(filters.q)}">
      <div class="filters">
        <select id="fType" aria-label="Filter by type">${options(TYPES.map(t => [t[0], `${t[0]} ${t[1]}`]), filters.type, 'All types')}</select>
        <select id="fCountry" aria-label="Filter by country">${options(ctry, filters.country, 'All countries')}</select>
        <select id="fLabel" aria-label="Filter by label">${options(labels, filters.label, 'All labels')}</select>
      </div>
      <div id="list"></div>
      <button class="fab" id="fab">${ICON.plus}New visit</button>`;
    $('#toSettings').onclick = () => go('#/settings');
    $('#fab').onclick = () => newVisitSheet(all);
    $('#q').oninput = e => { filters.q = e.target.value; drawList(all); };
    $('#fType').onchange = e => { filters.type = e.target.value; drawList(all); };
    $('#fCountry').onchange = e => { filters.country = e.target.value; drawList(all); };
    $('#fLabel').onchange = e => { filters.label = e.target.value; drawList(all); };
    $('#list').onclick = async e => {
      const pin = e.target.closest('[data-pin]'), day = e.target.closest('[data-day]');
      if (pin) {
        const v = all.find(x => x.visit_id === pin.dataset.pin);
        v.pinned = !v.pinned; await DB.putVisit(v, false); drawList(all);
      } else if (day) exportFlow('day', day.dataset.day);
    };
    drawList(all);
    drawBanners(all);
  }

  function matches(v) {
    if (filters.type && v.visit_type !== filters.type) return false;
    if (filters.country && v.country !== filters.country) return false;
    if (filters.label && !v.labels.includes(filters.label)) return false;
    const q = filters.q.trim().toLowerCase();
    if (!q) return true;
    const hay = [v.visit_id, v.text_raw, v.typed_notes, v.city, v.suburb, v.outlet_type, v.who_role,
      v.labels.join(' '), v.checklist.map(c => c.text).join(' ')].join('\n').toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w));
  }

  function card(v) {
    const m = live(v), n = k => m.filter(x => x.kind === k).length;
    const counts = [[n('audio'), 'audio'], [n('photo'), 'photo'], [n('video'), 'video']]
      .filter(c => c[0]).map(c => `${c[0]} ${c[1]}${c[0] > 1 && c[1] !== 'audio' ? 's' : ''}`).join(' · ');
    const place = [v.city, v.suburb, v.outlet_type].filter(Boolean).join(' · ');
    const snip = (v.text_raw || v.typed_notes).slice(0, 200);
    const exported = v.exported_at && Date.parse(v.exported_at) >= Date.parse(v.updated_at);
    return `<div class="card ${v.colour ? 'col-' + esc(v.colour) : ''}">
      <a href="#/v/${encodeURIComponent(v.visit_id)}">
        <div class="cid"><span class="tbadge">${esc(v.visit_type)}</span>${esc(v.visit_id)}</div>
        <div class="sub">${esc(TYPE_NAME[v.visit_type] || v.visit_type)}${place ? ' · ' + esc(place) : ''} · ${esc(v.start_time)}</div>
        ${snip ? `<div class="snip">${esc(snip)}</div>` : ''}
        <div class="chips">
          ${needsWarning(v) ? '<span class="chip warn">⚠ Recording, consent = no</span>' : ''}
          ${counts ? `<span class="chip">${counts}</span>` : ''}
          ${v.labels.map(l => `<span class="chip">${esc(l)}</span>`).join('')}
          ${exported ? '<span class="chip ok">Exported</span>' : ''}
        </div>
      </a>
      <button class="pinbtn ${v.pinned ? 'on' : ''}" data-pin="${esc(v.visit_id)}" aria-pressed="${v.pinned}" aria-label="Pin ${esc(v.visit_id)}">${ICON.pin}</button>
    </div>`;
  }

  function drawList(all) {
    const vs = all.filter(matches).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at) || b.visit_id.localeCompare(a.visit_id));
    const box = $('#list');
    if (!all.length) { box.innerHTML = `<div class="empty">${ICON.book}<strong>No visits yet</strong>Tap “New visit” to start capturing.</div>`; return; }
    if (!vs.length) { box.innerHTML = '<p class="muted pad">Nothing matches the search or filters.</p>'; return; }
    let html = '';
    const pinned = vs.filter(v => v.pinned);
    if (pinned.length) html += `<div class="ghead"><h3>Pinned</h3></div>${pinned.map(card).join('')}`;
    let last = null;
    for (const v of vs.filter(v => !v.pinned)) {
      if (v.date !== last) {
        last = v.date;
        html += `<div class="ghead"><h3>${esc(fmtDate(v.date))}</h3><button class="btn" data-day="${esc(v.date)}">Export day</button></div>`;
      }
      html += card(v);
    }
    box.innerHTML = html;
  }

  async function drawBanners(all) {
    const box = $('#banners'); if (!box) return;
    let html = '';
    if (isIOS && !isStandalone()) html += `<div class="banner"><span class="grow">Opened in Safari. Add to Home Screen and always open from the icon, or data may not be kept.</span></div>`;
    if (persisted === false && !sessionStorage.getItem('hidePersist')) {
      html += `<div class="banner"><span class="grow">Storage is not protected on this device. Install the app and export every evening.</span><button class="btn" id="hidePersist">OK</button></div>`;
    }
    const today = U.ymd();
    const pending = all.filter(v => v.date === today && (!v.exported_at || Date.parse(v.updated_at) > Date.parse(v.exported_at)));
    if (new Date().getHours() >= 18 && pending.length) {
      html += `<div class="banner"><span class="grow">${pending.length} visit${pending.length > 1 ? 's' : ''} today not exported yet.</span><button class="btn" id="remExport">Export day</button></div>`;
    }
    box.innerHTML = html;
    const h = $('#hidePersist'); if (h) h.onclick = () => { sessionStorage.setItem('hidePersist', '1'); drawBanners(all); };
    const r = $('#remExport'); if (r) r.onclick = () => exportFlow('day', today);
  }

  /* ---------- new visit ---------- */
  function newVisitSheet(all) {
    const uniq = k => [...new Set(all.map(v => v[k]).filter(Boolean))];
    let type = '', consent = 'no';
    const o = overlay(`
      <h2>New visit</h2>
      <div class="types" id="nvTypes">${TYPES.map(t => `<button class="btn" data-t="${t[0]}"><strong>${t[0]}</strong> ${esc(t[1])}</button>`).join('')}</div>
      <label class="f">Country<select id="nvCountry">${options(countries, 'ZAF')}</select></label>
      <label class="f">City<input type="text" id="nvCity" list="dlCity" autocomplete="off" autocorrect="off" spellcheck="false"></label>
      <datalist id="dlCity">${uniq('city').map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <label class="f">Suburb<input type="text" id="nvSuburb" list="dlSuburb" autocomplete="off" autocorrect="off" spellcheck="false"></label>
      <datalist id="dlSuburb">${uniq('suburb').map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <label class="f">Outlet type<select id="nvOutlet">${options(OUTLETS, '', '—')}</select></label>
      <label class="f">Who (role or first name only)<input type="text" id="nvWho" autocomplete="off" autocorrect="off" spellcheck="false"></label>
      <div class="f" style="margin-top:12px;font-weight:600;font-size:15px">Consent stated</div>
      <div class="seg" id="nvConsent"><button class="btn" data-c="yes">Yes</button><button class="btn on" data-c="no">No</button></div>
      <div class="row end"><button class="btn" id="nvCancel">Cancel</button><button class="btn primary" id="nvCreate" disabled>Choose a type</button></div>`);
    const create = $('#nvCreate', o);
    $('#nvTypes', o).onclick = e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      type = b.dataset.t;
      o.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === b));
      create.disabled = false; create.textContent = `Create ${type} visit`;
    };
    $('#nvConsent', o).onclick = e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      consent = b.dataset.c;
      o.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b));
    };
    $('#nvCancel', o).onclick = () => o.remove();
    create.onclick = async () => {
      create.disabled = true;
      try {
        const v = await DB.createVisit({ visit_type: type, country: $('#nvCountry', o).value, city: $('#nvCity', o).value,
          suburb: $('#nvSuburb', o).value, outlet_type: $('#nvOutlet', o).value, who_role: $('#nvWho', o).value,
          consent_stated: consent }, APP_VERSION);
        o.remove(); go(`#/v/${encodeURIComponent(v.visit_id)}`);
      } catch (e) { create.disabled = false; toast('Could not create the visit — storage error.'); }
    };
  }

  /* ---------- visit editor ---------- */
  async function renderVisit(id) {
    const v = await DB.getVisit(id);
    if (!v) return go('#/');
    if (v.deleted_at) return go('#/bin');
    cur = v;
    const all = await DB.getVisits();
    const allLabels = [...new Set(all.flatMap(x => x.labels))].sort();
    const noAttr = 'autocomplete="off" autocorrect="off" spellcheck="false"';
    root.innerHTML = `
      <header class="bar"><button class="btn ghost" id="back">‹ Visits</button><span class="grow"></span>
        <button class="btn" id="pin" aria-pressed="${v.pinned}"></button></header>
      <div class="vid">${esc(v.visit_id)}</div>
      <div id="warn"></div>
      <details class="meta"><summary id="sum"></summary><div class="in">
        <label class="f">City<input type="text" data-f="city" value="${esc(v.city)}" ${noAttr}></label>
        <label class="f">Suburb<input type="text" data-f="suburb" value="${esc(v.suburb)}" ${noAttr}></label>
        <label class="f">Outlet type<select data-f="outlet_type">${options(OUTLETS.includes(v.outlet_type) || !v.outlet_type ? OUTLETS : [v.outlet_type, ...OUTLETS], v.outlet_type, '—')}</select></label>
        <label class="f">Who (role or first name only)<input type="text" data-f="who_role" value="${esc(v.who_role)}" ${noAttr}></label>
        <div style="margin-top:12px;font-weight:600;font-size:15px">Consent stated</div>
        <div class="seg" id="consent"><button class="btn" data-c="yes">Yes</button><button class="btn" data-c="no">No</button></div>
        <p class="small muted" id="dateLine"></p>
        <button class="btn" id="editDate">Change date</button>
      </div></details>
      <label class="f" for="txt">Dictation / raw text</label>
      <textarea id="txt" placeholder="Tap here, then dictate with Wispr Flow or the microphone key" autocorrect="off" spellcheck="false" autocapitalize="sentences"></textarea>
      <div id="rec"></div>
      <h3>Media</h3><div id="media"></div>
      <label class="f" for="notes">Typed notes</label>
      <textarea id="notes" autocorrect="off" spellcheck="false" autocapitalize="sentences"></textarea>
      <h3>Checklist</h3><div id="check"></div>
      <div class="addrow"><input type="text" id="checkNew" placeholder="Add item" aria-label="New checklist item" ${noAttr}><button class="btn" id="checkAdd">Add</button></div>
      <h3>Labels</h3><div class="chips" id="labels"></div>
      <div class="addrow"><input type="text" id="labelNew" list="dlLabels" placeholder="Add label" aria-label="New label" ${noAttr}><button class="btn" id="labelAdd">Add</button></div>
      <datalist id="dlLabels">${allLabels.map(l => `<option value="${esc(l)}">`).join('')}</datalist>
      <h3>Colour</h3><div class="swatches" id="colours"></div>
      <div class="actions">
        <button class="btn primary block" id="expVisit">Export visit</button>
        <button class="btn block" id="expDay">Export day (${esc(fmtDate(v.date))})</button>
        <button class="btn danger block" id="delVisit">Delete visit</button>
      </div>
      <div class="capture"><div class="in">
        <label class="btn" id="photoBtn" role="button" tabindex="0">${ICON.camera}Photo<input type="file" id="photoIn" accept="image/*" capture="environment"></label>
        <button class="btn" id="recBtn">${REC_IDLE}</button>
        <label class="btn" id="videoBtn" role="button" tabindex="0">${ICON.video}Video<input type="file" id="videoIn" accept="video/*" capture="environment"></label>
      </div></div>`;
    // Set text through .value so it is stored and shown exactly as entered.
    $('#txt').value = v.text_raw; $('#notes').value = v.typed_notes;

    $('#back').onclick = () => go('#/');
    $('#txt').oninput = e => { cur.text_raw = e.target.value; scheduleSave(); };
    $('#notes').oninput = e => { cur.typed_notes = e.target.value; scheduleSave(); };
    root.querySelectorAll('[data-f]').forEach(el => {
      el.oninput = el.onchange = () => { cur[el.dataset.f] = el.value; drawHead(); scheduleSave(); };
    });
    $('#consent').onclick = e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      cur.consent_stated = b.dataset.c; drawHead(); scheduleSave();
    };
    $('#pin').onclick = () => { cur.pinned = !cur.pinned; drawHead(); scheduleSave(); };
    $('#editDate').onclick = editDate;
    $('#checkAdd').onclick = addCheck;
    $('#checkNew').onkeydown = e => { if (e.key === 'Enter') addCheck(); };
    $('#labelAdd').onclick = addLabel;
    $('#labelNew').onkeydown = e => { if (e.key === 'Enter') addLabel(); };
    $('#colours').onclick = e => {
      const b = e.target.closest('[data-col]'); if (!b) return;
      cur.colour = b.dataset.col; drawColours(); scheduleSave();
    };
    $('#recBtn').onclick = () => (Rec.mr ? stopRec() : startRec());
    $('#photoIn').onchange = e => addFiles(e.target, 'photo');
    $('#videoIn').onchange = e => addFiles(e.target, 'video');
    $('#expVisit').onclick = async () => { await saveNow(); exportFlow('visit', cur); };
    $('#expDay').onclick = async () => { await saveNow(); exportFlow('day', cur.date); };
    $('#delVisit').onclick = async () => {
      if (!await confirmDlg('Delete this visit?', `${cur.visit_id} moves to Recently deleted for ${U.BIN_DAYS} days, then is removed for good.`, 'Delete', true)) return;
      cur.deleted_at = U.iso(); await saveNow(); toast('Moved to Recently deleted'); go('#/');
    };
    drawHead(); drawCheck(); drawLabels(); drawColours(); drawMedia();
  }

  function drawHead() {
    const v = cur;
    $('#pin').innerHTML = ICON.pin + (v.pinned ? 'Pinned' : 'Pin');
    $('#pin').classList.toggle('on', v.pinned); $('#pin').setAttribute('aria-pressed', v.pinned);
    $('#sum').textContent = [TYPE_NAME[v.visit_type] || v.visit_type, v.country, v.city, v.suburb, v.outlet_type, v.who_role,
      `consent ${v.consent_stated}`].filter(Boolean).join(' · ');
    $('#dateLine').textContent = `Date ${fmtDate(v.date)} · ${v.start_time}–${v.end_time}` + (v.date_edit_reason ? ` · date edited: ${v.date_edit_reason}` : '');
    root.querySelectorAll('#consent [data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === v.consent_stated));
    $('#warn').innerHTML = needsWarning(v) ? '<div class="warnbox" role="alert">⚠ This visit has audio or video but consent is marked No.</div>' : '';
    $('#expDay').textContent = `Export day (${fmtDate(v.date)})`;
  }

  function editDate() {
    const o = overlay(`<h2>Change visit date</h2>
      <p class="muted">The visit ID stays ${esc(cur.visit_id)}. A reason is required and is stored with the visit.</p>
      <label class="f">New date<input type="date" id="edDate" value="${esc(cur.date)}"></label>
      <label class="f">Reason<input type="text" id="edReason" autocomplete="off" autocorrect="off" spellcheck="false"></label>
      <div class="row end"><button class="btn" id="edCancel">Cancel</button><button class="btn primary" id="edSave">Save date</button></div>`);
    $('#edCancel', o).onclick = () => o.remove();
    $('#edSave', o).onclick = () => {
      const d = $('#edDate', o).value, r = $('#edReason', o).value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return toast('Choose a date');
      if (!r.trim()) return toast('A reason is required');
      if (d === cur.date) return o.remove();
      cur.date_edit_reason = cur.date_edit_reason ? `${cur.date_edit_reason} | ${cur.date}→${d}: ${r}` : `${cur.date}→${d}: ${r}`;
      cur.date = d; o.remove(); drawHead(); scheduleSave();
    };
  }

  function drawCheck() {
    const box = $('#check');
    box.innerHTML = cur.checklist.map((c, i) => `<div class="citem ${c.done ? 'done' : ''}">
      <input type="checkbox" data-i="${i}" ${c.done ? 'checked' : ''} aria-label="Done">
      <input type="text" data-i="${i}" aria-label="Checklist item" autocomplete="off" autocorrect="off" spellcheck="false">
      <button class="btn ghost" data-rm="${i}" aria-label="Remove item">✕</button></div>`).join('');
    box.querySelectorAll('input[type=text]').forEach(el => { el.value = cur.checklist[+el.dataset.i].text; });
    box.oninput = e => {
      const i = +e.target.dataset.i; if (Number.isNaN(i)) return;
      if (e.target.type === 'checkbox') { cur.checklist[i].done = e.target.checked; e.target.parentNode.classList.toggle('done', e.target.checked); }
      else cur.checklist[i].text = e.target.value;
      scheduleSave();
    };
    box.onclick = async e => {
      const b = e.target.closest('[data-rm]'); if (!b) return;
      const i = +b.dataset.rm;
      if (!await confirmDlg('Remove this item?', cur.checklist[i].text || '(empty item)', 'Remove', true)) return;
      cur.checklist.splice(i, 1); drawCheck(); scheduleSave();
    };
  }
  function addCheck() {
    const el = $('#checkNew'); if (!el.value) return;
    cur.checklist.push({ text: el.value, done: false }); el.value = ''; drawCheck(); scheduleSave();
  }
  function drawLabels() {
    const box = $('#labels');
    box.innerHTML = cur.labels.map((l, i) => `<span class="chip">${esc(l)}<button data-rl="${i}" aria-label="Remove label ${esc(l)}">✕</button></span>`).join('');
    box.onclick = e => { const b = e.target.closest('[data-rl]'); if (!b) return; cur.labels.splice(+b.dataset.rl, 1); drawLabels(); scheduleSave(); };
  }
  function addLabel() {
    const el = $('#labelNew'), l = el.value.trim(); if (!l) return;
    if (!cur.labels.includes(l)) cur.labels.push(l);
    el.value = ''; drawLabels(); scheduleSave();
  }
  function drawColours() {
    $('#colours').innerHTML = COLOURS.map(c => `<button class="swatch ${c ? 'sw-' + c : ''} ${cur.colour === c ? 'on' : ''}" data-col="${c}"
      aria-label="${c || 'No colour'}" aria-pressed="${cur.colour === c}">${c ? '' : 'none'}</button>`).join('');
  }

  /* ---------- media ---------- */
  async function drawMedia() {
    const token = ++drawToken, box = $('#media'), v = cur;
    if (!box || !v) return;
    const items = live(v), frag = document.createDocumentFragment();
    for (const m of items) {
      const blob = await DB.getBlob(m.id);
      if (token !== drawToken) return;
      const url = blob ? URL.createObjectURL(blob) : ''; if (url) urls.push(url);
      const row = document.createElement('div'); row.className = 'mitem';
      const when = (m.captured_at || '').slice(11, 16);
      const player = !url ? '<p class="muted">File missing on this device.</p>'
        : m.kind === 'audio' ? `<audio controls preload="metadata" src="${url}"></audio>`
        : m.kind === 'video' ? `<video controls playsinline preload="metadata" src="${url}"></video>`
        : `<img src="${url}" alt="Photo ${esc(m.id)}" data-zoom="${url}">`;
      row.innerHTML = `<div class="mhead"><strong class="grow">${esc(m.id)}</strong>
        <span class="muted small">${m.kind} · ${esc(when)}${m.duration_s != null ? ' · ' + fmtDur(m.duration_s) : ''}${blob ? ' · ' + fmtBytes(blob.size) : ''}</span>
        <button class="btn ghost danger" data-dm="${esc(m.id)}">Delete</button></div>${player}`;
      frag.appendChild(row);
    }
    box.innerHTML = items.length ? '' : '<p class="muted">Nothing captured yet. Use Record, Photo or Video below.</p>';
    box.appendChild(frag);
    box.onclick = async e => {
      const z = e.target.closest('[data-zoom]'), d = e.target.closest('[data-dm]');
      if (z) {
        const lb = document.createElement('div'); lb.className = 'lightbox';
        lb.innerHTML = `<img src="${z.dataset.zoom}" alt="">`; lb.onclick = () => lb.remove(); document.body.appendChild(lb);
      } else if (d) {
        if (!await confirmDlg('Delete this item?', `${d.dataset.dm} moves to Recently deleted for ${U.BIN_DAYS} days.`, 'Delete', true)) return;
        const m = cur.media.find(x => x.id === d.dataset.dm); if (!m) return;
        m.deleted_at = U.iso(); await saveNow(); drawHead(); drawMedia();
      }
    };
  }

  function probeDuration(blob, kind) {
    return new Promise(res => {
      const el = document.createElement(kind === 'video' ? 'video' : 'audio'), url = URL.createObjectURL(blob);
      let done = false;
      const fin = val => { if (done) return; done = true; URL.revokeObjectURL(url); res(val); };
      el.preload = 'metadata';
      el.onloadedmetadata = () => fin(Number.isFinite(el.duration) ? Math.round(el.duration) : null);
      el.onerror = () => fin(null);
      setTimeout(() => fin(null), 4000);
      el.src = url;
    });
  }

  async function storeMedia(kind, blob, ext, dur) {
    if (!cur) return;
    await flushSave();
    try {
      const v = await DB.addMedia(cur.visit_id, kind, blob, ext, dur);
      Object.assign(cur, { media: v.media, media_seq: v.media_seq, updated_at: v.updated_at, end_time: v.end_time });
      toast(`Saved ${v.media[v.media.length - 1].id}`);
    } catch (e) { toast('Could not save — storage may be full. Export and free space.', 8000); }
    if ($('#media')) { drawHead(); drawMedia(); }
  }

  async function addFiles(input, kind) {
    const files = [...input.files]; input.value = '';
    for (const f of files) {
      const fromName = /\.([A-Za-z0-9]{2,5})$/.exec(f.name || '');
      const ext = fromName ? fromName[1].toLowerCase() : (EXT[(f.type || '').split(';')[0]] || (kind === 'photo' ? 'jpg' : 'mov'));
      await storeMedia(kind, f, ext, kind === 'video' ? await probeDuration(f, 'video') : null);
    }
  }

  /* ---------- audio recorder ---------- */
  const Rec = { mr: null, stream: null, chunks: [], t0: 0, timer: null, lock: null, done: null, resolve: null };

  async function wakeLock() {
    try { if ('wakeLock' in navigator && !document.hidden) Rec.lock = await navigator.wakeLock.request('screen'); } catch (e) { Rec.lock = null; }
  }
  async function startRec() {
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('Audio recording is not supported in this browser.');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { return toast('Microphone blocked. Allow it in Settings → Safari → Microphone, then reopen the app.', 7000); }
    if (!cur) { stream.getTracks().forEach(t => t.stop()); return; }
    let mr;
    try { mr = new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach(t => t.stop()); return toast('Could not start recording.'); }
    Object.assign(Rec, { mr, stream, chunks: [], t0: Date.now() });
    Rec.done = new Promise(r => { Rec.resolve = r; });
    mr.ondataavailable = e => { if (e.data && e.data.size) Rec.chunks.push(e.data); };
    mr.onstop = finishRec; mr.onerror = () => stopRec();
    stream.getTracks().forEach(t => { t.onended = () => stopRec(); });
    mr.start(1000);
    await wakeLock();
    const b = $('#recBtn'); b.innerHTML = REC_ON; b.classList.add('recording');
    $('#rec').innerHTML = `<div class="recpanel" role="status"><div class="time" id="recTime">0:00</div>
      <div><strong>Recording.</strong> Keep the screen on and stay in this app — recording stops if the phone locks or you switch apps.${Rec.lock ? ' Screen will stay awake.' : ''}</div></div>`;
    Rec.timer = setInterval(() => { const t = $('#recTime'); if (t) t.textContent = fmtDur(Math.round((Date.now() - Rec.t0) / 1000)); }, 500);
  }
  function stopRec() {
    const { mr, done } = Rec;
    if (!mr) return Promise.resolve();
    if (mr.state !== 'inactive') { try { mr.stop(); } catch (e) { finishRec(); } } else finishRec();
    return done;
  }
  async function finishRec() {
    const { mr, stream, chunks, t0, resolve } = Rec;
    if (!mr) return;
    Rec.mr = null; clearInterval(Rec.timer);
    stream.getTracks().forEach(t => { t.onended = null; t.stop(); });
    try { if (Rec.lock) await Rec.lock.release(); } catch (e) { /* already released */ }
    Rec.lock = null;
    const b = $('#recBtn'); if (b) { b.innerHTML = REC_IDLE; b.classList.remove('recording'); }
    const p = $('#rec'); if (p) p.innerHTML = '';
    const mime = (mr.mimeType || (chunks[0] && chunks[0].type) || 'audio/mp4');
    const blob = new Blob(chunks, { type: mime });
    if (blob.size) await storeMedia('audio', blob, EXT[mime.split(';')[0]] || 'm4a', Math.round((Date.now() - t0) / 1000));
    else toast('Nothing was recorded.');
    resolve();
  }

  /* ---------- export / import ---------- */
  async function exportFlow(kind, target) {
    const o = overlay('<h2>Preparing package…</h2><p class="muted">Building the .zip on this device. Nothing is sent anywhere.</p>');
    let pack;
    try { pack = kind === 'visit' ? await Exporter.visitZip(target) : await Exporter.dayZips(target); }
    catch (e) { o.remove(); return toast('Export failed — not enough memory or storage. Try exporting visits one at a time.', 8000); }
    if (!pack.files.length) { o.remove(); return toast('No visits on that day.'); }
    const canShare = !!(navigator.canShare && navigator.canShare({ files: pack.files }));
    const mark = async () => {
      const stamp = await DB.markExported(pack.ids);
      if (cur && pack.ids.includes(cur.visit_id)) cur.exported_at = stamp;
    };
    $('.sheet', o).innerHTML = `<h2>Package ready</h2>
      <ul class="plain">${pack.files.map(f => `<li><strong>${esc(f.name)}</strong> · ${fmtBytes(f.size)}</li>`).join('')}</ul>
      <p class="muted">${pack.ids.length} visit${pack.ids.length > 1 ? 's' : ''}. Share to the Claude app, Files, OneDrive or WhatsApp.</p>
      <div class="actions">
        ${canShare ? '<button class="btn primary block" id="exShare">Share…</button>' : ''}
        <button class="btn ${canShare ? '' : 'primary'} block" id="exSave">Save to this device</button>
        <button class="btn block" id="exClose">Close</button></div>`;
    $('#exClose', o).onclick = () => { o.remove(); if (!cur && !location.hash.startsWith('#/v/')) route(); };
    if (canShare) $('#exShare', o).onclick = async () => {
      try { await navigator.share({ files: pack.files, title: pack.files[0].name }); await mark(); toast('Shared. Marked as exported.'); }
      catch (e) { if (e.name !== 'AbortError') toast('Share did not open. Use “Save to this device”, then share from Files.', 7000); }
    };
    $('#exSave', o).onclick = async () => {
      for (const f of pack.files) {
        const url = URL.createObjectURL(f), a = document.createElement('a');
        a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      await mark(); toast('Saved. Marked as exported.');
    };
  }

  async function importFiles(input) {
    const files = [...input.files]; input.value = '';
    let added = 0, skipped = 0, invalid = 0;
    for (const f of files) {
      try { const r = await Exporter.importZip(f); added += r.added.length; skipped += r.skipped.length; invalid += r.invalid; }
      catch (e) { invalid++; }
    }
    toast(`Imported ${added} visit${added === 1 ? '' : 's'}; ${skipped} already here (skipped)${invalid ? `; ${invalid} not readable` : ''}.`, 7000);
    go('#/');
  }

  /* ---------- settings ---------- */
  async function renderSettings() {
    let est = {};
    try { est = (navigator.storage && navigator.storage.estimate) ? await navigator.storage.estimate() : {}; } catch (e) { /* unavailable */ }
    const all = await DB.getVisits();
    const binCount = all.filter(v => v.deleted_at).length + all.filter(v => !v.deleted_at).reduce((n, v) => n + v.media.filter(m => m.deleted_at).length, 0);
    root.innerHTML = `
      <header class="bar"><button class="btn ghost" id="back">‹ Visits</button><h1>Settings</h1></header>
      <h3>Laptop / other device</h3>
      <div class="box"><p>Import an exported .zip to view the same visits here. Visits already on this device are skipped, never overwritten.</p>
        <label class="btn primary block">Import .zip<input type="file" id="impIn" accept=".zip,application/zip,application/x-zip-compressed" multiple hidden></label></div>
      <h3>Recently deleted</h3>
      <div class="box"><button class="btn block" id="toBin">Open bin (${binCount} item${binCount === 1 ? '' : 's'})</button></div>
      <h3>Storage on this device</h3>
      <div class="box"><p><strong>${fmtBytes(est.usage)}</strong> used${est.quota ? ` of about ${fmtBytes(est.quota)} available` : ''} · ${all.filter(v => !v.deleted_at).length} visits</p>
        <p>${persisted ? 'Storage is protected (persistent).' : 'Storage is <strong>not</strong> protected. Install the app to the Home Screen and export every evening.'}</p></div>
      <h3>Countries</h3>
      <div class="box"><div class="chips" id="ctry"></div>
        <div class="addrow"><input type="text" id="ctryNew" maxlength="3" placeholder="3-letter code, e.g. TZA" aria-label="New country code" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false"><button class="btn" id="ctryAdd">Add</button></div></div>
      <h3>Good to know on iPhone</h3>
      <div class="box"><ul class="plain">
        <li>Recording stops if the screen locks or you switch apps. Keep the screen on.</li>
        <li>Data lives on this phone until exported. <strong>Export every evening.</strong></li>
        <li>Always open from the Home Screen icon, not a Safari tab.</li>
        <li>No automatic phone-to-laptop sync. Transfer is export, then import.</li>
        <li>No location, analytics or trackers. Nothing leaves the device except your own export.</li></ul></div>
      <p class="muted small">Nishant's Eyes and Ears · version ${APP_VERSION} · schema NEE-v1</p>`;
    $('#back').onclick = () => go('#/');
    $('#toBin').onclick = () => go('#/bin');
    $('#impIn').onchange = e => importFiles(e.target);
    const drawC = () => {
      $('#ctry').innerHTML = countries.map((c, i) => `<span class="chip">${esc(c)}${c === 'ZAF' ? '' : `<button data-rc="${i}" aria-label="Remove ${esc(c)}">✕</button>`}</span>`).join('');
    };
    $('#ctry').onclick = async e => {
      const b = e.target.closest('[data-rc]'); if (!b) return;
      countries.splice(+b.dataset.rc, 1); await DB.setMeta('countries', countries); drawC();
    };
    $('#ctryAdd').onclick = async () => {
      const el = $('#ctryNew'), c = el.value.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(c)) return toast('Use a 3-letter country code');
      if (!countries.includes(c)) { countries.push(c); await DB.setMeta('countries', countries); }
      el.value = ''; drawC();
    };
    drawC();
  }

  /* ---------- recently deleted ---------- */
  async function renderBin() {
    const all = await DB.getVisits();
    const left = s => Math.max(0, U.BIN_DAYS - Math.floor((Date.now() - Date.parse(s)) / 86400000));
    const visits = all.filter(v => v.deleted_at).sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
    const media = all.filter(v => !v.deleted_at).flatMap(v => v.media.filter(m => m.deleted_at).map(m => ({ v, m })));
    root.innerHTML = `
      <header class="bar"><button class="btn ghost" id="back">‹ Settings</button><h1>Recently deleted</h1></header>
      <p class="muted">Items are removed for good ${U.BIN_DAYS} days after deletion.</p>
      ${!visits.length && !media.length ? '<p class="muted pad">The bin is empty.</p>' : ''}
      ${visits.map(v => `<div class="box"><strong>${esc(v.visit_id)}</strong>
        <div class="muted small">${esc(fmtDate(v.date))} · ${live(v).length} media · ${left(v.deleted_at)} days left</div>
        <div class="row" style="margin-top:8px"><button class="btn primary" data-rv="${esc(v.visit_id)}">Restore</button>
        <button class="btn danger" data-dv="${esc(v.visit_id)}">Delete forever</button></div></div>`).join('')}
      ${media.map(({ v, m }) => `<div class="box"><strong>${esc(m.id)}</strong>
        <div class="muted small">${m.kind} · ${left(m.deleted_at)} days left</div>
        <div class="row" style="margin-top:8px"><button class="btn primary" data-rm="${esc(m.id)}" data-v="${esc(v.visit_id)}">Restore</button>
        <button class="btn danger" data-dm="${esc(m.id)}" data-v="${esc(v.visit_id)}">Delete forever</button></div></div>`).join('')}`;
    $('#back').onclick = () => go('#/settings');
    root.onclick = async e => {
      const b = e.target.closest('[data-rv],[data-dv],[data-rm],[data-dm]'); if (!b) return;
      const d = b.dataset;
      if (d.rv) { const v = await DB.getVisit(d.rv); v.deleted_at = null; await DB.putVisit(v, false); toast(`Restored ${d.rv}`); }
      else if (d.rm) { const v = await DB.getVisit(d.v); v.media.find(m => m.id === d.rm).deleted_at = null; await DB.putVisit(v); toast(`Restored ${d.rm}`); }
      else {
        const id = d.dv || d.dm;
        if (!await confirmDlg('Delete forever?', `${id} will be removed from this device and cannot be restored.`, 'Delete forever', true)) return;
        if (d.dv) await DB.deleteVisitForever(d.dv); else await DB.deleteMediaForever(d.v, d.dm);
      }
      root.onclick = null; renderBin();
    };
  }

  /* ---------- service worker + start-up ---------- */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;
    const btn = $('#update');
    navigator.serviceWorker.register('sw.js').then(reg => {
      const check = () => {
        if (reg.waiting && navigator.serviceWorker.controller) {
          btn.hidden = false;
          btn.onclick = async () => { btn.disabled = true; await flushSave(); reg.waiting && reg.waiting.postMessage('SKIP_WAITING'); };
        }
      };
      check();
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (nw) nw.addEventListener('statechange', () => { if (nw.state === 'installed') check(); });
      });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true; location.reload();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { flushSave(); return; }
    // Back in the app: if the system killed the recording, keep what was captured.
    if (Rec.mr) { if (Rec.mr.state === 'inactive') finishRec(); else wakeLock(); }
  });
  window.addEventListener('pagehide', () => { flushSave(); });
  window.addEventListener('hashchange', route);

  (async function start() {
    try {
      countries = await DB.getMeta('countries', DEFAULT_COUNTRIES.slice());
      if (!countries.includes('ZAF')) countries.unshift('ZAF');
      await DB.purgeExpired();
    } catch (e) {
      root.innerHTML = '<p class="pad"><strong>Storage is not available.</strong> Open the app from the Home Screen icon (not a private tab) and try again.</p>';
      return;
    }
    try {
      if (navigator.storage && navigator.storage.persist) {
        persisted = await navigator.storage.persisted() || await navigator.storage.persist();
      }
    } catch (e) { persisted = null; }
    registerSW();
    route();
  })();
})();
