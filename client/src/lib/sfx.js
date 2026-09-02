// Synthesised sound palette for the game. Ported verbatim from sfx-preview.html
// — same Web Audio recipes, wrapped so any component can call playSfx(name).
//
// The AudioContext starts suspended until the browser sees a user gesture, so
// we lazily create + resume it on the first pointer/key/touch event anywhere.
// Calls made before that unlock are silently dropped.

const STORAGE_KEY = "judgement-sfx";

let context = null;
let master = null;
let noiseBuffer = null;
let unlocked = false;

const lastPlayedAt = new Map();

function loadPrefs() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: parsed.enabled !== false,
        volume: typeof parsed.volume === "number" ? parsed.volume : 0.35
      };
    }
  } catch {
    // ignore corrupt / unavailable storage
  }
  return { enabled: true, volume: 0.35 };
}

const prefs = typeof window === "undefined" ? { enabled: true, volume: 0.35 } : loadPrefs();

function savePrefs() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function applyGain() {
  if (master) {
    master.gain.value = prefs.enabled ? prefs.volume : 0;
  }
}

export function isSfxEnabled() {
  return prefs.enabled;
}

export function getSfxVolume() {
  return prefs.volume;
}

export function setSfxEnabled(on) {
  prefs.enabled = Boolean(on);
  savePrefs();
  if (prefs.enabled) {
    ensureAudio();
  }
  applyGain();
}

export function setSfxVolume(value) {
  prefs.volume = Math.max(0, Math.min(1, Number(value) || 0));
  savePrefs();
  applyGain();
}

function createNoiseBuffer() {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function ensureAudio() {
  if (typeof window === "undefined") {
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    return;
  }
  if (!context) {
    context = new Ctx();
    master = context.createGain();
    applyGain();
    master.connect(context.destination);
    noiseBuffer = createNoiseBuffer();
  }
  if (context.state === "suspended") {
    context.resume();
  }
}

function unlock() {
  if (unlocked) {
    return;
  }
  unlocked = true;
  ensureAudio();
  window.removeEventListener("pointerdown", unlock);
  window.removeEventListener("keydown", unlock);
  window.removeEventListener("touchstart", unlock);
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  window.addEventListener("touchstart", unlock);
}

function tone(frequency, start, duration, type = "sine", gain = 0.16) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope).connect(master);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noise(start, duration, gain = 0.1, filterType = "bandpass", frequency = 1800, q = 0.8) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();
  source.buffer = noiseBuffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, start);
  filter.Q.value = q;
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(envelope).connect(master);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function sweep(from, to, start, duration, gain = 0.08) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope).connect(master);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

const RECIPES = {
  card(now) {
    noise(now, 0.055, 0.2, "highpass", 2400, 0.4);
    noise(now + 0.045, 0.12, 0.11, "lowpass", 900, 0.5);
    tone(125, now + 0.04, 0.09, "triangle", 0.12);
  },
  hover(now) {
    noise(now, 0.025, 0.035, "bandpass", 3200, 1.2);
  },
  select(now) {
    noise(now, 0.045, 0.08, "bandpass", 1800, 0.7);
    tone(240, now + 0.03, 0.12, "triangle", 0.1);
    tone(360, now + 0.08, 0.16, "sine", 0.07);
  },
  bid(now) {
    noise(now, 0.025, 0.13, "bandpass", 1100, 2);
    tone(392, now + 0.025, 0.12, "triangle", 0.1);
    tone(587, now + 0.1, 0.2, "sine", 0.08);
  },
  start(now) {
    noise(now, 0.04, 0.08, "lowpass", 700, 0.8);
    tone(262, now + 0.04, 0.18, "triangle", 0.11);
    tone(392, now + 0.16, 0.3, "sine", 0.1);
  },
  deal(now) {
    for (let index = 0; index < 4; index += 1) {
      const start = now + index * 0.11;
      noise(start, 0.07, 0.1, "bandpass", 1900 + index * 180, 0.45);
      tone(110 + index * 12, start + 0.04, 0.09, "triangle", 0.07);
    }
  },
  seat(now) {
    noise(now, 0.035, 0.1, "lowpass", 500, 0.7);
    tone(196, now + 0.03, 0.14, "triangle", 0.1);
    tone(294, now + 0.12, 0.22, "sine", 0.08);
  },
  invalid(now) {
    noise(now, 0.025, 0.06, "lowpass", 420, 1.2);
    tone(110, now + 0.015, 0.16, "triangle", 0.09);
  },
  trick(now) {
    noise(now, 0.14, 0.1, "bandpass", 1250, 0.5);
    tone(196, now + 0.05, 0.22, "triangle", 0.12);
    tone(294, now + 0.16, 0.3, "sine", 0.1);
    tone(587, now + 0.27, 0.2, "sine", 0.06);
  },
  round(now) {
    noise(now, 0.04, 0.08, "lowpass", 650, 0.8);
    tone(330, now + 0.04, 0.18, "triangle", 0.1);
    tone(494, now + 0.15, 0.2, "sine", 0.1);
    tone(740, now + 0.27, 0.36, "sine", 0.08);
  },
  timer(now) {
    noise(now, 0.02, 0.06, "bandpass", 1600, 2);
    tone(660, now + 0.01, 0.07, "triangle", 0.06);
    noise(now + 0.17, 0.02, 0.06, "bandpass", 1600, 2);
    tone(660, now + 0.18, 0.07, "triangle", 0.06);
  },
  pause(now) {
    sweep(300, 170, now, 0.2, 0.08);
    noise(now, 0.03, 0.05, "lowpass", 500, 0.8);
  },
  game(now) {
    noise(now, 0.045, 0.07, "lowpass", 650, 0.8);
    tone(392, now + 0.04, 0.2, "sine", 0.09);
    tone(330, now + 0.2, 0.22, "sine", 0.08);
    tone(262, now + 0.38, 0.42, "triangle", 0.1);
  }
};

/**
 * Play one of the palette sounds by name. No-op when muted, before the audio
 * context is unlocked, or when the same sound fired within the last 50 ms
 * (guards against React double-invokes / duplicate state updates).
 */
export function playSfx(name) {
  if (!prefs.enabled || !RECIPES[name]) {
    return;
  }
  ensureAudio();
  if (!context || context.state !== "running") {
    return;
  }
  const stamp = context.currentTime;
  if (stamp - (lastPlayedAt.get(name) ?? -1) < 0.05) {
    return;
  }
  lastPlayedAt.set(name, stamp);
  RECIPES[name](stamp + 0.01);
}
