// ================================================================================================
// BLOCK 12 · Persistence: autosave, progress file, input sanitizing, version guard
// ------------------------------------------------------------------------------------------------
// Depends : Block 11 (renderCollectTable), 9 (renderOptionsTable), 18 (renderPrequalCatalog).
// Provides: snapshotState() ⇄ restoreState(); sanitizeProgressData() (every field typed, unknown fields dropped);
//           confirmVersionCompat(); autoSaveProgress(); loadProgressFile(); start-over reset
// Note    : New state = add it to snapshotState, restoreState AND sanitizeProgressData, otherwise it is lost on load.
// ================================================================================================
// ---------------- Tab 2: save / resume ----------------

const AUTOSAVE_KEY = 'dr_workload_collect_autosave_v2';
let autoSaveTimer = null;

function snapshotState() {
  return {
    items: collectState.items, nextId: collectState.nextId,
    scoreThresholds: SCORE_THRESHOLDS, classDefs: CLASS_DEFS, tierLabels: TIER_LABELS,
    runbookOrders: runbookOrders, runbookNames: runbookNames, runbookOverrideUndo: runbookOverrideUndo,
    runbookServiceOwners: (typeof runbookServiceOwners !== 'undefined') ? runbookServiceOwners : undefined,
    lastGroupUndoKey: lastGroupUndoKey,
    prequalRules: (typeof PREQUAL_RULES !== 'undefined') ? PREQUAL_RULES : undefined,
    prequalEnv: (typeof PREQUAL_ENV !== 'undefined') ? PREQUAL_ENV : undefined,
    deletedTombstones: (typeof deletedTombstones !== 'undefined') ? deletedTombstones : undefined,
    toolVersion: TOOL_VERSION,
    savedAt: Date.now()
  };
}

