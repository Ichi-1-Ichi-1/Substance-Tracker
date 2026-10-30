'use strict';

// ---------- Constants ----------
const SITES = ['Glute links', 'Glute rechts', 'Quad links', 'Quad rechts', 'Delt links', 'Delt rechts', 'Ventroglute links', 'Ventroglute rechts', 'Lat links', 'Lat rechts', 'Bauch (subkutan)', 'Sonstige'];
const ROTATION = SITES.slice(0, 10);
const UNITS = ['mg', 'mcg', 'g', 'IE', 'ml', 'Tabl.', 'Kps.', 'Stk.', 'Zug', 'Einheit'];
const FORMS = { inj: 'Injektion', oral: 'Oral', sc: 'Subkutan', other: 'Sonstiges' };
const CATS = { ped: 'Steroide / PEDs', pep: 'Peptide', med: 'Medikamente', supp: 'Supplements', rec: 'Freizeit', other: 'Sonstiges' };
const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308', '#6366f1', '#f97316'];
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
// ---------- Reference half-lives (substances-db.js) ----------
const normName = t => String(t || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9äöüß+.-]+/g, ' ').trim();
const LEX = (window.SUBSTANCE_DB || []).map(([name, cat, h, range, aliases, note]) => ({ name, cat, h, range, aliases, note }));
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
const RULES = (window.INTERACTION_RULES || []).map(([sev, a, b, t]) => ({ sev, a: [].concat(a), b: [].concat(b), t }));
const SEV = { 3: ['⛔', 'Gefährlich'], 2: ['⚠️', 'Riskant'], 1: ['ℹ️', 'Beachten'] };
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
    const key = [lookup(list[i]).name, lookup(list[j]).name].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key); out.push({ a: list[i], b: list[j], sev: r[0].sev, rules: r });
  }
  return out.sort((x, y) => y.sev - x.sev);
}
function issuesHtml(list) {
  return list.map(x => `<div class="ix ix${x.sev}"><div class="row"><b class="grow">${SEV[x.sev][0]} ${esc(x.a)} + ${esc(x.b)}</b><span class="muted">${SEV[x.sev][1]}</span></div>
    ${x.rules.map(r => `<div class="muted" style="color:var(--text)">${esc(r.t)}</div>`).join('')}</div>`).join('');
}

