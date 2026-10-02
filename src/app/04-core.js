// ================================================================================================
// BLOCK 4 · Core: language helper, version & release notes, tier model, scoring, Excel view import
// ------------------------------------------------------------------------------------------------
// Depends : First application block; everything else builds on it.
// Provides: tr(), debounce(), cssVar(), TOOL_VERSION, REPO_URL, CHANGELOG, TIER_ORDER/TIER_RANK/TIER_COLORS,
//           OUT_OF_SCOPE_CLASS, tierColor(), tierLabel(), defaultClassDefs(), gapCheck(), computeScore(),
//           classifyScore(), effectiveClass(), handleFile()/parseWorkloadRows() (tab 2 view-only Excel import)
// Note    : Tier keys and OUT_OF_SCOPE_CLASS are stable technical keys shared with the export schema and every
//           saved progress file. Never rename them; display names live in TIER_LABELS.
// ================================================================================================
// ---------------- Language (DE/EN) ----------------
// tr(de, en) for dynamically generated sentences with variables; texts without variables (static HTML,
// table headers, chips, tooltips) are translated through the STATIC_I18N dictionary at the end of the
// file. Internal keys (tier names, sheet names, export values) ALWAYS stay stable.
// Public version label (SemVer, beta phase = 0.x). Embedded in the status bar, About, progress JSON
// and Excel export, so feedback always states which build is affected. Feature rounds bump the middle
// number (0.10.0), pure fixes the last one.
const TOOL_VERSION = 'v0.16.1-beta';
// Public repository (v0.14.1): source of releases, issues and the feedback channel. Links only, never data retrieval.
const REPO_URL = 'https://github.com/WittKlaus/dr-workload-classification';
// Release notes inside the tool (v0.13.0): key points per version only, newest entry first.
// Notes are DATA -> English (rule 6). The source of truth remains CHANGELOG.md in the repository; on
// release the most important points are copied here (push procedure). Shown in About ("What's new
// & history") and in the welcome modal (newest entry only).
const CHANGELOG = [
  { v: TOOL_VERSION, date: '2026-09-29', notes: [ // newest entry = current version (the literal lives only in TOOL_VERSION)
    "Fix: the \"manual\" badge on a class override in the table now follows the UI language immediately (it stayed German until the next language switch)",
    "Status bar fits small screens: shorter texts, the repository link reads \"GitHub\" (full address in the tooltip), the feedback button is just \"Feedback\", and the bar no longer wraps onto two lines on a laptop display"
  ]},
  { v: 'v0.16.0-beta', date: '2026-09-28', notes: [
    "One tier palette for everyone: the Okabe-Ito colours (formerly the colorblind option) are now the only palette, in light and dark mode — Foundation and Silver are no longer confusable, the colorblind switch is gone; weaker-dependency edges in the network are vermilion",
    "Bulk edit: \"Depends on\" can be set for all selected rows — add, replace or remove names; IDs are resolved to names exactly like in the table, unresolvable entries stop the action before anything changes",
    "Dependency network: arrowheads are larger, darker and end at the node's edge, so the direction (arrow = depends on) is readable; hovering a workload highlights what it depends on (solid) and what requires it (dashed) and fades the rest",
    "Validation: every source file validated in this session stays available — click its badge in the coverage line to see its result against the current list (always recomputed, never cached); a \"Re-check\" button re-runs all of them after edits",
    "Validation: the coverage marks (✅/⚠) are recomputed for all validated sources on every run, so a deletion after a green check shows up immediately; a mark reflects file deviations only (missing / extra / field values), the internal consistency check is reported separately"
  ]},
  { v: 'v0.15.0-beta', date: '2026-09-28', notes: [
    "Validation rebuilt: the source file is read through the same pipeline as the import (same sheet/header detection, same filters), so excluded rows are reported as skipped instead of missing",
    "Validation is source-aware: a file is compared only against the workloads imported from it; other sources are listed as coverage, not as extras; several files can be validated one after another",
    "Deleted workloads are remembered (name, source, time) and reported as deliberately deleted instead of missing; undo or re-import clears the marker",
    "Validation: findings carry severities (info / warning) and a one-click \"Import missing workloads\" action"
  ]},
  { v: 'v0.14.2-beta', date: '2026-09-28', notes: [
    "Import: vSphere system VMs (vCLS, Supervisor control plane) are excluded together with templates and SRM placeholders — they are managed by vCenter and are never workloads to protect",
    "Code readability: all source comments in English, every script block starts with a header (purpose, dependencies, entry points), table of contents at the top of the file — no functional change"
  ]},
  { v: 'v0.14.1-beta', date: '2026-09-22', notes: [
    "Public build for the open-source release: feedback now goes to GitHub Issues (prefilled link, no mail address in the tool), the top bar shows the tool's own icon instead of a vendor logo, and the disclaimer states the community-project status (not created by Veeam R&D, not validated by Veeam QA, not covered by Veeam Support)",
    "About: owner line links to the public repository (source code, license, releases)"
  ]},
  { v: 'v0.14.0-beta', date: '2026-09-21', notes: [
    "Delete workloads: ✕ per row and \"Delete selected\" in bulk edit — with confirmation, one-step undo, and automatic clean-up of dependency references to the deleted systems (IDs are never reused)",
    "Import: structural rows of hierarchical reports (repeated header rows, cluster/host subtotals, section headers such as \"vCenter Server:\") are skipped and counted — fixes phantom workloads like \"51\" or \"VM Name\" from Veeam ONE \"VMs Configuration\" reports",
    "Import: cluster/host names from those section rows are inherited as location for the VMs below (Veeam ONE reports carry the host only in the subtotal line)",
    "Import: Veeam replicas (name suffix \"_replica\") are excluded by default like templates/SRM placeholders — DR copies are not workloads to classify; a Veeam ONE report is recognized and named in the import summary"
  ]},
  { v: 'v0.13.0-beta', date: '2026-09-18', notes: [
    "Tab ① column chooser: hide the columns you do not need (device setting; #, name and protection class always stay)",
    "Dependency graph: \"Layout\" switch — automatic (animated up to 600 nodes, static above), or forced animated/static",
    "\"What's new\" in About (full history) and in the welcome dialog (latest release)",
    "Security: SheetJS updated 0.18.5 → 0.20.3 (fixes CVE-2023-30533 prototype pollution and CVE-2024-22363 ReDoS); embedded library versions listed in About"
  ]},
  { v: 'v0.12.1-beta', date: '2026-09-18', notes: [
    "Hardening: progress JSON and autosave are type-checked on load — IDs, scales and classes coerced, unknown fields dropped",
    "Version guard: files saved by a newer tool version ask for confirmation before loading",
    "Runtime-error banner with \"Report error\" (error text prefilled in the feedback mail)",
    "Excel export strips XML-invalid control characters; About: note on autosave persistence in the browser"
  ]},
  { v: 'v0.12.0-beta', date: '2026-09-02', notes: [
    "Multi-source import hardened: duplicate dialog (skip / fill / add), per-workload source, header-row and cover-sheet detection, size-unit and CSV-encoding detection",
    "Veeam ONE validated with real v13 \"VMs Configuration\" reports (vSphere and Hyper-V)",
    "Tab ③: service owner per runbook group with optional write-back; runbook cards with tier accent; foundation guidance and VRO FAQ",
    "Excel export fixes: fresh dashboard/chart caches, live thresholds in Class-Matrix, formatted runbook sheet",
    "Default language English; \"Before you begin\" on every start with a remember option"
  ]},
  { v: 'v0.11.0-beta', date: '2026-08-05', notes: [
    "\"Before you begin\" modal, ⚙ options menu, dark mode, colorblind-friendly tier palette",
    "Feedback via the local mail client (mailto — offline-safe)"
  ]},
  { v: 'v0.10.0-beta', date: '2026-08-05', notes: [
    "Rule-based prequalification wizard: ~27 categories, proposals only, \"auto\" badge until validated, editable catalog",
    "Formatted Excel export via the embedded corporate template (XML patching) with automatic plain fallback",
    "Data always English regardless of UI language: export file names, sheet names, note markers"
  ]},
  { v: 'v0.9.1-beta', date: '2026-08-05', notes: [
    "Large inventories: pagination, debounced search, graph circuit breaker above 1,500 workloads, static layout above 600 nodes, memory fix",
    "Import excludes templates/SRM placeholders; \"Start over\" reset"
  ]},
  { v: 'v0.9.0-beta', date: '2026-08-04', notes: [
    "SemVer versioning, About dialog, all libraries embedded — 100 % offline single file"
  ]},
  { v: 'v1 – v16 (pre-SemVer)', date: '2026-07-15 → 2026-07-24', notes: [
    "Methodology (BI/Reg/DS scoring, RK documentation-only), RVTools/CMDB import, bilingual UI, dependency graph, VRO runbook tab, numeric RPO/RTO gap analysis, print view, JSON progress files"
  ]}
];

