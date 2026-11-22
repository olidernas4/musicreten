import {
  NOTE_NAMES, normalizePc, parseKey, getProgression, progressionChords,
  scaleMidis, mulberry32, detectFromPrompt, progressionLabels, progressionRomans
} from './music.js';
import { getCatalogAssets } from './library.js';

const GENRES = {
  pop: { label: 'Pop', bpm: 108, mood: 'alegre', mode: 'major' },
  lofi: { label: 'Lo-fi / Chill', bpm: 78, mood: 'relajado', mode: 'minor' },
  electronic: { label: 'Electrónica / EDM', bpm: 124, mood: 'energetico', mode: 'minor' },
  cinematic: { label: 'Cinemática / Épica', bpm: 72, mood: 'epico', mode: 'minor' },
  trap: { label: 'Trap / Urbano', bpm: 72, mood: 'misterioso', mode: 'minor' },
  rock: { label: 'Rock / Banda', bpm: 120, mood: 'energetico', mode: 'major' },
  metalcore: { label: 'Metalcore / Post-hardcore', bpm: 150, mood: 'energetico', mode: 'minor' },
  acustico: { label: 'Acústico / Balada', bpm: 92, mood: 'romantico', mode: 'major' },
  jazz: { label: 'Jazz / Neo-soul', bpm: 96, mood: 'relajado', mode: 'minor' }
};

const SECTION_META = {
  intro: { label: 'Intro', energy: 0.28 },
  verso: { label: 'Verso', energy: 0.62 },
  verso2: { label: 'Verso 2', energy: 0.7 },
  coro: { label: 'Coro', energy: 0.9 },
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
  acustico: [[0, 4], [4, 2], [6, 2], [8, 4], [12, 4]],
  jazz: [[0, 2], [3, 1], [4, 3], [8, 2], [10, 2], [12, 4]]
};

const KEY_CHOICES = {
  major: ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'],
  minor: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'C#', 'F#']
};

const TRACKS = [
  { name: 'Batería', role: 'drums', color: '#6ef2c4', volume: 0.95 },
  { name: 'Percusión', role: 'perc', color: '#c3f26e', volume: 0.72 },
  { name: 'Bajo', role: 'bass', color: '#9b8cff', volume: 0.9 },
  { name: 'Armonía', role: 'keys', color: '#ffcf6e', volume: 0.7 },
  { name: 'Melodía', role: 'lead', color: '#ff8fb1', volume: 0.76 },
  { name: 'Guitarra eléctrica', role: 'guitar', color: '#ff9c6e', volume: 0.88 }
];

const ROLE_FOLDER = {
  kick: 'Kick',
  snare: 'Snare',
  hat: 'Hihat',
  clap: 'Clap',
  shaker: 'Shaker',
  tom: 'Tom',
  cymbal: 'Cymbal'
};

const KIT_PREFS = {
  trap: ['808', '909', 'Trap', 'Trappy'],
  electronic: ['909', '808', 'Techno', 'House', 'EDM', 'Club'],
  lofi: ['Vinyl', 'Dust', 'Lo-Fi', 'Lofi', '707', '505', 'Tape'],
  rock: ['Acoustic', 'Live', 'Room', '70s', 'Funk'],
  metalcore: ['Acoustic', 'Live', 'Room'],
  acustico: ['Acoustic', 'Live', 'Room', '70s'],
  jazz: ['Acoustic', 'Jazz', 'Live', 'Room', 'Brushes'],
  cinematic: ['Acoustic', 'Epic', 'Cinematic', 'Live', 'Room'],
  pop: ['909', '808', 'Acoustic', 'Funk', 'Pop']
};

const INSTRUMENT_PREFS = {
  bass: {
    trap: ['infected', 'pulse', 'mamas'],
    electronic: ['pulse', 'infected', 'mamas'],
    lofi: ['mamas', 'infected', 'pulse'],
    rock: ['mamas', 'pulse', 'infected'],
    acustico: ['mamas', 'pulse', 'infected'],
    jazz: ['mamas', 'pulse', 'infected'],
    cinematic: ['infected', 'pulse', 'mamas'],
    pop: ['pulse', 'mamas', 'infected']
  },
  keys: {
    trap: ['galactica', 'smooth', 'lo fi', 'grand piano'],
    electronic: ['galactica', 'smooth', 'sandblaster', 'byte sized'],
    lofi: ['lo fi', 'voodoo', 'grand piano', 'upright'],
    rock: ['grand piano', 'upright', 'mallet', 'guitar'],
    acustico: ['grand piano', 'upright', 'guitar', 'mallet'],
    jazz: ['grand piano', 'upright', 'mallet', 'guitar'],
    cinematic: ['ambient', 'galactica', 'grand piano', 'smooth'],
    pop: ['grand piano', 'smooth', 'galactica', 'upright']
  },
  lead: {
    trap: ['arp poly', 'phantasm', 'metallic', 'ob saw'],
    electronic: ['arp poly', 'phantasm', 'ob saw', 'metallic'],
    lofi: ['lo fi', 'galactica', 'metallic', 'arp poly'],
    rock: ['arp poly', 'ob saw', 'metallic', 'phantasm'],
    acustico: ['mallet', 'arp poly', 'phantasm', 'metallic'],
    jazz: ['mallet', 'arp poly', 'phantasm', 'metallic'],
    cinematic: ['ambient', 'phantasm', 'arp poly', 'metallic'],
    pop: ['arp poly', 'smooth', 'phantasm', 'metallic']
  }
};

