// ================================================================================================
// BLOCK 6 · Tab 2 findings and recommendations
// ------------------------------------------------------------------------------------------------
// Depends : Blocks 4–5.
// Provides: computeFindings() (weakest-link, cycles, out-of-scope deps, RPO/RTO gaps), renderFindings(),
//           renderRecommendations(); acknowledgements persisted in localStorage (FINDINGS_ACK_KEY)
// ================================================================================================
function computeFindings(items) {
  const byId = {};
  items.forEach(it => byId[it.id] = it);
  const inconsistencies = [];
  const outOfScopeDeps = [];
  items.forEach(it => {
    if (it.cls === OUT_OF_SCOPE_CLASS) return; // no RTO consistency relevant for a system that is not protected itself
    const ownRank = TIER_RANK[it.cls];
    it.deps.forEach(depId => {
      const dep = byId[depId];
      if (!dep) return;
      if (dep.cls === OUT_OF_SCOPE_CLASS) {
        // eigener, dedizierter Befund statt Rang-Vergleich (Out of Scope hat keinen Rang)
        outOfScopeDeps.push({ from: it, to: dep });
      } else if (TIER_RANK[dep.cls] > ownRank) {
        inconsistencies.push({ from: it, to: dep });
      }
    });
  });

  const visited = {}, inStack = {}, cycles = [];
  function dfs(id, path) {
    if (inStack[id]) {
      const cycleStart = path.indexOf(id);
      cycles.push(path.slice(cycleStart).concat([id]));
      return;
    }
    if (visited[id]) return;
    visited[id] = true; inStack[id] = true;
    const it = byId[id];
    if (it) it.deps.forEach(depId => dfs(depId, path.concat([id])));
    inStack[id] = false;
  }
  items.forEach(it => dfs(it.id, []));

  // IMPORTANT: isBlankNum instead of a falsy check; 0 is a valid value (CDP/continuous)!
  const missingGap = items.filter(it => isBlankNum(it.istRpo) && isBlankNum(it.istRto) && it.cls !== "Tier 4 – Bronze" && it.cls !== OUT_OF_SCOPE_CLASS);

  // Automatic gap check: actual (hours) worse than the numeric class target
  const gapExceeded = [];
  items.forEach(it => {
    if (it.cls === OUT_OF_SCOPE_CLASS) return;
    const g = gapCheck(it.cls, it.istRpo, it.istRto);
    if (g.rpoGap || g.rtoGap) gapExceeded.push({ item: it, rpoGap: g.rpoGap, rtoGap: g.rtoGap });
  });

  return { inconsistencies, cycles, missingGap, outOfScopeDeps, gapExceeded, byId };
}

// ---- findings acknowledgement (persisted in localStorage, survives reloads) ----
const FINDINGS_ACK_KEY = 'dr_findings_ack_v1';
function loadAckSet() {
  try { return new Set(JSON.parse(localStorage.getItem(FINDINGS_ACK_KEY) || '[]')); }
  catch (e) { return new Set(); }
}
function saveAckSet(set) {
  try { localStorage.setItem(FINDINGS_ACK_KEY, JSON.stringify([...set])); } catch (e) { /* non-fatal */ }
}
let findingsAckSet = loadAckSet();

function findingRowHtml(key, cssClass, bodyHtml) {
  const acked = findingsAckSet.has(key);
  return '<div class="finding ' + cssClass + (acked ? ' finding--ack' : '') + '" data-finding-key="' + escapeHtml(key) + '">' +
    '<span class="finding__text">' + bodyHtml + '</span>' +
    '<button class="finding__ack-btn" data-key="' + escapeHtml(key) + '">' + (acked ? tr('↺ wieder öffnen', '↺ reopen') : tr('✓ zur Kenntnis genommen', '✓ acknowledged')) + '</button>' +
    '</div>';
}

