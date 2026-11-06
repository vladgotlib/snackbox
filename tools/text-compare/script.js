(() => {
'use strict';

/* ---------------- State and elements ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const taA = $('#textA'), taB = $('#textB'), out = $('#output');
const S = { mode: 'word', view: 'inline', ignoreCase: false, ignoreSpace: true, quotes: true, hideSame: false, res: null, cur: -1, coarse: false };

/* ---------------- Text helpers ---------------- */
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WORD_CHARS = '\\p{L}\\p{M}\\p{N}';
const WORD_RE = new RegExp(`[${WORD_CHARS}]+(?:['\u2019\\-][${WORD_CHARS}]+)*`, 'gu');
const TOK_WORD = new RegExp(`\\s+|[${WORD_CHARS}]+(?:['\u2019\\-][${WORD_CHARS}]+)*|[^\\s${WORD_CHARS}]`, 'gu');
const TOK_SENT = /[^.!?\u2026\n]+[.!?\u2026]*["'\u201D\u2019)\]]*[ \t]*|[.!?\u2026]+["'\u201D\u2019)\]]*[ \t]*|\n+/gu;
const HAS_WORD = new RegExp(`[${WORD_CHARS}]`, 'u');

const countWords = s => (s.match(WORD_RE) || []).length;
const countChars = s => s.replace(/\s/g, '').length;
const normQuotes = s => s.replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'").replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"');

function charTokens(s) {
  const out = []; let ws = '';
  for (const ch of s) {
    if (/\s/.test(ch)) ws += ch;
    else { if (ws) { out.push(ws); ws = ''; } out.push(ch); }
  }
  if (ws) out.push(ws);
  return out;
}
function tokenize(s) {
  if (S.mode === 'char') return charTokens(s);
  if (S.mode === 'sent') return s.match(TOK_SENT) || [];
  return s.match(TOK_WORD) || [];
}
function keyOf(t) {
  if (!/\S/.test(t)) return S.ignoreSpace ? (t.includes('\n') ? '\n' : ' ') : t;
  let k = t;
  if (S.quotes) k = normQuotes(k);
  if (S.ignoreCase) k = k.toLowerCase();
  if (S.ignoreSpace && S.mode === 'sent') k = k.replace(/\s+/g, ' ').trim();
  return k;
}
function lineKey(l) {
  let k = l;
  if (S.quotes) k = normQuotes(k);
  if (S.ignoreCase) k = k.toLowerCase();
  if (S.ignoreSpace) k = k.replace(/\s+/g, ' ').trim();
  return k;
}

/* ---------------- Diff engine (Myers O(ND)) ---------------- */
// Returns run-length ops: [op, count] where op 0 = same, -1 = removed, 1 = added.
function diff(a, b, maxD) {
  const n = a.length, m = b.length;
  let s = 0;
  while (s < n && s < m && a[s] === b[s]) s++;
  let ea = n, eb = m;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  const ops = [];
  if (s) ops.push([0, s]);
  for (const o of myers(a, b, s, ea, s, eb, maxD)) ops.push(o);
  if (n - ea) ops.push([0, n - ea]);
  const r = [];
  for (const o of ops) {
    if (!o[1]) continue;
    const l = r[r.length - 1];
    if (l && l[0] === o[0]) l[1] += o[1]; else r.push([o[0], o[1]]);
  }
  return r;
}
function myers(a, b, a0, a1, b0, b1, maxD) {
  const N = a1 - a0, M = b1 - b0;
  if (!N && !M) return [];
  if (!N) return [[1, M]];
  if (!M) return [[-1, N]];
  const lim = Math.min(maxD, N + M), off = lim + 1, size = 2 * lim + 3;
  const vx = new Int32Array(size).fill(-1), vp = new Array(size).fill(null);
  for (let d = 0; d <= lim; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x, node;
      if (d === 0) { x = 0; node = null; }
      else {
        const up = vx[off + k + 1], left = vx[off + k - 1];
        const upOk = up >= 0 && up - k <= M;
        const leftOk = left >= 0 && left + 1 <= N;
        if (!upOk && !leftOk) { vx[off + k] = -1; vp[off + k] = null; continue; }
        if (leftOk && (!upOk || left + 1 > up)) { x = left + 1; node = { op: -1, n: 1, prev: vp[off + k - 1] }; }
        else { x = up; node = { op: 1, n: 1, prev: vp[off + k + 1] }; }
      }
      let y = x - k, sn = 0;
      while (x < N && y < M && a[a0 + x] === b[b0 + y]) { x++; y++; sn++; }
      if (sn) node = { op: 0, n: sn, prev: node };
      vx[off + k] = x; vp[off + k] = node;
      if (x >= N && y >= M) {
        const res = [];
        for (let p = node; p; p = p.prev) res.push([p.op, p.n]);
        return res.reverse();
      }
    }
  }
  S.coarse = true; // texts too different to align finely: show as replaced
  return [[-1, N], [1, M]];
}

/* ---------------- Compare two texts ---------------- */
function compareTexts(A, B) {
  S.coarse = false;
  A = A.replace(/\r\n?/g, '\n'); B = B.replace(/\r\n?/g, '\n');
  const la = A.split('\n'), lb = B.split('\n');
  const lops = diff(la.map(lineKey), lb.map(lineKey), 4000);
  const blocks = [], changes = [];
  let i = 0, j = 0, pa = [], pb = [], pa0 = 0, pb0 = 0;
  const flush = () => {
    if (!pa.length && !pb.length) return;
    blocks.push(makeHunk(pa, pb, pa0, pb0, changes));
    pa = []; pb = [];
  };
  for (const [op, n] of lops) {
    if (op === 0) {
      flush();
      for (let t = 0; t < n; t++) blocks.push({ eq: true, a: la[i + t], b: lb[j + t], la: i + t, lb: j + t });
      i += n; j += n;
    } else {
      if (!pa.length && !pb.length) { pa0 = i; pb0 = j; }
      if (op < 0) { pa = pa.concat(la.slice(i, i + n)); i += n; }
      else { pb = pb.concat(lb.slice(j, j + n)); j += n; }
    }
  }
  flush();

  const unit = S.mode === 'char' ? countChars : countWords;
  let removed = 0, added = 0;
  for (const c of changes) { removed += unit(c.del); added += unit(c.ins); }
  const totA = unit(A), totB = unit(B);
  const same = Math.max(0, totA - removed);
  const sim = totA + totB ? Math.round(200 * same / (totA + totB)) : 100;
  return { blocks, changes, removed, added, sim, unitName: S.mode === 'char' ? 'characters' : 'words', coarse: S.coarse };
}

function makeHunk(pa, pb, la0, lb0, changes) {
  const sa = pa.map(l => l + '\n').join(''), sb = pb.map(l => l + '\n').join('');
  const ta = tokenize(sa), tb = tokenize(sb);
  const ops = diff(ta.map(keyOf), tb.map(keyOf), 2500);

  // 1) raw items: equal text, or a change {del, ins}
  const raw = []; let i = 0, j = 0;
  for (const [op, n] of ops) {
    if (op === 0) { raw.push({ t: 0, a: ta.slice(i, i + n).join(''), b: tb.slice(j, j + n).join('') }); i += n; j += n; }
    else {
      let last = raw[raw.length - 1];
      if (!last || last.t !== 2) { last = { t: 2, del: '', ins: '' }; raw.push(last); }
      if (op < 0) { last.del += ta.slice(i, i + n).join(''); i += n; }
      else { last.ins += tb.slice(j, j + n).join(''); j += n; }
    }
  }
  // 2) merge changes separated only by a space ("quick brown" -> "slow red" becomes one edit)
  const merged = [];
  for (let k = 0; k < raw.length; k++) {
    const it = raw[k], prev = merged[merged.length - 1], nx = raw[k + 1];
    if (it.t === 0 && prev && prev.t === 2 && nx && nx.t === 2 && /^[ \t]+$/.test(it.a) && /^[ \t]+$/.test(it.b)) {
      prev.del += it.a + nx.del; prev.ins += it.b + nx.ins; k++; continue;
    }
    merged.push(it.t === 2 ? { t: 2, del: it.del, ins: it.ins } : it);
  }
  // 3) move shared leading/trailing spaces out of replacements; drop whitespace-only edits if ignoring spaces
  const items = [];
  const pushEq = (a, b) => {
    if (!a && !b) return;
    const l = items[items.length - 1];
    if (l && l.t === 0) { l.a += a; l.b += b; } else items.push({ t: 0, a, b });
  };
  for (const it of merged) {
    if (it.t === 0) { pushEq(it.a, it.b); continue; }
    let { del, ins } = it, pre = ['', ''], post = ['', ''];
    if (del && ins) {
      let p = 0;
      while (p < del.length && p < ins.length && del[p] === ins[p] && /\s/.test(del[p])) p++;
      let q = 0; const dl = del.length, il = ins.length;
      while (q < dl - p && q < il - p && del[dl - 1 - q] === ins[il - 1 - q] && /\s/.test(del[dl - 1 - q])) q++;
      pre = [del.slice(0, p), ins.slice(0, p)];
      post = [del.slice(dl - q), ins.slice(il - q)];
      del = del.slice(p, dl - q); ins = ins.slice(p, il - q);
    }
    pushEq(pre[0], pre[1]);
    // Whitespace-only edits are ignored, except a paragraph break turned into a space (or vice versa)
    const nlFlip = del && ins && del.includes('\n') !== ins.includes('\n');
    if (S.ignoreSpace && !/\S/.test(del + ins) && !nlFlip) pushEq(del, ins);
    else if (del || ins) items.push({ t: 2, del, ins });
    pushEq(post[0], post[1]);
  }
  // 4) number the changes and capture a little context for the list view
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    if (it.t !== 2) continue;
    it.ci = changes.length;
    changes.push({
      del: it.del, ins: it.ins,
      before: items[k - 1] && items[k - 1].t === 0 ? tailCtx(items[k - 1].b) : '',
      after: items[k + 1] && items[k + 1].t === 0 ? headCtx(items[k + 1].b) : ''
    });
  }
  return { eq: false, items, la: la0, na: pa.length, lb: lb0, nb: pb.length, has: items.some(t => t.t === 2) };
}
function tailCtx(s) {
  s = s.replace(/\s+/g, ' ');
  if (s.length <= 50) return s;
  s = s.slice(-50); const sp = s.indexOf(' ');
  return '\u2026' + (sp >= 0 ? s.slice(sp) : s);
}
function headCtx(s) {
  s = s.replace(/\s+/g, ' ');
  if (s.length <= 50) return s;
  s = s.slice(0, 50); const sp = s.lastIndexOf(' ');
  return (sp > 0 ? s.slice(0, sp) : s) + '\u2026';
}
function labelOf(c) {
  const all = c.del + c.ins;
  if (!/\S/.test(all)) return /\n/.test(all) ? { t: 'Line break', cls: 'fmt' } : { t: 'Spacing', cls: 'fmt' };
  if (!HAS_WORD.test(all)) return { t: 'Punctuation', cls: 'fmt' };
  if (c.del && c.ins && c.del.toLowerCase() === c.ins.toLowerCase()) return { t: 'Capitalization', cls: 'fmt' };
  if (c.del && c.ins) return { t: 'Replaced', cls: 'rep' };
  return c.del ? { t: 'Removed', cls: 'del' } : { t: 'Added', cls: 'ins' };
}

