import {
  SR, makeBuffer, setRandom, addKick, addSnare, addHat, addClap, addCrash,
  addTom, addBass, addSub808, addPad, addPiano, addEPiano, addStrings,
  addLead, addVinyl, addRiser, addImpact, addGuitar, addClick
} from './synth.js';
import {
  parseKey, getProgression, progressionLabels, progressionRomans,
  progressionChords, scaleMidis, midiToName, mulberry32, suggestTempo,
  detectFromPrompt, normalizePc, NOTE_NAMES
} from './music.js';

const GENRES = {
  lofi: {
    label: 'Lo-fi / Chill', bpm: 78, swing: 0.16, mood: 'relajado', mode: 'minor',
    drums: 'boombap', bass: 'sub', harmony: 'rhodes', lead: 'piano',
    vinyl: true, melodyRegister: 71, rest: 0.12
  },
  pop: {
    label: 'Pop', bpm: 108, swing: 0, mood: 'alegre', mode: 'major',
    drums: 'pop', bass: 'pop', harmony: 'piano', lead: 'lead',
    vinyl: false, melodyRegister: 74, rest: 0.04
  },
  electronic: {
    label: 'Electronica / EDM', bpm: 124, swing: 0, mood: 'energetico', mode: 'minor',
    drums: 'four', bass: 'octave', harmony: 'pad', lead: 'lead',
    vinyl: false, melodyRegister: 76, rest: 0.02
  },
  cinematic: {
    label: 'Cinematica / Epica', bpm: 72, swing: 0, mood: 'epico', mode: 'minor',
    drums: 'cinematic', bass: 'drone', harmony: 'strings', lead: 'strings',
    vinyl: false, melodyRegister: 67, rest: 0.28
  },
  trap: {
    label: 'Trap / Urbano', bpm: 72, swing: 0, mood: 'misterioso', mode: 'minor',
    drums: 'trap', bass: '808', harmony: 'pad-dark', lead: 'piano',
    vinyl: false, melodyRegister: 72, rest: 0.18
  },
  rock: {
    label: 'Rock / Banda', bpm: 120, swing: 0, mood: 'energetico', mode: 'minor',
    drums: 'rock', bass: 'octave', harmony: 'power', lead: 'lead',
    vinyl: false, melodyRegister: 74, rest: 0.04
  },
  metalcore: {
    label: 'Metalcore / Post-hardcore', bpm: 145, swing: 0, mood: 'energetico', mode: 'minor',
    drums: 'metalcore', bass: 'metalcore', harmony: 'metalcore', lead: 'guitar',
    vinyl: false, melodyRegister: 68, rest: 0.34
  },
  acustico: {
    label: 'Acustico / Balada', bpm: 92, swing: 0, mood: 'romantico', mode: 'major',
    drums: 'soft', bass: 'pop', harmony: 'piano', lead: 'piano',
    vinyl: false, melodyRegister: 72, rest: 0.1
  },
  jazz: {
    label: 'Jazz / Neo-soul', bpm: 96, swing: 0.2, mood: 'relajado', mode: 'major',
    drums: 'jazz', bass: 'walk', harmony: 'rhodes', lead: 'rhodes',
    vinyl: false, melodyRegister: 72, rest: 0.1
  }
};

const SECTION_META = {
  intro: { label: 'Intro', energy: 0.32 },
  verso: { label: 'Verso', energy: 0.58 },
  verso2: { label: 'Verso 2', energy: 0.7 },
  coro: { label: 'Coro', energy: 0.94 },
  coro2: { label: 'Coro final', energy: 1 },
  puente: { label: 'Puente', energy: 0.42 },
  outro: { label: 'Outro', energy: 0.26 }
};

const FORMS = [
  ['intro', 4, 'verso', 4, 'coro', 4, 'outro', 4],
  ['intro', 4, 'verso', 6, 'coro', 6, 'verso2', 4, 'coro2', 4],
  ['intro', 4, 'verso', 8, 'coro', 8, 'verso2', 4, 'coro2', 8],
  ['intro', 4, 'verso', 8, 'coro', 8, 'verso2', 8, 'coro2', 8, 'outro', 4],
  ['intro', 4, 'verso', 8, 'coro', 8, 'verso2', 8, 'coro2', 8, 'puente', 4, 'coro2', 8],
  ['intro', 8, 'verso', 8, 'coro', 8, 'verso2', 8, 'coro2', 8, 'puente', 8, 'coro2', 8, 'outro', 8]
];

