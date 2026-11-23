import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { readWavInfo } from './certify.js';
import { readClipFile, renderMidiEvents, renderClipToWavFile } from './midi.js';
import { writeWavFile } from './wav.js';

const AUDIO_EXTS = new Set(['.wav', '.aif', '.aiff', '.mp3', '.flac', '.ogg', '.m4a']);
const MIDI_EXTS = new Set(['.mid', '.midi']);
const CLIP_EXTS = new Set(['.alc']);
const GROOVE_EXTS = new Set(['.agr']);
const SESSION_EXTS = new Set(['.als']);
const BROWSER_AUDIO = new Set(['.wav', '.mp3', '.flac', '.ogg', '.m4a']);
const SKIP_DIRS = new Set([
  'Ableton Folder Info', 'Ableton Project Info', 'Backup', 'backup',
  'node_modules', '.git', '__MACOSX', '$RECYCLE.BIN', 'System Volume Information'
]);
const MAX_ASSETS = 80000;

const state = {
  indexFile: null,
  cacheDir: null,
  roots: [],
  assets: [],
  scanning: false,
  loaded: false
};

function kindFor(ext) {
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (MIDI_EXTS.has(ext)) return 'midi';
  if (CLIP_EXTS.has(ext)) return 'clip';
  if (GROOVE_EXTS.has(ext)) return 'groove';
  if (SESSION_EXTS.has(ext)) return 'session';
  return null;
}

function isPlayable(kind) {
  return kind === 'audio' || kind === 'midi' || kind === 'clip';
}

function assetId(rootId, relPath) {
  return crypto.createHash('sha1').update(`${rootId}|${relPath}`).digest('hex').slice(0, 16);
}

function saveIndex() {
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    roots: state.roots,
    assets: state.assets
  };
  fs.mkdirSync(path.dirname(state.indexFile), { recursive: true });
  fs.writeFileSync(state.indexFile, JSON.stringify(payload));
}

export function initLibrary({ indexFile, cacheDir }) {
  state.indexFile = indexFile;
  state.cacheDir = cacheDir;
  fs.mkdirSync(cacheDir, { recursive: true });
  if (fs.existsSync(indexFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      state.roots = Array.isArray(parsed.roots) ? parsed.roots : [];
      state.assets = Array.isArray(parsed.assets) ? parsed.assets : [];
    } catch {
      state.roots = [];
      state.assets = [];
    }
  }
  state.loaded = true;
  saveIndex();
}

export function getRoots() {
  return state.roots.map((root) => ({
    ...root,
    assetCount: state.assets.filter((asset) => asset.rootId === root.id).length
  }));
}

export function addRoot(input) {
  const raw = String(input || '').trim().replace(/^"(.*)"$/, '$1');
  if (!raw) throw Object.assign(new Error('Indica una ruta de carpeta'), { status: 400 });
  const resolved = path.resolve(raw);
  if (resolved === path.parse(resolved).root) {
    throw Object.assign(new Error('No añadas la raíz de una unidad completa; elige una carpeta concreta.'), { status: 400 });
  }
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    throw Object.assign(new Error('La carpeta no existe o no es accesible.'), { status: 400 });
  }
  if (!stat.isDirectory()) throw Object.assign(new Error('La ruta no es una carpeta.'), { status: 400 });
  const existing = state.roots.find((root) => root.path.toLowerCase() === resolved.toLowerCase());
  if (existing) return existing;
  const root = {
    id: crypto.createHash('sha1').update(resolved.toLowerCase()).digest('hex').slice(0, 12),
    name: path.basename(resolved) || resolved,
    path: resolved,
    addedAt: new Date().toISOString(),
    lastScanAt: null,
    assetCount: 0
  };
  state.roots.push(root);
  saveIndex();
  return root;
}

export function removeRoot(id) {
  const before = state.roots.length;
  state.roots = state.roots.filter((root) => root.id !== id);
  if (state.roots.length === before) throw Object.assign(new Error('Carpeta no encontrada'), { status: 404 });
  state.assets = state.assets.filter((asset) => asset.rootId !== id);
  saveIndex();
  return { ok: true };
}

