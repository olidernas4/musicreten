import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { encodeWav } from './src/wav.js';
import { generateSong } from './src/generator.js';
import { composeLibrarySong } from './src/libraryComposer.js';
import { runAgent, genreCatalog } from './src/agents.js';
import {
  initLibrary, getRoots, addRoot, removeRoot, scanRoots, queryAssets,
  prepareAssetAudio, assetInfo, detectAbletonRoots
} from './src/library.js';
import {
  APP_NAME, APP_VERSION, ensureDirs, sha256File, createWork, verifyWork, readRegistry,
  writeRegistry, buildCertificateHTML, entryHashFor, readWavInfo
} from './src/certify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4321);
const HOST = process.env.HOST || '127.0.0.1';

const publicDir = path.join(__dirname, 'public');
const dataDir = path.join(__dirname, 'data');
const generatedDir = path.join(dataDir, 'generated');
const separatedDir = path.join(dataDir, 'separated');
const worksDir = path.join(dataDir, 'works');
const tmpDir = path.join(dataDir, 'tmp');
const registryFile = path.join(dataDir, 'registry', 'index.json');
const assetsDir = path.join(dataDir, 'assets');
const assetCacheDir = path.join(assetsDir, 'cache');
const importedDir = path.join(assetsDir, 'imported');
const libraryIndexFile = path.join(assetsDir, 'index.json');
ensureDirs(publicDir, generatedDir, separatedDir, worksDir, tmpDir, path.dirname(registryFile), assetCacheDir, importedDir);

if (!fs.existsSync(registryFile)) writeRegistry(registryFile, { version: 1, works: [] });
initLibrary({ indexFile: libraryIndexFile, cacheDir: assetCacheDir });
let separationInProgress = false;
const separationJobs = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.txt': 'text/plain; charset=utf-8',
  '.sha256': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(text);
}

async function readJsonBody(req, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Cuerpo demasiado grande'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function resolveStatic(base, relative) {
  const safe = path.normalize(relative).replace(/^(\.\.[\\/])+/, '');
  const full = path.join(base, safe);
  if (!full.startsWith(path.normalize(base + path.sep))) return null;
  return full;
}

function serveFile(res, filePath, download = false) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    sendText(res, 404, 'Archivo no encontrado');
    return;
  }
  if (!stat.isFile()) {
    sendText(res, 404, 'Archivo no encontrado');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.wav' ? 'public, max-age=3600' : 'no-store'
  };
  if (download) headers['Content-Disposition'] = `attachment; filename="${path.basename(filePath)}"`;
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

async function handleGenerate(req, res) {
  const body = await readJsonBody(req);
  const song = generateSong(body);
  const dir = path.join(generatedDir, song.id);
  fs.mkdirSync(dir, { recursive: true });
  const files = {
    mix: 'mezcla.wav',
    drums: 'bateria.wav',
    bass: 'bajo.wav',
    harmony: 'armonia.wav',
    melody: 'melodia.wav',
    fx: 'efectos.wav'
  };
  const written = {};
  for (const [key, name] of Object.entries(files)) {
    let channels;
    if (key === 'mix') {
      channels = [song.master.L, song.master.R];
    } else {
      channels = [song.stems[key === 'drums' ? 'drums' : key === 'bass' ? 'bajo' : key === 'harmony' ? 'armonia' : key === 'melody' ? 'melodia' : 'fx']];
    }
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, encodeWav(channels, song.sampleRate));
    written[key] = `/media/generated/${song.id}/${name}`;
  }
  const meta = {
    id: song.id,
    title: song.title,
    genre: song.genre,
    genreLabel: song.genreLabel,
    mood: song.mood,
    bpm: song.bpm,
    key: song.key,
    mode: song.mode,
    bars: song.bars,
    seed: song.seed,
    duration: song.duration,
    musicalDuration: song.musicalDuration,
    sampleRate: song.sampleRate,
    createdAt: song.createdAt,
    prompt: song.prompt,
    detected: song.detected,
    spec: song.spec,
    authorsNote: song.authorsNote,
    files: written
  };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  sendJson(res, 200, { ok: true, song: meta });
}

