const SOUND_DEFS = [
  { id: 'kick', label: 'Bombo', group: 'Batería', seconds: 0.4 },
  { id: 'snare', label: 'Caja', group: 'Batería', seconds: 0.25 },
  { id: 'hat', label: 'Hi-hat cerrado', group: 'Batería', seconds: 0.1 },
  { id: 'openhat', label: 'Hi-hat abierto', group: 'Batería', seconds: 0.4 },
  { id: 'clap', label: 'Palmas', group: 'Batería', seconds: 0.25 },
  { id: 'crash', label: 'Crash', group: 'Batería', seconds: 1.8 },
  { id: 'shaker', label: 'Shaker', group: 'Percusión', seconds: 0.16 },
  { id: '808', label: '808 (Do)', group: 'Bajos', seconds: 1.4 },
  { id: 'bass', label: 'Bajo (Do)', group: 'Bajos', seconds: 1 },
  { id: 'piano', label: 'Piano (Cmaj7)', group: 'Armonía', seconds: 3.2 },
  { id: 'pad', label: 'Pad (Am7)', group: 'Armonía', seconds: 5 },
  { id: 'pluck', label: 'Pluck (Do)', group: 'Melodía', seconds: 1 },
  { id: 'bell', label: 'Campana (Do)', group: 'Melodía', seconds: 2.4 },
  { id: 'vinyl', label: 'Vinilo', group: 'Efectos', seconds: 4 },
  { id: 'riser', label: 'Riser', group: 'Efectos', seconds: 2 },
  { id: 'impact', label: 'Impacto', group: 'Efectos', seconds: 2 }
];

export const SOUNDS = SOUND_DEFS;

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function noise() {
  return Math.random() * 2 - 1;
}

function dbToGain(db) {
  return Math.pow(10, db / 20);
}

function buffer(ctx, seconds) {
  return ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
}

function addNoiseBurst(buf, ctx, { decay, gain = 1, highpass = true, offset = 0 }) {
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  const start = Math.floor(offset * sr);
  let prev = 0;
  for (let i = 0; i < data.length - start; i++) {
    const t = i / sr;
    const n = noise();
    const bright = highpass ? n - prev : n;
    prev = n;
    const env = Math.exp(-t / decay);
    data[start + i] += bright * env * gain;
  }
}

function addSine(buf, ctx, { freq, start = 0, decay, gain = 1, pitchEnd = null, glide = 0.04, drive = 1 }) {
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  const startIdx = Math.floor(start * sr);
  let phase = 0;
  for (let i = startIdx; i < data.length; i++) {
    const t = (i - startIdx) / sr;
    const env = decay ? Math.exp(-t / decay) : 1;
    let f = freq;
    if (pitchEnd) {
      const k = Math.exp(-t / glide);
      f = pitchEnd + (freq - pitchEnd) * k;
    }
    phase += (2 * Math.PI * f) / sr;
    data[i] += Math.tanh(Math.sin(phase) * drive) * env * gain;
  }
}

function addSawChord(buf, ctx, { midis, seconds, attack = 0.4, release = 0.8, cutoff = 1600, gain = 0.5, detune = 1.005 }) {
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  const total = Math.floor(seconds * sr);
  for (const midi of midis) {
    const freq = midiToFreq(midi);
    let p1 = Math.random();
    let p2 = Math.random();
    let lp = 0;
    const per = gain / Math.max(2, midis.length);
    for (let i = 0; i < total; i++) {
      const t = i / sr;
      const env = Math.min(1, t / attack) * (t > seconds - release ? Math.max(0, (seconds - t) / release) : 1);
      p1 = (p1 + freq / sr) % 1;
      p2 = (p2 + (freq * detune) / sr) % 1;
      const raw = (2 * (p1 - Math.floor(p1 + 0.5)) + 2 * (p2 - Math.floor(p2 + 0.5))) * 0.5;
      const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sr);
      lp += alpha * (raw - lp);
      data[i] += lp * env * per;
    }
  }
}

function addPianoNotes(buf, ctx, midis, seconds = 3, gain = 0.5) {
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  const total = Math.floor(seconds * sr);
  for (const midi of midis) {
    const f = midiToFreq(midi);
    const per = gain / Math.max(1, midis.length);
    for (let i = 0; i < total; i++) {
      const t = i / sr;
      const attack = Math.min(1, t / 0.004);
      const env = attack * Math.exp(-t * 2.4);
      const w = Math.sin(2 * Math.PI * f * t)
        + 0.42 * Math.sin(2 * Math.PI * f * 2 * t)
        + 0.16 * Math.sin(2 * Math.PI * f * 3 * t);
      data[i] += w * env * per;
    }
  }
}