function renderFindings(findings, items) {
  const box = document.getElementById('findings');
  let html = '';
  if (findings.inconsistencies.length === 0) {
    html += '<div class="finding finding--ok">✅ ' + tr('Keine Abhängigkeits-Inkonsistenzen gefunden — alle Abhängigkeiten sind gleich oder stärker klassifiziert als das abhängige System.',
      'No dependency inconsistencies found — all dependencies are classified equal to or stronger than the dependent system.') + '</div>';
  } else {
    findings.inconsistencies.forEach(inc => {
      const key = 'inc:' + inc.from.id + '->' + inc.to.id;
      const body = '⚠ <strong>' + escapeHtml(inc.from.name) + '</strong> (' + escapeHtml(tierLabel(inc.from.cls)) + ')' +
        tr(' hängt ab von <strong>', ' depends on <strong>') + escapeHtml(inc.to.name) +
        tr('</strong>, aber diese Abhängigkeit ist nur als <strong>', '</strong>, but this dependency is only classified as <strong>') + escapeHtml(tierLabel(inc.to.cls)) +
        tr('</strong> klassifiziert. Das schwächere Glied bestimmt die tatsächlich erreichbare RTO — Klassifizierung oder Architektur im Workshop prüfen.',
           '</strong>. The weakest link determines the actually achievable RTO — review classification or architecture in the workshop.');
      html += findingRowHtml(key, '', body);
    });
  }
  if (findings.outOfScopeDeps && findings.outOfScopeDeps.length > 0) {
    findings.outOfScopeDeps.forEach(dep => {
      const key = 'oos:' + dep.from.id + '->' + dep.to.id;
      const body = '⚠ <strong>' + escapeHtml(dep.from.name) + '</strong> (' + escapeHtml(tierLabel(dep.from.cls)) + ')' +
        tr(' hängt ab von <strong>', ' depends on <strong>') + escapeHtml(dep.to.name) +
        tr('</strong>, das als "Out of Scope (kein Backup)" markiert ist. Im Ernstfall lässt sich ', '</strong>, which is marked "Out of scope (no backup)". In a disaster, ') +
        escapeHtml(dep.from.name) +
        tr(' dadurch möglicherweise nicht wiederherstellen — Abhängigkeit oder Scope-Entscheidung im Workshop prüfen.',
           ' may therefore not be recoverable — review the dependency or the scope decision in the workshop.');
      html += findingRowHtml(key, '', body);
    });
  }
  if (findings.cycles.length > 0) {
    findings.cycles.forEach(cyc => {
      const key = 'cyc:' + cyc.join('-');
      const names = cyc.map(id => (findings.byId[id] ? findings.byId[id].name : ('#' + id))).join(' → ');
      const body = '🔁 ' + tr('Zirkuläre Abhängigkeit erkannt: ', 'Circular dependency detected: ') + escapeHtml(names) +
        tr(' — bitte Dateneingabe prüfen (ein Workload kann nicht direkt oder indirekt von sich selbst abhängen).',
           ' — please check the data entry (a workload cannot depend on itself, directly or indirectly).');
      html += findingRowHtml(key, '', body).replace('finding ', 'finding ').replace('data-finding-key', 'style="border-left-color:var(--veeam-red)" data-finding-key');
    });
  }
  if (findings.gapExceeded && findings.gapExceeded.length > 0) {
    findings.gapExceeded.forEach(g => {
      const it = g.item;
      const def = CLASS_DEFS[it.cls] || {};
      const parts = [];
      if (g.rpoGap) parts.push(tr('Ist-RPO ', 'Actual RPO ') + it.istRpo + tr(' h > Ziel ', ' h > target ') + def.rpoH + ' h');
      if (g.rtoGap) parts.push(tr('Ist-RTO ', 'Actual RTO ') + it.istRto + tr(' h > Ziel ', ' h > target ') + def.rtoH + ' h');
      const key = 'gapx:' + it.id + ':' + (g.rpoGap ? 'r' : '') + (g.rtoGap ? 't' : '');
      const body = '⏱ <strong>' + escapeHtml(it.name) + '</strong> (' + escapeHtml(tierLabel(it.cls)) + ')' +
        tr(' verfehlt sein Klassen-Ziel: ', ' misses its class target: ') + escapeHtml(parts.join('; ')) +
        tr(' — Schutzkonfiguration verbessern oder Klassifizierung im Workshop hinterfragen.',
           ' — improve the protection configuration or challenge the classification in the workshop.');
      html += findingRowHtml(key, '', body);
    });
  }
  if (findings.missingGap.length > 0) {
    const key = 'gap:all:' + findings.missingGap.map(it => it.id).join(',');
    const body = 'ℹ ' + findings.missingGap.length +
      tr(' Workload(s) ohne Ist-RPO/Ist-RTO-Angabe (und nicht Tier 4 – Bronze) — Gap-Analyse zu diesen Systemen ist noch offen: ',
         ' workload(s) without actual RPO/RTO values (and not Tier 4 – Bronze) — gap analysis for these systems is still open: ') +
      escapeHtml(findings.missingGap.slice(0, 12).map(it => it.name).join(', ')) + (findings.missingGap.length > 12 ? ' …' : '');
    html += findingRowHtml(key, '', body);
  }
  box.innerHTML = html;
}

document.getElementById('findings').addEventListener('click', (e) => {
  const btn = e.target.closest('.finding__ack-btn');
  if (!btn) return;
  const key = btn.getAttribute('data-key');
  const row = btn.closest('.finding');
  if (findingsAckSet.has(key)) { findingsAckSet.delete(key); row.classList.remove('finding--ack'); btn.textContent = tr('✓ zur Kenntnis genommen', '✓ acknowledged'); }
  else { findingsAckSet.add(key); row.classList.add('finding--ack'); btn.textContent = tr('↺ wieder öffnen', '↺ reopen'); }
  saveAckSet(findingsAckSet);
});

