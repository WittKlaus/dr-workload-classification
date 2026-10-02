// ================================================================================================
// BLOCK 18 · Prequalification assistant: rule catalog, detection, 5-step wizard, catalog editor
// ------------------------------------------------------------------------------------------------
// Depends : Blocks 4, 11, 12.
// Provides: defaultPrequalRules(), prequalDetect() (pure), prequalApplyGroup() (empty fields only, 'auto' marker),
//           prequalOpenWizard(), renderPrequalCatalog(); state: PREQUAL_RULES, PREQUAL_ENV (saved with progress)
// Note    : Proposals only: nothing is written without confirmation; applied values carry an English note marker.
// ================================================================================================
// ---------------- Prequalification assistant (v0.10.0) ----------------
// Rule-based and deterministic, 100 % offline. Produces PROPOSALS, never results:
// values are applied only after explicit confirmation and only into EMPTY rating fields;
// applied proposals stay marked as "auto" until the customer validates them.
// Catalog source: distilled TAM field experience (no telemetry, not a standard).

function defaultPrequalRules() {
  // stage: 3 = out-of-scope signal, 2 = foundational (tier 0), 1 = specific application, 0 = generic.
  // pat: comma-separated keywords; match at a word start in the workload name, digits may follow
  // ("sql01" matches "sql"). weak: confidence at most low without a secondary signal. osHint: raises
  // confidence when the OS field contains the keyword. oosCheck: review-list candidate instead of a rating proposal.
  // Labels/notes deliberately ENGLISH: category names are data (they travel into note markers, exports,
  // repository files); the tool is primarily English, the UI language only affects the surface.
  return [
    { id: 'vcls', stage: 3, label: 'vSphere system objects', pat: 'vcls, stctlvm, vsan witness', oosCheck: true, preTicked: true },
    { id: 'lab',  stage: 3, label: 'Lab / demo / sandbox / PoC', pat: 'lab, demo, poc, sbx, sandbox, spielwiese', oosCheck: true, preTicked: false },
    { id: 'dc',   stage: 2, label: 'Domain controller / Active Directory', pat: 'dc, addc, ad, dom, domain', bi: 5, reg: 3, ds: 4, rk: 2, foundational: true, osHint: 'windows' },
    { id: 'dns',  stage: 2, label: 'DNS / DHCP / IPAM', pat: 'dns, dhcp, ipam, ns1, ns2', bi: 5, reg: 2, ds: 2, rk: 2, foundational: true },
    { id: 'pki',  stage: 2, label: 'PKI / certificate services', pat: 'pki, ca, cert', bi: 4, reg: 4, ds: 4, rk: 3, foundational: true },
    { id: 'ntp',  stage: 2, label: 'NTP / time service', pat: 'ntp, time', bi: 4, reg: 2, ds: 1, rk: 1, foundational: true },
    { id: 'vc',   stage: 2, label: 'vCenter / virtualization management', pat: 'vc, vcsa, vcenter, psc', bi: 4, reg: 2, ds: 3, rk: 3, foundational: true, osHint: 'photon' },
    { id: 'mssql', stage: 1, label: 'Microsoft SQL Server', pat: 'sql, mssql', bi: 4, reg: 3, ds: 4, rk: 3 },
    { id: 'ora',  stage: 1, label: 'Oracle database', pat: 'ora, oracle', bi: 4, reg: 4, ds: 4, rk: 4 },
    { id: 'osql', stage: 1, label: 'PostgreSQL / MySQL / MariaDB', pat: 'pg, psql, postgres, mysql, maria', bi: 3, reg: 3, ds: 3, rk: 2 },
    { id: 'hana', stage: 1, label: 'SAP HANA', pat: 'hana', bi: 5, reg: 4, ds: 4, rk: 5 },
    { id: 'sap',  stage: 1, label: 'SAP application / ERP', pat: 'sap, erp', bi: 5, reg: 4, ds: 4, rk: 4 },
    { id: 'exch', stage: 1, label: 'Exchange / mail', pat: 'exch, exchange, mail, smtp, mx', bi: 4, reg: 3, ds: 4, rk: 4 },
    { id: 'fin',  stage: 1, label: 'Finance / billing / payment', pat: 'fin, bill, billing, pay, fibu', bi: 4, reg: 4, ds: 4, rk: 3 },
    { id: 'crm',  stage: 1, label: 'CRM', pat: 'crm', bi: 4, reg: 3, ds: 4, rk: 3 },
    { id: 'sp',   stage: 1, label: 'SharePoint / DMS', pat: 'sp, sharepoint, dms, docu', bi: 3, reg: 3, ds: 3, rk: 3, weak: true },
    { id: 'mq',   stage: 1, label: 'Integration / messaging', pat: 'mq, esb, kafka, int, mft, broker', bi: 4, reg: 2, ds: 3, rk: 3 },
    { id: 'bkp',  stage: 1, label: 'Backup infrastructure', pat: 'vbr, veeam, repo, proxy, vbo, vb365', bi: 4, reg: 3, ds: 3, rk: 3, note: 'Special case: backup infrastructure recovery comes BEFORE all workload runbooks — do not schedule it as a regular workload.' },
    { id: 'file', stage: 1, label: 'File server', pat: 'file, fs, nas, share, filer', bi: 3, reg: 3, ds: 4, rk: 2 },
    { id: 'print', stage: 1, label: 'Print server', pat: 'print, prt', bi: 2, reg: 1, ds: 1, rk: 1 },
    { id: 'vdi',  stage: 1, label: 'Citrix / RDS / VDI', pat: 'ctx, citrix, xen, rds, ts, vdi, avd', bi: 3, reg: 2, ds: 2, rk: 3, note: 'Stateless VDI pools may be out of scope — clarify in the workshop.' },
    { id: 'mon',  stage: 1, label: 'Monitoring', pat: 'mon, zabbix, prtg, nagios, grafana, icinga', bi: 2, reg: 1, ds: 2, rk: 2 },
    { id: 'lic',  stage: 1, label: 'License server', pat: 'lic, license, flexlm', bi: 3, reg: 1, ds: 1, rk: 1, note: 'Underrated in the field: without the license service, applications do not start.' },
    { id: 'mgmt', stage: 1, label: 'Management / jump / bastion', pat: 'mgmt, jump, admin, bastion', bi: 2, reg: 2, ds: 3, rk: 1 },
    { id: 'web',  stage: 0, label: 'Web server', pat: 'web, www, iis, nginx, apache', bi: 3, reg: 2, ds: 2, rk: 2 },
    { id: 'appsrv', stage: 0, label: 'App server', pat: 'app, tomcat, jboss, was', bi: 3, reg: 2, ds: 3, rk: 2 },
    { id: 'gendb', stage: 0, label: 'Generic database', pat: 'db', bi: 3, reg: 3, ds: 3, rk: 2, weak: true }
  ];
}
let PREQUAL_RULES = defaultPrequalRules();
// Environment signals: editable in the catalog panel (e.g. if a customer deliberately does NOT want
// to downgrade DEV/TST, simply clear the non-prod patterns). Stored with the progress.
function defaultPrequalEnv() { return { nonprod: 'dev, tst, test, qa, uat, stage, stg', prod: 'prod, prd' }; }
let PREQUAL_ENV = defaultPrequalEnv();