function runDemucs(inputPath, outputPath, onProgress, timeout = 30 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const configuredPython = process.env.DEMUCS_PYTHON;
    const command = configuredPython || (process.platform === 'win32' ? 'py' : 'python3');
    const pythonArgs = configuredPython ? [] : (process.platform === 'win32' ? ['-3.12'] : []);
    const args = [
      ...pythonArgs, '-m', 'demucs', '--device', 'cpu', '--name', 'htdemucs',
      '--out', outputPath, inputPath
    ];
    const child = spawn(command, args, { windowsHide: true });
    let stderr = '';
    let progressOutput = '';
    let lastReportedProgress = -1;
    const timer = setTimeout(() => {
      child.kill();
      reject(Object.assign(new Error('La separación superó el límite de 30 minutos.'), { status: 504 }));
    }, timeout);
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
      progressOutput = (progressOutput + text).slice(-2000);
      for (const match of progressOutput.matchAll(/(\d{1,3})%\|/g)) {
        const progress = Number(match[1]);
        if (progress !== lastReportedProgress) {
          lastReportedProgress = progress;
          onProgress(progress);
        }
      }
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(Object.assign(new Error(`No se pudo iniciar Python para separar el audio: ${err.message}`), { status: 503 }));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve();
      if (/No module named demucs|ModuleNotFoundError:.*demucs/i.test(stderr)) {
        return reject(Object.assign(new Error('Demucs no está instalado. Instala las dependencias de audio indicadas en el README.'), { status: 503 }));
      }
      reject(Object.assign(new Error(`Demucs no pudo separar el audio: ${stderr.slice(-700).trim() || `código ${code}`}`), { status: 422 }));
    });
  });
}

async function finishSeparationJob(job, inputPath, jobDir, rawName, ext) {
  const stemNames = [
    { key: 'drums', label: 'Batería' },
    { key: 'bass', label: 'Bajo' },
    { key: 'vocals', label: 'Voz' },
    { key: 'other', label: 'Otros instrumentos' }
  ];
  try {
    job.stage = 'Separando batería, bajo, voz y otros instrumentos';
    await runDemucs(inputPath, path.join(jobDir, 'output'), (percent) => {
      job.progress = Math.max(job.progress, Math.min(94, percent * 0.94));
    });
    job.progress = 95;
    job.stage = 'Preparando los cuatro archivos de audio';
    const demucsDir = path.join(jobDir, 'output', 'htdemucs', `separate-${job.id}`);
    job.stems = stemNames.map((stem) => {
      const source = path.join(demucsDir, `${stem.key}.wav`);
      if (!fs.existsSync(source)) {
        throw Object.assign(new Error(`Demucs terminó sin producir la pista «${stem.label}».`), { status: 422 });
      }
      const target = path.join(jobDir, `${stem.key}.wav`);
      fs.copyFileSync(source, target);
      return { ...stem, url: `/media/separated/${job.id}/${stem.key}.wav` };
    });
    fs.rmSync(path.join(jobDir, 'output'), { recursive: true, force: true });
    job.progress = 100;
    job.stage = 'Separación terminada';
    job.status = 'complete';
    job.completedAt = Date.now();
  } catch (err) {
    job.error = err.message || 'No se pudo separar la canción.';
    job.status = 'error';
    job.completedAt = Date.now();
    fs.rmSync(jobDir, { recursive: true, force: true });
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
    separationInProgress = false;
  }
}

async function handleSeparateAudio(req, res) {
  if (separationInProgress) {
    req.resume();
    return sendJson(res, 409, { ok: false, error: 'Ya hay una separación en curso. Espera a que termine.' });
  }
  let rawName;
  try {
    rawName = decodeURIComponent(String(req.headers['x-file-name'] || 'cancion.wav'));
  } catch {
    req.resume();
    return sendJson(res, 400, { ok: false, error: 'El nombre del archivo no es válido.' });
  }
  const ext = path.extname(rawName).toLowerCase();
  const supported = new Set(['.wav', '.mp3', '.flac', '.ogg', '.aif', '.aiff', '.m4a']);
  if (!supported.has(ext)) {
    req.resume();
    return sendJson(res, 415, { ok: false, error: 'Formato no admitido. Usa WAV, AIFF, MP3, FLAC, OGG o M4A.' });
  }

  separationInProgress = true;
  const jobId = crypto.randomUUID();
  const inputPath = path.join(tmpDir, `separate-${jobId}${ext}`);
  const jobDir = path.join(separatedDir, jobId);
  try {
    const { size } = await saveUpload(req, inputPath);
    if (size < 1000) throw Object.assign(new Error('El archivo está vacío o es demasiado pequeño.'), { status: 400 });
    fs.mkdirSync(jobDir, { recursive: true });
    const job = {
      id: jobId,
      fileName: path.basename(rawName, ext),
      status: 'processing',
      progress: 0,
      stage: 'Archivo recibido; preparando el motor de separación',
      stems: null,
      error: null,
      createdAt: Date.now()
    };
    separationJobs.set(jobId, job);
    sendJson(res, 202, { ok: true, jobId, status: job.status });
    void finishSeparationJob(job, inputPath, jobDir, rawName, ext);
  } catch (err) {
    fs.rmSync(jobDir, { recursive: true, force: true });
    try { fs.unlinkSync(inputPath); } catch {}
    separationInProgress = false;
    throw err;
  }
}

