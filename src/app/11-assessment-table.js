// ================================================================================================
// BLOCK 11 · Tab 1 assessment table: filters, column chooser, pagination, editing, bulk edit, delete
// ------------------------------------------------------------------------------------------------
// Depends : Blocks 4, 10, 12 (autoSaveProgress), 13 (export button), 18 (prequal badge).
// Provides: buildNameIndex()/resolveDepsText()/normalizeDepsText() (dependency resolution), renderCollectTable() (main render),
//           event delegation on #collect-table (input/change/blur/click), COLLECT_COLUMNS (column chooser),
//           bulk edit incl. applyBulkDeps() (v0.16.0, #27), removeItemsFromState()/deleteItems()/undoLastDelete()
// Note    : Adding a table column means updating the nth-child indexes in COLLECT_COLUMNS and the sticky CSS.
// ================================================================================================
// ---------------- Tab 2: editable classification table ----------------

// Name index (Map, O(1) lookup): makes dependency resolution linear instead of quadratic.
// Hot callers (table render, reverse deps, exports) build the index ONCE and pass it through;
// single calls (blur handler etc.) omit the parameter and get a fresh index.
function buildNameIndex() {
  const m = new Map();
  collectState.items.forEach(it => {
    const k = (it.name || '').trim().toLowerCase();
    if (k && !m.has(k)) m.set(k, it);
  });
  return m;
}

function resolveDepsText(depsText, excludeId, nameIndex) {
  if (!depsText) return { ids: [], unresolved: [] };
  const idx = nameIndex || buildNameIndex();
  const names = depsText.split(',').map(s => s.trim()).filter(Boolean);
  const ids = [], unresolved = [];
  names.forEach(n => {
    const match = idx.get(n.toLowerCase());
    if (match && match.id !== excludeId) ids.push(match.id); else unresolved.push(n);
  });
  return { ids, unresolved };
}

// Normalizes a "depends on" text the way the table does on blur: plain numeric IDs become names, names get
// their canonical spelling; a reference to selfId (or an unknown token) is kept as typed and reported as
// unresolved. Shared by the table (block 11 blur handler) and the bulk edit (v0.16.0, #27).
function normalizeDepsText(text, selfId, idx, byId) {
  idx = idx || buildNameIndex();
  byId = byId || new Map(collectState.items.map(it => [it.id, it]));
  const segments = (text || '').split(',').map(s => s.trim()).filter(Boolean);
  const unresolved = [];
  const normalized = segments.map(seg => {
    const asId = parseInt(seg, 10);
    if (String(asId) === seg) {
      const match = byId.get(asId);
      if (match && match.id !== selfId) return match.name;
    }
    const byName = idx.get(seg.toLowerCase());
    if (byName && byName.id !== selfId) return byName.name;
    unresolved.push(seg);
    return seg;
  });
  return { text: normalized.join(', '), unresolved: unresolved };
}
// Bulk "depends on" (v0.16.0, #27): add / replace / remove already-normalized names on one item. Pure (testable).
// A target equal to the item itself is skipped; comparison is case-insensitive; the existing text is normalized first.
function applyBulkDeps(it, targets, mode) {
  const own = (it.name || '').trim().toLowerCase();
  const tg = targets.filter(n => n.toLowerCase() !== own);
  const cur = normalizeDepsText(it.depsText, it.id).text.split(',').map(s => s.trim()).filter(Boolean);
  const tgSet = new Set(tg.map(n => n.toLowerCase()));
  let next;
  if (mode === 'replace') next = tg;
  else if (mode === 'remove') next = cur.filter(n => !tgSet.has(n.toLowerCase()));
  else { const have = new Set(cur.map(n => n.toLowerCase())); next = cur.concat(tg.filter(n => !have.has(n.toLowerCase()))); }
  return next.join(', ');
}

let lastDatalistSig = null;
function updateWorkloadNamesDatalist() {
  // Rebuild only when names actually changed (5000 <option> elements are expensive)
  const sig = collectState.items.length + '\x00' + collectState.items.map(it => it.name).join('\x00');
  if (sig === lastDatalistSig) return;
  lastDatalistSig = sig;
  const dl = document.getElementById('workload-names-datalist');
  dl.innerHTML = collectState.items.map(it => '<option value="' + escapeHtml(it.name) + '">').join('');
}

// Recomputes "required by" for every item, based on the current depsText resolution.
function computeReverseDeps() {
  const reverse = {};
  const idx = buildNameIndex(); // one index for all rows instead of n² individual lookups
  collectState.items.forEach(it => reverse[it.id] = []);
  collectState.items.forEach(it => {
    const resolved = resolveDepsText(it.depsText, it.id, idx);
    resolved.ids.forEach(depId => { if (reverse[depId]) reverse[depId].push(it.name); });
  });
  return reverse;
}

function refreshReverseDepsColumn() {
  const reverse = computeReverseDeps();
  document.querySelectorAll('#collect-table [data-role="reverse-deps"]').forEach(cell => {
    const id = parseInt(cell.closest('tr').getAttribute('data-id'), 10);
    const names = reverse[id] || [];
    cell.textContent = names.length ? names.join(', ') : '–';
  });
}

// ---- selection (bulk edit) + filters (search / tier / unvalidated / Spaltenfilter) + Sortierung ----
const selectedIds = new Set();
let collectActiveTiers = new Set([...TIER_ORDER, OUT_OF_SCOPE_CLASS, '__unrated__']);
let collectSort = { key: '', dir: 1 };           // sorting works on whole item objects, so rows always stay intact
// Pagination: only the DISPLAY is paged. Filter, search, sorting, bulk selection and
// "select all" always operate on the WHOLE filtered set.
let collectPage = 0;
let collectPageSize = 250;        // 'all' = everything on one page (e.g. for printing)
let lastFilteredItems = [];       // filtered+sorted total of the last render (for selection sync)
const COL_FILTER_DEFS = [
  { key: 'type', label: 'Typ' }, { key: 'os', label: 'OS' }, { key: 'location', label: 'Standort/Cluster' },
  { key: 'owner', label: 'Team / Owner' }, { key: 'responsible', label: 'Verantwortlicher' }
];
let colFilters = { type: '', os: '', location: '', owner: '', responsible: '' }; // '' = all, '__empty__' = (empty)