/* ---------------- Rendering ---------------- */
const wsMarks = (s, keepBreak) => s.replace(/[^\n]/g, c => c === '\t' ? '\u2192' : '\u00B7').replace(/\n/g, keepBreak ? '\u00B6\n' : '\u00B6');
const breakMarks = s => esc(s).replace(/\n/g, '<span class="pil">\u00B6</span>');
const isWs = s => !/\S/.test(s);
// Wrap text in <del>/<ins> but keep leading/trailing line breaks outside the highlight
const wrapNl = (tag, s) => { const m = /^(\n*)([\s\S]*?)(\n*)$/.exec(s); return `${m[1]}<${tag}>${esc(m[2])}</${tag}>${m[3]}`; };

function inlineItems(items) {
  let h = '', atStart = true;
  const L = items.length - 1;
  items.forEach((it, idx) => {
    if (it.t === 0) {
      let s = it.b;
      if (idx === L) s = s.replace(/\n$/, '');
      h += esc(s);
      if (s) atStart = s.endsWith('\n');
      return;
    }
    let inner = '', brk = false;
    if (it.del) {
      if (isWs(it.del)) { inner += `<del class="ws" title="Removed spacing or line break">${wsMarks(it.del, atStart)}</del>`; brk = atStart && it.del.includes('\n'); }
      else if (atStart && it.del.endsWith('\n')) { inner += `<del>${breakMarks(it.del.slice(0, -1))}</del>\n`; brk = true; }
      else inner += `<del>${breakMarks(it.del)}</del>`;
    }
    if (it.ins) {
      inner += isWs(it.ins) ? `<ins class="ws" title="Added spacing or line break">${wsMarks(it.ins, true)}</ins>` : wrapNl('ins', it.ins);
      brk = it.ins.endsWith('\n');
    }
    h += `<span class="chg" data-i="${it.ci}">${inner}</span>`;
    atStart = brk;
  });
  return h;
}
function sideItems(items, left) {
  let h = '';
  const L = items.length - 1;
  items.forEach((it, idx) => {
    if (it.t === 0) {
      let s = left ? it.a : it.b;
      if (idx === L) s = s.replace(/\n$/, '');
      h += esc(s);
      return;
    }
    const txt = left ? it.del : it.ins, tag = left ? 'del' : 'ins';
    let inner;
    if (!txt) inner = `<span class="caret" title="${left ? 'Text was added here' : 'Text was removed here'}"></span>`;
    else if (isWs(txt)) inner = `<${tag} class="ws">${wsMarks(txt, true)}</${tag}>`;
    else inner = wrapNl(tag, idx === L ? txt.replace(/\n$/, '') : txt);
    h += `<span class="chg" data-i="${it.ci}">${inner}</span>`;
  });
  return h;
}

