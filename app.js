'use strict';

// ---------- Constants ----------
const SITES = ['Glute links', 'Glute rechts', 'Quad links', 'Quad rechts', 'Delt links', 'Delt rechts', 'Ventroglute links', 'Ventroglute rechts', 'Lat links', 'Lat rechts', 'Bauch (subkutan)', 'Sonstige'];
const ROTATION = SITES.slice(0, 10);
const UNITS = ['mg', 'mcg', 'g', 'IE', 'ml', 'Tabl.', 'Kps.', 'Stk.', 'Zug', 'Einheit'];
const FORMS = { inj: tr('Injektion'), oral: tr('Oral'), sc: tr('Subkutan'), other: tr('Sonstiges') };
const CATS = { ped: tr('Steroide / PEDs'), pep: tr('Peptide'), med: tr('Medikamente'), supp: tr('Supplements'), rec: tr('Freizeit'), other: tr('Sonstiges') };
const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308', '#6366f1', '#f97316'];
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'].map(d => tr(d));
// ---------- Reference half-lives (substances-db.js) ----------
const normName = t => String(t || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9äöüß+.-]+/g, ' ').trim();
const LEX = (window.SUBSTANCE_DB || []).map(([name, cat, h, range, aliases, note]) => ({ name, cat, h, range: trRange(range), aliases, note: note && tr(note) }));
const LEX_KEYS = new Map();
for (const e of LEX) for (const k of [e.name, ...e.aliases]) { const n = normName(k); if (n && !LEX_KEYS.has(n)) LEX_KEYS.set(n, e); }
const lexCache = new Map();
// Find the reference entry for a free-text name: exact name/alias first, then the longest alias contained in it.
function lookup(name) {
  if (lexCache.has(name)) return lexCache.get(name);
  const n = normName(name);
  let hit = LEX_KEYS.get(n) || null;
  if (!hit && n) {
    let best = 0;
    for (const [k, e] of LEX_KEYS) if (k.length >= 3 && k.length > best && (' ' + n + ' ').includes(' ' + k + ' ')) { hit = e; best = k.length; }
  }
  lexCache.set(name, hit);
  return hit;
}
// ---------- Interactions (interactions.js) ----------
const RULES = (window.INTERACTION_RULES || []).map(([sev, a, b, t]) => ({ sev, a: [].concat(a), b: [].concat(b), t: tr(t) }));
const SEV = { 3: ['⛔', tr('Gefährlich')], 2: ['⚠️', tr('Riskant')], 1: ['ℹ️', tr('Beachten')] };
const classesOf = e => (e && (window.SUBSTANCE_CLASSES || {})[e.name]) || [];
function pairIssues(n1, n2) {
  const e1 = lookup(n1), e2 = lookup(n2);
  if (!e1 || !e2 || e1 === e2) return [];
  const c1 = classesOf(e1), c2 = classesOf(e2);
  const has = (cs, list) => list.some(x => cs.includes(x));
  const hits = RULES.filter(r => (has(c1, r.a) && has(c2, r.b)) || (has(c2, r.a) && has(c1, r.b)));
  return [...new Map(hits.map(r => [r.t, r])).values()].sort((a, b) => b.sev - a.sev);
}
// Hours a dose counts as active for interaction checks.
const ixWindowH = name => { const e = lookup(name); return e ? (window.INTERACTION_WINDOW_H || {})[e.name] ?? (e.h ? e.h * 5 : 24) : 24; };
function activeNamesAt(t) {
  const last = {};
  for (const l of db.logs) { const lt = new Date(l.time).getTime(); if (lt <= t && (!last[l.name] || lt > last[l.name])) last[l.name] = lt; }
  return Object.keys(last).filter(n => (t - last[n]) / 3.6e6 < ixWindowH(n));
}
function issuesAmong(names, focus) {
  const list = [...new Set(names)], out = [], seen = new Set();
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (focus && list[i] !== focus && list[j] !== focus) continue;
    const r = pairIssues(list[i], list[j]);
    if (!r.length) continue;
    const key = 'ix:' + [lookup(list[i]).name, lookup(list[j]).name].sort().join('|');
    if (seen.has(key) || isIgnored(key)) continue;
    seen.add(key); out.push({ a: list[i], b: list[j], sev: r[0].sev, rules: r, key });
  }
  return out.sort((x, y) => y.sev - x.sev);
}
// Warnings can be hidden for one day or ignored for good (stored with the data, resettable under "Mehr").
const isIgnored = key => (db.settings.ignoredWarnings || []).includes(key);
const isHiddenOn = (key, k) => (peekDay(k).hiddenWarnings || []).includes(key);
const closeBtn = (key, k) => k ? `<button class="btn small" aria-label="${tr('Hinweis ausblenden')}" onclick="dismissWarning(${esc(JSON.stringify(key))}, '${k}')">✕</button>` : '';
function dismissWarning(key, k) {
  const dlg = $('#dlg'), label = key.slice(key.indexOf(':') + 1).split('|').join(' + ');
  dlg.onclose = null; dlg.returnValue = '';
  dlg.innerHTML = `<h3>${tr('Hinweis ausblenden')}</h3><div class="muted">${esc(label)}</div>
    <div class="actions" style="flex-direction:column;align-items:stretch">
      <button class="btn primary" id="hwDay">${tr('Nur für diesen Tag')}</button>
      <button class="btn" id="hwAll">${tr(key.startsWith('ix:') ? 'Diese Kombination immer ignorieren' : 'Diesen Hinweis immer ignorieren')}</button>
      <button class="btn" onclick="$('#dlg').close()">${tr('Abbrechen')}</button></div>
    <div class="muted" style="margin-top:8px">${tr('Zurückholen kannst du ausgeblendete Hinweise unter „Mehr“.')}</div>`;
  dlg.querySelector('#hwDay').onclick = () => { const d = getDay(k); d.hiddenWarnings = [...new Set([...(d.hiddenWarnings || []), key])]; save(); dlg.close(); render(); };
  dlg.querySelector('#hwAll').onclick = () => { db.settings.ignoredWarnings = [...new Set([...(db.settings.ignoredWarnings || []), key])]; save(); dlg.close(); render(); toast(tr('Wird nicht mehr angezeigt')); };
  dlg.showModal();
}
function resetWarnings() {
  db.settings.ignoredWarnings = [];
  for (const d of Object.values(db.days)) delete d.hiddenWarnings;
  save(); render(); toast(tr('Alle Hinweise werden wieder angezeigt'));
}

function issuesHtml(list, k) {
  return list.map(x => `<div class="ix ix${x.sev}"><div class="row"><b class="grow">${SEV[x.sev][0]} ${esc(x.a)} + ${esc(x.b)}</b><span class="muted">${SEV[x.sev][1]}</span>${closeBtn(x.key, k)}</div>
    ${x.rules.map(r => `<div class="muted" style="color:var(--text)">${esc(r.t)}</div>`).join('')}
    ${x.sev === 3 ? `<div class="muted help" style="margin-top:4px">${tr('Bei Atemproblemen, Bewusstlosigkeit oder Krampfanfall:')} <a href="tel:${EMERGENCY}">${tr('{n} anrufen', { n: EMERGENCY })}</a> · <a href="#" onclick="showHelp();return false">${tr('Hilfe')}</a></div>` : ''}</div>`).join('');
}

// ---------- Gewöhnung & Abhängigkeit (DEPENDENCE_RULES in interactions.js) ----------
const DEP_RULES = (window.DEPENDENCE_RULES || []).map(r => ({ ...r, text: tr(r.text), potential: tr(r.potential) }));
const DEP_ICON = { 3: '⛔', 2: '⚠️', 1: 'ℹ️' };
const depRuleFor = e => { const cs = classesOf(e); return DEP_RULES.find(r => cs.includes(r.cls)) || null; };
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
// Usage patterns up to day k that commonly lead to tolerance or dependence.
function dependenceAlerts(k) {
  const groups = {}; // canonical entry name -> { label, days:Set }
  for (const l of db.logs) {
    const d = l.time.slice(0, 10);
    if (d > k || daysBetween(d, k) >= 84) continue;
    const e = lookup(l.name);
    if (!e || !depRuleFor(e)) continue;
    (groups[e.name] ||= { e, label: l.name, days: new Set() }).days.add(d);
  }
  const out = [];
  for (const g of Object.values(groups)) {
    const r = depRuleFor(g.e);
    const days = [...g.days].filter(d => daysBetween(d, k) < r.window);
    const count = r.weeks ? new Set(days.map(d => Math.floor(daysBetween(d, k) / 7))).size : days.length;
    if (count < r.min) continue;
    // Mood on days with vs. without use inside the window
    const withM = [], withoutM = [], used = new Set(days);
    for (let i = 0; i < r.window; i++) {
      const d = addDays(k, -i), m = peekDay(d).mood;
      if (m != null) (used.has(d) ? withM : withoutM).push(m);
    }
    const planned = db.substances.some(s => s.active && s.mode !== 'asneeded' && lookup(s.name) === g.e);
    const key = 'dep:' + g.e.name;
    if (isIgnored(key)) continue;
    out.push({ ...g, key, r, count, level: Math.max(1, r.level - (planned ? 1 : 0)), planned, moodWith: avg(withM), moodWithout: avg(withoutM) });
  }
  return out.sort((a, b) => b.level - a.level);
}
function dependenceHtml(list, k) {
  return list.map(x => {
    const unit = x.r.weeks ? tr('in {n} der letzten {w} Wochen', { n: x.count, w: x.r.window / 7 }) : tr('an {n} der letzten {w} Tage', { n: x.count, w: x.r.window });
    const moodTrap = x.moodWith != null && x.moodWithout != null && x.moodWith - x.moodWithout >= 0.5;
    return `<div class="ix ix${x.level}"><div class="row"><b class="grow">${DEP_ICON[x.level]} ${esc(x.label)}</b><span class="muted">${unit}</span>${closeBtn(x.key, k)}</div>
      <div class="muted" style="color:var(--text)">${esc(x.r.text)}</div>
      ${moodTrap ? `<div class="muted" style="color:var(--text);margin-top:4px"><b>${tr('Stimmung')}:</b> ${tr('Ø {a} an Konsumtagen, Ø {b} an Tagen ohne.', { a: fmtNum(x.moodWith, 1), b: fmtNum(x.moodWithout, 1) })} ${tr('Das heißt nicht, dass es dir guttut – bei Gewöhnung fühlen sich die Tage ohne schlechter an (Entzug, Craving).')}</div>` : ''}
      ${x.planned ? `<div class="muted" style="margin-top:4px">${tr('Steht in deinem Plan: Bei ärztlicher Verordnung ist das erwartbar – nicht eigenständig steigern oder absetzen.')}</div>` : ''}
      ${x.level >= 2 ? `<div class="muted help" style="margin-top:4px"><a href="#" onclick="showHelp();return false">${tr('Beratung & Hilfe')}</a></div>` : ''}</div>`;
  }).join('');
}

// Duration until ~97 % is eliminated (5 half-lives).
const inBloodHours = e => e && e.h ? e.h * 5 : null;
function fmtDur(h) {
  if (h == null) return tr('unbekannt');
  if (h < 1) return tr('{n} Min.', { n: Math.max(1, Math.round(h * 60)) });
  if (h < 48) return tr('{n} Std.', { n: fmtNum(h, h < 10 ? 1 : 0) });
  if (h < 24 * 60) return tr('{n} Tage', { n: fmtNum(h / 24, h < 240 ? 1 : 0) });
  return tr('{n} Wochen', { n: fmtNum(h / 168, 0) });
}
const MOODS = [['😫', tr('Mies')], ['😣', tr('Schlecht')], ['😕', tr('Mäßig')], ['😐', tr('Okay')], ['🙂', tr('Gut')], ['😄', tr('Super')]];

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
const fmtDay = k => parseDay(k).toLocaleDateString(LOCALE, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtLong = k => parseDay(k).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = iso => iso.slice(11, 16);
const fmtDiff = d => { if (d == null) return '–'; const r = Math.round(d * 10) / 10; return r > 0 ? '▲ +' + fmtNum(r, 1) : r < 0 ? '▼ ' + fmtNum(r, 1) : '±0'; };
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : null; };
const fmtNum = (n, d = 2) => n == null ? '–' : (Math.round(n * 10 ** d) / 10 ** d).toLocaleString(LOCALE);
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