function getSeparationJob(res, jobId) {
  const job = separationJobs.get(jobId);
  if (!job) return sendJson(res, 404, { ok: false, error: 'No se encontró el trabajo de separación.' });
  sendJson(res, 200, {
    ok: true,
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    error: job.error,
    fileName: job.fileName,
    stems: job.stems
  });
}

function safeImportPath(raw) {
  const normalized = String(raw || '').replace(/\\/g, '/');
  const segments = normalized.split('/')
    .map((segment) => segment.replace(/[<>:"|?*\u0000-\u001f]/g, '_').trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .slice(-6);
  return segments.join('/');
}

function uniqueImportPath(destPath) {
  if (!fs.existsSync(destPath)) return destPath;
  const ext = path.extname(destPath);
  const base = destPath.slice(0, destPath.length - ext.length);
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!fs.existsSync(candidate)) return candidate;
  }
  return `${base}-${Date.now()}${ext}`;
}

async function handleAssetImport(req, res) {
  const raw = decodeURIComponent(String(req.headers['x-file-name'] || ''));
  const ext = path.extname(raw).toLowerCase();
  if (!['.wav', '.aif', '.aiff', '.mp3', '.flac', '.ogg', '.m4a'].includes(ext)) {
    return sendJson(res, 415, { ok: false, error: 'Formato no admitido. Usa WAV, AIFF, MP3, FLAC, OGG o M4A.' });
  }
  const relPath = safeImportPath(raw);
  if (!relPath || path.extname(relPath).toLowerCase() !== ext) {
    return sendJson(res, 400, { ok: false, error: 'Nombre de archivo no válido.' });
  }
  const dest = path.resolve(importedDir, ...relPath.split('/'));
  if (!dest.startsWith(path.resolve(importedDir) + path.sep)) {
    return sendJson(res, 403, { ok: false, error: 'Ruta de importación no permitida.' });
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const finalPath = uniqueImportPath(dest);
  const saved = await saveUpload(req, finalPath, 300 * 1024 * 1024);
  const root = addRoot(importedDir);
  return sendJson(res, 200, {
    ok: true,
    rootId: root.id,
    root,
    file: path.relative(importedDir, finalPath).split(path.sep).join('/'),
    size: saved.size,
    sha256: saved.hash
  });
}

function runExportFfmpeg(args, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(Object.assign(new Error('La exportación tardó demasiado.'), { status: 504 }));
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
      else reject(Object.assign(new Error(`ffmpeg no pudo exportar el audio: ${stderr.slice(-400)}`), { status: 422 }));
    });
  });
}

async function handleExportAudio(req, res, url) {
  const format = String(url.searchParams.get('format') || 'mp3').toLowerCase();
  const formats = {
    mp3: { ext: 'mp3', mime: 'audio/mpeg', args: ['-codec:a', 'libmp3lame', '-b:a', '320k', '-ar', '44100'] },
    flac: { ext: 'flac', mime: 'audio/flac', args: ['-codec:a', 'flac', '-compression_level', '8'] },
    ogg: { ext: 'ogg', mime: 'audio/ogg', args: ['-codec:a', 'libvorbis', '-q:a', '6'] },
    m4a: { ext: 'm4a', mime: 'audio/mp4', args: ['-codec:a', 'aac', '-b:a', '256k'] }
  };
  const target = formats[format];
  if (!target) return sendJson(res, 400, { ok: false, error: 'Formato de exportación no admitido. Usa mp3, flac, ogg o m4a.' });
  const token = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const input = path.join(tmpDir, `export-${token}.wav`);
  const output = path.join(tmpDir, `export-${token}.${target.ext}`);
  try {
    const saved = await saveUpload(req, input, 300 * 1024 * 1024);
    if (!saved.size) return sendJson(res, 400, { ok: false, error: 'No se recibió audio para exportar.' });
    await runExportFfmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-vn', ...target.args, output]);
    const stat = fs.statSync(output);
    const rawName = decodeURIComponent(String(req.headers['x-file-name'] || `obra.${target.ext}`));
    const base = path.basename(rawName, path.extname(rawName))
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim().replace(/\s+/g, '-').slice(0, 60) || 'obra';
    res.writeHead(200, {
      'Content-Type': target.mime,
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${base}.${target.ext}"`,
      'Cache-Control': 'no-store'
    });
    res.end(fs.readFileSync(output));
  } finally {
    for (const file of [input, output]) {
      try { fs.unlinkSync(file); } catch {}
    }
  }
}