const RHYTHMS = {
  lofi: [[0, 3], [4, 3], [8, 2], [10, 2], [12, 4]],
  pop: [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]],
  electronic: [[0, 1], [2, 1], [4, 2], [8, 1], [10, 1], [12, 4]],
  cinematic: [[0, 8], [8, 8]],
  trap: [[0, 2], [3, 1], [4, 1], [6, 2], [8, 4], [12, 4]],
  rock: [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 4]],
  metalcore: [[0, 2], [3, 1], [6, 2], [8, 2], [11, 1], [14, 2]],
  acustico: [[0, 4], [4, 2], [6, 2], [8, 4], [12, 4]],
  jazz: [[0, 2], [3, 1], [4, 3], [8, 2], [10, 2], [12, 4]]
};

const KEY_CHOICES = {
  major: ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'],
  minor: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'C#', 'F#']
};

export const GENRE_LIST = Object.entries(GENRES).map(([id, g]) => ({
  id, label: g.label, bpm: g.bpm, mood: g.mood
}));

function nearestIndex(values, target) {
  let best = 0;
  let dist = Infinity;
  for (let i = 0; i < values.length; i++) {
    const d = Math.abs(values[i] - target);
    if (d < dist) { dist = d; best = i; }
  }
  return best;
}

function buildForm(targetBars) {
  let best = FORMS[0];
  let bestBars = 0;
  let bestDiff = Infinity;
  for (const template of FORMS) {
    let total = 0;
    for (let i = 1; i < template.length; i += 2) total += template[i];
    const diff = Math.abs(total - targetBars);
    if (diff < bestDiff) { bestDiff = diff; best = template; bestBars = total; }
  }
  const sections = [];
  let start = 0;
  for (let i = 0; i < best.length; i += 2) {
    const name = best[i];
    const bars = best[i + 1];
    sections.push({
      name,
      label: SECTION_META[name].label,
      energy: SECTION_META[name].energy,
      startBar: start,
      bars,
      index: sections.length
    });
    start += bars;
  }
  return { sections, bars: bestBars };
}

function makeMotif(rng, scale, rhythm, centerIdx) {
  let idx = centerIdx;
  const notes = [];
  rhythm.forEach(([step, len], i) => {
    let move = 0;
    const r = rng();
    if (i === 0) move = 0;
    else if (i === rhythm.length - 1) move = rng() < 0.5 ? -1 : 1;
    else if (r < 0.42) move = 0;
    else if (r < 0.72) move = rng() < 0.5 ? 1 : -1;
    else if (r < 0.9) move = rng() < 0.5 ? 2 : -2;
    else move = rng() < 0.5 ? 3 : -3;
    idx = Math.max(2, Math.min(scale.length - 3, idx + move));
    notes.push({ step, len, midi: scale[idx] });
  });
  return notes;
}

function varyMotif(motif, rng) {
  return motif.map((n) => {
    let midi = n.midi;
    let step = n.step;
    if (rng() < 0.16) midi += rng() < 0.5 ? 2 : -2;
    if (rng() < 0.07) step = Math.max(0, step + (rng() < 0.5 ? 1 : -1));
    return { ...n, midi, step };
  });
}

function buildMelodyNotes({ bars, scale, rng, rhythm, center, shift, restProb, chordAtBar }) {
  const notes = [];
  const blocks = Math.ceil(bars / 2);
  const base = makeMotif(rng, scale, rhythm, nearestIndex(scale, center));
  for (let b = 0; b < blocks; b++) {
    for (let rep = 0; rep < 2; rep++) {
      const motif = rep === 0 ? (b === 0 ? base : varyMotif(base, rng)) : varyMotif(base, rng);
      for (const n of motif) {
        const step = b * 32 + rep * 16 + n.step;
        if (step >= bars * 16) continue;
        if (rng() < restProb && n.step !== 0) continue;
        let midi = n.midi + shift;
        if (rep === 1 && rng() < 0.3) midi += rng() < 0.5 ? 2 : -2;
        midi = Math.max(60, Math.min(88, midi));
        notes.push({ step, len: n.len, midi });
      }
    }
  }
  notes.sort((a, b) => a.step - b.step);
  const lastByBar = new Map();
  for (const n of notes) {
    const bar = Math.floor(n.step / 16);
    const prev = lastByBar.get(bar);
    if (!prev || n.step >= prev.step) lastByBar.set(bar, n);
  }
  for (const [bar, note] of lastByBar.entries()) {
    if (bar % 2 !== 1) continue;
    const chord = chordAtBar(bar);
    let bestMidi = note.midi;
    let bestDist = Infinity;
    for (const midi of chord) {
      for (const octave of [-12, 0, 12]) {
        const candidate = midi + octave;
        const d = Math.abs(candidate - note.midi);
        if (d < bestDist && candidate >= 60 && candidate <= 88) {
          bestDist = d;
          bestMidi = candidate;
        }
      }
    }
    note.midi = bestMidi;
  }
  return notes;
}