const same = b => b.eq || !b.has;
const nonEmpty = b => b.eq ? /\S/.test(b.a + b.b) : b.items.some(it => /\S/.test((it.a || '') + (it.b || '')));
function withFolds(blocks, rb) {
  if (!S.hideSame) return blocks.map(rb).join('');
  let h = '', i = 0; const N = blocks.length;
  while (i < N) {
    if (!same(blocks[i])) { h += rb(blocks[i++]); continue; }
    let j = i; while (j < N && same(blocks[j])) j++;
    let s = i, e = j;
    if (i > 0) { while (s < j && !nonEmpty(blocks[s])) s++; if (s < j) s++; }
    if (j < N) { while (e > s && !nonEmpty(blocks[e - 1])) e--; if (e > s) e--; }
    const hidden = blocks.slice(s, Math.max(s, e));
    const cnt = hidden.filter(nonEmpty).length;
    if (!cnt) { for (let k = i; k < j; k++) h += rb(blocks[k]); }
    else {
      for (let k = i; k < s; k++) h += rb(blocks[k]);
      const lbl = `${cnt} unchanged paragraph${cnt === 1 ? '' : 's'}`;
      h += `<div class="fold"><button type="button" class="foldbtn" data-lbl="${lbl}">Show ${lbl}</button><div class="hid" hidden>${hidden.map(rb).join('')}</div></div>`;
      for (let k = e; k < j; k++) h += rb(blocks[k]);
    }
    i = j;
  }
  return h;
}