// Duration until ~97 % is eliminated (5 half-lives).
const inBloodHours = e => e && e.h ? e.h * 5 : null;
function fmtDur(h) {
  if (h == null) return 'unbekannt';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} Min.`;
  if (h < 48) return `${fmtNum(h, h < 10 ? 1 : 0)} Std.`;
  if (h < 24 * 60) return `${fmtNum(h / 24, h < 240 ? 1 : 0)} Tage`;
  return `${fmtNum(h / 168, 0)} Wochen`;
}
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
const fmtDiff = d => { if (d == null) return '–'; const r = Math.round(d * 10) / 10; return r > 0 ? '▲ +' + fmtNum(r, 1) : r < 0 ? '▼ ' + fmtNum(r, 1) : '±0'; };
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

const emptyDb = () => ({ version: 2, substances: [], logs: [], days: {}, settings: { calories: true, kcalGoal: null, proteinGoal: null, activeDays: {} } });
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
function inSystem(k) {
  const last = {};
  for (const l of db.logs) { const d = l.time.slice(0, 10); if (d <= k && (!last[l.name] || d > last[l.name].d)) last[l.name] = { d, l }; }
  return Object.entries(last).map(([name, { d, l }]) => ({ name, d, l, diff: daysBetween(d, k), ad: activeDays(name) }))
    .filter(x => x.diff >= 1 && x.diff <= x.ad).sort((a, b) => (a.ad - a.diff) - (b.ad - b.diff)).reverse();
}

function doseText(s, amount) {
  let t = `${fmtNum(amount)} ${s.unit}`;
  if (s.conc && s.unit === 'mg') t += ` (${fmtNum(amount / s.conc)} ml)`;
  return t;
}

function scheduleText(s) {
  const tpd = s.timesPerDay > 1 ? `, ${s.timesPerDay}× täglich` : '';
  if (s.mode === 'weekdays') return (s.weekdays.length ? [1, 2, 3, 4, 5, 6, 0].filter(d => s.weekdays.includes(d)).map(d => WEEKDAYS[d]).join(', ') : 'keine Tage') + tpd;
  if (s.mode === 'asneeded') return 'Nach Bedarf';
  if (s.mode === 'dates') {
    const up = (s.dates || []).filter(k => k >= todayKey());
    return up.length ? 'Termine: ' + up.slice(0, 4).map(k => parseDay(k).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })).join(', ') + (up.length > 4 ? ' …' : '') : 'Keine weiteren Termine';
  }
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
  if (s.mode === 'dates') return (s.dates || []).includes(k);
  const diff = daysBetween(s.start || k, k), iv = s.interval || 1;
  if (Number.isInteger(iv)) return diff % iv === 0;
  return Math.round(Math.round(diff / iv) * iv) === diff;
}
function nextDue(s, from) {
  for (let i = 0; i < 400; i++) { const k = addDays(from, i); if (isDue(s, k)) return k; }
  return null;
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

  // Interactions among what is taken, planned or still active on this day
  const dayEnd = isToday ? Date.now() : parseDay(k).getTime() + 86399000;
  const ix = issuesAmong([...logs.map(l => l.name), ...activeNamesAt(dayEnd), ...due.map(s => s.name)]);
  if (ix.length) html += `<h2>Wechselwirkungen <span class="muted">${ix.length}</span></h2>${issuesHtml(ix)}`;

  // Journal
  html += `<h2>Journal</h2><textarea id="note" data-day="${k}" placeholder="Wie war dein Tag? Training, Schlaf, Gedanken, Nebenwirkungen …" oninput="noteChanged(this.value)">${esc(day.note || '')}</textarea>`;

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

  // Still in the system
  const sys = inSystem(k).filter(x => !logs.some(l => l.name === x.name) && !due.some(s => s.name === x.name));
  const at = isToday ? Date.now() : parseDay(k).getTime() + 86399000;
  if (sys.length) html += `<h2>Im System <span class="muted">wirkt noch nach</span></h2><div class="card">` + sys.map(x => {
    const lv = levelAt(x.name, at);
    return `<div class="entry" onclick="showLevel(${esc(JSON.stringify(x.name))})" style="cursor:pointer"><div class="row"><div class="dot" style="background:${esc(colorOf(x.l))}"></div><div class="grow name">${esc(x.name)}</div>
      <span class="muted">noch ${x.ad - x.diff + 1} ${x.ad - x.diff + 1 === 1 ? 'Tag' : 'Tage'} ›</span></div>
      <div class="muted" style="margin-left:22px">zuletzt ${fmtDay(x.d)}${x.l.amount != null ? ' · ' + fmtNum(x.l.amount) + ' ' + esc(x.l.unit) : ''}${lv ? ` · ≈ ${fmtNum(lv.v, lv.v < 10 ? 1 : 0)} ${esc(lv.unit)} im Körper` : ''}</div>
      <div class="bar-bg" style="margin-left:22px"><i style="width:${Math.round((x.ad - x.diff + 1) / (x.ad + 1) * 100)}%;background:${esc(colorOf(x.l))}"></i></div></div>`;
  }).join('') + `</div>`;

  // Planned but not ticked off in the last 7 days
  if (isToday) {
    const open = [];
    for (let i = 1; i <= 7; i++) {
      const d = addDays(k, -i);
      for (const s of db.substances) if (isDue(s, d) && logsOn(d).filter(l => l.subId === s.id).length < (s.timesPerDay || 1)) open.push({ s, d });
    }
    if (open.length) html += `<h2>Offen <span class="muted">letzte 7 Tage</span></h2><div class="card">` + open.map(({ s, d }) =>
      `<div class="entry row"><div class="dot" style="background:${esc(s.color)}"></div><div class="grow"><div class="name">${esc(s.name)}</div><div class="muted">${fmtDay(d)} · ${doseText(s, s.dose)}</div></div>
        <button class="btn small" onclick="curDay='${d}';quickLog('${s.id}');curDay=todayKey();renderDay()">Erledigt</button>
        <button class="btn small" onclick="openDay('${d}')">›</button></div>`).join('') + `</div>`;
  }

  // Logged
  html += `<h2>Eingetragen <span class="muted">${logs.length || ''}</span></h2>`;
  html += logs.length ? `<div class="card">${logs.map(logRow).join('')}</div>` : '';
  const quick = db.substances.filter((s, i, all) => s.active && !due.some(d => d.name === s.name) && all.findIndex(x => x.active && x.name === s.name) === i);
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
    <div class="grow"><div class="name">${esc(l.name)} <span class="muted">${l.amount != null ? fmtNum(l.amount) + ' ' + esc(l.unit) : ''}</span></div>
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
  const worst = issuesAmong([s.name, ...activeNamesAt(Date.now()), ...logsOn(curDay).map(l => l.name)], s.name)[0];
  toast(worst && worst.sev >= 2 ? `${SEV[worst.sev][0]} ${SEV[worst.sev][1]}: ${s.name} + ${worst.a === s.name ? worst.b : worst.a}`
    : `${s.name} eingetragen${site && s.form === 'inj' ? ' – Stelle: ' + site : ''}`);
}

function editLog(id, presetSub, preset) {
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
      <label>Name</label><input name="name" list="pastNames" autocomplete="off" value="${esc(l && free ? l.name : preset ? preset.name : '')}" placeholder="z. B. Ibuprofen, Alkohol, …">
      <div class="muted" id="lexHint" style="margin-top:4px"></div>
      <datalist id="pastNames">${[...new Set([...db.logs.filter(x => !x.subId).map(x => x.name).sort(), ...LEX.map(e => e.name)])].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <label>Kategorie</label><select name="category">${Object.entries(CATS).map(([c, t]) => `<option value="${c}" ${(l ? l.category : preset ? preset.category : 'rec') === c ? 'selected' : ''}>${t}</option>`).join('')}</select>
    </div>
    <div id="ixBox" style="margin-top:10px"></div>
    <div class="grid2">
      <div><label>Menge (optional)</label><input name="amount" inputmode="decimal" value="${l ? l.amount ?? '' : s0 ? s0.dose : ''}"></div>
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
  // Picking a name used before fills in its last category and unit; known substances show their half-life.
  const hint = () => { const e = lookup(f.name.value); $('#lexHint').textContent = e ? `${e.name}: Halbwertszeit ${e.range} · im Blut ca. ${fmtDur(inBloodHours(e))}` : ''; };
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
      if (confirm('Eintrag löschen?')) { db.logs = db.logs.filter(x => x.id !== id); save(); render(); }
      return;
    }
    if (dlg.returnValue !== 'save') return;
    const s = subById(f.subId.value), amount = num(f.amount.value);
    const name = s ? s.name : f.name.value.trim();
    if (!name || !f.time.value) { toast('Name und Zeitpunkt angeben'); return; }
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
  for (const l of monthLogs) { const key = l.name + '|' + l.unit; (totals[key] ||= { name: l.name, unit: l.unit, sum: 0, n: 0, color: colorOf(l) }); totals[key].sum += l.amount || 0; totals[key].n++; }
  const moods = Object.entries(db.days).filter(([k, d]) => k.startsWith(calMonth) && d.mood != null).map(([, d]) => d.mood);

  let html = `<div class="card">${cal}</div>`;
  html += `<h2>Diesen Monat</h2><div class="card">
    <div class="muted">${moods.length ? `Stimmung Ø ${fmtNum(moods.reduce((a, b) => a + b, 0) / moods.length, 1)} an ${moods.length} Tagen` : 'Keine Stimmung erfasst'}</div>
    ${Object.keys(totals).length ? `<table style="margin-top:8px"><tr><th>Was</th><th class="num">Anzahl</th><th class="num">Gesamt</th></tr>
      ${Object.values(totals).sort((a, b) => a.name.localeCompare(b.name)).map(t => `<tr><td><span class="row" style="gap:6px"><i class="dot" style="background:${esc(t.color)}"></i>${esc(t.name)}</span></td><td class="num">${t.n}×</td><td class="num">${t.sum ? fmtNum(t.sum) + ' ' + esc(t.unit) : '–'}</td></tr>`).join('')}</table>` : ''}
  </div>`;

  const notes = Object.keys(db.days).filter(k => k.startsWith(calMonth) && db.days[k].note).sort().reverse();
  if (notes.length) html += `<h2>Journal <span class="muted">${notes.length} Einträge</span></h2><div class="card">` + notes.map(k => {
    const d = db.days[k];
    return `<div class="entry" onclick="openDay('${k}')" style="cursor:pointer"><div class="row"><span class="name grow">${fmtDay(k)}</span><span>${d.mood != null ? MOODS[d.mood][0] : ''}</span></div>
      <div class="muted" style="white-space:pre-wrap">${esc(d.note.length > 220 ? d.note.slice(0, 220) + ' …' : d.note)}</div></div>`;
  }).join('') + `</div>`;
  html += `<h2>Suchen</h2><input id="q" type="search" placeholder="Journal, Einträge, PDF-Texte durchsuchen" value="${esc(renderHistory.q || '')}" oninput="renderHistory.q=this.value;runSearch()"><div id="results" style="margin-top:10px"></div>`;
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
  for (const [k, d] of Object.entries(db.days)) if (d.note && d.note.toLowerCase().includes(q)) hits.push({ k, what: 'Journal', text: snippet(d.note) });
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
      <div><div class="muted">vs. davor</div><div class="v">${fmtDiff(diff)}</div></div>
    </div>
    <div class="card"><div class="muted" style="margin-bottom:6px">${bucket === 1 ? 'Tageswerte' : bucket === 7 ? 'Wochendurchschnitt' : 'Monatsdurchschnitt'} · 0 = mies, 5 = super</div>
      <div class="chart" id="moodChart"></div></div>`;

  const hasKcal = db.settings.calories && Object.entries(db.days).some(([k, d]) => k >= from && d.kcal != null);
  if (hasKcal) {
    html += `<h2>Kalorien</h2><div class="card"><div class="muted" style="margin-bottom:6px">${bucket === 1 ? 'Tageswerte' : 'Durchschnitt pro Tag'}</div><div class="chart" id="kcalChart"></div></div>`;
  }
  html += moodSubstances(inRange);
  if (!moodDays.length) html += `<div class="notice">Tippe auf „Tag“ jeden Tag einen Smiley an – hier entsteht dann deine Kurve.</div>`;
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
  let html = `<h2>Stimmung & Substanzen</h2><div class="card">
    <label style="display:flex;align-items:center;gap:8px;color:var(--text);margin:0 0 10px"><input type="checkbox" style="width:auto" ${withAfter ? 'checked' : ''} onchange="withAfter=this.checked;renderTrends()"> Nachwirkung mitzählen (Tage im System)</label>
    <div class="muted" style="margin-bottom:8px">Tippe einen Smiley an: Was war an diesen Tagen im System?</div>
    <div class="moods">${MOODS.map(([e], i) => { const n = days.filter(k => db.days[k].mood === i).length;
      return `<button class="mood ${moodPick === i ? 'sel' : ''}" onclick="moodPick=moodPick===${i}?null:${i};renderTrends()"><span>${e}</span>${n} T.</button>`; }).join('')}</div>`;
  if (moodPick != null) {
    const sel = days.filter(k => db.days[k].mood === moodPick);
    const rows = names.map(n => ({ n, c: taken[n].color, hit: sel.filter(k => taken[n].days.has(k)).length })).filter(r => r.hit).sort((a, b) => b.hit - a.hit);
    html += `<div style="margin-top:12px"><b>${MOODS[moodPick][0]} ${moodPick} – ${MOODS[moodPick][1]}</b> <span class="muted">an ${sel.length} Tagen</span></div>`;
    html += !sel.length ? `<div class="muted">Keine Tage mit diesem Smiley im Zeitraum.</div>`
      : rows.length ? `<table style="margin-top:6px">${rows.map(r => `<tr><td><span class="row" style="gap:6px"><i class="dot" style="background:${esc(r.c)}"></i>${esc(r.n)}</span></td><td class="num">${r.hit} von ${sel.length}</td><td class="num muted">${Math.round(r.hit / sel.length * 100)} %</td></tr>`).join('')}</table>`
      : `<div class="muted">An diesen Tagen nichts eingetragen.</div>`;
    html += sel.length ? `<div class="chips" style="margin-top:10px">${sel.slice(-14).reverse().map(k => `<button class="chip" onclick="openDay('${k}')">${parseDay(k).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</button>`).join('')}</div>` : '';
  }
  // Average mood with vs. without each substance
  const avgOf = ks => ks.length ? ks.reduce((a, k) => a + db.days[k].mood, 0) / ks.length : null;
  const cmp = names.map(n => { const w = days.filter(k => taken[n].days.has(k)), wo = days.filter(k => !taken[n].days.has(k)); return { n, c: taken[n].color, w: avgOf(w), wo: avgOf(wo), nw: w.length }; })
    .sort((a, b) => ((b.w ?? 0) - (b.wo ?? 0)) - ((a.w ?? 0) - (a.wo ?? 0)));
  if (cmp.length) {
    html += `<div style="margin-top:16px"><b>Ø Stimmung mit / ohne</b></div>
      <table style="margin-top:6px"><tr><th>Substanz</th><th class="num">mit</th><th class="num">ohne</th><th class="num">Diff.</th></tr>
      ${cmp.map(r => { const d = r.w != null && r.wo != null ? r.w - r.wo : null;
        return `<tr><td><span class="row" style="gap:6px"><i class="dot" style="background:${esc(r.c)}"></i>${esc(r.n)}</span><div class="muted">${r.nw} Tage</div></td><td class="num">${fmtNum(r.w, 1)}</td><td class="num">${fmtNum(r.wo, 1)}</td><td class="num">${fmtDiff(d)}</td></tr>`; }).join('')}</table>
      <div class="muted" style="margin-top:8px">Zählt nur Tage mit Smiley. ${withAfter ? 'Mit Nachwirkung: zählt auch die Tage danach (einstellbar im Plan).' : 'Nur der Tag der Einnahme.'}</div>`;
  }
  return html + `</div>`;
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
    const lbl = daysBetween(pts[0].k, pts[pts.length - 1].end) > 150 ? d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }) : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
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
  header('Plan', `${db.substances.filter(s => s.active).length} aktiv`, `<button class="btn small" onclick="openLexikon()">Lexikon</button><button class="btn primary small" onclick="editSubstance()">＋ Neu</button>`);
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
          ${activeDays(s.name) ? `<div class="muted">wirkt ${activeDays(s.name)} Tage nach</div>` : ''}
          ${s.notes ? `<div class="muted">${esc(s.notes)}</div>` : ''}</div>
        <button class="btn small" onclick="editSubstance('${s.id}')">✎</button></div>`;
    }
    html += `</div>`;
  }
  const others = [...new Set(db.logs.filter(l => !db.substances.some(s => s.name === l.name)).map(l => l.name))].sort();
  if (others.length) html += `<h2>Nachwirkung – sonstige Einträge</h2><div class="card"><div class="muted" style="margin-bottom:6px">Tage im System nach der Einnahme (0 = nur am selben Tag)</div>` +
    others.map(n => `<div class="entry row"><div class="grow name">${esc(n)}</div><input style="width:80px;text-align:right" inputmode="numeric" value="${activeDays(n)}" onchange="setActiveDays(${esc(JSON.stringify(n))}, this.value)"></div>`).join('') + `</div>`;
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
    <label>Wirkt nach (Tage im System nach der Einnahme)${v.name && lookup(v.name) ? ` – Lexikon: ${defaultActive(v.name)} Tage` : ''}</label>
    <input name="afterDays" inputmode="numeric" value="${v.name ? activeDays(v.name) : ''}" placeholder="z. B. 14">
    <label>Rhythmus</label>
    <select name="mode">
      <option value="interval" ${v.mode === 'interval' ? 'selected' : ''}>Alle X Tage</option>
      <option value="weekdays" ${v.mode === 'weekdays' ? 'selected' : ''}>Bestimmte Wochentage</option>
      <option value="dates" ${v.mode === 'dates' ? 'selected' : ''}>Bestimmte Daten</option>
      <option value="asneeded" ${v.mode === 'asneeded' ? 'selected' : ''}>Nach Bedarf (Schnell-Button)</option>
    </select>
    <div id="dtBox"><label>Daten (mit Komma getrennt, z. B. 12.10.2026, 12.11.2026)</label>
      <textarea name="dates" style="min-height:60px">${(v.dates || []).map(k => parseDay(k).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })).join(', ')}</textarea></div>
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
  const sync = () => { $('#ivBox').style.display = f.mode.value === 'interval' ? '' : 'none'; $('#wdBox').style.display = f.mode.value === 'weekdays' ? '' : 'none'; $('#dtBox').style.display = f.mode.value === 'dates' ? '' : 'none'; };
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
      dates: parseDates(f.dates.value),
      timesPerDay: Math.max(1, Math.round(num(f.tpd.value) || 1)), active: f.active.value === '1',
      start: f.start.value || todayKey(), end: f.end.value, notes: f.notes.value.trim()
    };
    setActiveDays(data.name, f.afterDays.value);
    if (s) {
      Object.assign(s, data);
      db.logs.forEach(l => { if (l.subId === s.id) { l.name = s.name; l.category = s.category; } });
    } else db.substances.push({ id: uid(), ...data });
    save(); render(); toast('Gespeichert');
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
  header('Lexikon', 'Halbwertszeiten & Zeit im Blut', `<button class="btn small" onclick="tab=lexBack;render()">Fertig</button>`);
  $('#view').innerHTML = `<input id="lq" type="search" placeholder="Suchen, z. B. Xanax, Weed, Tren …" value="${esc(lexQ)}" oninput="lexQ=this.value;renderLexList()">
    <div class="chips" style="margin:10px 0">${[['', 'Alle'], ['med', 'Medikamente'], ['ped', 'PEDs'], ['pep', 'Peptide'], ['rec', 'Freizeit'], ['supp', 'Supplements']].map(([c, t]) =>
      `<button class="chip ${lexCat === c ? 'on' : ''}" onclick="lexCat='${c}';renderLexikon()">${t}</button>`).join('')}</div>
    <div class="card"><div class="name">Kombi-Check</div>
      <div class="grid2"><div><input id="cA" list="lexNames" placeholder="Substanz 1" oninput="comboCheck()"></div><div><input id="cB" list="lexNames" placeholder="Substanz 2" oninput="comboCheck()"></div></div>
      <datalist id="lexNames">${LEX.map(e => `<option value="${esc(e.name)}">`).join('')}</datalist>
      <div id="cRes" style="margin-top:10px"></div></div>
    <div class="notice">Richtwerte aus der Fachliteratur – individuell stark unterschiedlich (Leber, Dosis, Dauerkonsum). „Im Blut“ ≈ 5 Halbwertszeiten (~97 % abgebaut). Keine medizinische Beratung.</div>
    <div id="lexList"></div>`;
  renderLexList();
}
function comboCheck() {
  const a = $('#cA').value.trim(), b = $('#cB').value.trim(), box = $('#cRes');
  if (!a || !b) { box.innerHTML = ''; return; }
  const ea = lookup(a), eb = lookup(b);
  if (!ea || !eb) { box.innerHTML = `<div class="muted">${esc(!ea ? a : b)} ist nicht im Lexikon.</div>`; return; }
  const r = pairIssues(a, b);
  box.innerHTML = r.length ? issuesHtml([{ a: ea.name, b: eb.name, sev: r[0].sev, rules: r }])
    : `<div class="muted">Keine bekannte Wechselwirkung in der App-Datenbank. Das heißt nicht, dass es sicher ist.</div>`;
}
function renderLexList() {
  const q = normName(lexQ);
  const list = LEX.filter(e => (!lexCat || e.cat === lexCat) && (!q || [e.name, ...e.aliases].some(a => normName(a).includes(q))))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  $('#lexList').innerHTML = list.length ? `<div class="card">${list.map(e => `<div class="entry row">
    <div class="grow"><div class="name">${esc(e.name)} <span class="muted">${CATS[e.cat]}</span></div>
      ${e.aliases.length ? `<div class="muted">${esc(e.aliases.slice(0, 5).join(', '))}</div>` : ''}
      <div style="font-size:14px;margin-top:2px">Halbwertszeit: <b>${esc(e.range)}</b></div>
      <div style="font-size:14px">Im Blut: <b>ca. ${fmtDur(inBloodHours(e))}</b></div>
      ${e.note ? `<div class="muted">${esc(e.note)}</div>` : ''}</div>
    <button class="btn small" aria-label="Eintragen" onclick="editLog(null, null, {name: ${esc(JSON.stringify(e.name))}, category: '${e.cat}'})">＋</button></div>`).join('')}</div>`
    : `<div class="card empty">Nicht im Lexikon. Du kannst es trotzdem frei eintragen.</div>`;
}

// Estimated level curve for one substance (dialog).
function showLevel(name) {
  const e = lookup(name), dlg = $('#dlg');
  dlg.onclose = null; dlg.returnValue = '';
  const now = Date.now(), logs = db.logs.filter(l => l.name === name && l.amount != null).sort((a, b) => a.time.localeCompare(b.time));
  const lv = levelAt(name, now);
  dlg.innerHTML = `<h3>${esc(name)}</h3>
    ${e ? `<div class="muted">Halbwertszeit ${esc(e.range)} · im Blut ca. ${fmtDur(inBloodHours(e))}${e.note ? ' · ' + esc(e.note) : ''}</div>` : `<div class="muted">Nicht im Lexikon – keine Kurve möglich.</div>`}
    ${lv ? `<div class="stat"><div><div class="muted">Jetzt im Körper (geschätzt)</div><div class="v">≈ ${fmtNum(lv.v, lv.v < 10 ? 1 : 0)} ${esc(lv.unit)}</div></div></div>
      <div class="chart" id="lvChart"></div>
      <div class="muted" style="margin-top:6px">Grobe Schätzung aus deinen Einträgen (einfacher Abbau ab Einnahme, Depot-Aufnahme nicht berücksichtigt).</div>` : e && e.h ? '<div class="muted" style="margin-top:8px">Keine Einträge mit Menge.</div>' : ''}
    <div class="actions"><button class="btn primary" onclick="$('#dlg').close()">Schließen</button></div>`;
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
  lineChart($('#lvChart'), pts, { min: 0, max: top, ticks: [0, top / 2, top], fmt: v => fmtNum(v, v < 10 ? 1 : 0) + ' ' + lv.unit, label: v => fmtNum(v, v < 10 ? 1 : 0) });
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
    <h2>Lexikon</h2><div class="card row"><div class="grow muted">Halbwertszeiten von ${LEX.length} Medikamenten, PEDs, Peptiden und Freizeitsubstanzen</div><button class="btn" onclick="openLexikon()">Öffnen</button></div>
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
    lines.push([l.time.slice(0, 10), l.time.slice(11, 16), q(CATS[l.category]), q(l.name), l.amount == null ? '' : String(l.amount).replace('.', ','), q(l.unit), q(l.site), q(l.note)].join(';'));
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
