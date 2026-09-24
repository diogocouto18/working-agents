// Movement model: a small waypoint graph, not a full tile-grid BFS. Each
// room has one "door" waypoint (just outside it, in the hallway) connected
// to a central hallway hub; each seat inside a room connects to that
// room's door. A path between any two seats is: seat -> own door -> hub ->
// target door -> target seat. This is enough to make agents visibly walk
// out of one room, through the hallway, and into another — the actual ask
// — without needing per-tile obstacle avoidance.

const HUB = { x: 464, y: 240 };

const DOORS = {
  work: { x: 448, y: 128 },
  meeting: { x: 608, y: 224 },
  bathroom: { x: 800, y: 64 },
  bar: { x: 768, y: 256 },
  games: { x: 192, y: 352 },
  dorm: { x: 640, y: 544 },
};

// "work" seats: where working/waiting agents sit. "social" seats: where
// idle agents drift to (meeting room, bar, games room) — mirrors the
// working <-> idle room split real pixel-office tools use.
const WORK_SEATS = [
  { room: 'work', x: 80, y: 96 },
  { room: 'work', x: 208, y: 96 },
  { room: 'work', x: 80, y: 192 },
  { room: 'work', x: 208, y: 192 },
  { room: 'work', x: 304, y: 224 },
];
const SOCIAL_SEATS = [
  { room: 'meeting', x: 537, y: 96 },
  { room: 'meeting', x: 592, y: 50 },
  { room: 'meeting', x: 647, y: 96 },
  { room: 'bar', x: 740, y: 375 },
  { room: 'bar', x: 880, y: 375 },
  { room: 'games', x: 208, y: 432 },
  { room: 'games', x: 300, y: 470 },
  { room: 'dorm', x: 704, y: 544 },
  { room: 'dorm', x: 832, y: 544 },
  { room: 'dorm', x: 704, y: 608 },
];

// Real-life daily schedule (local time), user-provided — governs where an
// IDLE agent drifts to. Working/waiting agents always sit at their desk
// regardless of the clock: this only reflects what idle agents do with
// their downtime, not a claim about when real Claude Code activity happens.
// Windows not listed here (the 08:00-18:00 workday, outside the breaks
// below) fall back to a random seat in any room — free roam.
const SCHEDULE = [
  { start: 0 * 60, end: 8 * 60, room: 'dorm' }, // 00:00-08:00 sleeping
  { start: 11 * 60, end: 11 * 60 + 30, room: 'bar' }, // 11:00-11:30 pause
  { start: 13 * 60, end: 14 * 60, room: 'bar' }, // 13:00-14:00 lunch
  { start: 16 * 60 + 45, end: 17 * 60 + 15, room: 'bar' }, // 16:45-17:15 pause
  { start: 18 * 60, end: 20 * 60, room: 'games' }, // 18:00-20:00 end of day
  { start: 20 * 60, end: 21 * 60, room: 'bar' }, // 20:00-21:00 dinner
  { start: 21 * 60, end: 24 * 60, room: 'games' }, // 21:00-00:00 games room
];

function scheduledRoom(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  for (const { start, end, room } of SCHEDULE) {
    if (minutes >= start && minutes < end) return room;
  }
  return null;
}

const SPEED_PX_PER_TICK = 5; // walking speed
const IDLE_REWANDER_MS = 8_000; // how often a free-roaming idle agent picks a new social seat
const SLEEP_REWANDER_MS = 5 * 60_000; // agents settle in the dorm instead of jittering between sofas

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function buildPath(fromXY, toSeat) {
  // If already essentially at the seat, no path needed.
  if (dist(fromXY, toSeat) < 4) return [];
  const door = DOORS[toSeat.room];
  return [door, HUB, door, toSeat].reduce((acc, wp) => {
    // collapse consecutive duplicate waypoints (e.g. same door twice when
    // walking within the same room) and skip the leading door/hub hop when
    // we're already inside that room, close to its door.
    if (acc.length === 0 || dist(acc[acc.length - 1], wp) > 2) acc.push(wp);
    return acc;
  }, []);
}

// One entry per live agent: { x, y, path: [waypoints left], seat, seatCategory, lastReassignAt }
const agents = new Map();
let nextWorkSeat = 0;

