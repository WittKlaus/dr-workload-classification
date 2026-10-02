// ================================================================================================
// BLOCK 10 · Tab 1 import: file/paste/manual entry, sheet and header detection, column mapping, row classification
// ------------------------------------------------------------------------------------------------
// Depends : Blocks 4, 11 (renderCollectTable, autoSaveProgress), SheetJS.
// Provides: TARGET_FIELDS (mapping keywords, order = priority), guessColumn(), pickBestSheet(), guessHeaderRow(),
//           classifyImportRows() (pure: templates/SRM/system VMs, structural rows, section inheritance, replicas),
//           applyMappingFromUI(), commitImport() (duplicate dialog), suggestFoundationalCandidates()
// Note    : classifyImportRows() has no DOM access and is covered by headless tests against the example files.
// ================================================================================================
// ================= Tab 2: Neue Erhebung (RVTools/vCenter Import) =================

const collectState = { items: [], nextId: 1 };
let rawWorkbook = null;
let rawSheetRows = null; // {headers:[...], rows:[[...],...]}

const TARGET_FIELDS = [
  { key: 'name', label: 'Workload-Name', required: true,
    keywords: ['vm', 'workload', 'hostname', 'servername', 'name', 'system', 'displayname'] },
  { key: 'type', label: 'Typ (VM/Physical/DB/SaaS/Cloud)', required: false,
    // 'template'/'powerstate' are deliberately NOT keywords: they are status/boolean fields (true/false,
    // poweredOn/poweredOff), not a type/category name, and would only fill "Type" with confusing values.
    // A bare 'type' is deliberately NOT a keyword either: as a substring it would wrongly match unrelated
    // columns such as "VI SDK Server type". Only allow more specific terms.
    // For pure RVTools exports (which have no real type column) "Type" therefore stays empty on purpose
    // instead of being filled with wrong values.
    keywords: ['kategorie', 'category', 'vm type', 'workload type', 'asset type', 'resource type', 'system type', 'class'] },
  { key: 'os', label: 'Betriebssystem', required: false,
    keywords: ['os according to the configuration file', 'os according to the vmware tools', 'guest os', 'operating system', 'betriebssystem', ' os '] },
  { key: 'location', label: 'Standort/Cluster', required: false,
    // Order = priority: cluster/datacenter are more meaningful for the location than "Resource pool"
    // (often just a vCenter organizational container, e.g. "/DC/Cluster/Resources").
    keywords: ['cluster', 'datacenter', 'standort', 'site', 'location', 'host', 'resource pool', 'folder'] },
  { key: 'size', label: 'Größe (GiB) — Einheit wird am Spaltennamen erkannt', required: false,
    // Order = priority: "Total disk capacity" (configured/allocated disk size) is more meaningful for
    // backup/DR capacity planning than "In Use" (only the data currently used; underestimates the real
    // protection footprint of thick-provisioned disks).
    // Order = priority: allocated/provisioned size BEFORE "used" (underestimates the protection
    // footprint) and BEFORE the generic 'gb' (which would otherwise match e.g. "Memory (GB)")
    keywords: ['total disk capacity mib', 'provisioned mib', 'in use mib', 'provisioned', 'allocated', 'used storage', 'storage', 'size', 'capacity', 'größe', 'gib', 'gb'] },
  { key: 'team', label: 'Team / Owner', required: false,
    keywords: ['owner', 'team', 'department', 'business service', 'support group', 'annotation', 'notes'] },
  { key: 'responsible', label: 'Verantwortlicher (Person)', required: false,
    keywords: ['verantwortlich', 'responsible', 'assigned to', 'contact person', 'ansprechpartner', 'contact'] },
  { key: 'responsibleEmail', label: 'Verantwortlicher E-Mail', required: false,
    keywords: ['e-mail', 'email', 'mail'] },
  { key: 'note', label: 'Quelle / Notiz', required: false, keywords: ['note', 'notiz', 'comment', 'remark'] }
];

