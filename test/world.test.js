import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEDULE, scheduledRoom, updateWorld } from '../server/world.js';

const at = (h, m = 0) => new Date(2026, 0, 15, h, m); // local time, as scheduledRoom() uses

test('schedule windows are well-formed, sorted and non-overlapping', () => {
  const rooms = new Set(['bar', 'games', 'dorm', 'meeting']);
  let prevEnd = 0;
  for (const { start, end, room } of SCHEDULE) {
    assert.ok(rooms.has(room), `unknown room ${room}`);
    assert.ok(start < end, `empty window ${start}-${end}`);
    assert.ok(start >= prevEnd, `window at ${start} overlaps the previous one`);
    assert.ok(end <= 24 * 60);
    prevEnd = end;
  }
});

test('scheduledRoom follows the documented daily routine', () => {
  const expected = [
    [[0, 0], 'dorm'],
    [[7, 59], 'dorm'],
    [[8, 0], null],
    [[10, 59], null],
    [[11, 0], 'bar'],
    [[11, 29], 'bar'],
    [[11, 30], null],
    [[13, 0], 'bar'],
    [[13, 59], 'bar'],
    [[14, 0], null],
    [[16, 44], null],
    [[16, 45], 'bar'],
    [[17, 14], 'bar'],
    [[17, 15], null],
    [[18, 0], 'games'],
    [[19, 59], 'games'],
    [[20, 0], 'bar'],
    [[20, 59], 'bar'],
    [[21, 0], 'games'],
    [[23, 59], 'games'],
  ];
  for (const [[h, m], room] of expected) {
    assert.equal(scheduledRoom(at(h, m)), room, `${h}:${String(m).padStart(2, '0')}`);
  }
});

const session = (id, status) => ({ id, status });

test('working and waiting agents get distinct work-room seats', () => {
  const positions = updateWorld([session('w1', 'working'), session('w2', 'waiting')]);
  assert.equal(Object.keys(positions).length, 2);
  assert.notDeepEqual(
    [positions.w1.x, positions.w1.y],
    [positions.w2.x, positions.w2.y],
  );
  assert.equal(positions.w1.walking, false);
  // work-room seats are all in the left part of the map
  for (const p of Object.values(positions)) assert.ok(p.x <= 304 && p.y <= 224);
});

test('agents that disappear are dropped from the world', () => {
  updateWorld([session('gone-1', 'working'), session('gone-2', 'working')]);
  const positions = updateWorld([session('gone-2', 'working')]);
  assert.deepEqual(Object.keys(positions), ['gone-2']);
});

test('an agent going from working to idle starts walking away from its desk', () => {
  updateWorld([session('mover', 'working')]);
  const after = updateWorld([session('mover', 'idle')]).mover;
  // social seats are all outside the work room, so a path must exist
  assert.equal(after.walking, true);
});
