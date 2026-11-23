import fs from 'node:fs';
import { getCatalogAssets, findAsset } from './library.js';
import { parseMidiFile } from './midi.js';

export const HIT_ROLE = new Map([
  [12, 'kick'], [13, 'kick'], [35, 'kick'], [36, 'kick'],
  [25, 'snare'], [26, 'snare'], [37, 'snare'], [38, 'snare'], [40, 'snare'],
  [39, 'clap'],
  [21, 'hat'], [22, 'hat'], [42, 'hat'], [44, 'hat'], [62, 'hat'],
  [46, 'openHat'], [61, 'openHat'],
  [49, 'cymbal'], [51, 'cymbal'], [52, 'cymbal'], [53, 'cymbal'], [55, 'cymbal'], [57, 'cymbal'], [59, 'cymbal'],
  [24, 'tom'], [41, 'tom'], [43, 'tom'], [45, 'tom'], [47, 'tom'], [48, 'tom'], [50, 'tom'],
  [2, 'shaker'], [3, 'shaker'], [14, 'shaker'], [15, 'shaker'], [16, 'shaker'],
  [54, 'shaker'], [56, 'shaker'], [60, 'shaker'], [63, 'shaker'], [64, 'shaker'], [75, 'shaker'], [80, 'shaker'], [82, 'shaker']
]);

const cache = new Map();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function metadata(asset) {
  const parts = String(asset.relPath || '').split('/').map((part) => part.toLowerCase());
  const feelToken = parts.find((part) => /@(straight|swing)/.test(part)) || '';
  const sectionToken = parts.find((part) => /@(intro|verse|chorus|fill|outro|break|bridge)/.test(part)) || '';
  const feel = /halftime/.test(feelToken) ? 'halftime' : /swing/.test(feelToken) ? 'swing' : 'straight';
  const section = sectionToken ? sectionToken.replace(/^.*@/, '').replace(/[_+]+/g, '-') : 'groove';
  const source = /ezdrummer/.test(parts.join('/')) ? 'EZdrummer 3' :
    /superior/.test(parts.join('/')) ? 'Superior Drummer 3' :
      /whack|breakdown/.test(parts.join('/')) ? 'Packs de usuario' : 'MIDI local';
  return { source, feel, section, meter: feelToken.match(/#(\d+#\d+)/)?.[1] || '4#4' };
}

export function findGrooveAssets(assets = getCatalogAssets()) {
  return assets.filter((asset) => asset.kind === 'midi' && asset.playable);
}

export function describeGrooveLibrary(assets = getCatalogAssets()) {
  const grooves = findGrooveAssets(assets);
  const bySource = {};
  const byFeel = {};
  const bySection = {};
  for (const groove of grooves) {
    const meta = metadata(groove);
    bySource[meta.source] = (bySource[meta.source] || 0) + 1;
    byFeel[meta.feel] = (byFeel[meta.feel] || 0) + 1;
    bySection[meta.section] = (bySection[meta.section] || 0) + 1;
  }
  const kickNames = {};
  for (const asset of assets) {
    if (asset.kind !== 'audio' || !asset.playable) continue;
    if (!/\/drums\/kick\//i.test(asset.relPath)) continue;
    const kit = String(asset.name || '').replace(/\.[^.]+$/, '').replace(/^kick\s+/i, '')
      .replace(/\s+\d+[a-z]?(?:\s|$).*$/i, '').trim();
    if (!kit || kit.length > 28) continue;
    kickNames[kit] = (kickNames[kit] || 0) + 1;
  }
  const kits = Object.entries(kickNames).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name]) => name);
  return { total: grooves.length, bySource, byFeel, bySection, kits };
}