function collectFilterPredicate(it) {
  const cls = effectiveClass(it);
  const tierKey = cls || '__unrated__';
  if (!collectActiveTiers.has(tierKey)) return false;
  if (document.getElementById('toggle-unvalidated-only').checked && it.validated) return false;
  for (const f of COL_FILTER_DEFS) {
    const sel = colFilters[f.key];
    if (!sel) continue;
    const val = (it[f.key] || '').toString().trim();
    if (sel === '__empty__') { if (val !== '') return false; }
    else if (val !== sel) return false;
  }
  const term = document.getElementById('collect-search').value.trim().toLowerCase();
  if (term) {
    const hay = [it.name, it.owner, it.responsible, it.responsibleEmail, it.type, it.os, it.location, it.note].map(v => (v || '').toString().toLowerCase()).join(' ');
    if (!hay.includes(term)) return false;
  }
  return true;
}

function renderColumnFilters() {
  const box = document.getElementById('collect-col-filters');
  box.innerHTML = COL_FILTER_DEFS.map(f => {
    const values = [...new Set(collectState.items.map(it => (it[f.key] || '').toString().trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
    return '<label class="colfilter-label">' + escapeHtml(f.label) +
      '<select class="colfilter-select" data-colfilter="' + f.key + '">' +
      '<option value="">– alle –</option><option value="__empty__"' + (colFilters[f.key] === '__empty__' ? ' selected' : '') + '>(leer)</option>' +
      values.map(v => '<option value="' + escapeHtml(v) + '"' + (colFilters[f.key] === v ? ' selected' : '') + '>' + escapeHtml(v) + '</option>').join('') +
      '</select></label>';
  }).join('');
  box.querySelectorAll('[data-colfilter]').forEach(sel => {
    sel.addEventListener('change', (e) => {
      colFilters[e.target.getAttribute('data-colfilter')] = e.target.value;
      collectPage = 0;
      renderCollectTable();
    });
  });
}

// Sort value per column: class by rank (not alphabetically), numbers numerically, the rest as text
function collectSortValue(it, key) {
  switch (key) {
    case 'id': return it.id;
    case 'cls': {
      const c = effectiveClass(it);
      if (!c) return 99;
      return c === OUT_OF_SCOPE_CLASS ? 98 : (TIER_RANK[c] !== undefined ? TIER_RANK[c] : 97);
    }
    case 'sizeGiB': case 'bi': case 'reg': case 'ds': case 'rk': case 'istRpo': case 'istRto': {
      const v = parseFloat(it[key]); return isNaN(v) ? Infinity : v;
    }
    case 'foundational': return it.foundational === 'Ja' ? 0 : 1;
    case 'outOfScope': return it.outOfScope ? 0 : 1;
    case 'dependsOnFoundation': return it.dependsOnFoundation === false ? 1 : 0;
    case 'validated': return it.validated ? 0 : 1;
    default: return (it[key] || '').toString().toLowerCase();
  }
}
function applyCollectSort(items) {
  if (!collectSort.key) return items;
  const k = collectSort.key, d = collectSort.dir;
  return items.slice().sort((a, b) => {
    const va = collectSortValue(a, k), vb = collectSortValue(b, k);
    if (va < vb) return -1 * d;
    if (va > vb) return 1 * d;
    return a.id - b.id; // stabiler Tiebreaker
  });
}

function renderCollectTierChips() {
  const box = document.getElementById('collect-tier-chips');
  const chipDefs = TIER_ORDER.map(t => ({ key: t, label: tierLabel(t), color: tierColor(t) }))
    .concat([{ key: OUT_OF_SCOPE_CLASS, label: 'Out of Scope (kein Backup)', color: OUT_OF_SCOPE_COLOR }])
    .concat([{ key: '__unrated__', label: '– unbewertet –', color: '#ADACAF' }]);
  box.innerHTML = chipDefs.map(c =>
    '<span class="chip' + (collectActiveTiers.has(c.key) ? '' : ' is-off') + '" data-tier="' + escapeHtml(c.key) + '">' +
    '<span class="chip__dot" style="background:' + c.color + '"></span>' + escapeHtml(c.label) + '</span>'
  ).join('');
  box.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const t = chip.getAttribute('data-tier');
      if (collectActiveTiers.has(t)) { collectActiveTiers.delete(t); chip.classList.add('is-off'); }
      else { collectActiveTiers.add(t); chip.classList.remove('is-off'); }
      collectPage = 0;
      renderCollectTable();
    });
  });
}

// Filter changes jump to page 1; the search is debounced (no render per keystroke)
const debouncedSearchRender = debounce(() => { collectPage = 0; renderCollectTable(); }, 200);
document.getElementById('collect-search').addEventListener('input', debouncedSearchRender);
document.getElementById('toggle-unvalidated-only').addEventListener('change', () => { collectPage = 0; renderCollectTable(); });
document.getElementById('btn-collect-filter-reset').addEventListener('click', () => {
  document.getElementById('collect-search').value = '';
  document.getElementById('toggle-unvalidated-only').checked = false;
  collectActiveTiers = new Set([...TIER_ORDER, OUT_OF_SCOPE_CLASS, '__unrated__']);
  Object.keys(colFilters).forEach(k => colFilters[k] = '');
  collectSort = { key: '', dir: 1 };
  collectPage = 0;
  renderCollectTable();
});