document.getElementById('btn-reset-ack').addEventListener('click', () => {
  findingsAckSet = new Set();
  saveAckSet(findingsAckSet);
  document.querySelectorAll('#findings .finding').forEach(row => {
    row.classList.remove('finding--ack');
    const btn = row.querySelector('.finding__ack-btn');
    if (btn) btn.textContent = tr('✓ zur Kenntnis genommen', '✓ acknowledged');
  });
});

function renderRecommendations(items, findings) {
  const list = document.getElementById('reco-list');
  const tier0Count = items.filter(it => it.cls === "Tier 0 – Foundation").length;
  const platinumCount = items.filter(it => it.cls === "Tier 1 – Platinum").length;
  // "Out of Scope" workloads are deliberately excluded from the population for the Platinum share:
  // they are not part of the protection-class distribution at all (the share would be diluted).
  const total = items.filter(it => it.cls !== OUT_OF_SCOPE_CLASS).length;
  const platinumShare = total ? Math.round((platinumCount / total) * 100) : 0;
  let items_html = [];
  items_html.push(tr('Workload-Klassifizierung mit den Systemverantwortlichen im Workshop validieren — die berechnete Schutzklasse ist ein strukturierter Vorschlag, keine automatische Wahrheit.',
    'Validate the workload classification with the system owners in a workshop — the calculated protection class is a structured proposal, not automatic truth.'));
  if (tier0Count > 0) {
    items_html.push(tier0Count + ' ' + escapeHtml(tierLabel("Tier 0 – Foundation")) + tr('-System(e) identifiziert (', ' system(s) identified (') +
      escapeHtml(items.filter(it => it.cls === "Tier 0 – Foundation").map(it => it.name).join(', ')) +
      tr('). Sicherstellen, dass diese in jedem VRO-Runbook als erstes wiederhergestellt werden, bevor abhängige Systeme starten.',
         '). Ensure these are restored first in every VRO runbook before dependent systems start.'));
  }
  if (findings.inconsistencies.length > 0) {
    items_html.push(findings.inconsistencies.length + tr(' Abhängigkeits-Inkonsistenz(en) gefunden — klären, ob die schwächer eingestufte Abhängigkeit hochgestuft werden muss oder ob die Einstufung des abhängigen Systems zu hoch angesetzt ist.',
      ' dependency inconsistency(ies) found — clarify whether the weaker-classified dependency must be upgraded or whether the dependent system is classified too high.'));
  }
  if (platinumShare > 25) {
    items_html.push(tr('Auffällig hoher ', 'Notably high ') + escapeHtml(tierLabel("Tier 1 – Platinum")) + tr('-Anteil (', ' share (') + platinumShare +
      tr('% aller Workloads). Im Workshop hinterfragen, ob die Selbsteinschätzung zu großzügig war — nicht jedes wichtige System braucht eine Near-CDP-Replikation.',
         '% of all workloads). Challenge in the workshop whether self-assessment was too generous — not every important system needs near-CDP replication.'));
  }
  if (findings.missingGap.length > 0) {
    items_html.push(tr('Ist-RPO/RTO für ', 'Collect actual RPO/RTO for ') + findings.missingGap.length +
      tr(' Workload(s) erheben, um die Lücke zum Ziel-RPO/RTO sichtbar zu machen (Spalten "Ist-RPO"/"Ist-RTO" im Workload-Register).',
         ' workload(s) to make the gap to the target RPO/RTO visible ("Actual RPO"/"Actual RTO" columns in the workload register).'));
  }
  items_html.push(tr('VRO-Runbooks auf Basis der Schutzklassen konfigurieren: ', 'Configure VRO runbooks based on the protection classes: ') +
    escapeHtml(tierLabel("Tier 0 – Foundation")) + tr(' und ', ' and ') + escapeHtml(tierLabel("Tier 1 – Platinum")) +
    tr(' zuerst automatisieren, danach die mittleren Klassen.', ' first, then the middle classes.'));
  items_html.push(tr('Regelmäßige, nicht-invasive DR-Tests gemäß Testfrequenz je Schutzklasse einplanen (siehe Klassen-Matrix) und Ergebnisse für Compliance-Nachweise dokumentieren.',
    'Schedule regular, non-invasive DR tests according to the test frequency per protection class (see class matrix) and document results as compliance evidence.'));
  list.innerHTML = items_html.map(t => '<li>' + t + '</li>').join('');
}
