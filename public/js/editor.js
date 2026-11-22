import { SOUNDS, makeSound } from './synth.js';

const ROW_H = 74;
const RULER_H = 28;
const TRACK_COLORS = ['#79d9be', '#d3f36b', '#ffb77a', '#ff8f87', '#86c9e8', '#b6d982', '#e7a5c5'];

const el = {};
const state = {
  ctx: null,
  master: null,
  tracks: [],
  selection: null,
  playhead: 0,
  playing: false,
  sources: [],
  startTime: 0,
  startPos: 0,
  zoom: 64,
  loop: false,
  raf: null,
  view: null,
  lastExport: null,
  lastSong: null,
  drag: null,
  dragPointer: null,
  projectTitle: 'Mi obra',
  initialized: false
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function notify(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('studio:toast', { detail: { message, type } }));
}

function createTrack(name, color) {
  const track = {
    id: uid(),
    name,
    color: color || TRACK_COLORS[state.tracks.length % TRACK_COLORS.length],
    volume: 1,
    mute: false,
    solo: false,
    clips: []
  };
  state.tracks.push(track);
  return track;
}

function initialTracks() {
  const defs = [
    ['Batería', TRACK_COLORS[0]],
    ['Bajo', TRACK_COLORS[1]],
    ['Armonía', TRACK_COLORS[2]],
    ['Melodía', TRACK_COLORS[3]],
    ['Sonidos', TRACK_COLORS[4]]
  ];
  for (const [name, color] of defs) createTrack(name, color);
}

export function initEditor() {
  if (state.initialized) return;
  state.initialized = true;

  el.canvas = document.getElementById('timeline');
  el.scroll = document.getElementById('canvasScroll');
  el.headers = document.getElementById('trackHeaders');
  el.inspector = document.getElementById('inspector');
  el.btnPlay = document.getElementById('btnPlay');
  el.btnStop = document.getElementById('btnStop');
  el.loop = document.getElementById('loopToggle');
  el.time = document.getElementById('timeDisplay');
  el.fileInput = document.getElementById('fileInput');
  el.btnSounds = document.getElementById('btnSounds');
  el.soundMenu = document.getElementById('soundMenu');
  el.btnExport = document.getElementById('btnExport');
  el.exportFormat = document.getElementById('exportFormat');
  el.usedSounds = document.getElementById('usedSounds');
  el.zoom = document.getElementById('zoom');

  const titleInput = document.getElementById('projectTitle');
  if (titleInput) {
    state.projectTitle = titleInput.value || 'Mi obra';
    titleInput.addEventListener('input', () => { state.projectTitle = titleInput.value || 'Mi obra'; });
  }

  initialTracks();
  buildSoundMenu();
  bindToolbar();
  bindCanvas();
  bindHeaders();
  bindInspector();
  bindKeyboard();
  renderTrackHeaders();
  resizeCanvas();
  draw();
  updateTime();

  const ro = new ResizeObserver(() => resizeCanvas());
  ro.observe(el.scroll);
  window.addEventListener('resize', resizeCanvas);
}

function buildSoundMenu() {
  const groups = new Map();
  for (const sound of SOUNDS) {
    if (!groups.has(sound.group)) groups.set(sound.group, []);
    groups.get(sound.group).push(sound);
  }
  el.soundMenu.innerHTML = [...groups.entries()].map(([group, items]) => `
    <div class="menu-group-label">${escapeHtml(group)}</div>
    ${items.map((s) => `<button data-sound="${s.id}">${escapeHtml(s.label)}<span>${s.seconds.toFixed(1)}s</span></button>`).join('')}
  `).join('');
  el.soundMenu.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-sound]');
    if (!btn) return;
    el.soundMenu.classList.add('hidden');
    await addSound(btn.dataset.sound);
  });
}

function bindToolbar() {
  el.btnPlay.addEventListener('click', async () => {
    ensureAudio();
    if (state.playing) pausePlayback();
    else await startPlayback(state.playhead);
  });
  el.btnStop.addEventListener('click', () => {
    stopPlayback();
    state.playhead = 0;
    updateTime();
    draw();
  });
  el.loop.addEventListener('change', () => { state.loop = el.loop.checked; });
  el.zoom.addEventListener('input', () => {
    state.zoom = Number(el.zoom.value);
    resizeCanvas();
  });
  el.btnSounds.addEventListener('click', (event) => {
    event.stopPropagation();
    el.soundMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', (event) => {
    if (!el.soundMenu.contains(event.target) && event.target !== el.btnSounds) el.soundMenu.classList.add('hidden');
  });
  el.fileInput.addEventListener('change', async () => {
    const files = [...el.fileInput.files];
    el.fileInput.value = '';
    if (files.length) await importFiles(files);
  });
  el.btnExport.addEventListener('click', async () => {
    const format = (el.exportFormat && el.exportFormat.value) || 'wav';
    try {
      el.btnExport.disabled = true;
      el.btnExport.textContent = 'Exportando…';
      await exportAudio({ format, download: true });
      notify(`${format.toUpperCase()} exportado. Ya puedes certificarlo.`, 'ok');
    } catch (err) {
      notify(err.message || 'No se pudo exportar', 'err');
    } finally {
      el.btnExport.disabled = false;
      el.btnExport.textContent = 'Exportar';
    }
  });

  // Drag & drop over the editor
  const dropZone = document.querySelector('.editor');
  if (dropZone) {
    dropZone.addEventListener('dragover', (event) => { event.preventDefault(); });
    dropZone.addEventListener('drop', async (event) => {
      event.preventDefault();
      const assetRaw = event.dataTransfer.getData('application/x-md-asset');
      if (assetRaw) {
        try {
          const asset = JSON.parse(assetRaw);
          const rect = el.canvas.getBoundingClientRect();
          const time = Math.max(0, (event.clientX - rect.left) / state.zoom);
          await addLibraryAsset(asset, time);
        } catch (err) {
          notify(err.message || 'No se pudo añadir el activo.', 'err');
        }
        return;
      }
      const files = [...event.dataTransfer.files];
      if (files.length) await importFiles(files);
    });
  }
}