function prequalKeywords(pat) { return String(pat || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean); }

// Word-start match: preceded by the start of the text or a non-alphanumeric character, followed by
// the end or a non-letter (digits allowed: "sql01" matches "sql", "vdc" does NOT match "dc").
function prequalKeywordHit(hay, kw) {
  const h = String(hay || '').toLowerCase();
  let idx = 0;
  while ((idx = h.indexOf(kw, idx)) !== -1) {
    const before = idx === 0 ? '' : h[idx - 1];
    const after = h[idx + kw.length] || '';
    if ((before === '' || !/[a-z0-9]/.test(before)) && (after === '' || !/[a-z]/.test(after))) return true;
    idx += 1;
  }
  return false;
}

// Core detection. Returns rating groups (stage 0/1), foundational candidates (stage 2),
// out-of-scope candidates (stage 3) and the counters for unrecognized/already rated items.
function prequalDetect(items) {
  const rules = PREQUAL_RULES.map(r => ({ r, kws: prequalKeywords(r.pat) }));
  const nonprodKws = prequalKeywords(PREQUAL_ENV.nonprod);
  const prodKws = prequalKeywords(PREQUAL_ENV.prod);
  const groups = new Map();
  const foundational = [], oos = [];
  let unmatched = 0, alreadyRated = 0, alreadyOos = 0;

  items.forEach(it => {
    if (it.outOfScope) { alreadyOos++; return; }
    const rated = it.bi !== '' || it.reg !== '' || it.ds !== '';
    const name = it.name || '';
    const secondary = [it.os, it.location, it.note, it.type, it.owner].filter(Boolean).join(' · ');

    let best = null;
    rules.forEach(({ r, kws }) => {
      kws.forEach(kw => {
        if (!prequalKeywordHit(name, kw)) return;
        if (!best || r.stage > best.rule.stage || (r.stage === best.rule.stage && kw.length > best.kw.length)) best = { rule: r, kw: kw };
      });
    });
    if (!best) { if (!rated) unmatched++; else alreadyRated++; return; }
    if (rated && !best.rule.oosCheck) { alreadyRated++; return; } // already rated items are never overwritten

    const envNon = nonprodKws.some(kw => prequalKeywordHit(name, kw) || prequalKeywordHit(secondary, kw));
    const envProd = prodKws.some(kw => prequalKeywordHit(name, kw) || prequalKeywordHit(secondary, kw));
    const reasons = [tr('Name trifft „', 'Name matches "') + best.kw + '"'];
    let conf = 'mittel';
    if (best.rule.osHint && (it.os || '').toLowerCase().includes(best.rule.osHint)) { conf = 'hoch'; reasons.push(tr('OS passt (', 'OS matches (') + best.rule.osHint + ')'); }
    if (envProd && !envNon) { conf = 'hoch'; reasons.push(tr('Prod-Signal erkannt', 'prod signal detected')); }
    if (envNon && !envProd) reasons.push(tr('Nicht-Prod-Umgebung erkannt (BI −2, Reg −1)', 'non-prod environment detected (BI −2, Reg −1)'));
    if (envNon && envProd) { conf = 'niedrig'; reasons.push(tr('WIDERSPRUCH: Prod- und Nicht-Prod-Signale', 'CONFLICT: prod and non-prod signals')); }
    if (best.rule.weak && conf === 'mittel') conf = 'niedrig';

    if (best.rule.oosCheck) { oos.push({ it, rule: best.rule, conf, reasons }); return; }
    if (best.rule.foundational) {
      if (it.foundational === 'Ja') return; // already set
      foundational.push({ it, rule: best.rule, conf, reasons }); return;
    }

    const envTag = (envNon && !envProd) ? 'nonprod' : 'std';
    const key = best.rule.id + '|' + envTag;
    if (!groups.has(key)) {
      const clamp = v => Math.max(1, v);
      groups.set(key, {
        key, rule: best.rule,
        label: best.rule.label + (envTag === 'nonprod' ? ' (non-prod)' : ''), // Label = Daten -> englisch
        vals: {
          bi: envTag === 'nonprod' ? clamp((best.rule.bi || 3) - 2) : (best.rule.bi || 3),
          reg: envTag === 'nonprod' ? clamp((best.rule.reg || 2) - 1) : (best.rule.reg || 2),
          ds: best.rule.ds || 2, rk: best.rule.rk || 2
        },
        members: []
      });
    }
    groups.get(key).members.push({ item: it, conf, reasons });
  });

  // Group confidence from the distribution of the members
  const groupList = [...groups.values()].map(g => {
    const n = g.members.length;
    const c = { hoch: 0, mittel: 0, niedrig: 0 };
    g.members.forEach(m => c[m.conf]++);
    g.conf = c.hoch >= n / 2 ? 'hoch' : (c.niedrig >= n * 0.3 ? 'niedrig' : 'mittel');
    g.state = g.conf === 'niedrig' ? 'skipped' : 'pending'; // low defaults to skip
    return g;
  }).sort((a, b) => b.members.length - a.members.length);

  return { groups: groupList, foundational, oos, unmatched, alreadyRated, alreadyOos };
}