// ---- Column chooser (v0.13.0) ----
// Device setting (localStorage) like dark mode, NOT part of the progress JSON, because it describes
// a way of working, not data. Implemented as nth-child CSS rules in a dedicated <style> element:
// no change to the render string, and the rules survive every rebuild.
// Columns 1–3 (select, #, name) are sticky and mandatory, 19 (protection class) is mandatory too.
const COLLECT_COLS_KEY = 'dr_collect_hidden_cols_v1';
const COLLECT_COLUMNS = [
  { n: 4, key: 'owner', de: 'Team / Owner', en: 'Team / Owner' },
  { n: 5, key: 'responsible', de: 'Verantwortlicher', en: 'Responsible' },
  { n: 6, key: 'email', de: 'E-Mail', en: 'Email' },
  { n: 7, key: 'type', de: 'Typ', en: 'Type' },
  { n: 8, key: 'os', de: 'OS', en: 'OS' },
  { n: 9, key: 'location', de: 'Standort/Cluster', en: 'Location/cluster' },
  { n: 10, key: 'size', de: 'Größe (GiB)', en: 'Size (GiB)' },
  { n: 11, key: 'note', de: 'Notiz', en: 'Note' },
  { n: 12, key: 'foundational', de: 'Foundational?', en: 'Foundational?' },
  { n: 13, key: 'oos', de: 'Out of Scope?', en: 'Out of scope?' },
  { n: 14, key: 'depfound', de: 'Abhängig von Foundation?', en: 'Depends on foundation?' },
  { n: 15, key: 'bi', de: 'BI', en: 'BI' },
  { n: 16, key: 'reg', de: 'Reg', en: 'Reg' },
  { n: 17, key: 'ds', de: 'DS', en: 'DS' },
  { n: 18, key: 'rk', de: 'RK', en: 'RK' },
  { n: 20, key: 'override', de: 'Override', en: 'Override' },
  { n: 21, key: 'validated', de: 'Vom Kunden validiert?', en: 'Validated by customer?' },
  { n: 22, key: 'istrpo', de: 'Ist-RPO (h)', en: 'Actual RPO (h)' },
  { n: 23, key: 'istrto', de: 'Ist-RTO (h)', en: 'Actual RTO (h)' },
  { n: 24, key: 'deps', de: 'Abhängig von', en: 'Depends on' },
  { n: 25, key: 'reqby', de: 'Wird benötigt von', en: 'Required by' }
];
const COLLECT_COLS_ASSESSMENT_ONLY = ['owner', 'responsible', 'email', 'type', 'os', 'location', 'size', 'note', 'istrpo', 'istrto', 'reqby'];
let collectHiddenCols = new Set();
try {
  const rawCols = localStorage.getItem(COLLECT_COLS_KEY);
  if (rawCols) JSON.parse(rawCols).forEach(k => { if (COLLECT_COLUMNS.some(c => c.key === k)) collectHiddenCols.add(k); });
} catch (e) { /* non-fatal */ }
function applyCollectColumnVisibility() {
  let style = document.getElementById('collect-col-style');
  if (!style) { style = document.createElement('style'); style.id = 'collect-col-style'; document.head.appendChild(style); }
  const sel = COLLECT_COLUMNS.filter(c => collectHiddenCols.has(c.key))
    .map(c => '#collect-table th:nth-child(' + c.n + '), #collect-table td:nth-child(' + c.n + ')').join(',\n');
  style.textContent = sel ? sel + ' { display:none; }' : '';
  const note = document.getElementById('collect-col-picker-note');
  if (note) note.textContent = collectHiddenCols.size
    ? collectHiddenCols.size + tr(' Spalte(n) ausgeblendet — Daten bleiben erhalten und werden weiterhin exportiert.', ' column(s) hidden — data is kept and still exported.')
    : '';
}
function saveCollectHiddenCols() {
  try { localStorage.setItem(COLLECT_COLS_KEY, JSON.stringify([...collectHiddenCols])); } catch (e) { /* non-fatal */ }
  applyCollectColumnVisibility();
}
function renderCollectColumnPicker() {
  const box = document.getElementById('collect-col-picker');
  if (!box) return;
  box.innerHTML = COLLECT_COLUMNS.map(c =>
    '<label class="toggle-inline"><input type="checkbox" data-col="' + c.key + '"' + (collectHiddenCols.has(c.key) ? '' : ' checked') + '> ' + escapeHtml(tr(c.de, c.en)) + '</label>').join('') +
    '<button class="btn-ghost" id="btn-cols-all">' + tr('Alle anzeigen', 'Show all') + '</button>' +
    '<button class="btn-ghost" id="btn-cols-assessment" title="' + tr('Nur Bewertung: BI/Reg/DS/RK, Foundational, Out of Scope, Override, Validiert, Abhängigkeiten', 'Assessment only: BI/Reg/DS/RK, foundational, out of scope, override, validated, dependencies') + '">' + tr('Nur Bewertung', 'Assessment only') + '</button>' +
    '<span class="graph-note" id="collect-col-picker-note"></span>';
  box.querySelectorAll('input[data-col]').forEach(cb => cb.addEventListener('change', () => {
    const k = cb.getAttribute('data-col');
    if (cb.checked) collectHiddenCols.delete(k); else collectHiddenCols.add(k);
    saveCollectHiddenCols();
  }));
  document.getElementById('btn-cols-all').addEventListener('click', () => { collectHiddenCols.clear(); saveCollectHiddenCols(); renderCollectColumnPicker(); });
  document.getElementById('btn-cols-assessment').addEventListener('click', () => { collectHiddenCols = new Set(COLLECT_COLS_ASSESSMENT_ONLY); saveCollectHiddenCols(); renderCollectColumnPicker(); });
  applyCollectColumnVisibility();
}
renderCollectColumnPicker();