// ---- Hardening (v0.12.1): progress JSON and autosave are UNTRUSTED INPUT ----
// Everything that enters the state gets a fixed type here: IDs become positive integers, scales
// 1–5, classes only known tier keys, texts bounded, unknown fields dropped. Rendering escapes in
// addition (defence in depth), but a crafted file must not get markup or foreign types into the
// state in the first place.
const SAN_STR_MAX = 4000;
function sanObj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }
function sanUnsafeKey(k) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; }
function sanStr(v, max) {
  if (v === null || v === undefined || typeof v === 'object') return '';
  const s = String(v);
  const lim = max || SAN_STR_MAX;
  return s.length > lim ? s.slice(0, lim) : s;
}
function sanScale(v) { // 1–5 or '' (not rated)
  if (v === '' || v === null || v === undefined) return '';
  const n = parseInt(v, 10);
  return (n >= 1 && n <= 5) ? n : '';
}
function sanNumOrBlank(v) { // number or ''; 0 stays 0
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number') return isFinite(v) ? v : '';
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? '' : n;
}
function sanHours(v) { // actual RPO/RTO: number preferred; legacy texts ("< 15 Min") stay as a short text
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number') return isFinite(v) ? v : '';
  const s = String(v).trim();
  const n = parseFloat(s.replace(',', '.'));
  return (!isNaN(n) && /^[\d.,\s-]+$/.test(s)) ? n : s.slice(0, 40);
}
function sanBool(v) { return v === true || v === 'true' || v === 1 || v === '1'; }
function sanTierKey(v) { return TIER_ORDER.includes(v) ? v : ''; }
function sanItem(raw) {
  const r = sanObj(raw) || {};
  const id = parseInt(r.id, 10);
  return {
    id: (id > 0) ? id : 0,
    name: sanStr(r.name, 500).trim(), owner: sanStr(r.owner, 500), type: sanStr(r.type, 500), os: sanStr(r.os, 500),
    location: sanStr(r.location, 500), sizeGiB: sanNumOrBlank(r.sizeGiB), note: sanStr(r.note),
    responsible: sanStr(r.responsible, 500), responsibleEmail: sanStr(r.responsibleEmail, 500),
    foundational: r.foundational === 'Ja' ? 'Ja' : 'Nein',
    bi: sanScale(r.bi), reg: sanScale(r.reg), ds: sanScale(r.ds), rk: sanScale(r.rk),
    clsOverride: sanTierKey(r.clsOverride), validated: sanBool(r.validated), outOfScope: sanBool(r.outOfScope),
    dependsOnFoundation: r.dependsOnFoundation !== false && r.dependsOnFoundation !== 'false',
    istRpo: sanHours(r.istRpo), istRto: sanHours(r.istRto), gap: sanStr(r.gap, 500),
    depsText: sanStr(r.depsText), source: sanStr(r.source, 300),
    autoProposed: sanBool(r.autoProposed)
  };
}
function sanItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  let next = 1;
  rawItems.forEach(r => { const id = r ? parseInt(r.id, 10) : NaN; if (id > 0) next = Math.max(next, id + 1); });
  const used = new Set();
  return rawItems.map(r => {
    const it = sanItem(r);
    if (!(it.id > 0) || used.has(it.id)) it.id = next++; // reassign missing/duplicate IDs
    used.add(it.id);
    return it;
  });
}
function sanThresholds(raw) {
  const o = sanObj(raw); if (!o) return null;
  const out = {};
  Object.keys(DEFAULT_SCORE_THRESHOLDS).forEach(k => { const n = parseFloat(o[k]); out[k] = isNaN(n) ? DEFAULT_SCORE_THRESHOLDS[k] : n; });
  return out;
}
function sanClassDefs(raw) {
  const o = sanObj(raw); if (!o) return null;
  const def = defaultClassDefs(); const out = {};
  TIER_ORDER.forEach(t => {
    const s = sanObj(o[t]) || {};
    const rpoH = parseFloat(s.rpoH), rtoH = parseFloat(s.rtoH);
    out[t] = {
      rpo: ('rpo' in s) ? sanStr(s.rpo, 200) : def[t].rpo, rto: ('rto' in s) ? sanStr(s.rto, 200) : def[t].rto,
      rpoH: isNaN(rpoH) ? def[t].rpoH : rpoH, rtoH: isNaN(rtoH) ? def[t].rtoH : rtoH, // legacy states without numbers: defaults
      config: ('config' in s) ? sanStr(s.config, 1000) : def[t].config
    };
  });
  return out;
}
function sanTierLabels(raw) {
  const o = sanObj(raw); if (!o) return null;
  const out = {}; TIER_ORDER.forEach(t => { const v = sanStr(o[t], 120).trim(); out[t] = v || t; }); return out;
}
function sanStrMap(raw, maxLen) { // groupKey -> Text
  const o = sanObj(raw); if (!o) return {};
  const out = {};
  Object.keys(o).forEach(k => { if (sanUnsafeKey(k)) return; const v = sanStr(o[k], maxLen || 500); if (v) out[sanStr(k)] = v; });
  return out;
}
function sanIdListMap(raw) { // groupKey -> [itemId, ...]
  const o = sanObj(raw); if (!o) return {};
  const out = {};
  Object.keys(o).forEach(k => { if (sanUnsafeKey(k) || !Array.isArray(o[k])) return; out[sanStr(k)] = o[k].map(x => parseInt(x, 10)).filter(n => n > 0); });
  return out;
}
function sanServiceOwners(raw) { // groupKey -> { owner, responsible, responsibleEmail }
  const o = sanObj(raw); if (!o) return {};
  const out = {};
  Object.keys(o).forEach(k => {
    if (sanUnsafeKey(k)) return;
    const s = sanObj(o[k]); if (!s) return;
    const e = {};
    ['owner', 'responsible', 'responsibleEmail'].forEach(f => { const v = sanStr(s[f], 500); if (v) e[f] = v; });
    if (Object.keys(e).length) out[sanStr(k)] = e;
  });
  return out;
}
function sanUndoMap(raw) { // undoKey -> { itemId: vorheriger clsOverride }
  const o = sanObj(raw); if (!o) return {};
  const out = {};
  Object.keys(o).forEach(k => {
    if (sanUnsafeKey(k)) return;
    const s = sanObj(o[k]); if (!s) return;
    const e = {};
    Object.keys(s).forEach(idk => { const id = parseInt(idk, 10); if (id > 0) e[id] = sanTierKey(s[idk]); });
    out[sanStr(k)] = e;
  });
  return out;
}
function sanPrequalRules(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  raw.forEach((r0, i) => {
    const r = sanObj(r0); if (!r) return;
    const stage = parseInt(r.stage, 10);
    const rule = { id: sanStr(r.id, 80) || ('custom-' + i), stage: (stage >= 0 && stage <= 3) ? stage : 1,
      label: sanStr(r.label, 200), pat: sanStr(r.pat, 2000) };
    if (r.oosCheck) { rule.oosCheck = true; rule.preTicked = !!r.preTicked; }
    else {
      ['bi', 'reg', 'ds', 'rk'].forEach(k => { const v = sanScale(r[k]); if (v !== '') rule[k] = v; });
      if (r.foundational) rule.foundational = true;
      if (r.weak) rule.weak = true;
      if (r.osHint) rule.osHint = sanStr(r.osHint, 100).toLowerCase();
      if (r.note) rule.note = sanStr(r.note, 1000);
    }
    out.push(rule);
  });
  return out;
}
function sanTombstones(raw) { // [{name, source, at}], bounded
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.slice(-500).forEach(t0 => { const t = sanObj(t0); if (!t) return; const name = sanStr(t.name, 500).trim(); if (name) out.push({ name: name, source: sanStr(t.source, 300), at: parseInt(t.at, 10) || 0 }); });
  return out;
}
function sanPrequalEnv(raw) {
  const o = sanObj(raw); if (!o) return null;
  const d = (typeof defaultPrequalEnv === 'function') ? defaultPrequalEnv() : { nonprod: '', prod: '' };
  return { nonprod: ('nonprod' in o) ? sanStr(o.nonprod, 2000) : d.nonprod, prod: ('prod' in o) ? sanStr(o.prod, 2000) : d.prod };
}
function sanitizeProgressData(data) {
  const d = sanObj(data) || {};
  const items = sanItems(d.items);
  const maxId = items.reduce((m, it) => Math.max(m, it.id), 0);
  const nid = parseInt(d.nextId, 10);
  return {
    items: items,
    nextId: (nid > maxId) ? nid : maxId + 1,
    scoreThresholds: sanThresholds(d.scoreThresholds),
    classDefs: sanClassDefs(d.classDefs),
    tierLabels: sanTierLabels(d.tierLabels),
    runbookOrders: sanIdListMap(d.runbookOrders),
    runbookNames: sanStrMap(d.runbookNames, 300),
    runbookServiceOwners: sanServiceOwners(d.runbookServiceOwners),
    runbookOverrideUndo: sanUndoMap(d.runbookOverrideUndo),
    lastGroupUndoKey: (typeof d.lastGroupUndoKey === 'string') ? sanStr(d.lastGroupUndoKey) : null,
    prequalRules: sanPrequalRules(d.prequalRules),
    prequalEnv: sanPrequalEnv(d.prequalEnv),
    deletedTombstones: sanTombstones(d.deletedTombstones),
    toolVersion: sanStr(d.toolVersion, 40),
    savedAt: parseInt(d.savedAt, 10) || null
  };
}