// ---- Apply (always into empty fields only, always with a marker) ----
function prequalMark(it, label, conf) {
  it.autoProposed = true;
  // The marker is DATA (export/repository) -> always English
  const confEn = { hoch: 'high', mittel: 'medium', niedrig: 'low' }[conf] || conf;
  if (!(it.note || '').includes('[Auto proposal')) {
    it.note = (it.note ? it.note + ' ' : '') + '[Auto proposal ' + TOOL_VERSION + ': ' + label + ', ' + confEn + ']';
  }
}
function prequalApplyGroup(g) {
  g.members.forEach(m => {
    const it = m.item;
    if (it.bi === '') it.bi = g.vals.bi;
    if (it.reg === '') it.reg = g.vals.reg;
    if (it.ds === '') it.ds = g.vals.ds;
    if (it.rk === '' && g.vals.rk) it.rk = g.vals.rk; // RK: documentation only, never score
    if (g.override && !it.clsOverride) it.clsOverride = g.override; // group override, never over existing overrides
    if (!it.type) it.type = g.rule.label; // category = type (only if empty)
    if (g.own) { // ownership: optional, empty fields only
      if (g.own.owner && !it.owner) it.owner = g.own.owner;
      if (g.own.responsible && !it.responsible) it.responsible = g.own.responsible;
      if (g.own.responsibleEmail && !it.responsibleEmail) it.responsibleEmail = g.own.responsibleEmail;
    }
    prequalMark(it, g.label, m.conf);
  });
  g.state = 'applied';
}

