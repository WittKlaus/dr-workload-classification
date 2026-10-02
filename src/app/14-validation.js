// ================================================================================================
// BLOCK 14 · Tab 1 validation against the original source file
// ------------------------------------------------------------------------------------------------
// Depends : Blocks 4, 10, 11, SheetJS.
// Provides: handleValidateFile() (reads the file through the import pipeline: pickBestSheet, guessHeaderRow,
//           classifyImportRows with the current filter settings), evaluateValidation(ctx, items) (report builder,
//           no DOM writes), runValidation(ctx) (shows one source, refreshes the marks of all validated sources),
//           coverageHtml()/coverageBlockHtml() (clickable badges, re-check button), refreshValidatedSources(),
//           recheckAllValidations(), validationLine()
// Note    : v0.15.0 — a file is compared against the workloads that carry it as source (item.source);
//           rows the import filters skip are never "missing". Legacy states without sources fall back to the whole list.
//           v0.15.1 — validatedSources keeps the parsed file per source for the session; a badge click re-runs it.
// ================================================================================================
// ---------------- Tab 2: validation against the original file ----------------

const validateDropZone = document.getElementById('validate-drop-zone');
const validateFileInput = document.getElementById('validate-file-input');
const validateDropLabel = document.getElementById('validate-drop-label');

validateDropZone.addEventListener('click', () => validateFileInput.click());
validateDropZone.addEventListener('dragover', (e) => { e.preventDefault(); validateDropZone.classList.add('dragover'); });
validateDropZone.addEventListener('dragleave', () => validateDropZone.classList.remove('dragover'));
validateDropZone.addEventListener('drop', (e) => { e.preventDefault(); validateDropZone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleValidateFile(e.dataTransfer.files[0]); });
validateFileInput.addEventListener('change', (e) => { if (e.target.files.length) handleValidateFile(e.target.files[0]); });

function validationLine(icon, cssClass, text) {
  return '<div class="finding ' + cssClass + '"><span class="finding__text">' + icon + ' ' + text + '</span></div>';
}

let lastValidation = null;      // {fileName, headers, dataRows, sheetName} — the run currently shown
// fileName -> {ok, missing, extra, mismatches, at, ctx}. Session only (v0.15.1): the parsed file (ctx) is kept so
// that every validated source can be re-evaluated against the CURRENT list — on a badge click and on every run.
// Nothing of this goes into the progress file: the raw rows are customer data and the marks are only meaningful
// for the list as it is right now.
const validatedSources = new Map();

function handleValidateFile(file) {
  validateDropLabel.textContent = tr('⏳ Verarbeite ', '⏳ Processing ') + file.name + ' ...';
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      // Same reading pipeline as the import (block 10): CSV encoding sniff, best sheet, header-row detection
      const data = new Uint8Array(e.target.result);
      let wb;
      if (/\.csv$/i.test(file.name)) {
        let text = null;
        if (data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) text = new TextDecoder('utf-8').decode(data.subarray(3));
        else { try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); } catch (err) { text = null; } }
        wb = text !== null ? XLSX.read(text, { type: 'string' }) : XLSX.read(data, { type: 'array' });
      } else {
        wb = XLSX.read(data, { type: 'array' });
      }
      const sheetName = pickBestSheet(wb);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
      const hr = guessHeaderRow(rows);
      const headers = (rows[hr] || []).map(v => (v || '').toString());
      const dataRows = rows.slice(hr + 1).filter(r => r.some(v => v !== ''));
      validateDropLabel.textContent = '✅ ' + file.name + tr(' (Blatt "', ' (sheet "') + sheetName + tr('", Kopfzeile ', '", header row ') + (hr + 1) + ')';
      lastValidation = { fileName: file.name, headers: headers, dataRows: dataRows, sheetName: sheetName };
      runValidation(lastValidation);
    } catch (err) {
      validateDropLabel.textContent = tr('❌ Fehler: ', '❌ Error: ') + err.message;
    }
  };
  reader.readAsArrayBuffer(file);
}

