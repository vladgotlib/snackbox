(function() {
  const FORMATS = [
    { id: 'email',   color: '#378ADD', label: 'email' },
    { id: 'message', color: '#1D9E75', label: 'message' },
    { id: 'essay',   color: '#BA7517', label: 'essay' },
    { id: 'post',    color: '#D4537E', label: 'social post' },
    { id: 'code',    color: '#7F77DD', label: 'code' },
    { id: 'story',   color: '#D85A30', label: 'story' }
  ];
  const fmtColor = {};
  FORMATS.forEach(function(f){ fmtColor[f.id] = f.color; });

  const CONSTRAINTS = [
    { id: 'format',    label: 'an email',                    text: ' an email',                       test: function(d){ return d.format === 'email'; } },
    { id: 'audience',  label: 'to my manager',               text: ' to my manager',                  test: function(d){ return d.audience === 'manager'; } },
    { id: 'topic',     label: 'about delaying Project X',    text: ' about delaying Project X',       test: function(d){ return d.topic === 'project'; } },
    { id: 'tone',      label: 'professional but warm',       text: ', professional but warm',          test: function(d){ return d.x > 0.5 && d.x < 0.9; } },
    { id: 'length',    label: 'three short paragraphs',      text: ', three short paragraphs',         test: function(d){ return d.y > 0.35 && d.y < 0.65; } },
    { id: 'specifics', label: 'naming the 3 API blockers',   text: ', naming the 3 API blockers',      test: function(d){ return d.specificity > 0.45; } },
    { id: 'style',     label: 'matching my bulleted style',  text: ', matching my bulleted style',     test: function(d){ return d.style > 0.25 && d.style < 0.75; } }
  ];

  const N = 520;
  let seed = 1729;
  function rand() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }
  function chooseWeighted(opts, weights) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let r = rand() * total;
    for (let i = 0; i < opts.length; i++) {
      r -= weights[i];
      if (r <= 0) return opts[i];
    }
    return opts[opts.length - 1];
  }

  const dots = [];
  const formatIds = FORMATS.map(function(f){ return f.id; });
  for (let i = 0; i < N; i++) {
    const x = rand();
    const y = rand();
    let formatWeights;
    if (x > 0.5 && y > 0.3 && y < 0.7) formatWeights = [4, 1, 2, 1, 1, 0.5];
    else if (x < 0.35) formatWeights = [0.5, 3, 1, 1, 1, 3];
    else if (y > 0.7) formatWeights = [1, 0.5, 3, 2, 1, 2];
    else formatWeights = [1.5, 1.5, 1, 1.5, 1, 1];
    const format = chooseWeighted(formatIds, formatWeights);

    let audience;
    if (x > 0.5) audience = chooseWeighted(['manager','friend','public','technical','self'], [3, 0.5, 1, 2, 0.5]);
    else audience = chooseWeighted(['manager','friend','public','technical','self'], [0.4, 3, 1, 0.8, 1.5]);

    let topic;
    if (x > 0.5) topic = chooseWeighted(['project','personal','technical','creative','news','social'], [3, 0.5, 2, 0.5, 1, 0.5]);
    else topic = chooseWeighted(['project','personal','technical','creative','news','social'], [0.4, 2, 0.5, 2, 1, 2]);

    dots.push({ id: i, x: x, y: y, format: format, audience: audience, topic: topic, specificity: rand(), style: rand() });
  }

  const active = new Set(['format']);
  const dotGroup = document.getElementById('dof-dotgroup');
  const padL = 14, padR = 14, padT = 14, padB = 14;
  const VW = 600, VH = 260;
  const svgNS = 'http://www.w3.org/2000/svg';

  dots.forEach(function(d) {
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('cx', padL + d.x * (VW - padL - padR));
    c.setAttribute('cy', padT + (1 - d.y) * (VH - padT - padB));
    c.setAttribute('r', 3.2);
    c.setAttribute('fill', fmtColor[d.format]);
    c.setAttribute('class', 'dof-dot');
    d.el = c;
    dotGroup.appendChild(c);
  });

  const chipsEl = document.getElementById('dof-chips');
  CONSTRAINTS.forEach(function(c) {
    const b = document.createElement('button');
    b.className = 'dof-chip';
    b.textContent = c.label;
    b.dataset.id = c.id;
    b.addEventListener('click', function() {
      if (active.has(c.id)) active.delete(c.id);
      else active.add(c.id);
      render();
    });
    chipsEl.appendChild(b);
  });

  const legendEl = document.getElementById('dof-legend');
  FORMATS.forEach(function(f) {
    const item = document.createElement('span');
    item.className = 'dof-legend-item';
    const dot = document.createElement('span');
    dot.className = 'dof-legend-dot';
    dot.style.background = f.color;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(f.label));
    legendEl.appendChild(item);
  });

  function render() {
    let addText = '';
    CONSTRAINTS.forEach(function(c){ if (active.has(c.id)) addText += c.text; });
    const addEl = document.getElementById('dof-prompt-add');
    addEl.textContent = '';
    if (addText) {
      const span = document.createElement('span');
      span.className = 'dof-prompt-chunk';
      span.textContent = addText;
      addEl.appendChild(span);
    }

    chipsEl.querySelectorAll('.dof-chip').forEach(function(b) {
      if (active.has(b.dataset.id)) b.classList.add('is-active');
      else b.classList.remove('is-active');
    });

    const activeCs = CONSTRAINTS.filter(function(c){ return active.has(c.id); });
    let surviving = 0;
    dots.forEach(function(d) {
      let ok = true;
      for (let i = 0; i < activeCs.length; i++) {
        if (!activeCs[i].test(d)) { ok = false; break; }
      }
      d.el.style.opacity = ok ? 1 : 0.06;
      if (ok) surviving++;
    });

    const pct = (surviving / N) * 100;
    const pctEl = document.getElementById('dof-stat-pct');
    if (surviving === 0) pctEl.textContent = '< 0.2%';
    else if (pct < 1) pctEl.textContent = pct.toFixed(1) + '%';
    else pctEl.textContent = Math.round(pct) + '%';

    document.getElementById('dof-stat-n').textContent = active.size + ' / ' + CONSTRAINTS.length;
    let rText;
    if (surviving === 0) rText = '1000\u00d7+';
    else {
      const reduction = N / surviving;
      if (reduction < 10) rText = reduction.toFixed(1) + '\u00d7';
      else if (reduction < 1000) rText = Math.round(reduction) + '\u00d7';
      else rText = (Math.round(reduction / 100) / 10) + 'k\u00d7';
    }
    document.getElementById('dof-stat-reduction').textContent = rText;
  }

  document.querySelectorAll('[data-preset]').forEach(function(b) {
    b.addEventListener('click', function() {
      active.clear();
      const p = b.dataset.preset;
      if (p === 'none') active.add('format');
      else if (p === 'vague') { active.add('format'); active.add('audience'); }
      else if (p === 'medium') { active.add('format'); active.add('audience'); active.add('topic'); active.add('tone'); }
      else if (p === 'tight') CONSTRAINTS.forEach(function(c){ active.add(c.id); });
      render();
    });
  });

  render();
})();