function inlineBlock(b) {
  if (b.eq) return `<div class="blk">${esc(b.b)}</div>`;
  return `<div class="blk${b.has ? ' d' : ''}">${inlineItems(b.items)}</div>`;
}
function sideBlock(b) {
  if (b.eq) return `<div class="srow"><div class="cell"><span class="ln">${b.la + 1}</span><div class="tx">${esc(b.a)}</div></div><div class="cell"><span class="ln">${b.lb + 1}</span><div class="tx">${esc(b.b)}</div></div></div>`;
  return `<div class="srow${b.has ? ' d' : ''}">` +
    `<div class="cell${b.na ? '' : ' void'}"><span class="ln">${b.na ? b.la + 1 : ''}</span><div class="tx">${sideItems(b.items, true)}</div></div>` +
    `<div class="cell${b.nb ? '' : ' void'}"><span class="ln">${b.nb ? b.lb + 1 : ''}</span><div class="tx">${sideItems(b.items, false)}</div></div></div>`;
}
function listView(r) {
  if (!r.changes.length) return '';
  const rows = r.changes.map((c, i) => {
    const L = labelOf(c);
    const trimNl = s => s.replace(/\n+$/, '');
    const del = c.del ? (isWs(c.del) ? `<del class="ws">${wsMarks(c.del, false)}</del>` : `<del>${breakMarks(trimNl(c.del))}</del>`) : '';
    const ins = c.ins ? (isWs(c.ins) ? `<ins class="ws">${wsMarks(c.ins, false)}</ins>` : `<ins>${breakMarks(trimNl(c.ins))}</ins>`) : '';
    return `<li class="item" data-i="${i}"><button type="button"><span class="num">${i + 1}</span><span class="badge ${L.cls}">${L.t}</span>` +
      `<span class="ctx"><span class="fade">${esc(c.before)}</span>${del}${ins}<span class="fade">${esc(c.after)}</span></span></button></li>`;
  }).join('');
  return `<div class="listhead"><span>Click any change to see it in context.</span><span class="grow"></span><button type="button" class="btn" id="copySum">Copy summary</button></div><ol class="list">${rows}</ol>`;
}