const LANG_KEY = 'dr_lang_v1';
let LANG = 'en';
// Default language is ENGLISH (the tool is primarily English); German is the remembered choice
LANG = 'en';
try { LANG = localStorage.getItem(LANG_KEY) === 'de' ? 'de' : 'en'; } catch (e) { /* non-fatal */ }
function tr(de, en) { return LANG === 'en' ? en : de; }

// Debounce: prevents a full render per keystroke (unusable with 2000+ VMs otherwise)
function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Reads a CSS variable, so theme switches also reach SVG/canvas colors set from JS
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

// ONE palette for everyone (v0.16.0): Okabe-Ito, designed for pairwise distinguishability under the common
// forms of colour-vision deficiency. Foundation stays near-black (no second dark grey exists any more, so it
// cannot be confused with Silver); dark mode lightens every colour via DARK_TIER_ADJUST. The former
// colorblind switch is gone — the parameter is kept only so that old call sites keep working.
// tierColor() is the single colour funnel; the Excel template carries no tier colours of its own.
function defaultTierColors(_unused) {
  return {
    "Tier 0 – Foundation": "#232323",
    "Tier 1 – Platinum": "#CC79A7",
    "Tier 2 – Gold": "#E69F00",
    "Tier 3 – Silver": "#009E73",
    "Tier 4 – Bronze": "#0072B2"
  };
}
let TIER_COLORS = defaultTierColors(false);
const TIER_RANK = {
  "Tier 0 – Foundation": 0, "Tier 1 – Platinum": 1, "Tier 2 – Gold": 2, "Tier 3 – Silver": 3, "Tier 4 – Bronze": 4
};
const TIER_ORDER = ["Tier 0 – Foundation", "Tier 1 – Platinum", "Tier 2 – Gold", "Tier 3 – Silver", "Tier 4 – Bronze"];

