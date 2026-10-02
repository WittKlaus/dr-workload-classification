// ================================================================================================
// BLOCK 7 · Tab 2 dependency network (D3 force graph)
// ------------------------------------------------------------------------------------------------
// Depends : Blocks 4–6, D3.
// Provides: renderGraph(items, findings) — circuit breaker above 1,500 workloads, foundation hub aggregation,
//           static layout above 600 nodes, layout selector (graphAnimateMode), filters and chips,
//           v0.16.0: edge endpoints at the circle edge + three arrow markers, hover direction highlight (hl-out/hl-in/hl-dim)
// Note    : _activeGraphSim must be stopped before every rebuild (memory).
// ================================================================================================
// Handle to the currently running simulation: on every rebuild (tab switch, language switch,
// data sync) the old simulation is stopped and released IMMEDIATELY. Otherwise it keeps ticking in
// the background and pins its complete node/edge structures in memory. With large data sets,
// several hundred MB of unreleasable objects pile up quickly.
let _activeGraphSim = null;
// Layout mode of the dependency network (v0.13.0): 'auto' | 'on' | 'off'; session setting
let graphAnimateMode = 'auto';

function renderGraph(items, findings) {
  if (_activeGraphSim) { _activeGraphSim.stop(); _activeGraphSim.on('tick', null).on('end', null); _activeGraphSim = null; }
  const svgEl = document.getElementById('graph-svg');
  svgEl.innerHTML = "";
  const width = svgEl.clientWidth || 1100;
  const height = 620;

  const weakEdgeKeys = new Set(findings.inconsistencies.map(inc => inc.from.id + '->' + inc.to.id));
  const FOUNDATION_KEY = "Tier 0 – Foundation";

  // ---- Circuit breaker (stage 3): above the budget, workloads WITHOUT real dependencies are removed
  // completely from simulation and DOM (not just display:none; forces and elements would still cost).
  // Foundation systems always stay in (switchable via chip). Thousands of unconnected dots carry no
  // information anyway; the status line points out the omission.
  const realDegreeAll = {};
  items.forEach(it => { realDegreeAll[it.id] = 0; });
  items.forEach(it => it.deps.forEach(depId => {
    if (realDegreeAll[depId] !== undefined) { realDegreeAll[it.id]++; realDegreeAll[depId]++; }
  }));
  const GRAPH_NODE_BUDGET = 1500;
  const breakerActive = items.length > GRAPH_NODE_BUDGET;
  const graphItems = breakerActive
    ? items.filter(it => realDegreeAll[it.id] > 0 || it.cls === FOUNDATION_KEY)
    : items;
  const breakerHidden = items.length - graphItems.length;

  const nodes = graphItems.map(it => ({ id: it.id, name: it.name, cls: it.cls, dependsOnFoundation: it.dependsOnFoundation !== false }));
  const nodeById = {};
  nodes.forEach(n => nodeById[n.id] = n);
  const nodeIds = new Set(nodes.map(n => n.id));
  const links = [];
  graphItems.forEach(it => {
    it.deps.forEach(depId => {
      if (nodeIds.has(depId)) {
        links.push({ source: it.id, target: depId, weak: weakEdgeKeys.has(it.id + '->' + depId), key: it.id + '->' + depId });
      }
    });
  });

  // Implicit foundation edges: every workload with "Depends on foundation? = yes" hangs on every
  // tier-0 system; not recorded but derived from the flag. Drawn dashed, with a very weak
  // simulation force (they must not dominate the layout), visible only when tier 0 is shown via
  // its chip (otherwise applyFilters removes the endpoints).
  const foundationNodes = nodes.filter(n => n.cls === FOUNDATION_KEY);
  const foundationDependents = nodes.filter(n => n.cls !== FOUNDATION_KEY && n.cls !== OUT_OF_SCOPE_CLASS && n.dependsOnFoundation);
  const realNodeCount = nodes.length; // before any hub node; for the status line
  const implicitLinks = [];
  let hubNode = null;
  // Aggregation (stage 3): N dependents × F foundation systems yields N×F edges; with 5,000 VMs
  // and 50 tier-0 systems that would be 250,000 simulation edges. Above the budget the implicit
  // edges are therefore bundled through a foundation hub node: dependents → hub → each tier-0
  // system, i.e. N+F edges with the same meaning ("depends on the foundation").
  const IMPLICIT_EDGE_BUDGET = 1500;
  if (foundationNodes.length && foundationDependents.length * foundationNodes.length > IMPLICIT_EDGE_BUDGET) {
    hubNode = {
      id: '__foundation_hub__',
      name: tr('Foundation (' + foundationNodes.length + ' Systeme, gebündelt)', 'Foundation (' + foundationNodes.length + ' systems, aggregated)'),
      cls: FOUNDATION_KEY, dependsOnFoundation: false, isHub: true
    };
    nodes.push(hubNode); nodeById[hubNode.id] = hubNode; nodeIds.add(hubNode.id);
    foundationDependents.forEach(n => implicitLinks.push({ source: n.id, target: hubNode.id, weak: false, implicit: true, key: 'imp:' + n.id + '->hub' }));
    foundationNodes.forEach(f => implicitLinks.push({ source: hubNode.id, target: f.id, weak: false, implicit: true, key: 'imp:hub->' + f.id }));
  } else {
    foundationDependents.forEach(n => {
      foundationNodes.forEach(f => {
        implicitLinks.push({ source: n.id, target: f.id, weak: false, implicit: true, key: 'imp:' + n.id + '->' + f.id });
      });
    });
  }
  const allLinks = links.concat(implicitLinks);

  // Node size/labels follow REAL dependencies only; implicit ones do not count
  const fullDegree = {};
  nodes.forEach(n => fullDegree[n.id] = 0);
  links.forEach(l => { fullDegree[l.source] = (fullDegree[l.source] || 0) + 1; fullDegree[l.target] = (fullDegree[l.target] || 0) + 1; });

  const hasOutOfScope = nodes.some(n => n.cls === OUT_OF_SCOPE_CLASS);
  // Out of Scope gets its own additional column to the right of the tier columns
  // (no real rank, hence not in TIER_RANK; appended here as a virtual rank at the end).
  const colX = t => {
    const rank = t === OUT_OF_SCOPE_CLASS ? TIER_ORDER.length : TIER_RANK[t];
    return (rank + 0.5) * (width / (TIER_ORDER.length + 1));
  };

  const svg = d3.select(svgEl).attr('viewBox', [0, 0, width, height]);
  const g = svg.append('g');
  const zoomBehavior = d3.zoom().scaleExtent([0.15, 5]).on('zoom', (event) => {
    g.attr('transform', event.transform);
  });
  svg.call(zoomBehavior);

  // v0.16.0: three markers (normal / weaker-dependency / hover highlight); the line ends at the node's edge
  // (drawPositions), so refX puts the tip exactly there for every node size.
  const defs = svg.append('defs');
  [['arrow', cssVar('--graph-arrow') || '#8C8C92'], ['arrow-weak', cssVar('--graph-weak') || '#D55E00'], ['arrow-hl', cssVar('--graph-hl') || '#232323']].forEach(([mid, col]) => {
    defs.append('marker').attr('id', mid).attr('viewBox', '0 -5 10 10').attr('refX', 9).attr('refY', 0)
      .attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', col);
  });
  const nodeR = d => d.isHub ? 14 : 5 + Math.min(12, fullDegree[d.id] || 0);
  const lid = x => (typeof x === 'object' ? x.id : x);
  // Explicit in/out degree per node for the tooltip ("depends on n · required by m"); implicit hub links excluded
  const outDeg = {}, inDeg = {};
  links.forEach(l => { const s = lid(l.source), tt = lid(l.target); outDeg[s] = (outDeg[s] || 0) + 1; inDeg[tt] = (inDeg[tt] || 0) + 1; });

  // Static layout (stage 3): from this node count on, the layout is no longer animated live but
  // computed synchronously up front and drawn once. The tick animation with thousands of DOM
  // updates per frame is the most expensive part of the graph.
  // v0.13.0: "Layout" selector in the toolbar: auto (threshold 600) or forced animated/static
  const GRAPH_STATIC_THRESHOLD = 600;
  const staticLayout = graphAnimateMode === 'auto' ? nodes.length > GRAPH_STATIC_THRESHOLD : graphAnimateMode === 'off';
  const layoutNote = document.getElementById('graph-layout-note');
  if (layoutNote) {
    layoutNote.textContent = staticLayout
      ? tr('statisch (' + nodes.length + ' Knoten' + (graphAnimateMode === 'auto' ? ', Schwelle ' + GRAPH_STATIC_THRESHOLD : '') + ')', 'static (' + nodes.length + ' nodes' + (graphAnimateMode === 'auto' ? ', threshold ' + GRAPH_STATIC_THRESHOLD : '') + ')')
      : tr('animiert (' + nodes.length + ' Knoten)' + (nodes.length > GRAPH_STATIC_THRESHOLD ? ' — kann träge sein' : ''), 'animated (' + nodes.length + ' nodes)' + (nodes.length > GRAPH_STATIC_THRESHOLD ? ' — may be sluggish' : ''));
  }
  if (staticLayout) {
    // Start positions close to the target tier column: the simulation then converges within a few ticks
    nodes.forEach((n, i) => {
      n.x = colX(n.cls) + (Math.random() - 0.5) * 80;
      n.y = 30 + ((i * 37) % Math.max(1, height - 60));
    });
  }

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(allLinks).id(d => d.id).distance(d => d.implicit ? 140 : 60).strength(d => d.implicit ? 0.01 : 0.5))
    .force('charge', d3.forceManyBody().strength(-90))
    .force('x', d3.forceX(d => colX(d.cls)).strength(0.12))
    .force('y', d3.forceY(height / 2).strength(0.04))
    .force('collide', d3.forceCollide(d => d.isHub ? 18 : 7 + Math.min(12, fullDegree[d.id] || 0)));
  _activeGraphSim = simulation;

  const linkCol = cssVar('--graph-link') || '#D7D7D7';
  const linkColImp = cssVar('--graph-link-implicit') || '#C9C9C9';
  const link = g.append('g').selectAll('line').data(allLinks, d => d.key).join('line')
    .attr('stroke', d => d.weak ? (cssVar('--graph-weak') || '#D55E00') : (d.implicit ? linkColImp : linkCol))
    .attr('stroke-width', d => d.weak ? 2.5 : (d.implicit ? 1 : 1.2))
    .attr('stroke-dasharray', d => d.implicit ? '4,4' : null)
    .attr('marker-end', d => d.implicit ? null : (d.weak ? 'url(#arrow-weak)' : 'url(#arrow)'));

  const node = g.append('g').selectAll('circle').data(nodes, d => d.id).join('circle')
    .attr('r', nodeR)
    .attr('fill', d => tierColor(d.cls))
    .attr('stroke', cssVar('--node-stroke') || '#fff').attr('stroke-width', 1.5)
    .style('cursor', 'pointer')
    .call(d3.drag()
      // In the static layout, dragging does NOT reheat the whole simulation:
      // only the node moves along and the positions are redrawn.
      .on('start', (event, d) => { if (!staticLayout && !event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; if (staticLayout) { d.x = event.x; d.y = event.y; drawPositions(); } })
      .on('end', (event, d) => { if (!staticLayout && !event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

  node.append('title').text(d => d.isHub
    ? d.name + tr(' — Sammelknoten: bündelt die impliziten Abhängigkeiten aller Workloads auf die Tier-0-Systeme', ' — aggregate node: bundles the implicit dependencies of all workloads on the tier-0 systems')
    : d.name + ' (' + tierLabel(d.cls) + ') — ' + tr('hängt ab von: ', 'depends on: ') + (outDeg[d.id] || 0) + tr(' · wird benötigt von: ', ' · required by: ') + (inDeg[d.id] || 0));

  const label = g.append('g').selectAll('text').data(nodes, d => d.id).join('text')
    // No permanent labels in the static layout (unreadable + expensive with thousands of nodes); hover still shows them
    .attr('class', d => 'node-label' + (d.isHub || (!staticLayout && fullDegree[d.id] >= 3) ? ' always' : ''))
    .attr('dy', -10).text(d => d.name);

  node.on('mouseenter', (event, d) => {
    label.filter(n => n.id === d.id).classed('always', true).raise();
    // Direction highlight (v0.16.0): solid = d depends on · dashed = required by d · everything else fades
    const near = new Set([d.id]);
    allLinks.forEach(l => { const s = lid(l.source), tt = lid(l.target); if (!l.implicit) { if (s === d.id) near.add(tt); if (tt === d.id) near.add(s); } });
    link.classed('hl-out', l => !l.implicit && lid(l.source) === d.id)
        .classed('hl-in', l => !l.implicit && lid(l.target) === d.id)
        .classed('hl-dim', l => l.implicit || (lid(l.source) !== d.id && lid(l.target) !== d.id));
    link.filter(l => !l.implicit && (lid(l.source) === d.id || lid(l.target) === d.id)).raise();
    node.classed('hl-dim', n => !near.has(n.id));
    label.classed('hl-dim', n => !near.has(n.id));
  }).on('mouseleave', (event, d) => {
    if (fullDegree[d.id] < 3) label.filter(n => n.id === d.id).classed('always', false);
    link.classed('hl-out', false).classed('hl-in', false).classed('hl-dim', false);
    node.classed('hl-dim', false); label.classed('hl-dim', false);
  });

  function drawPositions() {
    // Lines start/end at the circle edges so the arrowhead is visible for every node size
    link.each(function (d) {
      const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / len, uy = dy / len, rs = nodeR(d.source) + 1, rt = nodeR(d.target) + 2;
      this.setAttribute('x1', d.source.x + ux * rs); this.setAttribute('y1', d.source.y + uy * rs);
      this.setAttribute('x2', d.target.x - ux * rt); this.setAttribute('y2', d.target.y - uy * rt);
    });
    node.attr('cx', d => d.x).attr('cy', d => d.y);
    label.attr('x', d => d.x).attr('y', d => d.y);
  }
  if (staticLayout) {
    // Precompute the layout synchronously, draw once, no tick animation.
    // The tick count scales inversely with the node count (more nodes = more expensive ticks, but
    // the column-near start positions make large graphs converge faster anyway).
    simulation.stop();
    const ticks = Math.max(60, Math.min(250, Math.round(300000 / Math.max(1, nodes.length))));
    for (let i = 0; i < ticks; i++) simulation.tick();
    drawPositions();
  } else {
    simulation.on('tick', drawPositions);
    simulation.on('end', () => fitToVisible());
  }

  const legend = document.getElementById('graph-legend');
  legend.innerHTML = TIER_ORDER.map(t =>
    '<span class="badge"><span class="badge-dot" style="background:' + tierColor(t) + '"></span>' + escapeHtml(tierLabel(t)) + '</span>'
  ).join('') +
    (hasOutOfScope ? '<span class="badge"><span class="badge-dot" style="background:' + OUT_OF_SCOPE_COLOR + '"></span>Out of Scope (kein Backup)</span>' : '') +
    '<span class="badge">→ Pfeil = hängt ab von</span>' +
    '<span class="badge"><span style="display:inline-block;width:16px;height:2px;background:var(--graph-weak);margin-right:6px;"></span>schwächere Abhängigkeit</span>' +
    '<span class="badge" title="Maus über einen Knoten: durchgezogen = dieser Workload hängt ab von · gestrichelt = wird benötigt von · Rest blendet aus">Hover: durchgezogen = hängt ab von · gestrichelt = wird benötigt von</span>' +
    (implicitLinks.length ? '<span class="badge"><span style="display:inline-block;width:16px;border-top:2px dashed #ADACAF;margin-right:6px;"></span>implizite Foundation-Abhängigkeit</span>' : '');

  // Foundational (tier 0) is HIDDEN in the network by default: AD/DNS and friends connect to almost
  // everything and obscure the app-to-app dependencies that actually matter. Can be shown any time via
  // the tier-0 chip; "Reset filters" restores this default.
  // (FOUNDATION_KEY is declared at the top of this function.)
  const defaultActiveTiers = () => {
    const s = new Set(TIER_ORDER.filter(t => t !== FOUNDATION_KEY));
    if (hasOutOfScope) s.add(OUT_OF_SCOPE_CLASS);
    return s;
  };
  const activeTiers = defaultActiveTiers();
  const chipsBox = document.getElementById('tier-chips');
  chipsBox.innerHTML = TIER_ORDER.map(t =>
    '<span class="chip' + (activeTiers.has(t) ? '' : ' is-off') + '" data-tier="' + t + '" ' +
    (t === FOUNDATION_KEY ? 'title="Foundational-Systeme sind standardmäßig ausgeblendet (hängen mit fast allem zusammen) — zum Einblenden anklicken."' : '') + '>' +
    '<span class="chip__dot" style="background:' + tierColor(t) + '"></span>' + escapeHtml(tierLabel(t)) + '</span>'
  ).join('') +
    (hasOutOfScope ? '<span class="chip" data-tier="' + escapeHtml(OUT_OF_SCOPE_CLASS) + '"><span class="chip__dot" style="background:' + OUT_OF_SCOPE_COLOR + '"></span>Out of Scope (kein Backup)</span>' : '');
  chipsBox.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const t = chip.getAttribute('data-tier');
      if (activeTiers.has(t)) { activeTiers.delete(t); chip.classList.add('is-off'); }
      else { activeTiers.add(t); chip.classList.remove('is-off'); }
      applyFilters();
    });
  });

  const isolatedToggle = document.getElementById('toggle-isolated');
  const issuesToggle = document.getElementById('toggle-issues-only');
  const searchInput = document.getElementById('graph-search');
  const statsBox = document.getElementById('graph-stats');

  // The circuit breaker makes itself clearly noticed: yellow banner directly above the network
  const breakerNote = document.getElementById('graph-breaker-note');
  if (breakerActive && breakerHidden > 0) {
    breakerNote.textContent = '⚡ ' + tr(
      'Schutzschalter aktiv (mehr als ' + GRAPH_NODE_BUDGET + ' Workloads): ' + breakerHidden +
      ' Workloads ohne erfasste Abhängigkeiten wurden aus dem Netz entfernt — sie würden nur als unverbundene Punkte erscheinen und die Darstellung ausbremsen. Abhängigkeiten in Tab ① pflegen, dann erscheinen sie hier.',
      'Circuit breaker active (more than ' + GRAPH_NODE_BUDGET + ' workloads): ' + breakerHidden +
      ' workloads without recorded dependencies were removed from the graph — they would only appear as unconnected dots and slow down rendering. Maintain dependencies in tab ① and they will show up here.');
    breakerNote.classList.remove('hidden');
  } else {
    breakerNote.classList.add('hidden');
  }

  // Circuit breaker: isolated nodes are not even in the simulation, so the toggle would have no
  // effect; it is therefore fixed and explained.
  isolatedToggle.disabled = breakerActive;
  if (breakerActive) {
    isolatedToggle.checked = true;
    if (isolatedToggle.parentElement) isolatedToggle.parentElement.title =
      tr('Bei mehr als ' + GRAPH_NODE_BUDGET + ' Workloads werden isolierte Knoten aus Performance-Gründen gar nicht erst aufgebaut.',
         'With more than ' + GRAPH_NODE_BUDGET + ' workloads, isolated nodes are not built at all for performance reasons.');
  } else if (isolatedToggle.parentElement) {
    isolatedToggle.parentElement.title = '';
  }

  isolatedToggle.onchange = applyFilters;
  issuesToggle.onchange = applyFilters;
  const animateSel = document.getElementById('graph-animate-mode');
  if (animateSel) {
    animateSel.value = graphAnimateMode;
    animateSel.onchange = () => { graphAnimateMode = animateSel.value; renderGraph(items, findings); }; // full rebuild with the new mode
  }
  searchInput.oninput = debounce(applyFilters, 200); // no graph rebuild per keystroke
  document.getElementById('btn-fit').onclick = () => fitToVisible();
  document.getElementById('btn-reset').onclick = () => {
    activeTiers.clear(); defaultActiveTiers().forEach(t => activeTiers.add(t));
    chipsBox.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-off', !activeTiers.has(c.getAttribute('data-tier'))));
    isolatedToggle.checked = true;
    issuesToggle.checked = false;
    searchInput.value = '';
    applyFilters();
  };

  const idOf = x => (typeof x === 'object' ? x.id : x);

  function applyFilters() {
    let nodeSet = new Set(nodes.filter(n => activeTiers.has(n.cls)).map(n => n.id));
    let edgeSet = allLinks.filter(l => nodeSet.has(idOf(l.source)) && nodeSet.has(idOf(l.target)));

    if (issuesToggle.checked) {
      const touched = new Set();
      edgeSet.forEach(l => { if (l.weak) { touched.add(idOf(l.source)); touched.add(idOf(l.target)); } });
      const expanded = new Set(touched);
      edgeSet.forEach(l => {
        const s = idOf(l.source), t = idOf(l.target);
        if (touched.has(s)) expanded.add(t);
        if (touched.has(t)) expanded.add(s);
      });
      nodeSet = new Set([...nodeSet].filter(id => expanded.has(id)));
      edgeSet = edgeSet.filter(l => nodeSet.has(idOf(l.source)) && nodeSet.has(idOf(l.target)));
    }

    const term = searchInput.value.trim().toLowerCase();
    if (term) {
      const matches = new Set(nodes.filter(n => nodeSet.has(n.id) && n.name.toLowerCase().includes(term)).map(n => n.id));
      const expanded = new Set(matches);
      edgeSet.forEach(l => {
        const s = idOf(l.source), t = idOf(l.target);
        if (matches.has(s)) expanded.add(t);
        if (matches.has(t)) expanded.add(s);
      });
      nodeSet = new Set([...nodeSet].filter(id => expanded.has(id)));
      edgeSet = edgeSet.filter(l => nodeSet.has(idOf(l.source)) && nodeSet.has(idOf(l.target)));
    }

    if (isolatedToggle.checked) {
      const deg = {};
      nodeSet.forEach(id => deg[id] = 0);
      edgeSet.forEach(l => { if (l.implicit) return; deg[idOf(l.source)]++; deg[idOf(l.target)]++; }); // implicit edges do not count as "connected"
      // Exempt foundational systems: dependencies on them are implicit (deliberately not recorded), so
      // they often appear in the graph without edges, but they are never really "isolated". Without this
      // exemption the tier-0 chip would show them and this filter would hide them again immediately.
      nodeSet = new Set([...nodeSet].filter(id => deg[id] > 0 || (nodeById[id] && nodeById[id].cls === FOUNDATION_KEY)));
      edgeSet = edgeSet.filter(l => nodeSet.has(idOf(l.source)) && nodeSet.has(idOf(l.target)));
    }

    const edgeKeySet = new Set(edgeSet.map(l => l.key));
    node.style('display', d => nodeSet.has(d.id) ? null : 'none');
    label.style('display', d => nodeSet.has(d.id) ? null : 'none');
    link.style('display', d => edgeKeySet.has(d.key) ? null : 'none');

    // The hub node does not count as a workload in the status line
    const shownCount = hubNode && nodeSet.has(hubNode.id) ? nodeSet.size - 1 : nodeSet.size;
    const hiddenCount = realNodeCount - shownCount;
    const realVisible = edgeSet.filter(l => !l.implicit).length;
    const implicitVisible = edgeSet.length - realVisible;
    statsBox.textContent = shownCount + tr(' von ', ' of ') + items.length + tr(' Workloads angezeigt', ' workloads shown') +
      (hiddenCount > 0 ? ' (' + hiddenCount + tr(' ausgeblendet durch Filter)', ' hidden by filters)') : '') +
      ' · ' + realVisible + tr(' Abhängigkeiten sichtbar', ' dependencies visible') +
      (implicitVisible > 0 ? ' (+ ' + implicitVisible + tr(' implizite Foundation-Verbindungen, gestrichelt)', ' implicit foundation connections, dashed)') : '') + '.';

    fitToVisible(nodeSet);
  }

  function fitToVisible(nodeSet) {
    const visible = nodeSet ? nodes.filter(n => nodeSet.has(n.id)) : nodes;
    if (visible.length === 0) return;
    const xs = visible.map(d => d.x).filter(v => typeof v === 'number');
    const ys = visible.map(d => d.y).filter(v => typeof v === 'number');
    if (xs.length === 0) return;
    const pad = 40;
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
    const y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    const scale = Math.max(0.15, Math.min(5, Math.min(width / w, height / h)));
    const tx = width / 2 - scale * (x0 + x1) / 2;
    const ty = height / 2 - scale * (y0 + y1) / 2;
    svg.transition().duration(400).call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  setTimeout(applyFilters, 300);
}
