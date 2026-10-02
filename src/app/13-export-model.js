// ================================================================================================
// BLOCK 13 · Excel export data model (plain SheetJS fallback) and tab 1 → tab 2 bridge
// ------------------------------------------------------------------------------------------------
// Depends : Blocks 4, 11, 15 (computeRunbookStructure), SheetJS.
// Provides: buildWorkloadRegisterSheet() (schema: columns A–R stable, new columns appended), buildDashboardSheet(),
//           buildRunbookPlanSheet(), exportPlainXlsx(), buildViewItemsFromCollect(), maybeSyncCollectToView()
// Note    : Sheet names and note markers are always English (data), independent of the UI language.
// ================================================================================================
// ---------------- Tab 2: export to xlsx (matches DR_Workload_Klassifizierungstool.xlsx layout) ----------------

// Folds the separate type/OS/location/size/note/validated fields (real columns in the browser
// table) into the single "Geschäftsfunktion / Beschreibung" free-text column the master Excel
// schema uses. Kept unchanged so the exported file stays fully compatible with
// DR_Workload_Klassifizierungstool.xlsx and can be re-imported into tab 2.
function buildDescription(it) {
  const parts = [it.type, it.os, it.location, (it.sizeGiB !== '' && it.sizeGiB !== undefined && it.sizeGiB !== null) ? (it.sizeGiB + ' GiB') : '', it.note].filter(Boolean);
  if (it.validated) parts.push(tr('[vom Kunden validiert]', '[validated by customer]'));
  return parts.join(' · ');
}

function buildKlassenMatrixSheet() {
  const aoa = [];
  aoa[2] = [tr("Score (untere Grenze)", "Score (lower bound)"), tr("Klasse (für Formel)", "Class (for formula)")];
  aoa[3] = [SCORE_THRESHOLDS["Tier 4 – Bronze"], "Tier 4 – Bronze"];
  aoa[4] = [SCORE_THRESHOLDS["Tier 3 – Silver"], "Tier 3 – Silver"];
  aoa[5] = [SCORE_THRESHOLDS["Tier 2 – Gold"], "Tier 2 – Gold"];
  aoa[6] = [SCORE_THRESHOLDS["Tier 1 – Platinum"], "Tier 1 – Platinum"];
  aoa[10] = [undefined, tr("Klasse", "Class"), tr("Ziel-RPO", "Target RPO"), tr("Ziel-RTO", "Target RTO"), tr("Empfohlene Veeam / VRO-Konfiguration", "Recommended Veeam / VRO configuration"), tr("Typische Systeme (Beispiele)", "Typical systems (examples)"), tr("Testfrequenz", "Test frequency"), tr("Rang", "Rank")];
  const typical = {
    "Tier 0 – Foundation": "Active Directory, DNS, PKI, Backup-Infrastruktur selbst, Kernnetzwerk",
    "Tier 1 – Platinum": "Kern-Transaktionssysteme, DORA-/NIS2-pflichtige Systeme, ERP-Kern",
    "Tier 2 – Gold": "Wichtige Business-Applikationen, Kollaborationsplattformen",
    "Tier 3 – Silver": "Interne Fachanwendungen",
    "Tier 4 – Bronze": "Archiv-/Testsysteme, unkritische Dienste"
  };
  const testFreq = {
    "Tier 0 – Foundation": "Bei jedem DR-Test", "Tier 1 – Platinum": "Monatlich", "Tier 2 – Gold": "Quartalsweise",
    "Tier 3 – Silver": "Halbjährlich", "Tier 4 – Bronze": "Jährlich (Stichprobe)"
  };
  TIER_ORDER.forEach((t, i) => {
    aoa[11 + i] = [undefined, t, CLASS_DEFS[t].rpo, CLASS_DEFS[t].rto, CLASS_DEFS[t].config, typical[t], testFreq[t], TIER_RANK[t]];
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 45 }, { wch: 32 }, { wch: 16 }, { wch: 8 }];
  return ws;
}