// ---- Share of unconfirmed auto proposals (toolbar tab 1) ----
function updatePrequalQuotaNote() {
  const el = document.getElementById('prequal-quota-note');
  if (!el) return;
  const open = collectState.items.filter(it => it.autoProposed && !it.validated).length;
  el.textContent = open > 0
    ? '🔵 ' + open + tr(' unbestätigte Auto-Vorschläge — Validierung mit dem Kunden erforderlich', ' unconfirmed auto proposals — customer validation required')
    : '';
}

// ---- Wizard ----
let prequalResult = null;
function prequalShowStep(n) {
  for (let i = 1; i <= 5; i++) document.getElementById('prequal-step-' + i).classList.toggle('active', i === n);
  document.getElementById('prequal-step-indicator').textContent = tr('Schritt ', 'Step ') + n + tr(' von 5', ' of 5');
}
function prequalOpenWizard() {
  if (!collectState.items.length) { alert(tr('Bitte zuerst Workloads importieren oder erfassen.', 'Please import or add workloads first.')); return; }
  prequalResult = null;
  document.getElementById('prequal-consent').checked = false;
  document.getElementById('btn-prequal-start').disabled = true;
  prequalShowStep(1);
  document.getElementById('prequal-overlay').classList.add('open');
  if (typeof i18nApply === 'function') i18nApply(document.getElementById('prequal-overlay'));
}
document.getElementById('btn-prequal-close').addEventListener('click', () => {
  document.getElementById('prequal-overlay').classList.remove('open');
  renderCollectTable(); autoSaveProgress();
});
document.getElementById('prequal-consent').addEventListener('change', (e) => {
  document.getElementById('btn-prequal-start').disabled = !e.target.checked;
});
document.getElementById('btn-prequal-start').addEventListener('click', () => {
  prequalResult = prequalDetect(collectState.items);
  const r = prequalResult;
  const covered = r.groups.reduce((s, g) => s + g.members.length, 0);
  document.getElementById('prequal-summary').innerHTML =
    '<strong>' + collectState.items.length + tr(' Workloads analysiert.', ' workloads analyzed.') + '</strong><br>' +
    '· ' + r.groups.length + tr(' Bewertungs-Gruppen mit zusammen ', ' assessment groups covering ') + covered + tr(' Workloads', ' workloads') + '<br>' +
    '· ' + r.foundational.length + tr(' Foundational-Kandidaten (Tier 0)', ' foundational candidates (tier 0)') + '<br>' +
    '· ' + r.oos.length + tr(' Out-of-Scope-Prüfkandidaten', ' out-of-scope review candidates') + '<br>' +
    '· ' + r.unmatched + tr(' nicht erkannt → Gruppe „Manuell bewerten" (bewusst ohne Vorschlag)', ' not recognized → "assess manually" (deliberately no proposal)') + '<br>' +
    '· ' + r.alreadyRated + tr(' bereits (teil-)bewertet → ausgenommen, wird nie überschrieben', ' already (partly) rated → excluded, never overwritten') +
    (r.alreadyOos ? '<br>· ' + r.alreadyOos + tr(' bereits Out of Scope', ' already out of scope') : '');
  prequalShowStep(2);
});
document.getElementById('btn-prequal-to-groups').addEventListener('click', () => { prequalRenderGroups(); prequalShowStep(3); });
document.getElementById('btn-prequal-to-flags').addEventListener('click', () => { prequalRenderFlags(); prequalShowStep(4); });
document.getElementById('btn-prequal-to-summary').addEventListener('click', () => { prequalRenderSummary(); prequalShowStep(5); });
document.getElementById('btn-prequal-finish').addEventListener('click', () => {
  document.getElementById('prequal-overlay').classList.remove('open');
  renderCollectTable(); autoSaveProgress();
});