// Priority = order in the keywords array (not the column position in the source file!). For each
// keyword ALL columns are checked (exact > substring > reverse substring); the first keyword with a
// hit wins. This makes the mapping independent of the column order an export happens to be
// delivered in (e.g. different per RVTools version).
function guessColumn(headers, keywords) {
  for (const kw of keywords) {
    let exactIdx = -1, subIdx = -1, revIdx = -1;
    headers.forEach((h, i) => {
      const hl = (h || '').toString().toLowerCase().trim();
      if (!hl) return;
      if (exactIdx === -1 && hl === kw) exactIdx = i;
      else if (subIdx === -1 && hl.includes(kw)) subIdx = i;
      else if (revIdx === -1 && kw.includes(hl) && hl.length > 2) revIdx = i;
    });
    if (exactIdx !== -1) return exactIdx;
    if (subIdx !== -1) return subIdx;
    if (revIdx !== -1) return revIdx;
  }
  return -1;
}

// ---- import mode toggle: file upload vs. paste ----
const btnModeFile = document.getElementById('btn-import-mode-file');
const btnModePaste = document.getElementById('btn-import-mode-paste');
const panelModeFile = document.getElementById('import-mode-file');
const panelModePaste = document.getElementById('import-mode-paste');
btnModeFile.addEventListener('click', () => {
  btnModeFile.classList.add('is-active'); btnModePaste.classList.remove('is-active');
  panelModeFile.classList.remove('hidden'); panelModePaste.classList.add('hidden');
  // Opens the file dialog directly, same behaviour as a click on the drop zone.
  // Reset the value so that re-selecting the same file fires a change event as well.
  rawFileInput.value = '';
  rawFileInput.click();
});
btnModePaste.addEventListener('click', () => {
  btnModePaste.classList.add('is-active'); btnModeFile.classList.remove('is-active');
  panelModePaste.classList.remove('hidden'); panelModeFile.classList.add('hidden');
});

document.getElementById('btn-parse-paste').addEventListener('click', () => {
  const text = document.getElementById('paste-textarea').value;
  if (!text.trim()) { alert(tr('Bitte zuerst Daten einfügen.', 'Please paste data first.')); return; }
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) { alert(tr('Mindestens eine Kopfzeile plus eine Datenzeile wird benötigt.', 'At least one header row plus one data row is required.')); return; }
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const parsedLines = lines.map(l => l.split(delim).map(c => c.trim()));
  rawImportSource = 'Pasted text';
  rawAllRows = parsedLines;
  sheetPickerWrap.classList.add('hidden');
  applyHeaderRow(guessHeaderRow(rawAllRows), true);
});

const rawDropZone = document.getElementById('raw-drop-zone');
const rawFileInput = document.getElementById('raw-file-input');
const rawDropLabel = document.getElementById('raw-drop-label');
const sheetPickerWrap = document.getElementById('sheet-picker-wrap');
const sheetPicker = document.getElementById('sheet-picker');
const mappingCard = document.getElementById('mapping-card');
const mappingFieldsBox = document.getElementById('mapping-fields');
const mappingCountNote = document.getElementById('mapping-count-note');

rawDropZone.addEventListener('click', (e) => { if (e.target === rawFileInput) return; rawFileInput.value = ''; rawFileInput.click(); });
rawDropZone.addEventListener('dragover', (e) => { e.preventDefault(); rawDropZone.classList.add('dragover'); });
rawDropZone.addEventListener('dragleave', () => rawDropZone.classList.remove('dragover'));
rawDropZone.addEventListener('drop', (e) => { e.preventDefault(); rawDropZone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleRawFile(e.dataTransfer.files[0]); });
rawFileInput.addEventListener('change', (e) => { if (e.target.files.length) handleRawFile(e.target.files[0]); });