// "Out of Scope" is deliberately NOT a sixth tier (not in TIER_ORDER/TIER_RANK/TIER_COLORS).
// It is a separate per-workload flag for systems that are intentionally NOT backed up/classified
// (e.g. protected elsewhere, being decommissioned, contractually excluded). This keeps it
// distinguishable from "not rated yet", it does not count in score/KPI/chart, but it stays
// visible (dimmed) and dependency risks against it are still checked.
const OUT_OF_SCOPE_CLASS = "Out of Scope – kein Backup";
const OUT_OF_SCOPE_COLOR = "#8A8A8A";
// Dark palette colors would vanish on a dark background in dark mode: the lightening pairs
const DARK_TIER_ADJUST = {
  "#232323": "#DADADF", "#CC79A7": "#E3A3CC", "#E69F00": "#F2B84A", "#009E73": "#2BC495", "#0072B2": "#4D9FDB",
  "#8A8A8A": "#A5A5AA"
};
function tierColor(cls) {
  const c = TIER_COLORS[cls] || OUT_OF_SCOPE_COLOR;
  if (document.documentElement.classList.contains('theme-dark') && DARK_TIER_ADJUST[c]) return DARK_TIER_ADJUST[c];
  return c;
}

// Display-only renaming (Options panel): the underlying key (used for rank comparisons, storage,
// and the exported Excel's Schutzklasse/Klasse values) never changes — only what's SHOWN on
// screen does. This keeps re-importing files and the automatic-vs-manual logic stable even if a
// TAM relabels tiers for a specific customer conversation (e.g. "Tier 1 – Platinum" -> "Kritisch").
let TIER_LABELS = {};
TIER_ORDER.forEach(t => TIER_LABELS[t] = t);
function tierLabel(key) {
  // The displayed out-of-scope label follows the language; the internal key stays stable
  if (key === "Out of Scope – kein Backup" && LANG === 'en') return "Out of scope – no backup";
  return TIER_LABELS[key] || key;
}