function buildWorkloadRegisterSheet(items) {
  // Schema evolution: columns 1–18 (A–R) stay exactly stable for backward compatibility; anything
  // new is appended at the END only (S+). This way tab 2 reads old AND new files.
  const header = ["#", tr("Workload-Name", "Workload name"), tr("Owner / Systemverantwortlicher", "Owner / system owner"), tr("Geschäftsfunktion / Beschreibung", "Business function / description"),
    "Foundational Dependency?", "Business Impact (1-5)", tr("Regulatorik (1-5)", "Regulatory (1-5)"), tr("Datensensitivität (1-5)", "Data sensitivity (1-5)"),
    tr("Recovery-Komplexität (1-5) – Aufwand/Risiko, NICHT Teil des Scores", "Recovery complexity (1-5) – effort/risk, NOT part of the score"), "Score", tr("Schutzklasse", "Protection class"), tr("Ziel-RPO", "Target RPO"), tr("Ziel-RTO", "Target RTO"),
    tr("Empfohlene Veeam/VRO-Konfiguration", "Recommended Veeam/VRO configuration"), tr("Ist-RPO (h; 0=CDP, leer=nicht erhoben)", "Actual RPO (h; 0=CDP, empty=not surveyed)"), tr("Ist-RTO (h)", "Actual RTO (h)"), tr("Gap / Maßnahmen", "Gap / actions"),
    tr("Abhängig von (Workload-IDs, kommagetrennt)", "Depends on (workload IDs, comma-separated)"),
    tr("Verantwortlicher", "Responsible person"), tr("Verantwortlicher E-Mail", "Responsible person email"), tr("Abhängig von Foundation? (Ja/Nein)", "Depends on foundation? (Ja/Nein)"),
    "Source"];
  const aoa = [header];
  const nameIdx = buildNameIndex();
  items.forEach(it => {
    const resolved = resolveDepsText(it.depsText, it.id, nameIdx);
    aoa.push([
      it.id, it.name, it.owner || "", buildDescription(it), it.foundational || "Nein",
      it.bi === "" ? null : it.bi, it.reg === "" ? null : it.reg, it.ds === "" ? null : it.ds, it.rk === "" ? null : it.rk,
      null, null, null, null, null,
      isBlankNum(it.istRpo) ? "" : it.istRpo, isBlankNum(it.istRto) ? "" : it.istRto, it.gap || "", resolved.ids.join(","),
      it.responsible || "", it.responsibleEmail || "", it.dependsOnFoundation === false ? "Nein" : "Ja",
      it.source || ""
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  items.forEach((it, idx) => {
    const r = idx + 2; // 1 header row
    const score = computeScore(it.bi, it.reg, it.ds);
    const calculatedCls = classifyScore(score, it.foundational);
    const cls = it.outOfScope ? OUT_OF_SCOPE_CLASS : (it.clsOverride || calculatedCls);
    const manualNote = (!it.outOfScope && it.clsOverride && it.clsOverride !== calculatedCls) ? ' [manuell überschrieben]' : '';
    ws['J' + r] = (it.outOfScope || score === null) ? { t: 's', v: '' } :
      { t: 'n', f: 'IF(COUNTBLANK(F' + r + ':H' + r + ')>0,"",F' + r + '*0.45+G' + r + '*0.35+H' + r + '*0.2)', v: score };
    // K carries a manual override (or "Out of Scope") as a plain value (no formula) so the TAM's
    // explicit decision is preserved on re-import; automatic cells keep the live formula.
    if (it.outOfScope) {
      ws['K' + r] = { t: 's', v: cls };
    } else if (it.clsOverride) {
      ws['K' + r] = { t: 's', v: cls + manualNote };
    } else {
      ws['K' + r] = !cls ? { t: 's', v: '' } :
        { t: 's', f: 'IF(J' + r + '="","",IF(OR(E' + r + '="Ja",E' + r + '="Yes"),"Tier 0 – Foundation",INDEX(\'Class-Matrix\'!$B$4:$B$7,MATCH(J' + r + ',\'Class-Matrix\'!$A$4:$A$7,1))))', v: cls };
    }
    // "Out of Scope" has no entry in the class matrix: VLOOKUP would return #N/A, so RPO/RTO/config
    // are deliberately left empty for this case instead of writing a formula.
    const targets = CLASS_DEFS[cls] || { rpo: '', rto: '', config: '' };
    const hasMatrixEntry = !it.outOfScope && !!cls;
    ws['L' + r] = !hasMatrixEntry ? { t: 's', v: '' } : { t: 's', f: 'IF(K' + r + '="","",VLOOKUP(K' + r + ',\'Class-Matrix\'!$B$12:$H$16,2,FALSE))', v: targets.rpo };
    ws['M' + r] = !hasMatrixEntry ? { t: 's', v: '' } : { t: 's', f: 'IF(K' + r + '="","",VLOOKUP(K' + r + ',\'Class-Matrix\'!$B$12:$H$16,3,FALSE))', v: targets.rto };
    ws['N' + r] = !hasMatrixEntry ? { t: 's', v: '' } : { t: 's', f: 'IF(K' + r + '="","",VLOOKUP(K' + r + ',\'Class-Matrix\'!$B$12:$H$16,4,FALSE))', v: targets.config };
  });
  ws['!cols'] = [{ wch: 4 }, { wch: 26 }, { wch: 22 }, { wch: 34 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 34 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 22 },
    { wch: 22 }, { wch: 28 }, { wch: 14 }];
  const range = XLSX.utils.decode_range(ws['!ref']);
  range.e.r = Math.max(range.e.r, items.length);
  ws['!ref'] = XLSX.utils.encode_range(range);
  return ws;
}

function buildDashboardSheet(items) {
  const n = items.length;
  const aoa = [];
  aoa[2] = [tr("Schutzklasse", "Protection class"), tr("Anzahl Workloads", "Number of workloads")];
  TIER_ORDER.forEach((t, i) => { aoa[3 + i] = [t, null]; });
  aoa[3 + TIER_ORDER.length] = [OUT_OF_SCOPE_CLASS, null];
  aoa[4 + TIER_ORDER.length] = [tr("Gesamt erfasst", "Total recorded"), null];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  TIER_ORDER.forEach((t, i) => {
    const r = 4 + i;
    const count = items.filter(it => !it.outOfScope && (it.clsOverride || classifyScore(computeScore(it.bi, it.reg, it.ds), it.foundational)) === t).length;
    ws['B' + r] = { t: 'n', f: "COUNTIF('Workload-Register'!$K$2:$K$" + (n + 1) + ',A' + r + '&\"*\")', v: count };
  });
  const oosRow = 4 + TIER_ORDER.length;
  const oosCount = items.filter(it => it.outOfScope).length;
  ws['B' + oosRow] = { t: 'n', f: "COUNTIF('Workload-Register'!$K$2:$K$" + (n + 1) + ',A' + oosRow + '&\"*\")', v: oosCount };
  const totalRow = 5 + TIER_ORDER.length;
  ws['B' + totalRow] = { t: 'n', f: "COUNTA('Workload-Register'!$B$2:$B$" + (n + 1) + ')', v: n };
  ws['!cols'] = [{ wch: 24 }, { wch: 18 }];
  return ws;
}

function buildAnleitungSheet() {
  const aoa = [
    [tr("DR Workload-Klassifizierung – im Browser erhoben", "DR workload classification – collected in the browser") + " (" + TOOL_VERSION + ")"],
    [],
    [tr("Diese Datei wurde am ", "This file was created on ") + new Date().toLocaleString(tr('de-DE', 'en-GB')) +
      tr(" mit DR_Workload_Classification.html (Tab \"Neue Erhebung\") aus einem RVTools-/vCenter-/CMDB-Export erzeugt.",
         " with DR_Workload_Classification.html (tab \"New assessment\") from an RVTools/vCenter/CMDB export.")],
    [tr("Hinweis: Diese Datei enthält dieselbe Struktur, Formeln und Berechnungslogik wie " +
      "DR_Workload_Klassifizierungstool.xlsx, aber ohne dessen Veeam-Farbgestaltung/Diagramme " +
      "(technische Einschränkung der im Browser genutzten Bibliothek).",
      "Note: This file contains the same structure, formulas and calculation logic as " +
      "DR_Workload_Klassifizierungstool.xlsx, but without its Veeam styling/charts " +
      "(technical limitation of the library used in the browser).")],
    [tr("Manuell überschriebene Schutzklassen sind im Feld \"Schutzklasse\" als fester Wert (kein Formel-Bezug) " +
      "mit dem Zusatz \"[manuell überschrieben]\" hinterlegt. Typ/OS/Standort/Größe/Notiz/Validierungsstatus " +
      "aus der Browser-Tabelle sind in \"Geschäftsfunktion / Beschreibung\" zusammengeführt.",
      "Manually overridden protection classes are stored in the class column as a fixed value (no formula) " +
      "with the suffix \"[manuell überschrieben]\". Type/OS/location/size/note/validation status " +
      "from the browser table are merged into the description column.")],
    [tr("Methodik: siehe DR_Workload_Klassifizierungstool.xlsx, Blatt \"Anleitung\" — Gewichtung Business Impact 45% / " +
      "Regulatorik 35% / Datensensitivität 20%; Recovery-Komplexität ist ein separater Modifikator, kein Score-Kriterium.",
      "Methodology: see DR_Workload_Klassifizierungstool.xlsx, sheet \"Anleitung\" — weighting business impact 45% / " +
      "regulatory 35% / data sensitivity 20%; recovery complexity is a separate modifier, not a score criterion.")],
    [tr("Herkunft des Modells: Gewichtete Multi-Kriterien-Bewertung nach etablierter BIA-Praxis. Rahmenwerke (ISO 22301/22317, " +
      "BSI 200-4, NIST SP 800-34, BCI GPG, DORA/NIS2) fordern Kritikalitätsklassen, geben aber keine Formel/Gewichte/Schwellen vor. " +
      "Schwellen an natürlichen Mittelpunkten (2,5/3,5), Platinum bewusst auf 4,3 abgesenkt. Hilfestellung für den Workshop, " +
      "kein vorgegebener Standard — verbindliche Eichung gehört dem Kunden.",
      "Origin of the model: weighted multi-criteria scoring per established BIA practice. Frameworks (ISO 22301/22317, " +
      "BSI 200-4, NIST SP 800-34, BCI GPG, DORA/NIS2) require criticality classes but prescribe no formula/weights/thresholds. " +
      "Thresholds at natural midpoints (2.5/3.5), Platinum deliberately lowered to 4.3. Guidance for the workshop, " +
      "not a prescribed standard — the binding calibration belongs to the customer.")]
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 110 }];
  return ws;
}

// "Runbook-Plan" sheet: the same groups, names and orders as in tab 3,
// as a documented hand-over for building the VRO plans.
function buildRunbookPlanSheet(viewItems) {
  const includeFoundational = document.getElementById('runbook-include-foundational').checked;
  const s = computeRunbookStructure(viewItems);
  const aoa = [];
  aoa.push([tr('Runbook-Plan (VRO-Vorschlag) — erstellt ', 'Runbook plan (VRO proposal) — created ') + new Date().toLocaleString(tr('de-DE', 'en-GB'))]);
  aoa.push([tr('Gruppen = zusammenhängende Systeme über Abhängigkeiten. Start-Reihenfolge wie in Tab ③ festgelegt (topologisch bzw. manuell angepasst).',
    'Groups = connected systems via dependencies. Start order as defined in tab ③ (topological or manually adjusted).')]);
  aoa.push([]);
  const pushGroup = (title, ordered, testAdded, idsInGroup) => {
    aoa.push([title]);
    aoa.push([tr('Start-Nr.', 'Start no.'), 'Workload', tr('Schutzklasse', 'Protection class'), tr('Ziel-RPO', 'Target RPO'), tr('Ziel-RTO', 'Target RTO'), tr('Verantwortlicher', 'Responsible person'), tr('E-Mail', 'Email'), tr('Hängt ab von (in dieser Gruppe)', 'Depends on (within this group)'), tr('Hinweis', 'Note')]);
    ordered.forEach((it, pos) => {
      const depNames = (it.deps || []).filter(d => idsInGroup.has(d)).map(d => s.byId[d] ? s.byId[d].name : ('#' + d)).join(', ');
      aoa.push([pos + 1, it.name, tierLabel(it.cls), it.rpo || '', it.rto || '', it.responsible || '', it.responsibleEmail || '',
        depNames, testAdded.has(it.id) ? tr('Foundation eingeblendet (nicht Teil des Service-Plans)', 'foundation shown (not part of the service plan)') : '']);
    });
    aoa.push([]);
  };
  if (s.foundational.length) {
    const of_ = topoOrderMembers(s.foundational).order;
    pushGroup(tr('Foundation-Block (startet immer zuerst)', 'Foundation block (always starts first)'), of_, new Set(), new Set(of_.map(it => it.id)));
  }
  s.multiGroups.forEach((comp, idx) => {
    const g = resolveGroupOrder(comp, s.foundational, includeFoundational);
    const lead = comp.slice().sort((a, b) =>
      ((TIER_RANK[a.cls] !== undefined ? TIER_RANK[a.cls] : 9) - (TIER_RANK[b.cls] !== undefined ? TIER_RANK[b.cls] : 9)))[0];
    const autoName = tr('Gruppe ', 'Group ') + (idx + 1) + ' – ' + lead.name + (comp.length > 1 ? ' + ' + (comp.length - 1) + tr(' weitere', ' more') : '');
    // Show the service owner (if maintained) directly in the group title of the hand-over
    const svc = runbookServiceOwners[g.key] || {};
    const svcTxt = [svc.owner, svc.responsible, svc.responsibleEmail].filter(Boolean).join(', ');
    pushGroup((runbookNames[g.key] || autoName) + (svcTxt ? '  ·  ' + tr('Service-Owner: ', 'Service owner: ') + svcTxt : ''),
      g.ordered, g.testAdded, new Set(g.ordered.map(it => it.id)));
    const mix = analyzeGroupClassMix(comp);
    if (mix) {
      // Note directly below the group (replaces the blank line) so it ends up in the hand-over
      aoa[aoa.length - 1] = [groupMixText(mix, false)];
      aoa.push([]);
    }
  });
  if (s.singles.length) {
    aoa.push([tr('Einzelsysteme (keine erfassten Abhängigkeiten — Zuordnung offen)', 'Standalone systems (no recorded dependencies — assignment open)')]);
    aoa.push(['', 'Workload', tr('Schutzklasse', 'Protection class'), tr('Ziel-RPO', 'Target RPO'), tr('Ziel-RTO', 'Target RTO'), tr('Verantwortlicher', 'Responsible person'), tr('E-Mail', 'Email')]);
    s.singles.slice().sort((a, b) =>
      ((TIER_RANK[a.cls] !== undefined ? TIER_RANK[a.cls] : 9) - (TIER_RANK[b.cls] !== undefined ? TIER_RANK[b.cls] : 9)) ||
      String(a.name).localeCompare(String(b.name), 'de'))
      .forEach(it => aoa.push(['', it.name, tierLabel(it.cls), it.rpo || '', it.rto || '', it.responsible || '', it.responsibleEmail || '']));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 9 }, { wch: 30 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 28 }, { wch: 40 }, { wch: 22 }];
  return ws;
}

document.getElementById('btn-export-xlsx').addEventListener('click', () => {
  if (collectState.items.length === 0) { alert(tr('Keine Workloads zum Exportieren vorhanden.', 'No workloads available to export.')); return; }
  const fname = 'DR_Workload_Classification_Tool_surveyed_' + new Date().toISOString().slice(0, 10) + '.xlsx';
  // Preferred: formatted export through the embedded template (colors/borders/filters preserved).
  // Failover: unformatted SheetJS export if patching the template fails.
  if (typeof exportViaTemplate === 'function') {
    try { exportViaTemplate(collectState.items, fname); return; }
    catch (err) {
      console.warn('Template-Export fehlgeschlagen — Failover auf unformatierten Export:', err);
      alert(tr('Hinweis: Der formatierte Template-Export ist fehlgeschlagen — es wird eine unformatierte Datei erstellt.',
        'Note: the formatted template export failed — an unformatted file will be created.'));
    }
  }
  exportPlainXlsx(fname);
});
function exportPlainXlsx(fname) {
  const wb = XLSX.utils.book_new();
  // Sheet names ALWAYS English (independent of the UI language): the tool is primarily English and
  // files end up in an international repository. Re-import in tab 2 still accepts the old German
  // sheet names as well. "Workload-Register" stays unchanged (identical in the EN Excel set).
  XLSX.utils.book_append_sheet(wb, buildAnleitungSheet(), 'Instructions');
  XLSX.utils.book_append_sheet(wb, buildKlassenMatrixSheet(), 'Class-Matrix');
  XLSX.utils.book_append_sheet(wb, buildWorkloadRegisterSheet(collectState.items), 'Workload-Register');
  XLSX.utils.book_append_sheet(wb, buildDashboardSheet(collectState.items), 'Dashboard');
  const viewItems = buildViewItemsFromCollect();
  if (viewItems.length) {
    XLSX.utils.book_append_sheet(wb, buildRunbookPlanSheet(viewItems), 'Runbook-Plan');
  }
  XLSX.writeFile(wb, fname);
}

// Builds the item structure for view/graph in tab 2 from the assessment (tab 1).
// Out-of-scope workloads are deliberately NOT filtered out: a dependency of a protected system on an
// out-of-scope system is a real risk and must stay visible in the graph/findings
// (see computeFindings -> outOfScopeDeps).
function buildViewItemsFromCollect() {
  const nameIdx = buildNameIndex();
  return collectState.items.map(it => {
    const score = computeScore(it.bi, it.reg, it.ds);
    const calculatedCls = classifyScore(score, it.foundational);
    const cls = it.outOfScope ? OUT_OF_SCOPE_CLASS : (it.clsOverride || calculatedCls);
    const resolved = resolveDepsText(it.depsText, it.id, nameIdx);
    const targets = CLASS_DEFS[cls] || { rpo: '', rto: '', config: '' };
    return {
      id: it.id, name: it.name, owner: it.owner, desc: buildDescription(it), foundational: it.foundational,
      bi: it.bi, reg: it.reg, ds: it.ds, rk: it.rk, score: score, cls: cls || '(noch nicht bewertet)',
      manualOverride: !it.outOfScope && !!it.clsOverride && it.clsOverride !== calculatedCls,
      rpo: targets.rpo, rto: targets.rto, config: targets.config,
      istRpo: it.istRpo, istRto: it.istRto, gap: it.gap, deps: resolved.ids,
      responsible: it.responsible || '', responsibleEmail: it.responsibleEmail || '',
      dependsOnFoundation: it.dependsOnFoundation !== false
    };
  }).filter(it => TIER_RANK.hasOwnProperty(it.cls) || it.cls === OUT_OF_SCOPE_CLASS);
}

// Auto-sync: on switching to tab 2, show the current state of tab 1, unless a file was uploaded
// manually more recently (after the last tab 1 edit).
function maybeSyncCollectToView() {
  if (collectState.items.length === 0) return;
  if (lastUploadAt > lastCollectEditAt) return; // the upload is more recent → do not overwrite the view
  const items = buildViewItemsFromCollect();
  if (items.length === 0) return;
  renderAll(items);
  setViewSourceNote(tr('Datenquelle: aktuelle Erhebung aus Tab ① (', 'Data source: current assessment from tab ① (') + items.length +
    tr(' bewertete Workloads, automatisch übernommen ', ' rated workloads, synced automatically ') + new Date().toLocaleTimeString(tr('de-DE', 'en-GB')) + ').');
}

document.getElementById('btn-view-in-graph').addEventListener('click', () => {
  if (collectState.items.length === 0) { alert(tr('Keine Workloads vorhanden.', 'No workloads available.')); return; }
  const items = buildViewItemsFromCollect();
  if (items.length === 0) { alert(tr('Noch keine Workloads bewertet — bitte erst Business Impact / Regulatorik / Datensensitivität setzen (oder eine Schutzklasse manuell überschreiben).',
    'No workloads rated yet — please set business impact / regulatory / data sensitivity first (or manually override a protection class).')); return; }
  document.querySelector('.tab-btn[data-tab="tab-view"]').click();
  renderAll(items);
  setViewSourceNote(tr('Datenquelle: aktuelle Erhebung aus Tab ① (', 'Data source: current assessment from tab ① (') + items.length + tr(' bewertete Workloads).', ' rated workloads).'));
});