function swingOffset(step, swing, stepSec) {
  if (!swing) return 0;
  if (step % 2 === 1) return swing * stepSec * 0.5;
  return 0;
}

function humanize(rng, amount = 0.006) {
  return (rng() * 2 - 1) * amount;
}

function renderDrums({ buf, section, barStartSec, barSec, stepSec, genre, cfg, rng, sectionGain, isFirstBar, isLastBar, totalBars }) {
  const pattern = cfg.drums;
  const barIndex = section.startBar;
  const groove = (step) => barStartSec + step * stepSec + (pattern === 'jazz' || pattern === 'boombap' ? swingOffset(step, cfg.swing, stepSec) : 0);
  const add = (time, gain) => {
    if (sectionGain <= 0.001) return;
    const t = time + humanize(rng, 0.004);
    if (t >= 0) addKick(buf, SR, t, gain * sectionGain);
  };

  if (pattern === 'boombap') {
    add(groove(0), 0.95);
    add(groove(10), 0.8);
    if (barIndex % 2 === 1) add(groove(6), 0.55);
    for (const step of [4, 12]) addSnare(buf, SR, groove(step) + humanize(rng, 0.005), sectionGain * 0.8);
    if (section.name.includes('coro')) addClap(buf, SR, groove(12), sectionGain * 0.4);
    for (let step = 0; step < 16; step += 2) {
      const open = step === 14;
      addHat(buf, SR, groove(step) + humanize(rng, 0.004), open, sectionGain * (open ? 0.8 : step % 4 === 0 ? 0.9 : 0.55));
    }
    if (isLastBar) {
      addSnare(buf, SR, groove(14), sectionGain * 0.35);
      addSnare(buf, SR, groove(15), sectionGain * 0.45);
    }
  } else if (pattern === 'pop') {
    add(groove(0), 0.95);
    add(groove(8), 0.85);
    if (barIndex % 2 === 1) add(groove(10), 0.6);
    for (const step of [4, 12]) addSnare(buf, SR, groove(step), sectionGain * 0.85);
    for (let step = 0; step < 16; step += 2) {
      addHat(buf, SR, groove(step), step === 14, sectionGain * (step % 4 === 0 ? 0.85 : 0.5));
    }
    if (section.name.includes('coro') && isFirstBar) addCrash(buf, SR, groove(0), sectionGain * 0.7);
    if (isLastBar) {
      addTom(buf, SR, groove(13), 50, sectionGain * 0.6);
      addTom(buf, SR, groove(14), 45, sectionGain * 0.7);
      addTom(buf, SR, groove(15), 40, sectionGain * 0.8);
    }
  } else if (pattern === 'four') {
    for (const step of [0, 4, 8, 12]) add(groove(step), 1);
    for (const step of [4, 12]) addClap(buf, SR, groove(step), sectionGain * 0.75);
    for (let step = 2; step < 16; step += 4) {
      addHat(buf, SR, groove(step), true, sectionGain * 0.65);
    }
    for (let step = 0; step < 16; step += 2) {
      addHat(buf, SR, groove(step), false, sectionGain * 0.28);
    }
    if (isFirstBar) addCrash(buf, SR, groove(0), sectionGain * 0.8);
  } else if (pattern === 'trap') {
    add(groove(0), 1);
    add(groove(7), 0.75);
    if (barIndex % 2 === 0) add(groove(10), 0.7);
    addSnare(buf, SR, groove(8), sectionGain * 0.9);
    addClap(buf, SR, groove(8), sectionGain * 0.4);
    for (let step = 0; step < 16; step++) {
      const roll = isLastBar && step >= 14;
      addHat(buf, SR, groove(step) + (roll ? humanize(rng, 0.002) : 0), step % 8 === 0, sectionGain * (step % 4 === 0 ? 0.5 : step % 2 === 0 ? 0.35 : 0.25));
    }
    if (isFirstBar) addCrash(buf, SR, groove(0), sectionGain * 0.5);
  } else if (pattern === 'rock') {
    add(groove(0), 1);
    add(groove(6), 0.7);
    add(groove(8), 0.9);
    if (barIndex % 2 === 1) add(groove(14), 0.6);
    for (const step of [4, 12]) addSnare(buf, SR, groove(step), sectionGain * 0.95);
    for (let step = 0; step < 16; step += 2) {
      addHat(buf, SR, groove(step), false, sectionGain * (step % 4 === 0 ? 0.7 : 0.45));
    }
    if (isFirstBar) addCrash(buf, SR, groove(0), sectionGain * 0.8);
    if (isLastBar) {
      addTom(buf, SR, groove(12), 52, sectionGain * 0.7);
      addTom(buf, SR, groove(13), 47, sectionGain * 0.8);
      addTom(buf, SR, groove(14), 42, sectionGain * 0.85);
      addTom(buf, SR, groove(15), 38, sectionGain * 0.9);
    }
  } else if (pattern === 'metalcore') {
    const breakdown = section.name === 'puente';
    const chorus = section.name.includes('coro');
    const kickSteps = breakdown ? [0, 7, 8, 14] :
      chorus ? [0, 3, 4, 7, 8, 11, 12, 15] : [0, 4, 6, 8, 12, 14];
    for (const step of kickSteps) add(groove(step), step % 4 === 0 ? 1 : 0.78);
    for (const step of (breakdown || !chorus ? [8] : [4, 12])) {
      addSnare(buf, SR, groove(step), sectionGain * (breakdown ? 1 : 0.96));
    }
    for (let step = 0; step < 16; step += 2) {
      const open = chorus && step === 14;
      addHat(buf, SR, groove(step), open, sectionGain * (step % 4 === 0 ? 0.62 : 0.4));
    }
    if (isFirstBar) addCrash(buf, SR, groove(0), sectionGain * 0.9);
    if (isLastBar) {
      for (const [step, pitch] of [[11, 52], [13, 47], [14, 42], [15, 38]]) {
        addTom(buf, SR, groove(step), pitch, sectionGain * 0.76);
      }
    }
  } else if (pattern === 'cinematic') {
    add(groove(0), section.name === 'intro' ? 0.5 : 0.9);
    if (section.name.includes('coro') || section.name === 'puente') {
      add(groove(8), 0.55);
      addTom(buf, SR, groove(14), 40, sectionGain * 0.5);
    }
    if (isFirstBar) addImpact(buf, SR, barStartSec, sectionGain * 0.55);
  } else if (pattern === 'soft') {
    add(groove(0), 0.6);
    add(groove(8), 0.5);
    for (const step of [4, 12]) addSnare(buf, SR, groove(step), sectionGain * 0.3);
    for (let step = 0; step < 16; step += 2) {
      addHat(buf, SR, groove(step), false, sectionGain * 0.25);
    }
    if (isLastBar) addClick(buf, SR, barStartSec + 15 * stepSec, 84, sectionGain * 0.3);
  } else if (pattern === 'jazz') {
    add(groove(0), 0.35);
    add(groove(8), 0.3);
    for (let step = 0; step < 16; step += 2) {
      const accent = step === 0 || step === 8;
      addHat(buf, SR, groove(step), false, sectionGain * (accent ? 0.5 : 0.3));
    }
    for (const step of [6, 14]) addSnare(buf, SR, groove(step), sectionGain * 0.18);
  }

}