let rawImportSource = ''; // Quelle des aktuellen Imports (Dateiname bzw. "Pasted text") — wandert in item.source

function handleRawFile(file) {
  rawDropLabel.textContent = tr("⏳ Verarbeite ", "⏳ Processing ") + file.name + " ...";
  rawImportSource = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      // Encoding sniff for CSV: UTF-8 with BOM -> clear; without BOM try strict UTF-8 first (otherwise
      // SheetJS mangles umlauts as cp1252); if that fails it is real cp1252 -> binary path.
      if (/\.csv$/i.test(file.name)) {
        let text = null;
        if (data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
          text = new TextDecoder('utf-8').decode(data.subarray(3));
        } else {
          try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); } catch (err) { text = null; }
        }
        rawWorkbook = text !== null ? XLSX.read(text, { type: 'string' }) : XLSX.read(data, { type: 'array' });
      } else {
        rawWorkbook = XLSX.read(data, { type: 'array' });
      }
      rawDropLabel.textContent = "✅ " + file.name;
      // (the file name is language-neutral; no tr needed)
      const sheetNames = rawWorkbook.SheetNames;
      const preferred = pickBestSheet(rawWorkbook);
      if (sheetNames.length > 1) {
        sheetPickerWrap.classList.remove('hidden');
        sheetPicker.innerHTML = sheetNames.map(n => '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>').join('');
        sheetPicker.value = preferred;
        sheetPicker.onchange = () => loadRawSheet(sheetPicker.value);
      } else {
        sheetPickerWrap.classList.add('hidden');
      }
      loadRawSheet(preferred);
    } catch (err) {
      rawDropLabel.textContent = tr("❌ Fehler: ", "❌ Error: ") + err.message;
    }
  };
  reader.readAsArrayBuffer(file);
}

// Sheet-picking heuristic (v0.12.0): report exports (e.g. Veeam ONE "VMs Configuration") often have
// a cover sheet before the data sheet. RVTools -> "vInfo"; otherwise the sheet with the most mappable
// fields wins (tiebreak: most data rows). With very many sheets (e.g. Veeam ONE "Inventory" with
// 40 property sheets) nothing is scanned; the user chooses manually.
function pickBestSheet(wb) {
  const names = wb.SheetNames;
  const vinfo = names.find(n => /vinfo/i.test(n));
  if (vinfo) return vinfo;
  if (names.length === 1 || names.length > 12) return names[0];
  let best = names[0], bestScore = -1;
  names.forEach(n => {
    try {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
      if (rows.length < 2) return;
      const hr = guessHeaderRow(rows);
      const headers = (rows[hr] || []).map(h => (h || '').toString());
      let mapped = 0;
      TARGET_FIELDS.forEach(t => { if (guessColumn(headers, t.keywords) >= 0) mapped++; });
      const score = mapped * 1000000 + Math.min(rows.length - hr - 1, 999999);
      if (score > bestScore) { bestScore = score; best = n; }
    } catch (e) { /* skip sheet */ }
  });
  return best;
}