function statsHtml(r) {
  const f = n => n.toLocaleString();
  return `<span class="chip del" title="${r.unitName} removed">\u2212${f(r.removed)} ${r.unitName}</span>` +
    `<span class="chip ins" title="${r.unitName} added">+${f(r.added)} ${r.unitName}</span>` +
    `<span class="chip" title="Share of the text left unchanged">${r.sim}% unchanged</span>`;
}

function ignoredNote() {
  const bits = [];
  if (S.ignoreCase) bits.push('capitalization');
  if (S.ignoreSpace) bits.push('extra spaces and blank lines');
  if (S.quotes) bits.push('curly vs. straight quotes');
  return bits.length ? ` (ignoring ${bits.join(', ')})` : '';
}

function render() {
  const r = S.res;
  const tb = $('#toolbar');
  if (!r) return;
  tb.hidden = false;
  $('#stats').innerHTML = statsHtml(r);
  $$('#viewSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === S.view)));
  let h = '';
  if (!r.changes.length) h += `<div class="notice ok"><strong>No differences found.</strong> The two texts match${ignoredNote()}.</div>`;
  if (r.coarse) h += `<div class="notice">These texts are very different, so some sections are shown as fully replaced rather than word by word.</div>`;
  if (S.view === 'inline') {
    if (r.changes.length) h += `<div class="legend"><span><del>removed text</del></span><span><ins>added text</ins></span><span class="hint">Click a change to select it. Press <kbd>N</kbd> / <kbd>P</kbd> to jump between changes.</span></div>`;
    h += `<div class="doc inline">${withFolds(r.blocks, inlineBlock)}</div>`;
  } else if (S.view === 'side') {
    h += `<div class="side"><div class="srow head"><div><span class="dot a"></span>Original</div><div><span class="dot b"></span>Revised</div></div>${withFolds(r.blocks, sideBlock)}</div>`;
  } else {
    h += listView(r);
  }
  out.innerHTML = h;
  setTbh();
  if (S.cur >= r.changes.length) S.cur = -1;
  if (S.cur >= 0) mark(S.cur); else updateCounter();
}

function renderEmpty(which) {
  $('#toolbar').hidden = true;
  S.res = null; S.cur = -1;
  if (which) {
    out.innerHTML = `<div class="empty"><h2>Almost there</h2><p>Add the ${which} text to see the differences.</p></div>`;
  } else {
    out.innerHTML = `<div class="empty"><h2>Paste two versions to compare</h2><p>Differences appear here automatically as you type. Removed text is <del>red</del>, added text is <ins>green</ins>.</p><button type="button" class="btn" id="loadEx">Try an example</button></div>`;
  }
}

/* ---------------- Navigation ---------------- */
function updateCounter() {
  const n = S.res ? S.res.changes.length : 0;
  $('#counter').textContent = !n ? 'No changes' : S.cur < 0 ? `${n} change${n === 1 ? '' : 's'}` : `${S.cur + 1} of ${n}`;
  $('#prev').disabled = $('#next').disabled = !n;
}
function openFold(hid) {
  hid.hidden = false;
  const btn = hid.previousElementSibling;
  if (btn) btn.textContent = 'Hide ' + btn.dataset.lbl;
}
function mark(i, scroll, flash) {
  $$('.chg.cur, .item.cur', out).forEach(e => e.classList.remove('cur'));
  const els = $$(`.chg[data-i="${i}"], .item[data-i="${i}"]`, out);
  els.forEach(e => {
    const hid = e.closest('.hid'); if (hid && hid.hidden) openFold(hid);
    e.classList.add('cur');
    if (flash) { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); }
  });
  if (scroll && els[0]) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    els[0].scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }
  updateCounter();
}
function go(i) {
  const n = S.res ? S.res.changes.length : 0;
  if (!n) return;
  S.cur = ((i % n) + n) % n;
  mark(S.cur, true, true);
}

