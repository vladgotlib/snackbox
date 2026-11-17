const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('./script.js');

const MIN = 60000;
const T0 = Date.UTC(2026, 10, 17, 17, 0, 0);
const line = () => [
  { number: 30, timestamp: T0 },
  { number: 32, timestamp: T0 + 5 * MIN },
  { number: 34, timestamp: T0 + 10 * MIN },
]; // exactly 2.5 min per number

test('estimate while waiting', () => {
  const e = Q.estimate(line(), 45, T0 + 10 * MIN);
  assert.equal(e.state, 'waiting');
  assert.equal(e.latest, 34);
  assert.equal(e.ahead, 10);
  assert.equal(e.callAt, T0 + 37.5 * MIN);
  assert.equal(e.waitMs, 27.5 * MIN);
  assert.equal(e.minPerNum, 2.5);
  assert.equal(e.overdue, false);
});

test('estimate past the call time is overdue with zero wait', () => {
  const e = Q.estimate(line(), 45, T0 + 40 * MIN);
  assert.equal(e.waitMs, 0);
  assert.equal(e.overdue, true);
});

test('estimate ignores void observations', () => {
  const obs = [...line(), { number: 36, timestamp: T0 + 11 * MIN, void: true }];
  const e = Q.estimate(obs, 45, T0 + 10 * MIN);
  assert.equal(e.latest, 34);
  assert.equal(e.callAt, T0 + 37.5 * MIN);
});

test('estimate reports called at or past your number', () => {
  assert.equal(Q.estimate([...line(), { number: 45, timestamp: T0 + 30 * MIN }], 45, T0).state, 'called');
  assert.equal(Q.estimate([{ number: 46, timestamp: T0 }], 45, T0).state, 'called');
});

test('estimate needs two usable logs', () => {
  const one = Q.estimate([{ number: 34, timestamp: T0 }], 45, T0);
  assert.deepEqual(one, { state: 'need-more', latest: 34, ahead: 10 });
  const voided = line().map((o, i) => (i < 2 ? { ...o, void: true } : o));
  assert.equal(Q.estimate(voided, 45, T0).state, 'need-more');
  const same = [{ number: 34, timestamp: T0 }, { number: 34, timestamp: T0 + MIN }];
  assert.equal(Q.estimate(same, 45, T0).state, 'need-more');
});

test('estimate flags numbers going down over time', () => {
  const e = Q.estimate([{ number: 40, timestamp: T0 }, { number: 35, timestamp: T0 + 5 * MIN }], 45, T0);
  assert.deepEqual(e, { state: 'off', latest: 40, ahead: 4 });
});

test('estimate without your number or logs is setup', () => {
  assert.deepEqual(Q.estimate(line(), null, T0), { state: 'setup' });
  assert.deepEqual(Q.estimate([], 45, T0), { state: 'setup' });
});

test('stageOf', () => {
  const at = (latest) => Q.stageOf(Q.estimate([{ number: 20, timestamp: T0 }, { number: latest, timestamp: T0 + MIN }], 45, T0));
  assert.equal(at(34), '');
  assert.equal(at(42), 'ready'); // 2 ahead
  assert.equal(at(43), 'ready'); // 1 ahead
  assert.equal(at(44), 'next');
  assert.equal(at(45), 'turn');
  assert.equal(Q.stageOf({ state: 'setup' }), '');
});

test('stageEvents fires only on transitions', () => {
  assert.deepEqual(Q.stageEvents('', 'ready'), ['ready']);
  assert.deepEqual(Q.stageEvents('', 'next'), ['ready']);
  assert.deepEqual(Q.stageEvents('ready', 'next'), []);
  assert.deepEqual(Q.stageEvents('next', 'turn'), ['turn']);
  assert.deepEqual(Q.stageEvents('', 'turn'), ['turn']);
  assert.deepEqual(Q.stageEvents('turn', 'turn'), []);
  assert.deepEqual(Q.stageEvents('ready', 'ready'), []);
  assert.deepEqual(Q.stageEvents('turn', 'next'), []); // undo after your turn
});

test('estimateShift ignores small or missing changes', () => {
  assert.equal(Q.estimateShift(null, T0), null);
  assert.equal(Q.estimateShift(T0, null), null);
  assert.equal(Q.estimateShift(T0, T0 + 9000), null);
  assert.equal(Q.estimateShift(T0, T0 + 80000), 80000);
  assert.equal(Q.estimateShift(T0, T0 - 45000), -45000);
});

test('formatters', () => {
  assert.equal(Q.formatClock(27.5 * MIN), '27:30');
  assert.equal(Q.formatClock(3723000), '1:02:03');
  assert.equal(Q.formatClock(-5), '0:00');
  assert.equal(Q.formatShift(80000), '+1:20 later');
  assert.equal(Q.formatShift(-45000), '−0:45 sooner');
  assert.equal(Q.formatGap(144000), '+2.4m');
  assert.equal(Q.formatTime(new Date(2026, 10, 17, 15, 42).getTime()), '3:42 PM');
  assert.equal(Q.formatTime(new Date(2026, 10, 17, 0, 5).getTime()), '12:05 AM');
});