// Editable classification rules (Options panel, Tab 2) — used for automatic scoring everywhere.
// score thresholds = lower bound (inclusive) per tier; Tier 0 has no threshold (foundational flag only).
const DEFAULT_SCORE_THRESHOLDS = {
  "Tier 1 – Platinum": 4.3, "Tier 2 – Gold": 3.5, "Tier 3 – Silver": 2.5, "Tier 4 – Bronze": 0
};
// rpoH/rtoH = numeric targets in hours (0 = CDP/continuous) for the automatic gap check
// (actual > target). rpo/rto remain the human-readable display texts.
// A function, so the defaults follow the current language (class definitions are DATA, not UI
// text; the DOM dictionary does not reach them). A user's own adjustments are NEVER overwritten
// on a language switch (see the language toggle below).
function defaultClassDefs() {
  return {
    "Tier 0 – Foundation": { rpo: tr("≈ 0 (kontinuierliche Replikation)", "≈ 0 (continuous replication)"), rto: tr("< 30 Min", "< 30 min"), rpoH: 0, rtoH: 0.5, config: tr("CDP / kontinuierliche Replikation, Immutability lokal + Cloud, höchste VRO-Runbook-Priorität", "CDP / continuous replication, immutability on-prem + cloud, highest VRO runbook priority") },
    "Tier 1 – Platinum": { rpo: tr("< 15 Min", "< 15 min"), rto: tr("< 1 Std.", "< 1 h"), rpoH: 0.25, rtoH: 1, config: tr("Near-CDP-Replikation + Immutable Backup, automatisiertes VRO Orchestration Plan mit Failover", "Near-CDP replication + immutable backup, automated VRO orchestration plan with failover") },
    "Tier 2 – Gold": { rpo: tr("< 1 Std.", "< 1 h"), rto: tr("< 4 Std.", "< 4 h"), rpoH: 1, rtoH: 4, config: tr("Mehrfach tägliches Backup + optionale Replikation, teilautomatisiertes VRO Runbook", "Multiple daily backups + optional replication, semi-automated VRO runbook") },
    "Tier 3 – Silver": { rpo: tr("< 4 Std.", "< 4 h"), rto: tr("< 24 Std.", "< 24 h"), rpoH: 4, rtoH: 24, config: tr("Tägliches Backup, Immutability optional, standardisiertes VRO Runbook", "Daily backup, immutability optional, standardized VRO runbook") },
    "Tier 4 – Bronze": { rpo: tr("< 24 Std.", "< 24 h"), rto: tr("< 72 Std. / Best Effort", "< 72 h / best effort"), rpoH: 24, rtoH: 72, config: tr("Standard-Backup-Policy (täglich/wöchentlich), manuelle Wiederherstellung akzeptabel", "Standard backup policy (daily/weekly), manual recovery acceptable") }
  };
}