function bindKeyboard() {
  document.addEventListener('keydown', (event) => {
    const tag = (event.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || event.target.isContentEditable;
    if (typing) return;
    if (event.code === 'Space') {
      event.preventDefault();
      ensureAudio();
      if (state.playing) pausePlayback();
      else startPlayback(state.playhead);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      if (state.selection) {
        event.preventDefault();
        deleteSelectedClip();
      }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      exportWav({ download: true }).then(() => notify('WAV exportado.', 'ok')).catch((err) => notify(err.message, 'err'));
    }
  });
}

/* ---------- Audio ---------- */

function ensureAudio() {
  if (!state.ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    state.ctx = new Ctx();
    state.master = state.ctx.createGain();
    state.master.gain.value = 0.9;
    state.master.connect(state.ctx.destination);
  }
  if (state.ctx.state === 'suspended') state.ctx.resume();
  return state.ctx;
}

function audibleTracks() {
  const anySolo = state.tracks.some((t) => t.solo);
  return state.tracks.filter((t) => !t.mute && (!anySolo || t.solo));
}

function scheduleClip(ctx, destination, clip, track, when, offset, playDur, timelineStart) {
  if (playDur <= 0.005) return null;
  const src = ctx.createBufferSource();
  src.buffer = clip.buffer;
  src.playbackRate.value = clamp(clip.rate || 1, 0.25, 4);
  const gain = ctx.createGain();
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const vol = Math.max(0, clip.gain * track.volume);
  const clipStart = clip.start;
  const clipEnd = clip.start + clip.duration;
  const fadeIn = Math.max(0, Math.min(clip.fadeIn, clip.duration * 0.5));
  const fadeOut = Math.max(0, Math.min(clip.fadeOut, clip.duration * 0.5));
  const t0 = when;
  const posStart = timelineStart;
  const initial = fadeIn > 0 && posStart < clipStart + fadeIn
    ? vol * clamp((posStart - clipStart) / fadeIn, 0, 1)
    : vol;
  gain.gain.setValueAtTime(initial, t0);
  if (fadeIn > 0 && posStart < clipStart + fadeIn) {
    const rampAt = t0 + (clipStart + fadeIn - posStart);
    gain.gain.linearRampToValueAtTime(vol, rampAt);
  }
  if (fadeOut > 0) {
    const fadeStart = clipEnd - fadeOut;
    if (fadeStart > posStart) {
      gain.gain.setValueAtTime(vol, t0 + (fadeStart - posStart));
    }
    gain.gain.linearRampToValueAtTime(0, t0 + playDur);
  } else {
    const tail = Math.min(0.006, playDur * 0.3);
    gain.gain.setValueAtTime(vol, t0 + Math.max(0, playDur - tail));
    gain.gain.linearRampToValueAtTime(0, t0 + playDur);
  }

  src.connect(gain);
  if (panner) {
    panner.pan.value = clamp(clip.pan, -1, 1);
    gain.connect(panner);
    panner.connect(destination);
  } else {
    gain.connect(destination);
  }
  src.start(when, offset, (playDur + 0.02) * (clip.rate || 1));
  return src;
}

async function startPlayback(from = 0) {
  ensureAudio();
  if (state.ctx.state === 'suspended') await state.ctx.resume();
  stopSources();
  const end = getProjectEnd();
  const fromPos = clamp(from, 0, Math.max(0, end - 0.02));
  const startAt = state.ctx.currentTime + 0.06;
  let scheduled = 0;
  for (const track of audibleTracks()) {
    for (const clip of track.clips) {
      const clipEnd = clip.start + clip.duration;
      if (clipEnd <= fromPos) continue;
      const playFrom = Math.max(fromPos, clip.start);
      const when = startAt + (playFrom - fromPos);
      const offset = clip.offset + (playFrom - clip.start) * (clip.rate || 1);
      const playDur = clipEnd - playFrom;
      const src = scheduleClip(state.ctx, state.master, clip, track, when, offset, playDur, playFrom);
      if (src) { state.sources.push(src); scheduled++; }
    }
  }
  if (!scheduled) {
    notify('No hay clips audibles. Genera o importa música primero.', 'err');
    return;
  }
  state.playing = true;
  state.startPos = fromPos;
  state.startTime = startAt;
  state.playhead = fromPos;
  el.btnPlay.classList.add('playing');
  el.btnPlay.textContent = '❚❚';
  tick();
}

function pausePlayback() {
  stopSources();
  state.playing = false;
  el.btnPlay.classList.remove('playing');
  el.btnPlay.textContent = '▶';
  updateTime();
  draw();
}

function stopPlayback() {
  stopSources();
  state.playing = false;
  el.btnPlay.classList.remove('playing');
  el.btnPlay.textContent = '▶';
}

function stopSources() {
  for (const src of state.sources) {
    try { src.stop(); } catch {}
    try { src.disconnect(); } catch {}
  }
  state.sources = [];
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = null;
}

function tick() {
  if (!state.playing) return;
  const now = state.ctx.currentTime;
  const end = getProjectEnd();
  state.playhead = state.startPos + Math.max(0, now - state.startTime);
  if (state.playhead >= end) {
    if (state.loop) {
      stopSources();
      state.playing = false;
      startPlayback(0);
      return;
    }
    state.playhead = end;
    stopPlayback();
    updateTime();
    draw();
    return;
  }
  updateTime();
  draw();
  state.raf = requestAnimationFrame(tick);
}

/* ---------- Project data ---------- */

function getProjectEnd() {
  let end = 8;
  for (const track of state.tracks) {
    for (const clip of track.clips) end = Math.max(end, clip.start + clip.duration);
  }
  return end;
}

function addClip(track, data) {
  const buffer = data.buffer;
  const rate = clamp(Number(data.rate) || 1, 0.25, 4);
  const offset = clamp(data.offset || 0, 0, Math.max(0, buffer.duration - 0.05));
  const maxDuration = Math.max(0.05, (buffer.duration - offset) / rate);
  const duration = clamp(data.duration ?? maxDuration, 0.05, maxDuration);
  const clip = {
    id: uid(),
    name: data.name || track.name,
    buffer,
    start: Math.max(0, data.start || 0),
    offset,
    duration,
    rate,
    gain: data.gain ?? 1,
    fadeIn: data.fadeIn ?? 0,
    fadeOut: data.fadeOut ?? 0,
    pan: data.pan ?? 0,
    assetId: data.assetId || null,
    assetName: data.assetName || null,
    assetPath: data.assetPath || null,
    assetRole: data.assetRole || null,
    sourceUrl: data.sourceUrl || null
  };
  track.clips.push(clip);
  return clip;
}

function getSelection() {
  if (!state.selection) return null;
  const track = state.tracks.find((t) => t.id === state.selection.trackId);
  if (!track) return null;
  const clip = track.clips.find((c) => c.id === state.selection.clipId);
  if (!clip) return null;
  return { track, clip };
}

function deleteSelectedClip() {
  const sel = getSelection();
  if (!sel) return;
  sel.track.clips = sel.track.clips.filter((c) => c.id !== sel.clip.id);
  state.selection = null;
  renderInspector();
  resizeCanvas();
  draw();
}

function splitSelectedAtPlayhead() {
  const sel = getSelection();
  if (!sel) return;
  const { track, clip } = sel;
  const pos = state.playhead;
  if (pos <= clip.start + 0.05 || pos >= clip.start + clip.duration - 0.05) {
    notify('Coloca el cursor dentro del clip para dividirlo.', 'err');
    return;
  }
  const leftDuration = pos - clip.start;
  const rightDuration = clip.start + clip.duration - pos;
  const right = {
    ...clip,
    id: uid(),
    start: pos,
    offset: clip.offset + leftDuration * (clip.rate || 1),
    duration: rightDuration,
    fadeIn: 0,
    fadeOut: clip.fadeOut,
    _waveKey: null,
    _wave: null
  };
  clip.duration = leftDuration;
  clip.fadeOut = 0;
  clip._waveKey = null;
  clip._wave = null;
  track.clips.push(right);
  state.selection = { trackId: track.id, clipId: right.id };
  renderInspector();
  resizeCanvas();
  draw();
}

function duplicateSelectedClip() {
  const sel = getSelection();
  if (!sel) return;
  const copy = {
    ...sel.clip,
    id: uid(),
    start: sel.clip.start + sel.clip.duration,
    _waveKey: null,
    _wave: null
  };
  sel.track.clips.push(copy);
  state.selection = { trackId: sel.track.id, clipId: copy.id };
  renderInspector();
  resizeCanvas();
  draw();
}

/* ---------- Public API ---------- */

export async function importFiles(fileList, { onProgress } = {}) {
  ensureAudio();
  const files = [...fileList].filter((f) => f.type.startsWith('audio/') || /\.(wav|mp3|ogg|m4a|flac|aif|aiff)$/i.test(f.name));
  if (!files.length) {
    notify('Selecciona archivos de audio válidos (WAV, MP3, OGG, M4A, FLAC).', 'err');
    return { added: 0, failed: 0 };
  }
  let added = 0;
  let failed = 0;
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    onProgress?.({ index, total: files.length, fileName: file.name, phase: 'decoding' });
    try {
      const arr = await file.arrayBuffer();
      const decoded = await state.ctx.decodeAudioData(arr.slice(0));
      const name = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Audio';
      const track = createTrack(name);
      addClip(track, { buffer: decoded, start: state.playhead > 0 ? state.playhead : 0, name });
      added++;
      onProgress?.({ index, total: files.length, fileName: file.name, phase: 'complete' });
    } catch (err) {
      failed++;
      notify(`No se pudo decodificar ${file.name}. Prueba con WAV o MP3.`, 'err');
      onProgress?.({ index, total: files.length, fileName: file.name, phase: 'error', error: err.message });
    }
  }
  if (added) {
    renderTrackHeaders();
    resizeCanvas();
    renderInspector();
    draw();
    notify(`${added} archivo${added > 1 ? 's' : ''} importado${added > 1 ? 's' : ''}.`, 'ok');
  }
  return { added, failed };
}