test('stubNumbers caps at 12 and counts the rest', () => {
  assert.deepEqual(Q.stubNumbers(34, 45), { shown: [35, 36, 37, 38, 39, 40, 41, 42, 43, 44], extra: 0 });
  assert.deepEqual(Q.stubNumbers(10, 45), { shown: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22], extra: 22 });
  assert.deepEqual(Q.stubNumbers(44, 45), { shown: [], extra: 0 });
  assert.deepEqual(Q.stubNumbers(50, 45), { shown: [], extra: 0 });
  assert.deepEqual(Q.stubNumbers(null, 45), { shown: [], extra: 0 });
});

test('logRows is newest first with gaps to the previous usable log', () => {
  const obs = [
    { number: 30, timestamp: T0 },
    { number: 32, timestamp: T0 + 5 * MIN },
    { number: 34, timestamp: T0 + 10 * MIN, void: true },
    { number: 35, timestamp: T0 + 12 * MIN },
  ];
  assert.deepEqual(Q.logRows(obs).map((r) => [r.index, r.number, r.void, r.gapMs]), [
    [3, 35, false, 7 * MIN],
    [2, 34, true, null],
    [1, 32, false, 5 * MIN],
    [0, 30, false, null],
  ]);
});

const fresh = () => ({ yourNumber: 45, observations: line(), updatedAt: T0 + 10 * MIN });

test('newState', () => {
  assert.deepEqual(Q.newState(T0), { yourNumber: null, observations: [], updatedAt: T0 });
});

test('parseNumber accepts 1..9999 integers only', () => {
  assert.equal(Q.parseNumber('45'), 45);
  assert.equal(Q.parseNumber(' 7 '), 7);
  assert.equal(Q.parseNumber('9999'), 9999);
  for (const bad of ['0', '-3', '4.5', 'abc', '', '10000']) assert.equal(Q.parseNumber(bad), null, bad);
});

test('setYourNumber is immutable and stamps updatedAt', () => {
  const s = Q.newState(T0);
  const t = Q.setYourNumber(s, 45, T0 + 1);
  assert.equal(t.yourNumber, 45);
  assert.equal(t.updatedAt, T0 + 1);
  assert.equal(s.yourNumber, null);
});

test('addObservation appends a higher number', () => {
  const t = Q.addObservation(fresh(), 35, T0 + 12 * MIN);
  assert.deepEqual(t.observations.at(-1), { number: 35, timestamp: T0 + 12 * MIN });
  assert.equal(t.updatedAt, T0 + 12 * MIN);
  assert.equal(fresh().observations.length, 3);
});

test('addObservation rejects numbers not above latest', () => {
  assert.equal(Q.addObservation(fresh(), 34, T0), null);
  assert.equal(Q.addObservation(fresh(), 30, T0), null);
});

test('a voided higher number does not block logging', () => {
  const s = { ...fresh(), observations: [...line(), { number: 36, timestamp: T0 + 11 * MIN, void: true }] };
  assert.equal(Q.latestNumber(s), 34);
  assert.notEqual(Q.addObservation(s, 35, T0 + 12 * MIN), null);
});

test('latestNumber is null with no usable logs', () => {
  assert.equal(Q.latestNumber(Q.newState(T0)), null);
});

test('undoLast drops the last log but keeps at least one', () => {
  const t = Q.undoLast(fresh(), T0 + 11 * MIN);
  assert.deepEqual(t.observations.map((o) => o.number), [30, 32]);
  assert.equal(Q.undoLast({ ...fresh(), observations: [line()[0]] }, T0), null);
});

test('toggleVoid flips and restores', () => {
  const once = Q.toggleVoid(fresh(), 1, T0);
  assert.equal(once.observations[1].void, true);
  assert.equal(Q.toggleVoid(once, 1, T0).observations[1].void, false);
});

test('restore round-trips a saved state', () => {
  assert.deepEqual(Q.restore(JSON.stringify(fresh()), T0 + 11 * MIN), fresh());
});

test('restore rejects garbage', () => {
  for (const raw of [null, '', 'garbage{', '{"foo":1}', '[]', '42']) assert.equal(Q.restore(raw, T0), null, String(raw));
});

test('restore drops malformed observations and bad your number', () => {
  const raw = JSON.stringify({
    yourNumber: 'abc',
    observations: [{ number: 'x', timestamp: T0 }, { number: 35 }, { number: 36, timestamp: T0, void: 'yes' }, { number: 37, timestamp: T0 }],
    updatedAt: T0,
  });
  assert.deepEqual(Q.restore(raw, T0), {
    yourNumber: null,
    observations: [{ number: 36, timestamp: T0, void: false }, { number: 37, timestamp: T0 }],
    updatedAt: T0,
  });
});

test('restore expires after 12 hours without changes', () => {
  const raw = JSON.stringify(fresh());
  const saved = fresh().updatedAt;
  assert.notEqual(Q.restore(raw, saved + Q.EXPIRE_MS - 1), null);
  assert.equal(Q.restore(raw, saved + Q.EXPIRE_MS + 1), null);
});

test('resolveEntry uses the suggestion only when nothing is typed', () => {
  assert.equal(Q.resolveEntry('', '37'), 37);
  assert.equal(Q.resolveEntry('   ', '37'), 37);
  assert.equal(Q.resolveEntry('41', '37'), 41); // typed digits replace the suggestion, never append to it
  assert.equal(Q.resolveEntry('', ''), null);
  assert.equal(Q.resolveEntry('abc', '37'), null);
});