// Gap check: actual value (hours, 0 = CDP, '' = not surveyed) against the numeric class target.
// IMPORTANT: 0 is a valid value (CDP), so check explicitly for '' / null only, never for
// "falsy" (otherwise CDP systems would be reported as "not surveyed").
function isBlankNum(v) { return v === '' || v === null || v === undefined; }
function parseHours(v) {
  if (isBlankNum(v)) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n; // legacy files with texts like "< 15 Min" → null (no gap check possible)
}
// returns {rpoGap:bool, rtoGap:bool}; true = actual exceeds target
function gapCheck(cls, istRpo, istRto) {
  const def = CLASS_DEFS[cls];
  if (!def) return { rpoGap: false, rtoGap: false };
  const ir = parseHours(istRpo), it = parseHours(istRto);
  return {
    rpoGap: ir !== null && typeof def.rpoH === 'number' && ir > def.rpoH,
    rtoGap: it !== null && typeof def.rtoH === 'number' && it > def.rtoH
  };
}
let SCORE_THRESHOLDS = JSON.parse(JSON.stringify(DEFAULT_SCORE_THRESHOLDS));
let CLASS_DEFS = defaultClassDefs();

// shared classification formula (mirrors the Excel formulas exactly).
// Recovery complexity (rk) is intentionally NOT part of the score; it is a separate
// effort/risk modifier shown alongside, not a driver of the target protection class.
function computeScore(bi, reg, ds) {
  if ([bi, reg, ds].some(v => v === null || v === undefined || v === "" || isNaN(v))) return null;
  return (Number(bi) * 0.45 + Number(reg) * 0.35 + Number(ds) * 0.20);
}
function classifyScore(score, foundational) {
  if (foundational === "Ja") return "Tier 0 – Foundation";
  if (score === null) return "";
  if (score >= SCORE_THRESHOLDS["Tier 1 – Platinum"]) return "Tier 1 – Platinum";
  if (score >= SCORE_THRESHOLDS["Tier 2 – Gold"]) return "Tier 2 – Gold";
  if (score >= SCORE_THRESHOLDS["Tier 3 – Silver"]) return "Tier 3 – Silver";
  return "Tier 4 – Bronze";
}
// Resolves the *effective* class for an item that may carry a manual override.
// "Out of Scope" (no backup) has top priority and overrides even a manual selection.
function effectiveClass(item) {
  if (item.outOfScope) return OUT_OF_SCOPE_CLASS;
  if (item.clsOverride) return item.clsOverride;
  return classifyScore(computeScore(item.bi, item.reg, item.ds), item.foundational);
}

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const dropLabel = document.getElementById('drop-label');
const errorBox = document.getElementById('parse-error');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
}