function renderHarmony({ buf, section, barStartSec, barSec, stepSec, chord, genre, cfg, sectionGain, isFirstBar }) {
  if (sectionGain <= 0.001) return;
  const root = chord[0];
  const dur = barSec * 0.98;
  if (cfg.harmony === 'rhodes') {
    addEPiano(buf, SR, barStartSec, dur * 0.9, chord, sectionGain);
    addEPiano(buf, SR, barStartSec + barSec * 0.62, barSec * 0.34, chord.slice(1).concat([chord[0] + 12]), sectionGain * 0.55);
  } else if (cfg.harmony === 'piano') {
    addPiano(buf, SR, barStartSec, barSec * 0.55, chord, sectionGain);
    addPiano(buf, SR, barStartSec + barSec * 0.625, barSec * 0.3, chord, sectionGain * 0.55);
    if (section.name.includes('coro')) {
      addPiano(buf, SR, barStartSec + barSec * 0.75, barSec * 0.25, chord.map((m) => m + 12), sectionGain * 0.4);
    }
  } else if (cfg.harmony === 'strings') {
    addStrings(buf, SR, barStartSec, dur, chord, sectionGain);
    addStrings(buf, SR, barStartSec, dur, [root - 12, root - 5], sectionGain * 0.8);
  } else if (cfg.harmony === 'pad' || cfg.harmony === 'pad-dark') {
    const dark = cfg.harmony === 'pad-dark';
    addPad(buf, SR, barStartSec, dur, chord, sectionGain, { cutoff: dark ? 780 : 1900, attack: dark ? 0.25 : 0.35 });
    if (section.name.includes('coro') || section.name === 'puente') {
      const arpChord = chord.map((m) => m + 12);
      const sixteenth = stepSec;
      for (let step = 0; step < 16; step++) {
        if (step % 2 === 1) continue;
        const note = arpChord[step % arpChord.length];
        addPiano(buf, SR, barStartSec + step * sixteenth, sixteenth * 1.6, [note], sectionGain * 0.35);
      }
    }
  } else if (cfg.harmony === 'metalcore') {
    const lowRoot = root - 12;
    const breakdown = section.name === 'puente';
    const chorus = section.name.includes('coro');
    const riff = breakdown
      ? [[0, 0, 3], [6, 0, 1], [8, 0, 3], [12, 7, 2]]
      : chorus
        ? [[0, 0, 2], [2, 0, 2], [4, 7, 2], [6, 0, 2], [8, 0, 2], [10, 7, 2], [12, 0, 2], [14, 0, 2]]
        : [[0, 0, 2], [3, 0, 1], [4, 0, 2], [7, 7, 1], [8, 0, 2], [11, 0, 1], [12, 7, 2], [15, 0, 1]];
    for (const [step, interval, length] of riff) {
      const note = lowRoot + interval;
      addGuitar(
        buf, SR, barStartSec + step * stepSec, length * stepSec,
        [note, note + 7, note + 12], sectionGain * (chorus ? 1 : 0.82), 3.2
      );
    }
  } else if (cfg.harmony === 'power') {
    const power = [root - 12, root - 5, root, root + 7];
    if (section.name.includes('coro')) {
      for (let step = 0; step < 16; step += 2) {
        addGuitar(buf, SR, barStartSec + step * stepSec, stepSec * 1.6, power, sectionGain * 0.8);
      }
    } else {
      for (const step of [0, 6, 8]) {
        addGuitar(buf, SR, barStartSec + step * stepSec, stepSec * 4, power, sectionGain * 0.8);
      }
    }
    if (isFirstBar && section.name.includes('coro')) addGuitar(buf, SR, barStartSec, barSec * 0.9, power.concat([root + 12]), sectionGain);
  }
}

