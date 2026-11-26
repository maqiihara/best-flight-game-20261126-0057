// Keyboard and mouse input. Keys steer the plane; the mouse steers it too (hold the
// pointer where you want to go, click to drop the cargo or confirm). Actions are
// consumed once, so a key press starts exactly one thing.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DROP = 4;
export const ACTION_MISSION = 8; // cycles the mission on the title screen

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'throttleUp',
  ArrowDown: 'down', KeyS: 'throttleDown',
  ShiftLeft: 'throttleUp', ShiftRight: 'throttleUp',
  ControlLeft: 'throttleDown', ControlRight: 'throttleDown',
  Space: 'confirm', Enter: 'confirm',
  KeyP: 'pause', Escape: 'pause',
  KeyM: 'mission',
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let pointerX = null;
  let pointerY = null;
  let pointerDown = false;

  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (!name) return;
    event.preventDefault();
    if (event.repeat) return;
    keys.add(name);
    if (name === 'confirm') actions |= ACTION_CONFIRM;
    else if (name === 'pause') actions |= ACTION_PAUSE;
    else if (name === 'mission') actions |= ACTION_MISSION;
  }
  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (name) keys.delete(name);
  }
  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width;
    pointerY = (event.clientY - rect.top) / rect.height;
  }
  function onPointerDown(event) {
    onPointerMove(event);
    pointerDown = true;
    actions |= ACTION_CONFIRM | ACTION_DROP;
  }
  function onPointerUp() {
    pointerDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);

  // -1..1 lateral steer: keys win, otherwise the pointer's offset from centre.
  function steer() {
    if (keys.has('left')) return -1;
    if (keys.has('right')) return 1;
    if (pointerX !== null) return Math.max(-1, Math.min(1, (pointerX - 0.5) * 2.4));
    return 0;
  }
  // -1..1 pitch: up climbs, down descends; keys win, otherwise the pointer.
  function pitch() {
    if (keys.has('up')) return 1;
    if (keys.has('down')) return -1;
    if (pointerY !== null) return Math.max(-1, Math.min(1, (0.42 - pointerY) * 2.2));
    return 0;
  }
  function throttleDelta() {
    let delta = 0;
    if (keys.has('throttleUp')) delta += 1;
    if (keys.has('throttleDown')) delta -= 1;
    return delta;
  }

  return {
    steer,
    pitch,
    throttleDelta,
    pointerDown: () => pointerDown,
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