function prequalConfChip(conf) {
  const t = conf === 'hoch' ? tr('hoch', 'high') : conf === 'mittel' ? tr('mittel', 'medium') : tr('niedrig', 'low');
  return '<span class="prequal-conf prequal-conf--' + conf + '">' + t + '</span>';
}

function prequalRenderGroups() {
  const box = document.getElementById('prequal-groups-box');
  if (!prequalResult.groups.length) {
    box.innerHTML = '<div class="finding finding--info">ℹ ' + tr('Keine Bewertungs-Gruppen erkannt.', 'No assessment groups recognized.') + '</div>';
    return;
  }
  box.innerHTML = prequalResult.groups.map((g, gi) => {
    const reasons = [...new Set(g.members.flatMap(m => m.reasons))].slice(0, 4).join(' · ');
    const members = g.members.map(m => escapeHtml(m.item.name)).join(', ');
    return '<div class="prequal-group' + (g.state === 'applied' ? ' is-applied' : g.state === 'skipped' ? ' is-skipped' : '') + '" data-gi="' + gi + '">' +
      '<div class="prequal-group__head">' + escapeHtml(g.label) + ' <span class="badge">' + g.members.length + ' Workloads</span> ' + prequalConfChip(g.conf) +
      '<span class="prequal-vals" style="margin-left:auto; display:flex; gap:6px; align-items:center;">' +
      'BI <input type="number" min="1" max="5" data-v="bi" value="' + g.vals.bi + '"' + (g.state === 'applied' ? ' disabled' : '') + '>' +
      'Reg <input type="number" min="1" max="5" data-v="reg" value="' + g.vals.reg + '"' + (g.state === 'applied' ? ' disabled' : '') + '>' +
      'DS <input type="number" min="1" max="5" data-v="ds" value="' + g.vals.ds + '"' + (g.state === 'applied' ? ' disabled' : '') + '>' +
      '<span title="' + tr('RK ist reine Aufwands-Dokumentation und fließt nie in die Schutzklassen-Berechnung ein', 'RC is documentation only and never affects the protection-class calculation') + '">RK <input type="number" min="1" max="5" data-v="rk" value="' + g.vals.rk + '"' + (g.state === 'applied' ? ' disabled' : '') + '></span>' +
      '</span></div>' +
      (function () { // live preview: which protection class these values would yield, plus an optional group override
        const cls = classifyScore(computeScore(g.vals.bi, g.vals.reg, g.vals.ds), 'Nein');
        return '<div class="prequal-group__why">' + tr('Ergibt Schutzklasse: ', 'Resulting protection class: ') +
          '<strong data-role="cls-prev" style="color:' + tierColor(cls) + '">' + escapeHtml(tierLabel(cls)) + '</strong>' +
          ' · <label>' + tr('Manuell überschreiben: ', 'Manual override: ') +
          '<select data-v="override"' + (g.state === 'applied' ? ' disabled' : '') + '>' +
          '<option value="">' + tr('– automatisch (aus Werten) –', '– automatic (from values) –') + '</option>' +
          TIER_ORDER.map(t => '<option value="' + escapeHtml(t) + '"' + (g.override === t ? ' selected' : '') + '>' + escapeHtml(tierLabel(t)) + '</option>').join('') +
          '</select></label></div>';
      })() +
      '<div class="prequal-group__why">' + tr('Warum: ', 'Why: ') + escapeHtml(reasons) + (g.rule.note ? ' — ' + escapeHtml(g.rule.note) : '') + '</div>' +
      // Ownership optional per group (workshop question: "Who is responsible for these systems?").
      // Empty = change nothing; written into EMPTY fields only and NOT stored in the catalog.
      '<div class="prequal-group__why" style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">' +
      tr('Optional für alle Mitglieder (nur leere Felder): ', 'Optional for all members (empty fields only): ') +
      '<input type="text" data-o="owner" placeholder="Team/Owner" value="' + escapeHtml((g.own && g.own.owner) || '') + '" style="width:120px;"' + (g.state === 'applied' ? ' disabled' : '') + '>' +
      '<input type="text" data-o="responsible" placeholder="' + tr('Verantwortliche Person', 'Responsible person') + '" value="' + escapeHtml((g.own && g.own.responsible) || '') + '" style="width:150px;"' + (g.state === 'applied' ? ' disabled' : '') + '>' +
      '<input type="text" data-o="responsibleEmail" placeholder="' + tr('E-Mail', 'Email') + '" value="' + escapeHtml((g.own && g.own.responsibleEmail) || '') + '" style="width:170px;"' + (g.state === 'applied' ? ' disabled' : '') + '>' +
      '</div>' +
      '<details><summary style="cursor:pointer; font:600 12px/16px var(--font-sans);">' + tr('Mitglieder anzeigen', 'Show members') + '</summary><div class="prequal-members">' + members + '</div></details>' +
      '<div class="graph-toolbar" style="margin-top:8px;">' +
      (g.state === 'applied'
        ? '<span class="graph-note">✓ ' + tr('Übernommen', 'Applied') + '</span>'
        : '<button class="btn-ghost" data-act="apply">✓ ' + tr('Übernehmen', 'Apply') + '</button>' +
          '<button class="btn-ghost" data-act="skip">' + (g.state === 'skipped' ? tr('Übersprungen — doch prüfen', 'Skipped — reconsider') : tr('Überspringen', 'Skip')) + '</button>') +
      '</div></div>';
  }).join('');
}
// Refresh the tier preview live when BI/Reg/DS change within a group
document.getElementById('prequal-groups-box').addEventListener('input', (e) => {
  const inp = e.target.closest('input[data-v]');
  if (!inp || inp.getAttribute('data-v') === 'rk') return;
  const wrap = inp.closest('.prequal-group');
  const read = k => Math.max(1, Math.min(5, parseInt(wrap.querySelector('input[data-v="' + k + '"]').value, 10) || 1));
  const cls = classifyScore(computeScore(read('bi'), read('reg'), read('ds')), 'Nein');
  const prev = wrap.querySelector('[data-role="cls-prev"]');
  if (prev) { prev.textContent = tierLabel(cls); prev.style.color = tierColor(cls); }
});
document.getElementById('prequal-groups-box').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const wrap = btn.closest('.prequal-group');
  const g = prequalResult.groups[parseInt(wrap.getAttribute('data-gi'), 10)];
  if (btn.getAttribute('data-act') === 'apply') {
    wrap.querySelectorAll('input[data-v]').forEach(inp => {
      const v = Math.max(1, Math.min(5, parseInt(inp.value, 10) || 1));
      g.vals[inp.getAttribute('data-v')] = v;
    });
    const ovr = wrap.querySelector('select[data-v="override"]');
    g.override = ovr ? ovr.value : '';
    g.own = {};
    wrap.querySelectorAll('input[data-o]').forEach(inp => { g.own[inp.getAttribute('data-o')] = inp.value.trim(); });
    prequalApplyGroup(g);
  } else {
    g.state = g.state === 'skipped' ? 'pending' : 'skipped';
  }
  prequalRenderGroups();
});

