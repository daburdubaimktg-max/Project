'use strict';
/* NEE — Nishant's Eyes and Ears. UI layer. Keep APP_VERSION in step with CACHE_VERSION in sw.js. */
const APP_VERSION = '1.2.0';

(function () {
  const TYPES = [['MV', 'Market visit'], ['HV', 'Home visit'], ['TR', 'Trade'], ['SL', 'Salon'],
    ['IN', 'Informal'], ['MT', 'Meeting'], ['TH', 'Thought']];
  // The seven built-in categories stay; the user can add their own (2-letter code + name).
  let customTypes = [];
  const allTypes = () => [...TYPES, ...customTypes];
  const typeName = (code, v) => { const t = allTypes().find(x => x[0] === code); return t ? t[1] : (v && v.visit_type_name) || code; };
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
  const live = v => v.media.filter(m => !m.deleted_at);
  const needsWarning = v => v.consent_stated !== 'yes' && live(v).some(m => m.kind === 'audio' || m.kind === 'video');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

  let countries = DEFAULT_COUNTRIES.slice();
  let claudeLink = '';
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

  // Grow a text box with its content so the page scrolls as one piece (no scroll-inside-scroll).
  function fit(el) {
    const y = window.scrollY;
    el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`;
    if (window.scrollY !== y) window.scrollTo(0, y);
  }

  /* ---------- saving ---------- */
  const saveState = t => { const el = $('#saveState'); if (el) el.textContent = t; };
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 400); saveState('Saving…'); }
  async function flushSave() {
    if (saveTimer == null || !cur) { clearTimeout(saveTimer); saveTimer = null; return; }
    clearTimeout(saveTimer); saveTimer = null;
    try { await DB.putVisit(cur); saveState('Saved'); } catch (e) { saveState('Not saved'); toast('Could not save — storage error. Export now.', 8000); }
  }
  async function saveNow() { clearTimeout(saveTimer); saveTimer = 0; await flushSave(); }

  /* ---------- routing ---------- */
  // Screens render one at a time, so quick taps can never mix two screens together.
  let routeChain = Promise.resolve(), view = '', homeScroll = 0;
  function route() { routeChain = routeChain.then(doRoute).catch(() => {}); return routeChain; }
  async function doRoute() {
    await leave();
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
    await flushSave();
    if (Rec.mr) await stopRec();
    urls.forEach(u => URL.revokeObjectURL(u)); urls = []; mediaUrl.clear();
    cur = null; drawToken++; root.onclick = null;
    document.querySelectorAll('.overlay,.lightbox').forEach(n => n.remove());
    window.scrollTo(0, 0);
  }
  const go = h => { if (location.hash === h) { route(); } else { location.hash = h; } };

  /* ---------- home (Keep-style list) ---------- */
  const placeOf = v => [v.suburb, v.city].filter(Boolean).join(', ');
  function dayLabel(ymd) {
    const t = new Date(), y = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
    return ymd === U.ymd(t) ? 'Today' : ymd === U.ymd(y) ? 'Yesterday' : fmtDate(ymd);
  }

  async function renderHome() {
    const all = (await DB.getVisits()).filter(v => !v.deleted_at);
    const labels = [...new Set(all.flatMap(v => v.labels))].sort();
    const ctry = [...new Set(all.map(v => v.country))].sort();
    const present = new Set(all.map(v => v.visit_type));
    const types = [...allTypes().filter(t => present.has(t[0])),
      ...[...present].filter(c => !allTypes().some(t => t[0] === c)).map(c => [c, typeName(c, all.find(v => v.visit_type === c))])];
    if (filters.type && !types.some(t => t[0] === filters.type)) filters.type = '';
    if (filters.country && !ctry.includes(filters.country)) filters.country = '';
    if (filters.label && !labels.includes(filters.label)) filters.label = '';
    const today = all.filter(v => v.date === U.ymd()).length;
    root.innerHTML = `
      <header class="bar home"><div class="grow"><h1>Eyes &amp; Ears</h1>
        <div class="today">${esc(fmtDate(U.ymd()))} · ${today ? `${today} visit${today === 1 ? '' : 's'} today` : 'no visits yet today'}</div></div>
        <button class="btn icon" id="toSettings" aria-label="Settings">${ICON.settings}</button></header>
      <div id="banners"></div>
      ${all.length ? `<input id="q" type="search" placeholder="Search visits" aria-label="Search visits"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" value="${esc(filters.q)}">
      <div class="tchips" id="tchips" role="group" aria-label="Filter by type"></div>
      ${ctry.length > 1 || labels.length ? `<div class="filters">
        ${ctry.length > 1 ? `<select id="fCountry" aria-label="Filter by country">${options(ctry, filters.country, 'All countries')}</select>` : ''}
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
        `<button class="tchip ${filters.type === t[0] ? 'on' : ''}" data-ft="${t[0]}" aria-pressed="${filters.type === t[0]}">${esc(t[1])}</button>`).join('');
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
      if (pin) {
        const v = all.find(x => x.visit_id === pin.dataset.pin);
        v.pinned = !v.pinned; await DB.putVisit(v, false); drawList(all);
      } else if (day) exportFlow('day', day.dataset.day);
    };
    drawTypes(); drawList(all); drawBanners(all);
  }

  function matches(v) {
    if (filters.type && v.visit_type !== filters.type) return false;
    if (filters.country && v.country !== filters.country) return false;
    if (filters.label && !v.labels.includes(filters.label)) return false;
    const q = filters.q.trim().toLowerCase();
    if (!q) return true;
    const hay = [v.visit_id, typeName(v.visit_type, v), v.text_raw, v.typed_notes, v.city, v.suburb, v.outlet_type, v.who_role,
      v.labels.join(' '), v.checklist.map(c => c.text).join(' ')].join('\n').toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w));
  }

  function card(v) {
    const m = live(v), n = k => m.filter(x => x.kind === k).length;
    const counts = [[n('audio'), ICON.mic, 'audio'], [n('photo'), ICON.camera, 'photo'], [n('video'), ICON.video, 'video']]
      .filter(c => c[0]).map(c => `<span class="chip" aria-label="${c[0]} ${c[2]}">${c[1]}${c[0]}</span>`).join('');
    const place = placeOf(v);
    const snip = (v.text_raw || v.typed_notes).trim().slice(0, 200);
    const todo = v.checklist.filter(c => !c.done).length;
    const exported = v.exported_at && Date.parse(v.exported_at) >= Date.parse(v.updated_at);
    return `<div class="card ${v.colour ? 'col-' + esc(v.colour) : ''}">
      <a href="#/v/${encodeURIComponent(v.visit_id)}">
        <div class="ctitle"><span class="tbadge">${esc(v.visit_type)}</span><span class="ctext">${esc(typeName(v.visit_type, v))}${place ? ` · ${esc(place)}` : ''}</span></div>
        <div class="cid">${esc(v.visit_id)} · ${esc(v.start_time)}${v.outlet_type ? ` · ${esc(v.outlet_type)}` : ''}</div>
        ${snip ? `<div class="snip">${esc(snip)}</div>` : '<div class="snip muted">Nothing captured yet</div>'}
        <div class="chips">${needsWarning(v) ? '<span class="chip warn">⚠ Recorded without consent</span>' : ''}${counts}${todo ? `<span class="chip">${ICON.check}${todo} to do</span>` : ''}${v.labels.map(l => `<span class="chip">${esc(l)}</span>`).join('')}${exported ? '<span class="chip ok">Exported</span>' : ''}</div>
      </a>
      <button class="pinbtn ${v.pinned ? 'on' : ''}" data-pin="${esc(v.visit_id)}" aria-pressed="${v.pinned}" aria-label="Pin ${esc(v.visit_id)}">${ICON.pin}</button>
    </div>`;
  }

  function drawList(all) {
    const vs = all.filter(matches).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at) || b.visit_id.localeCompare(a.visit_id));
    const box = $('#list');
    if (!all.length) {
      box.innerHTML = `<div class="empty">${ICON.book}<strong>Ready for your first visit</strong>
        <ol><li>Tap <b>New visit</b> and pick the type.</li><li>Dictate, record, and take photos or videos.</li><li>In the evening, tap <b>Export day</b> and share it.</li></ol></div>`;
      return;
    }
    if (!vs.length) { box.innerHTML = '<div class="empty"><strong>No matches</strong>Try a different search or filter.</div>'; return; }
    let html = '';
    const pinned = vs.filter(v => v.pinned);
    if (pinned.length) html += `<div class="ghead"><h3>Pinned</h3></div>${pinned.map(card).join('')}`;
    let last = null;
    for (const v of vs.filter(v => !v.pinned)) {
      if (v.date !== last) {
        last = v.date;
        const n = all.filter(x => x.date === v.date).length;
        html += `<div class="ghead"><h3>${esc(dayLabel(v.date))} <span class="count">${n}</span></h3><button class="btn" data-day="${esc(v.date)}">${ICON.share}Export day</button></div>`;
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
    const noAttr = 'autocomplete="off" autocorrect="off" spellcheck="false"';
    let type = '', consent = 'no', outletTouched = false;
    const o = overlay(`
      <h2>New visit</h2>
      <div class="types" id="nvTypes"></div>
      <div class="grid2">
        <label class="f">Country<select id="nvCountry">${options(countries, 'ZAF')}</select></label>
        <label class="f">City<input type="text" id="nvCity" list="dlCity" ${noAttr}></label>
      </div>
      <datalist id="dlCity">${uniq('city').map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="grid2">
        <label class="f">Suburb<input type="text" id="nvSuburb" list="dlSuburb" ${noAttr}></label>
        <label class="f">Outlet type<select id="nvOutlet">${options(OUTLETS, '', '—')}</select></label>
      </div>
      <datalist id="dlSuburb">${uniq('suburb').map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <label class="f">Who — role or first name only<input type="text" id="nvWho" ${noAttr}></label>
      <div class="flabel">Did they say yes to being recorded?</div>
      <div class="seg" id="nvConsent"><button class="btn" data-c="yes">Yes, consent stated</button><button class="btn on" data-c="no">No</button></div>
      <div class="row end"><button class="btn" id="nvCancel">Cancel</button><button class="btn primary grow" id="nvCreate" disabled>Choose a type</button></div>`);
    const create = $('#nvCreate', o), outlet = $('#nvOutlet', o);
    outlet.onchange = () => { outletTouched = true; };
    const tiles = () => {
      $('#nvTypes', o).innerHTML = allTypes().map(t => `<button class="btn ${t[0] === type ? 'on' : ''}" data-t="${t[0]}"><strong>${t[0]}</strong>${esc(t[1])}</button>`).join('') +
        `<button class="btn dashed" data-newtype>${ICON.plus}New category</button>`;
    };
    const pick = code => {
      type = code; tiles();
      if (!outletTouched) outlet.value = type === 'HV' ? 'home' : type === 'SL' ? 'salon' : '';
      create.disabled = false; create.textContent = `Start ${typeName(type).toLowerCase()}`;
    };
    tiles();
    $('#nvTypes', o).onclick = e => {
      if (e.target.closest('[data-newtype]')) return addTypeSheet(pick);
      const b = e.target.closest('[data-t]'); if (b) pick(b.dataset.t);
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
          suburb: $('#nvSuburb', o).value, outlet_type: outlet.value, who_role: $('#nvWho', o).value,
          consent_stated: consent, visit_type_name: (customTypes.find(t => t[0] === type) || [])[1] || '' }, APP_VERSION);
        o.remove(); go(`#/v/${encodeURIComponent(v.visit_id)}`);
      } catch (e) { create.disabled = false; toast('Could not create the visit — storage error.'); }
    };
  }

  /* ---------- custom categories ---------- */
  function suggestCode(name) {
    const w = name.toUpperCase().replace(/[^A-Z ]/g, '').split(/\s+/).filter(Boolean), used = new Set(allTypes().map(t => t[0])), c = [];
    if (w.length > 1) c.push(w[0][0] + w[1][0]);
    if (w[0]) for (let i = 1; i < w[0].length; i++) c.push(w[0][0] + w[0][i]);
    return c.find(x => !used.has(x)) || '';
  }
  function addTypeSheet(done) {
    let codeTouched = false;
    const o = overlay(`<h2>New category</h2>
      <label class="f">Name<input type="text" id="ntName" placeholder="e.g. Competitor store" maxlength="30" autocomplete="off" autocorrect="off" spellcheck="false"></label>
      <label class="f">2-letter code<input type="text" id="ntCode" maxlength="2" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false"></label>
      <p class="small muted" id="ntHint">The code appears in visit IDs.</p>
      <div class="row end"><button class="btn" id="ntCancel">Cancel</button><button class="btn primary grow" id="ntSave">Add category</button></div>`);
    const name = $('#ntName', o), code = $('#ntCode', o);
    const hint = () => { $('#ntHint', o).textContent = /^[A-Za-z]{2}$/.test(code.value) ? `Visit IDs will look like AFC-ZAF-${U.ymd().replace(/-/g, '')}-${code.value.toUpperCase()}01.` : 'The code appears in visit IDs.'; };
    name.oninput = () => { if (!codeTouched) { code.value = suggestCode(name.value); hint(); } };
    code.oninput = () => { codeTouched = true; hint(); };
    $('#ntCancel', o).onclick = () => o.remove();
    $('#ntSave', o).onclick = async () => {
      const n = name.value.trim(), c = code.value.trim().toUpperCase();
      if (!n) return toast('Give the category a name');
      if (!/^[A-Z]{2}$/.test(c)) return toast('The code must be 2 letters');
      if (allTypes().some(t => t[0] === c)) return toast(`${c} is already used by “${typeName(c)}”`);
      if (allTypes().some(t => t[1].toLowerCase() === n.toLowerCase())) return toast('That category already exists');
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
    if (!await copyText(text)) { box.innerHTML = '<p class="warnbox">Could not copy on this device. Use Share instead.</p>'; return false; }
    box.innerHTML = `<div class="box next"><strong>${ICON.check}${esc(what)} copied</strong>
      <p class="small">${claudeLink ? 'Open your project, paste into the chat and send.' : 'Open your Claude Project, paste into the chat and send. Add your project link in Settings to open it from here.'}</p>
      ${claudeLink ? `<a class="btn primary block" href="${esc(claudeLink)}" target="_blank" rel="noopener">Open my Claude Project</a>` : ''}</div>`;
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
  function summarise(vs) {
    const tally = (arr, key) => { const o = {}; for (const x of arr) { const k = key(x); if (k) o[k] = (o[k] || 0) + 1; } return Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };
    const media = vs.flatMap(live), kind = k => media.filter(x => x.kind === k);
    return {
      n: vs.length, days: new Set(vs.map(v => v.date)).size,
      photos: kind('photo').length, videos: kind('video').length, audio: kind('audio').length,
      audioMin: Math.round(kind('audio').reduce((t, x) => t + (x.duration_s || 0), 0) / 60),
      byType: tally(vs, v => typeName(v.visit_type, v)), byPlace: tally(vs, v => v.city || 'No city given'),
      byLabel: tally(vs.flatMap(v => v.labels), l => l),
      todos: vs.flatMap(v => v.checklist.filter(c => !c.done && c.text.trim()).map(c => ({ v, text: c.text }))),
      pending: vs.filter(v => !v.exported_at || Date.parse(v.updated_at) > Date.parse(v.exported_at)),
      noConsent: vs.filter(needsWarning),
    };
  }
  function summaryText(vs, s, from, to, label) {
    const span = label === 'All time' ? 'all time' : from === to ? fmtDate(from) : `${fmtDate(from)} to ${fmtDate(to)}`;
    const list = arr => arr.map(x => `${x[0]} ${x[1]}`).join(', ') || 'none';
    const L = [`FIELD SUMMARY — Eyes & Ears (NEE) — ${label}: ${span}`, '',
      `Visits: ${s.n} over ${s.days} day${s.days === 1 ? '' : 's'}`, `By category: ${list(s.byType)}`, `By place: ${list(s.byPlace)}`,
      `Captured: ${s.photos} photos, ${s.videos} videos, ${s.audio} audio (${s.audioMin} min)`];
    if (s.byLabel.length) L.push(`Labels: ${list(s.byLabel)}`);
    L.push(`Not yet exported: ${s.pending.length}`);
    if (s.noConsent.length) L.push(`Recorded with consent = no: ${s.noConsent.map(v => v.visit_id).join(', ')}`);
    L.push('', `Open to-dos (${s.todos.length}):`);
    for (const t of s.todos) L.push(`- [${t.v.visit_id}] ${t.text}`);
    L.push('', 'Visits:');
    for (const v of vs.slice().sort((a, b) => a.visit_id.localeCompare(b.visit_id))) {
      L.push(`- ${v.visit_id} · ${typeName(v.visit_type, v)}${placeOf(v) ? ' · ' + placeOf(v) : ''}${v.outlet_type ? ' · ' + v.outlet_type : ''} · ${v.date} ${v.start_time}`);
    }
    return L.join('\n') + '\n';
  }
  const tabbar = on => `<nav class="tabbar" aria-label="Sections"><a href="#/" class="${on === 'home' ? 'on' : ''}"${on === 'home' ? ' aria-current="page"' : ''}>${ICON.list}Visits</a>
    <a href="#/summary" class="${on === 'summary' ? 'on' : ''}"${on === 'summary' ? ' aria-current="page"' : ''}>${ICON.chart}Summary</a></nav>`;

  async function renderSummary() {
    const all = (await DB.getVisits()).filter(v => !v.deleted_at);
    const [from, to, label] = rangeOf(sumRange);
    const vs = all.filter(v => v.date >= from && v.date <= to), s = summarise(vs);
    const bars = rows => { const max = Math.max(1, ...rows.map(r => r[1])); return rows.map(r => `<div class="barrow"><span class="bl">${esc(r[0])}</span><span class="bt"><span style="width:${Math.round(r[1] / max * 100)}%"></span></span><span class="bn">${r[1]}</span></div>`).join(''); };
    root.innerHTML = `
      <header class="bar home"><div class="grow"><h1>Summary</h1>
        <div class="today">${label === 'All time' ? 'Everything on this device' : from === to ? esc(fmtDate(from)) : `${esc(fmtDate(from))} – ${esc(fmtDate(to))}`}</div></div></header>
      <div class="tchips" id="ranges" role="group" aria-label="Period">${[['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['all', 'All time']].map(r =>
        `<button class="tchip ${sumRange === r[0] ? 'on' : ''}" data-r="${r[0]}" aria-pressed="${sumRange === r[0]}">${r[1]}</button>`).join('')}</div>
      ${!vs.length ? `<div class="empty">${ICON.chart}<strong>No visits in this period</strong>Pick another period, or start a visit from the Visits tab.</div>` : `
      <div class="stats">
        <div class="stat"><b>${s.n}</b><span>visit${s.n === 1 ? '' : 's'} · ${s.days} day${s.days === 1 ? '' : 's'}</span></div>
        <div class="stat"><b>${s.photos}</b><span>photo${s.photos === 1 ? '' : 's'}</span></div>
        <div class="stat"><b>${s.videos}</b><span>video${s.videos === 1 ? '' : 's'}</span></div>
        <div class="stat"><b>${s.audioMin}<small> min</small></b><span>${s.audio} audio</span></div>
      </div>
      ${s.pending.length ? `<div class="banner"><span class="grow">${s.pending.length} of ${s.n} visit${s.n === 1 ? '' : 's'} not exported yet.</span></div>` : '<p class="chips"><span class="chip ok">All visits in this period are exported</span></p>'}
      ${s.noConsent.length ? `<div class="warnbox">⚠ ${s.noConsent.length} visit${s.noConsent.length === 1 ? ' has' : 's have'} audio or video with consent marked No.</div>` : ''}
      <h3>By category</h3><div class="box">${bars(s.byType)}</div>
      <h3>By place</h3><div class="box">${bars(s.byPlace.slice(0, 8))}</div>
      ${s.byLabel.length ? `<h3>Labels</h3><div class="chips">${s.byLabel.map(l => `<span class="chip">${esc(l[0])} · ${l[1]}</span>`).join('')}</div>` : ''}
      <h3>Open to-dos <span class="count">${s.todos.length}</span></h3>
      ${s.todos.length ? `<div class="box todos">${s.todos.slice(0, 30).map(t => `<a href="#/v/${encodeURIComponent(t.v.visit_id)}"><span>${esc(t.text)}</span><small>${esc(typeName(t.v.visit_type, t.v))}${placeOf(t.v) ? ' · ' + esc(placeOf(t.v)) : ''}</small></a>`).join('')}</div>` : '<p class="muted">Nothing open.</p>'}
      <div class="actions">
        <button class="btn primary block" id="sumClaude">${ICON.share}Send summary to Claude Project</button>
        <div id="sumNext"></div>
        ${navigator.share ? `<button class="btn block" id="sumShare">Share summary…</button>` : ''}
      </div>`}
      ${tabbar('summary')}`;
    $('#ranges').onclick = e => { const b = e.target.closest('[data-r]'); if (b) { sumRange = b.dataset.r; renderSummary(); } };
    if (!vs.length) return;
    const text = summaryText(vs, s, from, to, label);
    $('#sumClaude').onclick = () => claudeStep($('#sumNext'), text, 'Summary');
    if ($('#sumShare')) $('#sumShare').onclick = async () => {
      try { await navigator.share({ text }); } catch (e) { if (e.name !== 'AbortError') toast('Share did not open. Use “Send summary to Claude Project”.'); }
    };
  }

  /* ---------- visit editor ---------- */
  async function renderVisit(id) {
    const v = await DB.getVisit(id);
    if (!v) return void go('#/');
    if (v.deleted_at) return void go('#/bin');
    cur = v;
    const all = await DB.getVisits();
    const allLabels = [...new Set(all.flatMap(x => x.labels))].sort();
    const noAttr = 'autocomplete="off" autocorrect="off" spellcheck="false"';
    root.innerHTML = `
      <header class="bar"><button class="btn icon" id="back" aria-label="Back to visits">${ICON.back}</button>
        <span class="grow savestate" id="saveState" role="status"></span>
        <button class="btn icon" id="pin" aria-label="Pin">${ICON.pin}</button>
        <button class="btn icon" id="more" aria-label="More actions">${ICON.more}</button></header>
      <div class="vhead">
        <div class="vtitle"><span class="tbadge">${esc(v.visit_type)}</span><h1>${esc(typeName(v.visit_type, v))}</h1></div>
        <button class="vsub" id="editDetails"><span id="sum"></span>${ICON.edit}</button>
        <div class="chips"><button class="chip vid" id="copyId" aria-label="Copy visit ID">${esc(v.visit_id)}</button><span class="chip" id="when"></span><span class="chip" id="cchip"></span></div>
      </div>
      <div id="warn"></div>
      <textarea id="txt" aria-label="Dictation or raw text" placeholder="Tap here and dictate what you see and hear…" autocorrect="off" spellcheck="false" autocapitalize="sentences"></textarea>
      <div id="rec"></div>
      <h3>Photos, videos and audio</h3>
      <div id="media"><div class="mgrid" id="mgrid"></div><div id="maudio"></div></div>
      <h3>Typed notes</h3>
      <textarea id="notes" aria-label="Typed notes" placeholder="Prices, names of products, follow-ups…" autocorrect="off" spellcheck="false" autocapitalize="sentences"></textarea>
      <h3>Checklist</h3><div id="check"></div>
      <div class="addrow"><input type="text" id="checkNew" placeholder="Add an item" aria-label="New checklist item" ${noAttr}><button class="btn" id="checkAdd">Add</button></div>
      <h3>Labels</h3><div class="chips" id="labels"></div>
      <div class="addrow"><input type="text" id="labelNew" list="dlLabels" placeholder="Add a label" aria-label="New label" ${noAttr}><button class="btn" id="labelAdd">Add</button></div>
      <datalist id="dlLabels">${allLabels.map(l => `<option value="${esc(l)}">`).join('')}</datalist>
      <h3>Colour</h3><div class="swatches" id="colours"></div>
      <div class="capture"><div class="in">
        <label class="btn" id="photoBtn" role="button" tabindex="0">${ICON.camera}Photo<input type="file" id="photoIn" accept="image/*" capture="environment"></label>
        <button class="btn" id="recBtn">${REC_IDLE}</button>
        <label class="btn" id="videoBtn" role="button" tabindex="0">${ICON.video}Video<input type="file" id="videoIn" accept="video/*" capture="environment"></label>
      </div></div>`;
    // Set text through .value so it is stored and shown exactly as entered.
    $('#txt').value = v.text_raw; $('#notes').value = v.typed_notes;
    fit($('#txt')); fit($('#notes'));

    $('#back').onclick = () => go('#/');
    $('#txt').oninput = e => { cur.text_raw = e.target.value; fit(e.target); scheduleSave(); };
    $('#notes').oninput = e => { cur.typed_notes = e.target.value; fit(e.target); scheduleSave(); };
    $('#pin').onclick = () => { cur.pinned = !cur.pinned; drawHead(); scheduleSave(); };
    $('#more').onclick = moreSheet;
    $('#editDetails').onclick = detailsSheet;
    $('#cchip').onclick = detailsSheet;
    $('#copyId').onclick = async () => {
      try { await navigator.clipboard.writeText(cur.visit_id); toast('Visit ID copied'); } catch (e) { toast(cur.visit_id); }
    };
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
    $('#media').onclick = e => {
      const t = e.target.closest('[data-open]'), d = e.target.closest('[data-dm]');
      if (t) viewer(t.dataset.open); else if (d) deleteMedia(d.dataset.dm);
    };
    drawHead(); drawCheck(); drawLabels(); drawColours(); drawMedia();
  }

  function drawHead() {
    const v = cur; if (!v || !$('#pin')) return;
    $('#pin').classList.toggle('on', v.pinned); $('#pin').setAttribute('aria-pressed', v.pinned);
    $('#pin').setAttribute('aria-label', v.pinned ? 'Unpin' : 'Pin');
    const sum = [placeOf(v), v.outlet_type, v.who_role].filter(Boolean).join(' · ');
    $('#sum').textContent = sum || 'Add place and details';
    $('#sum').classList.toggle('muted', !sum);
    $('#when').textContent = `${dayLabel(v.date)} · ${v.start_time}–${v.end_time}`;
    const c = $('#cchip');
    c.textContent = v.consent_stated === 'yes' ? 'Consent: yes' : 'Consent: no';
    c.className = `chip ${v.consent_stated === 'yes' ? 'ok' : needsWarning(v) ? 'warn' : ''}`;
    $('#warn').innerHTML = needsWarning(v) ? '<div class="warnbox" role="alert">⚠ This visit has audio or video but consent is marked No.</div>' : '';
    document.querySelectorAll('#consent [data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === v.consent_stated));
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
    o.addEventListener('click', e => { if (e.target === o) o.remove(); });
    $('#expVisit', o).onclick = act(async () => { await saveNow(); exportFlow('visit', cur); });
    $('#expDay', o).onclick = act(async () => { await saveNow(); exportFlow('day', cur.date); });
    $('#mDetails', o).onclick = act(detailsSheet);
    $('#editDate', o).onclick = act(editDate);
    $('#delVisit', o).onclick = act(async () => {
      if (!await confirmDlg('Delete this visit?', `${cur.visit_id} moves to Recently deleted for ${U.BIN_DAYS} days, then is removed for good.`, 'Delete', true)) return;
      cur.deleted_at = U.iso(); await saveNow(); toast('Moved to Recently deleted'); go('#/');
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
      <div class="flabel">Did they say yes to being recorded?</div>
      <div class="seg" id="consent"><button class="btn" data-c="yes">Yes, consent stated</button><button class="btn" data-c="no">No</button></div>
      <p class="small muted">${esc(typeName(v.visit_type, v))} in ${esc(v.country)} on ${esc(fmtDate(v.date))}. Type and country are part of the visit ID and stay fixed.${v.date_edit_reason ? ` Date edited: ${esc(v.date_edit_reason)}` : ''}</p>
      <div class="row end"><button class="btn primary grow" id="dDone">Done</button></div>`);
    o.querySelectorAll('[data-f]').forEach(el => {
      el.oninput = el.onchange = () => { cur[el.dataset.f] = el.value; drawHead(); scheduleSave(); };
    });
    $('#consent', o).onclick = e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      cur.consent_stated = b.dataset.c; drawHead(); scheduleSave();
    };
    $('#dDone', o).onclick = () => o.remove();
    o.addEventListener('click', e => { if (e.target === o) o.remove(); });
    drawHead();
  }

  function editDate() {
    const o = overlay(`<h2>Change visit date</h2>
      <p class="muted">The visit ID stays ${esc(cur.visit_id)}. A reason is required and is stored with the visit.</p>
      <label class="f">New date<input type="date" id="edDate" value="${esc(cur.date)}"></label>
      <label class="f">Reason<input type="text" id="edReason" autocomplete="off" autocorrect="off" spellcheck="false"></label>
      <div class="row end"><button class="btn" id="edCancel">Cancel</button><button class="btn primary grow" id="edSave">Save date</button></div>`);
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
  let mediaUrl = new Map();   // media id → object URL for the screen that is open
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
      const blob = await DB.getBlob(m.id);
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
        tile.innerHTML = (!url ? '' : m.kind === 'photo' ? `<img src="${url}" alt="">`
          : `<video src="${url}#t=0.1" preload="metadata" muted playsinline tabindex="-1"></video>`) +
          `<span class="mtag">${m.kind === 'video' ? ICON.video : ''}${esc(short)}${m.duration_s != null ? ' · ' + fmtDur(m.duration_s) : ''}</span>`;
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
    const o = overlay(`<h2 class="mono">${esc(m.id)}</h2><p class="muted small">${mediaMeta(m)}</p>
      ${!url ? '<p class="muted">File missing on this device.</p>' : m.kind === 'photo' ? `<img class="vmedia" src="${url}" alt="Photo ${esc(m.id)}">`
        : `<video class="vmedia" controls playsinline preload="metadata" src="${url}"></video>`}
      <div class="row end"><button class="btn danger" id="vDel">${ICON.trash}Delete</button><button class="btn primary grow" id="vDone">Done</button></div>`);
    $('#vDone', o).onclick = () => o.remove();
    o.addEventListener('click', e => { if (e.target === o) o.remove(); });
    $('#vDel', o).onclick = async () => { if (await deleteMedia(id)) o.remove(); };
  }

  async function deleteMedia(id) {
    if (!await confirmDlg('Delete this item?', `${id} moves to Recently deleted for ${U.BIN_DAYS} days.`, 'Delete', true)) return false;
    const m = cur && cur.media.find(x => x.id === id); if (!m) return false;
    m.deleted_at = U.iso(); await saveNow(); drawHead(); drawMedia();
    return true;
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
      <p class="muted">${pack.ids.length} visit${pack.ids.length > 1 ? 's' : ''}. Nothing leaves this phone until you choose one of these.</p>
      <div class="actions">
        <button class="btn primary block" id="exClaude">${ICON.share}Send text to Claude Project</button>
        <div id="exNext"></div>
        ${canShare ? '<button class="btn block" id="exShare">Share .zip with photos and audio…</button>' : ''}
        <button class="btn block" id="exSave">Save .zip to this device</button>
        <button class="btn block ghost" id="exClose">Close</button></div>
      <p class="small muted">“Send text” copies the visit text with the PACKAGE command, ready to paste into your project chat. Photos, videos and audio travel only in the .zip.</p>`;
    $('#exClaude', o).onclick = async () => { if (await claudeStep($('#exNext', o), `PACKAGE\n\n${pack.text}`, 'Package text')) await mark(); };
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
      try {
        const r = await Exporter.importZip(f); added += r.added.length; skipped += r.skipped.length; invalid += r.invalid;
        for (const [c, n] of Object.entries(r.typeNames)) if (!allTypes().some(t => t[0] === c)) customTypes.push([c, n]);
        await DB.setMeta('customTypes', customTypes);
      }
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
      <header class="bar"><button class="btn icon" id="back" aria-label="Back to visits">${ICON.back}</button><h1>Settings</h1></header>
      <h3>Laptop / other device</h3>
      <div class="box"><p>Import an exported .zip to view the same visits here. Visits already on this device are skipped, never overwritten.</p>
        <label class="btn primary block">Import .zip<input type="file" id="impIn" accept=".zip,application/zip,application/x-zip-compressed" multiple hidden></label></div>
      <h3>Recently deleted</h3>
      <div class="box"><button class="btn block" id="toBin">Open bin (${binCount} item${binCount === 1 ? '' : 's'})</button></div>
      <h3>Storage on this device</h3>
      <div class="box"><p><strong>${fmtBytes(est.usage)}</strong> used${est.quota ? ` of about ${fmtBytes(est.quota)} available` : ''} · ${all.filter(v => !v.deleted_at).length} visits</p>
        <p>${persisted ? 'Storage is protected (persistent).' : 'Storage is <strong>not</strong> protected. Install the app to the Home Screen and export every evening.'}</p></div>
      <h3>Visit categories</h3>
      <div class="box"><div class="chips" id="cats"></div>
        <p class="small muted">The seven built-in categories stay. Removing one you added keeps its past visits.</p>
        <button class="btn block" id="catAdd">${ICON.plus}Add category</button></div>
      <h3>Claude Project</h3>
      <div class="box"><p>Paste the web link of your Claude Project so the app can open it after an export.</p>
        <div class="addrow"><input type="text" id="clLink" inputmode="url" placeholder="https://claude.ai/project/…" aria-label="Claude Project link" value="${esc(claudeLink)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"><button class="btn" id="clSave">Save</button></div></div>
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
    const drawCats = () => {
      $('#cats').innerHTML = allTypes().map(t => `<span class="chip"><b class="mono">${esc(t[0])}</b>&nbsp;${esc(t[1])}${TYPES.includes(t) ? '' : `<button data-rt="${esc(t[0])}" aria-label="Remove ${esc(t[1])}">✕</button>`}</span>`).join('');
    };
    $('#cats').onclick = async e => {
      const b = e.target.closest('[data-rt]'); if (!b) return;
      customTypes = customTypes.filter(t => t[0] !== b.dataset.rt); await DB.setMeta('customTypes', customTypes); drawCats();
    };
    $('#catAdd').onclick = () => addTypeSheet(drawCats);
    drawCats();
    $('#clSave').onclick = async () => {
      const u = $('#clLink').value.trim();
      if (u && !/^https:\/\/[^\s"'<>]+$/.test(u)) return toast('The link must start with https://');
      claudeLink = u; await DB.setMeta('claudeLink', u); toast(u ? 'Project link saved' : 'Project link removed');
    };
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
      <header class="bar"><button class="btn icon" id="back" aria-label="Back to settings">${ICON.back}</button><h1>Recently deleted</h1></header>
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

  // Lock the page behind any open sheet so only the sheet scrolls.
  new MutationObserver(() => {
    document.documentElement.classList.toggle('lock', !!document.querySelector('.overlay,.lightbox'));
  }).observe(document.body, { childList: true });

  // On touch devices, hide the bottom bars while the keyboard is up (they jump around on iPhone otherwise),
  // and let a tap on empty space put the keyboard away.
  if (matchMedia('(pointer: coarse)').matches) {
    const typing = el => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|date)$/.test(el.type)));
    const sync = () => document.body.classList.toggle('kb', typing(document.activeElement));
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', () => setTimeout(sync, 150));
    let sx = 0, sy = 0;
    document.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchend', e => {
      const t = e.changedTouches[0], a = document.activeElement;
      if (!typing(a) || Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10) return;
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
    try {
      if (navigator.storage && navigator.storage.persist) {
        persisted = await navigator.storage.persisted() || await navigator.storage.persist();
      }
    } catch (e) { persisted = null; }
    registerSW();
    route();
  })();
})();
