'use strict';

/* ============================================================
   Pure logic (no DOM). Exported for `node --test` at the bottom.
   ============================================================ */

var STORE_KEY = 'snackbox-queue-wait';
var EXPIRE_MS = 12 * 60 * 60 * 1000;
var SHIFT_MIN_MS = 10000;
var MAX_STUBS = 12;

function usable(observations) {
  return observations.filter(function (o) { return !o.void; });
}

/* Linear regression of timestamp against number, extrapolated to your number. */
function estimate(observations, yourNumber, now) {
  var obs = usable(observations);
  if (yourNumber == null || obs.length === 0) return { state: 'setup' };

  var latest = Math.max.apply(null, obs.map(function (o) { return o.number; }));
  if (latest >= yourNumber) return { state: 'called', latest: latest };

  var ahead = yourNumber - latest - 1;
  var n = obs.length;
  var mx = 0, my = 0;
  obs.forEach(function (o) { mx += o.number; my += o.timestamp; });
  mx /= n; my /= n;
  var sxx = 0, sxy = 0;
  obs.forEach(function (o) {
    var dx = o.number - mx;
    sxx += dx * dx;
    sxy += dx * (o.timestamp - my);
  });
  if (n < 2 || sxx === 0) return { state: 'need-more', latest: latest, ahead: ahead };

  var slope = sxy / sxx;
  if (slope <= 0) return { state: 'off', latest: latest, ahead: ahead };

  var callAt = my + slope * (yourNumber - mx);
  return {
    state: 'waiting',
    latest: latest,
    ahead: ahead,
    callAt: callAt,
    waitMs: Math.max(0, callAt - now),
    overdue: callAt < now,
    minPerNum: slope / 60000
  };
}

function stageOf(est) {
  if (est.state === 'called') return 'turn';
  if (est.state === 'setup') return '';
  if (est.ahead === 0) return 'next';
  if (est.ahead <= 2) return 'ready';
  return '';
}

function stageEvents(prev, next) {
  if (next === 'turn' && prev !== 'turn') return ['turn'];
  if ((next === 'ready' || next === 'next') && prev === '') return ['ready'];
  return [];
}

function estimateShift(prevCallAt, nextCallAt) {
  if (prevCallAt == null || nextCallAt == null) return null;
  var delta = nextCallAt - prevCallAt;
  return Math.abs(delta) < SHIFT_MIN_MS ? null : delta;
}

function pad2(x) { return String(x).padStart(2, '0'); }

function formatClock(ms) {
  var s = Math.max(0, Math.round(ms / 1000));
  var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? h + ':' + pad2(m) + ':' + pad2(sec) : m + ':' + pad2(sec);
}

function formatTime(ts) {
  var d = new Date(ts);
  var h = d.getHours();
  return (h % 12 || 12) + ':' + pad2(d.getMinutes()) + ' ' + (h >= 12 ? 'PM' : 'AM');
}

function formatShift(ms) {
  return ms > 0 ? '+' + formatClock(ms) + ' later' : '−' + formatClock(-ms) + ' sooner';
}

function formatGap(ms) {
  return '+' + (ms / 60000).toFixed(1) + 'm';
}

function stubNumbers(latest, yourNumber) {
  var shown = [];
  if (latest == null || yourNumber == null) return { shown: shown, extra: 0 };
  for (var k = latest + 1; k < yourNumber && shown.length < MAX_STUBS; k++) shown.push(k);
  return { shown: shown, extra: Math.max(0, yourNumber - latest - 1 - shown.length) };
}

function logRows(observations) {
  var rows = observations
    .map(function (o, index) {
      return { index: index, number: o.number, timestamp: o.timestamp, void: !!o.void, gapMs: null };
    })
    .sort(function (a, b) { return b.timestamp - a.timestamp; });
  rows.forEach(function (row, i) {
    if (row.void) return;
    for (var j = i + 1; j < rows.length; j++) {
      if (!rows[j].void) { row.gapMs = row.timestamp - rows[j].timestamp; return; }
    }
  });
  return rows;
}

/* ---------- state (never mutated; every change returns a new object) ---------- */

function newState(now) {
  return { yourNumber: null, observations: [], updatedAt: now };
}

function parseNumber(text) {
  var t = String(text).trim();
  if (!/^\d+$/.test(t)) return null;
  var n = parseInt(t, 10);
  return n >= 1 && n <= 9999 ? n : null;
}

/* Typed text wins; an empty field means "use the suggested number" shown as the placeholder.
   (Pre-filling the value let phone users append to it: 37 + "41" = 3741.) */