/* ---------------- Running a comparison ---------------- */
let timer = 0;
function counts() {
  for (const [ta, el] of [[taA, $('#countA')], [taB, $('#countB')]]) {
    const v = ta.value, w = countWords(v);
    el.textContent = v ? `${w.toLocaleString()} word${w === 1 ? '' : 's'} \u00B7 ${v.length.toLocaleString()} characters` : 'Empty';
  }
}
function run(scroll) {
  clearTimeout(timer);
  counts();
  const a = taA.value, b = taB.value;
  const ha = /\S/.test(a), hb = /\S/.test(b);
  if (!ha && !hb) return renderEmpty();
  if (!ha || !hb) return renderEmpty(!ha ? 'original' : 'revised');
  S.res = compareTexts(a, b);
  S.cur = -1;
  render();
  if (scroll) $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function schedule() {
  clearTimeout(timer);
  counts();
  const big = taA.value.length + taB.value.length > 150000;
  timer = setTimeout(() => run(false), big ? 700 : 250);
}
const setTbh = () => document.documentElement.style.setProperty('--tbh', ($('#toolbar').offsetHeight || 0) + 'px');

/* ---------------- Files (.txt, .md, .docx) ---------------- */
let openTarget = taA;
async function loadFile(file, ta) {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith('.docx')) {
      ta.value = await readDocx(file);
      toast(`Loaded "${file.name}". Tracked changes in Word are read as accepted.`);
    } else if (/\.(doc|pdf|pages|odt|rtf)$/.test(name)) {
      toast(`Can't read this file type directly. Open it, select all, copy, and paste here.`);
      return;
    } else {
      if (file.size > 25e6) { toast('That file is too large.'); return; }
      ta.value = await file.text();
      toast(`Loaded "${file.name}".`);
    }
    run(false);
  } catch (err) {
    toast(err && err.message ? err.message : 'Could not read that file.');
  }
}
async function readDocx(file) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open .docx files. Copy and paste the text instead.');
  const buf = await file.arrayBuffer(), dv = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('That does not look like a valid .docx file.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const loff = dv.getUint32(p + 42, true);
    const fname = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    if (fname === 'word/document.xml') {
      const start = loff + 30 + dv.getUint16(loff + 26, true) + dv.getUint16(loff + 28, true);
      const data = u8.subarray(start, start + csize);
      let bytes;
      if (method === 0) bytes = data;
      else if (method === 8) {
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      } else throw new Error('Unsupported .docx compression.');
      return docxToText(dec.decode(bytes));
    }
    p += 46 + nlen + elen + clen;
  }
  throw new Error('Could not find the document text inside that file.');
}
function docxToText(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = doc.getElementsByTagNameNS('*', 'body')[0] || doc.documentElement;
  const paras = [];
  const SKIP = new Set(['delText', 'instrText', 'Fallback', 'sectPr', 'pPr', 'rPr']);
  const walk = (node, acc) => {
    for (const c of node.childNodes) {
      if (c.nodeType !== 1) continue;
      const ln = c.localName;
      if (SKIP.has(ln)) continue;
      if (ln === 't') acc.push(c.textContent);
      else if (ln === 'tab') acc.push('\t');
      else if (ln === 'br' || ln === 'cr') acc.push('\n');
      else if (ln === 'noBreakHyphen') acc.push('-');
      else if (ln === 'p') { const sub = []; walk(c, sub); paras.push(sub.join('')); }
      else walk(c, acc);
    }
  };
  const top = node => {
    for (const c of node.childNodes) {
      if (c.nodeType !== 1 || SKIP.has(c.localName)) continue;
      if (c.localName === 'p') { const acc = []; walk(c, acc); paras.push(acc.join('')); }
      else top(c);
    }
  };
  top(body);
  return paras.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------------- Misc UI ---------------- */
let toastT = 0;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3800);
}
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return true; }
  catch {
    const ta = document.createElement('textarea'); ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    ta.remove(); return ok;
  }
}
function summaryText() {
  const r = S.res;
  const clip = s => { s = s.replace(/\s+/g, ' ').trim(); return s.length > 160 ? s.slice(0, 157) + '...' : s; };
  const lines = [`${r.changes.length} change${r.changes.length === 1 ? '' : 's'} (${r.removed} ${r.unitName} removed, ${r.added} added)`, ''];
  r.changes.forEach((c, i) => {
    const L = labelOf(c).t, d = clip(c.del), n = clip(c.ins);
    let s;
    if (L === 'Replaced' || L === 'Capitalization') s = `${L === 'Replaced' ? 'Replaced' : 'Capitalization'}: "${d}" \u2192 "${n}"`;
    else if (L === 'Removed') s = `Removed: "${d}"`;
    else if (L === 'Added') s = `Added: "${n}"`;
    else s = `${L}: "${d}" \u2192 "${n}"`;
    lines.push(`${i + 1}. ${s}`);
  });
  return lines.join('\n');
}

