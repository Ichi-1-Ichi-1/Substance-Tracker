'use strict';

// ---------- Constants ----------
const SITES = ['Glute links', 'Glute rechts', 'Quad links', 'Quad rechts', 'Delt links', 'Delt rechts', 'Ventroglute links', 'Ventroglute rechts', 'Lat links', 'Lat rechts', 'Bauch (subkutan)', 'Sonstige'];
const ROTATION = SITES.slice(0, 10);
const UNITS = ['mg', 'mcg', 'g', 'IE', 'ml', 'Tabl.', 'Kps.', 'Stk.', 'Zug', 'Einheit'];
const FORMS = { inj: 'Injektion', oral: 'Oral', sc: 'Subkutan', other: 'Sonstiges' };
const CATS = { ped: 'Steroide / PEDs', med: 'Medikamente', supp: 'Supplements', rec: 'Freizeit', other: 'Sonstiges' };
const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308', '#6366f1', '#f97316'];
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MOODS = [['😫', 'Mies'], ['😣', 'Schlecht'], ['😕', 'Mäßig'], ['😐', 'Okay'], ['🙂', 'Gut'], ['😄', 'Super']];

// ---------- Helpers ----------
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const todayKey = () => dayKey(new Date());
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
const addDays = (k, n) => { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); };
const fmtDay = k => parseDay(k).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtLong = k => parseDay(k).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = iso => iso.slice(11, 16);
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : null; };
const fmtNum = (n, d = 2) => n == null ? '–' : (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('de-DE');
const localIso = d => `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- Storage (IndexedDB: one JSON document + a file store for PDFs) ----------
let idb;
function openIdb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('substance-tracker', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('kv');
      r.result.createObjectStore('files', { keyPath: 'id' }).createIndex('day', 'day');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function tx(store, mode, fn) {
  return new Promise((res, rej) => {
    const t = idb.transaction(store, mode), s = t.objectStore(store);
    const r = fn(s);
    t.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
    t.onerror = () => rej(t.error);
  });
}
const kvGet = k => tx('kv', 'readonly', s => s.get(k));
const kvSet = (k, v) => tx('kv', 'readwrite', s => s.put(v, k));
const fileMeta = f => ({ id: f.id, day: f.day, name: f.name, type: f.type, size: f.size, added: f.added });
const filesForDay = day => tx('files', 'readonly', s => s.index('day').getAll(day));
const allFiles = () => tx('files', 'readonly', s => s.getAll());
const getFile = id => tx('files', 'readonly', s => s.get(id));
const putFile = f => tx('files', 'readwrite', s => s.put(f));
const delFile = id => tx('files', 'readwrite', s => s.delete(id));

const emptyDb = () => ({ version: 2, substances: [], logs: [], days: {}, settings: { calories: true, kcalGoal: null, proteinGoal: null } });
let db = emptyDb();

let saving = Promise.resolve();
function save() {
  const snapshot = JSON.parse(JSON.stringify(db));
  saving = saving.then(() => kvSet('db', snapshot)).catch(() => toast('Speichern fehlgeschlagen – bitte Backup exportieren!'));
  return saving;
}

// Bring in data from the first version (localStorage) once.
function migrateV1() {
  try {
    const raw = localStorage.getItem('substance-tracker-v1');
    if (!raw) return false;
    const d = JSON.parse(raw);
    db.substances = (d.substances || []).map(s => ({ category: 'ped', ...s }));
    db.logs = (d.logs || []).map(l => {
      const s = db.substances.find(x => x.id === l.subId);
      return { ...l, name: s ? s.name : l.subName || 'Unbekannt', unit: s ? s.unit : l.unit || '', category: s ? s.category : 'other' };
    });
    for (const h of d.health || []) {
      const k = h.time.slice(0, 10), day = getDay(k);
      const parts = [h.weight != null && `Gewicht ${h.weight} kg`, h.sys != null && `RR ${h.sys}/${h.dia ?? '–'}`, h.pulse != null && `Puls ${h.pulse}`, h.note].filter(Boolean);
      if (parts.length) day.note = (day.note ? day.note + '\n' : '') + parts.join(', ');
    }
    localStorage.removeItem('substance-tracker-v1');
    return true;
  } catch (e) { return false; }
}

// ---------- Model helpers ----------
const subById = id => db.substances.find(s => s.id === id);
const getDay = k => (db.days[k] ||= {});
const peekDay = k => db.days[k] || {};
const logsOn = k => db.logs.filter(l => l.time.slice(0, 10) === k).sort((a, b) => a.time.localeCompare(b.time));
const colorOf = l => (subById(l.subId) || {}).color || '#9ca3af';

function doseText(s, amount) {
  let t = `${fmtNum(amount)} ${s.unit}`;
  if (s.conc && s.unit === 'mg') t += ` (${fmtNum(amount / s.conc)} ml)`;
  return t;
}

function scheduleText(s) {
  const tpd = s.timesPerDay > 1 ? `, ${s.timesPerDay}× täglich` : '';
  if (s.mode === 'weekdays') return (s.weekdays.length ? [1, 2, 3, 4, 5, 6, 0].filter(d => s.weekdays.includes(d)).map(d => WEEKDAYS[d]).join(', ') : 'keine Tage') + tpd;
  if (s.mode === 'asneeded') return 'Nach Bedarf';
  if (s.interval === 1) return 'Täglich' + tpd;
  if (s.interval === 7) return 'Wöchentlich' + tpd;
  return `Alle ${String(s.interval).replace('.', ',')} Tage` + tpd;
}

// Is the substance scheduled on this day? Interval may be fractional (3.5 = E3.5D).
function isDue(s, k) {
  if (!s.active || s.mode === 'asneeded') return false;
  if (s.start && k < s.start) return false;
  if (s.end && k > s.end) return false;
  if (s.mode === 'weekdays') return s.weekdays.includes(parseDay(k).getDay());
  const diff = daysBetween(s.start || k, k), iv = s.interval || 1;
  if (Number.isInteger(iv)) return diff % iv === 0;
  return Math.round(Math.round(diff / iv) * iv) === diff;
}
function nextDue(s, from) {
  for (let i = 0; i < 90; i++) { const k = addDays(from, i); if (isDue(s, k)) return k; }
  return null;
}
function weeklyDose(s) {
  const t = s.timesPerDay || 1;
  if (s.mode === 'asneeded') return null;
  if (s.mode === 'weekdays') return s.dose * s.weekdays.length * t;
  return s.dose * 7 / (s.interval || 1) * t;
}
// Injection site used longest ago (or never).
function suggestSite() {
  const last = {};
  for (const l of db.logs) if (l.site && (!last[l.site] || l.time > last[l.site])) last[l.site] = l.time;
  return ROTATION.reduce((best, s) => ((last[s] || '') < (last[best] || '') ? s : best), ROTATION[0]);
}
const defaultSite = s => s.form === 'inj' ? suggestSite() : s.form === 'sc' ? 'Bauch (subkutan)' : '';

// ---------- Navigation ----------
let tab = 'day', curDay = todayKey(), calMonth = todayKey().slice(0, 7), trendRange = 'month';
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.tab === 'day' && tab === 'day') curDay = todayKey();
  tab = b.dataset.tab; render(); window.scrollTo(0, 0);
}));
function openDay(k) { curDay = k; tab = 'day'; render(); window.scrollTo(0, 0); }

function header(title, sub, controls = '') {
  $('#hbar').innerHTML = `<h1>${title}<span class="sub">${sub}</span></h1>${controls}`;
}

function render() {
  flushNote();
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  ({ day: renderDay, history: renderHistory, trends: renderTrends, plan: renderPlan, more: renderMore })[tab]();
}

let noteTimer;

// ---------- Day view ----------
async function renderDay() {
  const k = curDay, isToday = k === todayKey();
  header(isToday ? 'Heute' : fmtDay(k).split(',')[0] + ', ' + parseDay(k).toLocaleDateString('de-DE'), isToday ? fmtLong(k) : (k > todayKey() ? 'Zukunft' : `vor ${daysBetween(k, todayKey())} Tagen`),
    `<button class="btn icon" onclick="openDay(addDays(curDay,-1))" aria-label="Vorheriger Tag">‹</button>
     ${isToday ? '' : `<button class="btn small" onclick="openDay(todayKey())">Heute</button>`}
     <button class="btn icon" onclick="openDay(addDays(curDay,1))" aria-label="Nächster Tag">›</button>`);
  const day = peekDay(k), logs = logsOn(k);
  const due = db.substances.filter(s => isDue(s, k));
  let html = '';

  // Mood
  html += `<h2>Wie fühlst du dich?</h2><div class="moods">` + MOODS.map(([e, t], i) =>
    `<button class="mood ${day.mood === i ? 'sel' : ''}" onclick="setMood(${i})" aria-label="${i} – ${t}"><span>${e}</span>${i}</button>`).join('') + `</div>`;

  // Plan
  if (due.length) {
    html += `<h2>Plan</h2><div class="card">`;
    for (const s of due) {
      const done = logs.filter(l => l.subId === s.id).length, need = s.timesPerDay || 1;
      html += `<div class="entry row"><div class="dot" style="background:${esc(s.color)}"></div>
        <div class="grow"><div class="name">${esc(s.name)}</div><div class="muted">${doseText(s, s.dose)} · ${FORMS[s.form]}</div></div>
        ${done >= need ? `<span class="done">✓${need > 1 ? ` ${done}/${need}` : ' erledigt'}</span>`
          : `<button class="btn primary small" onclick="quickLog('${s.id}')">${need > 1 ? `${done}/${need} · ` : ''}Erledigt</button>`}</div>`;
    }
    html += `</div>`;
  } else if (!db.substances.length) {
    html += `<div class="card empty" style="margin-top:12px">Noch kein Plan angelegt.<br><br><button class="btn primary" onclick="tab='plan';render()">Zum Plan</button></div>`;
  }

  // Logged
  html += `<h2>Eingetragen <span class="muted">${logs.length || ''}</span></h2>`;
  html += logs.length ? `<div class="card">${logs.map(logRow).join('')}</div>` : '';
  const quick = db.substances.filter(s => s.active && !due.includes(s));
  html += `<div class="chips">${quick.map(s => `<button class="chip" onclick="editLog(null,'${s.id}')"><i class="dot" style="background:${esc(s.color)}"></i>${esc(s.name)}</button>`).join('')}
    <button class="chip" onclick="editLog()">＋ Anderes eintragen</button></div>`;

  // Calories
  if (db.settings.calories) {
    const g = db.settings;
    html += `<h2>Ernährung</h2><div class="card"><div class="grid4">
      ${[['kcal', 'kcal'], ['protein', 'Protein g'], ['carbs', 'KH g'], ['fat', 'Fett g']].map(([f, t]) =>
        `<div><label>${t}</label><input inputmode="decimal" value="${day[f] ?? ''}" oninput="setDayField('${f}', this.value)"></div>`).join('')}</div>
      ${g.kcalGoal ? `<div class="muted" style="margin-top:10px">${fmtNum(day.kcal || 0, 0)} / ${fmtNum(g.kcalGoal, 0)} kcal</div><div class="bar-bg" id="kcalBar"><i style="width:${Math.min(100, (day.kcal || 0) / g.kcalGoal * 100)}%"></i></div>` : ''}
      ${g.proteinGoal ? `<div class="muted" style="margin-top:8px">${fmtNum(day.protein || 0, 0)} / ${fmtNum(g.proteinGoal, 0)} g Protein</div><div class="bar-bg" id="protBar"><i style="width:${Math.min(100, (day.protein || 0) / g.proteinGoal * 100)}%"></i></div>` : ''}
    </div>`;
  }

  // Journal
  html += `<h2>Tagebuch</h2><textarea id="note" data-day="${k}" placeholder="Was hast du heute gemacht? Training, Schlaf, Nebenwirkungen, Besonderheiten …" oninput="noteChanged(this.value)">${esc(day.note || '')}</textarea>`;

  // Documents
  html += `<h2>Dokumente <span class="muted">PDF oder Foto, z. B. Blutbild</span></h2><div id="files"></div>
    <div class="actions" style="margin-top:0"><button class="btn" onclick="$('#fileIn').click()">＋ Dokument hinzufügen</button></div>
    <input type="file" id="fileIn" accept="application/pdf,image/*" multiple style="display:none" onchange="addFiles(this.files)">`;

  // Upcoming
  if (isToday) {
    const upcoming = db.substances.filter(s => s.active && s.mode !== 'asneeded')
      .map(s => ({ s, n: nextDue(s, addDays(k, 1)) })).filter(x => x.n).sort((a, b) => a.n.localeCompare(b.n)).slice(0, 8);
    if (upcoming.length) html += `<h2>Als Nächstes</h2><div class="card">` + upcoming.map(({ s, n }) =>
      `<div class="entry row"><div class="dot" style="background:${esc(s.color)}"></div><div class="grow name">${esc(s.name)}</div><span class="muted">${fmtDay(n)}</span></div>`).join('') + `</div>`;
  }

  $('#view').innerHTML = html;
  renderFiles(k);
}

async function renderFiles(k) {
  const files = await filesForDay(k);
  const box = $('#files');
  if (!box || curDay !== k) return;
  box.innerHTML = files.length ? `<div class="card">${files.map(f => `<div class="entry row">
    <div style="font-size:22px">${f.type === 'application/pdf' ? '📄' : '🖼️'}</div>
    <div class="grow"><div class="name">${esc(f.name)}</div><div class="muted">${fmtNum(f.size / 1024, 0)} KB${f.text ? ' · Text erkannt' : ''}</div></div>
    <button class="btn small" onclick="viewFile('${f.id}')">Öffnen</button></div>`).join('')}</div>` : '';
}

function logRow(l) {
  return `<div class="entry row">
    <div class="dot" style="background:${esc(colorOf(l))}"></div>
    <div class="grow"><div class="name">${esc(l.name)} <span class="muted">${fmtNum(l.amount)} ${esc(l.unit)}</span></div>
      <div class="muted">${fmtTime(l.time)} · ${CATS[l.category] || ''}${l.site ? ' · ' + esc(l.site) : ''}${l.note ? ' · ' + esc(l.note) : ''}</div></div>
    <button class="btn small" onclick="editLog('${l.id}')">✎</button></div>`;
}

// Persist the journal textarea right away (before any re-render replaces it).
function flushNote() {
  clearTimeout(noteTimer);
  const el = $('#note');
  if (el && el.dataset.dirty) { getDay(el.dataset.day).note = el.value; delete el.dataset.dirty; save(); }
}
function setMood(i) {
  flushNote();
  const day = getDay(curDay);
  day.mood = day.mood === i ? null : i;
  save(); renderDay();
}
function setDayField(f, v) {
  const day = getDay(curDay), g = db.settings;
  day[f] = num(v);
  save();
  const bar = (id, val, goal, unit) => { const el = $(id); if (el) { el.querySelector('i').style.width = Math.min(100, (val || 0) / goal * 100) + '%'; el.previousElementSibling.textContent = `${fmtNum(val || 0, 0)} / ${fmtNum(goal, 0)} ${unit}`; } };
  if (g.kcalGoal) bar('#kcalBar', day.kcal, g.kcalGoal, 'kcal');
  if (g.proteinGoal) bar('#protBar', day.protein, g.proteinGoal, 'g Protein');
}
function noteChanged(v) {
  const el = $('#note');
  el.dataset.dirty = '1';
  clearTimeout(noteTimer);
  noteTimer = setTimeout(flushNote, 400);
}
window.addEventListener('pagehide', flushNote);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushNote(); });

function nowOn(k) {
  return k === todayKey() ? localIso(new Date()) : `${k}T${localIso(new Date()).slice(11)}`;
}

function quickLog(subId) {
  const s = subById(subId);
  const site = defaultSite(s);
  db.logs.push({ id: uid(), subId, name: s.name, unit: s.unit, category: s.category, amount: s.dose, time: nowOn(curDay), site, note: '' });
  save(); renderDay();
  toast(`${s.name} eingetragen${site && s.form === 'inj' ? ' – Stelle: ' + site : ''}`);
}

function editLog(id, presetSub) {
  const l = id ? db.logs.find(x => x.id === id) : null;
  const s0 = l ? subById(l.subId) : subById(presetSub);
  const free = l ? !s0 : !presetSub;
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog" id="f">
    <h3>${l ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</h3>
    <label>Was?</label>
    <select name="subId"><option value="">— Frei eingeben —</option>
      ${Object.entries(CATS).map(([c, t]) => { const list = db.substances.filter(s => s.category === c); return list.length ? `<optgroup label="${t}">${list.map(s => `<option value="${s.id}" ${s0 && s.id === s0.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>` : ''; }).join('')}
    </select>
    <div id="freeBox">
      <label>Name</label><input name="name" value="${esc(l && free ? l.name : '')}" placeholder="z. B. Ibuprofen, Alkohol, …">
      <label>Kategorie</label><select name="category">${Object.entries(CATS).map(([c, t]) => `<option value="${c}" ${(l ? l.category : 'rec') === c ? 'selected' : ''}>${t}</option>`).join('')}</select>
    </div>
    <div class="grid2">
      <div><label>Menge</label><input name="amount" inputmode="decimal" value="${l ? l.amount : s0 ? s0.dose : ''}"></div>
      <div><label>Einheit</label><select name="unit">${UNITS.map(u => `<option ${(l ? l.unit : s0 ? s0.unit : 'mg') === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
    </div>
    <label>Zeitpunkt</label><input name="time" type="datetime-local" value="${l ? l.time : nowOn(curDay)}">
    <label>Injektionsstelle</label>
    <select name="site"><option value="">–</option>${SITES.map(x => `<option ${l && l.site === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <div class="muted" style="margin-top:4px">Am längsten nicht benutzt: ${esc(suggestSite())}</div>
    <label>Notiz</label><input name="note" value="${esc(l ? l.note : '')}" placeholder="z. B. PIP, Charge, Wirkung">
    <div class="actions">
      <button class="btn primary" value="save">Speichern</button>
      <button class="btn" value="cancel" formnovalidate>Abbrechen</button>
      ${l ? `<button class="btn danger" value="delete" formnovalidate>Löschen</button>` : ''}
    </div></form>`;
  const f = dlg.querySelector('#f');
  const sync = first => {
    const s = subById(f.subId.value);
    $('#freeBox').style.display = s ? 'none' : '';
    if (!first && s) { f.amount.value = s.dose; f.unit.value = s.unit; f.site.value = defaultSite(s); }
  };
  f.subId.addEventListener('change', () => sync(false)); sync(true);
  if (!l && s0) f.site.value = defaultSite(s0);
  dlg.onclose = () => {
    if (dlg.returnValue === 'delete') {
      if (confirm('Eintrag löschen?')) { db.logs = db.logs.filter(x => x.id !== id); save(); render(); }
      return;
    }
    if (dlg.returnValue !== 'save') return;
    const s = subById(f.subId.value), amount = num(f.amount.value);
    const name = s ? s.name : f.name.value.trim();
    if (!name || amount == null || !f.time.value) { toast('Name, Menge und Zeitpunkt angeben'); return; }
    const data = { subId: s ? s.id : null, name, category: s ? s.category : f.category.value, unit: f.unit.value, amount, time: f.time.value, site: f.site.value, note: f.note.value.trim() };
    if (l) Object.assign(l, data); else db.logs.push({ id: uid(), ...data });
    save(); render(); toast('Gespeichert');
  };
  dlg.returnValue = ''; dlg.showModal();
}

// ---------- Documents (PDF text extraction with bundled pdf.js) ----------
let pdfReady;
function loadPdfJs() {
  return pdfReady ||= new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'vendor/pdf.min.js';
    sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; res(window.pdfjsLib); };
    sc.onerror = () => { pdfReady = null; rej(new Error('pdf.js nicht geladen')); };
    document.head.appendChild(sc);
  });
}
async function extractPdfText(blob) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: await blob.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    pages.push(c.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+\n/g, '\n').trim());
  }
  return pages.join('\n\n— Seite —\n\n').trim();
}
async function addFiles(list) {
  const k = curDay;
  for (const file of list) {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const f = { id: uid(), day: k, name: file.name, type: file.type, size: file.size, added: new Date().toISOString(), blob, text: '' };
    if (file.type === 'application/pdf') {
      toast('Lese PDF aus …');
      try { f.text = await extractPdfText(blob); } catch (e) { toast('Text konnte nicht gelesen werden'); }
    }
    await putFile(f);
  }
  toast('Dokument gespeichert');
  if (tab === 'day') renderFiles(k);
}
async function viewFile(id) {
  const f = await getFile(id);
  if (!f) return;
  const dlg = $('#dlg');
  dlg.onclose = null; dlg.returnValue = '';
  const isPdf = f.type === 'application/pdf';
  dlg.innerHTML = `<h3>${esc(f.name)}</h3><div class="muted">${fmtDay(f.day)}</div>
    ${isPdf ? `<div class="seg" style="margin:12px 0"><button class="on" id="vt">Text</button><button id="vp">Seiten</button></div>
      <div id="vbody"><div class="pdftext">${f.text ? esc(f.text) : 'Kein Text gefunden – vermutlich ein gescanntes Dokument. Unter „Seiten“ kannst du es ansehen.'}</div></div>`
      : `<div class="pages" style="margin-top:12px"><img src="${URL.createObjectURL(f.blob)}" alt=""></div>`}
    <div class="actions">
      <button class="btn primary" id="vclose">Schließen</button>
      ${isPdf && f.text ? `<button class="btn" id="vcopy">Text kopieren</button>` : ''}
      <button class="btn danger" id="vdel">Löschen</button>
    </div>`;
  dlg.querySelector('#vclose').onclick = () => dlg.close();
  dlg.querySelector('#vdel').onclick = async () => {
    if (!confirm('Dokument löschen?')) return;
    await delFile(id); dlg.close(); render();
  };
  if (isPdf) {
    const showText = () => { $('#vt').classList.add('on'); $('#vp').classList.remove('on'); $('#vbody').innerHTML = `<div class="pdftext">${f.text ? esc(f.text) : 'Kein Text gefunden.'}</div>`; };
    const showPages = async () => {
      $('#vp').classList.add('on'); $('#vt').classList.remove('on');
      const body = $('#vbody'); body.innerHTML = '<div class="pages"></div>';
      const lib = await loadPdfJs();
      const doc = await lib.getDocument({ data: await f.blob.arrayBuffer() }).promise;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i), vp = page.getViewport({ scale: 2 });
        const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
        body.firstChild.appendChild(c);
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      }
    };
    $('#vt').onclick = showText; $('#vp').onclick = showPages;
    const cp = dlg.querySelector('#vcopy');
    if (cp) cp.onclick = () => navigator.clipboard.writeText(f.text).then(() => toast('Kopiert'), () => toast('Kopieren nicht möglich'));
  }
  dlg.showModal();
}

// ---------- History (calendar + search) ----------
async function renderHistory() {
  const [y, m] = calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const monthName = first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const shift = n => { const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  header('Verlauf', monthName,
    `<button class="btn icon" onclick="calMonth='${shift(-1)}';renderHistory()" aria-label="Vorheriger Monat">‹</button>
     <button class="btn icon" onclick="calMonth='${shift(1)}';renderHistory()" aria-label="Nächster Monat">›</button>`);

  const files = await allFiles();
  const fileDays = new Set(files.map(f => f.day));
  const lead = (first.getDay() + 6) % 7, nDays = new Date(y, m, 0).getDate(), today = todayKey();
  let cal = `<div class="cal">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => `<div class="h">${d}</div>`).join('')}`;
  for (let i = 0; i < lead; i++) cal += `<button class="out" tabindex="-1"></button>`;
  for (let d = 1; d <= nDays; d++) {
    const k = `${calMonth}-${pad(d)}`, day = peekDay(k), logs = logsOn(k);
    const dots = [...new Set(logs.map(colorOf))].slice(0, 4).map(c => `<i style="background:${esc(c)}"></i>`).join('');
    cal += `<button class="${k === today ? 'today' : ''}" onclick="openDay('${k}')">
      <span>${d}</span><span class="e">${day.mood != null ? MOODS[day.mood][0] : (day.note || fileDays.has(k) ? '·' : '')}</span><span class="m">${dots}</span></button>`;
  }
  cal += `</div>`;

  // Month totals
  const monthLogs = db.logs.filter(l => l.time.startsWith(calMonth));
  const totals = {};
  for (const l of monthLogs) { const key = l.name + '|' + l.unit; (totals[key] ||= { name: l.name, unit: l.unit, sum: 0, n: 0, color: colorOf(l) }); totals[key].sum += l.amount; totals[key].n++; }
  const moods = Object.entries(db.days).filter(([k, d]) => k.startsWith(calMonth) && d.mood != null).map(([, d]) => d.mood);

  let html = `<div class="card">${cal}</div>`;
  html += `<h2>Diesen Monat</h2><div class="card">
    <div class="muted">${moods.length ? `Stimmung Ø ${fmtNum(moods.reduce((a, b) => a + b, 0) / moods.length, 1)} an ${moods.length} Tagen` : 'Keine Stimmung erfasst'}</div>
    ${Object.keys(totals).length ? `<table style="margin-top:8px"><tr><th>Was</th><th class="num">Anzahl</th><th class="num">Gesamt</th></tr>
      ${Object.values(totals).sort((a, b) => a.name.localeCompare(b.name)).map(t => `<tr><td><span class="row" style="gap:6px"><i class="dot" style="background:${esc(t.color)}"></i>${esc(t.name)}</span></td><td class="num">${t.n}×</td><td class="num">${fmtNum(t.sum)} ${esc(t.unit)}</td></tr>`).join('')}</table>` : ''}
  </div>`;

  html += `<h2>Suchen</h2><input id="q" type="search" placeholder="Tagebuch, Einträge, PDF-Texte durchsuchen" value="${esc(renderHistory.q || '')}" oninput="renderHistory.q=this.value;runSearch()"><div id="results" style="margin-top:10px"></div>`;
  $('#view').innerHTML = html;
  runSearch(files);
}

async function runSearch(files) {
  const q = (renderHistory.q || '').trim().toLowerCase(), box = $('#results');
  if (!box) return;
  if (q.length < 2) { box.innerHTML = ''; return; }
  files ||= await allFiles();
  const hits = [];
  const snippet = t => {
    const i = t.toLowerCase().indexOf(q), a = Math.max(0, i - 40);
    return (a ? '…' : '') + esc(t.slice(a, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length, i + q.length + 60)) + '…';
  };
  for (const [k, d] of Object.entries(db.days)) if (d.note && d.note.toLowerCase().includes(q)) hits.push({ k, what: 'Tagebuch', text: snippet(d.note) });
  for (const l of db.logs) { const t = `${l.name} ${l.note || ''} ${l.site || ''}`; if (t.toLowerCase().includes(q)) hits.push({ k: l.time.slice(0, 10), what: l.name, text: snippet(t) }); }
  for (const f of files) { const t = `${f.name}\n${f.text || ''}`; if (t.toLowerCase().includes(q)) hits.push({ k: f.day, what: '📄 ' + f.name, text: snippet(t) }); }
  hits.sort((a, b) => b.k.localeCompare(a.k));
  box.innerHTML = hits.length ? `<div class="card">${hits.slice(0, 100).map(h => `<div class="entry" onclick="openDay('${h.k}')" style="cursor:pointer">
    <div class="row"><span class="name grow">${esc(h.what)}</span><span class="muted">${fmtDay(h.k)}</span></div><div class="muted">${h.text}</div></div>`).join('')}</div>`
    : `<div class="card empty">Nichts gefunden.</div>`;
}

// ---------- Trends ----------
function renderTrends() {
  header('Trends', 'Stimmung im Zeitverlauf');
  const ranges = [['week', 'Woche'], ['month', 'Monat'], ['quarter', '3 Mon.'], ['year', 'Jahr'], ['all', 'Alles']];
  const today = todayKey();
  const moodDays = Object.keys(db.days).filter(k => db.days[k].mood != null).sort();
  const span = { week: 7, month: 30, quarter: 91, year: 365 }[trendRange] || Math.max(7, moodDays.length ? daysBetween(moodDays[0], today) + 1 : 30);
  const from = addDays(today, -(span - 1));
  // Daily points up to ~3 months, then weekly averages, then monthly for multi-year spans.
  const bucket = span <= 100 ? 1 : span <= 800 ? 7 : 30;
  const pts = [];
  for (let start = from; start <= today; start = addDays(start, bucket)) {
    const vals = [];
    for (let i = 0; i < bucket; i++) { const k = addDays(start, i); if (k > today) break; const d = db.days[k]; if (d && d.mood != null) vals.push(d.mood); }
    pts.push({ k: start, end: bucket > 1 ? addDays(start, bucket - 1) : start, v: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, n: vals.length });
  }
  const inRange = moodDays.filter(k => k >= from);
  const avg = inRange.length ? inRange.reduce((a, k) => a + db.days[k].mood, 0) / inRange.length : null;
  const prevFrom = addDays(from, -span), prev = moodDays.filter(k => k >= prevFrom && k < from);
  const prevAvg = prev.length ? prev.reduce((a, k) => a + db.days[k].mood, 0) / prev.length : null;
  const diff = avg != null && prevAvg != null ? avg - prevAvg : null;

  let html = `<div class="seg">${ranges.map(([r, t]) => `<button class="${r === trendRange ? 'on' : ''}" onclick="trendRange='${r}';renderTrends()">${t}</button>`).join('')}</div>
    <div class="stat">
      <div><div class="muted">Ø Stimmung</div><div class="v">${avg != null ? fmtNum(avg, 1) + ' ' + MOODS[Math.round(avg)][0] : '–'}</div></div>
      <div><div class="muted">Erfasste Tage</div><div class="v">${inRange.length}</div></div>
      <div><div class="muted">vs. davor</div><div class="v">${diff != null ? (diff > 0 ? '▲ +' : diff < 0 ? '▼ ' : '') + fmtNum(diff, 1) : '–'}</div></div>
    </div>
    <div class="card"><div class="muted" style="margin-bottom:6px">${bucket === 1 ? 'Tageswerte' : bucket === 7 ? 'Wochendurchschnitt' : 'Monatsdurchschnitt'} · 0 = mies, 5 = super</div>
      <div class="chart" id="moodChart"></div></div>`;

  if (db.settings.calories) {
    html += `<h2>Kalorien</h2><div class="card"><div class="muted" style="margin-bottom:6px">${bucket === 1 ? 'Tageswerte' : 'Durchschnitt pro Tag'}</div><div class="chart" id="kcalChart"></div></div>`;
  }
  if (!moodDays.length) html += `<div class="notice">Tippe auf „Tag“ jeden Tag einen Smiley an – hier entsteht dann deine Kurve.</div>`;
  $('#view').innerHTML = html;

  lineChart($('#moodChart'), pts, { min: 0, max: 5, ticks: [0, 1, 2, 3, 4, 5], fmt: v => fmtNum(v, 1) + ' ' + MOODS[Math.round(v)][0], label: v => v });
  if (db.settings.calories) {
    const kp = pts.map(p => {
      const vals = [];
      for (let k = p.k; k <= p.end && k <= today; k = addDays(k, 1)) { const d = db.days[k]; if (d && d.kcal != null) vals.push(d.kcal); }
      return { ...p, v: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
    });
    const vals = kp.map(p => p.v).filter(v => v != null);
    const max = vals.length ? Math.ceil(Math.max(...vals, db.settings.kcalGoal || 0) / 500) * 500 : 3000;
    lineChart($('#kcalChart'), kp, { min: 0, max, ticks: [0, max / 2, max], fmt: v => fmtNum(v, 0) + ' kcal', label: v => fmtNum(v, 0), goal: db.settings.kcalGoal });
  }
}

// Single-series line chart: 2px line, 8px markers, recessive grid, crosshair + tooltip.
function lineChart(el, pts, o) {
  const W = el.clientWidth || 320, H = 190, L = 34, R = 10, T = 10, B = 24;
  const x = i => L + (pts.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (pts.length - 1));
  const y = v => T + (1 - (v - o.min) / (o.max - o.min)) * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Verlaufskurve">`;
  for (const t of o.ticks) s += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--grid)" stroke-width="1"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${o.label(t)}</text>`;
  if (o.goal) s += `<line x1="${L}" x2="${W - R}" y1="${y(o.goal)}" y2="${y(o.goal)}" stroke="var(--muted)" stroke-dasharray="4 4" stroke-width="1"/><text x="${W - R}" y="${y(o.goal) - 4}" text-anchor="end" font-size="11" fill="var(--muted)">Ziel</text>`;
  // x labels: ~5 evenly spaced
  const n = Math.min(5, pts.length), step = Math.max(1, Math.round((pts.length - 1) / Math.max(1, n - 1)));
  for (let i = 0; i < pts.length; i += step) {
    const d = parseDay(pts[i].k);
    const lbl = pts[pts.length - 1].k !== pts[pts.length - 1].end || pts.length > 60 ? d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }) : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    s += `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : 'middle'}" font-size="11" fill="var(--muted)">${lbl}</text>`;
  }
  // Line segments; gaps where there is no data
  let path = '', pen = false;
  pts.forEach((p, i) => { if (p.v == null) { pen = false; return; } path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`; pen = true; });
  s += `<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  if (pts.length <= 120) pts.forEach((p, i) => { if (p.v != null) s += `<circle cx="${x(i)}" cy="${y(p.v)}" r="4" fill="var(--accent)" stroke="var(--card)" stroke-width="2"/>`; });
  s += `<line id="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-width="1" visibility="hidden"/>`;
  s += `<circle id="xp" r="5" fill="var(--accent)" stroke="var(--card)" stroke-width="2" visibility="hidden"/>`;
  s += `<rect x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent" id="hit"/></svg><div class="tip"></div>`;
  el.innerHTML = s;
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), xh = svg.querySelector('#xh'), xp = svg.querySelector('#xp');
  const show = ev => {
    const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * W / r.width;
    let best = -1, bd = Infinity;
    pts.forEach((p, i) => { if (p.v != null && Math.abs(x(i) - px) < bd) { bd = Math.abs(x(i) - px); best = i; } });
    if (best < 0) return hide();
    const p = pts[best];
    xh.setAttribute('x1', x(best)); xh.setAttribute('x2', x(best)); xh.setAttribute('visibility', 'visible');
    xp.setAttribute('cx', x(best)); xp.setAttribute('cy', y(p.v)); xp.setAttribute('visibility', 'visible');
    const when = p.k === p.end ? fmtDay(p.k) : `${parseDay(p.k).toLocaleDateString('de-DE')} – ${parseDay(p.end).toLocaleDateString('de-DE')}`;
    tip.innerHTML = `${when}<br><b>${o.fmt(p.v)}</b>${p.k !== p.end ? ` · ${p.n} Tage` : ''}`;
    tip.style.display = 'block';
    const left = x(best) * r.width / W;
    tip.style.left = Math.min(Math.max(left, 70), r.width - 70) + 'px';
    tip.style.top = (y(p.v) * r.height / H - 10) + 'px';
  };
  const hide = () => { tip.style.display = 'none'; xh.setAttribute('visibility', 'hidden'); xp.setAttribute('visibility', 'hidden'); };
  svg.addEventListener('pointermove', show); svg.addEventListener('pointerdown', show); svg.addEventListener('pointerleave', hide);
}
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (tab === 'trends') renderTrends(); }, 150); });