// Source label of an item as shown in the coverage line (manual rows have no import source)
function itemSources(it) { return (it.source || '').split(' + ').map(s => s.trim()).filter(Boolean); }
function coverageHtml(items, activeName) {
  const counts = new Map();
  items.forEach(it => { const src = itemSources(it); (src.length ? src : [tr('manuell erfasst', 'entered manually')]).forEach(s => counts.set(s, (counts.get(s) || 0) + 1)); });
  // Sources validated in this session whose workloads are all gone from the list still get a badge (0) — otherwise
  // a fully deleted source would silently disappear from the coverage line.
  validatedSources.forEach((v, name) => { if (!counts.has(name)) counts.set(name, 0); });
  const parts = [...counts.entries()].map(([s, n]) => {
    const v = validatedSources.get(s);
    const mark = v ? (v.ok ? ' ✅' : ' ⚠') : '';
    const label = escapeHtml(s) + ' · ' + n + mark;
    if (v && v.ctx) {
      const tip = s === activeName ? tr('Wird angezeigt · Klick prüft diese Quelle erneut', 'Shown below · click re-checks this source')
                                   : tr('Ergebnis dieser Quelle gegen die aktuelle Liste anzeigen', 'Show the result for this source against the current list');
      return '<button type="button" class="badge badge--link' + (s === activeName ? ' badge--active' : '') + '" data-val-src="' + escapeHtml(s) + '" title="' + escapeHtml(tip) + '">' + label + '</button>';
    }
    return '<span class="badge" title="' + escapeHtml(tr('In dieser Sitzung noch nicht geprüft — Datei erneut hochladen', 'Not validated in this session — upload the file again')) + '">' + label + '</span>';
  });
  return parts.length ? parts.join(' ') : '–';
}
function coverageBlockHtml(items, activeName) {
  return '<div class="graph-note validation-coverage" style="margin-bottom:8px;"><strong>' + tr('Quellen in der Liste: ', 'Sources in the list: ') + '</strong>' + coverageHtml(items, activeName) +
    (validatedSources.size ? '<br>' + tr('✅ = mit dieser Quelldatei geprüft, ohne Abweichung · ⚠ = geprüft, mit Abweichungen · Klick auf eine geprüfte Quelle zeigt ihr Ergebnis (immer gegen den aktuellen Stand neu berechnet)',
      '✅ = validated against its file without deviations · ⚠ = validated, with deviations · click a validated source to show its result (always recomputed against the current list)') +
      ' <button type="button" class="btn-ghost" id="btn-validation-recheck" style="margin-left:10px; padding:3px 10px; font-size:12px;" title="' +
      escapeHtml(tr('Alle in dieser Sitzung geprüften Quellen gegen die aktuelle Liste neu prüfen', 'Re-check all sources validated in this session against the current list')) + '">↻ ' +
      tr('Erneut prüfen', 'Re-check') + ' (' + validatedSources.size + ')</button>' : '') + '</div>';
}
// "Re-check": every validated source against the current list, the shown source stays the shown one
function recheckAllValidations() {
  if (!lastValidation) return;
  runValidation(lastValidation); // re-runs the shown source and refreshes the marks of all others
}
// Re-evaluate every other validated source against the current list so that the marks stay honest
function refreshValidatedSources(activeName) {
  validatedSources.forEach((v, name) => {
    if (name === activeName || !v.ctx) return;
    const r = evaluateValidation(v.ctx, collectState.items);
    if (r.fatal) return;
    v.ok = r.ok; v.missing = r.missing.length; v.extra = r.extraCount; v.mismatches = r.mismatchCount;
  });
}
// Badge click → show that source's result (re-run, not cached)
document.getElementById('validation-report').addEventListener('click', (e) => {
  if (e.target.closest('#btn-validation-recheck')) { recheckAllValidations(); return; }
  const b = e.target.closest('[data-val-src]');
  if (!b) return;
  const v = validatedSources.get(b.getAttribute('data-val-src'));
  if (v && v.ctx) runValidation(v.ctx);
});