function renderBass({ buf, section, barStartSec, barSec, stepSec, chord, cfg, sectionGain, rng }) {
  if (sectionGain <= 0.001) return;
  const root = chord[0] - 12;
  const fifth = chord[0] - 12 + 7;
  const third = chord[0] - 12 + (chord[1] - chord[0]);
  const addB = (time, dur, midi, gain, glide = false) => {
    const t = Math.max(0, time + (cfg.bass === '808' ? 0 : -0.006) + humanize(rng, 0.003));
    if (cfg.bass === '808') addSub808(buf, SR, t, dur, midi, sectionGain * gain, glide);
    else addBass(buf, SR, t, dur, midi, sectionGain * gain);
  };

  if (cfg.bass === 'sub') {
    addB(barStartSec, barSec * 0.92, root, 1);
    addB(barStartSec + barSec * 0.75, barSec * 0.2, root, 0.6);
  } else if (cfg.bass === 'pop') {
    addB(barStartSec, barSec * 0.45, root, 1);
    addB(barStartSec + barSec * 0.5, barSec * 0.3, root, 0.8);
    addB(barStartSec + barSec * 0.75, barSec * 0.2, fifth, 0.6);
  } else if (cfg.bass === 'metalcore') {
    const breakdown = section.name === 'puente';
    const chorus = section.name.includes('coro');
    const riff = breakdown
      ? [[0, root, 3], [8, root, 3], [12, fifth, 2]]
      : chorus
        ? [[0, root, 2], [2, root, 2], [4, fifth, 2], [6, root, 2], [8, root, 2], [10, fifth, 2], [12, root, 2], [14, root, 2]]
        : [[0, root, 2], [3, root, 1], [4, root, 2], [7, fifth, 1], [8, root, 2], [11, root, 1], [12, fifth, 2], [15, root, 1]];
    for (const [step, midi, length] of riff) {
      addB(barStartSec + step * stepSec, length * stepSec, midi, step % 4 === 0 ? 0.95 : 0.72);
    }
  } else if (cfg.bass === 'octave') {
    for (let step = 0; step < 16; step += 2) {
      const midi = step % 8 === 6 ? root + 12 : step % 8 === 4 ? fifth : root;
      addB(barStartSec + step * stepSec, stepSec * 1.5, midi, step % 4 === 0 ? 0.95 : 0.65);
    }
  } else if (cfg.bass === 'drone') {
    addB(barStartSec, barSec * 0.98, root, 1.1);
    addB(barStartSec, barSec * 0.98, root - 12, 0.5);
  } else if (cfg.bass === '808') {
    addB(barStartSec, barSec * 0.55, root, 1, true);
    if (section.name.includes('coro')) addB(barStartSec + barSec * 0.7, barSec * 0.28, root + 12, 0.65, false);
    else addB(barStartSec + barSec * 0.75, barSec * 0.2, root, 0.6, false);
  } else if (cfg.bass === 'walk') {
    const notes = [root, fifth, root + 12, third];
    for (let i = 0; i < 4; i++) {
      addB(barStartSec + i * barSec / 4, barSec / 4 * 0.9, notes[i], i === 0 ? 0.95 : 0.7);
    }
  }
}