// ---------- Plan ----------
function renderPlan() {
  header('Plan', `${db.substances.filter(s => s.active).length} aktiv`, `<button class="btn primary small" onclick="editSubstance()">＋ Neu</button>`);
  let html = '';
  for (const [c, t] of Object.entries(CATS)) {
    const list = db.substances.filter(s => s.category === c).sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name));
    if (!list.length) continue;
    html += `<h2>${t}</h2><div class="card">`;
    for (const s of list) {
      const weekly = weeklyDose(s);
      html += `<div class="entry row" style="${s.active ? '' : 'opacity:.55'}">
        <div class="dot" style="background:${esc(s.color)}"></div>
        <div class="grow"><div class="name">${esc(s.name)}${s.active ? '' : ' <span class="muted">(pausiert)</span>'}</div>
          <div class="muted">${doseText(s, s.dose)} · ${scheduleText(s)} · ${FORMS[s.form]}</div>
          ${weekly != null ? `<div class="muted">≈ ${fmtNum(weekly)} ${esc(s.unit)} / Woche</div>` : ''}
          ${s.notes ? `<div class="muted">${esc(s.notes)}</div>` : ''}</div>
        <button class="btn small" onclick="editSubstance('${s.id}')">✎</button></div>`;
    }
    html += `</div>`;
  }
  if (!db.substances.length) html += `<div class="card empty">Lege hier alles an, was du regelmäßig oder ab und zu nimmst – Steroide, Medikamente, Supplements, Freizeit. Geplante Sachen erscheinen dann am jeweiligen Tag zum Abhaken, „nach Bedarf“-Sachen als Schnell-Buttons.</div>`;
  $('#view').innerHTML = html;
}