function resolveEntry(text, suggestion) {
  return parseNumber(String(text).trim() !== '' ? text : suggestion);
}

function latestNumber(state) {
  var obs = usable(state.observations);
  return obs.length ? Math.max.apply(null, obs.map(function (o) { return o.number; })) : null;
}

function withChanges(state, changes, now) {
  return Object.assign({}, state, changes, { updatedAt: now });
}

function setYourNumber(state, n, now) {
  return withChanges(state, { yourNumber: n }, now);
}

function addObservation(state, number, now) {
  var latest = latestNumber(state);
  if (latest !== null && number <= latest) return null;
  return withChanges(state, {
    observations: state.observations.concat([{ number: number, timestamp: now }])
  }, now);
}

function undoLast(state, now) {
  if (state.observations.length <= 1) return null;
  return withChanges(state, { observations: state.observations.slice(0, -1) }, now);
}

function toggleVoid(state, index, now) {
  return withChanges(state, {
    observations: state.observations.map(function (o, i) {
      return i === index ? Object.assign({}, o, { void: !o.void }) : o;
    })
  }, now);
}

function restore(raw, now) {
  var s;
  try { s = JSON.parse(raw); } catch (e) { return null; }
  if (!s || typeof s !== 'object' || !Array.isArray(s.observations) || !isFinite(s.updatedAt)) return null;
  if (typeof s.updatedAt !== 'number' || now - s.updatedAt > EXPIRE_MS) return null;
  var observations = s.observations
    .filter(function (o) {
      return o && Number.isInteger(o.number) && typeof o.timestamp === 'number' && isFinite(o.timestamp);
    })
    .map(function (o) {
      var clean = { number: o.number, timestamp: o.timestamp };
      if ('void' in o) clean.void = o.void === true;
      return clean;
    });
  return {
    yourNumber: Number.isInteger(s.yourNumber) ? s.yourNumber : null,
    observations: observations,
    updatedAt: s.updatedAt
  };
}

/* ============================================================
   Browser: rendering and wiring. Nothing below runs in Node.
   ============================================================ */

var state = null;
var prevStage = '';
var flaps = [];
var stubEls = new Map();
var moreEl = null;
var sheetHandler = null;
var resetTimer = null;
var REDUCED = false;
var boardShown = null;
var boardTarget = null;
var boardTimer = null;
var stampText = '';
var shiftTimer = null;
var STAMPS = { ready: 'GET READY', next: "YOU'RE NEXT", turn: 'YOUR TURN!' };

function $(id) { return document.getElementById(id); }

function setText(id, text) {
  var el = $(id);
  if (el.textContent !== text) el.textContent = text;
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}

function init() {
  REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch (e) { /* storage unavailable */ }
  state = restore(raw, Date.now()) || newState(Date.now());
  prevStage = stageOf(estimate(state.observations, state.yourNumber, Date.now()));
  wire();
  render({ type: 'init' });
  setInterval(tick, 250);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  runSetup();
}

function isEdit(change) {
  return change.type === 'add' || change.type === 'undo' || change.type === 'void';
}

function callAtOf(e) { return e.state === 'waiting' ? e.callAt : null; }

function commit(next, change) {
  var t = Date.now();
  var before = estimate(state.observations, state.yourNumber, t);
  state = next;
  save();
  render(change);
  if (isEdit(change)) {
    var shift = estimateShift(callAtOf(before), callAtOf(estimate(state.observations, state.yourNumber, t)));
    if (shift !== null) showShift(shift);
  }
}

function render(change) {
  var latest = latestNumber(state);
  var animate = !REDUCED && isEdit(change);
  if (animate && boardShown !== null && latest !== null && flaps.length === digitCount()) {
    boardTo(latest);
  } else {
    stopBoard();
    boardShown = latest;
    paintBoard(latest, false);
  }
  if (animate && change.type === 'add') ding();
  setText('your-num', state.yourNumber == null ? '—' : String(state.yourNumber));
  renderStubs(latest, animate);
  renderLog(change);
  tick();
}

/* ---------- board ---------- */
function Flap(el) {
  this.el = el;
  this.value = null;
  el.className = 'flap';
  el.innerHTML = '<span class="flap__half flap__top"><span></span></span>' +
                 '<span class="flap__half flap__bottom"><span></span></span>';
  this.top = el.firstChild.firstChild;
  this.bottom = el.lastChild.firstChild;
}

function flapHalf(cls, text) {
  var h = document.createElement('span');
  var s = document.createElement('span');
  h.className = 'flap__half ' + cls;
  s.textContent = text;
  h.appendChild(s);
  return h;
}

