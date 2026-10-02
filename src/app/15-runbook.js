// ================================================================================================
// BLOCK 15 · Tab 3 runbook planning: groups, start order, service owners, group override
// ------------------------------------------------------------------------------------------------
// Depends : Blocks 4, 11, 13 (buildViewItemsFromCollect).
// Provides: computeRunbookStructure() (shared with the Excel export), topoOrderMembers(), resolveGroupOrder(),
//           analyzeGroupClassMix(), renderRunbookTab(), runbookGroupHtml(); state: runbookOrders, runbookNames,
//           runbookServiceOwners, runbookOverrideUndo
// Note    : Foundation doctrine: DR event = own plan first; DataLab test = lab group (see the FAQ in the tab).
// ================================================================================================
// ---------------- Tab 3: runbook planning (VRO group proposal) ----------------
//
// Concept:
// - Data basis: the current assessment (tab 1), otherwise the state last shown in tab 2.
// - Out-of-scope systems appear in no group (they are not restored);
//   dependencies on them are noted as a warning.
// - Foundational systems (tier 0) are taken out of the connectivity computation: as central hubs
//   (AD/DNS) they would otherwise merge almost all systems into ONE giant group.
//   They form their own "always starts first" block; optionally shown in every group via checkbox.
// - Start order per group: topological (what others depend on first), ties by protection-class
//   rank, then name. Can be overridden manually via the number dropdown (per session).

let runbookOrders = {}; // groupKey -> [itemId, ...] (inkl. manueller Umsortierung)
let runbookNames = {};  // groupKey -> vom TAM vergebener Gruppenname (z. B. "Runbook SAP-Landschaft")
// Service owner (v0.12.0): a separate layer NEXT TO the VM owner. A service can have an overarching
// responsible person without overwriting the owners of the individual VMs. Optional write-back into
// the workload list (empty fields only / overwrite) is a deliberate single action.
let runbookServiceOwners = {}; // groupKey -> { owner, responsible, responsibleEmail }
// Undo store for group assignments: stable group key (IDs only, without the foundational suffix)
// -> { itemId: previous clsOverride }. One level deep: the last group assignment can be taken
// back without losing INDIVIDUAL overrides set earlier.
let runbookOverrideUndo = {};
// Key of the group assignment executed last: anchor for the GLOBAL undo
// (needed because a tier-0 assignment dissolves the group and its dropdown disappears with it).
let lastGroupUndoKey = null;

function runbookSourceItems() {
  if (collectState.items.length) {
    const items = buildViewItemsFromCollect();
    if (items.length) return { items: items, source: tr('aktuelle Erhebung (Tab ①)', 'current assessment (tab ①)'), fromCollect: true };
  }
  if (currentViewItems && currentViewItems.length) {
    return { items: currentViewItems, source: tr('zuletzt geladener Stand (Tab ②)', 'last loaded state (tab ②)'), fromCollect: false };
  }
  return { items: [], source: null, fromCollect: false };
}

function topoOrderMembers(members) {
  const ids = new Set(members.map(m => m.id));
  const started = new Set();
  let remaining = members.slice();
  const order = [];
  let hadCycle = false;
  while (remaining.length) {
    const ready = remaining.filter(it => (it.deps || []).filter(d => ids.has(d)).every(d => started.has(d)));
    let batch = ready;
    if (!batch.length) { hadCycle = true; batch = remaining.slice(); } // cycle: append the rest by rank
    batch.sort((a, b) =>
      ((TIER_RANK[a.cls] !== undefined ? TIER_RANK[a.cls] : 9) - (TIER_RANK[b.cls] !== undefined ? TIER_RANK[b.cls] : 9)) ||
      String(a.name).localeCompare(String(b.name), 'de'));
    batch.forEach(it => { order.push(it); started.add(it.id); });
    remaining = remaining.filter(it => !started.has(it.id));
    if (hadCycle) break;
  }
  return { order: order, hadCycle: hadCycle };
}