function assignWorkSeat(takenSeats) {
  for (let i = 0; i < WORK_SEATS.length; i++) {
    const idx = (nextWorkSeat + i) % WORK_SEATS.length;
    if (!takenSeats.has(idx)) {
      nextWorkSeat = (idx + 1) % WORK_SEATS.length;
      return { category: 'work', index: idx, ...WORK_SEATS[idx] };
    }
  }
  // no free work seat — overflow onto a random social seat rather than stack
  const idx = Math.floor(Math.random() * SOCIAL_SEATS.length);
  return { category: 'social', index: idx, ...SOCIAL_SEATS[idx] };
}

function randomSocialSeat() {
  const idx = Math.floor(Math.random() * SOCIAL_SEATS.length);
  return { category: 'social', index: idx, ...SOCIAL_SEATS[idx] };
}

// Picks a social seat honoring the current schedule window, if any — falls
// back to any room when there's no active window (free-roam workday hours).
function scheduledSocialSeat(room) {
  if (!room) return randomSocialSeat();
  const pool = SOCIAL_SEATS.filter((s) => s.room === room);
  if (pool.length === 0) return randomSocialSeat();
  const idx = Math.floor(Math.random() * pool.length);
  return { category: 'social', index: SOCIAL_SEATS.indexOf(pool[idx]), ...pool[idx] };
}

export function updateWorld(sessions) {
  const now = Date.now();
  const liveIds = new Set(sessions.map((s) => s.id));

  for (const id of agents.keys()) {
    if (!liveIds.has(id)) agents.delete(id);
  }

  const takenWorkSeats = new Set(
    [...agents.values()].filter((a) => a.seat?.category === 'work').map((a) => a.seat.index),
  );

  for (const s of sessions) {
    const wantsWork = s.status === 'working' || s.status === 'waiting';
    let a = agents.get(s.id);

    if (!a) {
      const room = scheduledRoom();
      const seat = wantsWork ? assignWorkSeat(takenWorkSeats) : scheduledSocialSeat(room);
      if (seat.category === 'work') takenWorkSeats.add(seat.index);
      a = { x: seat.x, y: seat.y, path: [], seat, scheduledRoom: wantsWork ? null : room, lastReassignAt: now };
      agents.set(s.id, a);
      continue;
    }

    const currentlyWork = a.seat.category === 'work';
    if (wantsWork && !currentlyWork) {
      const seat = assignWorkSeat(takenWorkSeats);
      takenWorkSeats.add(seat.index);
      a.seat = seat;
      a.scheduledRoom = null;
      a.path = buildPath(a, seat);
      a.lastReassignAt = now;
    } else if (!wantsWork) {
      const room = scheduledRoom();
      // Reassign right away when we just went idle, or the schedule crossed
      // into a new window (e.g. games -> dorm at midnight) — otherwise only
      // re-wander every so often, much less often while "asleep" in the
      // dorm so agents settle onto a sofa instead of jittering between them.
      const scheduleChanged = currentlyWork || a.scheduledRoom !== room;
      const rewanderMs = room === 'dorm' ? SLEEP_REWANDER_MS : IDLE_REWANDER_MS;
      if (scheduleChanged || now - a.lastReassignAt > rewanderMs) {
        const seat = scheduledSocialSeat(room);
        a.seat = seat;
        a.scheduledRoom = room;
        a.path = buildPath(a, seat);
        a.lastReassignAt = now;
      }
    } else if (wantsWork && currentlyWork) {
      takenWorkSeats.add(a.seat.index); // keep holding this seat
    }
  }

  // advance movement
  for (const a of agents.values()) {
    if (a.path.length === 0) continue;
    const target = a.path[0];
    const d = dist(a, target);
    if (d <= SPEED_PX_PER_TICK) {
      a.x = target.x;
      a.y = target.y;
      a.path.shift();
    } else {
      const t = SPEED_PX_PER_TICK / d;
      a.x += (target.x - a.x) * t;
      a.y += (target.y - a.y) * t;
    }
  }

  const positions = {};
  for (const [id, a] of agents) {
    positions[id] = { x: Math.round(a.x), y: Math.round(a.y), walking: a.path.length > 0 };
  }
  return positions;
}