function renderCollectTable() {
  updateWorkloadNamesDatalist();
  renderCollectTierChips();
  renderColumnFilters();
  refreshBulkOverrideOptions();
  const reverse = computeReverseDeps();
  const table = document.getElementById('collect-table');
  const scaleOptions = ['', 1, 2, 3, 4, 5].map(v => '<option value="' + v + '">' + (v === '' ? '–' : v) + '</option>').join('');
  const overrideOptions = ['<option value="">' + tr('– automatisch –', '– automatic –') + '</option>'].concat(
    TIER_ORDER.map(t => '<option value="' + escapeHtml(t) + '">' + escapeHtml(tierLabel(t)) + '</option>')
  ).join('');

  // sortierbarer Header: sh(label, sortKey, tooltip) — Klick sortiert auf/ab
  const sh = (label, sk, title) => '<th data-sk="' + sk + '"' + (title ? ' title="' + title + '"' : '') + '>' + label +
    (collectSort.key === sk ? '<span class="sort-ind">' + (collectSort.dir === 1 ? '▲' : '▼') + '</span>' : '') + '</th>';
  let html = '<thead><tr>' +
    '<th><input type="checkbox" id="collect-select-all" title="Alle sichtbaren auswählen / erneut klicken zum Abwählen"></th>' +
    sh('#', 'id') + sh('Name', 'name') + sh('Team / Owner', 'owner') +
    sh('Verantwortlicher', 'responsible', 'Feste Person (nicht Team) — Ansprechpartner/Eskalation für VRO-Runbooks.') +
    sh('E-Mail', 'responsibleEmail', 'E-Mail des Verantwortlichen. Ungültiges Format wird orange markiert (blockiert nichts).') +
    sh('Typ', 'type') + sh('OS', 'os') + sh('Standort/Cluster', 'location') +
    sh('Größe (GiB)', 'sizeGiB') + sh('Notiz', 'note') + sh('Foundational?', 'foundational') +
    sh('Out of Scope (kein Backup)?', 'outOfScope', 'Workload wird absichtlich NICHT gesichert/klassifiziert (z. B. anderweitig gesichert, wird stillgelegt, vertraglich ausgeschlossen). Hat Vorrang vor Override und automatischer Berechnung.') +
    sh('Abhängig von Foundation?', 'dependsOnFoundation', 'Standard: ja. Nur abhaken bei Systemen, die auch ohne AD/DNS/DC funktionieren (OT, Appliances mit lokaler Auth, isolierte Inseln). Steuert die impliziten Kanten im Abhängigkeitsnetz.') +
    sh('Business Impact (BI)', 'bi', 'Business Impact: wie stark trifft ein Ausfall das Geschäft (Umsatz, Kunden, Reputation)?') +
    sh('Regulatorik (Reg)', 'reg', 'Regulatorik: wie stark unterliegt das System regulatorischen Pflichten (DORA, NIS2, ISO 27001, PII)?') +
    sh('Datensensitivität (DS)', 'ds', 'Datensensitivität: wie sensibel sind die verarbeiteten Daten?') +
    sh('Recovery-Komplexität (RK)', 'rk', 'Recovery-Komplexität: wie aufwändig ist die technische Wiederherstellung? Fließt NICHT in die Schutzklasse ein, nur zur Aufwandseinschätzung.') +
    sh('Schutzklasse', 'cls') + '<th>Override</th>' + sh('Vom Kunden validiert?', 'validated') +
    sh('Ist-RPO (h)', 'istRpo', 'Aktueller Ist-Wert in Stunden. 0 = CDP/kontinuierlich, leer = nicht erhoben. Rot = schlechter als das Klassen-Ziel.') +
    sh('Ist-RTO (h)', 'istRto', 'Aktueller Ist-Wert in Stunden. 0 = sofort, leer = nicht erhoben. Rot = schlechter als das Klassen-Ziel.') +
    '<th title="IDs oder Namen, kommagetrennt. Beim Verlassen des Feldes werden IDs automatisch zu Namen aufgelöst.">Abhängig von (IDs oder Namen, kommagetrennt)</th>' +
    '<th title="Automatisch ermittelt: welche anderen Workloads hängen von diesem ab">Wird benötigt von</th>' +
    '</tr></thead><tbody>';

  const filtered = applyCollectSort(collectState.items.filter(collectFilterPredicate));
  lastFilteredItems = filtered;
  const nameIdx = buildNameIndex(); // one index for all rows of this render
  const pageSize = collectPageSize === 'all' ? Math.max(1, filtered.length) : collectPageSize;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (collectPage >= pageCount) collectPage = pageCount - 1;
  if (collectPage < 0) collectPage = 0;
  const visibleItems = collectPageSize === 'all' ? filtered : filtered.slice(collectPage * pageSize, (collectPage + 1) * pageSize);
  document.getElementById('bulk-selected-count').textContent = selectedIds.size;

  visibleItems.forEach(it => {
    const calculatedCls = classifyScore(computeScore(it.bi, it.reg, it.ds), it.foundational);
    const cls = it.outOfScope ? OUT_OF_SCOPE_CLASS : (it.clsOverride || calculatedCls);
    const isManual = !it.outOfScope && !!it.clsOverride && it.clsOverride !== calculatedCls;
    const revNames = reverse[it.id] || [];
    const resolvedDeps = resolveDepsText(it.depsText, it.id, nameIdx);
    const depsHasUnresolved = resolvedDeps.unresolved.length > 0;
    const gaps = gapCheck(cls, it.istRpo, it.istRto);
    const badMail = (it.responsibleEmail || '').trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(it.responsibleEmail.trim());
    html += '<tr data-id="' + it.id + '">' +
      '<td><input type="checkbox" class="collect-row-select" ' + (selectedIds.has(it.id) ? 'checked' : '') + '></td>' +
      '<td>' + it.id + '<button class="row-del" data-del="' + it.id + '" title="Zeile löschen">✕</button></td>' +
      '<td><input class="collect-input w-name" data-field="name" style="font-weight:600;" value="' + escapeHtml(it.name) + '" placeholder="Workload-Name"' + (it.source ? ' title="' + tr('Quelle: ', 'Source: ') + escapeHtml(it.source) + '"' : '') + '></td>' +
      '<td><input class="collect-input w-wide" data-field="owner" value="' + escapeHtml(it.owner) + '"></td>' +
      '<td><input class="collect-input w-med" data-field="responsible" value="' + escapeHtml(it.responsible || '') + '" placeholder="Vor- u. Nachname"></td>' +
      '<td><input class="collect-input w-med' + (badMail ? ' is-badmail' : '') + '" data-field="responsibleEmail" value="' + escapeHtml(it.responsibleEmail || '') + '" placeholder="name@firma.tld"' + (badMail ? ' title="Sieht nicht wie eine gültige E-Mail-Adresse aus"' : '') + '></td>' +
      '<td><input class="collect-input w-med" data-field="type" value="' + escapeHtml(it.type || '') + '"></td>' +
      '<td><input class="collect-input w-wide" data-field="os" value="' + escapeHtml(it.os || '') + '"></td>' +
      '<td><input class="collect-input w-med" data-field="location" value="' + escapeHtml(it.location || '') + '"></td>' +
      '<td><input class="collect-input" data-field="sizeGiB" value="' + escapeHtml(it.sizeGiB === '' || it.sizeGiB === undefined ? '' : it.sizeGiB) + '" style="width:80px;"></td>' +
      '<td><input class="collect-input w-med" data-field="note" value="' + escapeHtml(it.note || '') + '"></td>' +
      '<td style="text-align:center;"><input type="checkbox" data-field="foundational" ' + (it.foundational === 'Ja' ? 'checked' : '') + '></td>' +
      '<td style="text-align:center;"><input type="checkbox" data-field="outOfScope" ' + (it.outOfScope ? 'checked' : '') + '></td>' +
      '<td style="text-align:center;"><input type="checkbox" data-field="dependsOnFoundation" ' + (it.dependsOnFoundation !== false ? 'checked' : '') + '></td>' +
      '<td><select class="collect-input collect-select" data-field="bi">' + scaleOptions.replace('value="' + it.bi + '"', 'value="' + it.bi + '" selected') + '</select></td>' +
      '<td><select class="collect-input collect-select" data-field="reg">' + scaleOptions.replace('value="' + it.reg + '"', 'value="' + it.reg + '" selected') + '</select></td>' +
      '<td><select class="collect-input collect-select" data-field="ds">' + scaleOptions.replace('value="' + it.ds + '"', 'value="' + it.ds + '" selected') + '</select></td>' +
      '<td><select class="collect-input collect-select" data-field="rk">' + scaleOptions.replace('value="' + it.rk + '"', 'value="' + it.rk + '" selected') + '</select></td>' +
      '<td class="collect-cls-cell' + (isManual ? ' is-manual' : '') + '" data-role="cls-cell" style="color:' + tierColor(cls) + '">' +
        escapeHtml(cls ? tierLabel(cls) : '–') + (isManual ? ' <span class="badge badge-manual">' + tr('manuell', 'manual') + '</span>' : '') +
        (it.autoProposed && !it.validated ? ' <span class="badge badge-auto" title="' + tr('Auto-Vorschlag — bis zur Kundenvalidierung markiert', 'Auto proposal — marked until customer validation') + '">auto</span>' : '') + '</td>' +
      '<td><select class="collect-input override-select" data-field="clsOverride">' + overrideOptions.replace('value="' + it.clsOverride + '"', 'value="' + it.clsOverride + '" selected') + '</select></td>' +
      '<td style="text-align:center;"><input type="checkbox" data-field="validated" ' + (it.validated ? 'checked' : '') + '></td>' +
      '<td><input class="collect-input' + (gaps.rpoGap ? ' is-gap' : '') + '" data-field="istRpo" type="number" step="0.25" min="0" value="' + escapeHtml(isBlankNum(it.istRpo) ? '' : it.istRpo) + '" style="width:80px;"' + (gaps.rpoGap ? ' title="Ist-RPO überschreitet das Klassen-Ziel (' + escapeHtml(CLASS_DEFS[cls].rpoH) + ' h)"' : '') + '></td>' +
      '<td><input class="collect-input' + (gaps.rtoGap ? ' is-gap' : '') + '" data-field="istRto" type="number" step="0.25" min="0" value="' + escapeHtml(isBlankNum(it.istRto) ? '' : it.istRto) + '" style="width:80px;"' + (gaps.rtoGap ? ' title="Ist-RTO überschreitet das Klassen-Ziel (' + escapeHtml(CLASS_DEFS[cls].rtoH) + ' h)"' : '') + '></td>' +
      '<td><input class="collect-input deps-input' + (depsHasUnresolved ? ' is-unresolved' : '') + '" data-field="depsText" list="workload-names-datalist" value="' + escapeHtml(it.depsText) + '" title="' + (depsHasUnresolved ? tr('Nicht aufgelöst: ', 'Unresolved: ') + escapeHtml(resolvedDeps.unresolved.join(', ')) : '') + '" style="min-width:220px;"></td>' +
      '<td class="graph-note" data-role="reverse-deps">' + (revNames.length ? escapeHtml(revNames.join(', ')) : '–') + '</td>' +
      '</tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;

  table.querySelectorAll('th[data-sk]').forEach(th => {
    th.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return; // do not intercept the checkbox in the first TH
      const sk = th.getAttribute('data-sk');
      if (collectSort.key === sk) collectSort.dir = -collectSort.dir;
      else { collectSort.key = sk; collectSort.dir = 1; }
      collectPage = 0; // after sorting one wants to see the beginning
      renderCollectTable();
    });
  });

  syncSelectAllBox();
  updateCollectPager(filtered.length, pageCount);
  if (typeof updatePrequalQuotaNote === 'function') updatePrequalQuotaNote();

  if (typeof i18nApply === 'function') i18nApply(document.getElementById('tab-collect'));
}