function renderMelody({ buf, section, barStartSec, barSec, stepSec, notes, cfg, sectionGain, isFinalChorus }) {
  if (sectionGain <= 0.001 || !notes.length) return;
  const push = cfg.lead === 'lead' || cfg.lead === 'strings' ? 0.012 : 0.008;
  for (const note of notes) {
    const time = barStartSec + note.step * stepSec + push;
    const dur = Math.max(0.09, note.len * stepSec * 0.95);
    const gain = sectionGain;
    if (cfg.lead === 'lead') {
      addLead(buf, SR, time, dur, note.midi, gain, { brightness: 0.35 });
    } else if (cfg.lead === 'strings') {
      addStrings(buf, SR, time, dur * 1.1, [note.midi], gain * 1.1);
    } else if (cfg.lead === 'guitar') {
      addGuitar(buf, SR, time, dur, [note.midi], gain * 0.48, 2.8);
    } else if (cfg.lead === 'piano') {
      addPiano(buf, SR, time, dur, [note.midi], gain * 0.9);
    } else if (cfg.lead === 'rhodes') {
      addEPiano(buf, SR, time, dur, [note.midi], gain);
    }
    if (isFinalChorus && cfg.lead !== 'guitar') {
      addPiano(buf, SR, time, dur, [note.midi + 12], gain * 0.3);
    }
  }
}

function panGains(pan) {
  const theta = ((pan + 1) * Math.PI) / 4;
  return [Math.cos(theta) * Math.SQRT2, Math.sin(theta) * Math.SQRT2];
}

function normalizeMaster(stems, panMap) {
  const length = stems.drums.length;
  const L = new Float32Array(length);
  const R = new Float32Array(length);
  for (const [name, buf] of Object.entries(stems)) {
    const pan = panMap[name] || 0;
    const [gl, gr] = panGains(pan);
    for (let i = 0; i < length; i++) {
      const v = buf[i];
      L[i] += v * gl;
      R[i] += v * gr;
    }
  }
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const a = Math.abs(L[i]);
    const b = Math.abs(R[i]);
    if (a > peak) peak = a;
    if (b > peak) peak = b;
  }
  const factor = peak > 0 ? 0.89 / peak : 1;
  const fadeIn = Math.floor(0.02 * SR);
  const fadeOut = Math.floor(1.4 * SR);
  for (let i = 0; i < length; i++) {
    let g = factor;
    if (i < fadeIn) g *= i / fadeIn;
    if (i > length - fadeOut) g *= Math.max(0, (length - i) / fadeOut);
    L[i] *= g;
    R[i] *= g;
  }
  for (const buf of Object.values(stems)) {
    for (let i = 0; i < length; i++) buf[i] *= factor;
  }
  return { L, R, peak, factor };
}