async function saveUpload(req, destPath, maxBytes = 300 * 1024 * 1024) {
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(destPath);
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxBytes) {
        const err = new Error('El archivo supera el limite de 300 MB');
        err.status = 413;
        throw err;
      }
      hash.update(chunk);
      if (!out.write(chunk)) await once(out, 'drain');
    }
    out.end();
    await once(out, 'finish');
    return { hash: hash.digest('hex'), size };
  } catch (err) {
    out.destroy();
    try { fs.unlinkSync(destPath); } catch {}
    throw err;
  }
}

async function handleCreateWork(req, res) {
  const header = req.headers['x-work-meta'];
  if (!header) return sendJson(res, 400, { ok: false, error: 'Falta la cabecera x-work-meta con los datos de la obra.' });
  let meta;
  try {
    const json = Buffer.from(String(header), 'base64url').toString('utf8');
    meta = JSON.parse(json);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Los metadatos de la obra no son validos.' });
  }
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.includes('audio/') && !contentType.includes('application/octet-stream')) {
    return sendJson(res, 415, { ok: false, error: 'Debes enviar un archivo de audio WAV.' });
  }
  const tmpPath = path.join(tmpDir, `${crypto.randomUUID()}.wav`);
  const { hash, size } = await saveUpload(req, tmpPath);
  if (size < 1000) {
    try { fs.unlinkSync(tmpPath); } catch {}
    return sendJson(res, 400, { ok: false, error: 'El archivo de audio esta vacio o es demasiado pequeno.' });
  }
  const info = readWavInfo(tmpPath);
  if (!info) {
    try { fs.unlinkSync(tmpPath); } catch {}
    return sendJson(res, 400, { ok: false, error: 'El archivo no es un WAV valido.' });
  }
  meta.duration = meta.duration || info.duration;
  meta.sampleRate = meta.sampleRate || info.sampleRate;
  meta.generator = meta.generator || {};
  const entry = await createWork({ filePath: tmpPath, hash, meta, paths: { worksDir, registryFile } });
  try { fs.unlinkSync(tmpPath); } catch {}
  sendJson(res, 200, {
    ok: true,
    work: entry,
    urls: {
      certificate: `/api/works/${entry.id}/certificate`,
      json: `/api/works/${entry.id}/json`,
      text: `/api/works/${entry.id}/text`,
      audio: `/media/works/${entry.id}/master.wav`,
      verify: `/verificar/${entry.id}`
    }
  });
}

function listWorks() {
  const registry = readRegistry(registryFile);
  return registry.works.slice().reverse().map((entry) => ({
    folio: entry.folio,
    id: entry.id,
    title: entry.title,
    author: entry.author,
    license: entry.license,
    hash: entry.hash,
    duration: entry.duration,
    createdAt: entry.createdAt,
    coauthors: entry.coauthors,
    projectSession: entry.projectSession || '',
    modelLicenses: entry.modelLicenses || ''
  }));
}

function findWork(id) {
  const registry = readRegistry(registryFile);
  return registry.works.find((w) => w.id === id || w.folio === id) || null;
}