function syncSelectAllBox() {
  const box = document.getElementById('collect-select-all');
  if (box) box.checked = lastFilteredItems.length > 0 && lastFilteredItems.every(it => selectedIds.has(it.id));
}

function updateCollectPager(total, pageCount) {
  const info = document.getElementById('pager-info');
  if (!info) return;
  const pageSize = collectPageSize === 'all' ? Math.max(1, total) : collectPageSize;
  const from = total === 0 ? 0 : collectPage * pageSize + 1;
  const to = Math.min(total, (collectPage + 1) * pageSize);
  info.textContent = tr('Zeige ', 'Showing ') + from + '–' + to + tr(' von ', ' of ') + total +
    tr(' gefilterten Workloads (gesamt ', ' filtered workloads (total ') + collectState.items.length + ').';
  document.getElementById('pager-pos').textContent = tr('Seite ', 'Page ') + (collectPage + 1) + ' / ' + pageCount;
  document.getElementById('pager-prev').disabled = collectPage <= 0;
  document.getElementById('pager-next').disabled = collectPage >= pageCount - 1;
}

// ---- Einmalige Delegation (statt tausender Einzel-Listener pro Render) ----
document.getElementById('collect-table').addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'collect-select-all') {
    // "Select all" deliberately applies to the WHOLE filtered set, across all pages
    if (t.checked) lastFilteredItems.forEach(it => selectedIds.add(it.id));
    else lastFilteredItems.forEach(it => selectedIds.delete(it.id));
    if (selectedIds.size > 0) document.getElementById('bulk-panel').open = true;
    renderCollectTable();
    return;
  }
  if (t.classList && t.classList.contains('collect-row-select')) {
    const id = parseInt(t.closest('tr').getAttribute('data-id'), 10);
    if (t.checked) selectedIds.add(id); else selectedIds.delete(id);
    document.getElementById('bulk-selected-count').textContent = selectedIds.size;
    if (selectedIds.size > 0) document.getElementById('bulk-panel').open = true; // the section shows up as soon as it becomes relevant
    syncSelectAllBox();
  }
});