const EXAMPLE_A = `The committee met on Tuesday to review the proposal. After a lengthy discussion, the members agreed that the budget was too high and asked the team to recieve new quotes from vendors.

Several members raised concerns about the timeline. The project lead said the schedule was "aggressive but achievable."

We will reconvene next month to make a final decision.`;
const EXAMPLE_B = `The committee met on Wednesday to review the revised proposal. After a brief discussion, members agreed that the budget was still too high and asked the team to get new quotes from at least three vendors.

Several members raised concerns about the timeline. The project lead said the schedule was \u201Caggressive but achievable.\u201D

The chair noted that timing is critical.

We will reconvene in two weeks to make a final decision.`;

/* ---------------- Wiring ---------------- */
taA.addEventListener('input', schedule);
taB.addEventListener('input', schedule);

$('#compareBtn').addEventListener('click', () => run(true));
$('#swap').addEventListener('click', () => { const t = taA.value; taA.value = taB.value; taB.value = t; run(false); });
$$('[data-clear]').forEach(b => b.addEventListener('click', () => { const ta = b.dataset.clear === 'A' ? taA : taB; ta.value = ''; ta.focus(); run(false); }));
$$('[data-open]').forEach(b => b.addEventListener('click', () => { openTarget = b.dataset.open === 'A' ? taA : taB; $('#fileInput').value = ''; $('#fileInput').click(); }));
$('#fileInput').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) loadFile(f, openTarget); });