// Version comparison: files from a NEWER tool version may contain fields this build does not know.
// They would be lost silently on load and overwritten by the next autosave/export. Hence warn and
// ask for confirmation first.
function parseSemver(v) { const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(v || '')); return m ? [+m[1], +m[2], +m[3]] : null; }
function isNewerToolVersion(v) {
  const a = parseSemver(v), b = parseSemver(TOOL_VERSION);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return false;
}
function confirmVersionCompat(data) {
  const v = data && data.toolVersion;
  if (!isNewerToolVersion(v)) return true;
  return confirm(tr(
    'Diese Datei stammt aus einer NEUEREN Tool-Version (' + v + ' — dieses Tool: ' + TOOL_VERSION + ').\n\nFelder, die diese Version nicht kennt, gehen beim Laden verloren und fehlen dann auch im nächsten Autosave/Export.\n\nTrotzdem laden?',
    'This file was saved by a NEWER tool version (' + v + ' — this tool: ' + TOOL_VERSION + ').\n\nFields unknown to this version will be lost on load and will be missing from the next autosave/export.\n\nLoad anyway?'));
}

function restoreState(rawData) {
  const data = sanitizeProgressData(rawData);
  collectState.items = data.items;
  collectState.nextId = data.nextId;
  if (data.scoreThresholds) SCORE_THRESHOLDS = data.scoreThresholds;
  if (data.classDefs) CLASS_DEFS = data.classDefs;
  if (data.tierLabels) TIER_LABELS = data.tierLabels;
  // Runbook state belongs to the data set: a file without runbook data -> empty (no leftovers from the predecessor)
  runbookOrders = data.runbookOrders;
  runbookNames = data.runbookNames;
  runbookServiceOwners = data.runbookServiceOwners;
  runbookOverrideUndo = data.runbookOverrideUndo;
  lastGroupUndoKey = data.lastGroupUndoKey;
  if (data.prequalRules && typeof PREQUAL_RULES !== 'undefined') PREQUAL_RULES = data.prequalRules;
  if (data.prequalEnv && typeof PREQUAL_ENV !== 'undefined') PREQUAL_ENV = data.prequalEnv;
  if (typeof deletedTombstones !== 'undefined') deletedTombstones = data.deletedTombstones;
  if ((data.prequalRules || data.prequalEnv) && typeof renderPrequalCatalog === 'function') renderPrequalCatalog();
  renderOptionsTable();
  document.getElementById('collect-toolbar-card').classList.remove('hidden');
  document.getElementById('validation-card').classList.remove('hidden');
  renderCollectTable();
}