// Dependency normalization on focus loss: accepts IDs and/or names, comma-separated; IDs are
// resolved to names, "Required by" refreshes. Delegated in the capture phase because blur does
// not bubble: one listener instead of one per row.
document.getElementById('collect-table').addEventListener('blur', (e) => {
  if (!e.target.classList || !e.target.classList.contains('deps-input')) return;
  const row = e.target.closest('tr');
  const id = parseInt(row.getAttribute('data-id'), 10);
  const item = collectState.items.find(it => it.id === id);
  if (!item) return;
  const idx = buildNameIndex();
  item.depsText = normalizeDepsText(item.depsText, id, idx).text;
  e.target.value = item.depsText;
  const stillUnresolved = resolveDepsText(item.depsText, id, idx).unresolved;
  e.target.classList.toggle('is-unresolved', stillUnresolved.length > 0);
  e.target.title = stillUnresolved.length ? tr('Nicht aufgelöst: ', 'Unresolved: ') + stillUnresolved.join(', ') : '';
  refreshReverseDepsColumn();
  autoSaveProgress();
}, true);

// ---- Pager-Bedienung ----
document.getElementById('pager-prev').addEventListener('click', () => {
  if (collectPage > 0) { collectPage--; renderCollectTable(); }
});
document.getElementById('pager-next').addEventListener('click', () => {
  collectPage++; renderCollectTable();
});
document.getElementById('pager-size').addEventListener('change', (e) => {
  collectPageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
  collectPage = 0;
  renderCollectTable();
});

document.getElementById('collect-table').addEventListener('input', (e) => {
  const rowEl = e.target.closest('tr');
  if (!rowEl) return;
  const id = parseInt(rowEl.getAttribute('data-id'), 10);
  const item = collectState.items.find(it => it.id === id);
  if (!item) return;
  const field = e.target.getAttribute('data-field');
  if (!field) return;
  if (field === 'foundational' || field === 'validated' || field === 'outOfScope' || field === 'dependsOnFoundation') {
    if (field === 'foundational') item.foundational = e.target.checked ? 'Ja' : 'Nein';
    else if (field === 'validated') item.validated = e.target.checked;
    else if (field === 'outOfScope') item.outOfScope = e.target.checked;
    else item.dependsOnFoundation = e.target.checked;
  } else if (['bi', 'reg', 'ds', 'rk'].includes(field)) {
    item[field] = e.target.value === '' ? '' : parseInt(e.target.value, 10);
  } else if (field === 'sizeGiB') {
    item.sizeGiB = e.target.value === '' ? '' : parseFloat(e.target.value);
  } else if (field === 'istRpo' || field === 'istRto') {
    item[field] = e.target.value === '' ? '' : parseFloat(e.target.value.replace(',', '.'));
  } else {
    item[field] = e.target.value;
  }

  // Live markers without a full re-render (which would tear the focus out of the field)
  if (field === 'responsibleEmail') {
    const bad = e.target.value.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value.trim());
    e.target.classList.toggle('is-badmail', bad);
    e.target.title = bad ? 'Sieht nicht wie eine gültige E-Mail-Adresse aus' : '';
  }

  const calculatedCls = classifyScore(computeScore(item.bi, item.reg, item.ds), item.foundational);
  const cls = item.outOfScope ? OUT_OF_SCOPE_CLASS : (item.clsOverride || calculatedCls);
  const isManual = !item.outOfScope && !!item.clsOverride && item.clsOverride !== calculatedCls;
  const clsCell = rowEl.querySelector('[data-role="cls-cell"]');
  clsCell.classList.toggle('is-manual', isManual);
  clsCell.style.color = tierColor(cls);
  clsCell.innerHTML = escapeHtml(cls ? tierLabel(cls) : '–') + (isManual ? ' <span class="badge badge-manual">' + tr('manuell', 'manual') + '</span>' : '') +
    (item.autoProposed && !item.validated ? ' <span class="badge badge-auto" title="' + tr('Auto-Vorschlag — bis zur Kundenvalidierung markiert', 'Auto proposal — marked until customer validation') + '">auto</span>' : '');
  if (typeof updatePrequalQuotaNote === 'function') updatePrequalQuotaNote();

  // Refresh the gap markers of the actual-value fields live (even if the class changed)
  const gaps = gapCheck(cls, item.istRpo, item.istRto);
  const rpoInp = rowEl.querySelector('[data-field="istRpo"]');
  const rtoInp = rowEl.querySelector('[data-field="istRto"]');
  if (rpoInp) {
    rpoInp.classList.toggle('is-gap', gaps.rpoGap);
    rpoInp.title = gaps.rpoGap ? 'Ist-RPO überschreitet das Klassen-Ziel (' + CLASS_DEFS[cls].rpoH + ' h)' : '';
  }
  if (rtoInp) {
    rtoInp.classList.toggle('is-gap', gaps.rtoGap);
    rtoInp.title = gaps.rtoGap ? 'Ist-RTO überschreitet das Klassen-Ziel (' + CLASS_DEFS[cls].rtoH + ' h)' : '';
  }

  if (field === 'depsText') refreshReverseDepsColumn();
  if (field === 'name') { updateWorkloadNamesDatalist(); refreshReverseDepsColumn(); }
  autoSaveProgress();
});