function readAiffInfo(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(65536);
    const bytes = fs.readSync(fd, header, 0, header.length, 0);
    fs.closeSync(fd);
    if (header.toString('ascii', 0, 4) !== 'FORM') return null;
    const view = header.subarray(0, bytes);
    let offset = 12;
    while (offset + 8 <= view.length) {
      const id = view.toString('ascii', offset, offset + 4);
      const size = view.readUInt32BE(offset + 4);
      if (id === 'COMM' && offset + 8 + 18 <= view.length) {
        const channels = view.readUInt16BE(offset + 8);
        const frames = view.readUInt32BE(offset + 10);
        const bits = view.readUInt16BE(offset + 14);
        const expon = view.readUInt16BE(offset + 16) & 0x7fff;
        const hi = view.readUInt32BE(offset + 18);
        const lo = view.readUInt32BE(offset + 22);
        const mantissa = hi * 4294967296 + lo;
        const sampleRate = expon === 0 && mantissa === 0 ? 0 : mantissa * 2 ** (expon - 16383 - 63);
        return {
          channels,
          sampleRate,
          bits,
          bytes: fs.statSync(filePath).size,
          duration: sampleRate ? Number((frames / sampleRate).toFixed(2)) : null
        };
      }
      offset += 8 + size + (size % 2);
    }
    return null;
  } catch {
    return null;
  }
}

function tagsFor(relPath) {
  const parts = relPath.split('/');
  const folders = parts.slice(0, -1);
  return {
    folders,
    tags: folders.slice(-3),
    category: folders.slice(0, 2).join(' / ') || 'Biblioteca'
  };
}

function bpmFromName(name) {
  const match = name.match(/(\d{2,3})\s*bpm/i);
  return match ? Number(match[1]) : null;
}