function prequalRenderFlags() {
  const box = document.getElementById('prequal-flags-box');
  let html = '';
  html += '<h3 style="margin-top:0;">' + tr('Foundational-Kandidaten (→ Tier 0)', 'Foundational candidates (→ tier 0)') + '</h3>';
  html += prequalResult.foundational.length
    ? prequalResult.foundational.map((c, i) =>
        '<label class="toggle-inline" style="display:block; margin:3px 0;"><input type="checkbox" data-fnd="' + i + '"' + (c.conf !== 'niedrig' ? ' checked' : '') + '> ' +
        escapeHtml(c.it.name) + ' — ' + escapeHtml(c.rule.label) + ' ' + prequalConfChip(c.conf) + ' <span class="graph-note">' + escapeHtml(c.reasons.join(' · ')) + '</span></label>').join('')
    : '<p class="graph-note">' + tr('Keine neuen Kandidaten (bereits gesetzte Foundational-Flags bleiben unberührt).', 'No new candidates (existing foundational flags stay untouched).') + '</p>';
  html += '<h3>' + tr('Out-of-Scope-Prüfkandidaten (kein Backup)', 'Out-of-scope review candidates (no backup)') + '</h3>';
  html += prequalResult.oos.length
    ? prequalResult.oos.map((c, i) =>
        '<label class="toggle-inline" style="display:block; margin:3px 0;"><input type="checkbox" data-oos="' + i + '"' + (c.rule.preTicked ? ' checked' : '') + '> ' +
        escapeHtml(c.it.name) + ' — ' + escapeHtml(c.rule.label) + ' ' + prequalConfChip(c.conf) + '</label>').join('') +
      '<p class="graph-note">' + tr('Vorsicht bei Lab/Demo-Systemen: kann auch ein Saisonsystem sein — im Zweifel nicht anhaken.', 'Careful with lab/demo systems: could be seasonal — when in doubt, leave unticked.') + '</p>'
    : '<p class="graph-note">' + tr('Keine Kandidaten.', 'No candidates.') + '</p>';
  html += '<div class="graph-toolbar" style="margin-top:10px;"><button class="btn-ghost" id="btn-prequal-apply-flags">✓ ' + tr('Angehakte übernehmen', 'Apply ticked items') + '</button><span class="graph-note" id="prequal-flags-note"></span></div>';
  box.innerHTML = html;
  document.getElementById('btn-prequal-apply-flags').addEventListener('click', () => {
    let nF = 0, nO = 0;
    box.querySelectorAll('input[data-fnd]:checked').forEach(cb => {
      const c = prequalResult.foundational[parseInt(cb.getAttribute('data-fnd'), 10)];
      if (c.it.foundational !== 'Ja') { c.it.foundational = 'Ja'; prequalMark(c.it, c.rule.label, c.conf); nF++; }
      cb.disabled = true;
    });
    box.querySelectorAll('input[data-oos]:checked').forEach(cb => {
      const c = prequalResult.oos[parseInt(cb.getAttribute('data-oos'), 10)];
      if (!c.it.outOfScope) { c.it.outOfScope = true; prequalMark(c.it, c.rule.label, c.conf); nO++; }
      cb.disabled = true;
    });
    document.getElementById('prequal-flags-note').textContent = nF + tr(' Foundational, ', ' foundational, ') + nO + tr(' Out of Scope übernommen.', ' out of scope applied.');
  });
}

