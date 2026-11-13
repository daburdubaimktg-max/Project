'use strict';
/* NEE — Nishant's Eyes and Ears. UI layer. Keep APP_VERSION in step with CACHE_VERSION in sw.js. */
const APP_VERSION = '1.4.1';

(function () {
  const TYPES = [['MV', 'Market visit'], ['HV', 'Home visit'], ['TR', 'Trade'], ['SL', 'Salon'],
    ['IN', 'Informal'], ['MT', 'Meeting'], ['TH', 'Thought']];
  const OUTLETS = ['spaza', 'informal/hawker', 'salon', 'pharmacy chain', 'independent pharmacy', 'supermarket chain',
    'discounter', 'wholesaler/cash & carry', 'beauty store', 'home', 'office', 'other'];
  const DEFAULT_COUNTRIES = ['ZAF', 'NGA', 'GHA', 'KEN', 'EGY'];
  const COUNTRY_NAME = { ZAF: 'South Africa', NGA: 'Nigeria', GHA: 'Ghana', KEN: 'Kenya', EGY: 'Egypt', TZA: 'Tanzania', UGA: 'Uganda',
    ETH: 'Ethiopia', ZMB: 'Zambia', ZWE: 'Zimbabwe', MOZ: 'Mozambique', AGO: 'Angola', CIV: "Côte d'Ivoire", SEN: 'Senegal',
    CMR: 'Cameroon', MAR: 'Morocco', DZA: 'Algeria', TUN: 'Tunisia', RWA: 'Rwanda', BWA: 'Botswana', NAM: 'Namibia',
    ARE: 'United Arab Emirates', SAU: 'Saudi Arabia' };
  const COLOURS = ['', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];
  const EXT = { 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm', 'audio/ogg': 'ogg',
    'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic',
    'image/heif': 'heif', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
    'video/webm': 'webm' };
  const KIND_WORD = { audio: 'Recording', photo: 'Photo', video: 'Video' };
  const DRAFT = 'nee-draft';

  // The seven built-in categories stay; the user can add their own (2-letter code + name).
  let customTypes = [];
  const allTypes = () => [...TYPES, ...customTypes];
  // A visit keeps the category name it was created under, even if the list changes later.
  const typeName = (code, v) => (v && v.visit_type_name) || (allTypes().find(x => x[0] === code) || [code, code])[1];
  const countryLabel = c => (COUNTRY_NAME[c] ? `${c} · ${COUNTRY_NAME[c]}` : c);

  const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON = {
    settings: svg('<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/>'),
    pin: svg('<path d="M7 4h10v16l-5-4-5 4z"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    stop: svg('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>'),
    camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    video: svg('<rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 10l6-3v10l-6-3z"/>'),
    back: svg('<path d="M15 5l-7 7 7 7"/>'),
    more: svg('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'),
    edit: svg('<path d="M4 20l4-1L19 8l-3-3L5 16z"/>'),
    share: svg('<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>'),
    trash: svg('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'),
    calendar: svg('<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
    check: svg('<path d="M5 12l5 5 9-10"/>'),
    list: svg('<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>'),
    chart: svg('<path d="M5 20V11M12 20V4M19 20v-6"/>'),
    book: svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>'),
  };
  const REC_IDLE = `${ICON.mic}<span>Record</span>`, REC_ON = `${ICON.stop}<span>Stop</span>`;

  const root = document.getElementById('app');
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const live = v => v.media.filter(m => !m.deleted_at);
  const needsWarning = v => v.consent_stated !== 'yes' && live(v).some(m => m.kind === 'audio' || m.kind === 'video');
  const notExported = v => !v.exported_at || Date.parse(v.updated_at) > Date.parse(v.exported_at);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const typingIn = el => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|date)$/.test(el.type)));

  let countries = DEFAULT_COUNTRIES.slice();
  let claudeLink = '';
  let filters = { q: '', type: '', country: '', label: '' };
  let cur = null;            // visit open in the editor
  let urls = [];             // object URLs to release when leaving a screen
  let persisted = null;
  let drawToken = 0;
  let offlineReady = false, offlineLate = false;
  let lastDay = U.ymd();

  /* ---------- small helpers ---------- */
  function fmtDate(ymd) {
    const [y, m, d] = String(ymd).split('-').map(Number);
    if (!y || !m || !d) return ymd;
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtBytes(n) {
    if (n == null) return 'unknown size';
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
    if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 ** 3).toFixed(2)} GB`;
  }
  const fmtDur = s => `${Math.floor(s / 60)}:${U.pad(s % 60)}`;
  const durWords = s => (s < 60 ? `${s} sec` : `${Math.round(s / 60)} min`);

  // Messages appear at the top and never block a tap.
  let toastTimer = null;
  function toast(msg, ms = 3500) {
    const t = $('#toast');
    t.hidden = false; t.textContent = msg;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }
  const clearToast = () => { clearTimeout(toastTimer); $('#toast').hidden = true; };

  // A sheet is a real dialog: named, focus moves in and stays in, Escape cancels, focus returns afterwards.
  let dlgN = 0;
  function overlay(html, onCancel) {
    const prev = document.activeElement;
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`;
    const sheet = o.firstChild, h = sheet.querySelector('h2');
    if (h) { h.id = `dlg${++dlgN}`; sheet.setAttribute('aria-labelledby', h.id); }
    const rm = o.remove.bind(o);
    o.remove = () => {
      rm();
      const open = !!document.querySelector('.overlay,.lightbox');
      root.inert = open; document.documentElement.classList.toggle('lock', open);
      if (!open && prev && prev.isConnected && !typingIn(prev) && prev.focus) prev.focus({ preventScroll: true });
    };
    o.cancel = () => { if (onCancel) onCancel(); else o.remove(); };
    o.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); o.cancel(); return; }
      if (e.key !== 'Tab') return;
      const f = [...sheet.querySelectorAll('button,[href],input:not([type=file]),select,textarea,[tabindex="0"]')].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || a === sheet)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    });
    o.addEventListener('click', e => { if (e.target === o) o.cancel(); });
    document.body.appendChild(o);
    sheet.focus({ preventScroll: true });
    return o;
  }
  function confirmDlg(title, msg, okLabel, danger) {
    return new Promise(res => {
      const o = overlay(`<h2>${esc(title)}</h2><p>${esc(msg)}</p><div class="row end">
        <button class="btn" data-x="0">Cancel</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-x="1">${esc(okLabel)}</button></div>`, () => { o.remove(); res(false); });
      o.addEventListener('click', e => {
        const b = e.target.closest('[data-x]');
        if (b) { o.remove(); res(b.dataset.x === '1'); }
      });
    });
  }
  const options = (list, sel, blank) => (blank != null ? `<option value="">${esc(blank)}</option>` : '') +
    list.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`; }).join('');

  // Grow a text box with its content so the page scrolls as one piece (no scroll-inside-scroll).
  let fitRaf = 0;
  function fit(el) {
    const y = window.scrollY;
    el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`;
    if (window.scrollY !== y) window.scrollTo(0, y);
  }
  const fitSoon = el => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(() => fit(el)); };

  /* ---------- saving ----------
     Only the fields that changed are written, on top of what is stored, so nothing else is overwritten.
     Every keystroke is also mirrored to a small on-device draft, so text typed just before the app
     is closed or reloaded is recovered the next time it opens. A failed save is retried. */
  let saveTimer = null, saveWarned = false;
  const dirty = new Map();   // field → change counter
  const saveState = t => { const el = $('#saveState'); if (el) el.textContent = t; };
  const patchOf = () => { const p = {}; for (const f of dirty.keys()) p[f] = cur[f]; return p; };
  function writeDraft() {
    try {
      if (cur && dirty.size) localStorage.setItem(DRAFT, JSON.stringify({ id: cur.visit_id, patch: patchOf() }));
      else localStorage.removeItem(DRAFT);
    } catch (e) { /* draft is a safety net only */ }
  }
  function mark(...fields) {
    for (const f of fields) dirty.set(f, (dirty.get(f) || 0) + 1);
    writeDraft();
    clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 400);
    saveState('Saving…');
  }
  async function flushSave() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!cur || !dirty.size) return true;
    const id = cur.visit_id, sent = new Map(dirty), patch = patchOf();
    try {
      const v = await DB.patchVisit(id, patch);
      for (const [f, n] of sent) if (dirty.get(f) === n) dirty.delete(f);
      if (cur && cur.visit_id === id) {
        if (v) { cur.updated_at = v.updated_at; cur.end_time = v.end_time; }
        writeDraft();
        if (dirty.size) saveTimer = setTimeout(flushSave, 400); else saveState('Saved');
      }
      saveWarned = false;
      return true;
    } catch (e) {
      saveState('Not saved — retrying');
      if (!saveWarned) { saveWarned = true; toast('Could not save. Your text is kept and the app will keep trying. Free some space if the phone is full.', 8000); }
      if (cur && cur.visit_id === id) saveTimer = setTimeout(flushSave, 3000);
      return false;
    }
  }
  // Apply a draft left behind by a closed app or a failed save. Returns true if nothing is left pending.
  async function applyDraft() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { d = null; }
    if (!d || typeof d.id !== 'string' || !d.patch) return true;
    try { await DB.patchVisit(d.id, d.patch); localStorage.removeItem(DRAFT); return true; } catch (e) { return false; }
  }
  // Text typed into an "add" box but not yet added is added rather than dropped.
  function commitPending() {
    if (!cur) return;
    if ($('#checkNew') && $('#checkNew').value.trim()) addCheck();
    if ($('#labelNew') && $('#labelNew').value.trim()) addLabel();
  }

  /* ---------- routing ---------- */
  // Screens render one at a time, so quick taps can never mix two screens together.
  let routeChain = Promise.resolve(), view = '', homeScroll = 0;
  function route() { routeChain = routeChain.then(doRoute).catch(() => {}); return routeChain; }
  async function doRoute() {
    await leave();
    lastDay = U.ymd();
    const h = location.hash;
    if (h.startsWith('#/v/')) { view = 'visit'; return renderVisit(decodeURIComponent(h.slice(4))); }
    if (h === '#/settings') { view = 'settings'; return renderSettings(); }
    if (h === '#/summary') { view = 'summary'; return renderSummary(); }
    if (h === '#/bin') { view = 'bin'; return renderBin(); }
    view = 'home';
    await renderHome();
    window.scrollTo(0, homeScroll);
  }
  async function leave() {
    if (view === 'home') homeScroll = window.scrollY;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    commitPending();
    if (Rec.mr || Rec.starting) await stopRec();
    await flushSave();              // if this fails, the draft keeps the text and it is applied on next open
    clearTimeout(saveTimer); saveTimer = null; dirty.clear();
    urls.forEach(u => URL.revokeObjectURL(u)); urls = []; mediaUrl.clear();
    cur = null; drawToken++; root.onclick = null;
    document.querySelectorAll('.overlay,.lightbox').forEach(n => n.remove());
    clearToast();
    window.scrollTo(0, 0);
  }
  const go = h => { if (location.hash === h) { route(); } else { location.hash = h; } };

  /* ---------- home (Keep-style list) ---------- */
  const placeOf = v => [v.suburb, v.city].filter(Boolean).join(', ');
  function dayLabel(ymd) {
    const t = new Date(), y = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
    return ymd === U.ymd(t) ? 'Today' : ymd === U.ymd(y) ? 'Yesterday' : fmtDate(ymd);
  }
  const tabbar = on => `<nav class="tabbar" aria-label="Sections"><div class="in"><a href="#/" class="${on === 'home' ? 'on' : ''}"${on === 'home' ? ' aria-current="page"' : ''}>${ICON.list}Visits</a>
    <a href="#/summary" class="${on === 'summary' ? 'on' : ''}"${on === 'summary' ? ' aria-current="page"' : ''}>${ICON.chart}Summary</a></div></nav>`;

  async function renderHome() {
    const all = (await DB.getVisits()).filter(v => !v.deleted_at);
    const labels = [...new Set(all.flatMap(v => v.labels))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const ctry = [...new Set(all.map(v => v.country))].sort();
    const present = [...new Set(all.map(v => v.visit_type))];
    const types = present.map(c => [c, typeName(c, all.find(v => v.visit_type === c))])
      .sort((a, b) => (allTypes().findIndex(t => t[0] === a[0]) + 1 || 99) - (allTypes().findIndex(t => t[0] === b[0]) + 1 || 99));
    if (filters.type && !present.includes(filters.type)) filters.type = '';
    if (filters.country && !ctry.includes(filters.country)) filters.country = '';
    if (filters.label && !labels.includes(filters.label)) filters.label = '';
    const today = all.filter(v => v.date === U.ymd()).length;
    root.innerHTML = `
      <header class="bar home"><div class="grow"><h1>Eyes &amp; Ears</h1>
        <div class="today">${esc(fmtDate(U.ymd()))} · ${today ? `${plural(today, 'visit')} today` : 'no visits yet today'}</div></div>
        <button class="btn icon" id="toSettings" aria-label="Settings">${ICON.settings}</button></header>
      <div id="banners"></div>
      ${all.length ? `<input id="q" type="search" placeholder="Search visits" aria-label="Search visits"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" value="${esc(filters.q)}">
      <div class="tchips" id="tchips" role="group" aria-label="Filter by category"></div>
      ${ctry.length > 1 || labels.length ? `<div class="filters">
        ${ctry.length > 1 ? `<select id="fCountry" aria-label="Filter by country">${options(ctry.map(c => [c, countryLabel(c)]), filters.country, 'All countries')}</select>` : ''}
        ${labels.length ? `<select id="fLabel" aria-label="Filter by label">${options(labels, filters.label, 'All labels')}</select>` : ''}
      </div>` : ''}` : ''}
      <div id="list"></div>
      <button class="fab" id="fab">${ICON.plus}New visit</button>
      ${tabbar('home')}`;
    $('#toSettings').onclick = () => go('#/settings');
    $('#fab').onclick = () => newVisitSheet(all);
    const drawTypes = () => {
      const box = $('#tchips'); if (!box) return;
      box.innerHTML = types.length < 2 ? '' : [['', 'All'], ...types].map(t =>
        `<button class="tchip ${filters.type === t[0] ? 'on' : ''}" data-ft="${esc(t[0])}" aria-pressed="${filters.type === t[0]}">${esc(t[1])}</button>`).join('');
    };
    if ($('#q')) {
      $('#q').oninput = e => { filters.q = e.target.value; drawList(all); };
      $('#tchips').onclick = e => {
        const b = e.target.closest('[data-ft]'); if (!b) return;
        filters.type = b.dataset.ft; drawTypes(); drawList(all);
      };
      if ($('#fCountry')) $('#fCountry').onchange = e => { filters.country = e.target.value; drawList(all); };
      if ($('#fLabel')) $('#fLabel').onchange = e => { filters.label = e.target.value; drawList(all); };
    }
    $('#list').onclick = async e => {
      const pin = e.target.closest('[data-pin]'), day = e.target.closest('[data-day]');
      if (e.target.closest('#clearF')) { filters = { q: '', type: '', country: '', label: '' }; return route(); }
      if (pin) {
        const v = all.find(x => x.visit_id === pin.dataset.pin);
        v.pinned = !v.pinned;
        await DB.patchVisit(v.visit_id, { pinned: v.pinned }, false);
        drawList(all); toast(v.pinned ? 'Pinned — moved to the top' : 'Unpinned');
      } else if (day) exportFlow('day', day.dataset.day);
    };
    drawTypes(); drawList(all); drawBanners(all);
  }

  function matches(v) {
    if (filters.type && v.visit_type !== filters.type) return false;
    if (filters.country && v.country !== filters.country) return false;
    if (filters.label && !v.labels.includes(filters.label)) return false;
    const q = fold(filters.q.trim());
    if (!q) return true;
    const hay = fold([v.visit_id, typeName(v.visit_type, v), v.summary, v.text_raw, v.typed_notes, v.city, v.suburb, v.outlet_type,
      v.who_role, v.country, COUNTRY_NAME[v.country], v.date, fmtDate(v.date), v.labels.join(' '), v.checklist.map(c => c.text).join(' ')].join('\n'));
    return q.split(/\s+/).every(w => hay.includes(w));
  }

  function card(v, showDay) {
    const m = live(v), n = k => m.filter(x => x.kind === k).length;
    const counts = [[n('audio'), ICON.mic, 'audio'], [n('photo'), ICON.camera, 'photo'], [n('video'), ICON.video, 'video']]
      .filter(c => c[0]).map(c => `<span class="chip" aria-label="${c[0]} ${c[2]}">${c[1]}${c[0]}</span>`).join('');
    const place = placeOf(v);
    const snip = [v.summary, v.text_raw, v.typed_notes].map(s => (s || '').trim()).find(Boolean) || '';
    const todo = v.checklist.filter(c => !c.done).length;
    return `<div class="card ${COLOURS.includes(v.colour) && v.colour ? 'col-' + v.colour : ''}">
      <a href="#/v/${encodeURIComponent(v.visit_id)}">
        <div class="ctitle"><span class="tbadge">${esc(v.visit_type)}</span><span class="ctext">${esc(typeName(v.visit_type, v))}${place ? ` · ${esc(place)}` : ''}</span></div>
        <div class="cid">${esc(v.visit_id)} · ${showDay ? esc(dayLabel(v.date)) + ' ' : ''}${esc(v.start_time)}</div>
        ${snip ? `<div class="snip">${esc(snip.slice(0, 200))}</div>` : '<div class="snip muted">Nothing captured yet</div>'}
        <div class="chips">${needsWarning(v) ? '<span class="chip warn">⚠ Recorded without consent</span>' : ''}${counts}${todo ? `<span class="chip">${ICON.check}${todo} to do</span>` : ''}${v.labels.map(l => `<span class="chip">${esc(l)}</span>`).join('')}${notExported(v) ? '' : '<span class="chip ok">Exported</span>'}</div>
      </a>
      <button class="pinbtn ${v.pinned ? 'on' : ''}" data-pin="${esc(v.visit_id)}" aria-pressed="${v.pinned}" aria-label="Pin ${esc(v.visit_id)}">${ICON.pin}</button>
    </div>`;
  }

  function drawList(all) {
    const vs = all.filter(matches).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at) || b.visit_id.localeCompare(a.visit_id));
    const box = $('#list');
    const filtered = !!(filters.q.trim() || filters.type || filters.country || filters.label);
    if (!all.length) {
      box.innerHTML = `<div class="empty">${ICON.book}<strong>Ready for your first visit</strong>
        <ol><li>Tap <b>New visit</b> and pick the type.</li><li>Dictate, record, and take photos or videos.</li><li>In the evening, tap <b>Export day</b> and share it.</li></ol></div>`;
      return;
    }
    const clear = filtered ? `<p class="fcount">${vs.length} of ${all.length} visits shown · <button class="link" id="clearF">Clear search and filters</button></p>` : '';
    if (!vs.length) { box.innerHTML = `${clear}<div class="empty"><strong>No matches</strong>Try a different search or filter.</div>`; return; }
    let html = clear;
    const pinned = vs.filter(v => v.pinned);
    if (pinned.length) html += `<div class="ghead"><h3>Pinned</h3></div>${pinned.map(v => card(v, true)).join('')}`;
    for (const date of [...new Set(vs.map(v => v.date))]) {
      const total = all.filter(x => x.date === date).length, shown = vs.filter(x => x.date === date);
      const rest = shown.filter(v => !v.pinned);
      html += `<div class="ghead"><h3>${esc(dayLabel(date))} <span class="count">${shown.length === total ? total : `${shown.length} of ${total}`}</span></h3>
        <button class="btn" data-day="${esc(date)}" aria-label="Export all ${total} visits of ${esc(dayLabel(date))}">${ICON.share}Export day</button></div>
        ${rest.length ? rest.map(v => card(v, false)).join('') : '<p class="muted small">Pinned — shown at the top.</p>'}`;
    }
    box.innerHTML = html;
  }

  async function drawBanners(all) {
    const box = $('#banners'); if (!box) return;
    let html = '';
    const today = U.ymd();
    const pend = all.filter(notExported);
    const earlier = pend.filter(v => v.date < today), now = pend.filter(v => v.date === today);
    const due = [...earlier, ...(new Date().getHours() >= 18 ? now : [])];
    const oldest = due.map(v => v.date).sort()[0];
    if (due.length) {
      html += `<div class="banner"><span class="grow">${plural(due.length, 'visit')} not exported yet${earlier.length ? ` (${earlier.length} from earlier days)` : ''}.</span><button class="btn" id="remExport">Export ${esc(dayLabel(oldest).toLowerCase())}</button></div>`;
    }
    if (isIOS && !isStandalone()) html += `<div class="banner"><span class="grow">Opened in Safari. Add to Home Screen and always open from the icon, or your visits may not be kept.</span></div>`;
    else if (persisted === false && !sessionStorage.getItem('hidePersist')) {
      html += `<div class="banner soft"><span class="grow">This device may clear the app's data when space runs low. Install the app and export every evening.</span><button class="btn" id="hidePersist">OK</button></div>`;
    }
    if ('serviceWorker' in navigator && !offlineReady && offlineLate) {
      html += `<div class="banner"><span class="grow">Not ready to work without signal yet. Keep the app open with signal for a moment, then reopen it.</span></div>`;
    }
    box.innerHTML = html;
    const h = $('#hidePersist'); if (h) h.onclick = () => { sessionStorage.setItem('hidePersist', '1'); drawBanners(all); };
    const r = $('#remExport'); if (r) r.onclick = () => exportFlow('day', oldest);
  }

  /* ---------- new visit ---------- */
  function newVisitSheet(all) {
    const uniq = k => [...new Set(all.map(v => v[k]).filter(Boolean))];
    const noAttr = 'autocomplete="off" autocorrect="off" spellcheck="false"';
    let type = '', consent = 'no', outletTouched = false;
    const o = overlay(`
      <h2>New visit</h2>
      <div class="types" id="nvTypes" role="group" aria-label="Category"></div>
      <div class="grid2">
        <label class="f">Country<select id="nvCountry">${options(countries.map(c => [c, countryLabel(c)]), 'ZAF')}</select></label>
        <label class="f">City<input type="text" id="nvCity" list="dlCity" ${noAttr}></label>
      </div>
      <datalist id="dlCity">${uniq('city').map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="grid2">
        <label class="f">Suburb<input type="text" id="nvSuburb" list="dlSuburb" ${noAttr}></label>
        <label class="f">Outlet type<select id="nvOutlet">${options(OUTLETS, '', '—')}</select></label>
      </div>
      <datalist id="dlSuburb">${uniq('suburb').map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <label class="f">Who — role or first name only<input type="text" id="nvWho" ${noAttr}></label>
      <div class="flabel" id="nvCL">Did they say yes to being recorded?</div>
      <div class="seg" id="nvConsent" role="group" aria-labelledby="nvCL"><button class="btn" data-c="yes" aria-pressed="false">Yes, consent stated</button><button class="btn on" data-c="no" aria-pressed="true">No</button></div>
      <div class="row end"><button class="btn" id="nvCancel">Cancel</button><button class="btn primary grow" id="nvCreate" disabled>Choose a category</button></div>`);
    const create = $('#nvCreate', o), outlet = $('#nvOutlet', o);
    outlet.onchange = () => { outletTouched = true; };
    const tiles = () => {
      $('#nvTypes', o).innerHTML = allTypes().map(t => `<button class="btn ${t[0] === type ? 'on' : ''}" data-t="${esc(t[0])}" aria-pressed="${t[0] === type}"><strong>${esc(t[0])}</strong><span>${esc(t[1])}</span></button>`).join('') +
        `<button class="btn dashed" data-newtype>${ICON.plus}New category</button>`;
    };
    const pick = code => {
      type = code; tiles();
      const b = $(`#nvTypes [data-t="${code}"]`, o); if (b) b.focus({ preventScroll: true });
      if (!outletTouched) outlet.value = type === 'HV' ? 'home' : type === 'SL' ? 'salon' : '';
      create.disabled = false; create.textContent = `Start: ${typeName(type)}`;
    };
    tiles();
    $('#nvTypes', o).onclick = e => {
      if (e.target.closest('[data-newtype]')) return addTypeSheet(pick);
      const b = e.target.closest('[data-t]'); if (b) pick(b.dataset.t);
    };
    $('#nvConsent', o).onclick = e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      consent = b.dataset.c;
      o.querySelectorAll('[data-c]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    };
    $('#nvCancel', o).onclick = () => o.remove();
    create.onclick = async () => {
      create.disabled = true;
      try {
        const v = await DB.createVisit({ visit_type: type, country: $('#nvCountry', o).value, city: $('#nvCity', o).value,
          suburb: $('#nvSuburb', o).value, outlet_type: outlet.value, who_role: $('#nvWho', o).value,
          consent_stated: consent, visit_type_name: (customTypes.find(t => t[0] === type) || [])[1] || '' }, APP_VERSION);
        o.remove(); go(`#/v/${encodeURIComponent(v.visit_id)}`);
      } catch (e) { create.disabled = false; toast('Could not create the visit — storage error.'); }
    };
  }

  /* ---------- custom categories ---------- */
  const cleanName = s => s.replace(/\s+/g, ' ').trim();
  function suggestCode(name) {
    const letters = name.normalize('NFD').toUpperCase().replace(/[^A-Z ]/g, '');
    const w = letters.split(/\s+/).filter(Boolean), used = new Set(allTypes().map(t => t[0])), c = [];
    if (w.length > 1) c.push(w[0][0] + w[1][0]);
    if (w[0]) for (let i = 1; i < w[0].length; i++) c.push(w[0][0] + w[0][i]);
    const all = letters.replace(/ /g, '');
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) c.push(all[i] + all[j]);
    return c.find(x => !used.has(x)) || '';
  }
  function addTypeSheet(done) {
    let codeTouched = false;
    const o = overlay(`<h2>New category</h2>
      <label class="f">Name<input type="text" id="ntName" placeholder="e.g. Competitor store" maxlength="30" autocomplete="off" autocorrect="off" spellcheck="false"></label>
      <label class="f">2-letter code<input type="text" id="ntCode" maxlength="2" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false"></label>
      <p class="small muted" id="ntHint">Type any 2 letters. The code appears in visit IDs.</p>
      <div class="row end"><button class="btn" id="ntCancel">Cancel</button><button class="btn primary grow" id="ntSave">Add category</button></div>`);
    const name = $('#ntName', o), code = $('#ntCode', o);
    const hint = () => { $('#ntHint', o).textContent = /^[A-Za-z]{2}$/.test(code.value) ? `Visit IDs will look like AFC-ZAF-${U.ymd().replace(/-/g, '')}-${code.value.toUpperCase()}01.` : 'Type any 2 letters. The code appears in visit IDs.'; };
    name.oninput = () => { if (!codeTouched) { code.value = suggestCode(name.value); hint(); } };
    code.oninput = () => { codeTouched = true; hint(); };
    $('#ntCancel', o).onclick = () => o.remove();
    $('#ntSave', o).onclick = async () => {
      const n = cleanName(name.value), c = code.value.trim().toUpperCase();
      if (!n) return toast('Give the category a name');
      if (!/^[A-Z]{2}$/.test(c)) return toast('The code must be 2 letters, A to Z');
      if (allTypes().some(t => t[0] === c)) return toast(`${c} is already used by “${typeName(c)}”`);
      if (allTypes().some(t => fold(t[1]) === fold(n))) return toast('That category already exists');
      const old = (await DB.getVisits()).find(v => v.visit_type === c && v.visit_type_name && fold(v.visit_type_name) !== fold(n));
      if (old) return toast(`${c} was already used for “${old.visit_type_name}” visits. Choose another code.`, 6000);
      customTypes.push([c, n]); await DB.setMeta('customTypes', customTypes);
      o.remove(); toast(`Added ${n}`); if (done) done(c);
    };
  }

  /* ---------- sending to the Claude Project ---------- */
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through to the older method */ }
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(t); t.select(); t.setSelectionRange(0, text.length);
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    t.remove(); return ok;
  }
  // Copies the text, then shows the next step: open the project and paste.
  async function claudeStep(box, text, what) {
    if (!await copyText(text)) { box.innerHTML = '<p class="warnbox">Could not copy on this device.</p>'; return false; }
    box.innerHTML = `<div class="box next"><strong>${ICON.check}${esc(what)} copied</strong>
      <p class="small">${claudeLink ? 'Open your project, paste into the chat and send.' : 'Open your Claude Project, paste into the chat and send. Add your project link in Settings to open it from here.'}</p>
      ${claudeLink ? `<a class="btn primary block" href="${esc(claudeLink)}" target="_blank" rel="noopener noreferrer">Open my Claude Project</a>` : ''}</div>`;
    box.scrollIntoView({ block: 'nearest' });
    return true;
  }

  /* ---------- summary ---------- */
  let sumRange = 'week';
  function rangeOf(k) {
    const t = new Date(), y = t.getFullYear(), m = t.getMonth(), d0 = new Date(y, m, t.getDate());
    if (k === 'today') return [U.ymd(d0), U.ymd(d0), 'Today'];
    if (k === 'week') {
      const a = new Date(d0); a.setDate(a.getDate() - (d0.getDay() + 6) % 7);
      const b = new Date(a); b.setDate(b.getDate() + 6);
      return [U.ymd(a), U.ymd(b), 'This week'];
    }
    if (k === 'month') return [U.ymd(new Date(y, m, 1)), U.ymd(new Date(y, m + 1, 0)), 'This month'];
    return ['', '9999-99-99', 'All time'];
  }
  const chrono = (a, b) => a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || '') || a.visit_id.localeCompare(b.visit_id);
  function summarise(vs) {
    // Group without regard to capitals or stray spaces; show the first spelling seen.
    const tally = (arr, key) => {
      const o = new Map();
      for (const x of arr) { const k = cleanName(String(key(x) || '')); if (!k) continue; const f = fold(k); const e = o.get(f) || [k, 0]; e[1]++; o.set(f, e); }
      return [...o.values()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    };
    const media = vs.flatMap(live), kind = k => media.filter(x => x.kind === k);
    return {
      n: vs.length, days: new Set(vs.map(v => v.date)).size,
      photos: kind('photo').length, videos: kind('video').length, audio: kind('audio').length,
      audioSec: kind('audio').reduce((t, x) => t + (x.duration_s || 0), 0),
      byType: tally(vs, v => typeName(v.visit_type, v)), byCountry: tally(vs, v => COUNTRY_NAME[v.country] || v.country),
      byPlace: tally(vs, v => v.city || 'No city given'), byLabel: tally(vs.flatMap(v => v.labels), l => l),
      todos: vs.slice().sort(chrono).flatMap(v => v.checklist.filter(c => !c.done && c.text.trim()).map(c => ({ v, text: c.text }))),
      pending: vs.filter(notExported), noConsent: vs.filter(needsWarning),
    };
  }
  function summaryText(vs, s, label) {
    const dates = vs.map(v => v.date).sort(), a = dates[0], b = dates[dates.length - 1];
    const span = a === b ? fmtDate(a) : `${fmtDate(a)} to ${fmtDate(b)}`;
    const list = arr => arr.map(x => `${x[0]} ${x[1]}`).join(', ') || 'none';
    const L = [`FIELD SUMMARY — Eyes & Ears (NEE) — ${label}: ${span}`, `Generated ${U.iso().slice(0, 16).replace('T', ' ')}`, '',
      `Visits: ${s.n} over ${plural(s.days, 'day')}`, `By category: ${list(s.byType)}`, `By country: ${list(s.byCountry)}`, `By place: ${list(s.byPlace)}`,
      `Captured: ${plural(s.photos, 'photo')}, ${plural(s.videos, 'video')}, ${s.audio} audio (${durWords(s.audioSec)})`];
    if (s.byLabel.length) L.push(`Labels: ${list(s.byLabel)}`);
    L.push(`Not yet exported: ${s.pending.length}`);
    if (s.noConsent.length) L.push(`Recorded with consent = no: ${s.noConsent.map(v => v.visit_id).join(', ')}`);
    L.push('', `Open to-dos (${s.todos.length}):`);
    for (const t of s.todos) L.push(`- [${t.v.visit_id}] ${t.text}`);
    L.push('', 'Visits:');
    for (const v of vs.slice().sort(chrono)) {
      L.push(`- ${v.visit_id} · ${typeName(v.visit_type, v)}${placeOf(v) ? ' · ' + placeOf(v) : ''}${v.outlet_type ? ' · ' + v.outlet_type : ''}${v.who_role ? ' · ' + v.who_role : ''} · ${v.date} ${v.start_time} · consent ${v.consent_stated}`);
      const sm = (v.summary || '').trim();
      if (sm) for (const line of sm.split('\n')) L.push(`    ${line}`);
      else L.push('    (no summary written)');
    }
    return L.join('\n') + '\n';
  }

  async function renderSummary() {
    const all = (await DB.getVisits()).filter(v => !v.deleted_at);
    const [from, to, label] = rangeOf(sumRange);
    const vs = all.filter(v => v.date >= from && v.date <= to), s = summarise(vs);
    const bars = (rows, cap) => {
      const max = Math.max(1, ...rows.map(r => r[1])), top = rows.slice(0, cap), rest = rows.slice(cap);
      const row = r => `<div class="barrow"><span class="bl">${esc(r[0])}</span><span class="bt"><span style="width:${Math.round(r[1] / max * 100)}%"></span></span><span class="bn">${r[1]}</span></div>`;
      return top.map(row).join('') + (rest.length ? row([`${rest.length} more places`, rest.reduce((t, r) => t + r[1], 0)]) : '');
    };
    const withSum = vs.filter(v => (v.summary || '').trim()).sort((a, b) => chrono(b, a));
    root.innerHTML = `
      <header class="bar home"><div class="grow"><h1>Summary</h1>
        <div class="today">${label === 'All time' ? 'Everything on this device' : from === to ? esc(fmtDate(from)) : `${esc(fmtDate(from))} – ${esc(fmtDate(to))}`}</div></div></header>
      <div class="tchips" id="ranges" role="group" aria-label="Period">${[['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['all', 'All time']].map(r =>
        `<button class="tchip ${sumRange === r[0] ? 'on' : ''}" data-r="${r[0]}" aria-pressed="${sumRange === r[0]}">${r[1]}</button>`).join('')}</div>
      ${!vs.length ? `<div class="empty">${ICON.chart}<strong>No visits in this period</strong>Pick another period, or start a visit from the Visits tab.</div>` : `
      <div class="stats">
        <div class="stat"><b>${s.n}</b><span>visit${s.n === 1 ? '' : 's'} · ${plural(s.days, 'day')}</span></div>
        <div class="stat"><b>${s.photos}</b><span>photo${s.photos === 1 ? '' : 's'}</span></div>
        <div class="stat"><b>${s.videos}</b><span>video${s.videos === 1 ? '' : 's'}</span></div>
        <div class="stat"><b>${s.audioSec < 60 ? s.audioSec : Math.round(s.audioSec / 60)}<small> ${s.audioSec < 60 ? 'sec' : 'min'}</small></b><span>${s.audio} audio</span></div>
      </div>
      ${s.pending.length ? `<div class="banner"><span class="grow">${s.pending.length} of ${plural(s.n, 'visit')} not exported yet.</span></div>` : '<p class="chips"><span class="chip ok">All visits in this period are exported</span></p>'}
      ${s.noConsent.length ? `<div class="warnbox">⚠ ${s.noConsent.length} visit${s.noConsent.length === 1 ? ' has' : 's have'} audio or video with consent marked No.</div>` : ''}
      <div class="actions tight">
        <button class="btn primary block" id="sumClaude">${ICON.share}Copy summary for my Claude Project</button>
        <div id="sumNext"></div>
        ${navigator.share ? `<button class="btn block" id="sumShare">Share summary…</button>` : ''}
      </div>
      <h3>By category</h3><div class="box">${bars(s.byType, 12)}</div>
      ${s.byCountry.length > 1 ? `<h3>By country</h3><div class="box">${bars(s.byCountry, 12)}</div>` : ''}
      <h3>By place</h3><div class="box">${bars(s.byPlace, 8)}</div>
      ${s.byLabel.length ? `<h3>Labels</h3><div class="chips">${s.byLabel.map(l => `<span class="chip">${esc(l[0])} · ${l[1]}</span>`).join('')}</div>` : ''}
      <h3>Open to-dos <span class="count">${s.todos.length}</span></h3>
      ${s.todos.length ? `<div class="box todos">${s.todos.slice(0, 30).map(t => `<a href="#/v/${encodeURIComponent(t.v.visit_id)}"><span>${esc(t.text)}</span><small>${esc(typeName(t.v.visit_type, t.v))}${placeOf(t.v) ? ' · ' + esc(placeOf(t.v)) : ''} · ${esc(dayLabel(t.v.date))}</small></a>`).join('')}
        ${s.todos.length > 30 ? `<p class="muted small">+ ${s.todos.length - 30} more — all are included in the copied summary.</p>` : ''}</div>` : '<p class="muted">Nothing open.</p>'}
      ${withSum.length ? `<h3>Visit summaries <span class="count">${withSum.length}</span></h3><div class="box todos">${withSum.slice(0, 30).map(v =>
        `<a href="#/v/${encodeURIComponent(v.visit_id)}"><small>${esc(typeName(v.visit_type, v))}${placeOf(v) ? ' · ' + esc(placeOf(v)) : ''} · ${esc(dayLabel(v.date))}</small><span class="pre clamp">${esc(v.summary.trim())}</span></a>`).join('')}
        ${withSum.length > 30 ? `<p class="muted small">+ ${withSum.length - 30} more — all are included in the copied summary.</p>` : ''}</div>` : ''}`}
      ${tabbar('summary')}`;
    $('#ranges').onclick = e => { const b = e.target.closest('[data-r]'); if (b) { sumRange = b.dataset.r; renderSummary(); } };
    if (!vs.length) return;
    const text = summaryText(vs, s, label);
    $('#sumClaude').onclick = () => claudeStep($('#sumNext'), text, 'Summary');
    if ($('#sumShare')) $('#sumShare').onclick = async () => {
      try { await navigator.share({ text }); } catch (e) { if (e.name !== 'AbortError') toast('Share did not open. Use “Copy summary” instead.'); }
    };
  }

  /* ---------- visit editor ---------- */
  async function renderVisit(id) {
    await applyDraft();
    const v = await DB.getVisit(id);
    if (!v) return void go('#/');
    if (v.deleted_at) return void go('#/bin');
    cur = v;
    const all = await DB.getVisits();
    const allLabels = [...new Set(all.flatMap(x => x.labels))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const noAttr = 'autocomplete="off" autocorrect="off" spellcheck="false"';
    const ta = 'autocorrect="off" spellcheck="false" autocapitalize="sentences"';
    root.innerHTML = `
      <header class="bar"><button class="btn icon" id="back" aria-label="Back to visits">${ICON.back}</button>
        <span class="grow savestate" id="saveState"></span>
        <button class="recpill" id="recPill" hidden aria-label="Stop recording"></button>
        <button class="btn icon" id="pin" aria-label="Pin">${ICON.pin}</button>
        <button class="btn icon" id="more" aria-label="More actions: export, details, delete">${ICON.more}</button></header>
      <div class="vhead">
        <div class="vtitle"><span class="tbadge">${esc(v.visit_type)}</span><h1>${esc(typeName(v.visit_type, v))}</h1></div>
        <button class="vsub" id="editDetails"><span id="sum"></span>${ICON.edit}</button>
        <div class="chips"><button class="chip vid" id="copyId" aria-label="Copy visit ID">${esc(v.visit_id)}</button><span class="chip" id="when"></span><button class="chip" id="cchip"></button></div>
      </div>
      <div id="warn"></div>
      <h2 class="sec">What you saw and heard</h2>
      <textarea id="txt" aria-label="What you saw and heard — dictation" placeholder="Tap here, then use the microphone key on your keyboard to dictate…" ${ta}></textarea>
      <h2 class="sec">Photos, videos and audio</h2>
      <div id="media"><div class="mgrid" id="mgrid"></div><div id="maudio"></div></div>
      <h2 class="sec">Visit summary</h2>
      <textarea id="vsum" aria-label="Visit summary" placeholder="Key takeaways from this visit, in your own words…" ${ta}></textarea>
      <h2 class="sec">Typed notes</h2>
      <textarea id="notes" aria-label="Typed notes" placeholder="Prices, names of products, follow-ups…" ${ta}></textarea>
      <h2 class="sec">Checklist</h2><div id="check"></div>
      <div class="addrow"><input type="text" id="checkNew" placeholder="Add an item" aria-label="New checklist item" enterkeyhint="done" ${noAttr}><button class="btn" id="checkAdd">Add</button></div>
      <h2 class="sec">Labels</h2><div class="chips" id="labels"></div>
      <div class="addrow"><input type="text" id="labelNew" list="dlLabels" placeholder="Add a label" aria-label="New label" enterkeyhint="done" ${noAttr}><button class="btn" id="labelAdd">Add</button></div>
      <datalist id="dlLabels">${allLabels.map(l => `<option value="${esc(l)}">`).join('')}</datalist>
      <h2 class="sec">Colour</h2><div class="swatches" id="colours" role="group" aria-label="Card colour"></div>
      <div class="capture"><div class="in">
        <label class="btn" id="photoBtn" role="button" tabindex="0">${ICON.camera}Photo<input type="file" id="photoIn" accept="image/*" capture="environment" tabindex="-1"></label>
        <button class="btn" id="recBtn" aria-label="Record audio">${REC_IDLE}</button>
        <label class="btn" id="videoBtn" role="button" tabindex="0">${ICON.video}Video<input type="file" id="videoIn" accept="video/*" capture="environment" tabindex="-1"></label>
      </div></div>`;
    // Set text through .value so it is stored and shown exactly as entered.
    $('#txt').value = v.text_raw; $('#notes').value = v.typed_notes; $('#vsum').value = v.summary || '';
    fit($('#txt')); fit($('#notes')); fit($('#vsum'));

    $('#back').onclick = () => go('#/');
    $('#txt').oninput = e => { cur.text_raw = e.target.value; fitSoon(e.target); mark('text_raw'); };
    $('#notes').oninput = e => { cur.typed_notes = e.target.value; fitSoon(e.target); mark('typed_notes'); };
    $('#vsum').oninput = e => { cur.summary = e.target.value; fitSoon(e.target); mark('summary'); };
    $('#pin').onclick = () => { cur.pinned = !cur.pinned; drawHead(); mark('pinned'); };
    $('#more').onclick = moreSheet;
    $('#editDetails').onclick = detailsSheet;
    $('#cchip').onclick = detailsSheet;
    $('#recPill').onclick = () => stopRec();
    $('#copyId').onclick = async () => { toast(await copyText(cur.visit_id) ? 'Visit ID copied' : cur.visit_id); };
    $('#checkAdd').onclick = addCheck;
    $('#checkNew').onkeydown = e => { if (e.key === 'Enter') addCheck(); };
    $('#labelAdd').onclick = addLabel;
    $('#labelNew').onkeydown = e => { if (e.key === 'Enter') addLabel(); };
    $('#colours').onclick = e => {
      const b = e.target.closest('[data-col]'); if (!b) return;
      cur.colour = b.dataset.col; drawColours(); mark('colour');
      const n = $(`#colours [data-col="${cur.colour}"]`); if (n) n.focus({ preventScroll: true });
    };
    $('#recBtn').onclick = () => (Rec.mr ? stopRec() : startRec());
    // Tapping Record must not take the cursor out of the text box, so dictation can carry on.
    $('#recBtn').onmousedown = e => { if (typingIn(document.activeElement)) e.preventDefault(); };
    for (const [btn, input, kind] of [['#photoBtn', '#photoIn', 'photo'], ['#videoBtn', '#videoIn', 'video']]) {
      $(input).onchange = e => addFiles(e.target, kind);
      $(btn).onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $(input).click(); } };
    }
    $('#media').onclick = e => {
      const t = e.target.closest('[data-open]'), d = e.target.closest('[data-dm]');
      if (t) viewer(t.dataset.open); else if (d) deleteMedia(d.dataset.dm);
    };
    drawHead(); drawCheck(); drawLabels(); drawColours(); drawMedia(); drawRecUI();
  }

  let lastWarn = null;
  function drawHead() {
    const v = cur; if (!v || !$('#pin')) return;
    $('#pin').classList.toggle('on', v.pinned); $('#pin').setAttribute('aria-pressed', v.pinned);
    const sum = [placeOf(v), v.outlet_type, v.who_role].filter(Boolean).join(' · ');
    $('#sum').textContent = sum || 'Add place and details';
    $('#sum').classList.toggle('muted', !sum);
    $('#when').textContent = `${dayLabel(v.date)} · ${v.start_time}${v.end_time && v.end_time !== v.start_time ? '–' + v.end_time : ''}`;
    const c = $('#cchip'), warn = needsWarning(v);
    c.textContent = v.consent_stated === 'yes' ? 'Consent: yes' : 'Consent: no';
    c.className = `chip ${v.consent_stated === 'yes' ? 'ok' : warn ? 'warn' : ''}`;
    if (warn !== lastWarn || !$('#warn').firstChild === warn) {
      $('#warn').innerHTML = warn ? '<div class="warnbox" role="alert">⚠ This visit has audio or video but consent is marked No.</div>' : '';
      lastWarn = warn;
    }
    document.querySelectorAll('#consent [data-c]').forEach(b => { const on = b.dataset.c === v.consent_stated; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }

  // Secondary actions live in one menu so the capture screen stays clean.
  function moreSheet() {
    const o = overlay(`<h2>${esc(typeName(cur.visit_type, cur))}</h2>
      <div class="menu">
        <button class="btn block" id="expVisit">${ICON.share}Export this visit</button>
        <button class="btn block" id="expDay">${ICON.share}Export whole day · ${esc(dayLabel(cur.date))}</button>
        <button class="btn block" id="mDetails">${ICON.edit}Edit place and details</button>
        <button class="btn block" id="editDate">${ICON.calendar}Change date</button>
        <button class="btn block danger" id="delVisit">${ICON.trash}Delete visit</button>
        <button class="btn block ghost" id="mClose">Close</button>
      </div>`);
    const act = fn => async () => { o.remove(); await fn(); };
    $('#mClose', o).onclick = () => o.remove();
    $('#expVisit', o).onclick = act(() => exportFlow('visit', cur.visit_id));
    $('#expDay', o).onclick = act(() => exportFlow('day', cur.date));
    $('#mDetails', o).onclick = act(detailsSheet);
    $('#editDate', o).onclick = act(editDate);
    $('#delVisit', o).onclick = act(async () => {
      const v = cur;
      if (!await confirmDlg('Delete this visit?', `${v.visit_id} moves to Recently deleted for ${U.BIN_DAYS} days, then is removed for good.`, 'Delete', true)) return;
      if (cur !== v) return;
      commitPending();
      if (Rec.mr || Rec.starting) await stopRec();
      await flushSave();
      try { await DB.patchVisit(v.visit_id, { deleted_at: U.iso() }, false); } catch (e) { return toast('Could not delete — storage error.'); }
      go('#/'); setTimeout(() => toast('Moved to Recently deleted'), 300);
    });
  }

  function detailsSheet() {
    const v = cur, noAttr = 'autocomplete="off" autocorrect="off" spellcheck="false"';
    const o = overlay(`<h2>Place and details</h2>
      <div class="grid2">
        <label class="f">City<input type="text" data-f="city" value="${esc(v.city)}" ${noAttr}></label>
        <label class="f">Suburb<input type="text" data-f="suburb" value="${esc(v.suburb)}" ${noAttr}></label>
      </div>
      <label class="f">Outlet type<select data-f="outlet_type">${options(OUTLETS.includes(v.outlet_type) || !v.outlet_type ? OUTLETS : [v.outlet_type, ...OUTLETS], v.outlet_type, '—')}</select></label>
      <label class="f">Who — role or first name only<input type="text" data-f="who_role" value="${esc(v.who_role)}" ${noAttr}></label>
      <div class="flabel" id="dCL">Did they say yes to being recorded?</div>
      <div class="seg" id="consent" role="group" aria-labelledby="dCL"><button class="btn" data-c="yes">Yes, consent stated</button><button class="btn" data-c="no">No</button></div>
      <p class="small muted">${esc(typeName(v.visit_type, v))} in ${esc(COUNTRY_NAME[v.country] || v.country)} on ${esc(fmtDate(v.date))}. Category and country are part of the visit ID and stay fixed.${v.date_edit_reason ? ` Date edited: ${esc(v.date_edit_reason)}` : ''}</p>
      <div class="row end"><button class="btn primary grow" id="dDone">Done</button></div>`);
    o.querySelectorAll('[data-f]').forEach(el => {
      el.oninput = el.onchange = () => { if (cur !== v) return; cur[el.dataset.f] = el.value; drawHead(); mark(el.dataset.f); };
    });
    $('#consent', o).onclick = e => {
      const b = e.target.closest('[data-c]'); if (!b || cur !== v) return;
      cur.consent_stated = b.dataset.c; drawHead(); mark('consent_stated');
    };
    $('#dDone', o).onclick = () => o.remove();
    drawHead();
  }

  function editDate() {
    const v = cur;
    const o = overlay(`<h2>Change visit date</h2>
      <p class="muted">The visit ID stays ${esc(v.visit_id)}. A reason is required and is stored with the visit.</p>
      <label class="f">New date<input type="date" id="edDate" value="${esc(v.date)}" max="${U.ymd()}"></label>
      <label class="f">Reason<input type="text" id="edReason" autocomplete="off" autocorrect="off" spellcheck="false"></label>
      <p class="ferr" id="edErr" role="alert"></p>
      <div class="row end"><button class="btn" id="edCancel">Cancel</button><button class="btn primary grow" id="edSave">Save date</button></div>`);
    const err = t => { $('#edErr', o).textContent = t; };
    $('#edCancel', o).onclick = () => o.remove();
    $('#edSave', o).onclick = () => {
      const d = $('#edDate', o).value, r = $('#edReason', o).value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return err('Choose a date.');
      if (d > U.ymd()) return err('The date cannot be in the future.');
      if (d === v.date) return o.remove();
      if (!r.trim()) return err('A reason is required.');
      if (cur !== v) return o.remove();
      cur.date_edit_reason = cur.date_edit_reason ? `${cur.date_edit_reason} | ${cur.date}→${d}: ${r}` : `${cur.date}→${d}: ${r}`;
      cur.date = d; o.remove(); drawHead(); mark('date', 'date_edit_reason');
    };
  }

  function drawCheck() {
    const box = $('#check');
    box.innerHTML = cur.checklist.map((c, i) => `<div class="citem ${c.done ? 'done' : ''}">
      <label class="tick"><input type="checkbox" data-i="${i}" ${c.done ? 'checked' : ''} aria-label="Done: item ${i + 1}"></label>
      <textarea rows="1" data-i="${i}" aria-label="Checklist item ${i + 1}" autocomplete="off" autocorrect="off" spellcheck="false"></textarea>
      <button class="btn ghost" data-rm="${i}" aria-label="Remove item ${i + 1}">✕</button></div>`).join('');
    box.querySelectorAll('textarea').forEach(el => { el.value = cur.checklist[+el.dataset.i].text; fit(el); });
    box.oninput = e => {
      const i = +e.target.dataset.i; if (Number.isNaN(i)) return;
      if (e.target.type === 'checkbox') { cur.checklist[i].done = e.target.checked; e.target.closest('.citem').classList.toggle('done', e.target.checked); }
      else { cur.checklist[i].text = e.target.value; fitSoon(e.target); }
      mark('checklist');
    };
    box.onclick = async e => {
      const b = e.target.closest('[data-rm]'); if (!b) return;
      const v = cur, item = cur.checklist[+b.dataset.rm];
      if (!await confirmDlg('Remove this item?', item.text || '(empty item)', 'Remove', true) || cur !== v) return;
      const i = cur.checklist.indexOf(item); if (i < 0) return;
      cur.checklist.splice(i, 1); drawCheck(); mark('checklist');
    };
  }
  function addCheck() {
    const el = $('#checkNew'); if (!el.value.trim()) return;
    cur.checklist.push({ text: el.value, done: false }); el.value = ''; drawCheck(); mark('checklist');
  }
  function drawLabels() {
    const box = $('#labels');
    box.innerHTML = cur.labels.map((l, i) => `<span class="chip">${esc(l)}<button data-rl="${i}" aria-label="Remove label ${esc(l)}">✕</button></span>`).join('');
    box.onclick = e => {
      const b = e.target.closest('[data-rl]'); if (!b) return;
      cur.labels.splice(+b.dataset.rl, 1); drawLabels(); mark('labels'); $('#labelNew').focus({ preventScroll: true });
    };
  }
  function addLabel() {
    const el = $('#labelNew'), l = cleanName(el.value); if (!l) return;
    if (!cur.labels.some(x => fold(x) === fold(l))) cur.labels.push(l);
    el.value = ''; drawLabels(); mark('labels');
  }
  function drawColours() {
    $('#colours').innerHTML = COLOURS.map(c => `<button class="swatch ${c ? 'sw-' + c : ''} ${cur.colour === c ? 'on' : ''}" data-col="${c}"
      aria-label="${c || 'No colour'}" aria-pressed="${cur.colour === c}">${c ? '' : 'none'}</button>`).join('');
  }

  /* ---------- media ---------- */
  const mediaUrl = new Map();   // media id → object URL for the screen that is open
  const mediaMeta = (m, size) => `${m.kind} · ${esc((m.captured_at || '').slice(11, 16))}${m.duration_s != null ? ' · ' + fmtDur(m.duration_s) : ''}${size != null ? ' · ' + fmtBytes(size) : ''}`;

  // Photos and videos show as a grid of tiles, audio as rows. Only changed items are added or removed (no flicker).
  async function drawMedia() {
    const token = ++drawToken, box = $('#media'), v = cur;
    if (!box || !v) return;
    const items = live(v), ids = new Set(items.map(m => m.id));
    box.querySelectorAll('[data-mid]').forEach(n => { if (!ids.has(n.dataset.mid)) n.remove(); });
    const have = new Set([...box.querySelectorAll('[data-mid]')].map(n => n.dataset.mid));
    for (const m of items) {
      if (have.has(m.id)) continue;
      let blob = null;
      try { blob = await DB.getBlob(m.id); } catch (e) { blob = null; }
      if (token !== drawToken) return;
      const url = blob ? URL.createObjectURL(blob) : '';
      if (url) { urls.push(url); mediaUrl.set(m.id, url); }
      const short = m.id.slice(v.visit_id.length + 1);
      if (m.kind === 'audio') {
        const row = document.createElement('div'); row.className = 'mitem'; row.dataset.mid = m.id;
        row.innerHTML = `<div class="mhead"><span class="tbadge">${esc(short)}</span><span class="muted small grow">${mediaMeta(m, blob && blob.size)}</span>
          <button class="btn ghost danger" data-dm="${esc(m.id)}" aria-label="Delete ${esc(m.id)}">${ICON.trash}</button></div>
          ${url ? `<audio controls preload="metadata" src="${url}"></audio>` : '<p class="muted">File missing on this device.</p>'}`;
        $('#maudio').appendChild(row);
      } else {
        const tile = document.createElement('button'); tile.className = 'mtile'; tile.dataset.mid = m.id; tile.dataset.open = m.id;
        tile.setAttribute('aria-label', `Open ${m.kind} ${m.id}`);
        tile.innerHTML = (!url ? '' : m.kind === 'photo' ? `<img src="${url}" alt="" loading="lazy" decoding="async">`
          : `<video src="${url}#t=0.1" preload="metadata" muted playsinline tabindex="-1"></video>`) +
          `<span class="mtag">${m.kind === 'video' ? ICON.video : ''}${esc(short)}${m.duration_s != null ? ' · ' + fmtDur(m.duration_s) : ''}</span>`;
        const el = tile.querySelector('img,video');
        if (el) el.onerror = () => { el.remove(); tile.classList.add('nop'); }; else tile.classList.add('nop');
        $('#mgrid').appendChild(tile);
      }
    }
    let empty = box.querySelector('.mempty');
    if (!items.length && !empty) { empty = document.createElement('p'); empty.className = 'muted mempty'; empty.textContent = 'Nothing captured yet. Use the Photo, Record and Video buttons below.'; box.appendChild(empty); }
    else if (items.length && empty) empty.remove();
  }

  function viewer(id) {
    const m = cur && cur.media.find(x => x.id === id), url = mediaUrl.get(id);
    if (!m) return;
    const short = id.slice(cur.visit_id.length + 1);
    const o = overlay(`<h2>${esc(KIND_WORD[m.kind])} ${esc(short)}</h2><p class="muted small mono">${esc(m.id)} · ${mediaMeta(m)}</p>
      ${!url ? '<p class="muted">File missing on this device.</p>' : m.kind === 'photo' ? `<button class="vzoom" id="vZoom" aria-label="Open full screen to zoom"><img class="vmedia" src="${url}" alt="Photo ${esc(short)}"></button><p class="small muted">Tap the photo to open it full screen and zoom.</p>`
        : `<video class="vmedia" controls playsinline preload="metadata" src="${url}"></video>`}
      <p class="muted" id="vNo" hidden>No preview for this file type on this device. The original file is kept and will be exported.</p>
      <div class="row end"><button class="btn danger" id="vDel">${ICON.trash}Delete</button><button class="btn primary grow" id="vDone">Done</button></div>`);
    const el = $('.vmedia', o);
    if (el) el.onerror = () => { (el.closest('.vzoom') || el).remove(); const n = $('#vNo', o); if (n) n.hidden = false; };
    $('#vDone', o).onclick = () => o.remove();
    if ($('#vZoom', o)) $('#vZoom', o).onclick = () => lightbox(url, short);
    $('#vDel', o).onclick = async () => { if (await deleteMedia(id)) o.remove(); };
  }
  // Full-screen photo: tap switches between fit-to-screen and actual size; drag to pan, pinch to zoom.
  function lightbox(url, name) {
    const lb = document.createElement('div');
    lb.className = 'lightbox'; lb.tabIndex = -1;
    lb.innerHTML = `<div class="lbscroll"><img class="fit" src="${url}" alt="Photo ${esc(name)}"></div><button class="btn lbclose">Done</button>`;
    const img = $('img', lb);
    img.onclick = () => img.classList.toggle('fit');
    $('.lbclose', lb).onclick = () => lb.remove();
    lb.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); lb.remove(); } };
    document.body.appendChild(lb); lb.focus({ preventScroll: true });
  }

  async function deleteMedia(id) {
    const v = cur;
    if (!await confirmDlg('Delete this item?', `${id} moves to Recently deleted for ${U.BIN_DAYS} days.`, 'Delete', true)) return false;
    if (cur !== v) return false;
    const stamp = U.iso();
    try { await DB.patchVisit(v.visit_id, { media_deleted: { [id]: stamp } }); } catch (e) { toast('Could not delete — storage error.'); return false; }
    const m = v.media.find(x => x.id === id); if (m) m.deleted_at = stamp;
    if (cur === v) { drawHead(); drawMedia(); }
    return true;
  }

  function probeDuration(blob, kind) {
    return new Promise(res => {
      const el = document.createElement(kind === 'video' ? 'video' : 'audio'), url = URL.createObjectURL(blob);
      let done = false;
      const fin = val => { if (done) return; done = true; el.removeAttribute('src'); URL.revokeObjectURL(url); res(val); };
      el.preload = 'metadata';
      el.onloadedmetadata = () => fin(Number.isFinite(el.duration) ? Math.round(el.duration) : null);
      el.onerror = () => fin(null);
      setTimeout(() => fin(null), 4000);
      el.src = url;
    });
  }

  // Saves a captured file to the visit it was captured in, whatever screen is open by the time it finishes.
  async function saveMediaTo(visitId, kind, blob, ext, dur) {
    if (!blob || !blob.size) { toast(`That ${kind} is empty — nothing was saved.`, 5000); return false; }
    if (cur && cur.visit_id === visitId) await flushSave();
    let v;
    try { v = await DB.addMedia(visitId, kind, blob, ext, dur); }
    catch (e) { saveFailed(visitId, kind, blob, ext, dur); return false; }
    if (cur && cur.visit_id === visitId) {
      Object.assign(cur, { media: v.media, media_seq: v.media_seq, updated_at: v.updated_at, end_time: v.end_time });
      if ($('#media')) { drawHead(); drawMedia(); }
    }
    toast(`${KIND_WORD[kind]} saved`);
    return true;
  }
  // The captured file is held until it is saved, shared, or the user chooses to discard it.
  function saveFailed(visitId, kind, blob, ext, dur) {
    const file = new File([blob], `${visitId}-unsaved.${ext}`, { type: blob.type });
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const o = overlay(`<h2>${esc(KIND_WORD[kind])} not saved yet</h2>
      <p>The phone could not store this ${esc(kind)} (${fmtBytes(blob.size)}). It may be out of space. The ${esc(kind)} is still held here — do not close the app.</p>
      <div class="menu">
        <button class="btn primary block" id="sfRetry">Try again</button>
        ${canShare ? '<button class="btn block" id="sfShare">Share it somewhere safe instead…</button>' : ''}
        <button class="btn block danger" id="sfDrop">Discard it</button></div>`, () => {});
    $('#sfRetry', o).onclick = async () => { o.remove(); await saveMediaTo(visitId, kind, blob, ext, dur); };
    if (canShare) $('#sfShare', o).onclick = async () => { try { await navigator.share({ files: [file] }); } catch (e) { /* stays open */ } };
    $('#sfDrop', o).onclick = async () => { if (await confirmDlg(`Discard this ${kind}?`, 'It has not been saved anywhere.', 'Discard', true)) o.remove(); };
  }

  async function addFiles(input, kind) {
    const visitId = cur && cur.visit_id, files = [...input.files]; input.value = '';
    if (!visitId) return;
    for (const f of files) {
      const mime = (f.type || '').split(';')[0];
      const k = mime.startsWith('image/') ? 'photo' : mime.startsWith('video/') ? 'video' : kind;
      const fromName = /\.([A-Za-z0-9]{2,5})$/.exec(f.name || '');
      const ext = EXT[mime] || (fromName ? fromName[1].toLowerCase() : (k === 'photo' ? 'jpg' : 'mov'));
      await saveMediaTo(visitId, k, f, ext, k === 'video' && f.size ? await probeDuration(f, 'video') : null);
    }
  }

  /* ---------- audio recorder ----------
     One recording at a time. Audio is written to the phone as it arrives, so a closed app or dead
     battery keeps what was captured; it is recovered the next time the app opens. */
  const Rec = { mr: null, starting: false, stopping: false, stream: null, chunks: [], t0: 0, timer: null, lock: null,
    done: Promise.resolve(), resolve: null, visitId: null, recId: null, n: 0, mime: '' };

  async function wakeLock() {
    try { if ('wakeLock' in navigator && !document.hidden) Rec.lock = await navigator.wakeLock.request('screen'); } catch (e) { Rec.lock = null; }
  }
  function drawRecUI() {
    const b = $('#recBtn'), pill = $('#recPill'), on = !!Rec.mr && cur && cur.visit_id === Rec.visitId;
    if (b) { b.innerHTML = on ? REC_ON : REC_IDLE; b.classList.toggle('recording', on); b.setAttribute('aria-label', on ? 'Stop recording' : 'Record audio'); }
    if (pill) {
      pill.hidden = !on;
      if (on) pill.innerHTML = `<i></i><b>${fmtDur(Math.round((Date.now() - Rec.t0) / 1000))}</b> Stop`;
    }
    const s = $('#saveState'); if (s) s.hidden = on;
  }
  async function startRec() {
    if (Rec.mr || Rec.starting || !cur) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('Audio recording is not supported in this browser.');
    Rec.starting = true;
    const visitId = cur.visit_id, consentNo = cur.consent_stated !== 'yes';
    try {
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) { return toast('Microphone blocked. Allow it in iPhone Settings → Safari → Microphone, then reopen the app.', 7000); }
      if (!cur || cur.visit_id !== visitId) { stream.getTracks().forEach(t => t.stop()); return; }
      let mr;
      try { mr = new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach(t => t.stop()); return toast('Could not start recording.'); }
      const recId = `${visitId}:${Date.now()}`;
      Object.assign(Rec, { mr, stream, chunks: [], t0: Date.now(), stopping: false, visitId, recId, n: 0, mime: mr.mimeType || '' });
      Rec.done = new Promise(r => { Rec.resolve = r; });
      mr.ondataavailable = e => {
        if (!e.data || !e.data.size) return;
        Rec.chunks.push(e.data);
        const n = Rec.n++, t0 = Rec.t0, mime = mr.mimeType || e.data.type || 'audio/mp4';
        e.data.arrayBuffer().then(buf => DB.recPut(recId, n, visitId, mime, t0, buf)).catch(() => {});
      };
      mr.onstop = finishRec; mr.onerror = () => stopRec();
      stream.getTracks().forEach(t => { t.onended = () => stopRec(); });
      mr.start(1000);
      drawRecUI();
      Rec.timer = setInterval(drawRecUI, 500);
      toast(`Recording. Keep the screen on and stay in this app.${consentNo ? ' Consent is marked No.' : ''}`, 5000);
      wakeLock();
    } finally { Rec.starting = false; }
  }
  function stopRec() {
    const mr = Rec.mr;
    if (!mr) return Rec.done;
    if (Rec.stopping) return Rec.done;                 // already stopping: wait for the last audio to arrive
    Rec.stopping = true;
    if (mr.state !== 'inactive') { try { mr.stop(); } catch (e) { finishRec(); } } else finishRec();
    return Rec.done;
  }
  async function finishRec() {
    const { mr, stream, chunks, t0, resolve, visitId, recId } = Rec;
    if (!mr) return;
    Rec.mr = null; clearInterval(Rec.timer);
    stream.getTracks().forEach(t => { t.onended = null; t.stop(); });
    try { if (Rec.lock) await Rec.lock.release(); } catch (e) { /* already released */ }
    Rec.lock = null;
    drawRecUI();
    const mime = (mr.mimeType || (chunks[0] && chunks[0].type) || 'audio/mp4');
    const blob = new Blob(chunks, { type: mime });
    try {
      if (!blob.size) toast('Nothing was recorded.');
      else if (await saveMediaTo(visitId, 'audio', blob, EXT[mime.split(';')[0]] || 'm4a', Math.round((Date.now() - t0) / 1000))) await DB.recClear(recId).catch(() => {});
      if (!blob.size) await DB.recClear(recId).catch(() => {});
    } finally { Rec.stopping = false; resolve(); }
  }
  // Recordings cut off before Stop (app closed, phone died) are rebuilt from what was written.
  async function recoverRecordings() {
    let n = 0;
    try {
      for (const r of await DB.recPending()) {
        const blob = new Blob(r.parts, { type: r.mime });
        const dur = Math.max(1, Math.round((r.last - r.t0) / 1000));
        if (blob.size && await DB.getVisit(r.visitId)) { await DB.addMedia(r.visitId, 'audio', blob, EXT[(r.mime || '').split(';')[0]] || 'm4a', dur); n++; }
        await DB.recClear(r.recId);
      }
    } catch (e) { /* try again next launch */ }
    return n;
  }

  /* ---------- export / import ---------- */
  async function exportFlow(kind, target) {
    commitPending();
    if (Rec.mr || Rec.starting) await stopRec();     // include the recording in progress
    if (!await flushSave()) return toast('Some text is not saved yet. Wait a moment and try again.', 6000);
    const o = overlay('<h2>Preparing export…</h2><p class="muted">Building the .zip on this device. Nothing is sent anywhere.</p>', () => {});
    let pack;
    try {
      if (kind === 'visit') { const v = await DB.getVisit(target); pack = await Exporter.visitZip(v); }
      else pack = await Exporter.dayZips(target);
    } catch (e) { o.remove(); return toast('Export failed — the phone ran out of memory or space. Try exporting visits one at a time.', 8000); }
    if (!pack.files.length) { o.remove(); return toast('No visits on that day.'); }
    const canShare = !!(navigator.canShare && navigator.canShare({ files: pack.files }));
    const done = async how => {
      const stamp = await DB.markExported(pack.ids);
      if (cur && pack.ids.includes(cur.visit_id)) cur.exported_at = stamp;
      $('#exState', o).innerHTML = `<p class="chips"><span class="chip ok">${ICON.check}${how} — marked as exported</span></p>`;
    };
    const close = () => { o.remove(); if (view === 'home' || view === 'summary') route(); };
    o.cancel = close;
    $('.sheet', o).innerHTML = `<h2>Export ready</h2>
      <ul class="plain">${pack.files.map(f => `<li><strong>${esc(f.name)}</strong> · ${fmtBytes(f.size)}</li>`).join('')}</ul>
      <p class="muted">${plural(pack.ids.length, 'visit')}, with all text, photos, videos and audio. Nothing leaves this device until you choose below.</p>
      ${pack.missing ? `<p class="warnbox">⚠ ${plural(pack.missing, 'media file')} could not be found on this device and ${pack.missing === 1 ? 'is' : 'are'} not in the export.</p>` : ''}
      <div id="exState"></div>
      <div class="actions tight">
        ${canShare ? `<button class="btn primary block" id="exShare">${ICON.share}Share everything…</button>` : ''}
        <button class="btn ${canShare ? '' : 'primary'} block" id="exSave">Save everything to this device</button>
        <button class="btn block" id="exClaude">Copy text only, for my Claude Project</button>
        <div id="exNext"></div>
        <button class="btn block ghost" id="exClose">Close</button></div>
      <p class="small muted">“Copy text only” copies the words with the PACKAGE command, ready to paste into your project chat. It does not include photos, videos or audio, so it does not count as a backup.</p>`;
    $('#exClaude', o).onclick = () => claudeStep($('#exNext', o), `PACKAGE\n\n${pack.text}`, 'Visit text');
    $('#exClose', o).onclick = close;
    if (canShare) $('#exShare', o).onclick = async () => {
      try { await navigator.share({ files: pack.files, title: pack.files[0].name }); await done('Shared'); }
      catch (e) { if (e.name !== 'AbortError') toast('Share did not open. Use “Save everything to this device”, then share from Files.', 7000); }
    };
    $('#exSave', o).onclick = async () => {
      pack.files.forEach((f, i) => setTimeout(() => {
        const url = URL.createObjectURL(f), a = document.createElement('a');
        a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }, i * 600));
      await done('Saved');
    };
  }

  async function importFiles(input) {
    const files = [...input.files]; input.value = '';
    if (!files.length) return;
    toast('Importing…', 60000);
    let added = 0, skipped = 0, differs = 0, invalid = 0, missing = 0, found = 0;
    for (const f of files) {
      try {
        const r = await Exporter.importZip(f);
        added += r.added.length; skipped += r.skipped.length; differs += r.differs.length; invalid += r.invalid; missing += r.missingMedia; found += r.found;
        for (const [c, n] of Object.entries(r.typeNames)) {
          if (!allTypes().some(t => t[0] === c || fold(t[1]) === fold(n))) customTypes.push([c, n]);
        }
        await DB.setMeta('customTypes', customTypes);
      } catch (e) { invalid++; }
    }
    const parts = [found || invalid ? `Imported ${plural(added, 'visit')}` : 'No visits were found in that file'];
    if (skipped) parts.push(`${skipped} already on this device (left as they are)`);
    if (differs) parts.push(`${differs} of those differ from the copy here — check them by hand`);
    if (missing) parts.push(`${plural(missing, 'media file')} missing from the file`);
    if (invalid) parts.push(`${invalid} could not be read (damaged, too large, or not from this app)`);
    go('#/');
    setTimeout(() => toast(parts.join('; ') + '.', 9000), 400);
  }

  /* ---------- settings ---------- */
  async function renderSettings() {
    let est = {};
    try { est = (navigator.storage && navigator.storage.estimate) ? await navigator.storage.estimate() : {}; } catch (e) { /* unavailable */ }
    const all = await DB.getVisits();
    const liveN = all.filter(v => !v.deleted_at).length;
    const binCount = all.filter(v => v.deleted_at).length + all.filter(v => !v.deleted_at).reduce((n, v) => n + v.media.filter(m => m.deleted_at).length, 0);
    root.innerHTML = `
      <header class="bar"><button class="btn icon" id="back" aria-label="Back to visits">${ICON.back}</button><h1>Settings</h1></header>
      <h2 class="sec">Laptop / other device</h2>
      <div class="box"><p>Import an exported .zip to view the same visits here. Visits already on this device are left as they are, never overwritten.</p>
        <button class="btn primary block" id="impBtn">Import .zip</button>
        <input type="file" id="impIn" accept=".zip,application/zip,application/x-zip-compressed" multiple hidden tabindex="-1"></div>
      <h2 class="sec">Recently deleted</h2>
      <div class="box"><button class="btn block" id="toBin">Open bin (${plural(binCount, 'item')})</button></div>
      <h2 class="sec">This device</h2>
      <div class="box">
        <p>${'serviceWorker' in navigator ? (offlineReady ? '<span class="chip ok">Ready to work without signal</span>' : '<span class="chip warn">Not ready to work without signal yet — keep the app open with signal, then reopen it</span>') : '<span class="chip warn">This browser cannot work without signal</span>'}</p>
        <p>${est.usage != null ? `<strong>${fmtBytes(est.usage)}</strong> used by the app and its data${est.quota ? `, of about ${fmtBytes(est.quota)} available` : ''}` : 'Storage use is not reported by this browser'} · ${plural(liveN, 'visit')}</p>
        <p>${persisted ? 'Storage is protected: the device will not clear it on its own.' : 'Storage is <strong>not</strong> protected: the device may clear it when space runs low. Install the app to the Home Screen and export every evening.'}</p></div>
      <h2 class="sec">Visit categories</h2>
      <div class="box"><div class="chips" id="cats"></div>
        <p class="small muted">The seven built-in categories stay. Removing one you added keeps its past visits and their name.</p>
        <button class="btn block" id="catAdd">${ICON.plus}Add category</button></div>
      <h2 class="sec">Claude Project</h2>
      <div class="box"><p>Paste the web link of your Claude Project so the app can open it after an export.</p>
        <div class="addrow"><input type="text" id="clLink" inputmode="url" placeholder="https://claude.ai/project/…" aria-label="Claude Project link" value="${esc(claudeLink)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"><button class="btn" id="clSave">Save</button></div></div>
      <h2 class="sec">Countries</h2>
      <div class="box"><div class="chips" id="ctry"></div>
        <div class="addrow"><input type="text" id="ctryNew" maxlength="3" placeholder="3-letter code, e.g. TZA" aria-label="New country code" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false"><button class="btn" id="ctryAdd">Add</button></div></div>
      <h2 class="sec">Good to know on iPhone</h2>
      <div class="box"><ul class="plain">
        <li>Recording stops if the screen locks or you switch apps. Keep the screen on. What was recorded up to that point is kept.</li>
        <li>Your visits live on this phone until exported. <strong>Export every evening.</strong></li>
        <li>Always open from the Home Screen icon, not a Safari tab.</li>
        <li>No automatic phone-to-laptop sync. Transfer is export, then import. Start visits on one device only, so IDs never clash.</li>
        <li>Photos are exported exactly as taken, including any location the camera stored inside the file.</li>
        <li>No location, analytics or trackers in the app. Nothing leaves the device except your own export.</li></ul></div>
      <p class="muted small">Nishant's Eyes and Ears · version ${APP_VERSION}</p>`;
    $('#back').onclick = () => go('#/');
    $('#toBin').onclick = () => go('#/bin');
    $('#impBtn').onclick = () => $('#impIn').click();
    $('#impIn').onchange = e => importFiles(e.target);
    const drawCats = () => {
      $('#cats').innerHTML = allTypes().map(t => `<span class="chip"><b class="mono">${esc(t[0])}</b>&nbsp;${esc(t[1])}${TYPES.includes(t) ? '' : `<button data-rt="${esc(t[0])}" aria-label="Remove ${esc(t[1])}">✕</button>`}</span>`).join('');
    };
    $('#cats').onclick = async e => {
      const b = e.target.closest('[data-rt]'); if (!b) return;
      const code = b.dataset.rt, n = all.filter(v => v.visit_type === code && !v.deleted_at).length;
      if (!await confirmDlg(`Remove “${typeName(code)}”?`, n ? `${plural(n, 'visit')} use it. They keep this category name; you just cannot start new ones with it.` : 'No visits use it.', 'Remove', true)) return;
      customTypes = customTypes.filter(t => t[0] !== code); await DB.setMeta('customTypes', customTypes); drawCats();
    };
    $('#catAdd').onclick = () => addTypeSheet(drawCats);
    drawCats();
    $('#clSave').onclick = async () => {
      const u = $('#clLink').value.trim();
      if (u && !/^https:\/\/claude\.ai\/[^\s"'<>]*$/.test(u)) return toast('The link must start with https://claude.ai/');
      claudeLink = u; await DB.setMeta('claudeLink', u); toast(u ? 'Project link saved' : 'Project link removed');
    };
    const drawC = () => {
      $('#ctry').innerHTML = countries.map((c, i) => `<span class="chip">${esc(countryLabel(c))}${c === 'ZAF' ? '' : `<button data-rc="${i}" aria-label="Remove ${esc(c)}">✕</button>`}</span>`).join('');
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
    const noCons = v => (v.consent_stated !== 'yes' ? ' · <span class="chip warn">consent: no</span>' : '');
    root.innerHTML = `
      <header class="bar"><button class="btn icon" id="back" aria-label="Back to settings">${ICON.back}</button><h1>Recently deleted</h1></header>
      <p class="muted">Items are removed for good ${U.BIN_DAYS} days after deletion.</p>
      ${!visits.length && !media.length ? '<p class="muted pad">The bin is empty.</p>' : ''}
      ${visits.map(v => `<div class="box"><strong>${esc(typeName(v.visit_type, v))}${placeOf(v) ? ' · ' + esc(placeOf(v)) : ''}</strong>
        <div class="muted small"><span class="mono">${esc(v.visit_id)}</span> · ${esc(fmtDate(v.date))} · ${live(v).length} media · ${left(v.deleted_at)} days left${live(v).some(m => m.kind !== 'photo') ? noCons(v) : ''}</div>
        <div class="row" style="margin-top:8px"><button class="btn primary" data-rv="${esc(v.visit_id)}">Restore</button>
        <button class="btn danger" data-dv="${esc(v.visit_id)}">Delete forever</button></div></div>`).join('')}
      ${media.map(({ v, m }) => `<div class="box"><strong>${esc(KIND_WORD[m.kind] || m.kind)} from ${esc(typeName(v.visit_type, v))}</strong>
        <div class="muted small"><span class="mono">${esc(m.id)}</span> · ${left(m.deleted_at)} days left${m.kind !== 'photo' ? noCons(v) : ''}</div>
        <div class="row" style="margin-top:8px"><button class="btn primary" data-rm="${esc(m.id)}" data-v="${esc(v.visit_id)}">Restore</button>
        <button class="btn danger" data-dm="${esc(m.id)}" data-v="${esc(v.visit_id)}">Delete forever</button></div></div>`).join('')}`;
    $('#back').onclick = () => go('#/settings');
    root.onclick = async e => {
      const b = e.target.closest('[data-rv],[data-dv],[data-rm],[data-dm]'); if (!b) return;
      const d = b.dataset;
      try {
        if (d.rv) { await DB.patchVisit(d.rv, { deleted_at: null }, false); toast('Visit restored'); }
        else if (d.rm) { await DB.patchVisit(d.v, { media_deleted: { [d.rm]: null } }); toast('Item restored'); }
        else {
          const id = d.dv || d.dm;
          if (!await confirmDlg('Delete forever?', `${id} will be removed from this device and cannot be restored.`, 'Delete forever', true)) return;
          if (d.dv) await DB.deleteVisitForever(d.dv); else await DB.deleteMediaForever(d.v, d.dm);
        }
      } catch (err) { toast('That did not work — storage error.'); }
      if (view === 'bin') { root.onclick = null; renderBin(); }
    };
  }

  /* ---------- service worker + start-up ---------- */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;
    const btn = $('#update');
    let wantReload = false, reloading = false;
    const redraw = () => { if (view === 'home') DB.getVisits().then(a => drawBanners(a.filter(v => !v.deleted_at))).catch(() => {}); };
    const register = () => navigator.serviceWorker.register('sw.js').then(reg => {
      const check = () => {
        if (reg.waiting && navigator.serviceWorker.controller) {
          btn.hidden = false; document.body.classList.add('has-update');
          btn.onclick = async () => {
            btn.disabled = true; btn.textContent = 'Updating…';
            commitPending();
            if (Rec.mr || Rec.starting) await stopRec();     // never lose a recording to an update
            await flushSave();
            wantReload = true;
            if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING'); else location.reload();
          };
        }
      };
      check();
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (nw) nw.addEventListener('statechange', () => { if (nw.state === 'installed') check(); });
      });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
      return reg;
    });
    register().catch(() => { document.addEventListener('visibilitychange', () => { if (!document.hidden && !offlineReady) register().catch(() => {}); }); });
    navigator.serviceWorker.ready.then(() => { offlineReady = true; redraw(); }).catch(() => {});
    setTimeout(() => { offlineLate = true; if (!offlineReady) redraw(); }, 8000);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!(hadController || wantReload) || reloading) return;
      reloading = true; location.reload();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { commitPending(); flushSave(); return; }
    // Back in the app: if the system killed the recording, keep what was captured.
    if (Rec.mr) { if (Rec.mr.state === 'inactive' && !Rec.stopping) finishRec(); else wakeLock(); }
    // Refresh lists and dates (a new day, or the evening reminder) unless the user is in the middle of something.
    const busy = typingIn(document.activeElement) || document.querySelector('.overlay,.lightbox');
    if (!busy && (view === 'home' || view === 'summary' || (view === 'visit' && U.ymd() !== lastDay && !Rec.mr))) route();
  });
  window.addEventListener('pagehide', () => { commitPending(); writeDraft(); flushSave(); });
  window.addEventListener('hashchange', route);

  // Lock and silence the page behind any open sheet so only the sheet scrolls and takes focus.
  new MutationObserver(() => {
    const open = !!document.querySelector('.overlay,.lightbox');
    document.documentElement.classList.toggle('lock', open);
    root.inert = open;
  }).observe(document.body, { childList: true });

  // Photo / Record / Video stay visible while typing: the bar is lifted to sit just above the keyboard.
  // iPhone does not move fixed bars for the keyboard, so its height is measured from the visual viewport.
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const place = () => {
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      document.documentElement.style.setProperty('--kb', `${kb}px`);
      document.body.classList.toggle('kbup', kb > 80);
    };
    vv.addEventListener('resize', place); vv.addEventListener('scroll', place); place();
  }

  // On touch devices, the Visits/Summary tabs and the New visit button step aside while the keyboard is up,
  // and a tap on empty space puts the keyboard away. They only come back once the finger is lifted,
  // so a tap on a button never lands on a bar that has just reappeared under it.
  if (matchMedia('(pointer: coarse)').matches) {
    let touching = false, t = 0, sx = 0, sy = 0;
    const settle = () => { clearTimeout(t); t = setTimeout(() => { if (!touching && !typingIn(document.activeElement)) document.body.classList.remove('kb'); }, 350); };
    document.addEventListener('focusin', () => { if (typingIn(document.activeElement)) { clearTimeout(t); document.body.classList.add('kb'); } else settle(); });
    document.addEventListener('focusout', settle);
    document.addEventListener('touchstart', e => { touching = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchcancel', () => { touching = false; settle(); }, { passive: true });
    document.addEventListener('touchend', e => {
      touching = false; settle();
      const p = e.changedTouches[0], a = document.activeElement;
      if (!typingIn(a) || Math.abs(p.clientX - sx) > 10 || Math.abs(p.clientY - sy) > 10) return;
      if (!e.target.closest('input,textarea,select,button,label,a,summary,audio,video')) a.blur();
    }, { passive: true });
  }

  (async function start() {
    try {
      countries = await DB.getMeta('countries', DEFAULT_COUNTRIES.slice());
      customTypes = await DB.getMeta('customTypes', []);
      claudeLink = await DB.getMeta('claudeLink', '');
      if (!countries.includes('ZAF')) countries.unshift('ZAF');
      await DB.purgeExpired();
    } catch (e) {
      root.innerHTML = '<p class="pad"><strong>Storage is not available.</strong> Open the app from the Home Screen icon (not a private tab) and try again.</p>';
      return;
    }
    const draftOk = await applyDraft();
    const recovered = await recoverRecordings();
    try {
      if (navigator.storage && navigator.storage.persist) {
        persisted = await navigator.storage.persisted() || await navigator.storage.persist();
      }
    } catch (e) { persisted = null; }
    registerSW();
    await route();
    if (recovered) toast(`Recovered ${plural(recovered, 'recording')} that was interrupted last time.`, 7000);
    else if (!draftOk) toast('Some text from last time could not be saved yet. Open that visit to retry.', 7000);
  })();
})();
