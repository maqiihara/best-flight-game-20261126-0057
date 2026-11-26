// Kitehawk Ridge Run — tuning constants. One place for every number the flight model,
// the valley and the missions share, so the game is tuned here and nowhere else.
export const STEP = 1 / 60;
export const SEG_LEN = 20; // metres per terrain segment
export const SEGMENTS = 420; // the valley is 8,400 m long
export const DRAW_DISTANCE = 110; // segments drawn ahead of the camera
export const VALLEY_HALF = 130; // metres either side of the centreline the plane may fly
export const CAMERA_DEPTH = 0.84; // 1 / tan(field of view / 2)

export const PLANE = {
  maxSpeed: 62, // m/s, full throttle in level flight
  minSpeed: 17, // below this the wing stops flying and the nose drops
  cruiseSpeed: 38,
  accel: 14, // m/s^2 at full throttle
  drag: 0.22, // speed lost per second, proportional to speed
  climbRate: 9, // m/s at full climb with speed to spare
  sinkRate: 12, // m/s falling when stalled or throttled right back
  turnRate: 0.55, // radians of heading per second at full bank
  lateralSpeed: 46, // m/s across the valley at full bank
  fuelCapacity: 100,
  fuelBurn: 0.55, // units per second at full throttle, plus a small idle burn
  idleBurn: 0.08,
  startAltitude: 90, // metres above the valley floor
  startSpeed: 34,
};

export const RUNWAY = {
  startSeg: 392,
  endSeg: 412,
  halfWidth: 14, // metres
  landingSpeed: 42, // m/s or less to touch down safely
  landingSink: 4, // m/s of descent or less at touchdown
};

export const RING = {
  radius: 13, // metres; the plane must pass within this of the ring centre
  points: 500,
};

export const MISSIONS = [
  {
    id: 'rings',
    name: 'Ring Run',
    blurb: 'Thread all six sky rings, then put her down on the valley strip.',
    palette: 'day',
    fuel: 100,
    rings: 6,
    drop: null,
  },
  {
    id: 'supply',
    name: 'Supply Drop',
    blurb: 'Carry the medicine crate to the mountain hut, drop it in the meadow, then land.',
    palette: 'day',
    fuel: 100,
    rings: 2,
    drop: { seg: 300, halfWidth: 26 },
  },
  {
    id: 'dusk',
    name: 'Dusk Mail',
    blurb: 'Last light over the ridge. Fly the mail route and land on the lit strip before the fuel is gone.',
    palette: 'dusk',
    fuel: 70,
    rings: 3,
    drop: null,
  },
];

export const BEST_KEY = 'kitehawk-ridge-run-best';
export const SCREENS = { TITLE: 0, PLAY: 1, PAUSED: 2, OVER: 3 };
export const EVENT_RING = 1;
export const EVENT_DROP = 2;
export const EVENT_LANDED = 4;
export const EVENT_CRASH = 8;
export const EVENT_FUEL = 16;
export const EVENT_OVER = 32;
