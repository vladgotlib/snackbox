(function () {
  'use strict';

  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DOW_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // 100 years of wall -- comfortably past any birthdate, so the tool's most
  // common count-since query never truncates. The counts stay exact beyond it.
  var MAX_MONTHS = 1200;
  var MAX_LABEL = 80;

  /* === Date core =========================================================
     Everything compares integer calendar-day indices, never Date objects.
     Date.UTC sidesteps DST entirely, so consecutive days are always exactly
     86400000ms apart and equality is safe no matter how a date was built. */

  function dayIndex(d) {
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  function daysBetween(a, b) {
    return dayIndex(b) - dayIndex(a);
  }

  // "YYYY-MM-DD" -> local Date, or null. The roundtrip check rejects 2026-02-30,
  // 2026-13-01, and the two-digit-year trap where new Date(99, ...) is 1999.
  function parseISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  // Accepts "YYYY-MM-DD" and the legacy compact "YYYYMMDD".
  function parseAny(s) {
    s = (s || '').trim();
    if (/^\d{8}$/.test(s)) s = s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
    return parseISO(s);
  }

  // Never toISOString().slice(0,10) -- that is UTC, off by a day west of Greenwich.
  function toISO(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function monthOrdinal(d) {
    return d.getFullYear() * 12 + d.getMonth();
  }

  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  // Calendar breakdown, borrowing from the month preceding b so that
  // Jan 31 -> Feb 28 reads "28 days" rather than "1 month, -3 days".
  function ymd(a, b) {
    var y = b.getFullYear() - a.getFullYear();
    var m = b.getMonth() - a.getMonth();
    var d = b.getDate() - a.getDate();
    if (d < 0) { m--; d += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
    if (m < 0) { m += 12; y--; }
    return { y: y, m: m, d: d };
  }

  function fmtYmd(parts) {
    var out = [];
    if (parts.y) out.push(parts.y + ' yr');
    if (parts.m) out.push(parts.m + ' mo');
    if (parts.d || !out.length) out.push(parts.d + ' d');
    return out.join(' ');
  }

  // Day index 0 is 1970-01-01, a Thursday, hence the +4.
  function countWeekdays(a, b) {
    if (b < a) return 0;
    var total = b - a + 1;
    var fullWeeks = Math.floor(total / 7);
    var count = fullWeeks * 5;
    var rem = total % 7;
    for (var i = 0; i < rem; i++) {
      var dow = (a + fullWeeks * 7 + i + 4) % 7;
      if (dow >= 1 && dow <= 5) count++;
    }
    return count;
  }

  function num(n) {
    return n.toLocaleString('en-US');
  }

  function plural(n, word) {
    return num(n) + ' ' + word + (Math.abs(n) === 1 ? '' : 's');
  }

  function fmtDate(d, forceYear) {
    var s = DOW_SHORT[d.getDay()] + ', ' + MONTH_SHORT[d.getMonth()] + ' ' + d.getDate();
    if (forceYear || d.getFullYear() !== new Date().getFullYear()) s += ', ' + d.getFullYear();
    return s;
  }

  /* === DOM =============================================================== */

  var whatInput = document.getElementById('cd-what');
  var dateInput = document.getElementById('cd-date');
  var endInput = document.getElementById('cd-end');
  var endField = document.getElementById('cd-end-field');
  var dateWord = document.getElementById('cd-date-word');
  var dateHint = document.getElementById('cd-date-hint');
  var endAddBtn = document.getElementById('cd-end-add');
  var endRemoveBtn = document.getElementById('cd-end-remove');
  var copyBtn = document.getElementById('cd-copy');
  var summaryEl = document.getElementById('cd-summary');
  var headlineEl = document.getElementById('cd-headline');
  var subEl = document.getElementById('cd-sub');
  var statsEl = document.getElementById('cd-stats');
  var messageEl = document.getElementById('cd-message');
  var emptyEl = document.getElementById('cd-empty');
  var legendEl = document.getElementById('cd-legend');
  var wallEl = document.getElementById('cd-wall');

  var state = { what: '', date: null, end: null };
  var lastTodayN = dayIndex(new Date());
  var notes = [];
  var paramNote = '';   // survives re-renders until the user edits a date

  /* === Model ============================================================= */

  function buildModel() {
    if (!state.date) return null;

    var todayN = dayIndex(new Date());
    var anchors = {};
    var model = { todayN: todayN, anchors: anchors };

    if (state.end) {
      var a = state.date, b = state.end;
      // Swap for computation only -- never write back, that would fight the cursor.
      if (dayIndex(b) < dayIndex(a)) {
        var t = a; a = b; b = t;
        model.swapped = true;
      }
      model.mode = 'span';
      model.startDate = a;
      model.endDate = b;
      anchors[dayIndex(a)] = 'start date';
      anchors[dayIndex(b)] = 'end date';
      if (dayIndex(a) === dayIndex(b)) anchors[dayIndex(a)] = 'the date';
    } else {
      var dN = dayIndex(state.date);
      if (dN === todayN) model.mode = 'today';
      else if (dN > todayN) model.mode = 'countdown';
      else model.mode = 'since';

      if (model.mode === 'countdown') {
        model.startDate = new Date();
        model.endDate = state.date;
        anchors[dN] = 'target date';
      } else if (model.mode === 'since') {
        model.startDate = state.date;
        model.endDate = new Date();
        anchors[dN] = 'start date';
      } else {
        model.startDate = state.date;
        model.endDate = state.date;
        anchors[dN] = 'the date';
      }
    }

    model.startN = dayIndex(model.startDate);
    model.endN = dayIndex(model.endDate);
    model.diff = model.endN - model.startN;      // headline arithmetic
    model.marked = model.diff + 1;               // cells you can actually count
    return model;
  }

  /* === Headline ========================================================== */

  // Parts are strings or {b: 'bold text'}. Built as real nodes -- the
  // user-supplied label never touches innerHTML.
  function setHeadline(parts) {
    headlineEl.textContent = '';
    var frag = document.createDocumentFragment();
    parts.forEach(function (p) {
      if (typeof p === 'string') {
        frag.appendChild(document.createTextNode(p));
      } else {
        var s = document.createElement('strong');
        s.textContent = p.b;
        frag.appendChild(s);
      }
    });
    headlineEl.appendChild(frag);

    var text = parts.map(function (p) { return typeof p === 'string' ? p : p.b; }).join('');
    document.title = (text ? text + ' — ' : '') + 'Count Days — Snackbox';
  }

  function setSub(text) {
    subEl.textContent = text || '';
    subEl.classList.toggle('hidden', !text);
  }

  function headlineFor(model) {
    var label = state.what;

    if (model.mode === 'today') {
      setSub('');
      return label
        ? [{ b: 'Today' }, ' is ', label]
        : ['That date is ', { b: 'today' }, '.'];
    }

    if (model.mode === 'countdown') {
      var togo = model.endN - model.todayN;
      setSub('');
      if (togo === 1) return label ? [{ b: 'Tomorrow' }, ' — ', label] : [{ b: 'Tomorrow' }];
      return label
        ? [{ b: plural(togo, 'day') }, ' until ', label]
        : [{ b: plural(togo, 'day') }, ' to go'];
    }

    if (model.mode === 'since') {
      var since = model.todayN - model.startN;
      setSub('');
      if (since === 1) return label ? [{ b: 'Yesterday' }, ' — ', label] : [{ b: 'Yesterday' }];
      return label
        ? [{ b: plural(since, 'day') }, ' since ', label]
        : [{ b: plural(since, 'day') }, ' since ', fmtDate(model.startDate, true)];
    }

    // --- span. Every branch reads naturally with or without an event name,
    // rather than leaning on a filler subject like "It".
    var total = model.diff;

    if (model.startN === model.endN) {
      setSub('');
      return label
        ? [label, ' is a ', { b: 'one-day' }, ' event on ', fmtDate(model.startDate)]
        : [{ b: 'A one-day' }, ' event on ', fmtDate(model.startDate)];
    }

    if (model.todayN < model.startN) {
      setSub('');
      var until = { b: plural(model.startN - model.todayN, 'day') };
      return label
        ? [label, ' starts in ', until, ' and runs ', { b: plural(total, 'day') }]
        : ['Starts in ', until, ', runs ', { b: plural(total, 'day') }];
    }

    if (model.todayN > model.endN) {
      setSub('');
      var ago = { b: plural(model.todayN - model.endN, 'day') };
      return label
        ? [label, ' ended ', ago, ' ago — it ran ', { b: plural(total, 'day') }]
        : ['Ended ', ago, ' ago — it ran ', { b: plural(total, 'day') }];
    }

    var elapsed = model.todayN - model.startN;
    var remaining = model.endN - model.todayN;
    setSub('Day ' + num(elapsed + 1) + ' of ' + num(model.marked) + ' · ' + progressPct(model) + '% complete');

    if (model.todayN === model.startN) {
      return label
        ? [{ b: 'Day 1' }, ' of ' + num(model.marked) + ' — ', label, ' starts today']
        : [{ b: 'Day 1' }, ' of ' + num(model.marked) + ' — it starts today'];
    }
    if (model.todayN === model.endN) {
      return label ? [{ b: 'Last day' }, ' of ', label] : [{ b: 'Last day' }];
    }
    return (label ? [label, ': '] : []).concat([
      { b: plural(elapsed, 'day') }, ' in, ', { b: plural(remaining, 'day') }, ' to go']);
  }

  function progressPct(model) {
    var total = model.diff;
    var elapsed = Math.min(Math.max(model.todayN - model.startN, 0), total);
    var remaining = total - elapsed;
    if (total === 0) return 100;
    var pct = Math.round(elapsed / total * 100);
    // Never read 0% while underway, nor 100% before the end.
    if (pct === 0 && elapsed > 0) pct = 1;
    if (pct === 100 && remaining > 0) pct = 99;
    return pct;
  }

  /* === Stats ============================================================= */

  function stat(value, label, small) {
    var box = document.createElement('div');
    box.className = 'stat';
    var v = document.createElement('span');
    v.className = 'stat__value' + (small ? ' stat__value--sm' : '');
    v.textContent = value;
    var l = document.createElement('span');
    l.className = 'stat__label';
    l.textContent = label;
    box.appendChild(v);
    box.appendChild(l);
    return box;
  }

  function renderStats(model) {
    statsEl.textContent = '';
    var tiles = [];

    if (model.mode === 'countdown') {
      var togo = model.endN - model.todayN;
      tiles.push(stat(num(togo), 'Days to go'));
      tiles.push(stat(fmtDate(model.endDate), 'Target date', true));
      tiles.push(stat(num(countWeekdays(model.todayN + 1, model.endN)), 'Weekdays left'));
      tiles.push(stat(num(model.marked), 'Days marked'));
    } else if (model.mode === 'since') {
      tiles.push(stat(num(model.todayN - model.startN), 'Days since'));
      tiles.push(stat(fmtDate(model.startDate, true), 'Start date', true));
      tiles.push(stat(fmtYmd(ymd(model.startDate, model.endDate)), 'Calendar time', true));
      tiles.push(stat(num(model.marked), 'Days marked'));
    } else if (model.mode === 'today') {
      tiles.push(stat('0', 'Days to go'));
      tiles.push(stat(fmtDate(model.startDate), 'The date', true));
      tiles.push(stat('1', 'Days marked'));
    } else {
      var total = model.diff;
      var elapsed = Math.min(Math.max(model.todayN - model.startN, 0), total);
      tiles.push(stat(num(elapsed), 'Elapsed'));
      tiles.push(stat(num(total - elapsed), 'Remaining'));
      tiles.push(stat(num(model.marked), 'Days marked'));
      tiles.push(stat(progressPct(model) + '%', 'Progress'));
    }

    tiles.forEach(function (t) { statsEl.appendChild(t); });
  }

  /* === Legend ============================================================
     Mode-dependent on purpose: countdown mode contains zero past days and
     count-since contains zero future days, so a fixed legend would show a
     swatch for a marker that appears nowhere on the page. */

  function legendItem(cls, text) {
    var item = document.createElement('span');
    item.className = 'cd-legend__item';
    var swatch = document.createElement('span');
    swatch.className = 'cd-day ' + cls;
    swatch.setAttribute('aria-hidden', 'true');
    // The swatch is a shape sample, not a date -- but it still needs a line
    // box, or it collapses to a different height than a real day cell.
    swatch.textContent = '\u00A0';
    var t = document.createElement('span');
    t.textContent = text;
    item.appendChild(swatch);
    item.appendChild(t);
    return item;
  }

  function renderLegend(model) {
    legendEl.textContent = '';
    var items = [];
    if (model.mode === 'countdown') {
      items.push(legendItem('is-future', 'day ahead'));
      items.push(legendItem('is-anchor', 'target date'));
    } else if (model.mode === 'since') {
      items.push(legendItem('is-past', 'day elapsed'));
      items.push(legendItem('is-anchor', 'the date'));
    } else if (model.mode === 'today') {
      items.push(legendItem('is-anchor', 'the date'));
    } else {
      if (model.todayN > model.startN) items.push(legendItem('is-past', 'elapsed'));
      if (model.todayN < model.endN) items.push(legendItem('is-future', 'remaining'));
      items.push(legendItem('is-anchor', 'start & end'));
    }
    items.push(legendItem('is-today', 'today'));
    items.forEach(function (i) { legendEl.appendChild(i); });
    legendEl.classList.remove('hidden');
  }

  /* === Wall ==============================================================
     The wall is built as one HTML string and parsed in a single pass.
     Node-at-a-time construction cost ~1.8s for a lifetime-length span, which
     is the shape this tool is for. Nothing user-supplied reaches this markup
     -- only generated integers, MONTH_NAMES, and the fixed note strings in
     model.anchors. The event label goes through textContent in setHeadline. */

  var HEAD_ROW = (function () {
    var out = '<thead><tr>';
    for (var i = 0; i < 7; i++) {
      out += '<th scope="col"><span aria-hidden="true">' + DOW_INITIAL[i] +
        '</span><span class="visually-hidden">' + DOW_FULL[i] + '</span></th>';
    }
    return out + '</tr></thead>';
  })();

  function dayHTML(day, n, model) {
    var cls = 'cd-day';
    var note = '';
    if (n < model.startN || n > model.endN) {
      cls += ' is-out-of-span';
    } else if (Object.prototype.hasOwnProperty.call(model.anchors, n)) {
      cls += ' is-anchor';
      note = model.anchors[n];
    } else if (n < model.todayN) {
      cls += ' is-past';
    } else if (n > model.todayN) {
      cls += ' is-future';
    }
    if (n === model.todayN) {
      cls += ' is-today';
      note = note ? note + ', today' : 'today';
    }
    return '<td><span class="' + cls + '">' + day +
      (note ? '<span class="visually-hidden"> (' + note + ')</span>' : '') +
      '</span></td>';
  }

  function monthHTML(y, m, model) {
    var id = 'cd-m-' + y + '-' + m;
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var firstDow = new Date(y, m, 1).getDay();   // 0 = Sunday, used directly
    var baseN = dayIndex(new Date(y, m, 1));

    var out = '<div class="cd-month"><h3 class="cd-month__title" id="' + id + '">' +
      MONTH_NAMES[m] + ' ' + y + '</h3><table aria-labelledby="' + id + '">' +
      HEAD_ROW + '<tbody>';

    var col = 0;
    out += '<tr>';
    for (var p = 0; p < firstDow; p++) { out += '<td></td>'; col++; }
    for (var d = 1; d <= daysInMonth; d++) {
      if (col === 7) { out += '</tr><tr>'; col = 0; }
      out += dayHTML(d, baseN + d - 1, model);
      col++;
    }
    while (col < 7) { out += '<td></td>'; col++; }
    return out + '</tr></tbody></table></div>';
  }

  function renderWall(model) {
    if (!model) {
      wallEl.textContent = '';
      legendEl.classList.add('hidden');
      legendEl.textContent = '';
      return;
    }

    var startOrd = monthOrdinal(model.startDate);
    var endOrd = monthOrdinal(model.endDate);
    var totalMonths = endOrd - startOrd + 1;
    var shown = Math.min(totalMonths, MAX_MONTHS);

    var parts = [];
    for (var k = 0; k < shown; k++) {
      var o = startOrd + k;
      parts.push(monthHTML(Math.floor(o / 12), o % 12, model));
    }
    wallEl.innerHTML = parts.join('');

    if (totalMonths > shown) {
      notes.push('Showing the first ' + num(shown) + ' months of ' + num(totalMonths) +
        '. The counts above cover the full span.');
    }

    renderLegend(model);
  }

  /* === Messages ========================================================== */

  function flushNotes() {
    messageEl.textContent = notes.join(' ');
    messageEl.classList.toggle('hidden', notes.length === 0);
  }

  /* === URL =============================================================== */

  var urlTimer = null;

  function syncURL() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(writeURL, 300);
  }

  // Debounced and guarded: Safari throws past ~100 replaceState calls per 30s,
  // and replaceState can throw outright on file://.
  function writeURL() {
    clearTimeout(urlTimer);
    try {
      var url = new URL(location.href);
      var p = url.searchParams;
      if (state.what) p.set('what', state.what); else p.delete('what');
      if (state.date) p.set('date', toISO(state.date)); else p.delete('date');
      if (state.end) p.set('end', toISO(state.end)); else p.delete('end');
      p.delete('since');
      p.delete('until');
      p.delete('when');
      history.replaceState(null, '', url);
    } catch (e) { /* non-fatal */ }
  }

  function readParams() {
    var p = new URLSearchParams(location.search);
    var rawDate = p.get('date') || p.get('since') || p.get('when');
    var rawEnd = p.get('end') || p.get('until');
    var bad = [];

    state.what = (p.get('what') || '').slice(0, MAX_LABEL);
    state.date = rawDate ? parseAny(rawDate) : null;
    state.end = rawEnd ? parseAny(rawEnd) : null;

    if (rawDate && !state.date) bad.push(rawDate);
    if (rawEnd && !state.end) bad.push(rawEnd);
    if (!state.date) state.end = null;

    if (bad.length) {
      paramNote = 'Could not read ' + bad.map(function (b) { return '"' + b + '"'; }).join(' or ') +
        ' as a date. Expected YYYY-MM-DD.';
    }
  }

  /* === Render ============================================================ */

  function update(rebuildWall) {
    notes = paramNote ? [paramNote] : [];
    lastTodayN = dayIndex(new Date());

    var model = buildModel();

    if (!model) {
      summaryEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      setSub('');
      statsEl.textContent = '';
      renderWall(null);
      document.title = 'Count Days — Snackbox';
      flushNotes();
      return;
    }

    emptyEl.classList.add('hidden');
    summaryEl.classList.remove('hidden');

    if (model.swapped) {
      notes.push('Those dates were reversed — showing ' + fmtDate(model.startDate, true) +
        ' → ' + fmtDate(model.endDate, true) + '.');
    }

    setHeadline(headlineFor(model));
    renderStats(model);
    if (rebuildWall) renderWall(model);
    flushNotes();
  }

  /* === Inputs ============================================================ */

  // Keyed off the end field being visible, not state.end -- the field can be
  // revealed with nothing in it yet, and "Date / End date" would read wrong.
  function updateDateLabel() {
    var paired = !endField.classList.contains('hidden');
    dateWord.textContent = paired ? 'Start date' : 'Date';
    dateHint.classList.toggle('hidden', paired);
  }

  function syncInputs() {
    whatInput.value = state.what;
    dateInput.value = state.date ? toISO(state.date) : '';
    endInput.value = state.end ? toISO(state.end) : '';
    endField.classList.toggle('hidden', !state.end);
    endAddBtn.classList.toggle('hidden', !!state.end);
    updateDateLabel();
  }

  // The label never affects the wall -- re-rendering 22k nodes per keystroke
  // is exactly the thing to avoid here.
  whatInput.addEventListener('input', function () {
    state.what = whatInput.value.slice(0, MAX_LABEL);
    update(false);
    syncURL();
  });

  dateInput.addEventListener('input', function () {
    paramNote = '';
    state.date = parseISO(dateInput.value);
    if (!state.date) {
      state.end = null;
      endField.classList.add('hidden');
      endAddBtn.classList.remove('hidden');
      updateDateLabel();
    }
    update(true);
    syncURL();
  });

  endInput.addEventListener('input', function () {
    paramNote = '';
    state.end = parseISO(endInput.value);
    update(true);
    syncURL();
  });

  endAddBtn.addEventListener('click', function () {
    endField.classList.remove('hidden');
    endAddBtn.classList.add('hidden');
    updateDateLabel();
    if (!endInput.value && state.date) {
      state.end = addDays(state.date, 7);
      endInput.value = toISO(state.end);
      update(true);
      syncURL();
    }
    endInput.focus();
  });

  endRemoveBtn.addEventListener('click', function () {
    state.end = null;
    endInput.value = '';
    endField.classList.add('hidden');
    endAddBtn.classList.remove('hidden');
    updateDateLabel();
    update(true);
    syncURL();
    endAddBtn.focus();
  });

  document.querySelectorAll('[data-preset]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var today = new Date();
      var preset = btn.dataset.preset;
      paramNote = '';
      if (preset === 'newyear') state.date = new Date(today.getFullYear() + 1, 0, 1);
      else if (preset === 'plus30') state.date = addDays(today, 30);
      else state.date = addDays(today, 365);
      syncInputs();
      update(true);
      writeURL();
    });
  });

  copyBtn.addEventListener('click', function () {
    writeURL();   // flush the debounce so the copied link matches what's on screen
    var done = function (ok) {
      copyBtn.textContent = ok ? 'Copied' : 'Press Ctrl+C';
      setTimeout(function () { copyBtn.textContent = 'Copy link'; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(location.href).then(function () { done(true); },
        function () { done(false); });
    } else {
      done(false);
    }
  });

  // A tab left open past midnight would otherwise show stale markers -- and in
  // countdown mode the whole thing can flip to count-since.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && dayIndex(new Date()) !== lastTodayN) update(true);
  });

  /* === Boot ============================================================== */

  readParams();
  syncInputs();
  update(true);
  if (location.search) writeURL();   // migrate legacy params to the new form
})();