// ---- manual row add (e.g. physical workloads that appear in no vCenter export) ----
function addManualRow() {
  collectState.items.push({
    id: collectState.nextId++, name: '', owner: '', type: '', os: '', location: '',
    sizeGiB: '', note: 'manuell erfasst', responsible: '', responsibleEmail: '',
    foundational: 'Nein', bi: '', reg: '', ds: '', rk: '', clsOverride: '', validated: false, outOfScope: false,
    dependsOnFoundation: true,
    istRpo: '', istRto: '', gap: '', depsText: ''
  });
  document.getElementById('collect-toolbar-card').classList.remove('hidden');
  document.getElementById('validation-card').classList.remove('hidden');
  renderCollectTable();
  autoSaveProgress();
  // Focus straight into the name field of the new (last) row
  const rows = document.querySelectorAll('#collect-table tbody tr');
  if (rows.length) {
    const nameInput = rows[rows.length - 1].querySelector('[data-field="name"]');
    if (nameInput) { nameInput.focus(); nameInput.scrollIntoView({ block: 'center' }); }
  }
}
document.getElementById('btn-add-row').addEventListener('click', addManualRow);
document.getElementById('btn-start-manual').addEventListener('click', addManualRow);

// ---- bulk edit ----
// Fill the override dropdown dynamically (display names can be renamed in the options panel)
function refreshBulkOverrideOptions() {
  const sel = document.getElementById('bulk-override');
  const current = sel.value;
  sel.innerHTML = '<option value="">' + tr('– nicht ändern –', "– don't change –") + '</option>' +
    TIER_ORDER.map(t => '<option value="' + escapeHtml(t) + '">' + escapeHtml(tierLabel(t)) + tr(' (fest zuweisen)', ' (assign fixed)') + '</option>').join('') +
    '<option value="__auto__">' + tr('↺ zurück auf automatisch', '↺ back to automatic') + '</option>';
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
}

// Bulk "depends on" field: resolve IDs -> names on blur, exactly like the table cell
const BULK_DEPS_HINT_DE = 'Namen oder IDs, kommagetrennt — IDs werden beim Verlassen des Felds zu Namen aufgelöst';
const bulkDepsInput = document.getElementById('bulk-deps');
bulkDepsInput.addEventListener('blur', () => {
  const r = normalizeDepsText(bulkDepsInput.value, null);
  bulkDepsInput.value = r.text;
  bulkDepsInput.classList.toggle('is-unresolved', r.unresolved.length > 0);
  bulkDepsInput.title = r.unresolved.length ? tr('Nicht aufgelöst: ', 'Unresolved: ') + r.unresolved.join(', ')
    : tr(BULK_DEPS_HINT_DE, 'Names or IDs, comma-separated — IDs are resolved to names when leaving the field');
});

document.getElementById('btn-bulk-apply').addEventListener('click', () => {
  if (selectedIds.size === 0) { alert(tr('Bitte zuerst Zeilen über die Checkbox links auswählen.', 'Please select rows first using the checkbox on the left.')); return; }
  // "Depends on" (v0.16.0, #27): resolve first, refuse the whole action on unknown entries — no half-applied bulk
  const depsRaw = bulkDepsInput.value.trim();
  const depsMode = document.getElementById('bulk-deps-mode').value;
  let depsTargets = null;
  if (depsRaw !== '') {
    const r = normalizeDepsText(depsRaw, null);
    if (r.unresolved.length) {
      alert(tr('„Abhängig von“ — nicht auflösbar: ', '"Depends on" — cannot be resolved: ') + r.unresolved.join(', ') + tr('. Bitte korrigieren, es wurde nichts geändert.', '. Please correct the entry, nothing was changed.'));
      return;
    }
    depsTargets = r.text.split(',').map(s => s.trim()).filter(Boolean);
  }
  // "" = do not change, "__clear__" = clear the value (back to unrated), number = set
  const scaleVal = id => document.getElementById(id).value;
  const applyScale = (it, field, v) => {
    if (v === '') return;
    it[field] = (v === '__clear__') ? '' : parseInt(v, 10);
  };
  const bi = scaleVal('bulk-bi'), reg = scaleVal('bulk-reg'), ds = scaleVal('bulk-ds'), rk = scaleVal('bulk-rk');
  const foundationalVal = document.getElementById('bulk-foundational').value;
  const outOfScopeVal = document.getElementById('bulk-outofscope').value;
  const overrideVal = document.getElementById('bulk-override').value;
  // Text fields: empty = do not change, filled = set on all selected rows
  const ownerVal = document.getElementById('bulk-owner').value.trim();
  const responsibleVal = document.getElementById('bulk-responsible').value.trim();
  const emailVal = document.getElementById('bulk-email').value.trim();
  collectState.items.forEach(it => {
    if (!selectedIds.has(it.id)) return;
    applyScale(it, 'bi', bi); applyScale(it, 'reg', reg); applyScale(it, 'ds', ds); applyScale(it, 'rk', rk);
    if (foundationalVal !== '') it.foundational = foundationalVal;
    if (outOfScopeVal !== '') it.outOfScope = (outOfScopeVal === 'Ja');
    if (overrideVal !== '') it.clsOverride = (overrideVal === '__auto__') ? '' : overrideVal;
    if (ownerVal !== '') it.owner = ownerVal;
    if (responsibleVal !== '') it.responsible = responsibleVal;
    if (emailVal !== '') it.responsibleEmail = emailVal;
    if (depsTargets) it.depsText = applyBulkDeps(it, depsTargets, depsMode);
  });
  renderCollectTable();
  autoSaveProgress();
  // Reset the input fields to default ("do not change"); the row selection is kept
  ['bulk-bi', 'bulk-reg', 'bulk-ds', 'bulk-rk', 'bulk-foundational', 'bulk-outofscope', 'bulk-override',
   'bulk-owner', 'bulk-responsible', 'bulk-email', 'bulk-deps']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('bulk-deps-mode').value = 'add';
  bulkDepsInput.classList.remove('is-unresolved'); bulkDepsInput.title = tr(BULK_DEPS_HINT_DE, 'Names or IDs, comma-separated — IDs are resolved to names when leaving the field');
});