function keyFromName(name) {
  const match = name.match(/(?:^|[\s_\-([{])([A-G][#b]?)(m|min|minor|maj|major)(?=[\s_\-.·)\]}0-9]|$)/i);
  if (!match) return null;
  const quality = /min|^m$/i.test(match[2]) ? 'm' : '';
  return `${match[1]}${quality}`;
}

async function walk(root, relative, depth, output) {
  if (output.length >= MAX_ASSETS) return;
  const dir = relative ? path.join(root.path, ...relative.split('/')) : root.path;
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (depth >= 16 || SKIP_DIRS.has(entry.name)) continue;
      await walk(root, relative ? `${relative}/${entry.name}` : entry.name, depth + 1, output);
      if (output.length >= MAX_ASSETS) return;
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    const kind = kindFor(ext);
    if (!kind) continue;
    const relPath = relative ? `${relative}/${entry.name}` : entry.name;
    const fullPath = path.join(root.path, ...relPath.split('/'));
    let stat;
    try {
      stat = await fsp.stat(fullPath);
    } catch {
      continue;
    }
    const meta = tagsFor(relPath);
    const asset = {
      id: assetId(root.id, relPath),
      rootId: root.id,
      relPath,
      name: entry.name,
      ext,
      kind,
      playable: isPlayable(kind),
      size: stat.size,
      mtime: Math.floor(stat.mtimeMs),
      duration: null,
      bpm: bpmFromName(entry.name),
      musicalKey: keyFromName(entry.name),
      tags: meta.tags,
      category: meta.category
    };
    if (ext === '.wav') {
      const info = readWavInfo(fullPath);
      if (info) asset.duration = info.duration;
    } else if (ext === '.aif' || ext === '.aiff') {
      const info = readAiffInfo(fullPath);
      if (info) asset.duration = info.duration;
    }
    output.push(asset);
  }
}

async function scanRootInternal(root) {
  const assets = [];
  await walk(root, '', 0, assets);
  state.assets = state.assets.filter((asset) => asset.rootId !== root.id).concat(assets);
  root.assetCount = assets.length;
  root.lastScanAt = new Date().toISOString();
  const byKind = {};
  for (const asset of assets) byKind[asset.kind] = (byKind[asset.kind] || 0) + 1;
  return { rootId: root.id, name: root.name, path: root.path, count: assets.length, byKind };
}

export async function scanRoots(rootIds) {
  if (state.scanning) throw Object.assign(new Error('Ya hay un escaneo en curso.'), { status: 409 });
  const targets = rootIds && rootIds.length
    ? state.roots.filter((root) => rootIds.includes(root.id))
    : state.roots.slice();
  if (!targets.length) throw Object.assign(new Error('No hay carpetas que escanear. Añade una primero.'), { status: 400 });
  state.scanning = true;
  try {
    const results = [];
    for (const root of targets) results.push(await scanRootInternal(root));
    saveIndex();
    return results;
  } finally {
    state.scanning = false;
  }
}

function findRoot(id) {
  return state.roots.find((root) => root.id === id) || null;
}

function publicAsset(asset) {
  const root = findRoot(asset.rootId);
  return {
    id: asset.id,
    name: asset.name,
    stem: asset.name.slice(0, asset.name.length - asset.ext.length),
    ext: asset.ext,
    kind: asset.kind,
    playable: asset.playable,
    duration: asset.duration,
    bpm: asset.bpm,
    musicalKey: asset.musicalKey,
    tags: asset.tags,
    category: asset.category,
    rootId: asset.rootId,
    rootName: root ? root.name : '',
    relPath: asset.relPath,
    size: asset.size,
    url: asset.playable ? `/media/asset/${asset.id}` : null
  };
}

export function queryAssets({ q = '', kind = 'all', rootId = '', limit = 80, offset = 0 } = {}) {
  const tokens = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  let items = state.assets.filter((asset) => {
    if (kind && kind !== 'all' && asset.kind !== kind) return false;
    if (rootId && asset.rootId !== rootId) return false;
    if (!tokens.length) return true;
    const blob = `${asset.name} ${asset.relPath} ${asset.bpm || ''} ${asset.musicalKey || ''}`.toLowerCase();
    return tokens.every((token) => blob.includes(token));
  });
  const counts = {};
  for (const asset of items) counts[asset.kind] = (counts[asset.kind] || 0) + 1;
  items.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' }));
  const total = items.length;
  const max = Math.max(1, Math.min(200, Number(limit) || 80));
  const start = Math.max(0, Number(offset) || 0);
  return {
    total,
    counts,
    items: items.slice(start, start + max).map(publicAsset),
    scanning: state.scanning
  };
}

export function getCatalogAssets() {
  return state.assets.map(publicAsset);
}

export function findAsset(id) {
  const asset = state.assets.find((item) => item.id === id);
  if (!asset) throw Object.assign(new Error('Activo no encontrado'), { status: 404 });
  const root = findRoot(asset.rootId);
  if (!root) throw Object.assign(new Error('La carpeta del activo ya no existe en la biblioteca'), { status: 404 });
  const fullPath = path.join(root.path, ...asset.relPath.split('/'));
  return { asset, root, fullPath };
}

function cachePathFor(asset, fullPath) {
  const key = crypto.createHash('sha1').update(`${fullPath}|${asset.mtime}|${asset.size}`).digest('hex').slice(0, 20);
  return path.join(state.cacheDir, `${key}.wav`);
}

let ffmpegChecked = null;

function ffmpegAvailable() {
  if (ffmpegChecked !== null) return Promise.resolve(ffmpegChecked);
  return new Promise((resolve) => {
    const child = spawn('ffmpeg', ['-version'], { windowsHide: true });
    child.on('error', () => {
      ffmpegChecked = false;
      resolve(false);
    });
    child.on('close', (code) => {
      ffmpegChecked = code === 0;
      resolve(ffmpegChecked);
    });
  });
}

function runFfmpeg(args, timeout = 180000) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(Object.assign(new Error('La conversión de audio tardó demasiado'), { status: 504 }));
    }, timeout);
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(Object.assign(new Error(`No se pudo ejecutar ffmpeg: ${err.message}`), { status: 500 }));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(Object.assign(new Error(`ffmpeg falló al convertir el audio: ${stderr.slice(-400)}`), { status: 422 }));
    });
  });
}

