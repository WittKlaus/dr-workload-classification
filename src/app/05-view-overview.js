// ================================================================================================
// BLOCK 5 · Tab 2 view: KPIs, distribution chart, sortable workload register
// ------------------------------------------------------------------------------------------------
// Depends : Block 4 (tier model, tr), Chart.js.
// Provides: renderAll() (entry point for tab 2), renderKPI(), renderChart(), renderTable(), escapeHtml()
// Note    : escapeHtml() is defined here and used by every render path; all user/file content goes through it.
// ================================================================================================
let distChartInstance = null;
let currentViewItems = null; // data last shown in tab 2 (upload OR auto-sync from tab 1); data basis for tab 3

function renderAll(items) {
  currentViewItems = items;
  document.getElementById('results').classList.remove('hidden');
  renderKPI(items);
  renderChart(items);
  renderTable(items);
  const findings = computeFindings(items);
  renderFindings(findings, items);
  renderRecommendations(items, findings);
  renderGraph(items, findings);
  if (typeof i18nApply === 'function') i18nApply(document.getElementById('tab-view'));
}

function renderKPI(items) {
  const grid = document.getElementById('kpi-grid');
  const counts = {};
  TIER_ORDER.forEach(t => counts[t] = 0);
  items.forEach(it => counts[it.cls] = (counts[it.cls] || 0) + 1);
  const outOfScopeCount = counts[OUT_OF_SCOPE_CLASS] || 0;
  let html = '<div class="kpi"><div class="kpi__label">Gesamt Workloads</div><div class="kpi__value">' + items.length + '</div></div>';
  TIER_ORDER.forEach(t => {
    html += '<div class="kpi"><div class="kpi__label">' + escapeHtml(tierLabel(t)) + '</div><div class="kpi__value" style="color:' + tierColor(t) + '">' + counts[t] + '</div></div>';
  });
  if (outOfScopeCount > 0) {
    html += '<div class="kpi"><div class="kpi__label">Out of Scope (kein Backup)</div><div class="kpi__value" style="color:' + OUT_OF_SCOPE_COLOR + '">' + outOfScopeCount + '</div></div>';
  }
  grid.innerHTML = html;
}