export function generateSong(options = {}) {
  const useStyle = options.useStyle !== false;
  const prompt = useStyle ? String(options.prompt || '') : '';
  const detected = detectFromPrompt(prompt);
  const genreId = useStyle && detected.genre
    ? detected.genre
    : options.genre && options.genre !== 'auto' && GENRES[options.genre] ? options.genre : 'pop';
  const cfg = GENRES[genreId];
  const mood = (useStyle && detected.mood) ||
    (options.mood && options.mood !== 'auto' ? options.mood : cfg.mood);
  const seed = Number.isFinite(Number(options.seed)) && options.seed !== '' ? Number(options.seed) : Math.floor(Math.random() * 1e9);
  const rng = mulberry32(seed);
  setRandom(rng);

  let mode = options.mode && (options.mode === 'minor' || options.mode === 'major') ? options.mode : null;
  if (!mode) {
    if (detected.mode) mode = detected.mode;
    else if (mood === 'melancolico' || mood === 'misterioso') mode = 'minor';
    else mode = cfg.mode;
  }

  let keyInput = options.key || 'auto';
  if (!keyInput || keyInput === 'auto') {
    const choices = KEY_CHOICES[mode];
    keyInput = choices[Math.floor(rng() * choices.length)] + ' ' + mode;
  }
  const parsed = parseKey(keyInput);
  mode = parsed.mode;
  const tonicPc = parsed.tonicPc;

  const bpm = Math.max(50, Math.min(180, Number(useStyle && detected.tempo) || Number(options.bpm) || cfg.bpm));
  const targetDuration = Math.max(20, Math.min(360, Number(options.duration) || 90));
  const barSec = (60 / bpm) * 4;
  const targetBars = Math.round(targetDuration / barSec);
  const form = buildForm(targetBars);
  const bars = form.bars;
  const duration = bars * barSec;
  const tail = 2.5;
  const length = Math.ceil((duration + tail) * SR);
  const stepSec = barSec / 16;

  const stems = {
    drums: makeBuffer(duration + tail),
    bajo: makeBuffer(duration + tail),
    armonia: makeBuffer(duration + tail),
    melodia: makeBuffer(duration + tail),
    fx: makeBuffer(duration + tail)
  };

  const metalcoreProgressions = [
    [
      { degree: 1, quality: 'min' }, { degree: 6, quality: 'maj' },
      { degree: 3, quality: 'maj' }, { degree: 7, quality: 'maj' }
    ],
    [
      { degree: 1, quality: 'min' }, { degree: 7, quality: 'maj' },
      { degree: 6, quality: 'maj' }, { degree: 7, quality: 'maj' }
    ],
    [
      { degree: 6, quality: 'maj' }, { degree: 7, quality: 'maj' },
      { degree: 1, quality: 'min' }, { degree: 1, quality: 'min' }
    ]
  ];
  const verseSteps = genreId === 'metalcore' ? metalcoreProgressions[0] : getProgression(mood, mode, 0);
  const chorusSteps = genreId === 'metalcore' ? metalcoreProgressions[1] : getProgression(mood, mode, 1);
  const bridgeSteps = genreId === 'metalcore' ? metalcoreProgressions[2] : getProgression(mood, mode, 2);
  const verseChords = progressionChords(tonicPc, mode, verseSteps);
  const chorusChords = progressionChords(tonicPc, mode, chorusSteps);
  const bridgeChords = progressionChords(tonicPc, mode, bridgeSteps);
  const scale = scaleMidis(tonicPc, mode, 60, 88);

  const arrangement = [];

  for (const section of form.sections) {
    const isChorus = section.name.includes('coro');
    const steps = section.name === 'puente' ? bridgeSteps : isChorus ? chorusSteps : verseSteps;
    const chords = section.name === 'puente' ? bridgeChords : isChorus ? chorusChords : verseChords;
    const sectionBarSec = section.bars * barSec;
    const sectionStartSec = section.startBar * barSec;
    const layerGain = {
      drums: section.energy,
      bass: Math.min(1, section.energy + (isChorus ? 0.1 : 0)),
      harmony: Math.min(1, 0.55 + section.energy * 0.5),
      melody: Math.min(1, section.energy + 0.12)
    };
    if (section.name === 'intro') {
      layerGain.drums = cfg.drums === 'jazz' || cfg.vinyl ? 0.35 : 0.18;
      layerGain.bass = 0.35;
    }
    if (section.name === 'outro') {
      layerGain.drums = 0.18;
      layerGain.bass = 0.4;
      layerGain.melody = 0.55;
    }
    if (section.name === 'puente') {
      layerGain.drums = 0.3;
      layerGain.bass = 0.55;
    }

    const isFinalChorus = section.name === 'coro2' && section.index === form.sections.length - 1;

    const melodyNotes = buildMelodyNotes({
      bars: section.bars,
      scale,
      rng,
      rhythm: RHYTHMS[genreId] || RHYTHMS.pop,
      center: cfg.melodyRegister + (isChorus ? 3 : 0) + (isFinalChorus ? 2 : 0),
      shift: 0,
      restProb: section.name === 'intro' || section.name === 'outro' ? 0.5 : section.name === 'puente' ? 0.3 : cfg.rest,
      chordAtBar: (bar) => chords[bar % 4]
    });

    for (let localBar = 0; localBar < section.bars; localBar++) {
      const globalBar = section.startBar + localBar;
      const barStartSec = globalBar * barSec;
      const chord = chords[localBar % 4];
      const isFirstBar = localBar === 0;
      const isLastBar = localBar === section.bars - 1;

      renderDrums({
        buf: stems.drums, section, barStartSec, barSec, stepSec, genre: genreId, cfg, rng,
        sectionGain: layerGain.drums, isFirstBar, isLastBar,
        totalBars: bars
      });

      if (localBar % 2 === 0 || section.name.includes('coro')) {
        renderBass({
          buf: stems.bajo, section, barStartSec, barSec, stepSec, chord, cfg, sectionGain: layerGain.bass, rng
        });
      }

      renderHarmony({
        buf: stems.armonia, section, barStartSec, barSec, stepSec, chord, genre: genreId, cfg,
        sectionGain: layerGain.harmony, isFirstBar
      });
    }

    renderMelody({
      buf: stems.melodia, section, barStartSec: sectionStartSec, barSec, stepSec, notes: melodyNotes,
      cfg, sectionGain: layerGain.melody, isFinalChorus
    });

    if (section.name === 'intro' && genreId === 'electronic') {
      addRiser(stems.fx, SR, sectionStartSec + sectionBarSec * 0.5, sectionBarSec * 0.5, 0.9);
    }
    if (isChorus && genreId === 'electronic') {
      addRiser(stems.fx, SR, sectionStartSec - sectionBarSec * 0.25, sectionBarSec * 0.25, 0.8);
    }
    if ((isChorus || section.name === 'puente') && genreId === 'cinematic') {
      addImpact(stems.fx, SR, sectionStartSec, 0.7);
    }

    arrangement.push({
      name: section.name,
      label: section.label,
      bars: section.bars,
      startBar: section.startBar,
      energy: section.energy,
      progression: progressionLabels(tonicPc, mode, steps),
      progressionRomans: progressionRomans(mode, steps)
    });
  }

  if (cfg.vinyl) addVinyl(stems.fx, SR, 0.45);
  if (genreId === 'cinematic') {
    addImpact(stems.fx, SR, duration - tail * 0.2, 0.9);
  }

  const panMap = {
    drums: 0,
    bajo: 0,
    armonia: -0.18,
    melodia: 0.18,
    fx: 0
  };
  const master = normalizeMaster(stems, panMap);

  const keyLabel = `${NOTE_NAMES[normalizePc(tonicPc)]} ${mode}`;
  const title = options.title || `${cfg.label} ${keyLabel} #${String(seed).slice(-4)}`;

  return {
    id: `gen-${Date.now().toString(36)}-${Math.floor(rng() * 1e4).toString(36)}`,
    engine: 'procedural',
    title,
    genre: genreId,
    genreLabel: cfg.label,
    mood,
    bpm,
    key: keyLabel,
    mode,
    bars,
    seed,
    duration: Number((duration + tail).toFixed(2)),
    musicalDuration: Number(duration.toFixed(2)),
    sampleRate: SR,
    createdAt: new Date().toISOString(),
    detected,
    prompt,
    stems,
    master,
    spec: {
      form: arrangement,
      key: keyLabel,
      bpm,
      bars,
      meter: '4/4',
      progression: {
        versos: progressionLabels(tonicPc, mode, verseSteps),
        versosRoman: progressionRomans(mode, verseSteps),
        coro: progressionLabels(tonicPc, mode, chorusSteps),
        coroRoman: progressionRomans(mode, chorusSteps),
        puente: progressionLabels(tonicPc, mode, bridgeSteps),
        puenteRoman: progressionRomans(mode, bridgeSteps)
      },
      groove: {
        feel: genreId === 'lofi' || genreId === 'jazz' ? 'swing ligero' : genreId === 'trap' ? 'half-time' : 'recto',
        swing: cfg.swing,
        pushPull: [
          { part: 'bajo', offset_ms: genreId === 'trap' ? 0 : -6, note: 'levemente adelantado' },
          { part: 'melodia', offset_ms: 12, note: 'levemente atrasada (laid-back)' },
          { part: 'bateria', offset_ms: 0, note: 'sobre la rejilla' }
        ]
      },
      layers: [
        { name: 'Bateria', role: cfg.drums, entry: 'verso', exit: 'outro' },
        { name: 'Bajo', role: cfg.bass, entry: 'intro', exit: 'outro' },
        { name: 'Armonia', role: cfg.harmony, entry: 'intro', exit: 'outro' },
        { name: 'Melodia', role: cfg.lead, entry: 'verso', exit: 'outro' }
      ],
      mix: {
        pan: { drums: 'centro', bass: 'centro', harmony: '15% izquierda', melody: '15% derecha' },
        tips: [
          'La melodia va 12 ms atrasada para sonar humana.',
          'El bajo esta 6 ms adelantado para empujar el groove.',
          'Deja aire en los primeros compases: la entrada por capas hace que el coro crezca.'
        ]
      },
      generator: 'musicderechos-local-v1'
    },
    authorsNote: 'Generado localmente en tu equipo. No se envio audio a ningun servicio externo.'
  };
}