function handleFile(file) {
  errorBox.classList.add('hidden');
  // Progress files (JSON from tab 1) are accepted here as well: the tool detects what it gets, so
  // nobody needs to know which tab is the "right" one for which file.
  const resetLabel = () => { dropLabel.textContent = tr("📄 Datei hierher ziehen oder klicken zum Auswählen (.xlsx oder Fortschrittsdatei .json)", "📄 Drag a file here or click to select (.xlsx or progress file .json)"); };
  if (/\.json$/i.test(file.name)) {
    dropLabel.textContent = "✅ " + file.name + tr(" (Fortschrittsdatei geladen)", " (progress file loaded)");
    loadProgressFile(file, true);
    return;
  }
  dropLabel.textContent = tr("⏳ Verarbeite ", "⏳ Processing ") + file.name + " ...";
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      if (!wb.SheetNames.includes('Workload-Register')) {
        showError(tr('Blatt "Workload-Register" nicht gefunden. Bitte eine Datei auf Basis von DR_Workload_Classification_Tool.xlsx hochladen.',
          'Sheet "Workload-Register" not found. Please upload a file based on DR_Workload_Classification_Tool.xlsx.'));
        resetLabel();
        return;
      }
      const sheet = wb.Sheets['Workload-Register'];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const items = parseWorkloadRows(rows);
      if (items.length === 0) {
        showError(tr('Keine bewerteten Workloads gefunden (Spalte "Schutzklasse" ist überall leer). Bitte die Bewertungskriterien im Workload-Register ausfüllen.',
          'No rated workloads found (the "Schutzklasse" column is empty everywhere). Please fill in the assessment criteria in the workload register.'));
        resetLabel();
        return;
      }
      dropLabel.textContent = "✅ " + file.name + " (" + items.length + " Workloads)";
      lastUploadAt = Date.now();
      renderAll(items);
      setViewSourceNote(tr('Datenquelle: hochgeladene Datei "', 'Data source: uploaded file "') + file.name +
        tr('". Änderungen in Tab ① werden beim nächsten Tab-Wechsel wieder automatisch übernommen.', '". Changes in tab ① will be synced automatically again on the next tab switch.'));
    } catch (err) {
      showError(tr('Fehler beim Lesen der Datei: ', 'Error reading the file: ') + err.message);
      resetLabel();
    }
  };
  reader.readAsArrayBuffer(file);
}

// Fixed column layout matching DR_Workload_Klassifizierungstool.xlsx "Workload-Register" sheet
// 0:#  1:Name  2:Owner  3:Beschreibung  4:Foundational  5:BI  6:Reg  7:DS  8:RK  9:Score
// 10:Schutzklasse 11:RPO 12:RTO 13:Konfig 14:IstRPO 15:IstRTO 16:Gap 17:Deps
function parseWorkloadRows(rows) {
  const items = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const name = (row[1] || "").toString().trim();
    // Manually overridden classes are exported as a fixed value with the suffix "[manuell überschrieben]".
    // Strip that suffix here, otherwise the row fails the tier-name match on re-import and the workload
    // "disappears".
    const clsRaw = (row[10] || "").toString().trim();
    const isManualImport = clsRaw.includes("[manuell überschrieben]");
    const cls = clsRaw.replace(/\s*\[manuell überschrieben\]\s*$/, "").trim();
    if (!name || !cls || (!TIER_RANK.hasOwnProperty(cls) && cls !== OUT_OF_SCOPE_CLASS)) continue;
    // The ID must be a positive integer (an Excel cell is untrusted input); otherwise use the row number
    const idRaw = parseInt(row[0], 10);
    const id = idRaw > 0 ? idRaw : r;
    const depsRaw = (row[17] || "").toString().trim();
    const deps = depsRaw ? depsRaw.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)) : [];
    // Accept Ja/Yes and Nein/No (English tool variant); internally it stays 'Ja'/'Nein'
    const foundationalRaw = (row[4] || "").toString().trim().toLowerCase();
    items.push({
      id: id, name: name, owner: row[2] || "", desc: row[3] || "",
      foundational: (foundationalRaw === "ja" || foundationalRaw === "yes") ? "Ja" : (row[4] || ""),
      bi: row[5], reg: row[6], ds: row[7], rk: row[8],
      score: row[9], cls: cls, manualOverride: isManualImport,
      rpo: row[11] || "", rto: row[12] || "", config: row[13] || "",
      // 0 is valid (CDP), so no "|| ''" for the actual values
      istRpo: (row[14] === null || row[14] === undefined) ? "" : row[14],
      istRto: (row[15] === null || row[15] === undefined) ? "" : row[15],
      gap: row[16] || "", deps: deps,
      // New optional columns (S+): old files do not have them, then defaults apply
      responsible: row[18] || "", responsibleEmail: row[19] || "",
      dependsOnFoundation: !["nein", "no"].includes((row[20] || "").toString().trim().toLowerCase())
    });
  }
  return items;
}