const emptyDb = () => ({ version: 2, substances: [], logs: [], days: {}, settings: { calories: true, kcalGoal: null, proteinGoal: null, activeDays: {} } });
let db = emptyDb();

let saving = Promise.resolve();
function save() {
  const snapshot = JSON.parse(JSON.stringify(db));
  saving = saving.then(() => kvSet('db', snapshot)).catch(() => toast(tr('Speichern fehlgeschlagen – bitte Backup exportieren!')));
  scheduleReminders();
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
const colorOf = l => (subById(l.subId) || db.substances.find(s => s.name === l.name) || {}).color || '#9ca3af';
const defaultActive = name => { const h = inBloodHours(lookup(name)); return h ? Math.round(h / 24) : 0; };
const activeDays = name => (db.settings.activeDays || {})[name] ?? defaultActive(name);
// Rough remaining amount in the body at time t (simple exponential decay, ignores depot absorption).
function levelAt(name, t) {
  const e = lookup(name);
  if (!e || !e.h) return null;
  let v = 0, unit = '', any = false;
  for (const l of db.logs) {
    if (l.name !== name || l.amount == null) continue;
    const dt = (t - new Date(l.time)) / 3.6e6;
    if (dt < 0) continue;
    v += l.amount * Math.pow(0.5, dt / e.h); unit = l.unit; any = true;
  }
  return any ? { v, unit, e } : null;
}
function setActiveDays(name, v) {
  const n = num(v);
  db.settings.activeDays ||= {};
  if (n == null || Math.round(n) === defaultActive(name)) delete db.settings.activeDays[name]; else db.settings.activeDays[name] = Math.max(0, Math.round(n));
  save();
}
// Substances not taken on day k but still within their after-effect window.
// Hours a dose counts as "in system": own setting (days) or ~5 half-lives from the lexicon.
function activeHours(name) {
  const own = (db.settings.activeDays || {})[name];
  return own != null ? own * 24 : inBloodHours(lookup(name)) || 0;
}
// Substances whose last dose before time `at` is still within its window, with hours remaining.
function inSystem(at) {
  const last = {};
  for (const l of db.logs) { const t = new Date(l.time).getTime(); if (t <= at && (!last[l.name] || t > last[l.name].t)) last[l.name] = { t, l }; }
  return Object.entries(last).map(([name, { t, l }]) => { const win = activeHours(name); return { name, l, d: l.time.slice(0, 10), win, left: win - (at - t) / 3.6e6 }; })
    .filter(x => x.win > 0 && x.left > 0).sort((a, b) => b.left - a.left);
}
const fmtLeft = h => h >= 36 ? tr('noch {n} Tage', { n: Math.round(h / 24) }) : h >= 20 ? tr('noch ~1 Tag') : tr('noch {n} Std.', { n: Math.max(1, Math.round(h)) });

function doseText(s, amount) {
  let t = `${fmtNum(amount)} ${tr(s.unit)}`;
  if (s.conc && s.unit === 'mg') t += ` (${fmtNum(amount / s.conc)} ml)`;
  return t;
}

function scheduleText(s) {
  const tpd = s.timesPerDay > 1 ? ', ' + tr('{n}× täglich', { n: s.timesPerDay }) : '';
  if (s.mode === 'weekdays') return (s.weekdays.length ? [1, 2, 3, 4, 5, 6, 0].filter(d => s.weekdays.includes(d)).map(d => WEEKDAYS[d]).join(', ') : tr('keine Tage')) + tpd;
  if (s.mode === 'asneeded') return tr('Nach Bedarf');
  if (s.mode === 'dates') {
    const up = (s.dates || []).filter(k => k >= todayKey());
    return up.length ? tr('Termine') + ': ' + up.slice(0, 4).map(k => parseDay(k).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' })).join(', ') + (up.length > 4 ? ' …' : '') : tr('Keine weiteren Termine');
  }
  if (s.interval === 1) return tr('Täglich') + tpd;
  if (s.interval === 7) return tr('Wöchentlich') + tpd;
  return tr('Alle {n} Tage', { n: fmtNum(s.interval) }) + tpd;
}

// Is the substance scheduled on this day? Interval may be fractional (3.5 = E3.5D).
function isDue(s, k) {
  if (!s.active || s.mode === 'asneeded') return false;
  if (s.start && k < s.start) return false;
  if (s.end && k > s.end) return false;
  if (s.mode === 'weekdays') return s.weekdays.includes(parseDay(k).getDay());
  if (s.mode === 'dates') return (s.dates || []).includes(k);
  const diff = daysBetween(s.start || k, k), iv = s.interval || 1;
  if (Number.isInteger(iv)) return diff % iv === 0;
  return Math.round(Math.round(diff / iv) * iv) === diff;
}
function nextDue(s, from) {
  for (let i = 0; i < 400; i++) { const k = addDays(from, i); if (isDue(s, k)) return k; }
  return null;
}
// A planned item counts as handled when it was logged often enough or marked as not taken.
const isSkipped = (s, d) => (peekDay(d).skipped || []).includes(s.id);
const isHandled = (s, d) => isSkipped(s, d) || logsOn(d).filter(l => l.subId === s.id).length >= (s.timesPerDay || 1);
function openItems(k, days = 7) {
  const open = [];
  for (let i = 1; i <= days; i++) { const d = addDays(k, -i); for (const s of db.substances) if (isDue(s, d) && !isHandled(s, d)) open.push({ s, d }); }
  return open;
}
function setSkipped(subId, d, on) {
  const day = getDay(d), list = new Set(day.skipped || []);
  on ? list.add(subId) : list.delete(subId);
  day.skipped = [...list];
  if (!day.skipped.length) delete day.skipped;
}
function skipDialog(subId, d) {
  const s = subById(subId), dlg = $('#dlg');
  const openOfSub = openItems(todayKey()).filter(o => o.s.id === subId);
  dlg.onclose = null; dlg.returnValue = '';
  dlg.innerHTML = `<h3>${tr('{name} nicht genommen', { name: esc(s.name) })}</h3><div class="muted">${fmtDay(d)} · ${doseText(s, s.dose)}</div>
    <div class="actions" style="flex-direction:column;align-items:stretch">
      <button class="btn primary" id="sk1">${tr('Nur an diesem Tag auslassen')}</button>
      ${openOfSub.length > 1 ? `<button class="btn" id="skAll">${tr('Alle {n} offenen Tage auslassen', { n: openOfSub.length })}</button>` : ''}
      <button class="btn" id="skStop">${tr('Ab jetzt nicht mehr nehmen (aus dem Plan)')}</button>
      <button class="btn" onclick="$('#dlg').close()">${tr('Abbrechen')}</button></div>`;
  const done = msg => { save(); dlg.close(); render(); toast(msg); };
  dlg.querySelector('#sk1').onclick = () => { setSkipped(subId, d, true); done(tr('Ausgelassen')); };
  const all = dlg.querySelector('#skAll');
  if (all) all.onclick = () => { openOfSub.forEach(o => setSkipped(subId, o.d, true)); done(tr('Ausgelassen')); };
  dlg.querySelector('#skStop').onclick = () => {
    if (!confirm(tr('„{name}“ ab heute nicht mehr einplanen? Bisherige Einträge bleiben erhalten.', { name: s.name }))) return;
    openOfSub.forEach(o => setSkipped(subId, o.d, true));
    s.end = addDays(todayKey(), -1);
    if (s.start && s.start > s.end) s.active = false;
    done(tr('Aus dem Plan genommen'));
  };
  dlg.showModal();
}
function skipAllOpen() {
  const open = openItems(todayKey());
  if (!open.length || !confirm(tr('{n} offene Einträge als „nicht genommen“ markieren?', { n: open.length }))) return;
  open.forEach(o => setSkipped(o.s.id, o.d, true));
  save(); render(); toast(tr('Ausgeblendet'));
}

function weeklyDose(s) {
  const t = s.timesPerDay || 1;
  if (s.mode === 'asneeded' || s.mode === 'dates') return null;
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
let tab = 'day', curDay = todayKey(), calMonth = todayKey().slice(0, 7), trendRange = 'month', moodPick = null, withAfter = true;
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
  ({ day: renderDay, history: renderHistory, trends: renderTrends, plan: renderPlan, more: renderMore, lexikon: renderLexikon })[tab]();
}

let noteTimer;

// ---------- Day view ----------
async function renderDay() {
  const k = curDay, isToday = k === todayKey();
  header(isToday ? tr('Heute') : fmtDay(k), isToday ? fmtLong(k) : (k > todayKey() ? tr('Zukunft') : tr('vor {n} Tagen', { n: daysBetween(k, todayKey()) })),
    `<button class="btn icon" onclick="openDay(addDays(curDay,-1))" aria-label="${tr('Vorheriger Tag')}">‹</button>
     ${isToday ? '' : `<button class="btn small" onclick="openDay(todayKey())">${tr('Heute')}</button>`}
     <button class="btn icon" onclick="openDay(addDays(curDay,1))" aria-label="${tr('Nächster Tag')}">›</button>`);
  const day = peekDay(k), logs = logsOn(k);
  const due = db.substances.filter(s => isDue(s, k));
  let html = '';

  if (isToday && backupDue()) html += `<div class="ix ix1" style="margin-top:12px"><div class="row"><b class="grow">💾 ${tr('Backup fällig')}</b>
      <button class="btn small" aria-label="${tr('Später')}" onclick="prefSet('st-backup-snooze', Date.now() + 3 * 864e5);renderDay()">✕</button></div>
    <div class="muted" style="color:var(--text)">${tr('Seit über einer Woche kein Backup. Alternativ reicht auch der Listen-Export.')}</div>
    <div class="actions" style="margin-top:8px"><button class="btn primary small" onclick="exportJson()">${tr('Jetzt sichern')}</button></div></div>`;

  // Mood
  html += `<h2>${tr('Wie fühlst du dich?')}</h2><div class="moods">` + MOODS.map(([e, t], i) =>
    `<button class="mood ${day.mood === i ? 'sel' : ''}" onclick="setMood(${i})" aria-label="${i} – ${t}"><span>${e}</span>${i}</button>`).join('') + `</div>`;

  // Interactions among what is taken, planned or still active on this day
  const dayEnd = isToday ? Date.now() : parseDay(k).getTime() + 86399000;
  const ix = issuesAmong([...logs.map(l => l.name), ...activeNamesAt(dayEnd), ...due.map(s => s.name)]);
  const ixShown = ix.filter(x => !isHiddenOn(x.key, k));
  if (ixShown.length) html += `<h2>${tr('Wechselwirkungen')} <span class="muted">${ixShown.length}</span></h2>${issuesHtml(ixShown, k)}`;
  const dep = dependenceAlerts(k);
  const depShown = dep.filter(x => !isHiddenOn(x.key, k));
  if (depShown.length) html += `<h2>${tr('Gewöhnung & Abhängigkeit')}</h2>${dependenceHtml(depShown, k)}`;

  // Journal
  html += `<h2>${tr('Journal')}</h2><textarea id="note" data-day="${k}" placeholder="${tr('Wie war dein Tag? Training, Schlaf, Gedanken, Nebenwirkungen …')}" oninput="noteChanged(this.value)">${esc(day.note || '')}</textarea>`;

  // Plan
  if (due.length) {
    html += `<h2>${tr('Plan')}</h2><div class="card">`;
    for (const s of due) {
      const done = logs.filter(l => l.subId === s.id).length, need = s.timesPerDay || 1, skipped = isSkipped(s, k);
      html += `<div class="entry row" style="${skipped ? 'opacity:.55' : ''}"><div class="dot" style="background:${esc(s.color)}"></div>
        <div class="grow"><div class="name">${esc(s.name)}</div><div class="muted">${doseText(s, s.dose)} · ${FORMS[s.form]}</div></div>
        ${skipped ? `<span class="muted">${tr('ausgelassen')}</span><button class="btn small" aria-label="${tr('Rückgängig')}" onclick="setSkipped('${s.id}','${k}',false);save();renderDay()">↺</button>`
          : done >= need ? `<span class="done">✓${need > 1 ? ` ${done}/${need}` : ' ' + tr('erledigt')}</span>`
          : `<button class="btn primary small" onclick="quickLog('${s.id}')">${need > 1 ? `${done}/${need} · ` : ''}${tr('Erledigt')}</button><button class="btn small" aria-label="${tr('Nicht genommen')}" onclick="skipDialog('${s.id}','${k}')">✕</button>`}</div>`;
    }
    html += `</div>`;
  } else if (!db.substances.length) {
    html += `<div class="card empty" style="margin-top:12px">${tr('Noch kein Plan angelegt.')}<br><br><button class="btn primary" onclick="tab='plan';render()">${tr('Zum Plan')}</button></div>`;
  }

  // Still in the system
  const at = isToday ? Date.now() : parseDay(k).getTime() + 86399000;
  const sys = inSystem(at).filter(x => !logs.some(l => l.name === x.name) && !due.some(s => s.name === x.name));
  if (sys.length) html += `<h2>${tr('Im System')} <span class="muted">${tr('wirkt noch nach')}</span></h2><div class="card">` + sys.map(x => {
    const lv = levelAt(x.name, at);
    return `<div class="entry" onclick="showLevel(${esc(JSON.stringify(x.name))})" style="cursor:pointer"><div class="row"><div class="dot" style="background:${esc(colorOf(x.l))}"></div><div class="grow name">${esc(x.name)}</div>
      <span class="muted">${fmtLeft(x.left)} ›</span></div>
      <div class="muted" style="margin-left:22px">${tr('zuletzt')} ${fmtDay(x.d)}${x.l.amount != null ? ' · ' + fmtNum(x.l.amount) + ' ' + esc(tr(x.l.unit)) : ''}${lv ? ` · ≈ ${fmtNum(lv.v, lv.v < 10 ? 1 : 0)} ${esc(tr(lv.unit))} ${tr('im Körper')}` : ''}</div>
      <div class="bar-bg" style="margin-left:22px"><i style="width:${Math.round(x.left / x.win * 100)}%;background:${esc(colorOf(x.l))}"></i></div></div>`;
  }).join('') + `</div>`;

  // Planned but not ticked off in the last 7 days
  if (isToday) {
    const open = openItems(k);
    if (open.length) html += `<h2><span class="grow">${tr('Offen')} <span class="muted">${tr('letzte 7 Tage')}</span></span><button class="btn small" onclick="skipAllOpen()">${tr('Alle ausblenden')}</button></h2><div class="card">` + open.map(({ s, d }) =>
      `<div class="entry row"><div class="dot" style="background:${esc(s.color)}"></div><div class="grow"><div class="name">${esc(s.name)}</div><div class="muted">${fmtDay(d)} · ${doseText(s, s.dose)}</div></div>
        <button class="btn small" onclick="curDay='${d}';quickLog('${s.id}');curDay=todayKey();renderDay()">${tr('Erledigt')}</button>
        <button class="btn small" aria-label="${tr('Nicht genommen')}" onclick="skipDialog('${s.id}','${d}')">✕</button></div>`).join('') + `</div>`;
  }

  // Logged
  html += `<h2>${tr('Eingetragen')} <span class="muted">${logs.length || ''}</span></h2>`;
  html += logs.length ? `<div class="card">${logs.map(logRow).join('')}</div>` : '';
  const quick = db.substances.filter((s, i, all) => s.active && !due.some(d => d.name === s.name) && all.findIndex(x => x.active && x.name === s.name) === i);
  html += `<div class="chips">${quick.map(s => `<button class="chip" onclick="editLog(null,'${s.id}')"><i class="dot" style="background:${esc(s.color)}"></i>${esc(s.name)}</button>`).join('')}
    <button class="chip" onclick="editLog()">＋ ${tr('Anderes eintragen')}</button></div>`;

  // Calories
  if (db.settings.calories) {
    const g = db.settings;
    html += `<h2>${tr('Ernährung')}</h2><div class="card"><div class="grid4">
      ${[['kcal', 'kcal'], ['protein', tr('Protein g')], ['carbs', tr('KH g')], ['fat', tr('Fett g')]].map(([f, t]) =>
        `<div><label>${t}</label><input inputmode="decimal" value="${day[f] ?? ''}" oninput="setDayField('${f}', this.value)"></div>`).join('')}</div>
      ${g.kcalGoal ? `<div class="muted" style="margin-top:10px">${fmtNum(day.kcal || 0, 0)} / ${fmtNum(g.kcalGoal, 0)} kcal</div><div class="bar-bg" id="kcalBar"><i style="width:${Math.min(100, (day.kcal || 0) / g.kcalGoal * 100)}%"></i></div>` : ''}
      ${g.proteinGoal ? `<div class="muted" style="margin-top:8px">${fmtNum(day.protein || 0, 0)} / ${fmtNum(g.proteinGoal, 0)} ${tr('g Protein')}</div><div class="bar-bg" id="protBar"><i style="width:${Math.min(100, (day.protein || 0) / g.proteinGoal * 100)}%"></i></div>` : ''}
    </div>`;
  }


  // Documents
  html += `<h2>${tr('Dokumente')} <span class="muted">${tr('PDF oder Foto, z. B. Blutbild')}</span></h2><div id="files"></div>
    <div class="actions" style="margin-top:0"><button class="btn" onclick="$('#fileIn').click()">＋ ${tr('Dokument hinzufügen')}</button></div>
    <input type="file" id="fileIn" accept="application/pdf,image/*" multiple style="display:none" onchange="addFiles(this.files)">`;

  // Upcoming
  if (isToday) {
    const upcoming = db.substances.filter(s => s.active && s.mode !== 'asneeded')
      .map(s => ({ s, n: nextDue(s, addDays(k, 1)) })).filter(x => x.n).sort((a, b) => a.n.localeCompare(b.n)).slice(0, 8);
    if (upcoming.length) html += `<h2>${tr('Als Nächstes')}</h2><div class="card">` + upcoming.map(({ s, n }) =>
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
    <div class="grow"><div class="name">${esc(f.name)}</div><div class="muted">${fmtNum(f.size / 1024, 0)} KB${f.text ? ' · ' + tr('Text erkannt') : ''}</div></div>
    <button class="btn small" onclick="viewFile('${f.id}')">${tr('Öffnen')}</button></div>`).join('')}</div>` : '';
}

function logRow(l) {
  return `<div class="entry row">
    <div class="dot" style="background:${esc(colorOf(l))}"></div>
    <div class="grow"><div class="name">${esc(l.name)} <span class="muted">${l.amount != null ? fmtNum(l.amount) + ' ' + esc(tr(l.unit)) : ''}</span></div>
      <div class="muted">${fmtTime(l.time)} · ${CATS[l.category] || ''}${l.site ? ' · ' + esc(tr(l.site)) : ''}${l.note ? ' · ' + esc(l.note) : ''}</div></div>
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
  if (g.proteinGoal) bar('#protBar', day.protein, g.proteinGoal, tr('g Protein'));
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
  const worst = issuesAmong([s.name, ...activeNamesAt(Date.now()), ...logsOn(curDay).map(l => l.name)], s.name)[0];
  toast(worst && worst.sev >= 2 ? `${SEV[worst.sev][0]} ${SEV[worst.sev][1]}: ${s.name} + ${worst.a === s.name ? worst.b : worst.a}`
    : tr('{name} eingetragen', { name: s.name }) + (site && s.form === 'inj' ? ' – ' + tr('Stelle') + ': ' + tr(site) : ''));
}

function editLog(id, presetSub, preset) {
  const l = id ? db.logs.find(x => x.id === id) : null;
  const s0 = l ? subById(l.subId) : subById(presetSub);
  const free = l ? !s0 : !presetSub;
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog" id="f">
    <h3>${tr(l ? 'Eintrag bearbeiten' : 'Neuer Eintrag')}</h3>
    <label>${tr('Was?')}</label>
    <select name="subId"><option value="">— ${tr('Frei eingeben')} —</option>
      ${Object.entries(CATS).map(([c, t]) => { const list = db.substances.filter(s => s.category === c); return list.length ? `<optgroup label="${t}">${list.map(s => `<option value="${s.id}" ${s0 && s.id === s0.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>` : ''; }).join('')}
    </select>
    <div id="freeBox">
      <label>${tr('Name')}</label><input name="name" list="pastNames" autocomplete="off" value="${esc(l && free ? l.name : preset ? preset.name : '')}" placeholder="${tr('z. B. Ibuprofen, Alkohol, …')}">
      <div class="muted" id="lexHint" style="margin-top:4px"></div>
      <datalist id="pastNames">${[...new Set([...db.logs.filter(x => !x.subId).map(x => x.name).sort(), ...LEX.map(e => e.name)])].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <label>${tr('Kategorie')}</label><select name="category">${Object.entries(CATS).map(([c, t]) => `<option value="${c}" ${(l ? l.category : preset ? preset.category : 'rec') === c ? 'selected' : ''}>${t}</option>`).join('')}</select>
    </div>
    <div id="ixBox" style="margin-top:10px"></div>
    <div class="grid2">
      <div><label>${tr('Menge (optional)')}</label><input name="amount" inputmode="decimal" value="${l ? l.amount ?? '' : s0 ? s0.dose : ''}"></div>
      <div><label>${tr('Einheit')}</label><select name="unit">${UNITS.map(u => `<option value="${u}" ${(l ? l.unit : s0 ? s0.unit : 'mg') === u ? 'selected' : ''}>${tr(u)}</option>`).join('')}</select></div>
    </div>
    <label>${tr('Zeitpunkt')}</label><input name="time" type="datetime-local" value="${l ? l.time : nowOn(curDay)}">
    <label>${tr('Injektionsstelle')}</label>
    <select name="site"><option value="">–</option>${SITES.map(x => `<option value="${x}" ${l && l.site === x ? 'selected' : ''}>${tr(x)}</option>`).join('')}</select>
    <div class="muted" style="margin-top:4px">${tr('Am längsten nicht benutzt')}: ${esc(tr(suggestSite()))}</div>
    <label>${tr('Notiz')}</label><input name="note" value="${esc(l ? l.note : '')}" placeholder="${tr('z. B. PIP, Charge, Wirkung')}">
    <div class="actions">
      <button class="btn primary" value="save">${tr('Speichern')}</button>
      <button class="btn" value="cancel" formnovalidate>${tr('Abbrechen')}</button>
      ${l ? `<button class="btn danger" value="delete" formnovalidate>${tr('Löschen')}</button>` : ''}
    </div></form>`;
  const f = dlg.querySelector('#f');
  const sync = first => {
    const s = subById(f.subId.value);
    $('#freeBox').style.display = s ? 'none' : '';
    if (!first && s) { f.amount.value = s.dose; f.unit.value = s.unit; f.site.value = defaultSite(s); }
  };
  f.subId.addEventListener('change', () => sync(false)); sync(true);
  // Picking a name used before fills in its last category and unit; known substances show their half-life.
  const hint = () => { const e = lookup(f.name.value); $('#lexHint').textContent = e ? `${e.name}: ${tr('Halbwertszeit')} ${e.range} · ${tr('im Blut ca.')} ${fmtDur(inBloodHours(e))}` : ''; };
  f.name.addEventListener('input', hint); hint();
  const ixCheck = () => {
    const s = subById(f.subId.value), name = s ? s.name : f.name.value.trim(), t = new Date(f.time.value).getTime();
    if (!name || !isFinite(t)) { $('#ixBox').innerHTML = ''; return; }
    const d = f.time.value.slice(0, 10);
    const others = [...activeNamesAt(t), ...logsOn(d).map(x => x.name), ...db.substances.filter(x => isDue(x, d)).map(x => x.name)].filter(n => n !== name);
    $('#ixBox').innerHTML = issuesHtml(issuesAmong([name, ...others], name));
  };
  ['change', 'input'].forEach(ev => { f.name.addEventListener(ev, ixCheck); f.subId.addEventListener(ev, ixCheck); f.time.addEventListener(ev, ixCheck); });
  ixCheck();
  f.name.addEventListener('change', () => {
    const prev = [...db.logs].reverse().find(x => x.name.toLowerCase() === f.name.value.trim().toLowerCase());
    if (prev && !l) { f.category.value = prev.category; f.unit.value = prev.unit || f.unit.value; if (prev.amount != null && !f.amount.value) f.amount.value = prev.amount; }
    else if (!l) { const e = lookup(f.name.value); if (e) f.category.value = e.cat; }
  });
  if (!l && s0) f.site.value = defaultSite(s0);
  dlg.onclose = () => {
    if (dlg.returnValue === 'delete') {
      if (confirm(tr('Eintrag löschen?'))) { db.logs = db.logs.filter(x => x.id !== id); save(); render(); }
      return;
    }
    if (dlg.returnValue !== 'save') return;
    const s = subById(f.subId.value), amount = num(f.amount.value);
    const name = s ? s.name : f.name.value.trim();
    if (!name || !f.time.value) { toast(tr('Name und Zeitpunkt angeben')); return; }
    const data = { subId: s ? s.id : null, name, category: s ? s.category : f.category.value, unit: f.unit.value, amount, time: f.time.value, site: f.site.value, note: f.note.value.trim() };
    if (l) Object.assign(l, data); else db.logs.push({ id: uid(), ...data });
    save(); render(); toast(tr('Gespeichert'));
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
  return pages.join('\n\n— ' + tr('Seite') + ' —\n\n').trim();
}
async function addFiles(list) {
  const k = curDay;
  for (const file of list) {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const f = { id: uid(), day: k, name: file.name, type: file.type, size: file.size, added: new Date().toISOString(), blob, text: '' };
    if (file.type === 'application/pdf') {
      toast(tr('Lese PDF aus …'));
      try { f.text = await extractPdfText(blob); } catch (e) { toast(tr('Text konnte nicht gelesen werden')); }
    }
    await putFile(f);
  }
  toast(tr('Dokument gespeichert'));
  if (tab === 'day') renderFiles(k);
}
async function viewFile(id) {
  const f = await getFile(id);
  if (!f) return;
  const dlg = $('#dlg');
  dlg.onclose = null; dlg.returnValue = '';
  const isPdf = f.type === 'application/pdf';
  dlg.innerHTML = `<h3>${esc(f.name)}</h3><div class="muted">${fmtDay(f.day)}</div>
    ${isPdf ? `<div class="seg" style="margin:12px 0"><button class="on" id="vt">${tr('Text')}</button><button id="vp">${tr('Seiten')}</button></div>
      <div id="vbody"><div class="pdftext">${f.text ? esc(f.text) : tr('Kein Text gefunden – vermutlich ein gescanntes Dokument. Unter „Seiten“ kannst du es ansehen.')}</div></div>`
      : `<div class="pages" style="margin-top:12px"><img src="${URL.createObjectURL(f.blob)}" alt=""></div>`}
    <div class="actions">
      <button class="btn primary" id="vclose">${tr('Schließen')}</button>
      ${isPdf && f.text ? `<button class="btn" id="vcopy">${tr('Text kopieren')}</button>` : ''}
      <button class="btn danger" id="vdel">${tr('Löschen')}</button>
    </div>`;
  dlg.querySelector('#vclose').onclick = () => dlg.close();
  dlg.querySelector('#vdel').onclick = async () => {
    if (!confirm(tr('Dokument löschen?'))) return;
    await delFile(id); dlg.close(); render();
  };
  if (isPdf) {
    const showText = () => { $('#vt').classList.add('on'); $('#vp').classList.remove('on'); $('#vbody').innerHTML = `<div class="pdftext">${f.text ? esc(f.text) : tr('Kein Text gefunden.')}</div>`; };
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
    if (cp) cp.onclick = () => navigator.clipboard.writeText(f.text).then(() => toast(tr('Kopiert')), () => toast(tr('Kopieren nicht möglich')));
  }
  dlg.showModal();
}

// ---------- History (calendar + search) ----------
// ---------- List view (notes format) ----------
let histMode = prefGetSafe('st-hist-mode', 'cal');
let listOpt = prefGetSafe('st-list-opt', { range: 30, plan: true, mood: true, notes: true, newest: false });
function prefGetSafe(k, d) { try { const v = localStorage.getItem(k); if (v == null) return d; const p = JSON.parse(v); return d && typeof d === 'object' ? { ...d, ...p } : p; } catch (e) { return d; } }
function prefSetSafe(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'].map(m => tr(m));
// One line per day, e.g. "18.11 = Testosteron Enanthat 60 mg + Tamoxifen 10 mg | Rec: Weed | Mood: 🙂 4 | Note: …"
function listText(o = listOpt) {
  const today = todayKey();
  const logDays = db.logs.map(l => l.time.slice(0, 10));
  const first = o.range ? addDays(today, -(o.range - 1)) : (logDays.concat(Object.keys(db.days)).sort()[0] || today);
  const last = o.plan ? addDays(today, 14) : today;
  const lines = [];
  let month = '';
  const days = [];
  for (let k = first; k <= last; k = addDays(k, 1)) days.push(k);
  if (o.newest) days.reverse();
  for (const k of days) {
    const logs = logsOn(k), day = peekDay(k), future = k > today;
    const agg = {};
    for (const l of logs) {
      const key = l.name + '|' + (l.amount != null ? l.unit : '');
      const a = (agg[key] ||= { name: l.name, unit: l.unit, sum: 0, n: 0, amt: false, rec: l.category === 'rec' });
      a.n++; if (l.amount != null) { a.sum += l.amount; a.amt = true; }
    }
    const fmt = a => `${a.name}${a.amt ? ' ' + fmtNum(a.sum) + ' ' + tr(a.unit) : ''}${!a.amt && a.n > 1 ? ` (${a.n}×)` : ''}`;
    const main = Object.values(agg).filter(a => !a.rec).map(fmt), rec = Object.values(agg).filter(a => a.rec).map(fmt);
    const planned = db.substances.filter(s => isDue(s, k) && !isHandled(s, k)).map(s => `${s.name} ${fmtNum(s.dose)} ${tr(s.unit)}`);
    const skipped = db.substances.filter(s => isDue(s, k) && isSkipped(s, k)).map(s => s.name);
    const parts = [];
    if (main.length) parts.push(main.join(' + '));
    if (o.plan && planned.length) parts.push((future ? '' : tr('offen') + ': ') + planned.join(' + ') + (future ? ' (' + tr('geplant') + ')' : ''));
    if (!parts.length) parts.push('–');
    if (rec.length) parts.push('Rec: ' + rec.join(' + '));
    if (skipped.length) parts.push(tr('ausgelassen') + ': ' + skipped.join(', '));
    if (o.mood && day.mood != null) parts.push(`${tr('Mood')}: ${MOODS[day.mood][0]} ${day.mood}`);
    if (o.notes && day.note) parts.push(tr('Note') + ': ' + day.note.trim().replace(/\s*\n\s*/g, ' / '));
    const hasContent = logs.length || (o.plan && planned.length) || skipped.length || (o.mood && day.mood != null) || (o.notes && day.note);
    if (!hasContent) continue;
    const d = parseDay(k), mLabel = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (mLabel !== month) { if (lines.length) lines.push(''); lines.push(mLabel); month = mLabel; }
    lines.push(`${pad(d.getDate())}.${pad(d.getMonth() + 1)} = ${parts.join(' | ')}`);
  }
  return lines.join('\n');
}
function setListOpt(k, v) { listOpt = { ...listOpt, [k]: v }; prefSetSafe('st-list-opt', listOpt); renderHistory(); }
function setHistMode(m) { histMode = m; prefSetSafe('st-hist-mode', m); renderHistory(); }
async function copyList() {
  const t = listText();
  try { await navigator.clipboard.writeText(t); toast(tr('Liste kopiert – jetzt in Notizen einfügen')); }
  catch (e) { shareOrDownload(`substances-${todayKey()}.txt`, new Blob([t], { type: 'text/plain' })); }
}
function renderList() {
  header(tr('Verlauf'), tr('Liste – wie in deinen Notizen'), '');
  const o = listOpt, chk = (k, label) => `<label style="display:flex;align-items:center;gap:6px;color:var(--text);margin:0"><input type="checkbox" style="width:auto" ${o[k] ? 'checked' : ''} onchange="setListOpt('${k}', this.checked)">${label}</label>`;
  $('#view').innerHTML = `<div class="seg" style="margin-bottom:10px"><button onclick="setHistMode('cal')">${tr('Kalender')}</button><button class="on">${tr('Liste')}</button></div>
    <div class="seg">${[[7, tr('{n} Tage', { n: 7 })], [30, tr('{n} Tage', { n: 30 })], [90, tr('{n} Tage', { n: 90 })], [0, tr('Alles')]].map(([r, t]) => `<button class="${o.range === r ? 'on' : ''}" onclick="setListOpt('range', ${r})">${t}</button>`).join('')}</div>
    <div class="chips" style="margin:10px 0">${chk('plan', tr('Plan & offene'))}${chk('mood', tr('Stimmung'))}${chk('notes', tr('Journal'))}${chk('newest', tr('Neueste oben'))}</div>
    <div class="actions" style="margin-top:0"><button class="btn primary" onclick="copyList()">${tr('Kopieren')}</button><button class="btn" onclick="shareOrDownload('substances-${todayKey()}.txt', new Blob([listText()], {type:'text/plain'}))">${tr('Teilen / Sichern')}</button></div>
    <div class="pdftext" style="margin-top:10px;max-height:none;font-family:ui-monospace,Menlo,monospace;font-size:12.5px">${esc(listText()) || tr('Noch keine Einträge.')}</div>`;
}

async function renderHistory() {
  if (histMode === 'list') return renderList();
  const [y, m] = calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const monthName = first.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
  const shift = n => { const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  header(tr('Verlauf'), monthName,
    `<button class="btn icon" onclick="calMonth='${shift(-1)}';renderHistory()" aria-label="${tr('Vorheriger Monat')}">‹</button>
     <button class="btn icon" onclick="calMonth='${shift(1)}';renderHistory()" aria-label="${tr('Nächster Monat')}">›</button>`);

  const files = await allFiles();
  const fileDays = new Set(files.map(f => f.day));
  const lead = (first.getDay() + 6) % 7, nDays = new Date(y, m, 0).getDate(), today = todayKey();
  let cal = `<div class="cal">${[1, 2, 3, 4, 5, 6, 0].map(d => `<div class="h">${WEEKDAYS[d]}</div>`).join('')}`;
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
  for (const l of monthLogs) { const key = l.name + '|' + l.unit; (totals[key] ||= { name: l.name, unit: l.unit, sum: 0, n: 0, color: colorOf(l) }); totals[key].sum += l.amount || 0; totals[key].n++; }
  const moods = Object.entries(db.days).filter(([k, d]) => k.startsWith(calMonth) && d.mood != null).map(([, d]) => d.mood);

  let html = `<div class="seg" style="margin-bottom:10px"><button class="on">${tr('Kalender')}</button><button onclick="setHistMode('list')">${tr('Liste')}</button></div><div class="card">${cal}</div>`;
  html += `<h2>${tr('Diesen Monat')}</h2><div class="card">
    <div class="muted">${moods.length ? tr('Stimmung Ø {a} an {n} Tagen', { a: fmtNum(moods.reduce((a, b) => a + b, 0) / moods.length, 1), n: moods.length }) : tr('Keine Stimmung erfasst')}</div>
    ${Object.keys(totals).length ? `<table style="margin-top:8px"><tr><th>${tr('Was')}</th><th class="num">${tr('Anzahl')}</th><th class="num">${tr('Gesamt')}</th></tr>
      ${Object.values(totals).sort((a, b) => a.name.localeCompare(b.name)).map(t => `<tr><td><span class="row" style="gap:6px"><i class="dot" style="background:${esc(t.color)}"></i>${esc(t.name)}</span></td><td class="num">${t.n}×</td><td class="num">${t.sum ? fmtNum(t.sum) + ' ' + esc(tr(t.unit)) : '–'}</td></tr>`).join('')}</table>` : ''}
  </div>`;

  const notes = Object.keys(db.days).filter(k => k.startsWith(calMonth) && db.days[k].note).sort().reverse();
  if (notes.length) html += `<h2>${tr('Journal')} <span class="muted">${tr('{n} Einträge', { n: notes.length })}</span></h2><div class="card">` + notes.map(k => {
    const d = db.days[k];
    return `<div class="entry" onclick="openDay('${k}')" style="cursor:pointer"><div class="row"><span class="name grow">${fmtDay(k)}</span><span>${d.mood != null ? MOODS[d.mood][0] : ''}</span></div>
      <div class="muted" style="white-space:pre-wrap">${esc(d.note.length > 220 ? d.note.slice(0, 220) + ' …' : d.note)}</div></div>`;
  }).join('') + `</div>`;
  html += `<h2>${tr('Suchen')}</h2><input id="q" type="search" placeholder="${tr('Journal, Einträge, PDF-Texte durchsuchen')}" value="${esc(renderHistory.q || '')}" oninput="renderHistory.q=this.value;runSearch()"><div id="results" style="margin-top:10px"></div>`;
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
  for (const [k, d] of Object.entries(db.days)) if (d.note && d.note.toLowerCase().includes(q)) hits.push({ k, what: tr('Journal'), text: snippet(d.note) });
  for (const l of db.logs) { const t = `${l.name} ${l.note || ''} ${l.site || ''}`; if (t.toLowerCase().includes(q)) hits.push({ k: l.time.slice(0, 10), what: l.name, text: snippet(t) }); }
  for (const f of files) { const t = `${f.name}\n${f.text || ''}`; if (t.toLowerCase().includes(q)) hits.push({ k: f.day, what: '📄 ' + f.name, text: snippet(t) }); }
  hits.sort((a, b) => b.k.localeCompare(a.k));
  box.innerHTML = hits.length ? `<div class="card">${hits.slice(0, 100).map(h => `<div class="entry" onclick="openDay('${h.k}')" style="cursor:pointer">
    <div class="row"><span class="name grow">${esc(h.what)}</span><span class="muted">${fmtDay(h.k)}</span></div><div class="muted">${h.text}</div></div>`).join('')}</div>`
    : `<div class="card empty">${tr('Nichts gefunden.')}</div>`;
}

// ---------- Trends ----------
function renderTrends() {
  header(tr('Trends'), tr('Stimmung im Zeitverlauf'));
  const ranges = [['week', tr('Woche')], ['month', tr('Monat')], ['quarter', tr('3 Mon.')], ['year', tr('Jahr')], ['all', tr('Alles')]];
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
      <div><div class="muted">${tr('Ø Stimmung')}</div><div class="v">${avg != null ? fmtNum(avg, 1) + ' ' + MOODS[Math.round(avg)][0] : '–'}</div></div>
      <div><div class="muted">${tr('Erfasste Tage')}</div><div class="v">${inRange.length}</div></div>
      <div><div class="muted">${tr('vs. davor')}</div><div class="v">${fmtDiff(diff)}</div></div>
    </div>
    <div class="card"><div class="muted" style="margin-bottom:6px">${tr(bucket === 1 ? 'Tageswerte' : bucket === 7 ? 'Wochendurchschnitt' : 'Monatsdurchschnitt')} · ${tr('0 = mies, 5 = super')}</div>
      <div class="chart" id="moodChart"></div></div>`;

  const hasKcal = db.settings.calories && Object.entries(db.days).some(([k, d]) => k >= from && d.kcal != null);
  if (hasKcal) {
    html += `<h2>${tr('Kalorien')}</h2><div class="card"><div class="muted" style="margin-bottom:6px">${tr(bucket === 1 ? 'Tageswerte' : 'Durchschnitt pro Tag')}</div><div class="chart" id="kcalChart"></div></div>`;
  }
  html += moodSubstances(inRange);
  if (!moodDays.length) html += `<div class="notice">${tr('Tippe auf „Tag“ jeden Tag einen Smiley an – hier entsteht dann deine Kurve.')}</div>`;
  $('#view').innerHTML = html;

  lineChart($('#moodChart'), pts, { min: 0, max: 5, ticks: [0, 1, 2, 3, 4, 5], fmt: v => fmtNum(v, 1) + ' ' + MOODS[Math.round(v)][0], label: v => v });
  if (hasKcal) {
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

// Which substances were taken on days with a given mood, and mood with vs. without each substance.
function moodSubstances(days) {
  const taken = {}; // name -> Set of mood days it was taken (or still active)
  const daySet = new Set(days);
  for (const l of db.logs) {
    const k0 = l.time.slice(0, 10), span = withAfter ? activeDays(l.name) : 0;
    for (let i = 0; i <= span; i++) {
      const k = addDays(k0, i);
      if (daySet.has(k)) (taken[l.name] ||= { color: colorOf(l), days: new Set() }).days.add(k);
    }
  }
  const names = Object.keys(taken);
  let html = `<h2>${tr('Stimmung & Substanzen')}</h2><div class="card">
    <label style="display:flex;align-items:center;gap:8px;color:var(--text);margin:0 0 10px"><input type="checkbox" style="width:auto" ${withAfter ? 'checked' : ''} onchange="withAfter=this.checked;renderTrends()"> ${tr('Nachwirkung mitzählen (Tage im System)')}</label>
    <div class="muted" style="margin-bottom:8px">${tr('Tippe einen Smiley an: Was war an diesen Tagen im System?')}</div>
    <div class="moods">${MOODS.map(([e], i) => { const n = days.filter(k => db.days[k].mood === i).length;
      return `<button class="mood ${moodPick === i ? 'sel' : ''}" onclick="moodPick=moodPick===${i}?null:${i};renderTrends()"><span>${e}</span>${tr('{n} T.', { n })}</button>`; }).join('')}</div>`;
  if (moodPick != null) {
    const sel = days.filter(k => db.days[k].mood === moodPick);
    const rows = names.map(n => ({ n, c: taken[n].color, hit: sel.filter(k => taken[n].days.has(k)).length })).filter(r => r.hit).sort((a, b) => b.hit - a.hit);
    html += `<div style="margin-top:12px"><b>${MOODS[moodPick][0]} ${moodPick} – ${MOODS[moodPick][1]}</b> <span class="muted">${tr('an {n} Tagen', { n: sel.length })}</span></div>`;
    html += !sel.length ? `<div class="muted">${tr('Keine Tage mit diesem Smiley im Zeitraum.')}</div>`
      : rows.length ? `<table style="margin-top:6px">${rows.map(r => `<tr><td><span class="row" style="gap:6px"><i class="dot" style="background:${esc(r.c)}"></i>${esc(r.n)}</span></td><td class="num">${tr('{a} von {b}', { a: r.hit, b: sel.length })}</td><td class="num muted">${Math.round(r.hit / sel.length * 100)} %</td></tr>`).join('')}</table>`
      : `<div class="muted">${tr('An diesen Tagen nichts eingetragen.')}</div>`;
    html += sel.length ? `<div class="chips" style="margin-top:10px">${sel.slice(-14).reverse().map(k => `<button class="chip" onclick="openDay('${k}')">${parseDay(k).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' })}</button>`).join('')}</div>` : '';
  }
  // Average mood with vs. without each substance
  const avgOf = ks => ks.length ? ks.reduce((a, k) => a + db.days[k].mood, 0) / ks.length : null;
  const cmp = names.map(n => { const w = days.filter(k => taken[n].days.has(k)), wo = days.filter(k => !taken[n].days.has(k)); return { n, c: taken[n].color, w: avgOf(w), wo: avgOf(wo), nw: w.length }; })
    .sort((a, b) => ((b.w ?? 0) - (b.wo ?? 0)) - ((a.w ?? 0) - (a.wo ?? 0)));
  if (cmp.length) {
    html += `<div style="margin-top:16px"><b>${tr('Ø Stimmung mit / ohne')}</b></div>
      <table style="margin-top:6px"><tr><th>${tr('Substanz')}</th><th class="num">${tr('mit')}</th><th class="num">${tr('ohne')}</th><th class="num">${tr('Diff.')}</th></tr>
      ${cmp.map(r => { const d = r.w != null && r.wo != null ? r.w - r.wo : null;
        return `<tr><td><span class="row" style="gap:6px"><i class="dot" style="background:${esc(r.c)}"></i>${esc(r.n)}${depRuleFor(lookup(r.n)) ? ' ⚠️' : ''}</span><div class="muted">${tr('{n} Tage', { n: r.nw })}</div></td><td class="num">${fmtNum(r.w, 1)}</td><td class="num">${fmtNum(r.wo, 1)}</td><td class="num">${fmtDiff(d)}</td></tr>`; }).join('')}</table>
      ${cmp.some(r => depRuleFor(lookup(r.n)) && r.w != null && r.wo != null && r.w > r.wo) ? `<div class="ix ix2" style="margin-top:10px"><b>⚠️ ${tr('Vorsicht beim Deuten')}</b><div class="muted" style="color:var(--text)">${tr('Bei Substanzen mit Abhängigkeitspotenzial (⚠️) ist eine bessere Stimmung an Konsumtagen kein Beleg, dass sie dir guttun. Bei Gewöhnung fühlen sich die Tage ohne schlechter an – durch Entzug, Craving oder Crash. Achte darauf, ob deine Stimmung insgesamt über Wochen sinkt.')}</div></div>` : ''}
      <div class="muted" style="margin-top:8px">${tr('Zählt nur Tage mit Smiley.')} ${tr(withAfter ? 'Mit Nachwirkung: zählt auch die Tage danach (einstellbar im Plan).' : 'Nur der Tag der Einnahme.')}</div>`;
  }
  return html + `</div>`;
}

// Single-series line chart: 2px line, 8px markers, recessive grid, crosshair + tooltip.
function lineChart(el, pts, o) {
  const W = el.clientWidth || 320, H = 190, L = 34, R = 10, T = 10, B = 24;
  const x = i => L + (pts.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (pts.length - 1));
  const y = v => T + (1 - (v - o.min) / (o.max - o.min)) * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${tr('Verlaufskurve')}">`;
  for (const t of o.ticks) s += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--grid)" stroke-width="1"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${o.label(t)}</text>`;
  if (o.goal) s += `<line x1="${L}" x2="${W - R}" y1="${y(o.goal)}" y2="${y(o.goal)}" stroke="var(--muted)" stroke-dasharray="4 4" stroke-width="1"/><text x="${W - R}" y="${y(o.goal) - 4}" text-anchor="end" font-size="11" fill="var(--muted)">${tr('Ziel')}</text>`;
  // x labels: ~5 evenly spaced
  const n = Math.min(5, pts.length), step = Math.max(1, Math.round((pts.length - 1) / Math.max(1, n - 1)));
  for (let i = 0; i < pts.length; i += step) {
    const d = parseDay(pts[i].k);
    const lbl = daysBetween(pts[0].k, pts[pts.length - 1].end) > 150 ? d.toLocaleDateString(LOCALE, { month: 'short', year: '2-digit' }) : d.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' });
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
    const when = p.k === p.end ? fmtDay(p.k) : `${parseDay(p.k).toLocaleDateString(LOCALE)} – ${parseDay(p.end).toLocaleDateString(LOCALE)}`;
    tip.innerHTML = `${when}<br><b>${o.fmt(p.v)}</b>${p.k !== p.end ? ` · ${tr('{n} Tage', { n: p.n })}` : ''}`;
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
  header(tr('Plan'), tr('{n} aktiv', { n: db.substances.filter(s => s.active).length }), `<button class="btn small" onclick="openLexikon()">${tr('Lexikon')}</button><button class="btn primary small" onclick="editSubstance()">＋ ${tr('Neu')}</button>`);
  let html = '';
  for (const [c, t] of Object.entries(CATS)) {
    const list = db.substances.filter(s => s.category === c).sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name));
    if (!list.length) continue;
    html += `<h2>${t}</h2><div class="card">`;
    for (const s of list) {
      const weekly = weeklyDose(s);
      html += `<div class="entry row" style="${s.active ? '' : 'opacity:.55'}">
        <div class="dot" style="background:${esc(s.color)}"></div>
        <div class="grow"><div class="name">${esc(s.name)}${s.active ? '' : ` <span class="muted">(${tr('pausiert')})</span>`}</div>
          <div class="muted">${doseText(s, s.dose)} · ${scheduleText(s)} · ${FORMS[s.form]}</div>
          ${weekly != null ? `<div class="muted">≈ ${fmtNum(weekly)} ${esc(tr(s.unit))} / ${tr('Woche')}</div>` : ''}
          ${activeDays(s.name) ? `<div class="muted">${tr('wirkt {n} Tage nach', { n: activeDays(s.name) })}</div>` : ''}
          ${s.notes ? `<div class="muted">${esc(s.notes)}</div>` : ''}</div>
        <button class="btn small" onclick="editSubstance('${s.id}')">✎</button></div>`;
    }
    html += `</div>`;
  }
  const others = [...new Set(db.logs.filter(l => !db.substances.some(s => s.name === l.name)).map(l => l.name))].sort();
  if (others.length) html += `<h2>${tr('Nachwirkung – sonstige Einträge')}</h2><div class="card"><div class="muted" style="margin-bottom:6px">${tr('Tage im System nach der Einnahme (0 = nur am selben Tag)')}</div>` +
    others.map(n => `<div class="entry row"><div class="grow name">${esc(n)}</div><input style="width:80px;text-align:right" inputmode="numeric" value="${activeDays(n)}" onchange="setActiveDays(${esc(JSON.stringify(n))}, this.value)"></div>`).join('') + `</div>`;
  if (!db.substances.length) html += `<div class="card empty">${tr('Lege hier alles an, was du regelmäßig oder ab und zu nimmst – Steroide, Medikamente, Supplements, Freizeit. Geplante Sachen erscheinen dann am jeweiligen Tag zum Abhaken, „nach Bedarf“-Sachen als Schnell-Buttons.')}</div>`;
  $('#view').innerHTML = html;
}

function editSubstance(id) {
  const s = id ? subById(id) : null;
  const v = s || { name: '', category: 'ped', form: 'inj', dose: '', unit: 'mg', conc: '', mode: 'interval', interval: 7, weekdays: [], timesPerDay: 1, start: todayKey(), end: '', active: true, notes: '', color: COLORS[db.substances.length % COLORS.length] };
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog" id="f">
    <h3>${tr(s ? 'Bearbeiten' : 'Neu im Plan')}</h3>
    <label>${tr('Name')}</label><input name="name" value="${esc(v.name)}" placeholder="${tr('z. B. Kreatin')}">
    <div class="grid2">
      <div><label>${tr('Kategorie')}</label><select name="category">${Object.entries(CATS).map(([k, t]) => `<option value="${k}" ${v.category === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label>${tr('Form')}</label><select name="form">${Object.entries(FORMS).map(([k, t]) => `<option value="${k}" ${v.form === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label>${tr('Dosis pro Einnahme')}</label><input name="dose" inputmode="decimal" value="${v.dose}"></div>
      <div><label>${tr('Einheit')}</label><select name="unit">${UNITS.map(u => `<option value="${u}" ${v.unit === u ? 'selected' : ''}>${tr(u)}</option>`).join('')}</select></div>
      <div><label>${tr('Konzentration mg/ml')}</label><input name="conc" inputmode="decimal" value="${v.conc || ''}" placeholder="${tr('optional')}"></div>
      <div><label>${tr('Farbe')}</label><input name="color" type="color" value="${esc(v.color)}" style="height:43px;padding:4px"></div>
    </div>
    <label>${tr('Wirkt nach (Tage im System nach der Einnahme)')}${v.name && lookup(v.name) ? ` – ${tr('Lexikon')}: ${tr('{n} Tage', { n: defaultActive(v.name) })}` : ''}</label>
    <input name="afterDays" inputmode="numeric" value="${v.name ? activeDays(v.name) : ''}" placeholder="${tr('z. B. 14')}">
    <label>${tr('Rhythmus')}</label>
    <select name="mode">
      <option value="interval" ${v.mode === 'interval' ? 'selected' : ''}>${tr('Alle X Tage')}</option>
      <option value="weekdays" ${v.mode === 'weekdays' ? 'selected' : ''}>${tr('Bestimmte Wochentage')}</option>
      <option value="dates" ${v.mode === 'dates' ? 'selected' : ''}>${tr('Bestimmte Daten')}</option>
      <option value="asneeded" ${v.mode === 'asneeded' ? 'selected' : ''}>${tr('Nach Bedarf (Schnell-Button)')}</option>
    </select>
    <div id="dtBox"><label>${tr('Daten (mit Komma getrennt, z. B. 12.10.2026, 12.11.2026)')}</label>
      <textarea name="dates" style="min-height:60px">${(v.dates || []).map(k => parseDay(k).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' })).join(', ')}</textarea></div>
    <div id="ivBox"><label>${tr('Alle wie viele Tage? (1 = täglich, 3,5 = E3.5D, 7 = wöchentlich)')}</label>
      <input name="interval" inputmode="decimal" value="${String(v.interval).replace('.', ',')}"></div>
    <div id="wdBox"><label>${tr('Wochentage')}</label><div class="days">
      ${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" name="wd" value="${d}" ${v.weekdays.includes(d) ? 'checked' : ''}>${WEEKDAYS[d]}</label>`).join('')}</div></div>
    <div class="grid2" id="schedBox">
      <div><label>${tr('Mal pro Tag')}</label><input name="tpd" inputmode="numeric" value="${v.timesPerDay}"></div>
      <div><label>${tr('Aktiv')}</label><select name="active"><option value="1" ${v.active ? 'selected' : ''}>${tr('Ja')}</option><option value="0" ${!v.active ? 'selected' : ''}>${tr('Pausiert')}</option></select></div>
      <div><label>${tr('Start')}</label><input name="start" type="date" value="${v.start || ''}"></div>
      <div><label>${tr('Ende (optional)')}</label><input name="end" type="date" value="${v.end || ''}"></div>
    </div>
    <label>${tr('Notizen')}</label><textarea name="notes" style="min-height:60px" placeholder="${tr('z. B. Hersteller, Charge, Zweck')}">${esc(v.notes)}</textarea>
    <div class="actions">
      <button class="btn primary" value="save">${tr('Speichern')}</button>
      <button class="btn" value="cancel" formnovalidate>${tr('Abbrechen')}</button>
      ${s ? `<button class="btn danger" value="delete" formnovalidate>${tr('Löschen')}</button>` : ''}
    </div></form>`;
  const f = dlg.querySelector('#f');
  const sync = () => { $('#ivBox').style.display = f.mode.value === 'interval' ? '' : 'none'; $('#wdBox').style.display = f.mode.value === 'weekdays' ? '' : 'none'; $('#dtBox').style.display = f.mode.value === 'dates' ? '' : 'none'; };
  f.mode.addEventListener('change', sync); sync();
  dlg.onclose = () => {
    if (dlg.returnValue === 'delete') {
      if (confirm(tr('„{name}“ löschen? Bisherige Einträge bleiben im Verlauf erhalten.', { name: s.name }))) {
        db.logs.forEach(l => { if (l.subId === s.id) l.subId = null; });
        db.substances = db.substances.filter(x => x.id !== id); save(); render();
      }
      return;
    }
    if (dlg.returnValue !== 'save') return;
    const dose = num(f.dose.value);
    if (!f.name.value.trim() || dose == null) { toast(tr('Name und Dosis angeben')); return; }
    const data = {
      name: f.name.value.trim(), category: f.category.value, form: f.form.value, color: f.color.value, dose, unit: f.unit.value,
      conc: num(f.conc.value), mode: f.mode.value, interval: Math.max(0.5, num(f.interval.value) || 1),
      weekdays: [...f.querySelectorAll('[name=wd]:checked')].map(c => Number(c.value)),
      dates: parseDates(f.dates.value),
      timesPerDay: Math.max(1, Math.round(num(f.tpd.value) || 1)), active: f.active.value === '1',
      start: f.start.value || todayKey(), end: f.end.value, notes: f.notes.value.trim()
    };
    setActiveDays(data.name, f.afterDays.value);
    if (s) {
      Object.assign(s, data);
      db.logs.forEach(l => { if (l.subId === s.id) { l.name = s.name; l.category = s.category; } });
    } else db.substances.push({ id: uid(), ...data });
    save(); render(); toast(tr('Gespeichert'));
  };
  dlg.returnValue = ''; dlg.showModal();
}

function parseDates(t) {
  const out = [];
  for (const m of t.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})|(\d{4})-(\d{2})-(\d{2})/g)) {
    const [y, mo, d] = m[4] ? [+m[4], +m[5], +m[6]] : [+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]];
    out.push(`${y}-${pad(mo)}-${pad(d)}`);
  }
  return [...new Set(out)].sort();
}

// ---------- Lexikon ----------
let lexQ = '', lexCat = '', lexBack = 'more';
function openLexikon() { lexBack = tab === 'lexikon' ? lexBack : tab; tab = 'lexikon'; render(); window.scrollTo(0, 0); }
function renderLexikon() {
  header(tr('Lexikon'), tr('Halbwertszeiten & Zeit im Blut'), `<button class="btn small" onclick="tab=lexBack;render()">${tr('Fertig')}</button>`);
  $('#view').innerHTML = `<input id="lq" type="search" placeholder="${tr('Suchen, z. B. Kreatin, Magnesium, Ibuprofen …')}" value="${esc(lexQ)}" oninput="lexQ=this.value;renderLexList()">
    <div class="chips" style="margin:10px 0">${[['', tr('Alle')], ['med', CATS.med], ['ped', tr('PEDs')], ['pep', CATS.pep], ['rec', CATS.rec], ['supp', CATS.supp]].map(([c, t]) =>
      `<button class="chip ${lexCat === c ? 'on' : ''}" onclick="lexCat='${c}';renderLexikon()">${t}</button>`).join('')}</div>
    <div class="card"><div class="name">${tr('Kombi-Check')}</div>
      <div class="grid2"><div><input id="cA" list="lexNames" placeholder="${tr('Substanz')} 1" oninput="comboCheck()"></div><div><input id="cB" list="lexNames" placeholder="${tr('Substanz')} 2" oninput="comboCheck()"></div></div>
      <datalist id="lexNames">${LEX.map(e => `<option value="${esc(e.name)}">`).join('')}</datalist>
      <div id="cRes" style="margin-top:10px"></div></div>
    <div class="notice">${tr('Richtwerte aus der Fachliteratur – individuell stark unterschiedlich (Leber, Dosis, Dauerkonsum). „Im Blut“ ≈ 5 Halbwertszeiten (~97 % abgebaut). Keine medizinische Beratung.')}</div>
    <div id="lexList"></div>`;
  renderLexList();
}
function comboCheck() {
  const a = $('#cA').value.trim(), b = $('#cB').value.trim(), box = $('#cRes');
  if (!a || !b) { box.innerHTML = ''; return; }
  const ea = lookup(a), eb = lookup(b);
  if (!ea || !eb) { box.innerHTML = `<div class="muted">${tr('{name} ist nicht im Lexikon.', { name: esc(!ea ? a : b) })}</div>`; return; }
  const r = pairIssues(a, b);
  box.innerHTML = r.length ? issuesHtml([{ a: ea.name, b: eb.name, sev: r[0].sev, rules: r }])
    : `<div class="muted">${tr('Keine bekannte Wechselwirkung in der App-Datenbank. Das heißt nicht, dass es sicher ist.')}</div>`;
}
function renderLexList() {
  const q = normName(lexQ);
  const list = LEX.filter(e => (!lexCat || e.cat === lexCat) && (!q || [e.name, ...e.aliases].some(a => normName(a).includes(q))))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  $('#lexList').innerHTML = list.length ? `<div class="card">${list.map(e => `<div class="entry row">
    <div class="grow"><div class="name">${esc(e.name)} <span class="muted">${CATS[e.cat]}</span></div>
      ${e.aliases.length ? `<div class="muted">${esc(e.aliases.slice(0, 5).join(', '))}</div>` : ''}
      <div style="font-size:14px;margin-top:2px">${tr('Halbwertszeit')}: <b>${esc(e.range)}</b></div>
      <div style="font-size:14px">${tr('Im Blut')}: <b>${tr('ca.')} ${fmtDur(inBloodHours(e))}</b></div>
      ${depRuleFor(e) ? `<div style="font-size:14px">${tr('Abhängigkeitspotenzial')}: <b>${esc(depRuleFor(e).potential)}</b></div>` : ''}
      ${e.note ? `<div class="muted">${esc(e.note)}</div>` : ''}</div>
    <button class="btn small" aria-label="${tr('Eintragen')}" onclick="editLog(null, null, {name: ${esc(JSON.stringify(e.name))}, category: '${e.cat}'})">＋</button></div>`).join('')}</div>`
    : `<div class="card empty">${tr('Nicht im Lexikon. Du kannst es trotzdem frei eintragen.')}</div>`;
}

// Estimated level curve for one substance (dialog).
function showLevel(name) {
  const e = lookup(name), dlg = $('#dlg');
  dlg.onclose = null; dlg.returnValue = '';
  const now = Date.now(), logs = db.logs.filter(l => l.name === name && l.amount != null).sort((a, b) => a.time.localeCompare(b.time));
  const lv = levelAt(name, now);
  dlg.innerHTML = `<h3>${esc(name)}</h3>
    ${e ? `<div class="muted">${tr('Halbwertszeit')} ${esc(e.range)} · ${tr('im Blut ca.')} ${fmtDur(inBloodHours(e))}${e.note ? ' · ' + esc(e.note) : ''}</div>` : `<div class="muted">${tr('Nicht im Lexikon – keine Kurve möglich.')}</div>`}
    ${lv ? `<div class="stat"><div><div class="muted">${tr('Jetzt im Körper (geschätzt)')}</div><div class="v">≈ ${fmtNum(lv.v, lv.v < 10 ? 1 : 0)} ${esc(tr(lv.unit))}</div></div></div>
      <div class="chart" id="lvChart"></div>
      <div class="muted" style="margin-top:6px">${tr('Grobe Schätzung aus deinen Einträgen (einfacher Abbau ab Einnahme, Depot-Aufnahme nicht berücksichtigt).')}</div>` : e && e.h ? `<div class="muted" style="margin-top:8px">${tr('Keine Einträge mit Menge.')}</div>` : ''}
    <div class="actions"><button class="btn primary" onclick="$('#dlg').close()">${tr('Schließen')}</button></div>`;
  dlg.showModal();
  if (!lv) return;
  const today = todayKey();
  let from = logs[0].time.slice(0, 10);
  if (daysBetween(from, today) > 120) from = addDays(today, -120);
  const pts = [];
  for (let k = from, i = 0; i < 400; k = addDays(k, 1), i++) {
    const t = parseDay(k).getTime() + 12 * 3.6e6, r = levelAt(name, t);
    pts.push({ k, end: k, v: r ? r.v : 0 });
    if (k >= today && (!r || r.v < lv.v * 0.03 || daysBetween(today, k) > 120)) break;
  }
  const max = Math.max(...pts.map(p => p.v)) || 1, nice = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / nice) * nice;
  lineChart($('#lvChart'), pts, { min: 0, max: top, ticks: [0, top / 2, top], fmt: v => fmtNum(v, v < 10 ? 1 : 0) + ' ' + tr(lv.unit), label: v => fmtNum(v, v < 10 ? 1 : 0) });
}

// ---------- iOS app: reminders and app lock (only when running natively) ----------
const NATIVE = !!(window.Native && window.Native.isNative);
const prefGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const prefSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

// One generic notification per day with planned items – no substance names on the lock screen.
let reminderTimer;
function scheduleReminders() {
  if (!NATIVE) return;
  clearTimeout(reminderTimer);
  reminderTimer = setTimeout(async () => {
    const r = prefGet('halbwert-reminder', { on: false, time: '09:00' });
    const list = [];
    if (r.on) {
      const [hh, mm] = r.time.split(':').map(Number), now = Date.now();
      for (let i = 0; i < 30; i++) {
        const k = addDays(todayKey(), i), at = parseDay(k);
        at.setHours(hh, mm, 0, 0);
        if (at.getTime() <= now) continue;
        const open = db.substances.filter(s => isDue(s, k) && !isHandled(s, k)).length;
        if (open) list.push({ id: 1000 + i, at, title: 'Substance Tracker', body: open === 1 ? tr('Für heute ist 1 Eintrag geplant.') : tr('Für heute sind {n} Einträge geplant.', { n: open }) });
      }
    }
    try { await window.Native.setReminders(list); } catch (e) {}
  }, 800);
}
async function setReminder(on, time) {
  const r = prefGet('halbwert-reminder', { on: false, time: '09:00' });
  if (on != null) r.on = on;
  if (time) r.time = time;
  if (r.on && !(await window.Native.notificationsAllowed(true))) { r.on = false; toast(tr('Mitteilungen sind in den iOS-Einstellungen deaktiviert')); }
  prefSet('halbwert-reminder', r);
  scheduleReminders(); renderMore();
}

let locked = false, unlocking = false;
function lockScreen(show) {
  let el = $('#lock');
  if (!show) { if (el) el.remove(); locked = false; return; }
  locked = true;
  if (el) return;
  el = document.createElement('div');
  el.id = 'lock';
  el.innerHTML = `<img src="icon-180.png" alt="" width="72" height="72" style="border-radius:16px"><div class="name" style="font-size:20px">${tr('Substance Tracker ist gesperrt')}</div>
    <button class="btn primary" onclick="tryUnlock()">${tr('Entsperren')}</button>`;
  document.body.appendChild(el);
}
async function tryUnlock() {
  if (unlocking) return;
  unlocking = true;
  const ok = await window.Native.unlock(tr('Entsperre dein Tagebuch'));
  unlocking = false;
  if (ok) lockScreen(false);
}
async function setAppLock(on) {
  if (on) {
    if (!(await window.Native.biometryAvailable())) { toast(tr('Face ID / Code ist auf diesem Gerät nicht eingerichtet')); renderMore(); return; }
    if (!(await window.Native.unlock(tr('App-Sperre einschalten')))) { renderMore(); return; }
  }
  prefSet('halbwert-lock', !!on); renderMore();
}
if (NATIVE) {
  // Cover the content when leaving the app (also hides it in the app switcher), ask again on return.
  document.addEventListener('visibilitychange', () => {
    if (!prefGet('halbwert-lock', false) || unlocking) return;
    if (document.visibilityState === 'hidden') lockScreen(true);
    else if (locked) tryUnlock();
  });
}

// ---------- Backup reminder (asked once, off unless the user wants it) ----------
function askBackupReminder() {
  const dlg = $('#dlg');
  dlg.onclose = null; dlg.returnValue = '';
  dlg.innerHTML = `<h3>${tr('Backup-Erinnerung?')}</h3>
    <div class="muted">${tr('Deine Daten liegen nur auf diesem Gerät – ohne Konto, ohne Cloud. Wenn du die App löschst, ist alles weg. Soll dich die App einmal pro Woche an ein Backup erinnern?')}</div>
    <div class="actions"><button class="btn primary" id="brYes">${tr('Ja, wöchentlich')}</button><button class="btn" id="brNo">${tr('Nein, nie fragen')}</button></div>`;
  const set = v => { prefSet('st-backup-reminder', v); dlg.close(); render(); };
  dlg.querySelector('#brYes').onclick = () => set(true);
  dlg.querySelector('#brNo').onclick = () => set(false);
  dlg.showModal();
}
function backupDue() {
  if (prefGet('st-backup-reminder', null) !== true || !db.logs.length) return false;
  const last = prefGet('st-last-backup', 0), snooze = prefGet('st-backup-snooze', 0);
  return Date.now() - last > 7 * 864e5 && Date.now() > snooze;
}

// ---------- Onboarding, help & legal ----------
const ONB_KEY = 'halbwert-onboarded-v1';
function showOnboarding() {
  const dlg = $('#dlg');
  dlg.onclose = null; dlg.returnValue = '';
  dlg.innerHTML = `<div class="onb"><h3>${tr('Willkommen bei Substance Tracker')}</h3>
    <div class="muted">${tr('Dein privates Labor-Tagebuch: Was du deinem Körper zuführst – und was es mit dir macht.')}</div>
    <ul>
      <li><span>🧬</span><div><b>${tr('Alles an einem Ort.')}</b> ${tr('Supplements, Vitamine, Nootropics, Peptide, Hormone, Medikamente, Koffein, Alkohol und mehr – mit Dosis, Plan und einem Tipp zum Abhaken.')}</div></li>
      <li><span>📈</span><div><b>${tr('Muster erkennen.')}</b> ${tr('Stimmung, Journal, Ernährung und Trends zeigen, was dir wirklich etwas bringt.')}</div></li>
      <li><span>⏱️</span><div><b>${tr('Wissen, was wirkt.')}</b> ${tr('Halbwertszeiten, Spiegelkurven und Hinweise auf riskante Wechselwirkungen.')}</div></li>
      <li><span>🔒</span><div><b>${tr('Privat.')}</b> ${tr('Kein Konto, keine Cloud, kein Tracking. Alles bleibt auf diesem Gerät.')}</div></li>
      <li><span>🩺</span><div><b>${tr('Kein Ersatz für ärztlichen Rat.')}</b> ${tr('Alle Angaben sind Richtwerte. Im Notfall: {n}.', { n: EMERGENCY })}</div></li>
    </ul>
    <label style="display:flex;gap:8px;align-items:flex-start;color:var(--text);margin:0"><input type="checkbox" id="onbAge" style="width:auto;margin-top:3px">
      ${tr('Ich bin mindestens 18 Jahre alt und habe verstanden, dass die App keine medizinische Beratung ersetzt.')}</label>
    <div class="actions"><button class="btn primary" id="onbOk" disabled>${tr("Los geht's")}</button></div></div>`;
  dlg.querySelector('#onbAge').onchange = e => { dlg.querySelector('#onbOk').disabled = !e.target.checked; };
  dlg.querySelector('#onbOk').onclick = () => { try { localStorage.setItem(ONB_KEY, new Date().toISOString()); } catch (e) {} dlg.close(); };
  dlg.addEventListener('cancel', e => { if (!dlg.querySelector('#onbAge')?.checked) e.preventDefault(); }, { once: true });
  dlg.showModal();
}
function showHelp() {
  const dlg = $('#dlg');
  dlg.onclose = null; dlg.returnValue = '';
  const n = (label, num, tel) => `<div class="entry row"><div class="grow">${label}</div><a href="tel:${tel || num.replace(/\s/g, '')}">${num}</a></div>`;
  const intl = [['EU', '112'], [tr('USA / Kanada'), '911'], [tr('Großbritannien'), '999'], [tr('Australien'), '000'], [tr('Japan / Korea'), '119'], [tr('China'), '120'], [tr('Indien'), '112']];
  dlg.innerHTML = `<div class="help"><h3>${tr('Hilfe & Notfall')}</h3>
    <div class="ix ix3" style="margin-top:10px"><b>${tr('Notfall')}: ${EMERGENCY}</b><div class="muted" style="color:var(--text)">${tr('Bei Bewusstlosigkeit, Atemproblemen, Krampfanfall, Brustschmerz oder Überhitzung sofort den Notruf wählen. Sag ehrlich, was genommen wurde – das rettet Leben.')}</div></div>
    <h2>${tr('Notrufnummern')}</h2><div class="card">${intl.map(([c, x]) => n(c, x)).join('')}</div>
    <h2>${tr('Deutschland')}</h2><div class="card">
      ${n(tr('Notruf'), '112')}${n(tr('Giftnotruf (Berlin, 24 h)'), '030 19240')}${n(tr('Sucht & Drogen Hotline'), '01806 313031')}${n(tr('TelefonSeelsorge (24 h, kostenlos)'), '0800 111 0 111')}</div>
    <h2>${tr('Österreich')}</h2><div class="card">${n(tr('Notruf'), '144')}${n(tr('Vergiftungsinformation (VIZ)'), '01 406 43 43')}${n(tr('Telefonseelsorge'), '142')}</div>
    <h2>${tr('Schweiz')}</h2><div class="card">${n(tr('Notruf'), '144')}${n('Tox Info Suisse', '145')}${n(tr('Die Dargebotene Hand'), '143')}</div>
    <div class="muted">${tr('Beratung zu Substanzkonsum, auch anonym: örtliche Drogen- und Suchtberatungsstellen, Drug-Checking-Angebote, Hausarzt oder Hausärztin.')}</div>
    <div class="actions"><button class="btn primary" onclick="$('#dlg').close()">${tr('Schließen')}</button></div></div>`;
  dlg.showModal();
}

// ---------- More: settings & backup ----------
function renderMore() {
  header(tr('Mehr'), tr('Einstellungen & Backup'));
  const g = db.settings;
  $('#view').innerHTML = `
    <h2>${tr('Sprache')}</h2><div class="card"><select onchange="setLang(this.value)">${LANGS.map(([c, n]) => `<option value="${c}" ${c === LANG ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <h2>${tr('Ernährung')}</h2><div class="card">
      <label style="display:flex;align-items:center;gap:8px;color:var(--text);margin:0"><input type="checkbox" style="width:auto" ${g.calories ? 'checked' : ''} onchange="db.settings.calories=this.checked;save()"> ${tr('Kalorien-Tracking anzeigen')}</label>
      <div class="grid2">
        <div><label>${tr('Ziel kcal / Tag')}</label><input inputmode="decimal" value="${g.kcalGoal ?? ''}" onchange="db.settings.kcalGoal=num(this.value);save()"></div>
        <div><label>${tr('Ziel Protein g / Tag')}</label><input inputmode="decimal" value="${g.proteinGoal ?? ''}" onchange="db.settings.proteinGoal=num(this.value);save()"></div>
      </div></div>
    <h2>${tr('Lexikon')}</h2><div class="card row"><div class="grow muted">${tr('Halbwertszeiten von {n} Substanzen: Supplements, Medikamente, PEDs, Peptide und mehr', { n: LEX.length })}</div><button class="btn" onclick="openLexikon()">${tr('Öffnen')}</button></div>
    <h2>${tr('Backup')}</h2><div class="card">
      <div class="muted">${tr('Alles liegt nur auf diesem Gerät. Lösche nicht die App vom Home-Bildschirm, ohne vorher ein Backup zu sichern (z. B. in „Dateien“ / iCloud Drive).')}</div>
      <div class="actions">
        <button class="btn primary" onclick="exportJson()">${tr('Backup sichern')}</button>
        <button class="btn" onclick="$('#importFile').click()">${tr('Backup laden')}</button>
        <button class="btn" onclick="exportCsv()">${tr('Einträge als CSV')}</button>
        <input type="file" id="importFile" accept="application/json,.json" style="display:none" onchange="importJson(this.files[0])">
      </div></div>
    ${NATIVE ? (() => { const r = prefGet('halbwert-reminder', { on: false, time: '09:00' }); return `<h2>${tr('Erinnerungen & Sicherheit')}</h2><div class="card">
      <label style="display:flex;align-items:center;gap:8px;color:var(--text);margin:0"><input type="checkbox" style="width:auto" ${r.on ? 'checked' : ''} onchange="setReminder(this.checked)"> ${tr('Tägliche Erinnerung an geplante Einträge')}</label>
      <div class="grid2"><div><label>${tr('Uhrzeit')}</label><input type="time" value="${r.time}" onchange="setReminder(null, this.value)"></div></div>
      <div class="muted" style="margin-top:6px">${tr('Die Mitteilung nennt keine Substanzen – nur die Anzahl der geplanten Einträge.')}</div>
      <label style="display:flex;align-items:center;gap:8px;color:var(--text);margin:14px 0 0"><input type="checkbox" style="width:auto" ${prefGet('halbwert-lock', false) ? 'checked' : ''} onchange="setAppLock(this.checked)"> ${tr('App mit Face ID / Code sperren')}</label>
    </div>`; })() : ''}
    <h2>${tr('Hinweise & Backup')}</h2><div class="card">
      <div class="entry row"><div class="grow"><div class="name">${tr('Ausgeblendete Warnungen')}</div><div class="muted">${tr('{n} dauerhaft ignoriert', { n: (db.settings.ignoredWarnings || []).length })}</div></div><button class="btn small" onclick="resetWarnings()">${tr('Zurücksetzen')}</button></div>
      <label class="entry" style="display:flex;align-items:center;gap:8px;color:var(--text);margin:0"><input type="checkbox" style="width:auto" ${prefGet('st-backup-reminder', null) === true ? 'checked' : ''} onchange="prefSet('st-backup-reminder', this.checked)"> ${tr('Wöchentlich an Backup erinnern')}</label>
    </div>
    <h2>${tr('Hilfe & Infos')}</h2><div class="card">
      <div class="entry row"><div class="grow"><div class="name">${tr('Hilfe & Notfall')}</div><div class="muted">${tr('Notrufnummern, Giftnotruf, Beratung')}</div></div><button class="btn small" onclick="showHelp()">${tr('Öffnen')}</button></div>
      <div class="entry row"><div class="grow"><div class="name">${tr('Über Substance Tracker')}</div><div class="muted">${tr('Zweck, Datenquellen, Grenzen')}</div></div><a class="btn small" href="${LANG === 'de' ? 'support.html' : 'support-en.html'}">${tr('Öffnen')}</a></div>
      <div class="entry row"><div class="grow"><div class="name">${tr('Datenschutz')}</div><div class="muted">${tr('Keine Datenerhebung – alles bleibt lokal')}</div></div><a class="btn small" href="${LANG === 'de' ? 'privacy.html' : 'privacy-en.html'}">${tr('Öffnen')}</a></div>
      <div class="entry row"><div class="grow"><div class="name">${tr('Einführung erneut anzeigen')}</div></div><button class="btn small" onclick="showOnboarding()">${tr('Anzeigen')}</button></div>
    </div>
    <h2>${tr('Darstellung')}</h2><div class="card"><div class="seg">
      ${[['', tr('Automatisch')], ['light', tr('Hell')], ['dark', tr('Dunkel')]].map(([t, n]) => `<button class="${(document.documentElement.dataset.theme || '') === t ? 'on' : ''}" onclick="setTheme('${t}')">${n}</button>`).join('')}</div></div>
    <div class="card"><div class="muted">${tr('{a} im Plan · {b} Einträge · {c} Tage', { a: db.substances.length, b: db.logs.length, c: Object.keys(db.days).length })}</div>
      <div class="actions"><button class="btn danger" onclick="wipe()">${tr('Alle Daten löschen')}</button></div></div>`;
}

function blobToDataUrl(b) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
async function shareOrDownload(name, blob) {
  if (NATIVE) {
    try { await window.Native.shareFile(name, await blob.text()); } catch (e) { if (!/cancel/i.test(String(e && e.message))) toast(tr('Teilen nicht möglich')); }
    return;
  }
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function exportJson() {
  toast(tr('Backup wird erstellt …'));
  const files = await allFiles();
  const out = { ...db, files: await Promise.all(files.map(async f => ({ ...fileMeta(f), text: f.text, data: await blobToDataUrl(f.blob) }))) };
  await shareOrDownload(`tracker-backup-${todayKey()}.json`, new Blob([JSON.stringify(out)], { type: 'application/json' }));
  prefSet('st-last-backup', Date.now());
  if (tab === 'day') renderDay();
}
function exportCsv() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Datum', 'Uhrzeit', 'Kategorie', 'Was', 'Menge', 'Einheit', 'Stelle', 'Notiz'].map(x => tr(x)).join(';')];
  for (const l of [...db.logs].sort((a, b) => a.time.localeCompare(b.time)))
    lines.push([l.time.slice(0, 10), l.time.slice(11, 16), q(CATS[l.category]), q(l.name), l.amount == null ? '' : String(l.amount).replace('.', ','), q(tr(l.unit)), q(l.site ? tr(l.site) : ''), q(l.note)].join(';'));
  lines.push('', ['Datum', 'Stimmung', 'kcal', 'Protein', 'KH', 'Fett', 'Journal'].map(x => tr(x)).join(';'));
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
    if (!confirm(tr('Aktuelle Daten durch das Backup ersetzen?'))) return;
    const { files = [], ...rest } = d;
    db = { ...emptyDb(), ...rest, settings: { ...emptyDb().settings, ...(rest.settings || {}) }, days: rest.days || {} };
    await tx('files', 'readwrite', s => s.clear());
    for (const f of files) await putFile({ ...f, data: undefined, blob: await (await fetch(f.data)).blob() });
    await save(); render(); toast(tr('Backup geladen'));
  } catch (e) { toast(tr('Ungültige Backup-Datei')); }
}
async function wipe() {
  if (!confirm(tr('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.'))) return;
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
    toast(tr('Speicher nicht verfügbar – Daten werden nicht gesichert'));
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (NATIVE && prefGet('halbwert-lock', false)) { lockScreen(true); tryUnlock(); }
  document.querySelectorAll('nav button').forEach(b => { const sp = b.querySelector('span'); b.textContent = ''; b.append(sp, tr(b.dataset.label)); });
  render();
  scheduleReminders();
  let onboarded = false;
  try { onboarded = !!localStorage.getItem(ONB_KEY); } catch (e) {}
  if (!onboarded) showOnboarding();
  else if (prefGet('st-backup-reminder', null) == null && db.logs.length >= 10) askBackupReminder();
  // Re-render when the app comes back to the foreground on a new day.
  let lastDay = todayKey();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && todayKey() !== lastDay) { if (curDay === lastDay) curDay = todayKey(); lastDay = todayKey(); render(); }
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