function prequalRenderSummary() {
  const applied = prequalResult.groups.filter(g => g.state === 'applied');
  const skipped = prequalResult.groups.filter(g => g.state !== 'applied');
  const nApplied = applied.reduce((s, g) => s + g.members.length, 0);
  const open = collectState.items.filter(it => it.autoProposed && !it.validated).length;
  document.getElementById('prequal-result').innerHTML =
    '<strong>' + applied.length + tr(' Gruppen übernommen (', ' groups applied (') + nApplied + tr(' Workloads).', ' workloads).') + '</strong><br>' +
    '· ' + skipped.length + tr(' Gruppen übersprungen/offen', ' groups skipped/open') + '<br>' +
    '· ' + prequalResult.unmatched + tr(' Workloads manuell zu bewerten', ' workloads to assess manually') + '<br>' +
    '· ' + tr('Aktuell ', 'Currently ') + open + tr(' unbestätigte Auto-Vorschläge im Datenbestand — bitte im Workshop validieren.', ' unconfirmed auto proposals in the dataset — please validate in the workshop.');
}

document.getElementById('btn-prequal-wizard').addEventListener('click', prequalOpenWizard);

// ---- Katalog-Editor (Optionen) ----
function renderPrequalCatalog() {
  const table = document.getElementById('prequal-catalog-table');
  if (!table) return;
  let html = '<thead><tr><th>' + tr('Kategorie', 'Category') + '</th><th>' + tr('Erkennungsmuster (kommagetrennt)', 'Detection patterns (comma-separated)') + '</th>' +
    '<th>BI</th><th>Reg</th><th>DS</th><th title="' + tr('Reine Doku, nie Score', 'Documentation only, never score') + '">RK</th>' +
    '<th>Tier 0</th><th title="' + tr('Out-of-Scope-Prüfliste statt Bewertungsvorschlag', 'Out-of-scope review list instead of value proposal') + '">OoS</th><th></th></tr></thead><tbody>';
  PREQUAL_RULES.forEach((r, i) => {
    const num = (k) => r.oosCheck ? '<td style="text-align:center;">–</td>' :
      '<td><input type="number" min="1" max="5" data-ri="' + i + '" data-rk="' + k + '" value="' + (r[k] || '') + '"></td>';
    html += '<tr>' +
      '<td><input type="text" data-ri="' + i + '" data-rk="label" value="' + escapeHtml(r.label) + '" style="min-width:180px;"></td>' +
      '<td><input type="text" data-ri="' + i + '" data-rk="pat" value="' + escapeHtml(r.pat) + '" style="min-width:220px;"></td>' +
      num('bi') + num('reg') + num('ds') + num('rk') +
      '<td style="text-align:center;">' + (r.oosCheck ? '–' : '<input type="checkbox" data-ri="' + i + '" data-rk="foundational"' + (r.foundational ? ' checked' : '') + '>') + '</td>' +
      '<td style="text-align:center;">' + (r.oosCheck ? '✓' : '') + '</td>' +
      '<td><button class="btn-ghost" data-del-rule="' + i + '" title="' + tr('Kategorie entfernen', 'Remove category') + '">✕</button></td>' +
      '</tr>';
  });
  table.innerHTML = html + '</tbody>';
  const envN = document.getElementById('prequal-env-nonprod'), envP = document.getElementById('prequal-env-prod');
  if (envN) envN.value = PREQUAL_ENV.nonprod;
  if (envP) envP.value = PREQUAL_ENV.prod;
}
document.getElementById('prequal-catalog-table').addEventListener('change', (e) => {
  const t = e.target;
  const ri = t.getAttribute('data-ri'), rk = t.getAttribute('data-rk');
  if (ri === null || !rk) return;
  const rule = PREQUAL_RULES[parseInt(ri, 10)];
  if (rk === 'foundational') rule.foundational = t.checked;
  else if (rk === 'label' || rk === 'pat') rule[rk] = t.value;
  else rule[rk] = Math.max(1, Math.min(5, parseInt(t.value, 10) || 1));
  document.getElementById('prequal-catalog-note').textContent = tr('Katalog angepasst — wird mit dem Fortschritt gespeichert.', 'Catalog adjusted — saved with your progress.');
  autoSaveProgress();
});
document.getElementById('prequal-catalog-table').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-del-rule]');
  if (!btn) return;
  const i = parseInt(btn.getAttribute('data-del-rule'), 10);
  if (!confirm(tr('Kategorie „', 'Remove category "') + PREQUAL_RULES[i].label + tr('" entfernen?', '"?'))) return;
  PREQUAL_RULES.splice(i, 1);
  renderPrequalCatalog();
  document.getElementById('prequal-catalog-note').textContent = tr('Kategorie entfernt.', 'Category removed.');
  autoSaveProgress();
});
document.getElementById('btn-add-prequal-rule').addEventListener('click', () => {
  PREQUAL_RULES.push({ id: 'custom-' + Date.now(), stage: 1, label: '', pat: '', bi: 3, reg: 2, ds: 2, rk: 2 });
  renderPrequalCatalog();
  document.getElementById('prequal-catalog-note').textContent = tr('Neue Kategorie angelegt — Name und Muster ausfüllen.', 'New category added — fill in name and patterns.');
  const rows = document.querySelectorAll('#prequal-catalog-table tbody tr');
  const inp = rows[rows.length - 1] && rows[rows.length - 1].querySelector('input[data-rk="label"]');
  if (inp) inp.focus();
});
['prequal-env-nonprod', 'prequal-env-prod'].forEach(id => {
  document.getElementById(id).addEventListener('change', (e) => {
    PREQUAL_ENV[id === 'prequal-env-nonprod' ? 'nonprod' : 'prod'] = e.target.value;
    document.getElementById('prequal-catalog-note').textContent = tr('Umgebungs-Muster angepasst — wird mit dem Fortschritt gespeichert.', 'Environment patterns adjusted — saved with your progress.');
    autoSaveProgress();
  });
});
document.getElementById('btn-reset-prequal-catalog').addEventListener('click', () => {
  if (!confirm(tr('Vorqualifizierungs-Katalog (inkl. Umgebungs-Muster) auf den Standard zurücksetzen?', 'Reset the prequalification catalog (incl. environment patterns) to defaults?'))) return;
  PREQUAL_RULES = defaultPrequalRules();
  PREQUAL_ENV = defaultPrequalEnv();
  renderPrequalCatalog();
  document.getElementById('prequal-catalog-note').textContent = tr('Standardkatalog wiederhergestellt.', 'Default catalog restored.');
  autoSaveProgress();
});
renderPrequalCatalog();
updatePrequalQuotaNote();