/* Top half folds down showing the old digit, then the bottom half folds in with the new one. */
Flap.prototype.set = function (v, animate) {
  if (v === this.value) return;
  var self = this, old = this.value;
  this.value = v;
  this.top.textContent = v;
  if (!animate || old === null) {
    this.bottom.textContent = v;
    this.el.querySelectorAll('.fold-top, .fold-bottom').forEach(function (n) { n.remove(); });
    return;
  }
  var ft = flapHalf('flap__top fold-top', old);
  var fb = flapHalf('flap__bottom fold-bottom', v);
  this.el.appendChild(ft);
  this.el.appendChild(fb);
  setTimeout(function () {
    if (self.value === v) self.bottom.textContent = v;
    ft.remove();
    fb.remove();
  }, 270);
};

/* Step through small changes one number at a time; flip straight to big jumps. */
function boardTo(n) {
  boardTarget = n;
  if (!boardTimer) stepBoard();
}

function stepBoard() {
  boardTimer = null;
  if (boardShown === boardTarget) return;
  var diff = boardTarget - boardShown;
  boardShown = Math.abs(diff) <= 5 ? boardShown + Math.sign(diff) : boardTarget;
  paintBoard(boardShown, true);
  boardTimer = setTimeout(stepBoard, 300);
}

function stopBoard() {
  clearTimeout(boardTimer);
  boardTimer = null;
  boardTarget = null;
}

function ding() {
  var b = $('board');
  b.classList.remove('ding');
  void b.offsetWidth;
  b.classList.add('ding');
}

function digitCount() {
  var latest = latestNumber(state);
  return Math.max(2, String(Math.max(state.yourNumber || 0, latest || 0)).length);
}

function paintBoard(n, animate) {
  var count = digitCount();
  if (flaps.length !== count) {
    var box = $('flaps');
    box.innerHTML = '';
    flaps = [];
    for (var i = 0; i < count; i++) {
      var d = document.createElement('span');
      box.appendChild(d);
      flaps.push(new Flap(d));
    }
  }
  var text = n == null ? '-'.repeat(count) : String(n).padStart(count, ' ');
  flaps.forEach(function (f, i) { f.set(text[i], animate); });
  $('board').setAttribute('aria-label', 'Now serving ' + (n == null ? 'unknown' : n) + '. Tap to type a number.');
}

/* ---------- stubs ---------- */
/* A served stub is cloned in place and falls away while the real one is removed. */
function tearOff(el) {
  var r = el.getBoundingClientRect();
  var c = el.cloneNode(true);
  c.classList.remove('pop');
  c.classList.add('tear');
  c.style.cssText = 'position:fixed;margin:0;z-index:30;left:' + r.left + 'px;top:' + r.top + 'px;';
  document.body.appendChild(c);
  setTimeout(function () { c.remove(); }, 1000);
}