// Builds the report for ONE source file against `items`. No DOM writes (reads the three filter checkboxes only),
// so it can run for the shown source and silently for all other validated sources.
function evaluateValidation(ctx, items) {
  const headers = ctx.headers, dataRows = ctx.dataRows, fileName = ctx.fileName || '';
  const mapping = {};
  TARGET_FIELDS.forEach(f => { mapping[f.key] = guessColumn(headers, f.keywords); });
  let html = '';
  if (mapping.name < 0) {
    return { fatal: true, html: validationLine('❌', '', tr('Keine Namens-Spalte in der Quelldatei erkannt — Validierung nicht möglich. Bitte prüfen, ob die richtige Datei/das richtige Arbeitsblatt geladen wurde.',
      'No name column detected in the source file — validation not possible. Please check whether the correct file/worksheet was loaded.')) };
  }

  // (1) Same pipeline and the same filter settings as the import: skipped rows are reported, never "missing"
  const exclTemplates = document.getElementById('excl-templates').checked;
  const exclStructural = document.getElementById('excl-structural').checked;
  const exclReplicas = document.getElementById('excl-replicas').checked;
  const sizeFactor = mapping.size >= 0 ? detectSizeFactor(headers[mapping.size]) : 1;
  const classified = classifyImportRows(dataRows, headers, mapping, {
    exclTemplates: exclTemplates, excl: findExclusionColumns(headers), exclStructural: exclStructural, exclReplicas: exclReplicas, sizeFactor: sizeFactor
  });
  const sourceMap = new Map();
  classified.parsed.forEach(p => { if (!sourceMap.has(p.name.toLowerCase())) sourceMap.set(p.name.toLowerCase(), p); });
  const sk = classified.skip;
  const skippedParts = [];
  if (sk.template) skippedParts.push(sk.template + tr(' Template(s)/SRM-Platzhalter', ' template(s)/SRM placeholder(s)'));
  if (sk.system) skippedParts.push(sk.system + tr(' vSphere-System-VM(s)', ' vSphere system VM(s)'));
  const structural = sk.header + sk.subtotal + sk.section;
  if (structural) skippedParts.push(structural + tr(' Struktur-Zeile(n)', ' structural row(s)'));
  if (sk.replica) skippedParts.push(sk.replica + tr(' Replica(s)', ' replica(s)'));

  // (3) Source-aware scope: compare against the workloads that came from THIS file. Legacy states without
  //     sources (or a renamed file) fall back to the whole list — and say so.
  const scoped = items.filter(it => itemSources(it).includes(fileName));
  const scopeAll = scoped.length === 0;
  const scopeItems = scopeAll ? items : scoped;
  const itemsByName = new Map();
  items.forEach(it => { if (it.name.trim()) itemsByName.set(it.name.trim().toLowerCase(), it); });

  html += validationLine('ℹ', 'finding--info', tr('Abgleich „', 'Comparison "') + escapeHtml(fileName) + tr('": ', '": ') + sourceMap.size + tr(' Workloads in der Quelldatei', ' workloads in the source file') +
    (skippedParts.length ? tr(' (wie beim Import übersprungen: ', ' (skipped as on import: ') + skippedParts.join(', ') + ')' : '') +
    (scopeAll
      ? tr(' gegen die gesamte Liste (' + items.length + ') — kein Workload trägt diese Datei als Quelle (älterer Stand oder umbenannte Datei).', ' against the whole list (' + items.length + ') — no workload carries this file as its source (older state or renamed file).')
      : tr(' gegen ' + scopeItems.length + ' Workloads aus dieser Quelle.', ' against ' + scopeItems.length + ' workloads from this source.')) +
    tr(' Verglichene Felder: Name', ' Compared fields: name') + (mapping.size >= 0 ? tr(', Größe', ', size') : '') + (mapping.os >= 0 ? ', OS' : '') + (mapping.location >= 0 ? tr(', Standort/Cluster', ', location/cluster') : '') + '.');

  // (2) Missing: in the source but not in the list — deliberately deleted ones are info, the rest a warning
  const tombNames = new Set((typeof deletedTombstones !== 'undefined' ? deletedTombstones : []).map(t => t.name.toLowerCase()));
  const missingAll = [...sourceMap.values()].filter(s => !itemsByName.has(s.name.toLowerCase()));
  const missingDeleted = missingAll.filter(s => tombNames.has(s.name.toLowerCase()));
  const missing = missingAll.filter(s => !tombNames.has(s.name.toLowerCase()));
  let warnings = 0;
  if (missingDeleted.length) {
    html += validationLine('ℹ', 'finding--info', missingDeleted.length + tr(' Workload(s) der Quelldatei wurden in der Liste bewusst gelöscht: ', ' workload(s) from the source file were deliberately deleted from the list: ') + escapeHtml(missingDeleted.map(s => s.name).join(', ')));
  }
  if (missing.length) {
    warnings++;
    html += validationLine('⚠', '', '<strong>' + missing.length + tr(' Workload(s) aus der Quelldatei fehlen in der Liste:</strong> ', ' workload(s) from the source file are missing in the list:</strong> ') +
      escapeHtml(missing.map(s => s.name).join(', ')) +
      ' <button class="btn-ghost" id="btn-validation-import-missing" style="margin-left:8px;">⬇ ' + tr('Fehlende nachimportieren', 'Import missing workloads') + '</button>');
  } else {
    html += validationLine('✅', 'finding--ok', tr('Alle Workloads der Quelldatei sind in der Liste vorhanden', 'All workloads from the source file are present in the list') + (missingDeleted.length ? tr(' (bis auf die bewusst gelöschten).', ' (except the deliberately deleted ones).') : '.'));
  }

  // Extra: in scope but not in the source — renamed or changed by accident (manual rows are info)
  const extra = scopeItems.filter(it => it.name.trim() && !sourceMap.has(it.name.trim().toLowerCase()));
  const extraManual = extra.filter(it => (it.note || '').includes('manuell erfasst') || !itemSources(it).length);
  const extraOther = extra.filter(it => !extraManual.includes(it));
  if (extraOther.length) {
    warnings++;
    html += validationLine('⚠', '', '<strong>' + extraOther.length + tr(' Workload(s) mit dieser Quelle kommen in der Quelldatei nicht vor:</strong> ', ' workload(s) with this source do not appear in the source file:</strong> ') +
      escapeHtml(extraOther.map(it => it.name).join(', ')) + tr(' — prüfen, ob umbenannt oder versehentlich verändert.', ' — check whether renamed or changed accidentally.'));
  }
  if (extraManual.length && scopeAll) {
    html += validationLine('ℹ', 'finding--info', extraManual.length + tr(' manuell erfasste(r) Workload(s) (erwartungsgemäß nicht in der Quelldatei): ', ' manually added workload(s) (expectedly not in the source file): ') + escapeHtml(extraManual.map(it => it.name).join(', ')));
  }
  if (!extraOther.length) {
    html += validationLine('✅', 'finding--ok', scopeAll
      ? tr('Keine unerklärten Workloads in der Liste, die nicht auch in der Quelldatei stehen.', 'No unexplained workloads in the list that are not also in the source file.')
      : tr('Alle Workloads aus dieser Quelle stehen auch in der Quelldatei.', 'All workloads from this source are also in the source file.'));
  }

  // Field comparison per workload (only where both sides have a value); the size unit follows the column name
  const mismatches = [];
  scopeItems.forEach(it => {
    const src = sourceMap.get(it.name.trim().toLowerCase());
    if (!src) return;
    if (mapping.size >= 0 && src.sizeGiB !== '' && it.sizeGiB !== '' && it.sizeGiB !== undefined && Math.abs(parseFloat(it.sizeGiB) - src.sizeGiB) > 0.15) {
      mismatches.push(escapeHtml(it.name) + tr(': Größe ', ': size ') + it.sizeGiB + tr(' GiB in der Liste vs. ', ' GiB in the list vs. ') + src.sizeGiB + tr(' GiB in der Quelle', ' GiB in the source'));
    }
    if (mapping.os >= 0 && src.os && (it.os || '').trim() && it.os.trim().toLowerCase() !== src.os.toLowerCase()) {
      mismatches.push(escapeHtml(it.name) + ': OS "' + escapeHtml(it.os) + '" vs. "' + escapeHtml(src.os) + '"');
    }
    if (mapping.location >= 0 && src.location && (it.location || '').trim() && it.location.trim().toLowerCase() !== src.location.toLowerCase()) {
      mismatches.push(escapeHtml(it.name) + tr(': Standort/Cluster "', ': location/cluster "') + escapeHtml(it.location) + '" vs. "' + escapeHtml(src.location) + '"');
    }
  });
  if (mismatches.length) {
    warnings++;
    html += validationLine('⚠', '', '<strong>' + mismatches.length + tr(' Feld-Abweichung(en) gegenüber der Quelldatei:</strong><br>', ' field deviation(s) from the source file:</strong><br>') + mismatches.join('<br>'));
  } else {
    html += validationLine('✅', 'finding--ok', tr('Keine Feld-Abweichungen (Größe/OS/Standort) zwischen Liste und Quelldatei.', 'No field deviations (size/OS/location) between list and source file.'));
  }

  // Internal consistency check (independent of the source file, always over the whole list)
  const nameCounts = {};
  items.forEach(it => { const k = it.name.trim().toLowerCase(); if (k) nameCounts[k] = (nameCounts[k] || 0) + 1; });
  const dupes = Object.keys(nameCounts).filter(k => nameCounts[k] > 1);
  if (dupes.length) { warnings++; html += validationLine('⚠', '', '<strong>' + tr('Doppelte Workload-Namen in der Liste:', 'Duplicate workload names in the list:') + '</strong> ' + escapeHtml(dupes.join(', ')) + tr(' — Abhängigkeiten über Namen sind dann nicht mehr eindeutig.', ' — name-based dependencies are then no longer unambiguous.')); }
  const unnamed = items.filter(it => !it.name.trim());
  if (unnamed.length) { warnings++; html += validationLine('⚠', '', unnamed.length + tr(' Zeile(n) ohne Workload-Namen (z. B. manuell hinzugefügt und noch nicht benannt): #', ' row(s) without a workload name (e.g. added manually and not yet named): #') + unnamed.map(it => it.id).join(', #')); }
  const valNameIdx = buildNameIndex();
  const withBrokenDeps = items.filter(it => resolveDepsText(it.depsText, it.id, valNameIdx).unresolved.length > 0);
  if (withBrokenDeps.length) { warnings++; html += validationLine('⚠', '', '<strong>' + tr('Nicht auflösbare Abhängigkeits-Einträge bei:', 'Unresolvable dependency entries at:') + '</strong> ' + escapeHtml(withBrokenDeps.map(it => it.name || ('#' + it.id)).join(', '))); }
  if (!dupes.length && !unnamed.length && !withBrokenDeps.length) {
    html += validationLine('✅', 'finding--ok', tr('Interner Konsistenz-Check bestanden: keine doppelten/leeren Namen, alle Abhängigkeiten auflösbar.', 'Internal consistency check passed: no duplicate/empty names, all dependencies resolvable.'));
  }

  // The per-source mark reflects deviations against the FILE only; the internal consistency check above is
  // independent of the file and is reported, but does not turn a source's mark to ⚠.
  return { fatal: false, html: html, ok: !missing.length && !extraOther.length && !mismatches.length, warnings: warnings,
    missing: missing, extraCount: extraOther.length, mismatchCount: mismatches.length, sizeFactor: sizeFactor };
}

function runValidation(ctx) {
  const report = document.getElementById('validation-report');
  const fileName = ctx.fileName || '';
  const items = collectState.items;
  const r = evaluateValidation(ctx, items);
  if (r.fatal) { report.innerHTML = r.html; return; }
  lastValidation = ctx;
  // Coverage bookkeeping for this session: this source, then all other validated sources against the current list
  validatedSources.set(fileName, { ok: r.ok, missing: r.missing.length, extra: r.extraCount, mismatches: r.mismatchCount, at: new Date(), ctx: ctx });
  refreshValidatedSources(fileName);
  report.innerHTML = coverageBlockHtml(items, fileName) + r.html;
  // (5) Reconcile: import the missing workloads through the normal path (duplicate dialog logic, tombstones cleared)
  const btn = document.getElementById('btn-validation-import-missing');
  if (btn) btn.addEventListener('click', () => {
    commitImport(r.missing.map(s => Object.assign({}, s)), 'skip', 0, fileName, r.sizeFactor);
    if (lastValidation) runValidation(lastValidation);
  });
  if (typeof i18nApply === 'function') i18nApply(report);
}
