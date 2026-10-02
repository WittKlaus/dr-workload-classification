// ================================================================================================
// BLOCK 9 · Tab 1 options panel: editable classification rules
// ------------------------------------------------------------------------------------------------
// Depends : Block 4 (SCORE_THRESHOLDS, CLASS_DEFS, TIER_LABELS).
// Provides: renderOptionsTable(), renderOptionsFormula()
// Note    : Thresholds, targets and display names are data; they travel with the progress file.
// ================================================================================================
// ================= Tab 2: Options panel (editable classification rules) =================

function renderOptionsTable() {
  const table = document.getElementById('options-table');
  let html = '<thead><tr><th>Interner Schlüssel</th><th>Anzeigename</th><th>Score ab (automatische Einstufung)</th>' +
    '<th>Ziel-RPO (Anzeige)</th><th title="Numerisches Ziel in Stunden für die automatische Gap-Prüfung. 0 = CDP/kontinuierlich.">Ziel-RPO (h)</th>' +
    '<th>Ziel-RTO (Anzeige)</th><th title="Numerisches Ziel in Stunden für die automatische Gap-Prüfung.">Ziel-RTO (h)</th>' +
    '<th>Empfohlene Veeam/VRO-Konfiguration</th></tr></thead><tbody>';
  TIER_ORDER.forEach(t => {
    const def = CLASS_DEFS[t];
    const threshold = SCORE_THRESHOLDS[t];
    html += '<tr data-tier="' + escapeHtml(t) + '">' +
      '<td><strong style="color:' + tierColor(t) + '; font-size:11.5px;">' + escapeHtml(t) + '</strong></td>' +
      '<td><input class="collect-input w-med" data-role="label" value="' + escapeHtml(TIER_LABELS[t]) + '"></td>' +
      '<td>' + (t === "Tier 0 – Foundation"
        ? '<span class="graph-note">– (über "Foundational Dependency" gesteuert)</span>'
        : '<input class="collect-input" data-role="threshold" type="number" step="0.1" min="0" max="5" style="width:70px;" value="' + threshold + '">') +
      '</td>' +
      '<td><input class="collect-input" data-role="rpo" value="' + escapeHtml(def.rpo) + '"></td>' +
      '<td><input class="collect-input" data-role="rpoH" type="number" step="0.25" min="0" style="width:70px;" value="' + (typeof def.rpoH === 'number' ? def.rpoH : '') + '"></td>' +
      '<td><input class="collect-input" data-role="rto" value="' + escapeHtml(def.rto) + '"></td>' +
      '<td><input class="collect-input" data-role="rtoH" type="number" step="0.25" min="0" style="width:70px;" value="' + (typeof def.rtoH === 'number' ? def.rtoH : '') + '"></td>' +
      '<td><input class="collect-input" data-role="config" value="' + escapeHtml(def.config) + '"></td>' +
      '</tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;

  renderOptionsFormula();
  if (typeof i18nApply === 'function') i18nApply(table);
}

// Show the calculation basis live: formula (fixed) + classification chain from the CURRENT table
// values (thresholds/display names). A separate function so it can be refreshed on every input
// WITHOUT re-rendering the table (which would steal the focus).
function renderOptionsFormula() {
  const formulaBox = document.getElementById('options-formula');
  if (formulaBox) {
    const fmt = v => Number(v).toLocaleString(tr('de-DE', 'en-GB'));
    formulaBox.innerHTML =
      '<strong>' + tr('Berechnungsgrundlage:', 'Calculation basis:') + '</strong> ' +
      tr('Score = Business Impact (BI) × 0,45 + Regulatorik (Reg) × 0,35 + Datensensitivität (DS) × 0,20',
         'Score = Business Impact (BI) × 0.45 + Regulatory (Reg) × 0.35 + Data Sensitivity (DS) × 0.20') +
      ' — ' + tr('Recovery-Komplexität (RK) fließt nicht in den Score ein.', 'Recovery Complexity (RK) does not affect the score.') +
      '<br><strong>' + tr('Automatische Einstufung', 'Automatic classification') + '</strong> ' +
      tr('(ergibt sich live aus den Werten dieser Tabelle):', '(derived live from the values in this table):') + ' ' +
      tr('Score ≥ ', 'Score ≥ ') + fmt(SCORE_THRESHOLDS['Tier 1 – Platinum']) + ' → ' + escapeHtml(tierLabel('Tier 1 – Platinum')) +
      ' · ≥ ' + fmt(SCORE_THRESHOLDS['Tier 2 – Gold']) + ' → ' + escapeHtml(tierLabel('Tier 2 – Gold')) +
      ' · ≥ ' + fmt(SCORE_THRESHOLDS['Tier 3 – Silver']) + ' → ' + escapeHtml(tierLabel('Tier 3 – Silver')) +
      ' · ' + tr('darunter', 'below') + ' → ' + escapeHtml(tierLabel('Tier 4 – Bronze')) +
      ' · ' + tr('Foundational-Haken', 'Foundational checkbox') + ' → ' + escapeHtml(tierLabel('Tier 0 – Foundation'));
  }
}

document.getElementById('options-table').addEventListener('input', (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const tier = tr.getAttribute('data-tier');
  const role = e.target.getAttribute('data-role');
  if (role === 'threshold') {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) SCORE_THRESHOLDS[tier] = v;
  } else if (role === 'label') {
    TIER_LABELS[tier] = e.target.value.trim() || tier;
  } else if (['rpo', 'rto', 'config'].includes(role)) {
    CLASS_DEFS[tier][role] = e.target.value;
  } else if (role === 'rpoH' || role === 'rtoH') {
    const v = parseFloat(e.target.value);
    CLASS_DEFS[tier][role] = isNaN(v) ? undefined : v;
  }
  renderOptionsFormula(); // classification chain follows the inputs live (without a table re-render)
  if (typeof renderCollectTable === 'function' && collectState.items.length) renderCollectTable();
  if (typeof autoSaveProgress === 'function') autoSaveProgress();
});

document.getElementById('btn-reset-options').addEventListener('click', () => {
  SCORE_THRESHOLDS = JSON.parse(JSON.stringify(DEFAULT_SCORE_THRESHOLDS));
  CLASS_DEFS = defaultClassDefs();
  TIER_ORDER.forEach(t => TIER_LABELS[t] = t);
  renderOptionsTable();
  if (collectState.items.length) renderCollectTable();
  autoSaveProgress();
});

renderOptionsTable();
