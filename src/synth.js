import { midiToFreq } from './music.js';

export const SR = 44100;
let rng = Math.random;

export function setRandom(fn) {
  rng = fn;
}

export function makeBuffer(seconds, sampleRate = SR) {
  return new Float32Array(Math.ceil(seconds * sampleRate));
}

export function addAt(buf, index, value) {
  if (index >= 0 && index < buf.length) buf[index] += value;
}

function saw(phase) {
  return 2 * (phase - Math.floor(phase + 0.5));
}

function noiseSample() {
  return rng() * 2 - 1;
}

export function addKick(buf, sr, time, gain = 1) {
  const start = Math.floor(time * sr);
  const dur = Math.floor(0.34 * sr);
  let phase = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / sr;
    const env = Math.exp(-t / 0.15);
    const freq = 44 + 96 * Math.exp(-t / 0.028);
    phase += (2 * Math.PI * freq) / sr;
    const click = noiseSample() * Math.exp(-t / 0.004) * 0.25;
    addAt(buf, start + i, (Math.sin(phase) * env + click) * 0.85 * gain);
  }
}

export function addSnare(buf, sr, time, gain = 1) {
  const start = Math.floor(time * sr);
  const dur = Math.floor(0.22 * sr);
  let prev = 0;
  let phase = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / sr;
    const n = noiseSample();
    const bright = n - prev * 0.55;
    prev = n;
    const env = Math.exp(-t / 0.09);
    phase += (2 * Math.PI * 184) / sr;
    const tone = Math.sin(phase) * Math.exp(-t / 0.05) * 0.35;
    addAt(buf, start + i, (bright * env * 0.6 + tone) * 0.75 * gain);
  }
}

export function addHat(buf, sr, time, open = false, gain = 1) {
  const start = Math.floor(time * sr);
  const dur = Math.floor((open ? 0.32 : 0.055) * sr);
  let prev = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / sr;
    const n = noiseSample();
    const bright = n - prev;
    prev = n;
    const env = Math.exp(-t / (open ? 0.18 : 0.022));
    addAt(buf, start + i, bright * env * (open ? 0.13 : 0.1) * gain);
  }
}

export function addClap(buf, sr, time, gain = 1) {
  const start = Math.floor(time * sr);
  const bursts = [0, 0.011, 0.023];
  for (const offset of bursts) {
    const o = Math.floor(offset * sr);
    const dur = Math.floor(0.09 * sr);
    let prev = 0;
    for (let i = 0; i < dur; i++) {
      const t = i / sr;
      const n = noiseSample();
      const band = n - prev * 0.4;
      prev = n;
      const env = Math.exp(-t / 0.035);
      addAt(buf, start + o + i, band * env * 0.3 * gain);
    }
  }
}

export function addCrash(buf, sr, time, gain = 1) {
  const start = Math.floor(time * sr);
  const dur = Math.floor(1.6 * sr);
  let prev = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / sr;
    const n = noiseSample();
    const bright = n - prev;
    prev = n;
    const env = Math.exp(-t / 0.7);
    addAt(buf, start + i, bright * env * 0.16 * gain);
  }
}

export function addTom(buf, sr, time, midi = 48, gain = 1) {
  const start = Math.floor(time * sr);
  const dur = Math.floor(0.3 * sr);
  const f0 = midiToFreq(midi);
  let phase = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / sr;
    const freq = f0 * (1 + 0.7 * Math.exp(-t / 0.05));
    phase += (2 * Math.PI * freq) / sr;
    const env = Math.exp(-t / 0.12);
    addAt(buf, start + i, Math.sin(phase) * env * 0.5 * gain);
  }
}

export function addBass(buf, sr, time, duration, midi, gain = 1, drive = 1.3) {
  const start = Math.floor(time * sr);
  const dur = Math.floor(Math.min(duration + 0.06, duration + 0.12) * sr);
  const freq = midiToFreq(midi);
  let phase = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / sr;
    const attack = Math.min(1, t / 0.008);
    const remain = duration - t;
    const release = remain < 0.05 ? Math.max(0, remain / 0.05) : 1;
    const env = attack * release * (0.75 + 0.25 * Math.exp(-t / 0.25));
    phase += (2 * Math.PI * freq) / sr;
    const wave = Math.sin(phase) + 0.22 * Math.sin(phase * 2) + 0.08 * Math.sin(phase * 3);
    addAt(buf, start + i, Math.tanh(wave * drive) * env * 0.22 * gain);
  }
}