function renderStubs(latest, animate) {
  var box = $('stubs');
  var s = stubNumbers(latest, state.yourNumber);
  var first = new Map();
  if (animate) stubEls.forEach(function (el, k) { first.set(k, el.getBoundingClientRect()); });
  stubEls.forEach(function (el, k) {
    if (s.shown.indexOf(k) === -1) {
      if (animate && latest !== null && k <= latest) tearOff(el);
      el.remove();
      stubEls.delete(k);
    }
  });
  s.shown.forEach(function (k) {
    var el = stubEls.get(k);
    if (!el) {
      el = document.createElement('span');
      el.className = 'stub';
      el.textContent = k;
      if (animate) {
        el.classList.add('pop');
        el.addEventListener('animationend', function () { el.classList.remove('pop'); }, { once: true });
      }
      stubEls.set(k, el);
    }
    box.appendChild(el);
  });
  if (animate) {
    /* FLIP: slide the remaining stubs from where they were */
    stubEls.forEach(function (el, k) {
      var f = first.get(k);
      if (!f) return;
      var l = el.getBoundingClientRect(), dx = f.left - l.left, dy = f.top - l.top;
      if (dx || dy) {
        el.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
          { duration: 420, delay: 120, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      }
    });
  }
  if (s.extra > 0) {
    if (!moreEl) { moreEl = document.createElement('span'); moreEl.className = 'stub more'; }
    moreEl.textContent = '+' + s.extra;
    box.appendChild(moreEl);
  } else if (moreEl) {
    moreEl.remove();
    moreEl = null;
  }
}

/* ---------- receipt ---------- */
function renderLog(change) {
  var ol = $('log');
  var newest = !REDUCED && change.type === 'add' ? state.observations.length - 1 : -1;
  ol.innerHTML = '';
  logRows(state.observations).forEach(function (r) {
    var li = document.createElement('li');
    if (r.index === newest) li.className = 'print';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'row' + (r.void ? ' void' : '');
    b.dataset.index = r.index;
    b.title = r.void ? 'Tap to restore' : 'Tap to void';
    b.innerHTML = '<span></span><span></span><span></span>';
    b.children[0].textContent = formatTime(r.timestamp);
    b.children[1].textContent = '#' + r.number;
    b.children[2].textContent = r.gapMs == null ? '' : formatGap(r.gapMs);
    li.appendChild(b);
    ol.appendChild(li);
  });
}

/* ---------- live status (runs every 250 ms) ---------- */
function tick() {
  var now = Date.now();
  var e = estimate(state.observations, state.yourNumber, now);
  var label = 'Called in', cd = '--:--', sub = '', cap = '', foot = '';

  if (e.state === 'setup') {
    sub = state.yourNumber == null ? 'tap the ticket to enter your number' : 'tap the board to enter now serving';
  } else if (e.state === 'need-more') {
    sub = 'log 1 more number';
  } else if (e.state === 'off') {
    sub = 'numbers should go up — check the log';
  } else if (e.state === 'waiting') {
    cd = e.overdue ? 'any sec' : formatClock(e.waitMs);
    sub = '≈ ' + formatTime(e.callAt);
    foot = 'AVG ' + e.minPerNum.toFixed(1) + ' MIN / NUMBER';
  } else if (e.state === 'called') {
    label = 'Status';
    cd = 'NOW';
    sub = 'head to the counter';
  }

  if (e.state === 'called') cap = 'Nobody ahead of you';
  else if (e.state === 'setup') cap = '';
  else if (e.ahead === 0) cap = "You're next!";
  else if (e.state === 'waiting') cap = e.ahead + ' ahead of you · ~' + e.minPerNum.toFixed(1) + ' min each';
  else cap = e.ahead + ' ahead of you';

  setText('countdown-label', label);
  setText('countdown', cd);
  setText('call-time', sub || ' ');
  setText('stubs-caption', cap || ' ');
  setText('log-foot', foot);

  $('next-btn').disabled = latestNumber(state) === null || e.state === 'called';
  $('undo-btn').disabled = undoLast(state, now) === null;

  var stage = stageOf(e);
  if (stage === 'turn') $('shift').classList.remove('show');
  setStamp(STAMPS[stage] || '');
  $('ticket').classList.toggle('close', stage === 'ready' || stage === 'next');
  stageEvents(prevStage, stage).forEach(onStageEvent);
  prevStage = stage;
}

function setStamp(text) {
  if (text === stampText) return;
  stampText = text;
  var el = $('stamp');
  el.classList.remove('on');
  el.textContent = text;
  if (!text) return;
  void el.offsetWidth;
  el.classList.add('on');
}

function onStageEvent(name) {
  if (name === 'ready') buzz([60]);
  if (name === 'turn') {
    buzz([200, 100, 200]);
    if (!REDUCED) {
      var r = $('ticket').getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + 20);
    }
  }
}

function showShift(ms) {
  var el = $('shift');
  el.textContent = formatShift(ms);
  el.className = 'shift show ' + (ms > 0 ? 'later' : 'sooner');
  clearTimeout(shiftTimer);
  shiftTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
}

function buzz(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* unsupported */ }
}