function editSubstance(id) {
  const s = id ? subById(id) : null;
  const v = s || { name: '', category: 'ped', form: 'inj', dose: '', unit: 'mg', conc: '', mode: 'interval', interval: 7, weekdays: [], timesPerDay: 1, start: todayKey(), end: '', active: true, notes: '', color: COLORS[db.substances.length % COLORS.length] };
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog" id="f">
    <h3>${s ? 'Bearbeiten' : 'Neu im Plan'}</h3>
    <label>Name</label><input name="name" value="${esc(v.name)}" placeholder="z. B. Testosteron Enanthat">
    <div class="grid2">
      <div><label>Kategorie</label><select name="category">${Object.entries(CATS).map(([k, t]) => `<option value="${k}" ${v.category === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label>Form</label><select name="form">${Object.entries(FORMS).map(([k, t]) => `<option value="${k}" ${v.form === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label>Dosis pro Einnahme</label><input name="dose" inputmode="decimal" value="${v.dose}"></div>
      <div><label>Einheit</label><select name="unit">${UNITS.map(u => `<option ${v.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      <div><label>Konzentration mg/ml</label><input name="conc" inputmode="decimal" value="${v.conc || ''}" placeholder="optional"></div>
      <div><label>Farbe</label><input name="color" type="color" value="${esc(v.color)}" style="height:43px;padding:4px"></div>
    </div>
    <label>Rhythmus</label>
    <select name="mode">
      <option value="interval" ${v.mode === 'interval' ? 'selected' : ''}>Alle X Tage</option>
      <option value="weekdays" ${v.mode === 'weekdays' ? 'selected' : ''}>Bestimmte Wochentage</option>
      <option value="asneeded" ${v.mode === 'asneeded' ? 'selected' : ''}>Nach Bedarf (Schnell-Button)</option>
    </select>
    <div id="ivBox"><label>Alle wie viele Tage? (1 = täglich, 3,5 = E3.5D, 7 = wöchentlich)</label>
      <input name="interval" inputmode="decimal" value="${String(v.interval).replace('.', ',')}"></div>
    <div id="wdBox"><label>Wochentage</label><div class="days">
      ${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" name="wd" value="${d}" ${v.weekdays.includes(d) ? 'checked' : ''}>${WEEKDAYS[d]}</label>`).join('')}</div></div>
    <div class="grid2" id="schedBox">
      <div><label>Mal pro Tag</label><input name="tpd" inputmode="numeric" value="${v.timesPerDay}"></div>
      <div><label>Aktiv</label><select name="active"><option value="1" ${v.active ? 'selected' : ''}>Ja</option><option value="0" ${!v.active ? 'selected' : ''}>Pausiert</option></select></div>
      <div><label>Start</label><input name="start" type="date" value="${v.start || ''}"></div>
      <div><label>Ende (optional)</label><input name="end" type="date" value="${v.end || ''}"></div>
    </div>
    <label>Notizen</label><textarea name="notes" style="min-height:60px" placeholder="z. B. Hersteller, Charge, Zweck">${esc(v.notes)}</textarea>
    <div class="actions">
      <button class="btn primary" value="save">Speichern</button>
      <button class="btn" value="cancel" formnovalidate>Abbrechen</button>
      ${s ? `<button class="btn danger" value="delete" formnovalidate>Löschen</button>` : ''}
    </div></form>`;
  const f = dlg.querySelector('#f');
  const sync = () => { $('#ivBox').style.display = f.mode.value === 'interval' ? '' : 'none'; $('#wdBox').style.display = f.mode.value === 'weekdays' ? '' : 'none'; };
  f.mode.addEventListener('change', sync); sync();
  dlg.onclose = () => {
    if (dlg.returnValue === 'delete') {
      if (confirm(`„${s.name}“ löschen? Bisherige Einträge bleiben im Verlauf erhalten.`)) {
        db.logs.forEach(l => { if (l.subId === s.id) l.subId = null; });
        db.substances = db.substances.filter(x => x.id !== id); save(); render();
      }
      return;
    }
    if (dlg.returnValue !== 'save') return;
    const dose = num(f.dose.value);
    if (!f.name.value.trim() || dose == null) { toast('Name und Dosis angeben'); return; }
    const data = {
      name: f.name.value.trim(), category: f.category.value, form: f.form.value, color: f.color.value, dose, unit: f.unit.value,
      conc: num(f.conc.value), mode: f.mode.value, interval: Math.max(0.5, num(f.interval.value) || 1),
      weekdays: [...f.querySelectorAll('[name=wd]:checked')].map(c => Number(c.value)),
      timesPerDay: Math.max(1, Math.round(num(f.tpd.value) || 1)), active: f.active.value === '1',
      start: f.start.value || todayKey(), end: f.end.value, notes: f.notes.value.trim()
    };
    if (s) {
      Object.assign(s, data);
      db.logs.forEach(l => { if (l.subId === s.id) { l.name = s.name; l.category = s.category; } });
    } else db.substances.push({ id: uid(), ...data });
    save(); render(); toast('Gespeichert');
  };
  dlg.returnValue = ''; dlg.showModal();
}

// ---------- More: settings & backup ----------
function renderMore() {
  header('Mehr', 'Einstellungen & Backup');
  const g = db.settings;
  $('#view').innerHTML = `
    <h2>Ernährung</h2><div class="card">
      <label style="display:flex;align-items:center;gap:8px;color:var(--text);margin:0"><input type="checkbox" style="width:auto" ${g.calories ? 'checked' : ''} onchange="db.settings.calories=this.checked;save()"> Kalorien-Tracking anzeigen</label>
      <div class="grid2">
        <div><label>Ziel kcal / Tag</label><input inputmode="decimal" value="${g.kcalGoal ?? ''}" onchange="db.settings.kcalGoal=num(this.value);save()"></div>
        <div><label>Ziel Protein g / Tag</label><input inputmode="decimal" value="${g.proteinGoal ?? ''}" onchange="db.settings.proteinGoal=num(this.value);save()"></div>
      </div></div>
    <h2>Backup</h2><div class="card">
      <div class="muted">Alles liegt nur auf diesem iPhone. Lösche nicht die App vom Home-Bildschirm, ohne vorher ein Backup zu sichern (z. B. in „Dateien“ / iCloud Drive).</div>
      <div class="actions">
        <button class="btn primary" onclick="exportJson()">Backup sichern</button>
        <button class="btn" onclick="$('#importFile').click()">Backup laden</button>
        <button class="btn" onclick="exportCsv()">Einträge als CSV</button>
        <input type="file" id="importFile" accept="application/json,.json" style="display:none" onchange="importJson(this.files[0])">
      </div></div>
    <h2>Darstellung</h2><div class="card"><div class="seg">
      ${[['', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([t, n]) => `<button class="${(document.documentElement.dataset.theme || '') === t ? 'on' : ''}" onclick="setTheme('${t}')">${n}</button>`).join('')}</div></div>
    <div class="card"><div class="muted">${db.substances.length} im Plan · ${db.logs.length} Einträge · ${Object.keys(db.days).length} Tage</div>
      <div class="actions"><button class="btn danger" onclick="wipe()">Alle Daten löschen</button></div></div>`;
}

function blobToDataUrl(b) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
async function shareOrDownload(name, blob) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function exportJson() {
  toast('Backup wird erstellt …');
  const files = await allFiles();
  const out = { ...db, files: await Promise.all(files.map(async f => ({ ...fileMeta(f), text: f.text, data: await blobToDataUrl(f.blob) }))) };
  shareOrDownload(`tracker-backup-${todayKey()}.json`, new Blob([JSON.stringify(out)], { type: 'application/json' }));
}
function exportCsv() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Datum', 'Uhrzeit', 'Kategorie', 'Was', 'Menge', 'Einheit', 'Stelle', 'Notiz'].join(';')];
  for (const l of [...db.logs].sort((a, b) => a.time.localeCompare(b.time)))
    lines.push([l.time.slice(0, 10), l.time.slice(11, 16), q(CATS[l.category]), q(l.name), String(l.amount).replace('.', ','), q(l.unit), q(l.site), q(l.note)].join(';'));
  lines.push('', ['Datum', 'Stimmung', 'kcal', 'Protein', 'KH', 'Fett', 'Tagebuch'].join(';'));
  for (const k of Object.keys(db.days).sort()) {
    const d = db.days[k];
    lines.push([k, d.mood ?? '', d.kcal ?? '', d.protein ?? '', d.carbs ?? '', d.fat ?? '', q(d.note)].join(';'));
  }
  shareOrDownload(`tracker-${todayKey()}.csv`, new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' }));
}
async function importJson(file) {
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!Array.isArray(d.substances) || !Array.isArray(d.logs)) throw new Error();
    if (!confirm('Aktuelle Daten durch das Backup ersetzen?')) return;
    const { files = [], ...rest } = d;
    db = { ...emptyDb(), ...rest, settings: { ...emptyDb().settings, ...(rest.settings || {}) }, days: rest.days || {} };
    await tx('files', 'readwrite', s => s.clear());
    for (const f of files) await putFile({ ...f, data: undefined, blob: await (await fetch(f.data)).blob() });
    await save(); render(); toast('Backup geladen');
  } catch (e) { toast('Ungültige Backup-Datei'); }
}
async function wipe() {
  if (!confirm('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.')) return;
  db = emptyDb(); await tx('files', 'readwrite', s => s.clear()); await save(); render();
}
function setTheme(t) {
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  try { localStorage.setItem('tracker-theme', t); } catch (e) {}
  if (tab === 'more') renderMore();
}

// ---------- Start ----------
(async function init() {
  try { const t = localStorage.getItem('tracker-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  try {
    idb = await openIdb();
    const stored = await kvGet('db');
    if (stored) db = { ...emptyDb(), ...stored, settings: { ...emptyDb().settings, ...(stored.settings || {}) } };
    else if (migrateV1()) await save();
    else if (window.SEED) { db = { ...emptyDb(), ...window.SEED }; await save(); }
  } catch (e) {
    toast('Speicher nicht verfügbar – Daten werden nicht gesichert');
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  render();
  // Re-render when the app comes back to the foreground on a new day.
  let lastDay = todayKey();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && todayKey() !== lastDay) { if (curDay === lastDay) curDay = todayKey(); lastDay = todayKey(); render(); }
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