export function addSub808(buf, sr, time, duration, midi, gain = 1, glide = false) {
  const start = Math.floor(time * sr);
  const dur = Math.floor((duration + 0.35) * sr);
  const freq = midiToFreq(midi);
  let phase = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / sr;
    const pitchEnv = glide ? 1 + 0.9 * Math.exp(-t / 0.04) : 1 + 0.25 * Math.exp(-t / 0.02);
    phase += (2 * Math.PI * freq * pitchEnv) / sr;
    const env = Math.exp(-t / Math.max(0.12, duration * 0.9));
    addAt(buf, start + i, Math.tanh(Math.sin(phase) * 1.7) * env * 0.3 * gain);
  }
}

export function addPad(buf, sr, time, duration, midis, gain = 1, options = {}) {
  const cutoff = options.cutoff || 1400;
  const attack = options.attack ?? 0.45;
  const release = options.release ?? 0.8;
  const detune = options.detune ?? 1.005;
  const start = Math.floor(time * sr);
  const dur = Math.floor((duration + release) * sr);
  const perNote = (0.06 * gain) / Math.max(2, midis.length * 0.6);
  for (const midi of midis) {
    const freq = midiToFreq(midi);
    let p1 = rng();
    let p2 = rng();
    let lp = 0;
    for (let i = 0; i < dur; i++) {
      const t = i / sr;
      const envAttack = Math.min(1, t / attack);
      const remain = duration - t;
      const envRelease = remain < release ? Math.max(0, remain / release) : 1;
      const env = envAttack * envRelease;
      if (env <= 0 && t > duration) break;
      p1 = (p1 + (freq / sr)) % 1;
      p2 = (p2 + (freq * detune / sr)) % 1;
      const lfo = 1 + 0.16 * Math.sin(2 * Math.PI * 0.09 * t + midi);
      const alpha = 1 - Math.exp((-2 * Math.PI * cutoff * lfo) / sr);
      lp += alpha * ((saw(p1) + saw(p2)) * 0.5 - lp);
      addAt(buf, start + i, lp * env * perNote);
    }
  }
}

export function addPiano(buf, sr, time, duration, midis, gain = 1, options = {}) {
  const decay = options.decay || 3.0;
  const start = Math.floor(time * sr);
  const ring = Math.min(duration + 0.5, 4);
  const dur = Math.floor(ring * sr);
  for (const midi of midis) {
    const freq = midiToFreq(midi);
    const perNote = (0.17 * gain) / Math.max(2, midis.length * 0.75);
    for (let i = 0; i < dur; i++) {
      const t = i / sr;
      const attack = Math.min(1, t / 0.004);
      const env = attack * Math.exp(-t / (1 / decay));
      if (env < 0.0004) break;
      const w = Math.sin(2 * Math.PI * freq * t)
        + 0.42 * Math.sin(2 * Math.PI * freq * 2 * t)
        + 0.18 * Math.sin(2 * Math.PI * freq * 3 * t)
        + 0.07 * Math.sin(2 * Math.PI * freq * 4.01 * t);
      addAt(buf, start + i, w * env * perNote);
    }
  }
}

export function addEPiano(buf, sr, time, duration, midis, gain = 1) {
  const start = Math.floor(time * sr);
  const ring = Math.min(duration + 0.8, 5);
  const dur = Math.floor(ring * sr);
  for (const midi of midis) {
    const freq = midiToFreq(midi);
    const perNote = (0.15 * gain) / Math.max(2, midis.length * 0.75);
    for (let i = 0; i < dur; i++) {
      const t = i / sr;
      const attack = Math.min(1, t / 0.006);
      const trem = 1 - 0.12 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 5.2 * t));
      const env = attack * Math.exp(-t / 1.1) * trem;
      if (env < 0.0004) break;
      const w = Math.sin(2 * Math.PI * freq * t)
        + 0.3 * Math.sin(2 * Math.PI * freq * 2 * t)
        + 0.12 * Math.sin(2 * Math.PI * freq * 3.98 * t);
      addAt(buf, start + i, w * env * perNote);
    }
  }
}

export function addStrings(buf, sr, time, duration, midis, gain = 1) {
  const start = Math.floor(time * sr);
  const release = 0.6;
  const dur = Math.floor((duration + release) * sr);
  for (const midi of midis) {
    const freq = midiToFreq(midi);
    let p1 = rng();
    let p2 = rng();
    let lp = 0;
    const perNote = (0.07 * gain) / Math.max(2, midis.length * 0.7);
    for (let i = 0; i < dur; i++) {
      const t = i / sr;
      const attack = Math.min(1, t / 0.2);
      const remain = duration - t;
      const rel = remain < release ? Math.max(0, remain / release) : 1;
      if (attack <= 0 || rel <= 0) continue;
      const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.1 * t);
      p1 = (p1 + (freq * vib / sr)) % 1;
      p2 = (p2 + (freq * 1.004 * vib / sr)) % 1;
      const alpha = 1 - Math.exp((-2 * Math.PI * 2300) / sr);
      lp += alpha * ((saw(p1) + saw(p2)) * 0.5 - lp);
      addAt(buf, start + i, lp * attack * rel * perNote);
    }
  }
}