function renderChart(items) {
  const counts = {};
  TIER_ORDER.forEach(t => counts[t] = 0);
  items.forEach(it => counts[it.cls] = (counts[it.cls] || 0) + 1);
  const ctx = document.getElementById('dist-chart').getContext('2d');
  if (distChartInstance) distChartInstance.destroy();
  // Theme-aware text/grid colors (dark mode): read fresh from the CSS variables before every chart build
  Chart.defaults.color = cssVar('--chart-text') || '#505861';
  Chart.defaults.borderColor = cssVar('--chart-grid') || '#E4E4E4';
  distChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: TIER_ORDER.map(t => tierLabel(t)),
      datasets: [{
        label: tr('Anzahl Workloads', 'Number of workloads'), // canvas: must go through tr(); the DOM dictionary does not reach Chart.js
        data: TIER_ORDER.map(t => counts[t]),
        backgroundColor: TIER_ORDER.map(t => tierColor(t))
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

// reverse lookup: for a given item id, which other items list it as a dependency
function dependentsOf(id, items) {
  return items.filter(it => it.deps.includes(id));
}

let viewSort = { key: '', dir: 1 };
let viewPage = 0;
let viewPageSize = 250; // like tab 1: selectable 100/250/500/1000/'all'

let _viewDependentsMap = {}; // precomputed per render: id -> [names of dependents] (instead of O(n²))

function viewSortValue(it, key) {
  switch (key) {
    case 'id': return typeof it.id === 'number' ? it.id : parseInt(it.id, 10) || 0;
    case 'cls': return it.cls === OUT_OF_SCOPE_CLASS ? 98 : (TIER_RANK[it.cls] !== undefined ? TIER_RANK[it.cls] : 99);
    case 'deps': return -(it.deps ? it.deps.length : 0);                    // most first on ▲
    case 'dependents': return -((_viewDependentsMap[it.id] || []).length);  // most first on ▲
    default: return (it[key] || '').toString().toLowerCase();
  }
}

function renderTable(items) {
  const table = document.getElementById('data-table');
  // One-off indexes for this render: dependents per workload + id->item
  _viewDependentsMap = {};
  const byId = new Map();
  items.forEach(x => byId.set(x.id, x));
  items.forEach(x => (x.deps || []).forEach(d => {
    (_viewDependentsMap[d] = _viewDependentsMap[d] || []).push(x.name);
  }));
  let sorted = items;
  if (viewSort.key) {
    const k = viewSort.key, d = viewSort.dir;
    sorted = items.slice().sort((a, b) => {
      const va = viewSortValue(a, k), vb = viewSortValue(b, k);
      if (va < vb) return -1 * d;
      if (va > vb) return 1 * d;
      return 0;
    });
  }
  const vPageSize = viewPageSize === 'all' ? Math.max(1, sorted.length) : viewPageSize;
  const pageCount = Math.max(1, Math.ceil(sorted.length / vPageSize));
  if (viewPage >= pageCount) viewPage = pageCount - 1;
  if (viewPage < 0) viewPage = 0;
  const pageRows = viewPageSize === 'all' ? sorted : sorted.slice(viewPage * vPageSize, (viewPage + 1) * vPageSize);

  const sh = (label, sk, title) => '<th data-sk="' + sk + '"' + (title ? ' title="' + title + '"' : '') + '>' + label +
    (viewSort.key === sk ? '<span class="sort-ind">' + (viewSort.dir === 1 ? '▲' : '▼') + '</span>' : '') + '</th>';
  let html = '<thead><tr>' + sh('#', 'id') + sh('Name', 'name') + sh('Owner', 'owner') +
    sh('Verantwortlicher', 'responsible') + sh('Klasse', 'cls', 'Sortiert nach Rang (Tier 0 zuerst), nicht alphabetisch') +
    sh('Ziel-RPO', 'rpo') + sh('Ziel-RTO', 'rto') +
    sh('Abhängig von', 'deps', 'Sortiert nach Anzahl') +
    sh('Wird benötigt von', 'dependents', 'Automatisch ermittelt: welche anderen Workloads hängen von diesem ab. Sortiert nach Anzahl.') +
    '</tr></thead><tbody>';
  pageRows.forEach(it => {
    const depsStr = it.deps.length ? it.deps.map(d => {
      const dep = byId.get(d);
      return dep ? dep.name : ('#' + d);
    }).join(', ') : '–';
    const dependents = _viewDependentsMap[it.id] || [];
    const dependentsStr = dependents.length ? dependents.join(', ') : '–';
    html += '<tr><td>' + it.id + '</td><td>' + escapeHtml(it.name) + '</td><td>' + escapeHtml(it.owner) +
      '</td><td>' + escapeHtml(it.responsible || '–') +
      '</td><td><span class="badge"><span class="badge-dot" style="background:' + tierColor(it.cls) + '"></span>' + escapeHtml(tierLabel(it.cls)) + '</span>' +
      (it.manualOverride ? ' <span class="badge badge-manual">' + tr('manuell', 'manual') + '</span>' : '') + '</td><td>' +
      escapeHtml(it.rpo) + '</td><td>' + escapeHtml(it.rto) + '</td><td>' + escapeHtml(depsStr) + '</td><td>' + escapeHtml(dependentsStr) + '</td></tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;
  table.querySelectorAll('th[data-sk]').forEach(th => {
    th.addEventListener('click', () => {
      const sk = th.getAttribute('data-sk');
      if (viewSort.key === sk) viewSort.dir = -viewSort.dir;
      else { viewSort = { key: sk, dir: 1 }; }
      viewPage = 0;
      renderTable(items);
    });
  });
  // Pager-Anzeige aktualisieren
  const info = document.getElementById('view-pager-info');
  if (info) {
    const from = sorted.length === 0 ? 0 : viewPage * vPageSize + 1;
    const to = Math.min(sorted.length, (viewPage + 1) * vPageSize);
    info.textContent = tr('Zeige ', 'Showing ') + from + '–' + to + tr(' von ', ' of ') + sorted.length + tr(' Workloads.', ' workloads.');
    document.getElementById('view-pager-pos').textContent = tr('Seite ', 'Page ') + (viewPage + 1) + ' / ' + pageCount;
    document.getElementById('view-pager-prev').disabled = viewPage <= 0;
    document.getElementById('view-pager-next').disabled = viewPage >= pageCount - 1;
  }
}

// Register pager (wired once; renders with the data shown last)
document.getElementById('view-pager-prev').addEventListener('click', () => {
  if (viewPage > 0 && currentViewItems) { viewPage--; renderTable(currentViewItems); }
});
document.getElementById('view-pager-next').addEventListener('click', () => {
  if (currentViewItems) { viewPage++; renderTable(currentViewItems); }
});
document.getElementById('view-pager-size').addEventListener('change', (e) => {
  viewPageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
  viewPage = 0;
  if (currentViewItems) renderTable(currentViewItems);
});

function escapeHtml(s) {
  return (s || "").toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