// Header-row detection (v0.12.0): report exports (e.g. Veeam ONE "VMs Configuration") have title
// blocks ABOVE the table, so the header is not row 1. Heuristic: the first row with >= 4 non-empty,
// unique cells that is followed by at least one data row.
// Can be corrected manually via the "Header row is row" picker in the mapping step.
let rawAllRows = [];
function guessHeaderRow(rows) {
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] || []).map(v => (v || '').toString().trim()).filter(Boolean);
    const uniq = new Set(cells.map(c => c.toLowerCase()));
    if (cells.length >= 4 && uniq.size === cells.length && i + 1 < rows.length && (rows[i + 1] || []).some(v => v !== '')) return i;
  }
  return 0;
}
function applyHeaderRow(idx, auto) {
  const headers = (rawAllRows[idx] || []).map(h => (h || '').toString());
  const dataRows = rawAllRows.slice(idx + 1).filter(r => r.some(v => v !== ""));
  rawSheetRows = { headers: headers, rows: dataRows };
  const picker = document.getElementById('header-row-picker');
  const preview = i => ((rawAllRows[i] || []).slice(0, 4).map(v => (v || '').toString().trim()).filter(Boolean).join(' | ') || '—').slice(0, 60);
  picker.innerHTML = Array.from({ length: Math.min(rawAllRows.length, 15) }, (_, i) =>
    '<option value="' + i + '"' + (i === idx ? ' selected' : '') + '>' + (i + 1) + ': ' + escapeHtml(preview(i)) + '</option>').join('');
  document.getElementById('header-row-note').textContent = auto && idx > 0
    ? tr('Titelblock erkannt — Kopfzeile automatisch auf Zeile ' + (idx + 1) + ' gesetzt.', 'Title block detected — header row set to row ' + (idx + 1) + ' automatically.')
    : '';
  renderMappingUI();
}
function loadRawSheet(sheetName) {
  const sheet = rawWorkbook.Sheets[sheetName];
  rawAllRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  applyHeaderRow(guessHeaderRow(rawAllRows), true);
}
document.getElementById('header-row-picker').addEventListener('change', (e) => {
  applyHeaderRow(parseInt(e.target.value, 10), false);
});

function renderMappingUI() {
  mappingCard.classList.remove('hidden');
  const headers = rawSheetRows.headers;
  const optionsHtml = '<option value="-1">— nicht zuordnen —</option>' +
    headers.map((h, i) => '<option value="' + i + '">' + escapeHtml(h || ('Spalte ' + (i + 1))) + '</option>').join('');
  mappingFieldsBox.innerHTML = TARGET_FIELDS.map(f => {
    return '<div class="mapping-field' + (f.required ? ' required' : '') + '"><label>' + escapeHtml(f.label) + '</label>' +
      '<select data-field="' + f.key + '">' + optionsHtml + '</select></div>';
  }).join('');
  // apply guesses after building DOM (need value set programmatically since options built with plain string)
  TARGET_FIELDS.forEach(f => {
    const guess = guessColumn(headers, f.keywords);
    const sel = mappingFieldsBox.querySelector('select[data-field="' + f.key + '"]');
    sel.value = guess >= 0 ? guess : -1;
  });
  mappingCountNote.textContent = rawSheetRows.rows.length + tr(' Zeilen im gewählten Arbeitsblatt gefunden.', ' rows found in the selected worksheet.');
  if (typeof i18nApply === 'function') i18nApply(mappingCard);
}

// RVTools exports (vInfo) often also contain VM templates and SRM placeholder objects. These are not
// real workloads to protect and would only distort the DR classification (wrong counts, wrong
// findings). They are detected automatically by column name (independent of the field mapping above)
// and filtered out when adding; the count is shown transparently.
function findExclusionColumns(headers) {
  const norm = headers.map(h => (h || '').toString().toLowerCase().trim());
  return {
    template: norm.indexOf('template'),
    srmPlaceholder: norm.indexOf('srm placeholder')
  };
}
function isTruthyFlag(v) {
  const s = (v || '').toString().trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'ja' || s === '1' || s === 'x';
}

// Shared add logic for both buttons ("Add" and "Add + auto-prequalify").
// Multi-source (v0.12.0): an import extends the existing list; name collisions go through the
// duplicate dialog (skip / fill empty fields / add anyway). Every workload remembers its source
// (file name or "Pasted text"). The size unit is detected from the column name.
let pendingImport = null;

function detectSizeFactor(header) {
  const h = (header || '').toLowerCase();
  if (/\btib\b|\btb\b|terab/.test(h)) return 1024;      // TB/TiB -> GiB
  if (/\bmib\b|\bmb\b|megab/.test(h)) return 1 / 1024;  // MiB/MB -> GiB (RVTools case)
  return 1;                                                  // GB/GiB or unknown -> unchanged
}

