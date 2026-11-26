// Kitehawk Ridge Run — the world: a valley of terrain segments, the flight model,
// the rings, the supply drop and the runway. The renderer only reads this state.
import {
  STEP, SEG_LEN, SEGMENTS, VALLEY_HALF, PLANE, RUNWAY, RING, MISSIONS,
  EVENT_RING, EVENT_DROP, EVENT_LANDED, EVENT_CRASH, EVENT_FUEL, EVENT_OVER,
} from './config.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildSegments(random) {
  const segments = [];
  let curve = 0;
  let centreX = 0;
  for (let index = 0; index < SEGMENTS; index += 1) {
    curve = clamp(curve + random.float(-0.004, 0.004), -0.028, 0.028);
    centreX += curve * SEG_LEN;
    let ground = 'field';
    if (index >= RUNWAY.startSeg && index <= RUNWAY.endSeg) ground = 'runway';
    else if (index >= 378 && index < RUNWAY.startSeg) ground = 'town';
    else if (index % 97 >= 40 && index % 97 <= 42) ground = 'river';
    else if (random.next() < 0.22) ground = 'forest';
    // Rolling hills, flattened into the runway so the strip is level.
    let elevation = 26 * Math.sin(index * 0.02) + 16 * Math.sin(index * 0.043 + 1.7) + 7 * Math.sin(index * 0.11 + 0.4);
    if (index >= 384) elevation = 26 * Math.sin(384 * 0.02) + 16 * Math.sin(384 * 0.043 + 1.7) + 7 * Math.sin(384 * 0.11 + 0.4);
    const sprites = [];
    if (ground === 'forest') {
      const count = random.int(2, 4);
      for (let s = 0; s < count; s += 1) sprites.push({ type: 'tree', offset: random.float(-110, 110), scale: random.float(0.8, 1.4) });
    } else if (ground === 'town') {
      const count = random.int(1, 3);
      for (let s = 0; s < count; s += 1) sprites.push({ type: 'house', offset: random.float(-95, 95), scale: random.float(0.9, 1.3) });
    } else if (ground === 'field' && random.next() < 0.3) {
      sprites.push({ type: 'tree', offset: random.float(-115, 115), scale: random.float(0.7, 1.2) });
    }
    if (index === RUNWAY.startSeg - 2) sprites.push({ type: 'windsock', offset: 24, scale: 1 });
    if (index === RUNWAY.startSeg + 3) sprites.push({ type: 'hangar', offset: -34, scale: 1 });
    if (index === RUNWAY.endSeg - 2) sprites.push({ type: 'windsock', offset: -24, scale: 1 });
    segments.push({ index, curve, centreX, elevation, ground, sprites });
  }
  return segments;
}

function ringSpots(random, mission) {
  const spots = [];
  const count = mission.rings;
  for (let i = 0; i < count; i += 1) {
    const seg = 55 + Math.round((i + 0.5) * (330 / count)) + random.int(-8, 8);
    spots.push({
      seg,
      z: seg * SEG_LEN,
      x: random.float(-55, 55),
      alt: random.float(55, 95),
      hit: false,
      passed: false,
    });
  }
  return spots;
}