for (const [pane, ta] of [[$('#paneA'), taA], [$('#paneB'), taB]]) {
  pane.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); pane.classList.add('drag'); } });
  pane.addEventListener('dragleave', e => { if (!pane.contains(e.relatedTarget)) pane.classList.remove('drag'); });
  pane.addEventListener('drop', e => {
    pane.classList.remove('drag');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) { e.preventDefault(); loadFile(f, ta); }
  });
}
// Stop a file dropped outside the boxes from navigating away (and losing your text).
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());

$('#modeSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.mode = b.dataset.mode;
  $$('#modeSeg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  run(false);
});
$('#optCase').addEventListener('change', e => { S.ignoreCase = e.target.checked; run(false); });
$('#optSpace').addEventListener('change', e => { S.ignoreSpace = e.target.checked; run(false); });
$('#optQuotes').addEventListener('change', e => { S.quotes = e.target.checked; run(false); });
$('#hideSame').addEventListener('change', e => { S.hideSame = e.target.checked; render(); });

$('#viewSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !S.res) return;
  S.view = b.dataset.view; render();
  if (S.cur >= 0) mark(S.cur, true);
});
$('#prev').addEventListener('click', () => go(S.cur < 0 ? -1 : S.cur - 1));
$('#next').addEventListener('click', () => go(S.cur + 1));
$('#toggleInputs').addEventListener('click', e => {
  const inp = $('#inputs'); inp.hidden = !inp.hidden;
  e.currentTarget.textContent = inp.hidden ? 'Show text boxes' : 'Hide text boxes';
});
$('#printBtn').addEventListener('click', () => window.print());

out.addEventListener('click', async e => {
  if (e.target.closest('#loadEx')) { taA.value = EXAMPLE_A; taB.value = EXAMPLE_B; run(false); return; }
  if (e.target.closest('#copySum')) { toast(await copyText(summaryText()) ? 'Summary copied to clipboard.' : 'Could not copy.'); return; }
  const fb = e.target.closest('.foldbtn');
  if (fb) {
    const hid = fb.nextElementSibling;
    if (hid.hidden) openFold(hid); else { hid.hidden = true; fb.textContent = 'Show ' + fb.dataset.lbl; }
    return;
  }
  const item = e.target.closest('.item');
  if (item) {
    const i = +item.dataset.i;
    S.view = 'inline'; render(); S.cur = i; mark(i, true, true);
    return;
  }
  const chg = e.target.closest('.chg');
  if (chg) { S.cur = +chg.dataset.i; mark(S.cur, false, true); }
});

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(true); return; }
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'textarea' || tag === 'input' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'n' || e.key === 'j') { e.preventDefault(); go(S.cur + 1); }
  else if (e.key === 'p' || e.key === 'k') { e.preventDefault(); go(S.cur < 0 ? -1 : S.cur - 1); }
});
window.addEventListener('resize', setTbh);

// Debug hook for automated checks (harmless in normal use)
window.__textCompare = { compareTexts, S };

run(false);
})();