function confetti(x, y) {
  var colors = ['#e5372a', '#fbf6e9', '#2563eb', '#f59e0b'];
  for (var i = 0; i < 60; i++) {
    var p = document.createElement('i');
    p.className = 'confetti';
    p.style.background = colors[i % colors.length];
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    document.body.appendChild(p);
    var ang = Math.random() * Math.PI * 2, v = 90 + Math.random() * 200;
    var dx = Math.cos(ang) * v, dy = Math.sin(ang) * v, rot = Math.random() * 720 - 360;
    p.animate([
      { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
      { transform: 'translate(' + dx * 0.8 + 'px,' + dy * 0.8 + 'px) rotate(' + rot / 2 + 'deg)', opacity: 1, offset: 0.35 },
      { transform: 'translate(' + dx + 'px,' + (dy + 280) + 'px) rotate(' + rot + 'deg)', opacity: 0 }
    ], { duration: 1200 + Math.random() * 700, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' })
      .onfinish = removeTarget;
  }
}

function removeTarget() { this.effect.target.remove(); }

/* ---------- number sheet ---------- */
function askNumber(title, suggestion, validate, onSubmit) {
  var sheet = $('sheet');
  var input = $('sheet-input');
  setText('sheet-title', title);
  input.value = '';
  input.placeholder = suggestion === '' || suggestion == null ? '' : String(suggestion);
  setText('sheet-error', '');
  sheetHandler = { validate: validate, onSubmit: onSubmit };
  sheet.hidden = false;
  /* Focus inside the tap itself: iOS only raises the keyboard for a focus made during the gesture. */
  input.focus({ preventScroll: true });
  requestAnimationFrame(function () { sheet.classList.add('open'); });
}

function closeSheet() {
  var sheet = $('sheet');
  sheet.classList.remove('open');
  sheetHandler = null;
  setTimeout(function () { if (!sheet.classList.contains('open')) sheet.hidden = true; }, 220);
}

function submitSheet(ev) {
  ev.preventDefault();
  if (!sheetHandler) return;
  var input = $('sheet-input');
  var n = resolveEntry(input.value, input.placeholder);
  if (n === null) { setText('sheet-error', 'Enter a whole number from 1 to 9999'); return; }
  var msg = sheetHandler.validate(n);
  if (msg) { setText('sheet-error', msg); return; }
  var handler = sheetHandler;
  closeSheet();
  handler.onSubmit(n);
}

function validateServing(n) {
  var latest = latestNumber(state);
  return latest !== null && n <= latest ? 'Must be higher than ' + latest : '';
}

function noCheck() { return ''; }

/* ---------- actions ---------- */
function logNumber(n) {
  var next = addObservation(state, n, Date.now());
  if (next) commit(next, { type: 'add', obs: next.observations[next.observations.length - 1] });
}

function askServing() {
  var latest = latestNumber(state);
  askNumber('Now serving?', latest === null ? '' : latest + 1, validateServing, logNumber);
}

function askYourNumber(then) {
  askNumber('Your number?', state.yourNumber == null ? '' : state.yourNumber, noCheck, function (n) {
    commit(setYourNumber(state, n, Date.now()), { type: 'your' });
    if (then) then();
  });
}

function runSetup() {
  if (state.yourNumber == null) askYourNumber(runSetup);
  else if (state.observations.length === 0) askServing();
}

function wire() {
  $('next-btn').addEventListener('click', function () {
    var latest = latestNumber(state);
    if (latest !== null) logNumber(latest + 1);
  });
  $('jump-btn').addEventListener('click', askServing);
  $('board').addEventListener('click', askServing);
  $('your-num-btn').addEventListener('click', function () { askYourNumber(null); });
  $('undo-btn').addEventListener('click', function () {
    var next = undoLast(state, Date.now());
    if (next) commit(next, { type: 'undo' });
  });
  $('log').addEventListener('click', function (ev) {
    var row = ev.target.closest('.row');
    if (row) commit(toggleVoid(state, Number(row.dataset.index), Date.now()), { type: 'void' });
  });
  $('new-ticket').addEventListener('click', function () {
    var btn = $('new-ticket');
    if (!btn.classList.contains('confirm')) {
      btn.classList.add('confirm');
      btn.textContent = 'Tap again to start over';
      resetTimer = setTimeout(function () { btn.classList.remove('confirm'); btn.textContent = 'New ticket'; }, 3000);
      return;
    }
    clearTimeout(resetTimer);
    btn.classList.remove('confirm');
    btn.textContent = 'New ticket';
    commit(newState(Date.now()), { type: 'reset' });
    runSetup();
  });
  $('sheet-form').addEventListener('submit', submitSheet);
  $('sheet-cancel').addEventListener('click', closeSheet);
  $('sheet').addEventListener('pointerdown', function (ev) { if (ev.target === $('sheet')) closeSheet(); });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !$('sheet').hidden) closeSheet();
  });
}

if (typeof module === 'object' && module.exports) {
  module.exports = {
    newState: newState,
    parseNumber: parseNumber,
    resolveEntry: resolveEntry,
    latestNumber: latestNumber,
    setYourNumber: setYourNumber,
    addObservation: addObservation,
    undoLast: undoLast,
    toggleVoid: toggleVoid,
    restore: restore,
    STORE_KEY: STORE_KEY,
    EXPIRE_MS: EXPIRE_MS,
    SHIFT_MIN_MS: SHIFT_MIN_MS,
    MAX_STUBS: MAX_STUBS,
    estimate: estimate,
    stageOf: stageOf,
    stageEvents: stageEvents,
    estimateShift: estimateShift,
    formatClock: formatClock,
    formatTime: formatTime,
    formatShift: formatShift,
    formatGap: formatGap,
    stubNumbers: stubNumbers,
    logRows: logRows
  };
} else {
  init();
}
