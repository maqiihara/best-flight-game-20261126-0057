// Procedural sound, made in the browser with WebAudio: an engine hum that follows
// the throttle, a chime for a ring, a little fanfare for a landing and a thud for a
// crash. No audio files, no network. Everything is guarded: no AudioContext, no sound.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      ctx = new AudioContextClass();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 70;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, when, duration, type = 'sine', volume = 0.16) {
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime + when);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + duration + 0.05);
    } catch {
      // Silence is fine.
    }
  }

  return {
    start() {
      if (started) return;
      started = true;
      if (!ensure()) return;
      try {
        if (ctx.state === 'suspended') void ctx.resume();
        engineGain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.3);
      } catch {
        // Silence is fine.
      }
    },
    engine(throttle, speed) {
      if (!ctx || !engineOsc) return;
      try {
        engineOsc.frequency.setTargetAtTime(55 + throttle * 55 + speed * 0.4, ctx.currentTime, 0.1);
        engineGain.gain.setTargetAtTime(0.03 + throttle * 0.05, ctx.currentTime, 0.1);
      } catch {
        // Silence is fine.
      }
    },
    ring() {
      if (!ctx) return;
      tone(880, 0, 0.35);
      tone(1318, 0.09, 0.4);
    },
    drop() {
      if (!ctx) return;
      tone(660, 0, 0.2);
      tone(990, 0.12, 0.3);
    },
    land() {
      if (!ctx) return;
      [523, 659, 784, 1046].forEach((freq, i) => tone(freq, i * 0.11, 0.35));
    },
    crash() {
      if (!ctx) return;
      try {
        const length = ctx.sampleRate * 0.4;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = 0.3;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start();
      } catch {
        // Silence is fine.
      }
    },
    stop() {
      if (!ctx || !engineGain) return;
      try {
        engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      } catch {
        // Silence is fine.
      }
    },
  };
}