export async function addLibraryAsset(asset, start) {
  if (!asset || !asset.id) throw new Error('Activo de biblioteca no válido.');
  ensureAudio();
  const url = asset.url || `/media/asset/${encodeURIComponent(asset.id)}`;
  const res = await fetch(url);
  if (!res.ok) {
    let message = `No se pudo cargar el activo (${res.status}).`;
    try {
      const data = await res.json();
      if (data && data.error) message = data.error;
    } catch {}
    throw new Error(message);
  }
  const arr = await res.arrayBuffer();
  const decoded = await state.ctx.decodeAudioData(arr.slice(0));
  const name = (asset.name || 'Biblioteca').replace(/\.[^.]+$/, '').slice(0, 48) || 'Biblioteca';
  let track = state.tracks.find((t) => t.name === 'Biblioteca');
  if (!track) track = createTrack('Biblioteca', '#ffb77a');
  const clip = addClip(track, {
    buffer: decoded,
    start: Math.max(0, start ?? state.playhead),
    name,
    assetId: asset.id,
    assetName: asset.name,
    assetPath: asset.relPath,
    assetRole: 'library'
  });
  state.selection = { trackId: track.id, clipId: clip.id };
  renderTrackHeaders();
  resizeCanvas();
  renderInspector();
  draw();
  notify(`“${name}” añadido a la pista Biblioteca.`, 'ok');
  return clip;
}

export async function loadLibrarySong(song) {
  if (!song || !Array.isArray(song.tracks) || !song.tracks.length) {
    throw new Error('La canción de biblioteca no tiene pistas.');
  }
  ensureAudio();
  const unique = new Map();
  for (const track of song.tracks) {
    for (const clip of track.clips || []) {
      if (clip.assetId && !unique.has(clip.assetId)) {
        unique.set(clip.assetId, clip);
      }
    }
  }
  const buffers = new Map();
  let failed = 0;
  notify(`Cargando ${unique.size} sonidos de tu biblioteca…`, 'info');
  for (const [assetId, clip] of unique) {
    try {
      const url = clip.assetUrl || `/media/asset/${encodeURIComponent(assetId)}`;
      const res = await fetch(url);
      if (!res.ok) {
        failed++;
        continue;
      }
      const arr = await res.arrayBuffer();
      const decoded = await state.ctx.decodeAudioData(arr.slice(0));
      buffers.set(assetId, decoded);
    } catch {
      failed++;
    }
  }
  if (!buffers.size) {
    throw new Error('No se pudo cargar ningún sonido de la biblioteca. Revisa que ffmpeg esté instalado para AIFF.');
  }
  stopPlayback();
  state.tracks = [];
  let clips = 0;
  for (const plan of song.tracks) {
    const track = createTrack(plan.name, plan.color);
    track.volume = Number.isFinite(plan.volume) ? plan.volume : 1;
    for (const clip of plan.clips || []) {
      const buffer = buffers.get(clip.assetId);
      if (!buffer) continue;
      addClip(track, {
        buffer,
        name: clip.name,
        start: clip.start,
        duration: clip.duration,
        offset: clip.offset,
        rate: clip.rate,
        gain: clip.gain,
        pan: clip.pan,
        fadeIn: clip.fadeIn,
        fadeOut: clip.fadeOut,
        assetId: clip.assetId,
        assetName: clip.assetName,
        assetPath: clip.assetPath,
        assetRole: clip.role
      });
      clips++;
    }
  }
  if (!clips) {
    initialTracks();
    throw new Error('Los sonidos no se pudieron colocar en el editor.');
  }
  state.selection = null;
  state.playhead = 0;
  state.lastSong = song;
  state.lastExport = null;
  renderTrackHeaders();
  renderInspector();
  renderUsedSounds();
  resizeCanvas();
  draw();
  updateTime();
  const warning = failed ? ` ${failed} sonido${failed > 1 ? 's' : ''} no se pudo cargar.` : '';
  notify(`Canción creada con ${buffers.size} sonidos de tu biblioteca.${warning}`, failed ? 'info' : 'ok');
}

export async function loadGeneratedSong(song) {
  ensureAudio();
  const stems = [
    ['drums', 'Batería'],
    ['bass', 'Bajo'],
    ['harmony', 'Armonía'],
    ['melody', 'Melodía'],
    ['fx', 'Efectos']
  ];
  const loaded = [];
  for (const [key, name] of stems) {
    const url = song.files && song.files[key];
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const arr = await res.arrayBuffer();
      const decoded = await state.ctx.decodeAudioData(arr);
      loaded.push({ key, name, buffer: decoded });
    } catch {
      // sesion sin pista
    }
  }
  if (!loaded.length) {
    notify('No se pudieron cargar las pistas generadas.', 'err');
    return;
  }
  stopPlayback();
  state.tracks = [];
  for (const stem of loaded) {
    const track = createTrack(stem.name);
    addClip(track, {
      buffer: stem.buffer,
      start: 0,
      name: stem.name,
      fadeIn: 0.01,
      fadeOut: 0.3,
      sourceUrl: song.files && song.files[stem.key]
    });
  }
  createTrack('Sonidos');
  state.selection = null;
  state.playhead = 0;
  state.lastSong = song;
  state.lastExport = null;
  renderTrackHeaders();
  renderInspector();
  resizeCanvas();
  draw();
  updateTime();
  notify('Canción cargada en el estudio con pistas separadas.', 'ok');
}