// ---- Structural rows, section inheritance, replicas (v0.14.0, backlog #28) ----
// Hierarchical reports (Veeam ONE "VMs Configuration", vCenter folder exports, …) contain, next to the
// VM rows, section headers ("vCenter Server: …", "Cluster: …"), subtotals (VM COUNTER in the name
// column, all text fields empty) and a repeated header row per section. Deliberately GENERIC
// heuristics instead of a Veeam ONE parser: report columns are user-configurable, a fixed parser would
// break with every report version. Useful by-product: in these reports cluster/host appear ONLY in
// the subtotals; they are inherited as location for the VM rows below.
// Everything is a pure function (no DOM), so it is testable headless against the real reports.
const STRUCT_SECTION_RE = /^(vCenter Server|Cluster|SCVMM|Hyper-V Host|Datacenter|Folder|Resource Pool)\s*:/i;
const REPLICA_NAME_RE = /_replica(_\d+)?$/i; // Veeam default suffix for replicas (also "_replica_001")
// vSphere system VMs named by vCenter itself: vCLS (cluster services, "vCLS-<uuid>" or "vCLS (1)"), Supervisor control plane
// VMs of vSphere with Tanzu (current and legacy name). Never workloads to protect — excluded with templates/SRM placeholders.
const SYSTEM_VM_RE = /^(vCLS[\s(-]|SupervisorControlPlaneVM|stCtlVM)/i;
function classifyImportRows(rows, headers, mapping, opts) {
  const skip = { template: 0, system: 0, header: 0, subtotal: 0, section: 0, replica: 0 };
  let inherited = 0;
  const parsed = [];
  const cellStr = (row, i) => (i >= 0 && row[i] !== null && row[i] !== undefined) ? String(row[i]).trim() : '';
  const nameHeader = String(headers[mapping.name] || '').trim().toLowerCase();
  // Text fields other than location: all empty in subtotals (the location column holds the host name there)
  const subtotalKeys = ['type', 'os', 'team', 'responsible', 'responsibleEmail', 'note'].filter(k => mapping[k] >= 0);
  let curCluster = '', curHost = '';
  rows.forEach(row => {
    if (opts.exclTemplates && opts.excl.template >= 0 && isTruthyFlag(row[opts.excl.template])) { skip.template++; return; }
    if (opts.exclTemplates && opts.excl.srmPlaceholder >= 0 && isTruthyFlag(row[opts.excl.srmPlaceholder])) { skip.template++; return; }
    const name = cellStr(row, mapping.name);
    if (opts.exclTemplates && name && SYSTEM_VM_RE.test(name)) { skip.system++; return; }
    const locRaw = cellStr(row, mapping.location);
    if (opts.exclStructural) {
      // (1) section header: any cell starts with "vCenter Server:" / "Cluster:" / …
      let section = null;
      for (let k = 0; k < row.length; k++) {
        const v = row[k];
        if (typeof v === 'string' && v.length < 160) {
          const m = STRUCT_SECTION_RE.exec(v.trim());
          if (m) { section = { key: m[1].toLowerCase(), rest: v.trim().slice(m[0].length).trim(), idx: k }; break; }
        }
      }
      if (section) {
        // The value is in the same cell ("Cluster: Demo") or in the next non-numeric one (Hyper-V report)
        let val = section.rest;
        if (!val) for (let k = section.idx + 1; k < row.length; k++) { const v = cellStr(row, k); if (v && !/^\d+([.,]\d+)?$/.test(v)) { val = v; break; } }
        if (section.key === 'cluster') { curCluster = val; curHost = ''; }
        else if (/vcenter|scvmm/.test(section.key)) { curCluster = ''; curHost = ''; } // neuer Server-Abschnitt
        skip.section++; return;
      }
      // (2) repeated header row: the name cell carries the column title itself
      if (name && nameHeader && name.toLowerCase() === nameHeader) { skip.header++; return; }
      // (3) subtotal: name purely numeric (VM counter), all other mapped text fields empty
      if (name && /^\d+$/.test(name) && subtotalKeys.length && subtotalKeys.every(k => !cellStr(row, mapping[k]))) {
        if (locRaw) curHost = locRaw; // host subtotal: host name in the location column
        skip.subtotal++; return;
      }
      // (4) row without a name but with location/host: section header (Hyper-V report: host rows)
      if (!name && locRaw) { curHost = locRaw; return; }
    }
    if (!name) return;
    if (opts.exclReplicas && REPLICA_NAME_RE.test(name)) { skip.replica++; return; }
    const val = k => cellStr(row, mapping[k]);
    let sizeGiB = '';
    if (mapping.size >= 0) {
      const rawNum = parseFloat(cellStr(row, mapping.size).replace(',', '.'));
      if (!isNaN(rawNum)) sizeGiB = Math.round(rawNum * opts.sizeFactor * 10) / 10;
    }
    let location = val('location');
    if (!location && opts.exclStructural && (curCluster || curHost)) { location = [curCluster, curHost].filter(Boolean).join(' / '); inherited++; }
    parsed.push({ name: name, type: val('type'), os: val('os'), location: location, team: val('team'),
      responsible: val('responsible'), responsibleEmail: val('responsibleEmail'), note: val('note'), sizeGiB: sizeGiB });
  });
  return { parsed: parsed, skip: skip, inherited: inherited };
}
// Report fingerprint: only a HINT in the summary, controls no logic
function detectReportFingerprint() {
  const chunks = [];
  try {
    if (rawWorkbook && rawWorkbook.SheetNames.length) {
      const cover = XLSX.utils.sheet_to_json(rawWorkbook.Sheets[rawWorkbook.SheetNames[0]], { header: 1, defval: '' }).slice(0, 15);
      cover.forEach(r => chunks.push(r.join(' ')));
    }
  } catch (e) { /* non-fatal */ }
  (rawAllRows || []).slice(0, 8).forEach(r => chunks.push((r || []).join(' ')));
  const head = chunks.join(' ');
  if (/veeam one|vms configuration/i.test(head)) return 'Veeam ONE';
  return '';
}
let lastImportStructInfo = null;
function importStructNoteText() {
  const i = lastImportStructInfo;
  if (!i) return '';
  const s = i.skip, structural = s.header + s.subtotal + s.section;
  let t = '';
  if (s.system) t += s.system + tr(' vSphere-System-VM(s) ausgeschlossen (vCLS/Supervisor). ', ' vSphere system VM(s) excluded (vCLS/Supervisor). ');
  if (i.fingerprint) t += tr(i.fingerprint + '-Report erkannt. ', i.fingerprint + ' report detected. ');
  if (structural) t += structural + tr(' Struktur-Zeile(n) übersprungen (' + s.header + ' Kopfzeilen, ' + s.subtotal + ' Zwischensummen, ' + s.section + ' Abschnittsköpfe). ',
    ' structural row(s) skipped (' + s.header + ' header repeats, ' + s.subtotal + ' subtotals, ' + s.section + ' section headers). ');
  if (s.replica) t += s.replica + tr(' Replica(s) ausgeschlossen. ', ' replica(s) excluded. ');
  if (i.inherited) t += i.inherited + tr(' Standort(e) aus Cluster-/Host-Abschnitten übernommen. ', ' location(s) inherited from cluster/host sections. ');
  return t;
}

function applyMappingFromUI(openWizardAfter) {
  const mapping = {};
  TARGET_FIELDS.forEach(f => {
    const sel = mappingFieldsBox.querySelector('select[data-field="' + f.key + '"]');
    mapping[f.key] = parseInt(sel.value, 10);
  });
  if (mapping.name < 0) { alert(tr('Bitte mindestens die Spalte "Workload-Name" zuordnen.', 'Please map at least the "Workload name" column.')); return false; }

  const excl = findExclusionColumns(rawSheetRows.headers);
  const exclEnabled = document.getElementById('excl-templates').checked;
  const sizeFactor = mapping.size >= 0 ? detectSizeFactor(rawSheetRows.headers[mapping.size]) : 1;
  const src = rawImportSource || 'Import';
  const classified = classifyImportRows(rawSheetRows.rows, rawSheetRows.headers, mapping, {
    exclTemplates: exclEnabled, excl: excl,
    exclStructural: document.getElementById('excl-structural').checked,
    exclReplicas: document.getElementById('excl-replicas').checked,
    sizeFactor: sizeFactor
  });
  const parsed = classified.parsed;
  const skippedTemplates = classified.skip.template;
  lastImportStructInfo = { skip: classified.skip, inherited: classified.inherited, fingerprint: detectReportFingerprint() };

  const existing = new Map(collectState.items.map(it => [it.name.toLowerCase(), it]));
  const dupes = parsed.filter(pp => existing.has(pp.name.toLowerCase()));
  if (dupes.length) {
    pendingImport = { parsed: parsed, skippedTemplates: skippedTemplates, source: src, openWizard: !!openWizardAfter, sizeFactor: sizeFactor };
    document.getElementById('dup-dialog-text').innerHTML = '⚠ <strong>' + dupes.length + '</strong>' +
      tr(' von ', ' of ') + parsed.length + tr(' importierten Namen existieren bereits in der Liste (z. B. „', ' imported names already exist in the list (e.g. "') +
      escapeHtml(dupes[0].name) + tr('"). Wie sollen die Duplikate behandelt werden?', '"). How should the duplicates be handled?');
    document.getElementById('dup-dialog').classList.remove('hidden');
    return false;
  }
  commitImport(parsed, 'skip', skippedTemplates, src, sizeFactor);
  if (openWizardAfter && typeof prequalOpenWizard === 'function') prequalOpenWizard();
  return true;
}

function commitImport(parsed, strategy, skippedTemplates, src, sizeFactor) {
  const existing = new Map(collectState.items.map(it => [it.name.toLowerCase(), it]));
  let added = 0, mergedCount = 0, skippedDupes = 0;
  parsed.forEach(pp => {
    const hit = existing.get(pp.name.toLowerCase());
    if (hit) {
      if (strategy === 'skip') { skippedDupes++; return; }
      if (strategy === 'fill') {
        // Fill EMPTY fields of the existing row only; ratings are never touched
        let touched = false;
        if (!hit.owner && pp.team) { hit.owner = pp.team; touched = true; }
        ['type', 'os', 'location', 'note', 'responsible', 'responsibleEmail'].forEach(f => {
          if (!hit[f] && pp[f]) { hit[f] = pp[f]; touched = true; }
        });
        if ((hit.sizeGiB === '' || hit.sizeGiB === undefined) && pp.sizeGiB !== '') { hit.sizeGiB = pp.sizeGiB; touched = true; }
        if (touched) hit.source = (hit.source ? hit.source + ' + ' : '') + src;
        mergedCount++;
        return;
      }
      // strategy 'add': deliberately create in addition (the user was warned about duplicate names)
    }
    collectState.items.push({
      id: collectState.nextId++, name: pp.name, owner: pp.team || '', type: pp.type, os: pp.os, location: pp.location,
      sizeGiB: pp.sizeGiB, note: pp.note, responsible: pp.responsible, responsibleEmail: pp.responsibleEmail,
      foundational: 'Nein', bi: '', reg: '', ds: '', rk: '', clsOverride: '', validated: false, outOfScope: false,
      dependsOnFoundation: true, istRpo: '', istRto: '', gap: '', depsText: '', source: src
    });
    added++;
  });
  document.getElementById('collect-toolbar-card').classList.remove('hidden');
  document.getElementById('validation-card').classList.remove('hidden');
  renderCollectTable();
  autoSaveProgress();
  mappingCountNote.textContent = added + tr(' Workload(s) übernommen', ' workload(s) added') +
    (mergedCount ? ', ' + mergedCount + tr(' vorhandene ergänzt', ' existing updated') : '') +
    (skippedDupes ? ', ' + skippedDupes + tr(' Duplikat(e) übersprungen', ' duplicate(s) skipped') : '') + '. ' +
    skippedTemplates + tr(' Template(s)/SRM-Placeholder ausgeschlossen. ', ' template(s)/SRM placeholders excluded. ') +
    importStructNoteText() +
    (sizeFactor !== 1 ? tr('Größen umgerechnet: ', 'Sizes converted: ') + (sizeFactor < 1 ? 'MiB→GiB' : 'TB→GiB') + '. ' : '') +
    tr('Quelle: ', 'Source: ') + src + tr('. Insgesamt ', '. Total of ') + collectState.items.length + tr(' in der Liste unten.', ' in the list below.');
  clearTombstonesFor(parsed.map(pp => pp.name)); // re-imported names are no longer "deleted"
  suggestFoundationalCandidates();
}

document.getElementById('btn-apply-mapping').addEventListener('click', () => applyMappingFromUI(false));
document.getElementById('btn-apply-mapping-auto').addEventListener('click', () => applyMappingFromUI(true));
document.getElementById('btn-dup-continue').addEventListener('click', () => {
  if (!pendingImport) return;
  const strat = (document.querySelector('input[name="dup-strategy"]:checked') || {}).value || 'skip';
  document.getElementById('dup-dialog').classList.add('hidden');
  const pi = pendingImport; pendingImport = null;
  commitImport(pi.parsed, strat, pi.skippedTemplates, pi.source, pi.sizeFactor);
  if (pi.openWizard && typeof prequalOpenWizard === 'function') prequalOpenWizard();
});
document.getElementById('btn-dup-cancel').addEventListener('click', () => {
  pendingImport = null;
  document.getElementById('dup-dialog').classList.add('hidden');
  mappingCountNote.textContent = tr('Import abgebrochen — nichts übernommen.', 'Import cancelled — nothing added.');
});

// Propose foundational candidates from name/annotation patterns; nothing is set unasked,
// the TAM confirms or discards the proposal with one click.
const FOUNDATIONAL_PATTERN = /(^|[^a-z0-9])(dc\d|addc|ad\d|dns\d?|pki\d?|ntp\d?|domain.?controller|active.?directory|dhcp)/i;
function suggestFoundationalCandidates() {
  const banner = document.getElementById('foundational-suggest');
  const candidates = collectState.items.filter(it =>
    it.foundational !== 'Ja' && !it.outOfScope &&
    (FOUNDATIONAL_PATTERN.test(it.name) || FOUNDATIONAL_PATTERN.test(it.note || '') || FOUNDATIONAL_PATTERN.test(it.owner || '')));
  if (!candidates.length) { banner.classList.add('hidden'); return; }
  document.getElementById('foundational-suggest-text').textContent =
    candidates.length + tr(' mögliche(r) Foundational-Kandidat(en) erkannt (AD/DNS/DC/PKI/NTP-Muster): ', ' possible foundational candidate(s) detected (AD/DNS/DC/PKI/NTP pattern): ') +
    candidates.slice(0, 15).map(it => it.name).join(', ') + (candidates.length > 15 ? ' …' : '');
  banner.classList.remove('hidden');
  document.getElementById('btn-foundational-accept').onclick = () => {
    candidates.forEach(it => it.foundational = 'Ja');
    banner.classList.add('hidden');
    renderCollectTable();
    autoSaveProgress();
  };
  document.getElementById('btn-foundational-dismiss').onclick = () => banner.classList.add('hidden');
}