function verificationPage(entry, verification) {
  const checks = verification.checks.map((c) => `
    <li class="${c.ok ? 'ok' : 'bad'}"><strong>${c.ok ? 'OK' : 'FALLO'}</strong> — ${c.name}<br><span>${c.detail}</span></li>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verificacion ${entry.folio}</title>
<style>body{font-family:system-ui,sans-serif;background:#12111a;color:#eee;margin:0;padding:32px}.card{max-width:760px;margin:0 auto;background:#1b1a25;border:1px solid #302e3e;border-radius:18px;padding:28px}h1{font-size:22px;margin:0 0 6px}.muted{color:#9d9aae;font-size:13px;line-height:1.6}.status{display:inline-block;padding:6px 14px;border-radius:999px;font-weight:700;font-size:13px;margin:14px 0}.ok-bg{background:#123d2a;color:#6ef2a8}.bad-bg{background:#4a1720;color:#ff8fa1}ul{list-style:none;padding:0}li{background:#232130;border-radius:12px;padding:12px 14px;margin:8px 0;font-size:13px}li.ok{border-left:4px solid #46d18a}li.bad{border-left:4px solid #ff5f7a}span{color:#9d9aae;font-size:11.5px;word-break:break-all}code{background:#12111a;padding:2px 6px;border-radius:6px;font-size:11px;word-break:break-all}a{color:#a99bff}.hash{background:#12111a;padding:12px;border-radius:10px;font-size:11px;word-break:break-all;margin:8px 0}</style>
</head><body><div class="card">
<h1>Verificacion de autoria</h1>
<p class="muted">${entry.title} · ${entry.author.name}<br>Folio <code>${entry.folio}</code> · Registrado ${new Date(entry.createdAt).toLocaleString('es-ES')}</p>
<div class="status ${verification.ok ? 'ok-bg' : 'bad-bg'}">${verification.ok ? 'VERIFICADO' : 'NO VERIFICADO'}</div>
<ul>${checks}</ul>
<p class="muted">Huella esperada</p><div class="hash">${verification.expectedHash}</div>
${verification.actualHash ? `<p class="muted">Huella del archivo en disco</p><div class="hash">${verification.actualHash}</div>` : ''}
<p class="muted">Verificado el ${new Date(verification.verifiedAt).toLocaleString('es-ES')} · ${APP_NAME} v${APP_VERSION}</p>
<p class="muted"><a href="/api/works/${entry.id}/certificate">Ver certificado</a> · <a href="/">Volver al estudio</a></p>
</div></body></html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, app: APP_NAME, version: APP_VERSION, registry: readRegistry(registryFile).works.length });
    }

    if (pathname === '/api/generate' && req.method === 'POST') {
      return await handleGenerate(req, res);
    }

    if (pathname === '/api/generate' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, message: 'Envia POST con { genre, mood, key, bpm, duration, seed, prompt }.' });
    }

    if (pathname === '/api/compose/library' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const song = composeLibrarySong(body);
      return sendJson(res, 200, { ok: true, song });
    }

    if (pathname === '/api/separate' && req.method === 'POST') {
      return await handleSeparateAudio(req, res);
    }

    const separationJobMatch = pathname.match(/^\/api\/separate\/([0-9a-f-]+)$/i);
    if (separationJobMatch && req.method === 'GET') {
      return getSeparationJob(res, separationJobMatch[1]);
    }

    if (pathname === '/api/export' && req.method === 'POST') {
      return await handleExportAudio(req, res, url);
    }

    if (pathname === '/api/assets/import' && req.method === 'POST') {
      return await handleAssetImport(req, res);
    }

    if (pathname === '/api/catalog' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, genres: genreCatalog() });
    }

    if (pathname === '/api/agent' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body || !body.agent) return sendJson(res, 400, { ok: false, error: 'Falta el agente.' });
      const result = runAgent(body.agent, body.payload || {});
      return sendJson(res, 200, { ok: true, result });
    }

    if (pathname === '/api/assets/roots' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, roots: getRoots() });
    }

    if (pathname === '/api/assets/roots' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const root = addRoot(body.path);
      return sendJson(res, 200, { ok: true, root, roots: getRoots() });
    }

    const rootDelete = pathname.match(/^\/api\/assets\/roots\/([^/]+)$/);
    if (rootDelete && req.method === 'DELETE') {
      removeRoot(rootDelete[1]);
      return sendJson(res, 200, { ok: true, roots: getRoots() });
    }

    if (pathname === '/api/assets/detect' && req.method === 'POST') {
      return sendJson(res, 200, { ok: true, ...(await detectAbletonRoots()) });
    }

    if (pathname === '/api/assets/scan' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const results = await scanRoots(body.rootId ? [body.rootId] : []);
      return sendJson(res, 200, { ok: true, results, roots: getRoots(), total: getRoots().reduce((sum, root) => sum + root.assetCount, 0) });
    }

    if (pathname === '/api/assets' && req.method === 'GET') {
      const result = queryAssets({
        q: url.searchParams.get('q') || '',
        kind: url.searchParams.get('kind') || 'all',
        rootId: url.searchParams.get('root') || '',
        limit: url.searchParams.get('limit') || 80,
        offset: url.searchParams.get('offset') || 0
      });
      return sendJson(res, 200, { ok: true, ...result, roots: getRoots() });
    }

    const assetInfoMatch = pathname.match(/^\/api\/assets\/([^/]+)\/info$/);
    if (assetInfoMatch && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, ...assetInfo(assetInfoMatch[1]) });
    }

    const assetMedia = pathname.match(/^\/media\/asset\/([^/]+)$/);
    if (assetMedia && (req.method === 'GET' || req.method === 'HEAD')) {
      const prepared = await prepareAssetAudio(assetMedia[1]);
      return serveFile(res, prepared.file);
    }

    if (pathname === '/api/works' && req.method === 'POST') {
      return await handleCreateWork(req, res);
    }

    if (pathname === '/api/works' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, works: listWorks() });
    }

    const workJson = pathname.match(/^\/api\/works\/([^/]+)\/json$/);
    if (workJson && req.method === 'GET') {
      const entry = findWork(workJson[1]);
      if (!entry) return sendJson(res, 404, { ok: false, error: 'Obra no encontrada' });
      return sendJson(res, 200, { ok: true, work: entry });
    }

    const workText = pathname.match(/^\/api\/works\/([^/]+)\/text$/);
    if (workText && req.method === 'GET') {
      const entry = findWork(workText[1]);
      if (!entry) return sendJson(res, 404, { ok: false, error: 'Obra no encontrada' });
      const file = path.join(worksDir, entry.id, 'certificate.txt');
      return serveFile(res, file, true);
    }

    const workCert = pathname.match(/^\/api\/works\/([^/]+)\/certificate$/);
    if (workCert && req.method === 'GET') {
      const entry = findWork(workCert[1]);
      if (!entry) return sendText(res, 404, 'Obra no encontrada');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(buildCertificateHTML(entry));
    }

    const verifyMatch = pathname.match(/^\/api\/verify\/([^/]+)$/);
    if (verifyMatch && req.method === 'GET') {
      const entry = findWork(verifyMatch[1]);
      if (!entry) return sendJson(res, 404, { ok: false, error: 'Obra no encontrada' });
      const verification = await verifyWork(entry, path.join(worksDir, entry.id, 'master.wav'));
      return sendJson(res, 200, { ok: true, verification, work: entry });
    }

    const verifyPage = pathname.match(/^\/verificar\/([^/]+)$/);
    if (verifyPage && req.method === 'GET') {
      const entry = findWork(verifyPage[1]);
      if (!entry) return sendText(res, 404, 'Obra no encontrada');
      const verification = await verifyWork(entry, path.join(worksDir, entry.id, 'master.wav'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(verificationPage(entry, verification));
    }

    if (pathname.startsWith('/media/')) {
      const filePath = resolveStatic(dataDir, pathname.replace(/^\/media\//, ''));
      if (!filePath) return sendText(res, 403, 'Acceso denegado');
      const ext = path.extname(filePath).toLowerCase();
      if (!['.wav', '.json', '.html', '.txt', '.sha256'].includes(ext)) return sendText(res, 403, 'Tipo no permitido');
      return serveFile(res, filePath);
    }

    if (pathname.startsWith('/api/')) {
      return sendJson(res, 404, { ok: false, error: 'Ruta de API no encontrada' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendText(res, 405, 'Metodo no permitido');
    }

    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = resolveStatic(publicDir, rel);
    if (!filePath) return sendText(res, 403, 'Acceso denegado');
    return serveFile(res, filePath);
  } catch (err) {
    console.error('[error]', err);
    const status = err.status || 500;
    if (res.headersSent) return res.end();
    sendJson(res, status, { ok: false, error: err.message || 'Error interno' });
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log(`  ${APP_NAME} v${APP_VERSION}`);
  console.log(`  Estudio listo en:  http://${HOST}:${PORT}`);
  console.log(`  Datos locales en:  ${dataDir}`);
  console.log('');
});