// ---- Delete rows (v0.14.0, backlog #29) ----
// Individually (✕ in the # column) and for the bulk selection. Confirmation with count, ONE level of
// undo (session, not in the progress file), clean-up of dependency references of other workloads
// (IDs or names in the text) with a counter. IDs are NEVER reused (nextId stays monotonic), otherwise
// old references would suddenly point at foreign systems. Tab 3 state with orphaned group keys does
// no harm: the groups are recomputed from the remaining dependencies. Core logic without DOM (testable).
let lastDeleteUndo = null; // { removed:[{index,item}], depsChanged:[{id,prev}], refs }
// Tombstones (v0.15.0): deliberately deleted workloads (name, source, time). The validator reports them as
// "deleted on purpose" instead of "missing". Saved with the progress; cleared by undo or re-import.
let deletedTombstones = [];
const TOMBSTONE_MAX = 500;
function addTombstones(items) {
  items.forEach(it => { if ((it.name || '').trim()) deletedTombstones.push({ name: it.name.trim(), source: it.source || '', at: Date.now() }); });
  if (deletedTombstones.length > TOMBSTONE_MAX) deletedTombstones = deletedTombstones.slice(-TOMBSTONE_MAX);
}
function clearTombstonesFor(names) {
  const set = new Set(names.map(n => String(n).trim().toLowerCase()).filter(Boolean));
  deletedTombstones = deletedTombstones.filter(t => !set.has(t.name.toLowerCase()));
}
function removeItemsFromState(ids) {
  const idSet = new Set(ids);
  const removed = [], keep = [];
  collectState.items.forEach((it, i) => { if (idSet.has(it.id)) removed.push({ index: i, item: it }); else keep.push(it); });
  if (!removed.length) return null;
  const survivorNames = new Set(keep.map(it => (it.name || '').trim().toLowerCase()).filter(Boolean));
  // Clean up names only when no remaining workload carries the same name (duplicates via "add anyway")
  const goneNames = new Set(removed.map(r => (r.item.name || '').trim().toLowerCase()).filter(n => n && !survivorNames.has(n)));
  const goneIds = new Set(removed.map(r => String(r.item.id)));
  const depsChanged = [];
  let refs = 0;
  keep.forEach(it => {
    if (!it.depsText) return;
    const tokens = it.depsText.split(',').map(s => s.trim()).filter(Boolean);
    const kept = tokens.filter(t => !(goneIds.has(t) || goneNames.has(t.toLowerCase())));
    if (kept.length !== tokens.length) {
      depsChanged.push({ id: it.id, prev: it.depsText });
      refs += tokens.length - kept.length;
      it.depsText = kept.join(', ');
    }
  });
  collectState.items = keep;
  ids.forEach(id => selectedIds.delete(id));
  return { removed: removed, depsChanged: depsChanged, refs: refs };
}
function showDeleteNote(html) {
  const el = document.getElementById('delete-note');
  if (!el) return;
  el.innerHTML = html || '';
  const undoBtn = document.getElementById('btn-undo-delete');
  if (undoBtn) undoBtn.addEventListener('click', undoLastDelete);
}
function deleteItems(ids) {
  const targets = collectState.items.filter(it => ids.includes(it.id));
  const n = targets.length;
  if (!n) return;
  const preview = targets.slice(0, 3).map(it => it.name || ('#' + it.id)).join(', ') + (n > 3 ? ' …' : '');
  const ok = confirm(tr(
    n + ' Workload(s) löschen?\n' + preview + '\n\nAbhängigkeitsverweise anderer Workloads auf diese Systeme werden bereinigt. Die letzte Löschung lässt sich mit „Rückgängig“ zurückholen.',
    'Delete ' + n + ' workload(s)?\n' + preview + '\n\nDependency references of other workloads to these systems will be cleaned up. The last deletion can be restored with "Undo".'));
  if (!ok) return;
  const res = removeItemsFromState(ids);
  if (!res) return;
  lastDeleteUndo = res;
  addTombstones(res.removed.map(r => r.item));
  document.getElementById('bulk-panel').open = true;
  renderCollectTable();
  autoSaveProgress();
  showDeleteNote('🗑 ' + n + tr(' Workload(s) gelöscht', ' workload(s) deleted') +
    (res.refs ? tr(', ' + res.refs + ' Abhängigkeitsverweis(e) in ' + res.depsChanged.length + ' Workload(s) bereinigt', ', ' + res.refs + ' dependency reference(s) in ' + res.depsChanged.length + ' workload(s) cleaned up') : '') +
    '. <button class="btn-ghost" id="btn-undo-delete" style="margin-left:8px;">↩ ' + tr('Rückgängig', 'Undo') + '</button>');
}
function undoLastDelete() {
  if (!lastDeleteUndo) return;
  const u = lastDeleteUndo;
  lastDeleteUndo = null;
  u.removed.sort((a, b) => a.index - b.index).forEach(r => {
    collectState.items.splice(Math.min(r.index, collectState.items.length), 0, r.item);
  });
  u.depsChanged.forEach(d => { const it = collectState.items.find(x => x.id === d.id); if (it) it.depsText = d.prev; });
  clearTombstonesFor(u.removed.map(r => r.item.name));
  renderCollectTable();
  autoSaveProgress();
  showDeleteNote('↩ ' + u.removed.length + tr(' Workload(s) wiederhergestellt.', ' workload(s) restored.'));
}
document.getElementById('collect-table').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-del]');
  if (!btn) return;
  deleteItems([parseInt(btn.getAttribute('data-del'), 10)]);
});
document.getElementById('btn-bulk-delete').addEventListener('click', () => {
  if (selectedIds.size === 0) { alert(tr('Bitte zuerst Zeilen über die Checkbox links auswählen.', 'Please select rows first using the checkbox on the left.')); return; }
  deleteItems([...selectedIds]);
});
