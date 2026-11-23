export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11]
};

const DEGREE_QUALITY_MAJOR = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
const DEGREE_QUALITY_MINOR = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];

const INTERVALS = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  add9: [0, 4, 7, 14],
  min9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  dom9: [0, 4, 7, 10, 14],
  min11: [0, 3, 7, 10, 14, 17],
  six: [0, 4, 7, 9],
  min6: [0, 3, 7, 9]
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export function normalizePc(value) {
  return ((value % 12) + 12) % 12;
}

const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E' };

function notePc(name) {
  const normalized = name.charAt(0).toUpperCase() + name.slice(1);
  if (FLAT_TO_SHARP[normalized]) return NOTE_NAMES.indexOf(FLAT_TO_SHARP[normalized]);
  return NOTE_NAMES.indexOf(normalized);
}

export function parseKey(input) {
  if (!input) return { tonicPc: 0, mode: 'major', label: 'C major' };
  const text = String(input).trim();
  const match = text.match(/^([A-Ga-g])([#b]?)/);
  const isMinor = /minor|menor|min/i.test(text);
  if (!match) return isMinor
    ? { tonicPc: 9, mode: 'minor', label: 'A minor' }
    : { tonicPc: 0, mode: 'major', label: 'C major' };
  const pc = notePc(match[1].toUpperCase() + (match[2] || ''));
  const safePc = pc < 0 ? (isMinor ? 9 : 0) : pc;
  const mode = isMinor ? 'minor' : 'major';
  return { tonicPc: safePc, mode, label: `${NOTE_NAMES[safePc]} ${mode}` };
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi) {
  return NOTE_NAMES[normalizePc(Math.round(midi))] + (Math.floor(midi / 12) - 1);
}

export function scalePcs(tonicPc, mode) {
  const scale = SCALES[mode] || SCALES.major;
  return scale.map((s) => normalizePc(tonicPc + s));
}

export function scaleMidis(tonicPc, mode, lowMidi = 48, highMidi = 84) {
  const pcs = scalePcs(tonicPc, mode);
  const out = [];
  for (let m = lowMidi; m <= highMidi; m++) {
    if (pcs.includes(normalizePc(m))) out.push(m);
  }
  return out;
}

export function romanFor(degree, quality) {
  let roman = ROMAN[degree - 1] || 'I';
  if (quality && quality.startsWith('min')) roman = roman.toLowerCase();
  if (quality === 'dim' || quality === 'm7b5' || quality === 'dim7') roman = roman.toLowerCase() + 'dim';
  if (quality === 'dom7' || quality === 'dom9') roman += '7';
  if (quality === 'maj7' || quality === 'maj9') roman += 'maj7';
  if (quality === 'min7' || quality === 'min9' || quality === 'min11') roman += '7';
  if (quality === 'sus4') roman += 'sus4';
  return roman;
}

export function chordLabel(tonicPc, degree, quality, useFlats = false, mode = 'major') {
  const scale = mode === 'minor' ? SCALES.minor : SCALES.major;
  const pcs = useFlats ? FLAT_NAMES : NOTE_NAMES;
  const root = pcs[normalizePc(tonicPc + scale[degree - 1])];
  const suffixMap = {
    maj: '', min: 'm', dim: 'dim', aug: 'aug', sus2: 'sus2', sus4: 'sus4',
    maj7: 'maj7', min7: 'm7', dom7: '7', m7b5: 'm7b5', dim7: 'dim7',
    add9: 'add9', min9: 'm9', maj9: 'maj9', dom9: '9', min11: 'm11', six: '6', min6: 'm6'
  };
  return root + (suffixMap[quality] || '');
}

export function buildChord(tonicPc, mode, degree, quality, octave = 3) {
  const baseScale = mode === 'minor' ? SCALES.minor : (SCALES[mode] || SCALES.major);
  const rootSemi = baseScale[(degree - 1) % 7];
  const rootPc = normalizePc(tonicPc + rootSemi);
  let baseMidi = 12 * (octave + 1) + rootPc;
  while (baseMidi < 45) baseMidi += 12;
  while (baseMidi > 62) baseMidi -= 12;
  const intervals = INTERVALS[quality] || INTERVALS.maj;
  return intervals.map((i) => baseMidi + i);
}

export function defaultQuality(degree, mode) {
  const table = mode === 'minor' ? DEGREE_QUALITY_MINOR : DEGREE_QUALITY_MAJOR;
  return table[(degree - 1) % 7];
}

const MOOD_LIBRARY = {
  alegre: {
    major: [
      [{ d: 1, q: 'maj' }, { d: 5, q: 'maj' }, { d: 6, q: 'min' }, { d: 4, q: 'maj' }],
      [{ d: 4, q: 'maj' }, { d: 1, q: 'maj' }, { d: 5, q: 'maj' }, { d: 6, q: 'min' }],
      [{ d: 1, q: 'maj' }, { d: 4, q: 'maj' }, { d: 6, q: 'min' }, { d: 5, q: 'maj' }]
    ],
    minor: [
      [{ d: 1, q: 'min' }, { d: 6, q: 'maj' }, { d: 3, q: 'maj' }, { d: 7, q: 'maj' }],
      [{ d: 1, q: 'min' }, { d: 4, q: 'min' }, { d: 6, q: 'maj' }, { d: 7, q: 'maj' }]
    ]
  },
  epico: {
    major: [
      [{ d: 6, q: 'min' }, { d: 4, q: 'maj' }, { d: 1, q: 'maj' }, { d: 5, q: 'maj' }],
      [{ d: 1, q: 'maj' }, { d: 5, q: 'maj' }, { d: 6, q: 'min' }, { d: 4, q: 'maj' }]
    ],
    minor: [
      [{ d: 1, q: 'min' }, { d: 6, q: 'maj' }, { d: 3, q: 'maj' }, { d: 7, q: 'maj' }],
      [{ d: 1, q: 'min' }, { d: 4, q: 'min' }, { d: 7, q: 'maj' }, { d: 3, q: 'maj' }]
    ]
  },
  romantico: {
    major: [
      [{ d: 1, q: 'maj' }, { d: 6, q: 'min' }, { d: 4, q: 'maj' }, { d: 5, q: 'maj' }],
      [{ d: 4, q: 'maj7' }, { d: 5, q: 'dom7' }, { d: 3, q: 'min7' }, { d: 6, q: 'min7' }]
    ],
    minor: [
      [{ d: 1, q: 'min' }, { d: 6, q: 'maj' }, { d: 4, q: 'min' }, { d: 5, q: 'maj' }],
      [{ d: 6, q: 'maj7' }, { d: 3, q: 'maj7' }, { d: 7, q: 'dom7' }, { d: 1, q: 'min' }]
    ]
  },
  melancolico: {
    major: [
      [{ d: 6, q: 'min' }, { d: 4, q: 'maj' }, { d: 1, q: 'maj' }, { d: 5, q: 'maj' }],
      [{ d: 1, q: 'maj' }, { d: 3, q: 'min' }, { d: 4, q: 'maj' }, { d: 4, q: 'min' }]
    ],
    minor: [
      [{ d: 1, q: 'min' }, { d: 6, q: 'maj' }, { d: 3, q: 'maj' }, { d: 7, q: 'maj' }],
      [{ d: 1, q: 'min' }, { d: 4, q: 'min' }, { d: 6, q: 'maj' }, { d: 5, q: 'maj' }]
    ]
  },
  misterioso: {
    major: [
      [{ d: 2, q: 'min7' }, { d: 5, q: 'dom7' }, { d: 1, q: 'maj7' }, { d: 6, q: 'min7' }],
      [{ d: 1, q: 'min' }, { d: 6, q: 'maj' }, { d: 2, q: 'dim' }, { d: 5, q: 'maj' }]
    ],
    minor: [
      [{ d: 1, q: 'min9' }, { d: 6, q: 'maj7' }, { d: 3, q: 'maj7' }, { d: 7, q: 'dom7' }],
      [{ d: 1, q: 'min' }, { d: 2, q: 'dim' }, { d: 5, q: 'min' }, { d: 1, q: 'min' }]
    ]
  },
  energetico: {
    major: [
      [{ d: 1, q: 'maj' }, { d: 4, q: 'maj' }, { d: 6, q: 'min' }, { d: 5, q: 'maj' }],
      [{ d: 1, q: 'maj' }, { d: 7, q: 'maj' }, { d: 4, q: 'maj' }, { d: 1, q: 'maj' }]
    ],
    minor: [
      [{ d: 1, q: 'min' }, { d: 7, q: 'maj' }, { d: 6, q: 'maj' }, { d: 7, q: 'maj' }],
      [{ d: 1, q: 'min' }, { d: 4, q: 'min' }, { d: 7, q: 'maj' }, { d: 1, q: 'min' }]
    ]
  },
  relajado: {
    major: [
      [{ d: 2, q: 'min7' }, { d: 5, q: 'dom7' }, { d: 1, q: 'maj7' }, { d: 6, q: 'min7' }],
      [{ d: 4, q: 'maj7' }, { d: 5, q: 'dom7' }, { d: 3, q: 'min7' }, { d: 6, q: 'min7' }]
    ],
    minor: [
      [{ d: 1, q: 'min7' }, { d: 4, q: 'min7' }, { d: 6, q: 'maj7' }, { d: 5, q: 'dom7' }],
      [{ d: 6, q: 'maj7' }, { d: 7, q: 'dom7' }, { d: 1, q: 'min7' }, { d: 1, q: 'min7' }]
    ]
  }
};

export const MOODS = Object.keys(MOOD_LIBRARY);

export function getProgression(mood, mode, variant = 0) {
  const bucket = MOOD_LIBRARY[mood] || MOOD_LIBRARY.alegre;
  const list = bucket[mode === 'minor' ? 'minor' : 'major'];
  const chosen = list[variant % list.length];
  return chosen.map((step) => ({
    degree: step.d,
    quality: step.q || defaultQuality(step.d, mode)
  }));
}

export function progressionLabels(tonicPc, mode, steps) {
  return steps.map((s) => chordLabel(tonicPc, s.degree, s.quality, mode === 'minor', mode));
}

export function progressionRomans(mode, steps) {
  return steps.map((s) => romanFor(s.degree, s.quality));
}

export function progressionChords(tonicPc, mode, steps, octave = 3) {
  return steps.map((s) => buildChord(tonicPc, mode, s.degree, s.quality, octave));
}

export function suggestTempo(genre) {
  const map = {
    lofi: 78, pop: 108, electronic: 124, cinematic: 72, trap: 72, rock: 120,
    metalcore: 145, acustico: 92, jazz: 96
  };
  return map[genre] || 100;
}

export function genreCatalog() {
  const info = {
    lofi: ['Lo-fi / Chill', [70, 88]],
    pop: ['Pop', [96, 124]],
    electronic: ['Electrónica / EDM', [118, 128]],
    cinematic: ['Cinemática', [60, 84]],
    trap: ['Trap / Urbano', [68, 80]],
    rock: ['Rock', [100, 140]],
    metalcore: ['Metalcore / Post-hardcore', [140, 155]],
    acustico: ['Acústico / Balada', [72, 100]],
    jazz: ['Jazz / Neo-soul', [84, 110]]
  };
  return Object.entries(info).map(([id, [label, bpm]]) => ({ id, label, bpm }));
}

export function detectFromPrompt(prompt) {
  const text = String(prompt || '').toLowerCase();
  const found = { genre: null, mood: null, tempo: null, mode: null };
  if (/\b(?:metalcore|metal[\s-]+core|post[\s-]+hardcore|deathcore|djent|breakdown|heavy metal|thrash)\b/.test(text)) {
    found.genre = 'metalcore';
    found.mode = 'minor';
    found.mood = 'energetico';
    found.tempo = 145;
  }
  const genres = {
    lofi: ['lofi', 'lo-fi', 'chill', 'estudio', 'relax', 'hip hop suave'],
    pop: ['pop', 'comercial', 'radio', 'pegadiza'],
    electronic: ['electronica', 'electrónica', 'edm', 'house', 'techno', 'baile', 'club', 'fiesta'],
    cinematic: ['cinematic', 'cine', 'epic', 'épico', 'orquesta', 'orquestal', 'trailer', 'peli'],
    trap: ['trap', '808', 'urbano', 'reggaeton', 'regueton', 'perreo'],
    rock: ['rock', 'banda', 'guitarra', 'punk', 'metal'],
    acustico: ['acustico', 'acústico', 'guitarra acustica', 'folk', 'balada'],
    jazz: ['jazz', 'swing', 'bossa', 'soul', 'neo soul']
  };
  if (!found.genre) {
    for (const [genre, words] of Object.entries(genres)) {
      if (words.some((w) => text.includes(w))) { found.genre = genre; break; }
    }
  }
  const moods = {
    alegre: ['alegre', 'feliz', 'positivo', 'brillo', 'verano'],
    epico: ['epico', 'épico', 'grande', 'heroico', 'inspirador', 'triunfo'],
    romantico: ['romantico', 'romántico', 'amor', 'corazon', 'corazón', 'balada'],
    melancolico: ['melancolico', 'melancólico', 'triste', 'nostalgia', 'lluvia', 'adios'],
    misterioso: ['misterioso', 'oscuro', 'tension', 'tensión', 'nocturno', 'suspenso'],
    energetico: ['energetico', 'energético', 'rapido', 'rápido', 'potente', 'fuerte', 'gym'],
    relajado: ['relajado', 'calma', 'suave', 'chill', 'dormir', 'ambiente']
  };
  for (const [mood, words] of Object.entries(moods)) {
    if (words.some((w) => text.includes(w))) { found.mood = mood; break; }
  }
  const bpm = text.match(/(\d{2,3})\s*(bpm|pulsos|tempo)/);
  if (bpm) found.tempo = Math.max(50, Math.min(180, Number(bpm[1])));
  if (/menor|triste|melancol|oscuro|nocturno/.test(text)) found.mode = 'minor';
  if (/mayor|alegre|feliz|brillo/.test(text)) found.mode = 'major';
  return found;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