export async function prepareAssetAudio(id) {
  const { asset, fullPath } = findAsset(id);
  if (!asset.playable) {
    throw Object.assign(new Error('Este activo es una referencia de proyecto o groove, no un sonido reproducible.'), { status: 415 });
  }
  if (!fs.existsSync(fullPath)) {
    throw Object.assign(new Error('El archivo ya no está en su carpeta original.'), { status: 404 });
  }
  const ext = asset.ext;
  if (BROWSER_AUDIO.has(ext)) {
    return { file: fullPath, generated: false, asset };
  }
  if (!state.cacheDir) throw Object.assign(new Error('Biblioteca no inicializada'), { status: 500 });
  const cacheFile = cachePathFor(asset, fullPath);
  if (fs.existsSync(cacheFile)) {
    return { file: cacheFile, generated: true, asset };
  }
  if (ext === '.aif' || ext === '.aiff') {
    if (!(await ffmpegAvailable())) {
      throw Object.assign(new Error('Se necesita ffmpeg para convertir AIFF. Instálalo y vuelve a intentarlo.'), { status: 415 });
    }
    try {
      await runFfmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', fullPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', cacheFile]);
    } catch (err) {
      try { fs.unlinkSync(cacheFile); } catch {}
      throw err;
    }
    return { file: cacheFile, generated: true, asset };
  }
  if (asset.kind === 'midi' || asset.kind === 'clip') {
    try {
      const clip = readClipFile(fullPath, ext);
      const renderRes = await renderClipToWavFile({
        filePath: ext === '.mid' || ext === '.midi' ? fullPath : null,
        notes: clip.notes,
        tempo: clip.tempo,
        category: `${asset.category} ${asset.tags.join(' ')}`,
        name: asset.name,
        outputPath: cacheFile
      });
      const wavInfo = readWavInfo(cacheFile);
      return {
        file: cacheFile,
        generated: true,
        asset,
        render: {
          instrument: renderRes.instrument,
          method: renderRes.method,
          duration: wavInfo ? wavInfo.duration : clip.duration,
          noteCount: clip.noteCount,
          tempo: clip.tempo,
          timeSignature: clip.timeSignature
        }
      };
    } catch (err) {
      try { fs.unlinkSync(cacheFile); } catch {}
      throw Object.assign(new Error(`No se pudo renderizar el clip MIDI: ${err.message}`), { status: 422 });
    }
  }
  throw Object.assign(new Error('Formato de activo no reproducible'), { status: 415 });
}

export function assetInfo(id) {
  const { asset, fullPath } = findAsset(id);
  const info = { asset: publicAsset(asset) };
  if (asset.ext === '.mid' || asset.ext === '.midi' || asset.ext === '.alc') {
    try {
      const clip = readClipFile(fullPath, asset.ext);
      info.clip = {
        tempo: clip.tempo,
        timeSignature: clip.timeSignature,
        duration: clip.duration,
        noteCount: clip.noteCount,
        clipName: clip.clipName || asset.name
      };
    } catch (err) {
      info.clipError = err.message;
    }
  }
  return info;
}

export async function detectAbletonRoots() {
  const candidates = [];
  const home = os.homedir();
  const docs = path.join(home, 'Documents');
  const abletonDocs = path.join(docs, 'Ableton');

  // Ableton Live
  candidates.push(path.join(abletonDocs, 'User Library'));
  candidates.push(path.join(abletonDocs, 'Factory Packs'));
  candidates.push(path.join(abletonDocs, 'Live Recordings'));
  candidates.push(path.join(home, 'Music', 'Ableton', 'User Library'));

  const programData = process.env.ProgramData || 'C:\\ProgramData';
  const liveDir = path.join(programData, 'Ableton');
  try {
    const versions = fs.readdirSync(liveDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^Live\s+\d+/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) {
      candidates.push(path.join(liveDir, version, 'Resources', 'Core Library'));
    }
  } catch {}

  // Toontrack / EZdrummer 3 Grooves & Libraries
  const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  candidates.push(path.join(progFilesX86, 'Common Files', 'Toontrack', 'EZDrummer', 'Midi'));
  candidates.push(path.join(programData, 'Toontrack', 'EZdrummer 3'));
  candidates.push(path.join(programData, 'Toontrack', 'Superior Drummer 3'));
  candidates.push(path.join(docs, 'Toontrack'));

  // User Packs & User MIDIs
  candidates.push(path.join(docs, 'Packs'));
  candidates.push(path.join(docs, 'Sobras_Cicatrices_Remix'));
  candidates.push(path.join(docs, 'bateria fotos y demas'));
  candidates.push(path.join(home, 'musica-ia', '06-midi'));

  const added = [];
  for (const candidate of candidates) {
    try {
      if (!fs.statSync(candidate).isDirectory()) continue;
    } catch {
      continue;
    }
    const exists = state.roots.some((root) => root.path.toLowerCase() === path.resolve(candidate).toLowerCase());
    if (!exists) {
      const root = addRoot(candidate);
      added.push(root.path);
    }
  }
  return { added, roots: getRoots() };
}