export async function addSound(id) {
  ensureAudio();
  const def = SOUNDS.find((s) => s.id === id);
  if (!def) return;
  let track = state.tracks.find((t) => t.name === 'Sonidos');
  if (!track) track = createTrack('Sonidos', '#86c9e8');
  const buffer = makeSound(id, state.ctx);
  const clip = addClip(track, {
    buffer,
    start: state.playhead,
    duration: buffer.duration,
    name: def.label,
    gain: 0.85
  });
  state.selection = { trackId: track.id, clipId: clip.id };
  renderTrackHeaders();
  renderInspector();
  resizeCanvas();
  draw();
  notify(`${def.label} añadido en el cursor.`, 'ok');
}

export async function exportWav({ download = true } = {}) {
  ensureAudio();
  const end = getProjectEnd();
  if (!state.tracks.some((t) => t.clips.length)) {
    throw new Error('No hay audio para exportar. Genera o importa música primero.');
  }
  const sampleRate = 44100;
  const length = Math.ceil((end + 0.25) * sampleRate);
  const offline = new OfflineAudioContext(2, length, sampleRate);
  const master = offline.createGain();
  master.gain.value = 0.9;
  master.connect(offline.destination);
  for (const track of audibleTracks()) {
    for (const clip of track.clips) {
      scheduleClip(offline, master, clip, track, clip.start, clip.offset, clip.duration, clip.start);
    }
  }
  const rendered = await offline.startRendering();
  const channels = [];
  let peak = 0;
  for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
    const data = rendered.getChannelData(ch);
    channels.push(data);
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i]);
      if (a > peak) peak = a;
    }
  }
  if (peak > 0.97) {
    const factor = 0.97 / peak;
    for (const data of channels) for (let i = 0; i < data.length; i++) data[i] *= factor;
  }
  const wavBuffer = encodeWavBuffer(channels, sampleRate);
  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  const filename = `${slugify(state.projectTitle)}.wav`;
  const meta = {
    title: state.projectTitle,
    duration: Number(rendered.duration.toFixed(2)),
    sampleRate,
    peak: Number(peak.toFixed(4)),
    tracks: state.tracks.filter((t) => t.clips.length).map((t) => ({
      name: t.name,
      clips: t.clips.length,
      volume: t.volume,
      mute: t.mute,
      solo: t.solo
    })),
    generator: state.lastSong ? {
      engine: 'musicderechos-local-v1',
      params: {
        genre: state.lastSong.genre,
        mood: state.lastSong.mood,
        key: state.lastSong.key,
        bpm: state.lastSong.bpm,
        seed: state.lastSong.seed,
        bars: state.lastSong.bars
      }
    } : { engine: 'edicion-manual', params: null }
  };
  state.lastExport = {
    blob,
    arrayBuffer: wavBuffer,
    filename,
    duration: meta.duration,
    sampleRate,
    meta,
    createdAt: new Date().toISOString()
  };
  if (download) downloadBlob(blob, filename);
  return state.lastExport;
}