const PC = {
  C: 0, 'C#': 1, DB: 1, D: 2, 'D#': 3, EB: 3, E: 4, F: 5,
  'F#': 6, GB: 6, G: 7, 'G#': 8, AB: 8, A: 9, 'A#': 10, BB: 10, B: 11
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function stripExt(name) {
  return String(name || '').replace(/\.[^.]+$/, '');
}

function buildForm(targetBars, rng) {
  let bestDiff = Infinity;
  const candidates = [];
  for (const template of FORMS) {
    let total = 0;
    for (let i = 1; i < template.length; i += 2) total += template[i];
    const diff = Math.abs(total - targetBars);
    if (diff < bestDiff) {
      bestDiff = diff;
      candidates.length = 0;
      candidates.push({ template, bars: total });
    } else if (diff === bestDiff) {
      candidates.push({ template, bars: total });
    }
  }
  const picked = candidates[Math.floor(rng() * candidates.length)];
  const best = picked.template;
  const bestBars = picked.bars;
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

function parseSampleNote(name) {
  const text = stripExt(name);
  const match = text.match(/(?:^|[\s_\-([{])([A-Ga-g])([#b]?)[\s_-]*([0-7])(?=[\s_.\-·)\]}fmp]|$)/);
  if (!match) return null;
  const note = `${match[1].toUpperCase()}${match[2] || ''}`.toUpperCase();
  const pc = PC[note];
  if (pc === undefined) return null;
  const octave = Number(match[3]);
  return { midi: 12 * (octave + 1) + pc, pc };
}

function badName(name, allowSoft = false) {
  const text = String(name || '');
  if (/alien|glitch|broken|scary|scream|sick|warp|reverse|granular|noise/i.test(text)) return true;
  if (!allowSoft && /\bfx\b|impact|riser|sweep|downlifter|uplifter/i.test(text)) return true;
  return false;
}

function groupInstruments(assets) {
  const groups = new Map();
  for (const asset of assets) {
    if (asset.kind !== 'audio' || !asset.playable) continue;
    if (!asset.relPath.includes('Multisamples')) continue;
    if (!Number.isFinite(asset.duration) || asset.duration < 0.08 || asset.duration > 30) continue;
    const note = parseSampleNote(asset.name);
    if (!note) continue;
    const folder = asset.relPath.split('/').slice(0, -1).join('/');
    if (!groups.has(folder)) {
      groups.set(folder, { folder, label: folder.split('/').slice(-1)[0], samples: [] });
    }
    groups.get(folder).samples.push({ ...asset, rootMidi: note.midi });
  }
  const output = [];
  for (const group of groups.values()) {
    if (group.samples.length < 4) continue;
    const text = `${group.folder} ${group.samples.map((s) => s.name).join(' ')}`.toLowerCase();
    let role = null;
    if (/\bbass\b/.test(text)) role = 'bass';
    else if (/lead|\barp\b|solo|brass|wind|flute|horn/.test(text)) role = 'lead';
    else if (/piano|key|rhodes|organ|mallet|guitar|string|bell|synth|pad|galactica|voodoo|ambient/.test(text)) role = 'keys';
    if (!role) continue;
    if (/drum machines|sound objects|percussion/.test(text)) continue;
    group.role = role;
    group.text = text;
    output.push(group);
  }
  return output;
}

function chooseInstrument(groups, role, prefs, usedFolders, rng) {
  const candidates = groups.filter((group) => group.role === role && !usedFolders.has(group.folder));
  if (!candidates.length) return null;
  const scored = candidates.map((group) => {
    let score = rng() * 1.5;
    prefs.forEach((pref, index) => {
      if (group.text.includes(pref)) score += 10 - index;
    });
    if (role === 'keys' && /grand piano|upright/.test(group.text)) score += 2;
    return { group, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0].group;
}

function nearestSample(instrument, midi) {
  let best = null;
  let bestDistance = Infinity;
  for (const sample of instrument.samples) {
    const distance = Math.abs(sample.rootMidi - midi);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = sample;
    }
  }
  if (!best) return null;
  const rate = 2 ** ((midi - best.rootMidi) / 12);
  if (rate < 0.5 || rate > 2) return null;
  return { sample: best, rate };
}

function selectDrumSample(assets, role, rng, kit) {
  const folder = ROLE_FOLDER[role];
  if (!folder) return null;
  let candidates = assets.filter((asset) => {
    if (asset.kind !== 'audio' || !asset.playable) return false;
    if (!asset.relPath.includes(`/Drums/${folder}/`)) return false;
    const maxDuration = role === 'cymbal' ? 10 : 2.8;
    if (!Number.isFinite(asset.duration) || asset.duration < 0.03 || asset.duration > maxDuration) return false;
    return true;
  });
  if (!candidates.length) return null;
  if (kit) {
    const matched = candidates.filter((asset) => asset.name.toLowerCase().includes(kit.toLowerCase()));
    if (matched.length) candidates = matched;
  }
  const scored = candidates.map((asset) => {
    let score = rng() * 2;
    if (badName(asset.name)) score -= 8;
    if (role === 'hat' && /closed|short|tight/i.test(asset.name)) score += 2;
    if (role === 'kick' && /kick/i.test(asset.name)) score += 1;
    if (role === 'snare' && /snare/i.test(asset.name)) score += 1;
    if (role === 'cymbal' && /crash|rock|heavy/i.test(asset.name)) score += 2;
    if (asset.duration > 0.12 && asset.duration < 1.2) score += 1;
    return { asset, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0].asset;
}

function chooseDrumKit(assets, genre, rng, warnings) {
  const prefs = KIT_PREFS[genre] || KIT_PREFS.pop;
  const roles = ['kick', 'snare', 'hat'];
  let kit = null;
  for (const candidate of prefs) {
    const ok = roles.every((role) => assets.some((asset) => {
      if (!asset.relPath.includes(`/Drums/${ROLE_FOLDER[role]}/`)) return false;
      if (!Number.isFinite(asset.duration) || asset.duration < 0.03 || asset.duration > 2.8) return false;
      return asset.name.toLowerCase().includes(candidate.toLowerCase());
    }));
    if (ok) { kit = candidate; break; }
  }
  const drums = { kit: kit || 'estándar' };
  for (const role of ['kick', 'snare', 'hat', 'clap', 'shaker', 'tom', 'cymbal']) {
    drums[role] = selectDrumSample(assets, role, rng, kit);
  }
  if (genre === 'metalcore') {
    drums.shaker = null;
    drums.clap = null;
    drums.cymbal = selectDrumSample(assets, 'cymbal', rng, 'Heavy Rock') ||
      selectDrumSample(assets, 'cymbal', rng, 'Acoustic') ||
      selectDrumSample(assets, 'cymbal', rng, 'Crash');
  }
  for (const role of roles) {
    if (!drums[role]) warnings.push(`No se encontró un sample de ${role === 'hat' ? 'hi-hat' : role}. Se omite esa parte de la batería.`);
  }
  return drums;
}

function assetKeyLabel(key) {
  const match = String(key || '').match(/^([A-G])([#b]?)(m|min|minor|maj|major)?$/i);
  if (!match) return null;
  const root = match[1].toUpperCase() + (match[2] || '');
  const mode = /^(m|min|minor)$/i.test(match[3] || '') ? 'minor' : 'major';
  return parseKey(`${root} ${mode}`).label;
}

function chooseGuitarLoop(assets, keyLabel) {
  return assets
    .filter((asset) =>
      asset.kind === 'audio' &&
      asset.playable &&
      asset.relPath.replace(/\\/g, '/').toLowerCase().includes('/loops/tonal/guitar/') &&
      Number.isFinite(asset.duration) &&
      asset.duration >= 6 &&
      Number.isFinite(asset.bpm) &&
      assetKeyLabel(asset.musicalKey) === keyLabel
    )
    .sort((a, b) => Number(/amp/i.test(b.name)) - Number(/amp/i.test(a.name)))[0] || null;
}

function bassRoot(chord) {
  let root = chord[0] - 12;
  while (root < 33) root += 12;
  while (root > 50) root -= 12;
  return root;
}

function bassPattern(genre, chorus, section) {
  if (section === 'intro' || section === 'outro') return [0];
  if (genre === 'electronic') return chorus ? [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] : [0, 1, 2, 3];
  if (genre === 'trap') return chorus ? [0, 0.75, 1.5, 2, 2.75, 3.5] : [0, 1.5, 2, 3.5];
  if (genre === 'rock') return chorus ? [0, 1, 2, 3] : [0, 2];
  if (genre === 'lofi' || genre === 'jazz') return chorus ? [0, 1.5, 2, 3] : [0, 2];
  if (genre === 'cinematic') return [0, 2];
  return chorus ? [0, 1, 2, 3] : [0, 2];
}

function makeMelodyMotif(rng) {
  const contours = [
    [0, 2, 3, 1, 0, -1, 1, 3, 2, 0, -1, -2],
    [0, 1, 3, 4, 2, 1, -1, 0, 2, 1, -1, -2],
    [0, -1, 1, 2, 4, 2, 0, -1, 1, 3, 1, -2],
    [0, 3, 2, 1, -1, 0, 2, 4, 3, 1, 0, -2]
  ];
  return contours[Math.floor(rng() * contours.length)];
}

function nearestIndex(values, target) {
  let bestIndex = 0;
  for (let index = 1; index < values.length; index++) {
    if (Math.abs(values[index] - target) < Math.abs(values[bestIndex] - target)) bestIndex = index;
  }
  return bestIndex;
}

function melodyPitch({ chord, scale, motif, phraseIndex, sectionName, isChorus, finalChorus, strongBeat, cadence, previous }) {
  const motifIndex = phraseIndex % motif.length;
  let interval = motif[motifIndex];
  if (sectionName === 'verso2' && phraseIndex >= motif.length / 2) {
    interval = motif[(motifIndex + 1) % motif.length];
  } else if (sectionName === 'puente') {
    interval = motif[(motifIndex + 4) % motif.length] - 1;
  }
  if (isChorus) interval += 1;
  if (finalChorus) interval += 1;

  const rootIndex = nearestIndex(scale, chord[0] + 24);
  const targetIndex = Math.max(1, Math.min(scale.length - 2, rootIndex + interval));
  let note = scale[targetIndex];
  if (cadence) {
    note = scale[rootIndex];
  } else if (strongBeat) {
    const chordTones = chord.map((midi) => midi + 24).filter((midi) => midi >= 72 && midi <= 88);
    if (chordTones.length) {
      note = chordTones.reduce((best, candidate) =>
        Math.abs(candidate - note) < Math.abs(best - note) ? candidate : best
      );
    }
  }

  if (previous !== null && Math.abs(note - previous) > 7) {
    const alternatives = [note - 12, note + 12].filter((candidate) =>
      candidate >= scale[0] && candidate <= scale[scale.length - 1]
    );
    if (alternatives.length) {
      note = alternatives.reduce((best, candidate) =>
        Math.abs(candidate - previous) < Math.abs(best - previous) ? candidate : best
      );
    }
  }
  return note;
}

function addPlanClip(track, clip) {
  track.clips.push({
    name: clip.name,
    assetId: clip.assetId,
    assetName: clip.assetName,
    assetPath: clip.assetPath,
    role: clip.role,
    start: round(Math.max(0, clip.start)),
    duration: round(Math.max(0.05, clip.duration)),
    offset: round(clip.offset || 0),
    rate: round(clip.rate || 1, 6),
    gain: round(clip.gain ?? 1, 3),
    pan: round(clip.pan ?? 0, 3),
    fadeIn: round(clip.fadeIn ?? 0.002),
    fadeOut: round(clip.fadeOut ?? 0.03)
  });
}

function tonalClip(instrument, midi, start, duration, options = {}) {
  const picked = nearestSample(instrument, midi);
  if (!picked) return null;
  const sourceDuration = picked.sample.duration / picked.rate;
  return {
    name: `${options.label || instrument.label} · ${NOTE_NAMES[normalizePc(midi)]}${Math.floor(midi / 12) - 1}`,
    assetId: picked.sample.id,
    assetName: picked.sample.name,
    assetPath: picked.sample.relPath,
    role: options.role,
    start,
    duration: Math.min(duration, Math.max(0.06, sourceDuration)),
    offset: 0,
    rate: picked.rate,
    gain: options.gain ?? 1,
    pan: options.pan ?? 0,
    fadeIn: options.fadeIn ?? 0.005,
    fadeOut: options.fadeOut ?? Math.min(0.12, duration * 0.25)
  };
}

function drumClip(sample, start, role, options = {}) {
  const max = Number.isFinite(sample.duration) && sample.duration > 0 ? sample.duration : 0.5;
  const cap = role === 'hat' ? 0.22 :
    role === 'shaker' ? 0.2 :
      role === 'kick' ? 0.6 :
        role === 'cymbal' ? 1.5 : 0.5;
  return {
    name: stripExt(sample.name).slice(0, 46),
    assetId: sample.id,
    assetName: sample.name,
    assetPath: sample.relPath,
    role,
    start,
    duration: Math.min(max, cap),
    offset: 0,
    rate: 1,
    gain: options.gain ?? 0.85,
    pan: options.pan ?? 0,
    fadeIn: 0.001,
    fadeOut: 0.02
  };
}

function guitarLoopClip(sample, start, duration, offset, rate, options = {}) {
  return {
    name: `${stripExt(sample.name)} · riff`,
    assetId: sample.id,
    assetName: sample.name,
    assetPath: sample.relPath,
    role: 'guitar',
    start,
    duration,
    offset,
    rate,
    gain: options.gain ?? 0.8,
    pan: options.pan ?? 0,
    fadeIn: options.fadeIn ?? 0.01,
    fadeOut: options.fadeOut ?? 0.08
  };
}

export function composeLibrarySong(options = {}) {
  const assets = getCatalogAssets();
  if (!assets.length) {
    throw Object.assign(new Error('La biblioteca está vacía. Añade una carpeta y escanéala antes de generar.'), { status: 409 });
  }
  const useStyle = options.useStyle !== false;
  const prompt = useStyle ? String(options.prompt || '') : '';
  const detected = detectFromPrompt(prompt);
  const selectedGenre = options.genre && options.genre !== 'auto' && GENRES[options.genre] ? options.genre : null;
  const genre = (useStyle && detected.genre) || selectedGenre || detected.genre || 'pop';
  const cfg = GENRES[genre];
  const mood = (useStyle && detected.mood) ||
    (options.mood && options.mood !== 'auto' ? options.mood : cfg.mood);
  const seed = Number.isFinite(Number(options.seed)) && options.seed !== '' ? Number(options.seed) : Math.floor(Math.random() * 1e9);
  const rng = mulberry32(seed);

  let mode = options.mode === 'major' || options.mode === 'minor' ? options.mode : null;
  if (!mode) {
    if (detected.mode) mode = detected.mode;
    else if (mood === 'melancolico' || mood === 'misterioso') mode = 'minor';
    else mode = cfg.mode;
  }
  let keyInput = options.key || 'auto';
  if (!keyInput || keyInput === 'auto') {
    if (genre === 'metalcore' && mode === 'minor') {
      keyInput = 'B minor';
    } else {
      const choices = KEY_CHOICES[mode];
      keyInput = `${choices[Math.floor(rng() * choices.length)]} ${mode}`;
    }
  }
  const parsed = parseKey(keyInput);
  mode = parsed.mode;
  const tonicPc = parsed.tonicPc;
  const keyLabel = `${NOTE_NAMES[normalizePc(tonicPc)]} ${mode}`;
  const guitarLoop = genre === 'metalcore' ? chooseGuitarLoop(assets, keyLabel) : null;
  if (genre === 'metalcore' && !guitarLoop) {
    throw Object.assign(
      new Error(`No hay un loop de guitarra disponible en ${keyLabel}. La biblioteca de esta sesión debe tener un loop de guitarra en esa tonalidad para generar metalcore con instrumentos reales.`),
      { status: 422 }
    );
  }

  const detectedTempo = genre === 'metalcore' ? 0 : Number(useStyle && detected.tempo);
  const bpm = clamp(Number(options.bpm) || detectedTempo || guitarLoop?.bpm || cfg.bpm, 50, 180);
  const targetDuration = clamp(Number(options.duration) || 90, 20, 360);
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  const targetBars = Math.round(targetDuration / barSec);
  const form = buildForm(targetBars, rng);
  const bars = form.bars;
  const duration = bars * barSec;

  const verseSteps = getProgression(mood, mode, 0);
  const chorusSteps = getProgression(mood, mode, 1);
  const bridgeSteps = getProgression(mood, mode, 2);
  const verseChords = progressionChords(tonicPc, mode, verseSteps);
  const chorusChords = progressionChords(tonicPc, mode, chorusSteps);
  const bridgeChords = progressionChords(tonicPc, mode, bridgeSteps);
  const scale = scaleMidis(tonicPc, mode, 72, 88);
  const melodyMotif = makeMelodyMotif(rng);

  const warnings = [];
  const drumKit = chooseDrumKit(assets, genre, rng, warnings);
  const guitarRate = guitarLoop ? bpm / guitarLoop.bpm : 1;
  if (guitarLoop && Math.abs(guitarRate - 1) > 0.01) {
    warnings.push(`La guitarra usa un loop grabado a ${guitarLoop.bpm} BPM; ajustar su velocidad a ${bpm} BPM también cambia ligeramente su tono.`);
  }
  const groups = groupInstruments(assets);
  const usedFolders = new Set();
  const bassInstrument = chooseInstrument(groups, 'bass', INSTRUMENT_PREFS.bass[genre] || [], usedFolders, rng);
  if (bassInstrument) usedFolders.add(bassInstrument.folder);
  const keysInstrument = genre === 'metalcore' ? null :
    chooseInstrument(groups, 'keys', INSTRUMENT_PREFS.keys[genre] || [], usedFolders, rng);
  if (keysInstrument) usedFolders.add(keysInstrument.folder);
  const leadInstrument = genre === 'metalcore' ? null :
    chooseInstrument(groups, 'lead', INSTRUMENT_PREFS.lead[genre] || [], usedFolders, rng);
  if (leadInstrument) usedFolders.add(leadInstrument.folder);

  if (!bassInstrument) warnings.push('No se encontró un multisample de bajo; se omite la pista de bajo.');
  if (!keysInstrument && genre !== 'metalcore') warnings.push('No se encontró un multisample de armonía; se omite la pista de armonía.');
  if (!leadInstrument && genre !== 'metalcore') warnings.push('No se encontró un multisample de melodía; se omite la pista de melodía.');

  const tracks = TRACKS.map((track) => ({ ...track, clips: [] }));
  const trackByName = new Map(tracks.map((track) => [track.name, track]));
  const add = (trackName, clip) => {
    if (!clip) return;
    addPlanClip(trackByName.get(trackName), clip);
  };

  const arrangement = [];

  for (const section of form.sections) {
    const isChorus = section.name.includes('coro');
    const isIntro = section.name === 'intro';
    const isOutro = section.name === 'outro';
    const isBridge = section.name === 'puente';
    const finalChorus = section.name === 'coro2' &&
      !form.sections.slice(section.index + 1).some((next) => next.name === 'coro2');
    const steps = isBridge ? bridgeSteps : isChorus ? chorusSteps : verseSteps;
    const chords = isBridge ? bridgeChords : isChorus ? chorusChords : verseChords;
    const sectionStart = section.startBar * barSec;

    if (guitarLoop && !isOutro) {
      const guitarBars = isIntro ? Math.min(2, section.bars) :
        isBridge ? Math.max(1, Math.floor(section.bars / 2)) : section.bars;
      const guitarStart = isIntro || isBridge
        ? sectionStart + (section.bars - guitarBars) * barSec
        : sectionStart;
      const requestedDuration = guitarBars * barSec;
      let offset = section.index % 2 === 1
        ? Math.max(0, guitarLoop.duration - requestedDuration * guitarRate)
        : 0;
      if (offset + requestedDuration * guitarRate > guitarLoop.duration) offset = 0;
      const guitarDuration = Math.min(requestedDuration, (guitarLoop.duration - offset) / guitarRate);
      const guitarGain = isIntro ? 0.45 :
        isChorus ? (finalChorus ? 0.98 : 0.9) :
          isBridge ? 0.68 :
            section.name === 'verso2' ? 0.58 : 0.68;
      add('Guitarra eléctrica', guitarLoopClip(
        guitarLoop, guitarStart, guitarDuration, offset, guitarRate, { gain: guitarGain }
      ));
    }

    arrangement.push({
      name: section.name,
      label: section.label,
      bars: section.bars,
      startBar: section.startBar,
      energy: section.energy,
      development: isIntro ? 'presentación del motivo' :
        isBridge ? 'fragmentación y contraste' :
          section.name === 'verso2' ? 'variación del motivo' :
            finalChorus ? 'reexposición ampliada' :
              isChorus ? 'reexposición del hook' :
                isOutro ? 'desmontaje' : 'declaración del motivo',
      progression: progressionLabels(tonicPc, mode, steps),
      progressionRomans: progressionRomans(mode, steps)
    });

    for (let bar = 0; bar < section.bars; bar++) {
      const barStart = sectionStart + bar * barSec;
      const chord = chords[bar % chords.length];
      const finalBar = bar === section.bars - 1;

      if (keysInstrument) {
        const everyTwo = isIntro || isOutro;
        if (!everyTwo || bar % 2 === 0) {
          const chordDuration = (isIntro || isOutro ? barSec * 1.6 : barSec * (isChorus ? 0.9 : 0.96));
          for (const note of chord) {
            add('Armonía', tonalClip(keysInstrument, note + 12, barStart, chordDuration, {
              role: 'keys',
              gain: isChorus ? 0.56 : 0.46,
              pan: -0.14,
              fadeOut: 0.2
            }));
          }
        }
      }

      if (bassInstrument) {
        const pattern = bassPattern(genre, isChorus, section.name);
        const root = bassRoot(chord);
        pattern.forEach((offsetBeats, index) => {
          const start = barStart + offsetBeats * beatSec;
          const next = pattern[index + 1];
          const noteBeats = next === undefined ? (isIntro || isOutro ? 2.6 : 0.9) : Math.max(0.22, next - offsetBeats);
          const midi = index > 0 && index % 4 === 2 ? root + 7 : root;
          add('Bajo', tonalClip(bassInstrument, midi, start, noteBeats * beatSec * 0.92, {
            role: 'bass',
            gain: isChorus ? 0.92 : 0.8,
            pan: 0,
            fadeOut: 0.04
          }));
        });
      }

      if (leadInstrument && !isOutro && (!isBridge || bar % 2 === 0) && (!isIntro || bar === section.bars - 1)) {
        const rhythm = RHYTHMS[genre] || RHYTHMS.pop;
        let previous = null;
        const phraseBar = bar % 2;
        const phraseRhythm = isIntro ? rhythm.filter((_, index) => index % 2 === 0) : rhythm;
        for (const [index, [step, length]] of phraseRhythm.entries()) {
          if (!isChorus && step > 8 && bar % 2 === 1) continue;
          if (isBridge && step > 4) continue;
          const start = barStart + (step / 4) * beatSec;
          const noteDuration = (length / 4) * beatSec * 0.9;
          const phraseIndex = phraseBar * rhythm.length + index;
          const midi = melodyPitch({
            chord,
            scale,
            motif: melodyMotif,
            phraseIndex,
            sectionName: section.name,
            isChorus,
            finalChorus,
            strongBeat: step % 4 === 0,
            cadence: finalBar && index === phraseRhythm.length - 1,
            previous
          });
          previous = midi;
          add('Melodía', tonalClip(leadInstrument, midi, start, Math.max(0.08, noteDuration), {
            role: 'lead',
            gain: isChorus ? 0.82 : 0.62,
            pan: 0.18,
            fadeOut: Math.min(0.08, noteDuration * 0.3)
          }));
        }
      }

      const drumsOn = !isIntro && !isOutro && !(isBridge && bar < Math.ceil(section.bars / 2));
      if (drumsOn) {
        let kickSteps = genre === 'metalcore'
          ? (isChorus ? [0, 1.5, 2.5, 3.5] : [0, 2])
          : isChorus && genre === 'electronic'
            ? [0, 1, 2, 3]
            : genre === 'trap' && isChorus
              ? [0, 2, 2.75]
              : [0, 2];
        if (section.name === 'verso2' && bar % 2 === 1) kickSteps = genre === 'metalcore' ? [0, 1.5, 3] : [0, 1.5];
        if (isBridge) kickSteps = [0, 2.5];
        if (finalChorus && bar % 4 === 3) kickSteps = genre === 'metalcore' ? [0, 1, 2.5, 3.5] : [0, 1, 2.5, 3.5];
        if (drumKit.kick) {
          for (const step of kickSteps) {
            add('Batería', drumClip(drumKit.kick, barStart + step * beatSec, 'kick', { gain: 0.95 }));
          }
        }
        if (drumKit.snare) {
          const snareSteps = genre === 'metalcore' ? [2] : [1, 3];
          for (const step of snareSteps) {
            add('Batería', drumClip(drumKit.snare, barStart + step * beatSec, 'snare', { gain: 0.8 }));
            if (isChorus && genre !== 'metalcore' && drumKit.clap) {
              add('Percusión', drumClip(drumKit.clap, barStart + step * beatSec, 'clap', { gain: 0.5, pan: 0.06 }));
            }
          }
        }
        const hatGain = isChorus ? 0.34 : 0.24;
        const hatSteps = section.name === 'verso2' && bar % 2 === 1 ? 6 : 8;
        if (drumKit.hat) {
          for (let step = 0; step < hatSteps; step++) {
            add('Batería', drumClip(drumKit.hat, barStart + step * 0.5 * beatSec, 'hat', {
              gain: step % 2 === 0 ? hatGain : hatGain * 0.72,
              pan: 0.16
            }));
          }
        }
        if (genre !== 'metalcore' && drumKit.shaker) {
          for (let step = 0; step < 4; step++) {
            add('Percusión', drumClip(drumKit.shaker, barStart + (step + 0.5) * beatSec, 'shaker', {
              gain: isChorus ? 0.28 : 0.18,
              pan: -0.22
            }));
          }
        }
        if (genre === 'metalcore' && isChorus && bar === 0 && drumKit.cymbal) {
          add('Batería', drumClip(drumKit.cymbal, barStart, 'cymbal', { gain: 0.72, pan: 0.18 }));
        }
        if (finalBar && drumKit.snare) {
          add('Batería', drumClip(drumKit.snare, barStart + 3.5 * beatSec, 'snare', { gain: 0.72 }));
          if (drumKit.tom) {
            add('Batería', drumClip(drumKit.tom, barStart + 3.25 * beatSec, 'tom', { gain: 0.55, pan: -0.1 }));
            add('Batería', drumClip(drumKit.tom, barStart + 3.75 * beatSec, 'tom', { gain: 0.5, pan: 0.1 }));
          }
        }
      } else if (isIntro && finalBar && drumKit.hat) {
        for (let step = 0; step < 4; step++) {
          add('Batería', drumClip(drumKit.hat, barStart + step * beatSec, 'hat', { gain: 0.2, pan: 0.16 }));
        }
      }
    }
  }

  const finalTracks = tracks.filter((track) => track.clips.length);
  const usedMap = new Map();
  for (const track of finalTracks) {
    for (const clip of track.clips) {
      if (!clip.assetId) continue;
      if (!usedMap.has(clip.assetId)) {
        usedMap.set(clip.assetId, {
          id: clip.assetId,
          name: clip.assetName,
          path: clip.assetPath,
          roles: new Set(),
          tracks: new Set(),
          uses: 0,
          url: `/media/asset/${clip.assetId}`
        });
      }
      const entry = usedMap.get(clip.assetId);
      entry.roles.add(clip.role);
      entry.tracks.add(track.name);
      entry.uses++;
    }
  }
  const usedAssets = [...usedMap.values()].map((entry) => ({
    ...entry,
    roles: [...entry.roles],
    tracks: [...entry.tracks]
  })).sort((a, b) => b.uses - a.uses);

  const instruments = {
    bateria: drumKit.kick ? `Kit ${drumKit.kit}` : 'Sin batería',
    bajo: bassInstrument ? bassInstrument.label : 'Sin bajo',
    armonia: keysInstrument ? keysInstrument.label : 'Sin armonía',
    melodia: leadInstrument ? leadInstrument.label : 'Sin melodía',
    guitarra: guitarLoop ? guitarLoop.name : 'Sin guitarra'
  };

  const title = `${cfg.label} ${keyLabel} · Biblioteca #${String(seed).slice(-4)}`;
  return {
    id: `lib-${Date.now().toString(36)}-${Math.floor(rng() * 1e4).toString(36)}`,
    engine: 'library',
    title,
    genre,
    genreLabel: cfg.label,
    mood,
    bpm,
    key: keyLabel,
    mode,
    bars,
    seed,
    duration: round(duration, 2),
    musicalDuration: round(duration, 2),
    createdAt: new Date().toISOString(),
    prompt,
    detected,
    tracks: finalTracks.map((track) => ({
      name: track.name,
      role: track.role,
      color: track.color,
      volume: track.volume,
      clips: track.clips
    })),
    usedAssets,
    warnings,
    instruments,
    spec: {
      form: arrangement,
      material: genre === 'metalcore'
        ? {
          motif: `Riff de guitarra grabado en ${keyLabel}: ${guitarLoop.name}.`,
          character: 'El loop de guitarra se recorta en las secciones suaves y vuelve con más fuerza en los coros.'
        }
        : {
          motif: 'Frase de dos compases con contorno ascendente y respuesta descendente; reaparece con variación en la segunda estrofa, el puente y el coro final.',
          contour: melodyMotif,
          character: 'Melódico y reconocible, con movimiento conjunto y cierre en la tónica.'
        },
      arrangement: {
        energyCurve: arrangement.map(({ name, energy }) => ({ section: name, energy })),
        subtractionEvents: [
          { at: 'puente', removes: 'batería durante la primera mitad', reason: 'abrir espacio antes del coro final' },
          { at: 'outro', removes: genre === 'metalcore' ? 'guitarra y batería' : 'batería y melodía', reason: 'cerrar con menos densidad' }
        ],
        hook: genre === 'metalcore'
          ? 'El riff de guitarra vuelve recortado en los versos y completo en los coros.'
          : 'El motivo melódico vuelve en el coro y se amplía en el coro final.'
      },
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
      instruments,
      groove: {
        feel: genre === 'metalcore' ? 'half-time' : genre === 'jazz' || genre === 'lofi' ? 'swing ligero' : 'recto',
        swing: genre === 'jazz' ? 0.16 : genre === 'lofi' ? 0.08 : 0,
        pushPull: []
      },
      mix: {
        tips: [
          genre === 'metalcore'
            ? 'Guitarra y batería usan samples reales de tu biblioteca; la guitarra es un loop grabado.'
            : 'Cada rol usa un multisample o un kit coherente de tu biblioteca.',
          ...(warnings.length ? warnings : [
            genre === 'metalcore'
              ? 'La batería usa backbeat half-time y crash al entrar el coro.'
              : 'Batería, bajo, armonía y melodía tienen material asignado.'
          ]),
          'Mueve o recorta los clips en el editor y ajusta volumen, paneo y fades antes de exportar.'
        ]
      }
    },
    authorsNote: genre === 'metalcore'
      ? 'Base instrumental con loop de guitarra eléctrica y muestras de batería de tu biblioteca local; las pistas quedan separadas para edición.'
      : 'Base instrumental creada con samples de tu biblioteca local. Las pistas están separadas para que puedas editar, mover y recortar cada clip antes de exportar.'
  };
}