export function makeSound(id, ctx) {
  const def = SOUND_DEFS.find((s) => s.id === id) || SOUND_DEFS[0];
  const buf = buffer(ctx, def.seconds);
  const data = buf.getChannelData(0);
  switch (id) {
    case 'kick':
      addSine(buf, ctx, { freq: 150, pitchEnd: 44, decay: 0.16, gain: 0.95, glide: 0.03, drive: 1.2 });
      addNoiseBurst(buf, ctx, { decay: 0.004, gain: 0.25, highpass: false });
      buf.getChannelData(0).forEach((v, i) => { data[i] = Math.tanh(v * 1.2); });
      break;
    case 'snare':
      addNoiseBurst(buf, ctx, { decay: 0.09, gain: 0.6 });
      addSine(buf, ctx, { freq: 185, decay: 0.05, gain: 0.35 });
      break;
    case 'hat':
      addNoiseBurst(buf, ctx, { decay: 0.022, gain: 0.7 });
      break;
    case 'openhat':
      addNoiseBurst(buf, ctx, { decay: 0.18, gain: 0.55 });
      break;
    case 'clap':
      [0, 0.011, 0.023].forEach((offset, i) => {
        const temp = buffer(ctx, 0.12);
        addNoiseBurst(temp, ctx, { decay: 0.035, gain: 0.55 });
        const src = temp.getChannelData(0);
        const start = Math.floor(offset * ctx.sampleRate);
        for (let j = 0; j < src.length && start + j < data.length; j++) data[start + j] += src[j] * (i === 2 ? 1 : 0.8);
      });
      break;
    case 'crash':
      addNoiseBurst(buf, ctx, { decay: 0.7, gain: 0.5 });
      break;
    case 'shaker':
      addNoiseBurst(buf, ctx, { decay: 0.05, gain: 0.4 });
      break;
    case '808':
      addSine(buf, ctx, { freq: midiToFreq(36), pitchEnd: midiToFreq(36), decay: 0.6, gain: 0.75, glide: 0.04, drive: 2 });
      break;
    case 'bass':
      addSine(buf, ctx, { freq: midiToFreq(36), decay: 0.5, gain: 0.5, drive: 1.4 });
      addSine(buf, ctx, { freq: midiToFreq(36) * 2, decay: 0.4, gain: 0.14 });
      break;
    case 'piano':
      addPianoNotes(buf, ctx, [60, 64, 67, 71], def.seconds, 0.6);
      break;
    case 'pad':
      addSawChord(buf, ctx, { midis: [57, 60, 64, 67], seconds: def.seconds, attack: 0.6, release: 1.2, cutoff: 1300, gain: 0.45 });
      break;
    case 'pluck':
      addPianoNotes(buf, ctx, [72], 1, 0.55);
      break;
    case 'bell':
      addSine(buf, ctx, { freq: midiToFreq(72), decay: 1.1, gain: 0.3 });
      addSine(buf, ctx, { freq: midiToFreq(76), decay: 0.9, gain: 0.2 });
      addSine(buf, ctx, { freq: midiToFreq(79), decay: 0.7, gain: 0.12 });
      break;
    case 'vinyl':
      for (let i = 0; i < data.length; i++) {
        data[i] = noise() * 0.02;
        if (Math.random() < 0.00005) data[i] += (Math.random() * 2 - 1) * 0.4;
      }
      break;
    case 'riser': {
      const sr = ctx.sampleRate;
      let lp = 0;
      for (let i = 0; i < data.length; i++) {
        const p = i / data.length;
        const cutoff = 300 + 5200 * p * p;
        const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sr);
        lp += alpha * (noise() - lp);
        data[i] = lp * Math.pow(p, 2.2) * 0.5;
      }
      break;
    }
    case 'impact':
      addSine(buf, ctx, { freq: 85, pitchEnd: 32, decay: 0.55, gain: 0.7, glide: 0.14, drive: 1.3 });
      addNoiseBurst(buf, ctx, { decay: 0.4, gain: 0.15, highpass: false });
      break;
    default:
      addPianoNotes(buf, ctx, [60], 1, 0.4);
  }
  return buf;
}