function autoSaveProgress() {
  lastCollectEditAt = Date.now(); // called from every editing path → drives the auto-sync in tab 2
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshotState()));
      document.getElementById('autosave-note').textContent = tr('Automatisch gesichert ', 'Auto-saved ') + new Date().toLocaleTimeString(tr('de-DE', 'en-GB'));
    } catch (e) { /* localStorage may be unavailable (e.g. some file:// contexts) — non-fatal */ }
  }, 600);
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('btn-save-progress').addEventListener('click', () => {
  downloadJSON(snapshotState(), 'DR_Assessment_Progress_' + new Date().toISOString().slice(0, 10) + '.json');
});

// Shared loading path for progress files (JSON). The file is fully self-contained
// (workloads + rules + options); the original raw-data import is NOT needed for it.
function loadProgressFile(file, andShowView) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!confirmVersionCompat(data)) return;
      restoreState(data);
      autoSaveProgress();
      if (andShowView) {
        const items = buildViewItemsFromCollect();
        if (items.length) {
          renderAll(items);
          setViewSourceNote(tr('Datenquelle: Fortschrittsdatei "', 'Data source: progress file "') + file.name + '" (' + items.length +
            tr(' bewertete Workloads — zum Bearbeiten in Tab ① wechseln).', ' rated workloads — switch to tab ① to edit).'));
        }
      }
    } catch (err) {
      alert(tr('Konnte Fortschrittsdatei nicht lesen: ', 'Could not read progress file: ') + err.message);
    }
  };
  reader.readAsText(file);
}

document.getElementById('load-progress-input').addEventListener('change', (e) => {
  if (e.target.files.length) loadProgressFile(e.target.files[0], false);
  e.target.value = '';
});
document.getElementById('load-progress-input-early').addEventListener('change', (e) => {
  if (e.target.files.length) loadProgressFile(e.target.files[0], false);
  e.target.value = '';
});

// restore-from-autosave banner on load
let autosaveBannerMeta = null; // {savedAt, count}; for rebuilding the banner text on a language switch
function renderAutosaveBannerText() {
  if (!autosaveBannerMeta) return;
  const when = new Date(autosaveBannerMeta.savedAt).toLocaleString(tr('de-DE', 'en-GB'));
  document.getElementById('autosave-banner-text').textContent =
    tr('Es wurde ein automatisch gesicherter Stand vom ', 'An auto-saved state from ') + when +
    tr(' mit ', ' with ') + autosaveBannerMeta.count + tr(' Workload(s) gefunden.', ' workload(s) was found.');
}
window.addEventListener('DOMContentLoaded', () => {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.items && data.items.length) {
        const banner = document.getElementById('autosave-banner');
        autosaveBannerMeta = { savedAt: data.savedAt, count: data.items.length };
        renderAutosaveBannerText();
        banner.classList.remove('hidden');
        document.getElementById('btn-restore-autosave').onclick = () => {
          if (!confirmVersionCompat(data)) return;
          restoreState(data);
          banner.classList.add('hidden');
        };
        document.getElementById('btn-discard-autosave').onclick = () => {
          localStorage.removeItem(AUTOSAVE_KEY);
          banner.classList.add('hidden');
        };
      }
    }
  } catch (e) { /* localStorage unavailable — skip silently */ }
});

// "↺ Start over" (top bar): full reset, clears autosave + findings acknowledgements, reloads the
// page. The language setting is deliberately kept. Replaces the former F5 workaround.
document.getElementById('btn-reset-all').addEventListener('click', () => {
  const n = collectState.items.length;
  const msg = tr(
    'Alles zurücksetzen und neu starten?\n\nDer aktuelle Arbeitsstand' + (n ? ' (' + n + ' Workload(s))' : '') +
    ' wird inklusive Auto-Speicherung verworfen. Nicht exportierte Daten gehen verloren.\n\nTipp: Vorher den Fortschritt als JSON sichern.',
    'Reset everything and start over?\n\nThe current working state' + (n ? ' (' + n + ' workload(s))' : '') +
    ' will be discarded, including the auto-save. Unexported data will be lost.\n\nTip: Save your progress as JSON first.');
  if (!confirm(msg)) return;
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
    localStorage.removeItem(FINDINGS_ACK_KEY);
  } catch (e) { /* non-fatal */ }
  location.reload();
});
