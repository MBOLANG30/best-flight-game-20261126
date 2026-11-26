// Every tuning number and colour of Meridian Run in one place.
// The island is 5000 x 5000 metres; the runway sits near its centre at (0, 0).
// Speeds are m/s, altitudes metres, headings degrees, angles radians.

export const WORLD = {
  size: 5000,
  half: 2500,
  seaLevel: 0,
  bounds: 2600,
};

export const STEP = 1 / 60;

export const PLANE = {
  cruiseSpeed: 78,
  minSpeed: 34,
  maxSpeed: 138,
  accel: 26,
  drag: 0.12,
  pitchRate: 0.85,
  rollRate: 2.1,
  turnRate: 0.55,
  maxPitch: 0.5,
  maxRoll: 1.15,
  stallSpeed: 38,
  sinkRate: 9,
  startPos: { x: 0, y: 6, z: -260 },
  startHeading: 0,
};

export const RINGS = {
  count: 12,
  radius: 18,
  passScore: 100,
  timeBonus: 8,
};

export const GAME = {
  startTime: 150,
  completeBonus: 500,
  lives: 1,
};

/** Seconds of flight that put the play screenshot mid-course. */
export const SHOT_PLAY_SECONDS = 24;
/** How long the end scene's autopilot may fly to finish the course. */
export const SHOT_END_LIMIT_SECONDS = 420;

export const PALETTE = {
  skyTop: '#2f6fb4',
  skyHorizon: '#bcd9ee',
  sea: '#2e7fa8',
  sand: '#d9c08a',
  grass: '#5d9b4a',
  fieldA: '#7fae4e',
  fieldB: '#a8b45a',
  forest: '#2f6b34',
  rock: '#8a7f74',
  snow: '#eef2f5',
  runway: '#3a3f46',
  runwayMark: '#f2f2ea',
  townRoofA: '#b5533c',
  townRoofB: '#4a6b8a',
  townWall: '#e8ddc8',
  planeCream: '#f2e6c9',
  planeTeal: '#1f7a6d',
  planeOrange: '#e8702a',
  ringGold: '#f2c94c',
  ringNext: '#ffd94d',
  hudAmber: '#ffb454',
  hudCyan: '#6ee7ff',
  hudGlass: 'rgba(8, 14, 24, 0.55)',
  hudText: '#eef4f8',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'meridian-run.best';
