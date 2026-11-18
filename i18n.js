'use strict';
// Translation layer. German texts are the keys (i18n/keys.js); each language file adds an array in the same order.
window.I18N = {};
const LANGS = [['de', 'Deutsch'], ['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['it', 'Italiano'], ['pt', 'Português'],
  ['nl', 'Nederlands'], ['pl', 'Polski'], ['tr', 'Türkçe'], ['ru', 'Русский'], ['uk', 'Українська'], ['ar', 'العربية'],
  ['zh', '中文'], ['ja', '日本語'], ['ko', '한국어']];
const LOCALES = { de: 'de-DE', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', pt: 'pt-PT', nl: 'nl-NL', pl: 'pl-PL', tr: 'tr-TR',
  ru: 'ru-RU', uk: 'uk-UA', ar: 'ar', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR' };
const LANG = (() => {
  let saved = null;
  try { saved = localStorage.getItem('st-lang'); } catch (e) {}
  if (saved && LOCALES[saved]) return saved;
  const nav = (navigator.languages || [navigator.language || 'de']).map(l => String(l).slice(0, 2).toLowerCase());
  return nav.find(l => LOCALES[l]) || 'en';
})();
const LOCALE = LOCALES[LANG];
// Emergency number shown in short hints (help dialog lists more countries).
const EMERGENCY = { en: '112', zh: '120', ja: '119', ko: '119' }[LANG] || '112';
document.documentElement.lang = LANG;
if (LANG === 'ar') document.documentElement.dir = 'rtl';

// Called by i18n/<lang>.js with translations in the order of I18N_KEYS.
function I18N_ADD(lang, list) {
  const keys = window.I18N_KEYS || [];
  if (list.length !== keys.length) console.warn(`i18n ${lang}: ${list.length} of ${keys.length} texts`);
  const map = {};
  keys.forEach((k, i) => { if (list[i]) map[k] = list[i]; });
  window.I18N[lang] = map;
}
function tr(s, vars) {
  let r = (LANG !== 'de' && window.I18N[LANG] && window.I18N[LANG][s]) || s;
  if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return r;
}
// Half-life ranges are built from a small vocabulary; translate whole phrase first, then known words.
let rangeTokens;
function trRange(s) {
  if (LANG === 'de' || !s) return s;
  const map = window.I18N[LANG] || {};
  if (map[s]) return map[s];
  rangeTokens ||= (window.I18N_RANGE_TOKENS || []).filter(t => map[t]).sort((a, b) => b.length - a.length)
    .map(t => [new RegExp('(^|[^A-Za-zÄÖÜäöüß])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^A-Za-zÄÖÜäöüß])', 'g'), map[t]]);
  let r = s;
  for (const [re, to] of rangeTokens) r = r.replace(re, (m, pre) => pre + to);
  return r.replace(/(\d),(\d)/g, LOCALE.startsWith('de') || /^(es|fr|it|pt|nl|pl|tr|ru|uk)/.test(LANG) ? '$1,$2' : '$1.$2');
}
function setLang(l) {
  try { localStorage.setItem('st-lang', l); } catch (e) {}
  location.reload();
}
if (LANG !== 'de') document.write(`<script src="i18n/${LANG}.js"><\/script>`);