function loadGroove(asset) {
  const key = `${asset.id}:${asset.mtime || 0}`;
  if (cache.has(key)) return cache.get(key);
  const { fullPath } = findAsset(asset.id);
  const parsed = parseMidiFile(fs.readFileSync(fullPath));
  const notes = parsed.notes
    .map((note) => ({
      beat: (note.start * parsed.tempo) / 60,
      role: HIT_ROLE.get(note.pitch) || null,
      velocity: note.velocity,
      pitch: note.pitch
    }))
    .filter((note) => note.role)
    .sort((a, b) => a.beat - b.beat);
  const maxBeat = notes.reduce((max, note) => Math.max(max, note.beat), 0);
  const loaded = {
    ...metadata(asset),
    id: asset.id,
    name: asset.name,
    relPath: asset.relPath,
    tempo: parsed.tempo,
    bars: clamp(Math.ceil(maxBeat / 4), 1, 8),
    notes
  };
  if (cache.size > 600) cache.clear();
  cache.set(key, loaded);
  return loaded;
}

function wantedSection(name) {
  if (/intro/.test(name)) return 'intro';
  if (/verso/.test(name)) return 'verse';
  if (/coro/.test(name)) return 'chorus';
  if (/puente|break/.test(name)) return 'breakdown';
  if (/outro/.test(name)) return 'outro';
  return 'groove';
}

function preferFeel(genre) {
  if (genre === 'trap' || genre === 'cinematic') return 'halftime';
  if (genre === 'lofi' || genre === 'jazz') return 'swing';
  return 'straight';
}

function pickCandidates(pool, wanted, genre, rng, count, preferredFeel = null) {
  const feel = preferredFeel || preferFeel(genre);
  const scored = pool.map((asset) => {
    const meta = metadata(asset);
    let score = rng() * 3;
    if (meta.section === wanted) score += 6;
    if (wanted === 'fill' && /fill|break/.test(meta.section)) score += 8;
    if (meta.section === 'groove') score += 2;
    if (meta.feel === feel) score += 4;
    if (/ezdrummer/i.test(meta.source)) score += 2;
    if (wanted === 'breakdown' && meta.feel === 'halftime') score += 2;
    return { asset, score };
  }).sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.max(8, count * 6));
  const picked = [];
  while (picked.length < count && top.length) {
    const index = Math.floor(rng() * Math.min(top.length, Math.max(4, count * 3)));
    picked.push(top.splice(index, 1)[0].asset);
  }
  return picked;
}

export function planGrooves({ assets = getCatalogAssets(), genre = 'pop', sections = [], rng = Math.random, variety = 50, feel = null } = {}) {
  const pool = findGrooveAssets(assets);
  if (pool.length < 4) return null;
  const variants = variety >= 65 ? 3 : variety >= 30 ? 2 : 1;
  const plan = new Map();
  for (const section of sections) {
    const wanted = feel === 'fills' ? 'fill' : wantedSection(section.name);
    const grooves = pickCandidates(pool, wanted, genre, rng, variants, feel)
      .map(loadGroove).filter((groove) => groove.notes.length && groove.bars);
    const fills = pickCandidates(pool, 'fill', genre, rng, 2, feel)
      .map(loadGroove).filter((groove) => groove.notes.length && groove.bars);
    if (!grooves.length) continue;
    plan.set(section.index, { grooves, fills });
  }
  if (!plan.size) return null;
  return { plan, total: pool.length, variants };
}

export function hitsForBar({ groove, barStart, beatSec, barIndex = 0, rng = Math.random, energy = 1, jitter = 0.004 }) {
  if (!groove || !groove.notes.length) return [];
  let localBar = groove.bars > 1 ? barIndex % groove.bars : 0;
  let hits = groove.notes.filter((note) => Math.floor(note.beat / 4) === localBar);
  if (!hits.length) {
    localBar = 0;
    hits = groove.notes.filter((note) => note.beat < 4);
  }
  const floor = localBar * 4;
  return hits.map((note) => ({
    role: note.role,
    pitch: note.pitch,
    start: Math.max(0, barStart + (note.beat - floor) * beatSec + (rng() * 2 - 1) * jitter),
    gain: clamp((0.3 + (note.velocity / 127) * 0.72) * energy, 0.08, 1.25),
    velocity: note.velocity
  })).sort((a, b) => a.start - b.start);
}