export function createWorld(random) {
  const segments = buildSegments(random);
  const state = {
    mission: MISSIONS[0],
    missionIndex: 0,
    x: 0, y: 0, z: 0,
    speed: 0, throttle: 0,
    heading: 0, pitch: 0, roll: 0,
    verticalSpeed: 0,
    fuel: 100, damage: 0, score: 0,
    rings: [], ringsHit: 0,
    dropped: false, dropScore: 0,
    landed: false, crashed: false, over: false,
    time: 0, message: '', messageTimer: 0,
    best: 0,
  };

  function segmentAt(z) {
    const index = clamp(Math.floor(z / SEG_LEN), 0, SEGMENTS - 1);
    return segments[index];
  }
  function groundYAt(z) {
    const index = clamp(Math.floor(z / SEG_LEN), 0, SEGMENTS - 2);
    const frac = (z - index * SEG_LEN) / SEG_LEN;
    return segments[index].elevation + (segments[index + 1].elevation - segments[index].elevation) * frac;
  }
  function centreXAt(z) {
    const index = clamp(Math.floor(z / SEG_LEN), 0, SEGMENTS - 2);
    const frac = (z - index * SEG_LEN) / SEG_LEN;
    return segments[index].centreX + (segments[index + 1].centreX - segments[index].centreX) * frac;
  }
  function say(text, seconds = 2.5) {
    state.message = text;
    state.messageTimer = seconds;
  }

  function reset(missionIndex = 0) {
    const mission = MISSIONS[missionIndex % MISSIONS.length];
    state.mission = mission;
    state.missionIndex = missionIndex % MISSIONS.length;
    state.x = 0;
    state.z = 4 * SEG_LEN;
    state.y = groundYAt(state.z) + PLANE.startAltitude;
    state.speed = PLANE.startSpeed;
    state.throttle = 0.62;
    state.heading = 0;
    state.pitch = 0;
    state.roll = 0;
    state.verticalSpeed = 0;
    state.fuel = mission.fuel;
    state.damage = 0;
    state.score = 0;
    state.rings = ringSpots(random, mission);
    state.ringsHit = 0;
    state.dropped = false;
    state.dropScore = 0;
    state.landed = false;
    state.crashed = false;
    state.over = false;
    state.time = 0;
    say(`${mission.name} — ${mission.blurb}`, 4);
  }

  function step(dt, controls) {
    if (state.over) return 0;
    let events = 0;
    state.time += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;

    // Throttle and speed: the engine pulls toward the throttle's target speed,
    // climbing costs speed and descending gives it back.
    state.throttle = clamp(state.throttle + controls.throttleDelta * dt * 0.7, 0, 1);
    const targetSpeed = state.throttle * PLANE.maxSpeed;
    state.speed += (targetSpeed - state.speed) * dt * 0.45;
    state.speed -= state.verticalSpeed * dt * 0.35;
    state.speed = clamp(state.speed, 0, PLANE.maxSpeed + 6);

    const speedFactor = clamp(state.speed / PLANE.cruiseSpeed, 0, 1.4);
    const stalled = state.speed < PLANE.minSpeed;
    // Pitch: climb while fast, sink while slow; a stall drops the nose hard.
    let climb = controls.pitch * PLANE.climbRate * speedFactor;
    if (stalled) climb = -PLANE.sinkRate;
    state.verticalSpeed += (climb - state.verticalSpeed) * dt * 2.2;
    state.y += state.verticalSpeed * dt;
    state.pitch = clamp(state.verticalSpeed / PLANE.climbRate, -1, 1);

    // Turn: bank rolls the plane, the heading follows, the valley slides sideways.
    state.roll += (controls.steer * 0.9 - state.roll) * dt * 3;
    state.heading += controls.steer * PLANE.turnRate * speedFactor * dt;
    state.x += Math.sin(state.heading) * state.speed * dt + controls.steer * PLANE.lateralSpeed * speedFactor * dt;
    state.z += Math.cos(state.heading) * state.speed * dt;
    const centre = centreXAt(state.z);
    state.x = clamp(state.x, centre - VALLEY_HALF, centre + VALLEY_HALF);

    // Fuel: full throttle drinks, idling sips; empty tanks mean a glide, not a crash.
    state.fuel -= (PLANE.idleBurn + state.throttle * PLANE.fuelBurn) * dt;
    if (state.fuel <= 0) {
      state.fuel = 0;
      state.throttle = 0;
      if (!state.fuelWarned) {
        state.fuelWarned = true;
        say('Fuel empty — gliding. Find the strip!', 3);
        events |= EVENT_FUEL;
      }
    } else {
      state.fuelWarned = false;
    }

    const ground = groundYAt(state.z);
    const seg = segmentAt(state.z);

    // Rings: crossing a ring's plane scores when the plane is inside it.
    for (const ring of state.rings) {
      if (!ring.passed && state.z >= ring.z) {
        ring.passed = true;
        const ringY = groundYAt(ring.z) + ring.alt;
        const dx = state.x - (centreXAt(ring.z) + ring.x);
        const dy = state.y - ringY;
        if (Math.sqrt(dx * dx + dy * dy) <= RING.radius) {
          ring.hit = true;
          state.ringsHit += 1;
          state.score += RING.points;
          say(`Ring ${state.ringsHit} of ${state.rings.length}! +${RING.points}`, 2);
          events |= EVENT_RING;
        } else {
          say('Missed a ring — keep flying, the strip is still ahead.', 2);
        }
      }
    }

    // Supply drop: over the hut's meadow, low and slow, press drop.
    const drop = state.mission.drop;
    if (drop && !state.dropped && controls.drop) {
      const dropZ = drop.seg * SEG_LEN;
      if (Math.abs(state.z - dropZ) < drop.halfWidth * SEG_LEN * 0.5 && state.y < ground + 70) {
        state.dropped = true;
        const accuracy = 1 - Math.min(1, Math.abs(state.x - centre) / 90);
        state.dropScore = Math.round(300 + 700 * accuracy);
        state.score += state.dropScore;
        say(`Crate away! ${accuracy > 0.7 ? 'Right on the meadow' : 'Close enough'} — +${state.dropScore}`, 3);
        events |= EVENT_DROP;
      } else {
        say('Too far from the hut meadow to drop — line up over the hut.', 2);
      }
    }

    // Trees and houses are solid: clip one and the airframe pays for it.
    for (const sprite of seg.sprites) {
      if ((sprite.type === 'tree' || sprite.type === 'house') && Math.abs(state.x - (centre + sprite.offset)) < 5 && state.y < ground + 13 * sprite.scale) {
        state.damage = Math.min(100, state.damage + 30);
        say(`Clipped a ${sprite.type}! Damage ${Math.round(state.damage)}%`, 2);
        state.y = ground + 14 * sprite.scale;
        state.speed *= 0.82;
        seg.sprites.splice(seg.sprites.indexOf(sprite), 1);
        break;
      }
    }

    // Ground: on the strip, slow and gentle, is a landing; anywhere else it is a crash.
    if (state.y <= ground + 1.2) {
      const onStrip = seg.ground === 'runway' && Math.abs(state.x - centre) <= RUNWAY.halfWidth;
      const gentle = state.speed <= RUNWAY.landingSpeed && state.verticalSpeed >= -RUNWAY.landingSink;
      if (onStrip && gentle) {
        state.y = ground + 1.2;
        state.landed = true;
        state.over = true;
        const fuelBonus = Math.round(state.fuel * 8);
        const ringBonus = state.ringsHit * 100;
        state.score += fuelBonus + ringBonus;
        say(`Down safe on the valley strip! Fuel bonus +${fuelBonus}, rings +${ringBonus}`, 4);
        events |= EVENT_LANDED | EVENT_OVER;
      } else {
        state.y = ground + 1.2;
        state.crashed = true;
        state.over = true;
        say(onStrip ? 'Too fast for the strip — the Kitehawk cartwheeled.' : 'Terrain! The Kitehawk is down in the valley.', 4);
        events |= EVENT_CRASH | EVENT_OVER;
      }
    }

    // Past the strip with no landing: the valley ends, the sortie ends.
    if (!state.over && state.z >= (SEGMENTS - 2) * SEG_LEN) {
      state.over = true;
      say('Out of valley — the sortie ends here.', 3);
      events |= EVENT_OVER;
    }
    return events;
  }

  return {
    state, segments, reset, step, segmentAt, groundYAt, centreXAt,
  };
}
