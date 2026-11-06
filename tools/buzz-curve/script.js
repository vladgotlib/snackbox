(function(){
  const $ = s => document.querySelector(s);
  const KEY = 'buzzcurve.v1';
  const MIN = 60000, HR = 3600000;
  const BETA = 0.015;          // % BAC cleared per hour
  const STD_G = 14;            // grams per US standard drink

  const TYPES = {
    beer:     {name:'Beer',     add:'beer',     abv:5,   sizes:[12,16,20], def:12,  dur:20, icon:'pint'},
    ipa:      {name:'IPA',      add:'IPA',      abv:6.5, sizes:[12,16],    def:12,  dur:20, icon:'bottle'},
    cider:    {name:'Cider',    add:'cider',    abv:5.5, sizes:[12,16],    def:12,  dur:20, icon:'tumbler'},
    seltzer:  {name:'Seltzer',  add:'seltzer',  abv:5,   sizes:[12,16],    def:12,  dur:20, icon:'can'},
    wine:     {name:'Wine',     add:'wine',     abv:13,  sizes:[5,6,9],    def:6,   dur:20, icon:'wine'},
    bubbly:   {name:'Bubbly',   add:'bubbly',   abv:12,  sizes:[4,5,6],    def:5,   dur:20, icon:'flute'},
    cocktail: {name:'Cocktail', add:'cocktail', abv:15,  sizes:[4,6,8],    def:6,   dur:20, icon:'martini'},
    shot:     {name:'Shot',     add:'shot',     abv:40,  sizes:[1,1.5,2],  def:1.5, dur:0,  icon:'shot'}
  };
  const SIPS = [0, 10, 20, 30, 45, 60];
  const ICONS = {
    pint:'<path d="M5 3h10l-1.3 14.1a1 1 0 0 1-1 .9H7.3a1 1 0 0 1-1-.9z"/><path d="M5.5 7h9"/>',
    bottle:'<path d="M8.2 2h3.6v3.2l1.7 2.6V17a1 1 0 0 1-1 1H7.5a1 1 0 0 1-1-1V7.8l1.7-2.6z"/><path d="M6.5 11h7"/>',
    tumbler:'<path d="M5 4h10l-1.1 12.6a1.5 1.5 0 0 1-1.5 1.4H7.6a1.5 1.5 0 0 1-1.5-1.4z"/><path d="M5.6 9h8.8"/>',
    can:'<rect x="6" y="3" width="8" height="15" rx="1.6"/><path d="M6 6h8M6 15h8"/>',
    wine:'<path d="M5.5 2.5h9c0 4.6-1.9 7.3-4.5 7.3S5.5 7.1 5.5 2.5z"/><path d="M10 9.8V17M7 17.5h6"/>',
    flute:'<path d="M8 2h4c.3 5.8-.6 8.6-2 8.6S7.7 7.8 8 2z"/><path d="M10 10.6V17M7.5 17.5h5"/>',
    martini:'<path d="M3 3.5h14L10 11z"/><path d="M10 11v6M7 17.5h6"/><path d="M13.5 2l-2 3.5"/>',
    shot:'<path d="M5.5 6h9l-1.2 11a1 1 0 0 1-1 .9H7.7a1 1 0 0 1-1-.9z"/><path d="M6.2 11h7.6"/>'
  };
  const icon = n => `<svg class="ico" viewBox="0 0 20 20" aria-hidden="true">${ICONS[n]}</svg>`;
  const FOOD = {
    empty:{label:'Empty', short:'empty stomach', ka:4.5, F:1.0},
    snack:{label:'Snack', short:'light snack',  ka:2.2, F:0.9},
    meal: {label:'Full meal', short:'full meal', ka:1.2, F:0.75}
  };

  const STAGES = [
    {max:0.02, name:'Faint glow', up:'warm, relaxed, a little chatty', down:'mellow, a touch sleepy',
     story:'A light warmth spreads through your chest and face, and your shoulders drop a little. Thinking and coordination are essentially normal.'},
    {max:0.04, name:'Loosened up', up:'relaxed, warm, talkative, upbeat', down:'mellow, warm, slowing down',
     story:'Your mood lifts and conversation flows more easily. Skin feels warm as blood vessels near the surface open up. Judgment softens in small ways you probably won\'t notice.'},
    {max:0.06, name:'Buzzed', up:'giddy, warm, social, face flushed', down:'mellow, heavy-lidded, thirsty',
     story:'A clear buzz. Inhibitions drop, laughs come easier and you talk a little louder. Your face and ears may be flushed. Reaction time is measurably slower, and small risks feel smaller than they are.'},
    {max:0.08, name:'Tipsy', up:'euphoric, loud, expressive, overconfident', down:'foggy, tired, sluggish, thirsty',
     story:'Peak sociability for most people. Balance, speech and vision are slightly off, and reasoning and short-term memory are slipping. You feel sharper than you are.'},
    {max:0.10, name:'Impaired', up:'loud, clumsy, overconfident, slow reflexes', down:'heavy, clumsy, foggy, drowsy',
     story:'At or over the US legal driving limit of 0.08. Coordination, depth perception and peripheral vision are noticeably worse. Self-control dips, which is why another drink sounds like a great idea right now.'},
    {max:0.13, name:'Drunk', up:'slurring, swaying, emotional, sloppy', down:'groggy, irritable, queasy',
     story:'Speech slurs, reactions are slow and balance goes. The euphoria starts tipping into irritability or sadness. Tomorrow morning is already compromised.'},
    {max:0.16, name:'Very drunk', up:'staggering, blurry-eyed, moody, queasy', down:'wrecked, nauseous, anxious',
     story:'Major loss of motor control and blurred vision. The fun has mostly worn off, and anxiety or restlessness can set in. Memory gaps become likely.'},
    {max:0.20, name:'Sloppy', up:'nauseous, dizzy, confused', down:'nauseous, dizzy, confused',
     story:'Nausea and dizziness, trouble walking. Blackouts are common in this range. Stop drinking, switch to water and stay with people you trust.'},
    {max:0.25, name:'Dazed', up:'disoriented, vomiting, needs help', down:'disoriented, vomiting, needs help',
     story:'Confused and disoriented, likely needing help to stand. Vomiting is likely while the gag reflex is weakened. Don\'t lie on your back, and don\'t be alone.'},
    {max:0.30, name:'Stupor', up:'barely responsive', down:'barely responsive',
     story:'Barely responsive. This is dangerous: breathing and the gag reflex can be suppressed.'},
    {max:Infinity, name:'Danger zone', up:'unresponsive, alcohol poisoning', down:'unresponsive, alcohol poisoning',
     story:'Alcohol poisoning range. Loss of consciousness and suppressed breathing are possible. Get medical help now.'}
  ];

  /* ---------- state ---------- */
  const uid = () => Math.random().toString(36).slice(2, 9);
  const roundMin = t => Math.round(t / MIN) * MIN;
  const endOf = d => d.t + (d.dur || 0) * MIN;
  const DEFAULTS = {lb:180, sex:'m', food:'snack'};
  function seedDrinks(){
    const now = Date.now();
    return [
      {id:uid(), type:'wine', oz:9,  abv:13, dur:20, t:roundMin(now - 70*MIN)},
      {id:uid(), type:'beer', oz:12, abv:5,  dur:20, t:roundMin(now - 30*MIN)}
    ];
  }
  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return null;
      const s = JSON.parse(raw);
      if(!s || !Array.isArray(s.drinks)) return null;
      s.settings = Object.assign({}, DEFAULTS, s.settings || {});
      s.drinks = s.drinks.filter(d => TYPES[d.type] && isFinite(d.t) && d.oz > 0 && d.abv > 0)
        .map(d => Object.assign({}, d, {dur: isFinite(d.dur) && d.dur >= 0 ? Math.min(180, d.dur) : TYPES[d.type].dur}));
      return s;
    }catch(e){ return null; }
  }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }

  let state = load() || {settings:Object.assign({}, DEFAULTS), sample:true, drinks:[]};
  if(state.sample) state.drinks = seedDrinks();
  function pruneOld(){
    if(!state.drinks.length || state.sample) return false;
    const last = Math.max(...state.drinks.map(endOf));
    if(Date.now() - last > 16*HR){ state.drinks = []; save(); return true; }
    return false;
  }
  pruneOld();

  /* ---------- model ---------- */
  const grams = d => d.oz * 29.5735 * (d.abv/100) * 0.789;
  const stdOf = d => grams(d) / STD_G;
  function params(){
    const s = state.settings;
    const r = s.sex === 'f' ? 0.55 : 0.68;
    const W = s.lb * 453.592;
    const f = FOOD[s.food] || FOOD.snack;
    return {r, W, f, kaMin: f.ka/60};
  }
  // Fraction of a drink swallowed by minute a, when it is sipped evenly over D minutes.
  function ingestedFrac(a, D){
    if(a <= 0) return 0;
    if(!(D >= 0.5)) return 1;
    return Math.min(1, a / D);
  }
  // Fraction of a drink that has reached the blood by minute a: even sipping over D minutes
  // into the stomach, first-order absorption (rate k per minute) out of it.
  function absorbedFrac(a, D, k){
    if(a <= 0) return 0;
    if(!(D >= 0.5)) return 1 - Math.exp(-k * a);
    if(a <= D) return (a - (1 - Math.exp(-k * a)) / k) / D;
    return 1 - (Math.exp(-k * (a - D)) - Math.exp(-k * a)) / (k * D);
  }
  let SIM = null;
  function simulate(){
    const ds = state.drinks.slice().sort((a,b) => a.t - b.t);
    if(!ds.length) return null;
    const {r, W, f, kaMin} = params();
    const doses = ds.map(d => ({t:d.t, D:d.dur || 0, pct: f.F * grams(d) / (r*W) * 100}));
    const t0 = Math.floor(ds[0].t / MIN) * MIN;
    const lastT = Math.max(...ds.map(endOf));
    const bac = [];
    let b = 0;
    for(let i = 0; i < 40*60; i++){
      const t = t0 + i*MIN;
      let inflow = 0, pending = 0;
      for(const d of doses){
        const a = (t - d.t) / MIN;
        const g1 = absorbedFrac(a, d.D, kaMin), g0 = absorbedFrac(a - 1, d.D, kaMin);
        inflow += d.pct * (g1 - g0);
        pending += d.pct * (1 - g1);
      }
      b = Math.max(0, b + inflow - BETA/60);
      bac.push(b);
      if(t >= lastT && b === 0 && pending < 0.0003) break;
    }
    let peak = 0, peakI = 0, lastPos = -1;
    for(let i = 0; i < bac.length; i++){ if(bac[i] > peak){ peak = bac[i]; peakI = i; } if(bac[i] > 0) lastPos = i; }
    return {t0, bac, drinks:ds, firstT:ds[0].t, lastT, peak, peakT:t0 + peakI*MIN, soberT:t0 + (lastPos+1)*MIN};
  }
  function bacAt(t){
    if(!SIM) return 0;
    const i = Math.round((t - SIM.t0) / MIN);
    if(i < 0) return 0;
    if(i >= SIM.bac.length) return SIM.bac[SIM.bac.length-1];
    return SIM.bac[i];
  }
  // Swallowed but not yet in the blood.
  function gutStd(t){
    if(!SIM) return 0;
    const {kaMin} = params();
    let g = 0;
    for(const d of SIM.drinks){
      const a = (t - d.t) / MIN;
      if(a > 0) g += grams(d) * (ingestedFrac(a, d.dur) - absorbedFrac(a, d.dur, kaMin));
    }
    return Math.max(0, g / STD_G);
  }
  // Still in the glass for drinks you're in the middle of.
  function glassInfo(t){
    let g = 0, end = 0;
    if(!SIM) return {std:0, end};
    for(const d of SIM.drinks){
      const a = (t - d.t) / MIN;
      if(a < 0) continue;
      const left = 1 - ingestedFrac(a, d.dur);
      if(left > 0){ g += grams(d) * left; end = Math.max(end, endOf(d)); }
    }
    return {std: g / STD_G, end};
  }
  function trendAt(t){
    const slope = (bacAt(t + 5*MIN) - bacAt(t - 5*MIN)) / 10 * 60;
    if(slope > 0.004) return 'rising';
    if(slope < -0.004) return 'falling';
    return bacAt(t) > 0.01 ? 'peak' : 'flat';
  }
  function climbFrom(t){
    let k = 0, v = bacAt(t);
    while(k < 360){
      const nv = bacAt(t + (k+1)*MIN);
      if(nv < v - 1e-7) break;
      v = nv; k++;
    }
    return {mins:k, val:v};
  }

  /* ---------- formatting ---------- */
  function fmtTime(t){
    const d = new Date(t); let h = d.getHours(); const m = d.getMinutes();
    const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
    return `${h}:${String(m).padStart(2,'0')} ${ap}`;
  }
  function fmtHour(t){ const d = new Date(t); let h = d.getHours(); const ap = h >= 12 ? 'pm' : 'am'; return (h % 12 || 12) + ap; }
  const fmtBac = b => b.toFixed(3) + '%';
  const fmt1 = x => (Math.round(x*10)/10).toFixed(1);
  const fmtOz = oz => (oz % 1 ? oz.toFixed(1) : String(oz));
  const fmtDur = m => m >= 60 ? (m % 60 ? fmt1(m/60) : String(m/60)) + ' hr' : m + ' min';

  /* ---------- narrative ---------- */
  function bodyRows(t, b){
    const rows = [];
    if(!SIM || t < SIM.firstT) return rows;
    const {r, W} = params();
    const glass = glassInfo(t), gut = gutStd(t);
    if(glass.std >= 0.15) rows.push(['Glass', `About ${fmt1(glass.std)} standard drink${glass.std >= 1.05 ? 's' : ''} still to sip, if you finish by ${fmtTime(glass.end)}.`]);
    if(gut >= 0.15) rows.push(['Stomach', `About ${fmt1(gut)} standard drink${gut >= 1.05 ? 's' : ''} swallowed and still soaking into your blood.`]);
    else if(b > 0) rows.push(['Stomach', glass.std >= 0.15 ? 'What you\'ve swallowed so far is already in your bloodstream.' : 'Everything you\'ve had is already in your bloodstream.']);
    if(b > 0){
      const gph = BETA/100 * r * W;
      const per = Math.round(STD_G / gph * 60 / 5) * 5;
      rows.push(['Liver', `Clearing about ${Math.round(gph)} g of alcohol an hour, one standard drink every ${per} minutes. Fully clear around ${fmtTime(SIM.soberT)}.`]);
    }
    if(b >= 0.02 && b < 0.2) rows.push(['Skin', 'Blood vessels near the surface are wide open, so your face runs warm and flushed. You feel warmer while actually losing body heat faster.']);
    const recent = SIM.drinks.some(d => d.t <= t && t - d.t < 3*HR);
    if(recent && b >= 0.01) rows.push(['Kidneys', 'Alcohol blocks vasopressin, the hormone that holds water in, so you pee out more than you drink. A glass of water per drink keeps you even.']);
    const hr = new Date(t).getHours();
    if(b >= 0.02 && (hr >= 21 || hr < 4)) rows.push(['Sleep', 'Go to bed now and you\'ll drop off fast, then sleep lighter with less REM in the second half of the night.']);
    return rows;
  }
  function describe(t){
    const base = {b:0, trend:null, level:0, body:[], alert:false};
    if(!SIM) return Object.assign(base, {name:'Sober', words:'clear-headed, baseline', story:'Nothing logged yet. Add a drink below and this card will tell you how it\'s hitting you, minute by minute.'});
    if(t < SIM.firstT) return Object.assign(base, {name:'Sober', words:'clear-headed, baseline', story:`This is before your first drink at ${fmtTime(SIM.firstT)}.`});
    const b = bacAt(t), tr = trendAt(t), climb = climbFrom(t);
    const body = bodyRows(t, b);
    if(b < 0.005){
      if(gutStd(t) + glassInfo(t).std > 0.1 && climb.mins > 2){
        return {name:'Incoming', words:'first sips, anticipation', b, trend:'rising', level:1, body, alert:false,
          story:`It's only starting to reach your blood. The first warmth usually shows up within 10 to 20 minutes, building to about ${fmtBac(climb.val)} around ${fmtTime(t + climb.mins*MIN)}.`};
      }
      return {name:'Cleared', words:'dry, flat, a little tired', b, trend:null, level:0, body, alert:false,
        story:'No alcohol left in your blood. Any thirst, headache or flat mood now comes from dehydration and rebound, not the alcohol itself. Water and sleep help most.'};
    }
    const st = STAGES.find(s => b < s.max);
    let story = st.story;
    if(tr === 'rising' && climb.mins >= 4){
      const m = climb.mins > 15 ? Math.round(climb.mins/5)*5 : climb.mins;
      story += ` Still climbing for about ${m} more minutes, toward ${fmtBac(climb.val)}.`;
    } else if(tr === 'falling' && b >= 0.02){
      story += ' You\'re past the peak and coming down. The good mood fades faster than the impairment does, so you\'ll feel more sober than you are.';
    } else if(tr === 'peak'){
      story += ' You\'re right around your peak.';
    }
    const level = b < 0.05 ? 1 : b < 0.08 ? 2 : b < 0.16 ? 3 : 4;
    return {name:st.name, words: tr === 'falling' ? st.down : st.up, story, b, trend:tr, level, body, alert: b >= 0.16};
  }
  function milestones(){
    if(!SIM) return [];
    const B = SIM.bac, out = [];
    const th = [
      {v:0.02, up:'Feeling it', down:'Mostly worn off', k:''},
      {v:0.05, up:'Buzzed', down:'Buzz fading', k:''},
      {v:0.08, up:'Over the 0.08 limit', down:null, k:'k-limit'}
    ];
    for(let i = 1; i < B.length; i++){
      for(const h of th){
        if(B[i-1] < h.v && B[i] >= h.v) out.push({t:SIM.t0 + i*MIN, label:h.up, cls:h.k});
        if(h.down && B[i-1] >= h.v && B[i] < h.v) out.push({t:SIM.t0 + i*MIN, label:h.down, cls:''});
      }
    }
    if(SIM.peak > 0.005) out.push({t:SIM.peakT, label:'Peak ' + fmtBac(SIM.peak), cls:'k-peak'});
    if(SIM.peak > 0 && B[B.length-1] === 0) out.push({t:SIM.soberT, label:'Alcohol cleared', cls:'k-clear'});
    return out.sort((a,b) => a.t - b.t);
  }

  /* ---------- rendering ---------- */
  let previewT = null;
  let geom = null;

  function renderSettings(){
    const s = state.settings;
    $('#meSummary').textContent = `${s.lb} lb · ${s.sex === 'f' ? 'female' : 'male'} · ${(FOOD[s.food] || FOOD.snack).short}`;
    $('#lb').value = s.lb;
    $('#sexSeg').innerHTML = [['m','Male'],['f','Female']].map(([v,l]) =>
      `<button type="button" class="chip" role="radio" data-v="${v}" aria-checked="${s.sex === v}">${l}</button>`).join('');
    $('#foodSeg').innerHTML = Object.entries(FOOD).map(([v,f]) =>
      `<button type="button" class="chip" role="radio" data-v="${v}" aria-checked="${s.food === v}">${f.label}</button>`).join('');
  }

  function renderNow(){
    const real = Date.now();
    const t = previewT ?? real;
    const d = describe(t);
    $('#clock').textContent = fmtTime(t);
    $('#mode').textContent = previewT === null ? 'right now' : (t > real ? 'projected' : 'earlier');
    $('#backNow').hidden = previewT === null;
    const pill = $('#trendPill');
    const labels = {rising:'Rising', falling:'Coming down', peak:'At peak'};
    pill.hidden = !labels[d.trend];
    if(labels[d.trend]){ pill.textContent = labels[d.trend]; pill.dataset.t = d.trend; }
    $('#nowCard').dataset.level = d.level;
    $('#stateName').textContent = d.name;
    $('#words').textContent = d.words;
    $('#bacVal').innerHTML = d.b.toFixed(3) + '<small>%</small>';
    let note = 'estimated blood alcohol';
    if(SIM && SIM.peak > 0.005){ note += SIM.peakT > real ? ` · peak ${fmtBac(SIM.peak)} at ${fmtTime(SIM.peakT)}` : ` · peaked ${fmtBac(SIM.peak)} at ${fmtTime(SIM.peakT)}`; }
    $('#bacNote').textContent = note;
    $('#story').textContent = d.story;
    $('#alert').hidden = !d.alert;
    const bl = $('#bodyList');
    bl.hidden = !d.body.length;
    bl.innerHTML = d.body.map(([k,v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  }

  function niceMax(v){ return [0.1,0.12,0.16,0.2,0.24,0.3,0.4,0.5].find(x => x >= v) || Math.ceil(v*10)/10; }

  function renderChart(){
    const box = $('#chart');
    if(!SIM){ box.innerHTML = '<div class="chart-empty">Your blood alcohol curve appears here after your first drink.</div>'; geom = null; return; }
    const real = Date.now();
    const Wd = Math.max(300, Math.round(box.clientWidth || 600));
    const H = Wd < 480 ? 210 : 240;
    const L = 34, R = 12, T = 20, B = 28;
    const tA = SIM.t0 - 20*MIN;
    let end = Math.max(SIM.soberT, real);
    if(real > SIM.soberT + 2*HR) end = SIM.soberT;
    let tB = end + 20*MIN;
    if(tB - tA < 3*HR) tB = tA + 3*HR;
    const ymax = niceMax(Math.max(0.1, SIM.peak * 1.18));
    const X = t => L + (t - tA) / (tB - tA) * (Wd - L - R);
    const Y = v => T + (1 - v/ymax) * (H - T - B);
    geom = {tA, tB, L, R, W:Wd};
    const f1 = n => n.toFixed(1);
    let s = `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Estimated blood alcohol from ${fmtTime(SIM.firstT)}, peaking at ${fmtBac(SIM.peak)} around ${fmtTime(SIM.peakT)}, clear around ${fmtTime(SIM.soberT)}.">`;
    s += `<defs>
      <linearGradient id="gArea" gradientUnits="userSpaceOnUse" x1="0" y1="${f1(Y(Math.min(ymax,0.14)))}" x2="0" y2="${f1(Y(0))}">
        <stop offset="0" class="stA" stop-opacity=".42"/><stop offset=".5" class="stB" stop-opacity=".28"/><stop offset="1" class="stB" stop-opacity=".03"/>
      </linearGradient>
      <linearGradient id="gLine" gradientUnits="userSpaceOnUse" x1="0" y1="${f1(Y(Math.min(ymax,0.11)))}" x2="0" y2="${f1(Y(0))}">
        <stop offset="0" class="stA"/><stop offset=".45" class="stB"/><stop offset="1" class="stB"/>
      </linearGradient></defs>`;
    const step = ymax <= 0.12 ? 0.02 : ymax <= 0.2 ? 0.04 : 0.05;
    for(let v = 0; v <= ymax + 1e-9; v += step){
      const y = f1(Y(v));
      s += `<line class="${v === 0 ? 'axis' : 'grid'}" x1="${L}" x2="${Wd-R}" y1="${y}" y2="${y}"/>`;
      s += `<text x="${L-6}" y="${f1(Y(v)+4)}" text-anchor="end">${v === 0 ? '0' : v.toFixed(2).replace(/^0/,'')}</text>`;
    }
    if(ymax >= 0.08){
      const y = f1(Y(0.08));
      s += `<line class="limit" x1="${L}" x2="${Wd-R}" y1="${y}" y2="${y}"/>`;
      s += `<text class="limit-t" x="${Wd-R}" y="${f1(Y(0.08)-5)}" text-anchor="end">0.08 driving limit</text>`;
    }
    const spanH = (tB - tA) / HR;
    const every = spanH <= 8 ? 1 : spanH <= 16 ? 2 : 3;
    const hd = new Date(tA); hd.setMinutes(0,0,0); hd.setHours(hd.getHours() + 1);
    for(let t = hd.getTime(); t < tB; t += HR){
      if(new Date(t).getHours() % every) continue;
      const x = X(t);
      const anchor = x < L + 14 ? 'start' : x > Wd - R - 14 ? 'end' : 'middle';
      s += `<line class="grid" x1="${f1(x)}" x2="${f1(x)}" y1="${f1(Y(0))}" y2="${f1(Y(0)+4)}"/>`;
      s += `<text x="${f1(x)}" y="${H-8}" text-anchor="${anchor}">${fmtHour(t)}</text>`;
    }
    const n = SIM.bac.length, stp = n > 600 ? 3 : 2;
    const pts = [];
    for(let i = 0; i < n; i += stp) pts.push([SIM.t0 + i*MIN, SIM.bac[i]]);
    pts.push([SIM.t0 + (n-1)*MIN, SIM.bac[n-1]]);
    const toPath = arr => arr.map((p,i) => (i ? 'L' : 'M') + f1(X(p[0])) + ' ' + f1(Y(p[1]))).join('');
    s += `<path fill="url(#gArea)" d="M${f1(X(SIM.t0))} ${f1(Y(0))}${toPath(pts).replace(/^M/,'L')}L${f1(X(pts[pts.length-1][0]))} ${f1(Y(0))}Z"/>`;
    const nowPt = [real, bacAt(real)];
    const past = pts.filter(p => p[0] <= real), fut = pts.filter(p => p[0] >= real);
    if(real > SIM.t0 && real < pts[pts.length-1][0]){ past.push(nowPt); fut.unshift(nowPt); }
    if(past.length > 1) s += `<path class="line-past" stroke="url(#gLine)" d="${toPath(past)}"/>`;
    if(fut.length > 1) s += `<path class="line-fut" stroke="url(#gLine)" d="${toPath(fut)}"/>`;
    for(const d of SIM.drinks){
      if(d.dur > 0) s += `<line class="dk-span" x1="${f1(X(d.t))}" x2="${f1(X(endOf(d)))}" y1="${f1(Y(0))}" y2="${f1(Y(0))}"/>`;
    }
    for(const d of SIM.drinks){
      const when = d.dur > 0 ? `${fmtTime(d.t)} to ${fmtTime(endOf(d))}` : `at ${fmtTime(d.t)}`;
      s += `<circle class="dk" cx="${f1(X(d.t))}" cy="${f1(Y(0))}" r="4.5"><title>${TYPES[d.type].name}, ${fmtOz(d.oz)} oz, ${when}</title></circle>`;
    }
    if(real >= tA && real <= tB){
      const x = X(real);
      const anchor = x < L + 16 ? 'start' : x > Wd - R - 16 ? 'end' : 'middle';
      s += `<line class="nowline" x1="${f1(x)}" x2="${f1(x)}" y1="${T-4}" y2="${f1(Y(0))}"/>`;
      s += `<text class="now-t" x="${f1(x)}" y="${T-8}" text-anchor="${anchor}">now</text>`;
      if(previewT === null){
        s += `<circle class="pulse" cx="${f1(x)}" cy="${f1(Y(nowPt[1]))}" r="6"/>`;
        s += `<circle class="dot" cx="${f1(x)}" cy="${f1(Y(nowPt[1]))}" r="5.5"/>`;
      }
    }
    if(previewT !== null){
      const x = X(previewT);
      s += `<line class="viewline" x1="${f1(x)}" x2="${f1(x)}" y1="${T}" y2="${f1(Y(0))}"/>`;
      s += `<circle class="dot" cx="${f1(x)}" cy="${f1(Y(bacAt(previewT)))}" r="5.5"/>`;
    }
    s += '</svg>';
    box.innerHTML = s;
  }

  function renderMiles(){
    const ol = $('#miles');
    const real = Date.now();
    const ms = milestones();
    ol.hidden = !ms.length;
    ol.innerHTML = ms.map(m => `<li class="${m.t <= real ? 'past' : 'next'} ${m.cls}"><button type="button" data-t="${m.t}"><time>${fmtTime(m.t)}</time><span>${m.label}</span></button></li>`).join('');
    const firstNext = ol.querySelector('.next');
    if(firstNext) ol.scrollLeft = Math.max(0, firstNext.offsetLeft - ol.offsetLeft - 60);
  }

  function renderLog(){
    const ds = state.drinks.slice().sort((a,b) => a.t - b.t);
    $('#drinkList').innerHTML = ds.map(d => {
      const T = TYPES[d.type];
      return `<li class="dr">${icon(T.icon)}<div class="dr-main"><span class="dr-name">${T.name}${state.sample ? '<span class="tag">Example</span>' : ''}</span><span class="dr-meta">${fmtOz(d.oz)} oz · ${d.abv}% · ${fmt1(stdOf(d))} std · ${d.dur > 0 ? 'over ' + fmtDur(d.dur) : 'all at once'}</span></div><time class="dr-time">${fmtTime(d.t)}</time><button type="button" class="x" data-id="${d.id}" aria-label="Remove ${T.name} at ${fmtTime(d.t)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></li>`;
    }).join('');
    $('#emptyLog').hidden = ds.length > 0;
    $('#clearBtn').hidden = !ds.length;
    const tot = ds.reduce((a,d) => a + stdOf(d), 0);
    $('#totals').textContent = ds.length ? `${fmt1(tot)} standard drinks since ${fmtTime(ds[0].t)}` : '';
    $('#sampleBanner').hidden = !state.sample;
  }

  function renderAll(){
    renderSettings(); renderNow(); renderChart(); renderMiles(); renderLog();
  }
  function recompute(){ SIM = simulate(); renderAll(); }

  /* ---------- add form ---------- */
  const last = state.drinks.length ? state.drinks.slice().sort((a,b) => b.t - a.t)[0] : null;
  const startType = last && !state.sample ? last.type : 'wine';
  const sel = {type:startType, oz:TYPES[startType].def, abv:TYPES[startType].abv, dur:TYPES[startType].dur};
  let timeTouched = false;
  let agoSel = 0;
  const whenEl = $('#when'), ozEl = $('#oz'), abvEl = $('#abv');

  function hhmm(t){ const d = new Date(t); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
  function setWhen(ago){ whenEl.value = hhmm(Date.now() - ago*MIN); agoSel = ago; renderAgo(); }
  function renderAgo(){
    $('#agoChips').innerHTML = [[0,'Now'],[15,'15 min ago'],[30,'30 min ago'],[60,'1 hr ago']].map(([v,l]) =>
      `<button type="button" class="chip" data-ago="${v}" aria-pressed="${agoSel === v}">${l}</button>`).join('');
  }
  function parseWhen(){
    const m = /^(\d{1,2}):(\d{2})/.exec(whenEl.value || '');
    if(!m) return roundMin(Date.now());
    // The input has no date: use whichever of yesterday, today or tomorrow puts it closest to now.
    const now = Date.now();
    let best = null;
    for(const off of [-1, 0, 1]){
      const d = new Date(now); d.setDate(d.getDate() + off); d.setHours(+m[1], +m[2], 0, 0);
      const t = d.getTime();
      if(best === null || Math.abs(t - now) < Math.abs(best - now)) best = t;
    }
    return best;
  }
  function renderTypes(){
    $('#types').innerHTML = Object.entries(TYPES).map(([k,v]) =>
      `<button type="button" class="type" role="radio" aria-checked="${k === sel.type}" data-k="${k}">${icon(v.icon)}<span>${v.name}</span></button>`).join('');
    $('#sizeChips').innerHTML = TYPES[sel.type].sizes.map(oz =>
      `<button type="button" class="chip" data-oz="${oz}" aria-pressed="${oz === sel.oz}">${fmtOz(oz)} oz</button>`).join('');
    $('#sipChips').innerHTML = SIPS.map(m =>
      `<button type="button" class="chip" role="radio" data-dur="${m}" aria-checked="${m === sel.dur}">${m ? fmtDur(m) : 'All at once'}</button>`).join('');
  }
  function syncForm(){
    ozEl.value = sel.oz; abvEl.value = sel.abv;
    renderTypes(); updatePreview();
  }
  function updatePreview(){
    const el = $('#stdPreview');
    el.classList.remove('err');
    const ok = sel.oz > 0 && sel.oz <= 64 && sel.abv > 0 && sel.abv <= 95;
    el.textContent = ok ? `= ${fmt1(stdOf(sel))} standard drink${Math.abs(stdOf(sel) - 1) < 0.05 ? '' : 's'}` : '';
    $('#addBtn').textContent = 'Add ' + TYPES[sel.type].add;
  }

  $('#types').addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if(!b) return;
    const k = b.dataset.k; sel.type = k; sel.oz = TYPES[k].def; sel.abv = TYPES[k].abv; sel.dur = TYPES[k].dur; syncForm();
  });
  $('#sipChips').addEventListener('click', e => {
    const b = e.target.closest('[data-dur]'); if(!b) return;
    sel.dur = +b.dataset.dur; renderTypes();
  });
  $('#sizeChips').addEventListener('click', e => {
    const b = e.target.closest('[data-oz]'); if(!b) return;
    sel.oz = parseFloat(b.dataset.oz); syncForm();
  });
  ozEl.addEventListener('input', () => { sel.oz = parseFloat(ozEl.value) || 0; renderTypes(); updatePreview(); });
  abvEl.addEventListener('input', () => { sel.abv = parseFloat(abvEl.value) || 0; updatePreview(); });
  whenEl.addEventListener('input', () => { timeTouched = true; agoSel = -1; renderAgo(); });
  $('#agoChips').addEventListener('click', e => {
    const b = e.target.closest('[data-ago]'); if(!b) return;
    const ago = +b.dataset.ago; timeTouched = ago !== 0; setWhen(ago);
  });
  $('#addBtn').addEventListener('click', () => {
    const el = $('#stdPreview');
    if(!(sel.oz >= 0.25 && sel.oz <= 64)){ el.textContent = 'Enter a size between 0.25 and 64 oz.'; el.classList.add('err'); return; }
    if(!(sel.abv >= 0.5 && sel.abv <= 95)){ el.textContent = 'Enter an ABV between 0.5 and 95%.'; el.classList.add('err'); return; }
    const before = {drinks: state.drinks.slice(), sample: state.sample};
    if(state.sample){ state.drinks = []; state.sample = false; }
    const d = {id:uid(), type:sel.type, oz:sel.oz, abv:sel.abv, dur:sel.dur, t:parseWhen()};
    state.drinks.push(d);
    save(); previewT = null;
    timeTouched = false; setWhen(0);
    recompute();
    toast(`Added ${TYPES[d.type].add}, started ${fmtTime(d.t)}`, before);
  });

  /* ---------- log actions + undo ---------- */
  let undoSnap = null, toastTimer = null;
  function toast(msg, snap){
    undoSnap = snap || null;
    $('#toastMsg').textContent = msg;
    $('#undoBtn').hidden = !undoSnap;
    $('#toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('#toast').hidden = true; undoSnap = null; }, 6000);
  }
  $('#undoBtn').addEventListener('click', () => {
    if(!undoSnap) return;
    state.drinks = undoSnap.drinks; state.sample = undoSnap.sample;
    if(state.sample) state.drinks = seedDrinks();
    undoSnap = null; save(); $('#toast').hidden = true; recompute();
  });
  $('#drinkList').addEventListener('click', e => {
    const b = e.target.closest('[data-id]'); if(!b) return;
    const d = state.drinks.find(x => x.id === b.dataset.id); if(!d) return;
    const before = {drinks: state.drinks.slice(), sample: state.sample};
    state.drinks = state.drinks.filter(x => x.id !== d.id);
    if(state.sample && !state.drinks.length) state.sample = false;
    save(); recompute();
    toast(`Removed ${TYPES[d.type].add} at ${fmtTime(d.t)}`, before);
  });
  $('#clearBtn').addEventListener('click', () => {
    const before = {drinks: state.drinks.slice(), sample: state.sample};
    state.drinks = []; state.sample = false; previewT = null;
    save(); recompute();
    toast('Cleared the night', before);
  });
  $('#clearSample').addEventListener('click', () => {
    state.drinks = []; state.sample = false; previewT = null; save(); recompute();
  });

  /* ---------- settings ---------- */
  $('#meBtn').addEventListener('click', () => {
    const p = $('#settings'); p.hidden = !p.hidden;
    $('#meBtn').setAttribute('aria-expanded', String(!p.hidden));
  });
  $('#lb').addEventListener('change', () => {
    const v = Math.round(parseFloat($('#lb').value));
    state.settings.lb = isFinite(v) ? Math.min(400, Math.max(80, v)) : DEFAULTS.lb;
    save(); recompute();
  });
  $('#sexSeg').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if(!b) return; state.settings.sex = b.dataset.v; save(); recompute(); });
  $('#foodSeg').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if(!b) return; state.settings.food = b.dataset.v; save(); recompute(); });

  /* ---------- scrubbing ---------- */
  const chart = $('#chart');
  let dragging = false, prevPreview = null;
  function setPreview(t){
    if(!geom) return;
    t = Math.min(geom.tB, Math.max(geom.tA, t));
    t = Math.round(t / (5*MIN)) * 5*MIN;
    previewT = Math.abs(t - Date.now()) < 4*MIN ? null : t;
    renderNow(); renderChart();
  }
  function tFromEvent(e){
    const rect = chart.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (geom.W / rect.width);
    return geom.tA + (px - geom.L) / (geom.W - geom.L - geom.R) * (geom.tB - geom.tA);
  }
  chart.addEventListener('pointerdown', e => {
    if(!geom) return;
    dragging = true; prevPreview = previewT;
    try{ chart.setPointerCapture(e.pointerId); }catch(err){}
    if(e.pointerType === 'mouse') setPreview(tFromEvent(e));
  });
  chart.addEventListener('pointermove', e => { if(dragging && geom) setPreview(tFromEvent(e)); });
  chart.addEventListener('pointerup', e => { if(dragging && geom) setPreview(tFromEvent(e)); dragging = false; });
  chart.addEventListener('pointercancel', () => { if(dragging){ dragging = false; previewT = prevPreview; renderNow(); renderChart(); } });
  chart.addEventListener('keydown', e => {
    if(!geom) return;
    const base = previewT ?? Date.now();
    if(e.key === 'ArrowRight'){ e.preventDefault(); setPreview(base + 10*MIN); }
    else if(e.key === 'ArrowLeft'){ e.preventDefault(); setPreview(base - 10*MIN); }
    else if(e.key === 'Escape' || e.key === 'Home'){ e.preventDefault(); previewT = null; renderNow(); renderChart(); }
  });
  $('#backNow').addEventListener('click', () => { previewT = null; renderNow(); renderChart(); });
  $('#miles').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if(!b) return;
    previewT = +b.dataset.t; if(Math.abs(previewT - Date.now()) < 4*MIN) previewT = null;
    renderNow(); renderChart();
    $('#nowCard').scrollIntoView({block:'nearest', behavior:'smooth'});
  });

  /* ---------- live clock ---------- */
  function tick(){
    if(document.hidden) return;
    if(pruneOld()) { previewT = null; recompute(); return; }
    if(!timeTouched) setWhen(0);
    if(state.sample){ /* keep the example anchored to the present */ }
    if(previewT === null){ renderNow(); renderChart(); renderMiles(); }
  }
  setInterval(tick, 20000);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) tick(); });
  if('ResizeObserver' in window){
    let lastW = 0;
    new ResizeObserver(() => { const w = chart.clientWidth; if(Math.abs(w - lastW) > 2){ lastW = w; renderChart(); } }).observe(chart);
  } else {
    window.addEventListener('resize', renderChart);
  }

  setWhen(0);
  syncForm();
  recompute();
})();