// Shared group computation for tab 3 AND the Excel export ("Runbook-Plan" sheet):
// one logic, two consumers, so display and export never drift apart.
function computeRunbookStructure(items) {
  const byId = {};
  items.forEach(it => byId[it.id] = it);
  const inScope = items.filter(it => it.cls !== OUT_OF_SCOPE_CLASS);
  const foundational = inScope.filter(it => it.cls === 'Tier 0 – Foundation');
  const rest = inScope.filter(it => it.cls !== 'Tier 0 – Foundation');
  const restIds = new Set(rest.map(it => it.id));
  const adj = {};
  rest.forEach(it => adj[it.id] = new Set());
  rest.forEach(it => (it.deps || []).forEach(d => {
    if (restIds.has(d)) { adj[it.id].add(d); adj[d].add(it.id); }
  }));
  const seen = new Set();
  const components = [];
  rest.forEach(it => {
    if (seen.has(it.id)) return;
    const comp = [];
    const queue = [it.id];
    seen.add(it.id);
    while (queue.length) {
      const id = queue.shift();
      comp.push(byId[id]);
      adj[id].forEach(n => { if (!seen.has(n)) { seen.add(n); queue.push(n); } });
    }
    components.push(comp);
  });
  const multiGroups = components.filter(c => c.length >= 2);
  const singles = components.filter(c => c.length === 1).map(c => c[0]);
  const bestRank = comp => Math.min(...comp.map(it => TIER_RANK[it.cls] !== undefined ? TIER_RANK[it.cls] : 9));
  multiGroups.sort((a, b) => bestRank(a) - bestRank(b) || b.length - a.length);
  return { byId, inScope, foundational, multiGroups, singles };
}

// Returns the final order of a group (stored manual order, otherwise topological)
function resolveGroupOrder(comp, foundational, includeFoundational) {
  const members = includeFoundational ? foundational.concat(comp) : comp;
  const key = 'g:' + comp.map(it => it.id).sort((a, b) => a - b).join(',') + (includeFoundational ? ':+f' : '');
  let ordered, hadCycle = false;
  if (runbookOrders[key] && runbookOrders[key].length === members.length &&
      runbookOrders[key].every(id => members.some(m => m.id === id))) {
    ordered = runbookOrders[key].map(id => members.find(m => m.id === id));
  } else {
    const topo = topoOrderMembers(members);
    ordered = topo.order;
    hadCycle = topo.hadCycle;
    runbookOrders[key] = ordered.map(it => it.id);
  }
  return { key, ordered, hadCycle, testAdded: includeFoundational ? new Set(foundational.map(f => f.id)) : new Set() };
}

// Detect mixed protection classes within a group: since a VRO orchestration plan has exactly ONE
// target RTO/RPO, the weakest member determines the actually achievable plan target. More strongly
// classified members cannot keep their promise then; that has to be reported.
function analyzeGroupClassMix(comp) {
  const rank = it => TIER_RANK[it.cls] !== undefined ? TIER_RANK[it.cls] : 9;
  const ranks = comp.map(rank);
  const minRank = Math.min(...ranks), maxRank = Math.max(...ranks);
  if (minRank === maxRank) return null;
  const weakest = comp.filter(it => rank(it) === maxRank);
  return {
    weakNames: weakest.map(w => w.name),
    weakCls: weakest[0].cls,
    strongCls: comp.find(it => rank(it) === minRank).cls,
    weakRto: (CLASS_DEFS[weakest[0].cls] || {}).rto || ''
  };
}

function groupMixText(mix, esc) {
  const e = esc ? escapeHtml : (s => s);
  return '⚠ ' + tr('Gemischte Schutzklassen in dieser Gruppe: Das real erreichbare Plan-RTO richtet sich nach dem schwächsten Glied — ',
      'Mixed protection classes in this group: the actually achievable plan RTO is determined by the weakest link — ') +
    e(mix.weakNames.join(', ')) + ' (' + e(tierLabel(mix.weakCls)) +
    (mix.weakRto ? ', ' + tr('Ziel-RTO ', 'target RTO ') + e(mix.weakRto) : '') + '). ' +
    tr('Empfehlung: Diese(s) System(e) auf ', 'Recommendation: upgrade these system(s) to ') + e(tierLabel(mix.strongCls)) +
    tr(' anheben ODER das VRO-Plan-Ziel bewusst am RTO von ', ' OR consciously align the VRO plan target with the RTO of ') + e(tierLabel(mix.weakCls)) +
    tr(' ausrichten und die Abweichung dokumentieren.', ' and document the deviation.');
}