export async function exportAudio({ format = 'wav', download = true } = {}) {
  const safeFormat = String(format || 'wav').toLowerCase();
  if (safeFormat === 'wav') return exportWav({ download });
  const result = await exportWav({ download: false });
  const res = await fetch(`/api/export?format=${encodeURIComponent(safeFormat)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'audio/wav',
      'x-file-name': encodeURIComponent(result.filename)
    },
    body: result.arrayBuffer
  });
  if (!res.ok) {
    let message = `No se pudo exportar ${safeFormat.toUpperCase()} (${res.status}).`;
    try {
      const data = await res.json();
      if (data && data.error) message = data.error;
    } catch {}
    throw new Error(message);
  }
  const blob = await res.blob();
  const filename = result.filename.replace(/\.wav$/i, `.${safeFormat}`);
  if (download) downloadBlob(blob, filename);
  state.lastExport = {
    ...state.lastExport,
    download: { blob, filename, format: safeFormat }
  };
  return state.lastExport;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToProjectAudio(buffer) {
  const channels = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) channels.push(buffer.getChannelData(ch));
  return arrayBufferToBase64(encodeWavBuffer(channels, buffer.sampleRate));
}

function compactSong(song) {
  if (!song) return null;
  const copy = { ...song };
  delete copy.tracks;
  if (Array.isArray(song.usedAssets)) {
    copy.usedAssets = song.usedAssets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      path: asset.path,
      roles: asset.roles,
      tracks: asset.tracks,
      uses: asset.uses
    }));
  }
  return copy;
}

export function serializeProject() {
  const audio = {};
  const audioIds = new Map();
  let audioCount = 0;
  const tracks = state.tracks.map((track) => ({
    name: track.name,
    color: track.color,
    volume: track.volume,
    mute: !!track.mute,
    solo: !!track.solo,
    clips: track.clips.map((clip) => {
      const entry = {
        name: clip.name,
        start: clip.start,
        offset: clip.offset,
        duration: clip.duration,
        rate: clip.rate || 1,
        gain: clip.gain,
        fadeIn: clip.fadeIn,
        fadeOut: clip.fadeOut,
        pan: clip.pan,
        assetId: clip.assetId || null,
        assetName: clip.assetName || null,
        assetPath: clip.assetPath || null,
        assetRole: clip.assetRole || null,
        sourceUrl: clip.sourceUrl || null
      };
      if (!entry.assetId && !entry.sourceUrl) {
        let audioId = audioIds.get(clip.buffer);
        if (!audioId) {
          audioId = `audio-${++audioCount}`;
          audioIds.set(clip.buffer, audioId);
          audio[audioId] = bufferToProjectAudio(clip.buffer);
        }
        entry.audioId = audioId;
      }
      return entry;
    })
  }));
  return {
    format: 'musicderechos-project',
    version: 1,
    title: state.projectTitle || 'Proyecto',
    savedAt: new Date().toISOString(),
    lastSong: compactSong(state.lastSong),
    audio,
    tracks
  };
}

export function saveProjectFile() {
  const project = serializeProject();
  const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
  const slug = String(project.title || 'proyecto')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'proyecto';
  downloadBlob(blob, `${slug}.mdproj.json`);
  return project;
}

export async function loadProject(project) {
  if (!project || !Array.isArray(project.tracks) || !project.tracks.length) {
    throw new Error('El archivo no es un proyecto válido de MusicDerechos.');
  }
  ensureAudio();
  stopPlayback();
  const cache = new Map();
  const warnings = [];
  let clipsAdded = 0;
  state.tracks = [];
  for (const plan of project.tracks) {
    const track = createTrack(plan.name || 'Pista', plan.color);
    track.volume = Number.isFinite(plan.volume) ? plan.volume : 1;
    track.mute = !!plan.mute;
    track.solo = !!plan.solo;
    for (const clip of plan.clips || []) {
      let buffer = null;
      let key = '';
      try {
        if (clip.assetId) {
          key = `asset:${clip.assetId}`;
          if (cache.has(key)) buffer = cache.get(key);
          else {
            const res = await fetch(`/media/asset/${encodeURIComponent(clip.assetId)}`);
            if (res.ok) {
              buffer = await state.ctx.decodeAudioData((await res.arrayBuffer()).slice(0));
              cache.set(key, buffer);
            }
          }
        } else if (clip.sourceUrl) {
          key = `url:${clip.sourceUrl}`;
          if (cache.has(key)) buffer = cache.get(key);
          else {
            const res = await fetch(clip.sourceUrl);
            if (res.ok) {
              buffer = await state.ctx.decodeAudioData((await res.arrayBuffer()).slice(0));
              cache.set(key, buffer);
            }
          }
        } else if (clip.audioId && project.audio && project.audio[clip.audioId]) {
          key = `audio:${clip.audioId}`;
          if (cache.has(key)) buffer = cache.get(key);
          else {
            buffer = await state.ctx.decodeAudioData(base64ToArrayBuffer(project.audio[clip.audioId]));
            cache.set(key, buffer);
          }
        }
      } catch {
        buffer = null;
      }
      if (!buffer) {
        warnings.push(clip.name || 'clip');
        continue;
      }
      addClip(track, { ...clip, buffer });
      clipsAdded++;
    }
  }
  if (!clipsAdded) {
    initialTracks();
    throw new Error('No se pudo cargar ningún clip del proyecto.');
  }
  state.selection = null;
  state.playhead = 0;
  state.lastSong = project.lastSong || null;
  state.lastExport = null;
  state.projectTitle = project.title || 'Proyecto';
  const titleInput = document.getElementById('projectTitle');
  if (titleInput) titleInput.value = state.projectTitle;
  renderTrackHeaders();
  renderInspector();
  resizeCanvas();
  draw();
  updateTime();
  const warning = warnings.length
    ? ` ${warnings.length} clip${warnings.length > 1 ? 's' : ''} no se pudo cargar (${warnings.slice(0, 4).join(', ')}${warnings.length > 4 ? '…' : ''}).`
    : '';
  notify(`Proyecto cargado: ${state.projectTitle}.${warning}`, warnings.length ? 'info' : 'ok');
  return { clips: clipsAdded, warnings };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function encodeWavBuffer(channels, sampleRate) {
  const numChannels = channels.length;
  const frames = channels[0].length;
  const buffer = new ArrayBuffer(44 + frames * numChannels * 2);
  const view = new DataView(buffer);
  const writeString = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + frames * numChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, frames * numChannels * 2, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = clamp(channels[ch][i], -1, 1);
      view.setInt16(offset, Math.round(sample * 32767), true);
      offset += 2;
    }
  }
  return buffer;
}

function slugify(text) {
  return String(text || 'obra')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim().replace(/\s+/g, '-')
    .slice(0, 60) || 'obra';
}

export function getLastExport() { return state.lastExport; }
export function getLastGeneratedMeta() { return state.lastSong; }
export function getProjectTitle() { return state.projectTitle; }
export function setProjectTitle(title) {
  state.projectTitle = title;
  const input = document.getElementById('projectTitle');
  if (input) input.value = title;
  state.lastExport = null;
}
export function getProjectSummary() {
  return {
    title: state.projectTitle,
    duration: Number(getProjectEnd().toFixed(2)),
    tracks: state.tracks.map((t) => ({
      name: t.name,
      clips: t.clips.length,
      gain: t.clips.length ? Number((t.clips.reduce((s, c) => s + c.gain, 0) / t.clips.length).toFixed(2)) : 0,
      fades: t.clips.reduce((s, c) => s + (c.fadeIn > 0 ? 1 : 0) + (c.fadeOut > 0 ? 1 : 0), 0)
    })),
    lastSong: state.lastSong ? {
      genre: state.lastSong.genre,
      mood: state.lastSong.mood,
      bpm: state.lastSong.bpm,
      key: state.lastSong.key,
      seed: state.lastSong.seed
    } : null
  };
}

/* ---------- Rendering ---------- */

function renderTrackHeaders() {
  el.headers.innerHTML = `<div style="height:${RULER_H}px;background:var(--panel)"></div>` + state.tracks.map((track) => `
    <div class="track-header ${state.selection && state.selection.trackId === track.id ? 'selected' : ''}" data-track="${track.id}">
      <div class="track-title" title="${escapeHtml(track.name)}"><span class="track-dot" style="background:${track.color}"></span><span>${escapeHtml(track.name)}</span></div>
      <div class="track-buttons">
        <button data-act="mute" class="${track.mute ? 'on' : ''}" title="Silenciar">M</button>
        <button data-act="solo" class="solo ${track.solo ? 'on' : ''}" title="Solo">S</button>
        <button data-act="del" class="del" title="Eliminar pista">×</button>
      </div>
      <div class="track-vol">VOL <input type="range" min="0" max="1.5" step="0.01" value="${track.volume}" data-act="vol"></div>
    </div>
  `).join('');
}

function bindHeaders() {
  el.headers.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-act]');
    if (!btn) return;
    const row = btn.closest('.track-header');
    const track = state.tracks.find((t) => t.id === row.dataset.track);
    if (!track) return;
    const act = btn.dataset.act;
    if (act === 'mute') {
      track.mute = !track.mute;
      if (state.playing) startPlayback(state.playhead);
    } else if (act === 'solo') {
      track.solo = !track.solo;
      if (state.playing) startPlayback(state.playhead);
    } else if (act === 'del') {
      const clips = track.clips.length;
      if (clips && !confirm(`¿Eliminar la pista "${track.name}" con ${clips} clip(s)?`)) return;
      track.clips.forEach((c) => { c._wave = null; });
      state.tracks = state.tracks.filter((t) => t.id !== track.id);
      if (state.selection && state.selection.trackId === track.id) state.selection = null;
      if (!state.tracks.length) createTrack('Pista 1');
      if (state.playing) stopPlayback();
      renderTrackHeaders();
      renderInspector();
      resizeCanvas();
      draw();
    }
    renderTrackHeaders();
  });
  el.headers.addEventListener('input', (event) => {
    const slider = event.target.closest('input[data-act="vol"]');
    if (!slider) return;
    const row = slider.closest('.track-header');
    const track = state.tracks.find((t) => t.id === row.dataset.track);
    if (track) track.volume = Number(slider.value);
  });
  el.scroll.addEventListener('scroll', () => {
    if (el.headers.scrollTop !== el.scroll.scrollTop) el.headers.scrollTop = el.scroll.scrollTop;
  });
  el.headers.addEventListener('scroll', () => {
    if (el.scroll.scrollTop !== el.headers.scrollTop) el.scroll.scrollTop = el.headers.scrollTop;
  });
}

function bindInspector() {
  el.inspector.addEventListener('input', (event) => {
    const input = event.target.closest('[data-prop]');
    if (!input) return;
    const sel = getSelection();
    if (!sel) return;
    const { clip } = sel;
    const prop = input.dataset.prop;
    const value = Number(input.value);
    if (prop === 'start') {
      clip.start = Math.max(0, value);
    } else if (prop === 'offset') {
      clip.offset = clamp(value, 0, clip.buffer.duration - 0.05);
      clip.duration = Math.min(clip.duration, (clip.buffer.duration - clip.offset) / (clip.rate || 1));
    } else if (prop === 'duration') {
      clip.duration = clamp(value, 0.05, (clip.buffer.duration - clip.offset) / (clip.rate || 1));
    } else if (prop === 'gain') {
      clip.gain = clamp(value, 0, 1.5);
    } else if (prop === 'fadeIn') {
      clip.fadeIn = clamp(value, 0, clip.duration * 0.5);
    } else if (prop === 'fadeOut') {
      clip.fadeOut = clamp(value, 0, clip.duration * 0.5);
    } else if (prop === 'pan') {
      clip.pan = clamp(value, -1, 1);
    }
    clip._waveKey = null;
    const valueEl = el.inspector.querySelector(`[data-value="${prop}"]`);
    if (valueEl) valueEl.textContent = formatClipValue(prop, clip);
    resizeCanvas();
    draw();
  });
  el.inspector.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'delete') deleteSelectedClip();
    else if (action === 'duplicate') duplicateSelectedClip();
    else if (action === 'split') splitSelectedAtPlayhead();
  });
  if (el.usedSounds) {
    el.usedSounds.addEventListener('click', (event) => {
      const locate = event.target.closest('[data-used-locate]');
      if (locate) {
        const group = usedSoundGroups().find((entry) => entry.id === locate.dataset.usedLocate);
        if (!group) return;
        state.selection = { ...group.first };
        renderTrackHeaders();
        seekTo((state.tracks.find((track) => track.id === group.first.trackId)?.clips || [])
          .find((clip) => clip.id === group.first.clipId)?.start || 0);
        renderInspector();
        draw();
        return;
      }
      const search = event.target.closest('[data-used-search]');
      if (search) {
        window.dispatchEvent(new CustomEvent('studio:library-search', { detail: { q: search.dataset.usedSearch } }));
        return;
      }
      const remove = event.target.closest('[data-used-remove]');
      if (remove) {
        const id = remove.dataset.usedRemove;
        const group = usedSoundGroups().find((entry) => entry.id === id);
        if (!group) return;
        if (!confirm(`¿Quitar «${group.name}» del proyecto? Se eliminarán ${group.uses} clips.`)) return;
        for (const track of state.tracks) {
          track.clips = track.clips.filter((clip) => clip.assetId !== id);
        }
        state.selection = null;
        renderTrackHeaders();
        resizeCanvas();
        renderInspector();
        draw();
        notify(`«${group.name}» eliminado del proyecto.`, 'ok');
      }
    });
  }
}

function formatClipValue(prop, clip) {
  if (prop === 'gain') return `${Math.round(clip.gain * 100)}%`;
  if (prop === 'pan') {
    if (Math.abs(clip.pan) < 0.02) return 'Centro';
    return `${Math.abs(Math.round(clip.pan * 100))}% ${clip.pan < 0 ? 'izq' : 'der'}`;
  }
  return `${clip[prop].toFixed(2)} s`;
}

function usedSoundGroups() {
  const groups = new Map();
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      if (!clip.assetId) continue;
      if (!groups.has(clip.assetId)) {
        groups.set(clip.assetId, {
          id: clip.assetId,
          name: clip.assetName || clip.name,
          path: clip.assetPath || '',
          roles: new Set(),
          tracks: new Set(),
          uses: 0,
          first: { trackId: track.id, clipId: clip.id }
        });
      }
      const entry = groups.get(clip.assetId);
      entry.uses++;
      entry.tracks.add(track.name);
      if (clip.assetRole) entry.roles.add(clip.assetRole);
    }
  }
  return [...groups.values()].sort((a, b) => b.uses - a.uses).map((entry) => ({
    ...entry,
    roles: [...entry.roles],
    tracks: [...entry.tracks]
  }));
}

function renderUsedSounds() {
  if (!el.usedSounds) return;
  const groups = usedSoundGroups();
  const summary = document.getElementById('usedSoundsSummary');
  if (summary) {
    const total = groups.reduce((sum, group) => sum + group.uses, 0);
    summary.textContent = groups.length ? `${groups.length} sonidos · ${total} clips` : '';
  }
  if (!groups.length) {
    el.usedSounds.innerHTML = '<p class="muted small">Aún no hay sonidos de la biblioteca en este proyecto. Genera una canción con biblioteca o añade samples desde la pestaña Biblioteca.</p>';
    return;
  }
  el.usedSounds.innerHTML = groups.map((group) => `
    <div class="used-sound">
      <div class="used-sound-main">
        <strong>${escapeHtml(group.name)}</strong>
        <div class="muted small">${escapeHtml(group.tracks.join(' · '))} · ${group.uses} uso${group.uses === 1 ? '' : 's'}${group.roles.length ? ` · ${escapeHtml(group.roles.join(', '))}` : ''}</div>
        <div class="asset-path">${escapeHtml(group.path)}</div>
      </div>
      <div class="used-sound-actions">
        <button class="btn small-btn" data-used-locate="${escapeHtml(group.id)}">Ir</button>
        <button class="btn small-btn" data-used-search="${escapeHtml(group.name)}">Buscar</button>
        <button class="btn small-btn danger" data-used-remove="${escapeHtml(group.id)}">Quitar</button>
      </div>
    </div>
  `).join('');
}

function renderInspector() {
  renderUsedSounds();
  const sel = getSelection();
  if (!sel) {
    el.inspector.innerHTML = '<p class="muted">Selecciona un clip en la línea de tiempo para recortarlo, moverlo, ajustar volumen, fades y paneo. Arrastra el borde de un clip para recortar.</p>';
    return;
  }
  const { track, clip } = sel;
  const maxStart = Math.max(60, getProjectEnd()) + 30;
  const maxOffset = Math.max(0.01, clip.buffer.duration - 0.05);
  const rate = clip.rate || 1;
  const maxDuration = Math.max(0.05, (clip.buffer.duration - clip.offset) / rate);
  const rateLabel = Math.abs(rate - 1) > 0.001 ? ` · x${rate.toFixed(3)}` : '';
  const sourceLabel = clip.assetPath ? ` · ${clip.assetPath}` : '';
  el.inspector.innerHTML = `
    <div class="inspector-grid">
      <div>
        <div class="eyebrow">Clip seleccionado</div>
        <strong style="display:block;margin-top:3px">${escapeHtml(clip.name)}</strong>
        <div class="muted small">${escapeHtml(track.name)} · fuente ${clip.buffer.duration.toFixed(1)} s${rateLabel}${escapeHtml(sourceLabel)}</div>
      </div>
      <label>Inicio <span class="value" data-value="start">${formatClipValue('start', clip)}</span>
        <input type="range" data-prop="start" min="0" max="${maxStart}" step="0.01" value="${clip.start}">
      </label>
      <label>Recorte <span class="value" data-value="offset">${formatClipValue('offset', clip)}</span>
        <input type="range" data-prop="offset" min="0" max="${maxOffset}" step="0.01" value="${clip.offset}">
      </label>
      <label>Duración <span class="value" data-value="duration">${formatClipValue('duration', clip)}</span>
        <input type="range" data-prop="duration" min="0.05" max="${maxDuration}" step="0.01" value="${clip.duration}">
      </label>
      <label>Volumen <span class="value" data-value="gain">${formatClipValue('gain', clip)}</span>
        <input type="range" data-prop="gain" min="0" max="1.5" step="0.01" value="${clip.gain}">
      </label>
      <label>Fade in <span class="value" data-value="fadeIn">${formatClipValue('fadeIn', clip)}</span>
        <input type="range" data-prop="fadeIn" min="0" max="${Math.min(5, clip.duration / 2)}" step="0.01" value="${clip.fadeIn}">
      </label>
      <label>Fade out <span class="value" data-value="fadeOut">${formatClipValue('fadeOut', clip)}</span>
        <input type="range" data-prop="fadeOut" min="0" max="${Math.min(5, clip.duration / 2)}" step="0.01" value="${clip.fadeOut}">
      </label>
      <label>Paneo <span class="value" data-value="pan">${formatClipValue('pan', clip)}</span>
        <input type="range" data-prop="pan" min="-1" max="1" step="0.01" value="${clip.pan}">
      </label>
      <div class="inspector-actions">
        <button class="btn small-btn" data-action="split" title="Dividir en el cursor">Dividir</button>
        <button class="btn small-btn" data-action="duplicate">Duplicar</button>
        <button class="btn small-btn" data-action="delete" style="color:var(--danger)">Eliminar</button>
      </div>
    </div>
  `;
}

function resizeCanvas() {
  if (!el.canvas) return;
  const pps = state.zoom;
  const end = getProjectEnd();
  const width = Math.max(el.scroll.clientWidth - 2, Math.ceil((end + 4) * pps));
  const height = RULER_H + state.tracks.length * ROW_H;
  const dpr = Math.min(window.devicePixelRatio || 1, Math.max(0.75, 14000 / Math.max(1, width)));
  el.canvas.width = Math.ceil(width * dpr);
  el.canvas.height = Math.ceil(height * dpr);
  el.canvas.style.width = `${width}px`;
  el.canvas.style.height = `${height}px`;
  state.view = { width, height, pps, dpr };
  draw();
}

function draw() {
  if (!el.canvas || !state.view) return;
  const { width, height, pps, dpr } = state.view;
  const ctx = el.canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#0d1310';
  ctx.fillRect(0, 0, width, height);

  // ruler
  ctx.fillStyle = '#151e19';
  ctx.fillRect(0, 0, width, RULER_H);
  ctx.fillStyle = '#829087';
  ctx.font = '10px "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  const step = pps >= 120 ? 1 : pps >= 70 ? 2 : pps >= 38 ? 5 : 10;
  for (let sec = 0; sec * pps <= width; sec += step) {
    const x = sec * pps;
    ctx.strokeStyle = 'rgba(228,240,230,0.06)';
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
    ctx.fillStyle = '#829087';
    ctx.fillText(formatRuler(sec), x + 4, RULER_H / 2 + 1);
  }

  // track rows
  state.tracks.forEach((track, index) => {
    const y = RULER_H + index * ROW_H;
    ctx.fillStyle = index % 2 === 0 ? '#121a16' : '#101714';
    ctx.fillRect(0, y, width, ROW_H);
    ctx.strokeStyle = 'rgba(228,240,230,0.06)';
    ctx.beginPath();
    ctx.moveTo(0, y + ROW_H - 0.5);
    ctx.lineTo(width, y + ROW_H - 0.5);
    ctx.stroke();
  });

  // clips
  state.tracks.forEach((track, index) => {
    const rowY = RULER_H + index * ROW_H;
    for (const clip of track.clips) {
      const x = clip.start * pps;
      const w = Math.max(2, clip.duration * pps);
      const y = rowY + 11;
      const h = ROW_H - 22;
      if (x + w < 0 || x > width) continue;
      const selected = state.selection && state.selection.clipId === clip.id;
      const base = hexToRgba(track.color, selected ? 0.32 : 0.2);
      roundRect(ctx, x, y, w, h, 7);
      ctx.fillStyle = base;
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, 7);
      ctx.clip();
      drawWaveform(ctx, clip, x, y, w, h, track.color);
      // fade overlays
      if (clip.fadeIn > 0) {
        const fw = Math.min(w, clip.fadeIn * pps);
        const grad = ctx.createLinearGradient(x, 0, x + fw, 0);
        grad.addColorStop(0, 'rgba(10,15,12,0.75)');
        grad.addColorStop(1, 'rgba(10,15,12,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, fw, h);
      }
      if (clip.fadeOut > 0) {
        const fw = Math.min(w, clip.fadeOut * pps);
        const grad = ctx.createLinearGradient(x + w - fw, 0, x + w, 0);
        grad.addColorStop(0, 'rgba(10,15,12,0)');
        grad.addColorStop(1, 'rgba(10,15,12,0.75)');
        ctx.fillStyle = grad;
        ctx.fillRect(x + w - fw, y, fw, h);
      }
      ctx.restore();

      ctx.strokeStyle = selected ? '#f0f1e9' : hexToRgba(track.color, 0.65);
      ctx.lineWidth = selected ? 2 : 1;
      roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 7);
      ctx.stroke();
      ctx.lineWidth = 1;

      if (w > 46) {
        ctx.fillStyle = selected ? '#f0f1e9' : 'rgba(240,241,233,0.82)';
        ctx.font = '10px "Segoe UI", system-ui, sans-serif';
        ctx.textBaseline = 'top';
        const label = clip.name.length > Math.floor(w / 6) ? clip.name.slice(0, Math.max(3, Math.floor(w / 6))) + '…' : clip.name;
        ctx.fillText(label, x + 7, y + 5);
      }
      if (selected) {
        ctx.fillStyle = 'rgba(240,241,233,0.65)';
        ctx.fillRect(x, y + h / 2 - 9, 3, 18);
        ctx.fillRect(x + w - 3, y + h / 2 - 9, 3, 18);
      }
    }
  });

  // playhead
  const px = state.playhead * pps;
  if (px >= 0 && px <= width) {
    ctx.strokeStyle = '#ff7b71';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, height);
    ctx.stroke();
    ctx.fillStyle = '#ff7b71';
    ctx.beginPath();
    ctx.moveTo(px - 6, 0);
    ctx.lineTo(px + 6, 0);
    ctx.lineTo(px, 9);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1;
  }
}

function drawWaveform(ctx, clip, x, y, w, h, color) {
  const cache = getWaveImage(clip, w, h, color);
  if (cache) ctx.drawImage(cache, x, y, w, h);
}

function getWaveImage(clip, w, h, color) {
  const width = Math.max(1, Math.min(4000, Math.round(w)));
  const key = `${width}|${Math.round(h)}|${clip.offset.toFixed(3)}|${clip.duration.toFixed(3)}|${(clip.rate || 1).toFixed(3)}|${color}`;
  if (clip._waveKey === key && clip._wave) return clip._wave;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(1, Math.round(h));
  const c = canvas.getContext('2d');
  const data = clip.buffer.getChannelData(0);
  const sr = clip.buffer.sampleRate;
  const startSample = Math.floor(clip.offset * sr);
  const endSample = Math.min(data.length, Math.floor((clip.offset + clip.duration * (clip.rate || 1)) * sr));
  const span = Math.max(1, endSample - startSample);
  c.fillStyle = hexToRgba(color, 0.9);
  const mid = canvas.height / 2;
  for (let px = 0; px < width; px++) {
    const s0 = startSample + Math.floor((px / width) * span);
    const s1 = startSample + Math.min(span, Math.floor(((px + 1) / width) * span) + 1);
    let min = 0;
    let max = 0;
    const stride = Math.max(1, Math.floor((s1 - s0) / 24));
    for (let s = s0; s < s1; s += stride) {
      const v = data[s] || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const top = mid - max * (mid - 1);
    const bottom = mid - min * (mid - 1);
    if (bottom - top < 1) {
      c.fillRect(px, mid, 1, 1);
    } else {
      c.fillRect(px, top, 1, Math.max(1, bottom - top));
    }
  }
  clip._waveKey = key;
  clip._wave = canvas;
  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatRuler(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

function updateTime() {
  const end = getProjectEnd();
  el.time.textContent = `${formatTime(state.playhead)} / ${formatTime(end)}`;
}

function formatTime(seconds) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = (s % 60).toFixed(1).padStart(4, '0');
  return `${m}:${rest}`;
}

/* ---------- Canvas interactions ---------- */

function localPoint(event) {
  const rect = el.canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (state.view.width / rect.width),
    y: (event.clientY - rect.top) * (state.view.height / rect.height)
  };
}

function seekTo(seconds) {
  state.playhead = clamp(seconds, 0, getProjectEnd());
  updateTime();
  if (state.playing) startPlayback(state.playhead);
  else draw();
}

function findClipAt(track, seconds) {
  for (let i = track.clips.length - 1; i >= 0; i--) {
    const clip = track.clips[i];
    if (seconds >= clip.start && seconds <= clip.start + clip.duration) return clip;
  }
  return null;
}

function bindCanvas() {
  el.canvas.addEventListener('pointerdown', (event) => {
    const { x, y } = localPoint(event);
    const pps = state.view.pps;
    if (y < RULER_H) {
      seekTo(x / pps);
      return;
    }
    const index = Math.floor((y - RULER_H) / ROW_H);
    const track = state.tracks[index];
    if (!track) return;
    const clip = findClipAt(track, x / pps);
    if (!clip) {
      state.selection = null;
      renderTrackHeaders();
      renderInspector();
      seekTo(x / pps);
      draw();
      return;
    }
    state.selection = { trackId: track.id, clipId: clip.id };
    const startPx = clip.start * pps;
    const endPx = (clip.start + clip.duration) * pps;
    let mode = 'move';
    if (Math.abs(x - startPx) <= 9) mode = 'trim-start';
    else if (Math.abs(x - endPx) <= 9) mode = 'trim-end';
    state.drag = {
      mode,
      trackId: track.id,
      clipId: clip.id,
      startX: x,
      original: {
        start: clip.start,
        offset: clip.offset,
        duration: clip.duration,
        fadeIn: clip.fadeIn,
        fadeOut: clip.fadeOut
      }
    };
    try { el.canvas.setPointerCapture(event.pointerId); } catch {}
    renderTrackHeaders();
    renderInspector();
    draw();
  });

  el.canvas.addEventListener('pointermove', (event) => {
    const drag = state.drag;
    if (!drag) {
      const { x, y } = localPoint(event);
      if (y >= RULER_H) {
        const index = Math.floor((y - RULER_H) / ROW_H);
        const track = state.tracks[index];
        let cursor = 'default';
        if (track) {
          const clip = findClipAt(track, x / state.view.pps);
          if (clip) {
            const startPx = clip.start * state.view.pps;
            const endPx = (clip.start + clip.duration) * state.view.pps;
            cursor = Math.abs(x - startPx) <= 9 || Math.abs(x - endPx) <= 9 ? 'ew-resize' : 'grab';
          }
        }
        el.canvas.style.cursor = cursor;
      }
      return;
    }
    const track = state.tracks.find((t) => t.id === drag.trackId);
    const clip = track && track.clips.find((c) => c.id === drag.clipId);
    if (!clip) return;
    const { x } = localPoint(event);
    const delta = (x - drag.startX) / state.view.pps;
    const snap = (value) => event.altKey ? value : Math.round(value * 8) / 8;
    const orig = drag.original;
    if (drag.mode === 'move') {
      clip.start = Math.max(0, snap(orig.start + delta));
    } else if (drag.mode === 'trim-start') {
      const rate = orig.rate || 1;
      let newStart = clamp(snap(orig.start + delta), 0, orig.start + orig.duration - 0.05);
      let change = newStart - orig.start;
      if (orig.offset + change * rate < 0) {
        change = -orig.offset / rate;
        newStart = orig.start + change;
      }
      clip.start = Math.max(0, newStart);
      clip.offset = Math.max(0, orig.offset + change * rate);
      clip.duration = Math.max(0.05, orig.duration - change);
      clip.fadeIn = Math.min(orig.fadeIn, clip.duration / 2);
      clip.fadeOut = Math.min(orig.fadeOut, clip.duration / 2);
    } else if (drag.mode === 'trim-end') {
      clip.duration = clamp(snap(orig.duration + delta), 0.05, (clip.buffer.duration - clip.offset) / (clip.rate || 1));
      clip.fadeIn = Math.min(orig.fadeIn, clip.duration / 2);
      clip.fadeOut = Math.min(orig.fadeOut, clip.duration / 2);
    }
    clip._waveKey = null;
    resizeCanvas();
    renderInspector();
    draw();
  });

  const finishDrag = () => {
    if (!state.drag) return;
    state.drag = null;
    el.canvas.style.cursor = 'default';
    resizeCanvas();
    renderInspector();
    draw();
  };
  el.canvas.addEventListener('pointerup', finishDrag);
  el.canvas.addEventListener('pointercancel', finishDrag);

  el.canvas.addEventListener('dblclick', (event) => {
    const { x, y } = localPoint(event);
    if (y < RULER_H) return;
    const index = Math.floor((y - RULER_H) / ROW_H);
    const track = state.tracks[index];
    if (!track) return;
    const clip = findClipAt(track, x / state.view.pps);
    if (clip) {
      state.selection = { trackId: track.id, clipId: clip.id };
      seekTo(clip.start);
      renderInspector();
      renderTrackHeaders();
    }
  });
}
