// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the valley. ?shot=cover|rings|landing|dusk (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, MISSIONS, STEP, EVENT_RING, EVENT_DROP, EVENT_LANDED, EVENT_CRASH } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_DROP, ACTION_MISSION, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas, world);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let missionIndex = 0;
  let accumulator = 0;
  let last = performance.now();
  let dropQueued = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.start();
    world.reset(missionIndex);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing ${world.state.mission.name}.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    audio.stop();
    announce(`Sortie over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_DROP) dropQueued = true;
    if (actions & ACTION_MISSION && screen === SCREEN_TITLE) {
      missionIndex = (missionIndex + 1) % MISSIONS.length;
      world.reset(missionIndex);
      announce(`${world.state.mission.name} selected.`);
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stop();
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      audio.start();
      announce('Playing.');
    }
  }

  function step() {
    const events = world.step(STEP, {
      steer: input.steer(),
      pitch: input.pitch(),
      throttleDelta: input.throttleDelta(),
      drop: dropQueued,
    });
    dropQueued = false;
    audio.engine(world.state.throttle, world.state.speed);
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_DROP) audio.drop();
    if (events & EVENT_LANDED) audio.land();
    if (events & EVENT_CRASH) audio.crash();
    if (world.state.over) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      // The title screen idles over a live valley: the world drifts forward slowly.
      world.step(STEP, { steer: 0, pitch: 0, throttleDelta: 0, drop: false });
      if (world.state.over) world.reset(missionIndex);
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stop();
      announce('Paused.');
    }
  });

  world.reset(missionIndex);
  announce('Kitehawk Ridge Run. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