function renderRunbookTab() {
  const box = document.getElementById('runbook-groups');
  const note = document.getElementById('runbook-note');
  const includeFoundational = document.getElementById('runbook-include-foundational').checked;
  const src = runbookSourceItems();
  if (!src.items.length) {
    box.innerHTML = '<div class="finding finding--info">ℹ ' + tr('Noch keine Daten vorhanden — bitte zuerst in Tab ① Workloads erfassen/bewerten oder in Tab ② eine Datei hochladen. Für sinnvolle Gruppen müssen Abhängigkeiten gepflegt sein.',
      'No data yet — please record/rate workloads in tab ① first, or upload a file in tab ②. Meaningful groups require maintained dependencies.') + '</div>';
    note.textContent = '';
    return;
  }
  const items = src.items;
  _runbookFromCollect = !!src.fromCollect;
  const structure = computeRunbookStructure(items);
  const byId = structure.byId;
  const inScope = structure.inScope;
  const foundational = structure.foundational;
  const multiGroups = structure.multiGroups;
  const singles = structure.singles;

  let html = '';
  let cycleGroups = 0;
  let oosWarnings = [];

  // Block: foundation (always first)
  if (foundational.length) {
    const orderedF = topoOrderMembers(foundational).order;
    html += runbookGroupHtml('foundation', tr('Foundation-Block (startet immer zuerst)', 'Foundation block (always starts first)'), orderedF, new Set(), byId,
      tr('Diese Systeme sind Voraussetzung für alles andere und gehören an den Anfang jedes DR-Ablaufs — in VRO typischerweise ein eigener, vorgelagerter Orchestration Plan.',
         'These systems are a prerequisite for everything else and belong at the start of every DR sequence — in VRO typically a dedicated, upstream orchestration plan.'));
    // Field note: foundation in a DR event vs. in a DataLab test, a frequent source of confusion
    html += '<details style="margin:-16px 2px 28px;"><summary class="graph-note" style="cursor:pointer; font-weight:600; list-style:none;">' +
      tr('❓ Foundation im DR-Fall vs. im DataLab-Test — was gehört wohin?', '❓ Foundation in a DR event vs. in a DataLab test — what goes where?') + '</summary>' +
      '<div class="graph-note" style="margin-top:8px; max-width:1100px;">' +
      tr('Im DR-FALL ist die Foundation ein eigener Recovery Plan, der vor allen Service-Plänen startet. ' +
         'Beim DATALAB-TEST eines Service-Plans wird die Foundation dagegen NICHT als Plan mitgetestet, sondern als LAB GROUP im DataLab konfiguriert: ' +
         'Lab Groups bilden genau die Abhängigkeiten ab, die nicht Teil des getesteten Plans sind, aber im Lab laufen müssen — je Test-Szenario zuschaltbar, ' +
         'mit Verarbeitungs-Reihenfolge und Halt-bei-Fehler. Für Domain Controller in der Lab Group den Step „Prepare VM as Domain Controller" ergänzen, ' +
         'damit der DC im isolierten Lab autoritativ bootet. Den Foundation-Plan SELBST testet man mit einem eigenen Test-Schedule. ' +
         'Kurzformel: Lab Group = Foundation als Test-Infrastruktur · Plan-Auswahl = Foundation als Test-Objekt. Details: FAQ unten.',
         'In a DR EVENT, the foundation is its own recovery plan that starts before all service plans. ' +
         'In a DATALAB TEST of a service plan, however, the foundation is NOT tested as a plan but configured as a LAB GROUP in the DataLab: ' +
         'lab groups model exactly those dependencies that are not part of the tested plan but must run in the lab — selectable per test scenario, ' +
         'with processing order and halt-on-error. For domain controllers in the lab group, add the "Prepare VM as Domain Controller" step ' +
         'so the DC boots authoritatively in the isolated lab. The foundation plan ITSELF is tested with its own test schedule. ' +
         'Rule of thumb: lab group = foundation as test infrastructure · plan selection = foundation as test object. Details: FAQ below.') +
      '</div></details>';
  }

  multiGroups.forEach((comp, idx) => {
    const g = resolveGroupOrder(comp, foundational, includeFoundational);
    if (g.hadCycle) cycleGroups++;
    // Dependencies on out-of-scope systems in this group?
    comp.forEach(it => (it.deps || []).forEach(d => {
      const dep = byId[d];
      if (dep && dep.cls === OUT_OF_SCOPE_CLASS) oosWarnings.push(it.name + ' → ' + dep.name);
    }));
    const lead = comp.slice().sort((a, b) =>
      ((TIER_RANK[a.cls] !== undefined ? TIER_RANK[a.cls] : 9) - (TIER_RANK[b.cls] !== undefined ? TIER_RANK[b.cls] : 9)))[0];
    // Class-mix analysis deliberately over the core members (comp) only: foundational systems (tier 0)
    // added for completeness would otherwise ALWAYS trigger "mixed".
    const mix = analyzeGroupClassMix(comp);
    // Group override: sets a manual protection-class override for all core members (consistent with
    // tab 1 / individual override). Only possible when the data comes from the assessment; with an
    // uploaded Excel there is nothing editable.
    const undoKey = 'g:' + comp.map(it => it.id).sort((a, b) => a - b).join(',');
    const hasUndo = !!runbookOverrideUndo[undoKey];
    const overrideHtml = src.fromCollect
      ? '<select class="collect-input" style="min-width:270px;" data-group-override="' + comp.map(it => it.id).join(',') + '" data-undo-key="' + escapeHtml(undoKey) + '" ' +
        'title="' + tr('Setzt für jedes System dieser Gruppe einen manuellen Schutzklassen-Override — in Tab ① als „manuell“ markiert, wirkt in allen Ansichten und Exporten. Die letzte Gruppen-Zuweisung ist rückgängig machbar.',
                       'Sets a manual protection-class override for every system in this group — marked “manual” in tab ①, effective in all views and exports. The last group assignment can be undone.') + '">' +
        '<option value="">' + tr('Schutzklasse dieser Gruppe ändern …', 'Change protection class for this group …') + '</option>' +
        TIER_ORDER.map(t => '<option value="' + escapeHtml(t) + '">' + escapeHtml(tierLabel(t)) + tr(' (fest zuweisen)', ' (assign fixed)') + '</option>').join('') +
        (hasUndo ? '<option value="__undo__">' + tr('↩ Letzte Gruppen-Zuweisung rückgängig', '↩ Undo last group assignment') + '</option>' : '') +
        '<option value="__auto__">' + tr('✕ Alle auf automatisch (löscht auch Einzel-Overrides)', '✕ Set all to automatic (also clears individual overrides)') + '</option>' +
        '</select>'
      : '';
    html += runbookGroupHtml(g.key, tr('Gruppe ', 'Group ') + (idx + 1) + ' – ' + escapeHtml(lead.name) +
      (comp.length > 1 ? ' + ' + (comp.length - 1) + tr(' weitere', ' more') : ''), g.ordered, g.testAdded, byId, null,
      mix ? groupMixText(mix, true) : '', overrideHtml, idx + 1);
  });

  if (singles.length) {
    const sortedSingles = singles.slice().sort((a, b) =>
      ((TIER_RANK[a.cls] !== undefined ? TIER_RANK[a.cls] : 9) - (TIER_RANK[b.cls] !== undefined ? TIER_RANK[b.cls] : 9)) ||
      String(a.name).localeCompare(String(b.name), 'de'));
    html += '<div class="rb-group">' +
      '<div class="rb-group__head"><span class="rb-group__num" style="background:var(--vm-grey-400);">＋</span>' +
      '<div style="font:600 14px/20px var(--font-sans);">' + tr('Einzelsysteme (keine erfassten Abhängigkeiten)', 'Standalone systems (no recorded dependencies)') + '</div></div>' +
      '<div class="rb-group__body">' +
      '<div class="graph-note" style="margin-bottom:8px;">' + tr('Diese Systeme hängen laut Datenlage mit nichts zusammen — entweder wirklich eigenständig oder die Abhängigkeiten sind schlicht noch nicht erfasst (in Tab ① nachpflegen). Sie können einzelnen Plänen zugeordnet oder in einem Sammel-Runbook je Schutzklasse zusammengefasst werden.',
        'According to the data, these systems are not connected to anything — either truly standalone or the dependencies simply have not been recorded yet (maintain in tab ①). They can be assigned to individual plans or combined into one collective runbook per protection class.') + '</div>' +
      sortedSingles.map(it => '<span class="badge" style="margin:2px 4px 2px 0;"><span class="badge-dot" style="background:' + tierColor(it.cls) + '"></span>' +
        escapeHtml(it.name) + ' · ' + escapeHtml(tierLabel(it.cls)) + '</span>').join('') +
      '</div></div>';
  }

  if (!multiGroups.length && !singles.length && !foundational.length) {
    html = '<div class="finding finding--info">ℹ ' + tr('Keine gruppierbaren Workloads gefunden (alle Out of Scope?).', 'No groupable workloads found (all out of scope?).') + '</div>';
  }

  box.innerHTML = html;

  const notes = [tr('Datenbasis: ', 'Data basis: ') + src.source + ' (' + inScope.length + tr(' Workloads im Scope).', ' workloads in scope).'),
    tr('Vorschlagslogik: zusammenhängende Systeme über Abhängigkeiten; Startreihenfolge topologisch, bei Gleichstand nach Schutzklasse.',
       'Proposal logic: connected systems via dependencies; start order topological, ties broken by protection class.')];
  if (cycleGroups) notes.push('⚠ ' + cycleGroups + tr(' Gruppe(n) enthalten zirkuläre Abhängigkeiten — Reihenfolge dort bitte manuell prüfen.', ' group(s) contain circular dependencies — please review the order there manually.'));
  if (oosWarnings.length) notes.push('⚠ ' + tr('Abhängigkeiten auf Out-of-Scope-Systeme: ', 'Dependencies on out-of-scope systems: ') + oosWarnings.join('; ') + tr(' — im Ernstfall nicht verfügbar!', ' — not available in a disaster!'));
  note.textContent = notes.join(' ');

  // Reihenfolge-Dropdowns verdrahten
  box.querySelectorAll('select[data-order-group]').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const key = e.target.getAttribute('data-order-group');
      const itemId = parseInt(e.target.getAttribute('data-order-item'), 10);
      const newPos = parseInt(e.target.value, 10) - 1;
      const arr = runbookOrders[key];
      if (!arr) return;
      const oldPos = arr.indexOf(itemId);
      if (oldPos < 0) return;
      arr.splice(oldPos, 1);
      arr.splice(newPos, 0, itemId);
      autoSaveProgress();
      renderRunbookTab();
    });
  });

  // Wire the group-name inputs (no re-render per keystroke, which would steal the focus)
  box.querySelectorAll('input[data-group-name]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const key = e.target.getAttribute('data-group-name');
      const v = e.target.value.trim();
      if (v) runbookNames[key] = v; else delete runbookNames[key];
      autoSaveProgress();
    });
  });

  // Service owner: store the inputs (no re-render per keystroke); Apply = deliberate action
  box.querySelectorAll('input[data-svc-key]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const key = e.target.getAttribute('data-svc-key');
      const f = e.target.getAttribute('data-svc-field');
      const svc = runbookServiceOwners[key] || (runbookServiceOwners[key] = {});
      const v = e.target.value.trim();
      if (v) svc[f] = v; else delete svc[f];
      if (!Object.keys(svc).length) delete runbookServiceOwners[key];
      autoSaveProgress();
    });
  });
  box.querySelectorAll('button[data-svc-apply]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-svc-apply');
      const mode = (box.querySelector('select[data-svc-mode="' + CSS.escape(key) + '"]') || {}).value || 'none';
      const noteEl = box.querySelector('[data-svc-note="' + CSS.escape(key) + '"]');
      const svc = runbookServiceOwners[key] || {};
      if (!svc.owner && !svc.responsible && !svc.responsibleEmail) {
        if (noteEl) noteEl.textContent = tr('Bitte zuerst Service-Owner-Felder ausfüllen.', 'Please fill the service owner fields first.');
        return;
      }
      if (mode === 'none') {
        if (noteEl) noteEl.textContent = '✓ ' + tr('Als Service-Owner gespeichert (ohne Rückschreiben).', 'Stored as service owner (no write-back).');
        autoSaveProgress();
        return;
      }
      const ids = btn.getAttribute('data-svc-ids').split(',').filter(Boolean).map(n => parseInt(n, 10));
      let touched = 0;
      ids.forEach(id => {
        const it = collectState.items.find(x => x.id === id);
        if (!it) return;
        let hit = false;
        [['owner', 'owner'], ['responsible', 'responsible'], ['responsibleEmail', 'responsibleEmail']].forEach(([fld, sf]) => {
          if (!svc[sf]) return;
          if (mode === 'overwrite' ? it[fld] !== svc[sf] : !it[fld]) { it[fld] = svc[sf]; hit = true; }
        });
        if (hit) touched++;
      });
      renderCollectTable();
      autoSaveProgress();
      if (noteEl) noteEl.textContent = '✓ ' + touched + tr(' Workload(s) aktualisiert (', ' workload(s) updated (') +
        (mode === 'fill' ? tr('nur leere Felder', 'empty fields only') : tr('überschrieben', 'overwritten')) + ').';
    });
  });

  // Wire the group override: writes clsOverride into the assessment data (tab 1), so it is
  // consistent everywhere (table, graph, findings, Excel export, autosave).
  box.querySelectorAll('select[data-group-override]').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const v = e.target.value;
      if (!v) return;
      const ids = e.target.getAttribute('data-group-override').split(',').map(n => parseInt(n, 10));
      const undoKey = e.target.getAttribute('data-undo-key');
      if (v === '__undo__') {
        // Restore the previous override state (including earlier individual overrides)
        const prev = runbookOverrideUndo[undoKey] || {};
        ids.forEach(id => {
          const it = collectState.items.find(x => x.id === id);
          if (it && prev.hasOwnProperty(String(id))) it.clsOverride = prev[String(id)];
        });
        delete runbookOverrideUndo[undoKey];
        if (lastGroupUndoKey === undoKey) lastGroupUndoKey = null;
      } else {
        // Tier 0 dissolves the group (foundational systems are grouped separately), so ask for explicit
        // confirmation and point to the global undo.
        if (v === 'Tier 0 – Foundation') {
          const ok = confirm(tr('Achtung: Mit „Tier 0 – Foundation“ werden alle Systeme dieser Gruppe zu Foundational-Systemen. Die Gruppe löst sich auf und wandert in den Foundation-Block. Rückgängig danach über „↩ Letzte Gruppen-Zuweisung rückgängig“ in der Werkzeugleiste. Fortfahren?',
            'Caution: With “Tier 0 – Foundation”, all systems in this group become foundational systems. The group dissolves and moves into the foundation block. Undo afterwards via “↩ Undo last group assignment” in the toolbar. Continue?'));
          if (!ok) { e.target.value = ''; return; }
        }
        // Before assigning, save the current state for undo (one level)
        const snapshot = {};
        ids.forEach(id => {
          const it = collectState.items.find(x => x.id === id);
          if (it) snapshot[String(id)] = it.clsOverride || '';
        });
        runbookOverrideUndo[undoKey] = snapshot;
        lastGroupUndoKey = undoKey;
        ids.forEach(id => {
          const it = collectState.items.find(x => x.id === id);
          if (it && !it.outOfScope) it.clsOverride = (v === '__auto__') ? '' : v;
        });
      }
      autoSaveProgress();
      if (typeof renderCollectTable === 'function') renderCollectTable();
      renderRunbookTab(); // rebuild classes, mix warning and order proposal
    });
  });

  // Show the global undo only when there is something to undo
  document.getElementById('btn-runbook-undo').classList.toggle('hidden',
    !(lastGroupUndoKey && runbookOverrideUndo[lastGroupUndoKey]));

  if (typeof i18nApply === 'function') i18nApply(document.getElementById('tab-runbook'));
}

