// The screenshot scenes behind ?shot=cover|rings|landing|dusk. Each one plays the real
// rules forward from a fresh world for a fixed stretch, steered by a simple autopilot
// (aim for the next ring, hold height, line up with the strip), so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { STEP, SEG_LEN, RUNWAY } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

/** Steer toward the next ring, or toward the strip when the rings are done. */
function autopilot(world) {
  const state = world.state;
  const nextRing = state.rings.find((ring) => !ring.passed);
  const centre = world.centreXAt(state.z);
  let targetX = centre;
  let targetAlt = 80;
  let targetSpeed = 36;
  if (nextRing) {
    targetX = world.centreXAt(nextRing.z) + nextRing.x;
    targetAlt = nextRing.alt;
  } else if (state.z < RUNWAY.startSeg * SEG_LEN) {
    // Final approach: centreline, sinking gently onto the strip.
    const distToStrip = RUNWAY.startSeg * SEG_LEN - state.z;
    targetAlt = Math.max(12, Math.min(70, distToStrip * 0.045));
    targetSpeed = 30;
  }
  const steer = Math.max(-1, Math.min(1, (targetX - state.x) / 45));
  const ground = world.groundYAt(state.z);
  const pitch = Math.max(-1, Math.min(1, (ground + targetAlt - state.y) / 28));
  const throttleDelta = state.speed < targetSpeed - 1 ? 1 : state.speed > targetSpeed + 1 ? -1 : 0;
  return { steer, pitch, throttleDelta, drop: false };
}

function flyFor(world, seconds, stopWhen) {
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    world.step(SAMPLE, autopilot(world));
    if (stateDone(world)) break;
    if (stopWhen && stopWhen(world)) break;
  }
}

function stateDone(world) {
  return world.state.over;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Any other name stages the cover.
 */
export function stageShot(name, world) {
  if (name === 'dusk') {
    world.reset(2);
    flyFor(world, 46, null);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'landing') {
    world.reset(0);
    flyFor(world, 240, (w) => w.state.z >= 372 * SEG_LEN);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'rings') {
    world.reset(0);
    flyFor(world, 70, (w) => w.state.ringsHit >= 2);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // cover: a mid-valley cruise under the title screen.
  world.reset(0);
  flyFor(world, 34, null);
  return { screen: SCREEN_TITLE, best: 0 };
}