export function addLead(buf, sr, time, duration, midi, gain = 1, options = {}) {
  const start = Math.floor(time * sr);
  const dur = Math.floor((duration + 0.12) * sr);
  const freq = midiToFreq(midi);
  let phase = 0;
  const brightness = options.brightness ?? 0.35;
  for (let i = 0; i < dur; i++) {
    const t = i / sr;
    const attack = Math.min(1, t / 0.012);
    const remain = duration - t;
    const rel = remain < 0.08 ? Math.max(0, remain / 0.08) : 1;
    const vib = 1 + 0.006 * Math.max(0, Math.sin(2 * Math.PI * 5.4 * t)) * Math.min(1, t / 0.25);
    phase += (2 * Math.PI * freq * vib) / sr;
    const tri = 2 * Math.abs(2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + 0.5))) - 1;
    const wave = tri * (1 - brightness) + saw((phase / (2 * Math.PI)) % 1) * brightness;
    addAt(buf, start + i, wave * attack * rel * 0.13 * gain);
  }
}

export function addVinyl(buf, sr, gain = 1) {
  let lp = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / sr;
    const n = noiseSample();
    const alpha = 1 - Math.exp((-2 * Math.PI * 1800) / sr);
    lp += alpha * (n - lp);
    let crackle = 0;
    if (rng() < 0.000045) crackle = (rng() * 2 - 1) * 0.35;
    addAt(buf, i, (lp * 0.018 + crackle) * gain);
  }
}

export function addRiser(buf, sr, time, duration, gain = 1) {
  const start = Math.floor(time * sr);
  const dur = Math.floor(duration * sr);
  let lp = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / sr;
    const progress = i / dur;
    const cutoff = 300 + 5200 * progress * progress;
    const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sr);
    const n = noiseSample() - lp * 0.2;
    lp += alpha * (n - lp);
    const env = Math.pow(progress, 2.2);
    addAt(buf, start + i, lp * env * 0.25 * gain);
  }
}

export function addImpact(buf, sr, time, gain = 1) {
  const start = Math.floor(time * sr);
  const dur = Math.floor(1.8 * sr);
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / sr;
    const env = Math.exp(-t / 0.55);
    const freq = 32 + 55 * Math.exp(-t / 0.12);
    phase += (2 * Math.PI * freq) / sr;
    const n = noiseSample();
    const alpha = 1 - Math.exp((-2 * Math.PI * 900) / sr);
    lp += alpha * (n - lp);
    addAt(buf, start + i, (Math.sin(phase) * 0.7 + lp * 0.25) * env * 0.45 * gain);
  }
}

export function addClick(buf, sr, time, midi = 84, gain = 1) {
  const start = Math.floor(time * sr);
  const dur = Math.floor(0.05 * sr);
  const freq = midiToFreq(midi);
  for (let i = 0; i < dur; i++) {
    const t = i / sr;
    const env = Math.exp(-t / 0.012);
    addAt(buf, start + i, Math.sin(2 * Math.PI * freq * t) * env * 0.12 * gain);
  }
}

export function addGuitar(buf, sr, time, duration, midis, gain = 1, drive = 2.2) {
  const start = Math.floor(time * sr);
  const dur = Math.floor((duration + 0.05) * sr);
  const perNote = (0.075 * gain) / Math.max(2, midis.length * 0.7);
  for (const midi of midis) {
    const freq = midiToFreq(midi);
    let p1 = rng();
    let p2 = rng();
    let lp = 0;
    for (let i = 0; i < dur; i++) {
      const t = i / sr;
      const attack = Math.min(1, t / 0.004);
      const remain = duration - t;
      const rel = remain < 0.05 ? Math.max(0, remain / 0.05) : 1;
      if (rel <= 0) break;
      p1 = (p1 + (freq / sr)) % 1;
      p2 = (p2 + (freq * 1.003 / sr)) % 1;
      const alpha = 1 - Math.exp((-2 * Math.PI * 3200) / sr);
      lp += alpha * ((saw(p1) + saw(p2)) * 0.5 - lp);
      const env = attack * rel * (0.75 + 0.25 * Math.exp(-t / 0.18));
      addAt(buf, start + i, Math.tanh(lp * drive) * env * perNote);
    }
  }
}