// Global undo of the last group assignment: also works when the group dissolved through the
// assignment (tier-0 case): the affected IDs are in the snapshot.
document.getElementById('btn-runbook-undo').addEventListener('click', () => {
  if (!lastGroupUndoKey || !runbookOverrideUndo[lastGroupUndoKey]) return;
  const prev = runbookOverrideUndo[lastGroupUndoKey];
  Object.keys(prev).forEach(idStr => {
    const it = collectState.items.find(x => x.id === parseInt(idStr, 10));
    if (it) it.clsOverride = prev[idStr];
  });
  delete runbookOverrideUndo[lastGroupUndoKey];
  lastGroupUndoKey = null;
  autoSaveProgress();
  if (typeof renderCollectTable === 'function') renderCollectTable();
  renderRunbookTab();
});

let _runbookFromCollect = false; // set in renderRunbookTab; write-back only with assessment data

function runbookGroupHtml(key, title, ordered, testAddedIds, byId, subtitle, warningHtml, controlsHtml, groupNo) {
  const n = ordered.length;
  // Accent = tier color of the WEAKEST core member (worst class = highest rank): it determines the
  // actually achievable plan RTO (weakest link) and separates the groups visually.
  const core = ordered.filter(it => !testAddedIds.has(it.id));
  let weakest = null;
  (core.length ? core : ordered).forEach(it => {
    const r = TIER_RANK[it.cls] !== undefined ? TIER_RANK[it.cls] : -1;
    if (weakest === null || r > weakest.r) weakest = { r: r, cls: it.cls };
  });
  const accent = (weakest && weakest.cls) ? tierColor(weakest.cls) : 'var(--vm-grey-400)';
  const chip = '<span class="rb-group__num" style="background:' + accent + ';">' + (key === 'foundation' ? 'F' : (groupNo || '•')) + '</span>';
  let html = '<div class="rb-group" style="border-left-color:' + accent + ';">';
  if (key === 'foundation') {
    html += '<div class="rb-group__head">' + chip + '<div style="font:600 14px/20px var(--font-sans);">' + title + '</div></div>' +
      '<div class="rb-group__body">';
  } else {
    // Editable group name: the proposal as placeholder, a custom name is stored (autosave/progress)
    // and picked up later by the runbook export.
    const customName = runbookNames[key] || '';
    html += '<div class="rb-group__head">' + chip +
      '<input class="collect-input" style="font:600 14px/20px var(--font-sans); min-width:340px; background:var(--surface);" data-group-name="' + escapeHtml(key) + '" ' +
      'value="' + escapeHtml(customName) + '" placeholder="' + escapeHtml(title) + '" title="Gruppenname — leer lassen für den automatischen Vorschlag">' +
      (controlsHtml || '') +
      '</div><div class="rb-group__body">';
    // Service owner (v0.12.0): responsibility at SERVICE level, coexisting with the VM owners.
    // Stored with the progress and shown in the runbook-plan export; write-back into the workload
    // list is optional and a deliberate single action.
    const svc = runbookServiceOwners[key] || {};
    const coreIds = ordered.filter(it => !testAddedIds.has(it.id)).map(it => it.id).join(',');
    html += '<div class="graph-toolbar" style="margin:2px 0 8px;">' +
      '<span class="graph-note" style="font-weight:600;">' + tr('Service-Owner: ', 'Service owner: ') + '</span>' +
      '<input class="collect-input" data-svc-key="' + escapeHtml(key) + '" data-svc-field="owner" placeholder="Team/Owner" value="' + escapeHtml(svc.owner || '') + '" style="width:130px;">' +
      '<input class="collect-input" data-svc-key="' + escapeHtml(key) + '" data-svc-field="responsible" placeholder="' + tr('Verantwortliche Person', 'Responsible person') + '" value="' + escapeHtml(svc.responsible || '') + '" style="width:150px;">' +
      '<input class="collect-input" data-svc-key="' + escapeHtml(key) + '" data-svc-field="responsibleEmail" placeholder="' + tr('E-Mail', 'Email') + '" value="' + escapeHtml(svc.responsibleEmail || '') + '" style="width:170px;">' +
      (_runbookFromCollect
        ? '<select class="collect-input" data-svc-mode="' + escapeHtml(key) + '" title="' + tr('Optional: Service-Owner zusätzlich in die Workload-Felder von Tab ① übertragen', 'Optional: additionally write the service owner into the tab ① workload fields') + '">' +
          '<option value="none">' + tr('nur als Service-Owner speichern', 'store as service owner only') + '</option>' +
          '<option value="fill">' + tr('+ in leere Workload-Felder übertragen', '+ write into empty workload fields') + '</option>' +
          '<option value="overwrite">' + tr('+ Workload-Felder überschreiben', '+ overwrite workload fields') + '</option>' +
          '</select>' +
          '<button class="btn-ghost" data-svc-apply="' + escapeHtml(key) + '" data-svc-ids="' + coreIds + '">✓ ' + tr('Anwenden', 'Apply') + '</button>' +
          '<span class="graph-note" data-svc-note="' + escapeHtml(key) + '"></span>'
        : '<span class="graph-note">' + tr('(Rückschreiben nur bei Daten aus der Erhebung möglich)', '(write-back only available for survey data)') + '</span>') +
      '</div>';
  }
  if (subtitle) html += '<div class="graph-note" style="margin-bottom:8px;">' + escapeHtml(subtitle) + '</div>';
  if (warningHtml) html += '<div class="finding" style="margin-bottom:10px;"><span class="finding__text">' + warningHtml + '</span></div>';
  html += '<div class="table-wrap"><table class="dr-table no-wrap-th"><thead><tr>' +
    '<th style="width:70px;">Start-Nr.</th><th>Name</th><th>Schutzklasse</th><th>Ziel-RTO</th><th>Verantwortlicher</th><th>Hängt ab von (in dieser Gruppe)</th>' +
    '</tr></thead><tbody>';
  const idsInGroup = new Set(ordered.map(it => it.id));
  ordered.forEach((it, pos) => {
    const isTestAdd = testAddedIds.has(it.id);
    const depNames = (it.deps || []).filter(d => idsInGroup.has(d)).map(d => byId[d] ? byId[d].name : ('#' + d));
    const orderCell = key === 'foundation'
      ? '<strong>' + (pos + 1) + '</strong>'
      : '<select class="collect-input" style="width:60px;" data-order-group="' + escapeHtml(key) + '" data-order-item="' + it.id + '">' +
        Array.from({ length: n }, (_, i) =>
          '<option value="' + (i + 1) + '"' + (i === pos ? ' selected' : '') + '>' + (i + 1) + '</option>').join('') +
        '</select>';
    const resp = (it.responsible || '').trim();
    const respStr = resp ? (resp + ((it.responsibleEmail || '').trim() ? ' (' + it.responsibleEmail.trim() + ')' : '')) : '–';
    html += '<tr>' +
      '<td>' + orderCell + '</td>' +
      '<td><strong>' + escapeHtml(it.name) + '</strong>' + (isTestAdd ? ' <span class="badge badge-ack">Foundation eingeblendet</span>' : '') + '</td>' +
      '<td><span class="badge"><span class="badge-dot" style="background:' + tierColor(it.cls) + '"></span>' + escapeHtml(tierLabel(it.cls)) + '</span></td>' +
      '<td>' + escapeHtml(it.rto || '–') + '</td>' +
      '<td>' + escapeHtml(respStr) + '</td>' +
      '<td>' + (depNames.length ? escapeHtml(depNames.join(', ')) : '–') + '</td>' +
      '</tr>';
  });
  html += '</tbody></table></div></div></div>'; // table-wrap + body + group
  return html;
}

document.getElementById('runbook-include-foundational').addEventListener('change', () => {
  renderRunbookTab();
});
document.getElementById('btn-runbook-refresh').addEventListener('click', () => {
  runbookOrders = {};
  renderRunbookTab();
});
