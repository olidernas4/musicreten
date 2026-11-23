import {
  initEditor, importFiles, loadGeneratedSong, loadLibrarySong, addSound, exportWav,
  addLibraryAsset, getLastExport, getProjectSummary, getProjectTitle, setProjectTitle,
  saveProjectFile, loadProject
} from './editor.js';

const PROFILE_KEY = 'musicderechos.profile.v1';
const PRODUCTION_KEY = 'musicderechos.production.v1';
const state = {
  lastGenerated: null,
  certTitleTouched: false,
  toastTimer: null,
  library: {
    initialized: false,
    roots: [],
    items: [],
    total: 0,
    offset: 0,
    limit: 80,
    query: '',
    kind: 'all',
    root: '',
    loading: false,
    busy: false,
    playingId: null,
    audio: null,
    searchTimer: null
  }
};

const $ = (id) => document.getElementById(id);

const MOOD_LABELS = {
  alegre: 'Alegre', epico: 'Épico', romantico: 'Romántico', melancolico: 'Melancólico',
  misterioso: 'Misterioso', energetico: 'Energético', relajado: 'Relajado'
};

const STEM_LABELS = {
  mix: 'Mezcla completa', drums: 'Batería', bass: 'Bajo',
  harmony: 'Armonía', melody: 'Melodía', fx: 'Efectos'
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function toast(message, type = 'info') {
  const node = $('toast');
  node.textContent = message;
  node.className = `toast ${type}`;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => node.classList.add('hidden'), 4200);
}

function setView(name) {
  if (name !== 'biblioteca') stopPreview();
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === name));
  if (name === 'registro') loadRegistry();
  if (name === 'biblioteca') initLibraryView();
  if (name === 'derechos') {
    const certTitle = $('certTitle');
    if (!state.certTitleTouched || !certTitle.value) certTitle.value = getProjectTitle();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function b64url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function slugTitle(text) {
  return String(text || 'obra').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
}

/* ---------------- Profile ---------------- */

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function fillProfile() {
  const profile = loadProfile();
  $('authorName').value = profile.name || '';
  $('authorAlias').value = profile.alias || '';
  $('authorDocument').value = profile.document || '';
  $('authorCountry').value = profile.country || '';
  $('authorEmail').value = profile.email || '';
  if (profile.name) $('profileState').textContent = `Perfil guardado: ${profile.name}`;
}

function fillProduction() {
  try {
    const production = JSON.parse(localStorage.getItem(PRODUCTION_KEY) || '{}') || {};
    if (production.session) $('certSession').value = production.session;
    if (production.licenses) $('certLicenses').value = production.licenses;
  } catch {}
}

function bindProfile() {
  $('authorForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const profile = {
      name: $('authorName').value.trim(),
      alias: $('authorAlias').value.trim(),
      document: $('authorDocument').value.trim(),
      country: $('authorCountry').value.trim(),
      email: $('authorEmail').value.trim()
    };
    if (!profile.name) {
      toast('El nombre legal es obligatorio para certificar.', 'err');
      $('authorName').focus();
      return;
    }
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    $('profileState').textContent = `Perfil guardado: ${profile.name}`;
    toast('Perfil guardado en este navegador.', 'ok');
  });
}

function humanContributions() {
  return [...document.querySelectorAll('#contribGrid input:checked')].map((input) => input.value);
}

function parseCoauthors(text) {
  return String(text || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/\s+[—–|-]\s+|,\s*/);
    return { name: parts[0] || line, role: parts.slice(1).join(' ') || '' };
  });
}

/* ---------------- Generation ---------------- */

let useStylePrompt = true;

function updateStylePromptStatus() {
  const prompt = $('genPrompt').value.trim();
  const status = $('genStyleStatus');
  status.classList.toggle('is-disabled', Boolean(prompt) && !useStylePrompt);
  if (!prompt) {
    status.textContent = 'Escribe un estilo para orientar la generación.';
  } else if (useStylePrompt) {
    status.textContent = 'Estilo activado: se aplicará al generar.';
  } else {
    status.textContent = 'Estilo desactivado: se ignorará en esta generación.';
  }
}

function setStylePromptEnabled(enabled) {
  useStylePrompt = enabled;
  const button = $('btnToggleStyle');
  button.setAttribute('aria-pressed', String(enabled));
  button.textContent = `Usar estilo: ${enabled ? 'Sí' : 'No'}`;
  button.classList.toggle('is-on', enabled);
  updateStylePromptStatus();
}

function isMetalcoreStyle(text) {
  return /\b(?:metalcore|metal[\s-]+core|post[\s-]+hardcore|deathcore|djent|breakdown|heavy metal|thrash)\b/i.test(text);
}

function bindSunoUI() {
  // Accordion collapse/expand
  document.querySelectorAll('[data-accordion]').forEach((header) => {
    header.addEventListener('click', () => {
      const cardId = header.dataset.accordion;
      const card = $(cardId);
      if (card) card.classList.toggle('collapsed');
    });
  });

  // Segmented Mode: Sencillo vs Avanzado
  const btnSimple = $('sunoModeSimple');
  const btnAdv = $('sunoModeAdvanced');
  if (btnSimple && btnAdv) {
    btnSimple.addEventListener('click', () => {
      btnSimple.classList.add('active');
      btnAdv.classList.remove('active');
      $('cardLetra')?.classList.add('collapsed');
      $('cardMasOpciones')?.classList.add('collapsed');
    });
    btnAdv.addEventListener('click', () => {
      btnAdv.classList.add('active');
      btnSimple.classList.remove('active');
      $('cardLetra')?.classList.remove('collapsed');
      $('cardMasOpciones')?.classList.remove('collapsed');
    });
  }

  // Quick Action Chips: + Audio, + Voice, + Inspiración
  $('chipAddAudio')?.addEventListener('click', () => {
    setView('biblioteca');
    toast('Explora tu biblioteca de Ableton, EZdrummer 3 y SoundFonts.', 'info');
  });
  $('chipAddVoice')?.addEventListener('click', () => {
    toast('Escribe tu letra en la tarjeta de Letra para estructurar las secciones vocales.', 'info');
  });
  $('chipInspiration')?.addEventListener('click', () => {
    const inspirations = [
      'metalcore, heavy breakdown, driving drums, distorted guitar, raw bass',
      'dark ethereal, bittersweet, girl vocal, lofi hip hop, heavy 808 bass',
      'post-hardcore, drop D riff, acoustic drums, energetic chorus',
      'lofi chillout, rhodes piano, vinyl dust, deep warm electric bass',
      'melodic metalcore, guitar leads, breakdown, acoustic rock outro'
    ];
    const picked = inspirations[Math.floor(Math.random() * inspirations.length)];
    $('genPrompt').value = picked;
    updateStylePromptStatus();
    toast(`Inspiración cargada: ${picked.split(',')[0]}`, 'ok');
  });

  // Style Tag Chips
  const tagScroller = $('sunoTagsScroller');
  if (tagScroller) {
    tagScroller.querySelectorAll('.suno-tag').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        const input = $('genPrompt');
        let current = input.value.trim();
        const tags = current ? current.split(',').map(s => s.trim()).filter(Boolean) : [];
        const index = tags.findIndex(t => t.toLowerCase() === tag.toLowerCase());
        if (index >= 0) {
          tags.splice(index, 1);
          btn.classList.remove('active');
        } else {
          tags.push(tag);
          btn.classList.add('active');
        }
        input.value = tags.join(', ');
        if (!useStylePrompt) setStylePromptEnabled(true);
        else updateStylePromptStatus();
      });
    });
  }

  // Magic Wand & Refresh Buttons
  $('btnMagicWand')?.addEventListener('click', () => {
    const magicStyles = [
      'metalcore, heavy breakdown, driving drums, distorted guitar, raw electric bass',
      'dark ethereal, bittersweet, girl vocal, lofi hip hop, heavy 808 bass',
      'post-hardcore, aggressive riff, blast beats, dynamic verse',
      'acoustic rock, fingerpicked guitar, live acoustic room drums, warm bass',
      'modern metalcore, djent groove, 145 bpm, punchy acoustic drums'
    ];
    const pick = magicStyles[Math.floor(Math.random() * magicStyles.length)];
    $('genPrompt').value = pick;
    if (!useStylePrompt) setStylePromptEnabled(true);
    else updateStylePromptStatus();
    toast('¡Estilo mágico aplicado!', 'ok');
  });

  $('btnRandomStyle')?.addEventListener('click', () => {
    const styles = [
      'metalcore, heavy breakdown',
      'bittersweet, girl vocal, lofi hip hop',
      'acoustic rock, driving drums, electric bass',
      'melodic post-hardcore, fast drums',
      'dark ethereal, heavy bass, ambient keys'
    ];
    $('genPrompt').value = styles[Math.floor(Math.random() * styles.length)];
    if (!useStylePrompt) setStylePromptEnabled(true);
    else updateStylePromptStatus();
  });

  // Pink Sliders with Output Updates
  const sliderR = $('sliderRareza');
  if (sliderR) {
    sliderR.addEventListener('input', () => {
      $('valRareza').textContent = `${sliderR.value}%`;
    });
  }
  const sliderI = $('sliderInfluencia');
  if (sliderI) {
    sliderI.addEventListener('input', () => {
      $('valInfluencia').textContent = `${sliderI.value}%`;
    });
  }
  const sliderV = $('sliderVariedad');
  if (sliderV) {
    sliderV.addEventListener('input', () => {
      const v = Number(sliderV.value);
      $('valVariedad').textContent = v < 35 ? 'Baja' : v <= 70 ? 'Normal' : 'Alta';
    });
  }
  const sliderD = $('genDurationSlider');
  if (sliderD) {
    sliderD.addEventListener('input', () => {
      $('valDuration').textContent = `${sliderD.value} s`;
      if ($('genDuration')) $('genDuration').value = String(sliderD.value);
    });
  }

  // Toggle Groups (Género vocal, Duración, Modo Max, Personalizar)
  document.querySelectorAll('.suno-toggle-group').forEach((group) => {
    group.querySelectorAll('.suno-btn-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.suno-btn-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (group.id === 'groupDuration') {
          const isCustom = btn.dataset.val === 'custom';
          const box = $('customDurationBox');
          if (box) box.classList.toggle('hidden', !isCustom);
        }
      });
    });
  });

  // Sparkle Button (AI Lyrics Assistant)
  $('btnGenerateLyrics')?.addEventListener('click', async () => {
    const style = $('genPrompt').value.trim() || 'metalcore';
    const lyricsBox = $('sunoLyrics');
    const isMetal = /metal|rock|core/i.test(style);
    if (isMetal) {
      lyricsBox.value = `[Verse]
Gritos callados rompen el cristal
La tormenta arde en el temporal
Ya no hay retorno, no queda piedad
La fuerza renace en la oscuridad

[Chorus]
Bajo el fuego no caeremos jamás
Rompemos las cadenas, cruzamos el compás
Siente la fuerza que hace temblar
La tierra entera al respirar

[Breakdown]
¡Despierta!
¡Rompe todo!

[Outro]
Cicatrices de metal
Eternos hasta el final`;
    } else {
      lyricsBox.value = `[Verse]
Luces tenues sobre la ciudad
Un recuerdo vuelve sin avisar
Gotas lentas en la habitación
Ecos suaves en una canción

[Chorus]
Y si el tiempo vuelve a pasar
Nuestras voces van a quedar
Sabor agridulce en la noche gris
Cántalo otra vez para ser feliz

[Outro]
Bajo el cielo de cristal
Una noche más sin mirar atrás`;
    }
    toast('¡Letra generada y estructurada con éxito!', 'ok');
  });

  // Format Lyrics Action
  $('btnFormatLyrics')?.addEventListener('click', () => {
    const lyricsBox = $('sunoLyrics');
    if (!lyricsBox.value.includes('[Verse]')) {
      lyricsBox.value = `[Verse]\n${lyricsBox.value}\n\n[Chorus]\nTu coro aquí\n\n[Outro]\nFinal de la obra`;
    }
    toast('Estructura [Verse] / [Chorus] insertada.', 'info');
  });

  // Reset Options Action
  $('btnResetOptions')?.addEventListener('click', () => {
    if ($('sliderRareza')) $('sliderRareza').value = 50;
    if ($('valRareza')) $('valRareza').textContent = '50%';
    if ($('sliderInfluencia')) $('sliderInfluencia').value = 50;
    if ($('valInfluencia')) $('valInfluencia').textContent = '50%';
    if ($('sliderVariedad')) $('sliderVariedad').value = 50;
    if ($('valVariedad')) $('valVariedad').textContent = 'Normal';
    if ($('drumKitSelect')) $('drumKitSelect').value = '';
    if ($('drumGrooveSelect')) $('drumGrooveSelect').value = 'auto';
    toast('Opciones restablecidas a valores estándar.', 'info');
  });

  // Workspace Selection Action
  $('btnSelectWorkspace')?.addEventListener('click', () => {
    setView('biblioteca');
    toast('Selecciona carpetas en la Biblioteca.', 'info');
  });
}

function bindGeneration() {
  $('btnGenerate').addEventListener('click', generateSong);
  $('btnToggleStyle')?.addEventListener('click', () => setStylePromptEnabled(!useStylePrompt));
  $('genPrompt').addEventListener('input', () => {
    if ($('genPrompt').value.trim() && !useStylePrompt) {
      setStylePromptEnabled(true);
    } else {
      updateStylePromptStatus();
    }
  });
  $('styleSuggestions')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-style-tag]');
    if (!button) return;
    const prompt = $('genPrompt');
    const tag = button.dataset.styleTag;
    const existing = prompt.value.trim();
    const tags = existing.split(',').map((item) => item.trim().toLocaleLowerCase());
    if (!tags.includes(tag.toLocaleLowerCase())) {
      prompt.value = existing ? `${existing.replace(/,\s*$/, '')}, ${tag}` : tag;
    }
    if (!useStylePrompt) setStylePromptEnabled(true);
    else updateStylePromptStatus();
    prompt.focus();
  });
  $('separationInput').addEventListener('change', () => {
    const file = $('separationInput').files[0];
    $('separationFileName').textContent = file ? file.name : 'Ningún archivo seleccionado';
    $('btnSeparate').disabled = !file;
  });
  $('btnSeparate').addEventListener('click', separateSong);
  $('genPrompt').addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') generateSong();
  });
  $('genSeed')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') generateSong();
  });
  bindSunoUI();
}

async function separateSong() {
  const file = $('separationInput').files[0];
  if (!file) return;
  const button = $('btnSeparate');
  const result = $('separationResult');
  button.disabled = true;
  renderSeparationProgress(0, 'Preparando la canción', 'Se mostrará el avance de la subida y la separación.', true);
  try {
    const job = await uploadSeparation(file, (loaded, total) => {
      const percent = total ? Math.round((loaded / total) * 100) : 0;
      button.textContent = `Subiendo ${percent}%…`;
      renderSeparationProgress(percent, 'Subiendo canción', `${formatBytes(loaded)} de ${formatBytes(total || file.size)}`, true);
    });
    let data;
    while (true) {
      const statusResponse = await fetch(`/api/separate/${encodeURIComponent(job.jobId)}`, { cache: 'no-store' });
      const status = await statusResponse.json();
      if (!statusResponse.ok || !status.ok) throw new Error(status.error || 'No se pudo consultar la separación.');
      if (status.status === 'error') throw new Error(status.error || 'No se pudo separar la canción.');
      const percent = Math.min(99, Math.round(status.progress || 0));
      button.textContent = `Separando ${percent}%…`;
      renderSeparationProgress(percent, status.stage || 'Separando en este equipo', 'El tiempo depende de la duración de la canción y del rendimiento del equipo.', true);
      if (status.status === 'complete') {
        data = status;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 900));
    }

    result.innerHTML = `
      ${renderSeparationProgressMarkup(100, 'Separación terminada', 'Los cuatro stems están listos para escuchar, descargar o cargar al estudio.')}
      <div class="separation-stems">
        ${data.stems.map((stem) => `
          <div class="separation-stem">
            <strong>${esc(stem.label)}</strong>
            <a href="${esc(stem.url)}" download="${esc(data.fileName)}-${esc(stem.key)}.wav">Descargar WAV</a>
            <audio controls preload="none" src="${esc(stem.url)}"></audio>
          </div>
        `).join('')}
      </div>
      <div class="action-row">
        <button id="btnLoadSeparated" class="btn primary">Abrir las 4 pistas en el estudio</button>
        <span class="muted small">Se importan como pistas de audio independientes; después puedes mover, recortar, ajustar volumen y exportar.</span>
      </div>
      <div id="separationLoadProgress" class="separation-load-progress" aria-live="polite"></div>
    `;
    let nextStem = 0;
    $('btnLoadSeparated').addEventListener('click', async () => {
      const loadButton = $('btnLoadSeparated');
      loadButton.disabled = true;
      try {
        while (nextStem < data.stems.length) {
          const index = nextStem;
          const stem = data.stems[index];
          const count = data.stems.length;
          const percent = Math.floor((index / count) * 100);
          const loadProgress = $('separationLoadProgress');
          loadProgress.innerHTML = renderSeparationProgressMarkup(
            percent,
            `Preparando ${stem.label} (${index + 1} de ${count})`,
            `${index} de ${count} pistas listas. Cada WAV se descarga y decodifica por separado.`,
            true
          );
          loadButton.textContent = `Cargando pista ${index + 1} de ${count}…`;
          const stemResponse = await fetch(stem.url);
          if (!stemResponse.ok) throw new Error(`No se pudo descargar la pista ${stem.label}.`);
          const blob = await stemResponse.blob();
          const file = new File([blob], `${stem.label}.wav`, { type: 'audio/wav' });
          const imported = await importFiles([file], {
            onProgress: (progress) => {
              const loadedCount = progress.phase === 'complete' ? index + 1 : index;
              const loadedPercent = Math.floor((loadedCount / count) * 100);
              const message = progress.phase === 'decoding'
                ? `Decodificando ${stem.label} (${index + 1} de ${count})`
                : `${index + 1} de ${count} pistas listas`;
              loadProgress.innerHTML = renderSeparationProgressMarkup(
                loadedPercent,
                message,
                'El porcentaje cuenta pistas terminadas; la pista actual puede tardar un momento en canciones largas.',
                true
              );
            }
          });
          if (imported.added !== 1) throw new Error(`No se pudo decodificar la pista ${stem.label}.`);
          nextStem++;
        }
        $('separationLoadProgress').innerHTML = renderSeparationProgressMarkup(
          100,
          'Las 4 pistas están listas',
          'Abriendo el estudio multipista.'
        );
        loadButton.textContent = 'Pistas cargadas';
        setProjectTitle(`${data.fileName} - pistas separadas`);
        setView('estudio');
        requestAnimationFrame(() => {
          const timeline = $('canvasScroll');
          if (timeline) timeline.scrollTop = timeline.scrollHeight;
        });
      } catch (err) {
        loadButton.disabled = false;
        loadButton.textContent = `Reintentar desde la pista ${nextStem + 1} de ${data.stems.length}`;
        $('separationLoadProgress').innerHTML = renderSeparationProgressMarkup(
          Math.floor((nextStem / data.stems.length) * 100),
          `No se pudo cargar la pista ${nextStem + 1}`,
          err.message
        );
        toast(err.message, 'err');
      } finally {
        if (nextStem === data.stems.length) loadButton.disabled = true;
      }
    });
    toast('Separación local terminada. Ya puedes escuchar o cargar los stems.', 'ok');
  } catch (err) {
    result.innerHTML = `<p class="verify-bad">${esc(err.message)}</p>`;
    toast(err.message, 'err');
  } finally {
    button.disabled = false;
    button.textContent = 'Separar en pistas';
  }
}

function uploadSeparation(file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/separate');
    request.setRequestHeader('x-file-name', encodeURIComponent(file.name));
    request.timeout = 35 * 60 * 1000;
    request.upload.addEventListener('progress', (event) => {
      onProgress(event.loaded, event.lengthComputable ? event.total : file.size);
    });
    request.addEventListener('load', () => {
      let payload;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        reject(new Error('El servidor devolvió una respuesta no válida.'));
        return;
      }
      if (request.status !== 202 || !payload.ok || !payload.jobId) {
        reject(new Error(payload.error || 'No se pudo iniciar la separación.'));
        return;
      }
      resolve(payload);
    });
    request.addEventListener('error', () => reject(new Error('Falló la conexión durante la subida de la canción.')));
    request.addEventListener('timeout', () => reject(new Error('La subida tardó demasiado y se canceló.')));
    request.send(file);
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderSeparationProgressMarkup(percent, label, detail, active = false) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return `
    <div class="separation-progress">
      <div class="separation-progress-head"><strong>${esc(label)}</strong><span>${value}%</span></div>
      <div
        class="separation-progress-bar${active ? ' is-active' : ''}"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="${value}"
        aria-label="${esc(label)}: ${value}%"
      ><span style="width:${value}%"></span></div>
      <p class="muted small">${esc(detail)}</p>
    </div>
  `;
}

function renderSeparationProgress(percent, label, detail, active = false) {
  $('separationResult').innerHTML = renderSeparationProgressMarkup(percent, label, detail, active);
}

function activeToggleValue(groupId, fallback = '') {
  const active = document.querySelector(`#${groupId} .suno-btn-toggle.active`);
  return active ? active.dataset.val : fallback;
}

async function loadDrumCatalog() {
  const kitSelect = $('drumKitSelect');
  if (!kitSelect) return;
  try {
    const data = await readJsonResponse(await fetch('/api/drums/catalog', { cache: 'no-store' }));
    const drums = data.drums || {};
    const kits = drums.kits || [];
    kitSelect.innerHTML = `<option value="">Kit: automático</option>${kits
      .map((kit) => `<option value="${esc(kit)}">${esc(kit)}</option>`).join('')}`;
    const grooveOption = $('drumGrooveSelect')?.querySelector('option[value="auto"]');
    if (grooveOption && drums.total) grooveOption.textContent = `Grooves: auto (${drums.total})`;
  } catch {
    kitSelect.innerHTML = '<option value="">Kit: automático</option>';
  }
}

async function generateSong() {
  const button = $('btnGenerate');
  const result = $('genResult');
  const librarySelected = !$('genUseLibrary') || $('genUseLibrary').checked;
  const styleText = $('genPrompt').value.trim();
  const metalcoreStyle = $('genGenre').value === 'metalcore' ||
    (useStylePrompt && isMetalcoreStyle(styleText));
  const useLibrary = librarySelected;
  const useLibraryMetalcore = useLibrary && metalcoreStyle;
  const useSynthGuitar = !useLibrary && metalcoreStyle;
  button.disabled = true;
  button.innerHTML = '<span class="crear-icon">⏳</span><span class="crear-label">Componiendo…</span>';
  const progressDetail = useLibraryMetalcore
    ? 'Buscando un loop de guitarra y un kit de batería acústica en tu biblioteca…'
    : useLibrary
      ? 'Eligiendo un kit y multisamples coherentes de tu biblioteca…'
      : useSynthGuitar
        ? 'Generando metalcore instrumental con guitarra sintetizada local…'
        : 'Generando armonía, melodía, groove y mezcla por stems…';
  result.innerHTML = `<div class="empty-state"><div class="empty-icon">✦</div><h3>Componiendo tu canción</h3><p>${progressDetail}</p></div>`;

  const seedValue = $('genSeed')?.value.trim() || '';
  const customTitle = $('sunoSongTitle')?.value.trim() || '';
  const payload = {
    prompt: useStylePrompt ? styleText : '',
    useStyle: useStylePrompt,
    genre: $('genGenre')?.value || 'auto',
    mood: $('genMood')?.value || 'auto',
    key: $('genKey')?.value || 'auto',
    mode: $('genMode')?.value || 'auto',
    bpm: Number($('genBpm')?.value) || undefined,
    duration: Number($('genDurationSlider')?.value || $('genDuration')?.value || 90),
    seed: seedValue === '' ? '' : Number(seedValue),
    rarity: Number($('sliderRareza')?.value ?? 50),
    influence: Number($('sliderInfluencia')?.value ?? 50),
    variety: Number($('sliderVariedad')?.value ?? 50),
    lyrics: $('sunoLyrics')?.value.trim() || '',
    vocalGender: activeToggleValue('groupVocalGender', 'instrumental'),
    drumKit: $('drumKitSelect')?.value || '',
    useGrooves: activeToggleValue('drumGrooveSelect', 'auto') !== 'off'
  };
  const grooveMode = activeToggleValue('drumGrooveSelect', 'auto');
  if (grooveMode !== 'auto' && grooveMode !== 'off') payload.grooveFeel = grooveMode;
  if (customTitle) payload.title = customTitle;

  try {
    const useRealLibrary = true;
    const res = await fetch(useRealLibrary ? '/api/compose/library' : '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo generar la canción');
    state.lastGenerated = data.song;
    renderGenerated(data.song);
    if (useLibraryMetalcore) {
      const guitar = (data.song.usedAssets || []).find((asset) => asset.roles.includes('guitar'));
      const notice = document.createElement('p');
      notice.className = 'generation-notice';
      notice.textContent = `Metalcore con instrumentos reales de tu biblioteca: ${guitar ? guitar.name : 'guitarra'} y batería real.`;
      result.prepend(notice);
    }
    if (payload.vocalGender !== 'instrumental') {
      const notice = document.createElement('p');
      notice.className = 'generation-notice';
      notice.textContent = 'La voz todavía no se sintetiza: la letra y el género vocal se guardan en el proyecto para trabajarlos en un DAW.';
      result.prepend(notice);
    }
    renderSpec(data.song);
    $('certTitle').value = data.song.title;
    $('certTitle').dataset.auto = '1';
    state.certTitleTouched = false;
    toast(useLibraryMetalcore
      ? 'Metalcore organizado con el loop de guitarra y batería de tu biblioteca.'
      : useSynthGuitar
        ? 'Metalcore generado con guitarra sintetizada.'
      : 'Canción generada. Escúchala o cárgala en el estudio.', 'ok');
  } catch (err) {
    result.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠</div><h3>No se pudo generar</h3><p>${esc(err.message)}</p></div>`;
    toast(err.message, 'err');
  } finally {
    button.disabled = false;
    button.innerHTML = '<span class="crear-icon">🎵</span><span class="crear-label">Crear</span>';
  }
}

function renderGenerated(song) {
  const result = $('genResult');
  const isLibrary = song.engine === 'library';
  const stemKeys = ['drums', 'bass', 'harmony', 'melody', 'fx'];
  const stems = stemKeys.filter((key) => song.files && song.files[key]).map((key) => `
    <div class="stem">
      <span>${esc(STEM_LABELS[key] || key)}</span>
      <audio controls preload="none" src="${esc(song.files[key])}"></audio>
      <a href="${esc(song.files[key])}" download>Descargar</a>
    </div>
  `).join('');
  const libraryTracks = isLibrary
    ? `<div class="library-result">
        <div class="chip-row">
          ${(song.tracks || []).map((track) => `<span class="chip">${esc(track.name)} · ${track.clips.length} clips</span>`).join('')}
        </div>
        <div class="used-preview">
          <strong>${esc((song.usedAssets || []).length)} sonidos de tu biblioteca</strong>
          <div class="muted small">${(song.usedAssets || []).slice(0, 10).map((asset) => esc(asset.name)).join(' · ')}${(song.usedAssets || []).length > 10 ? ' …' : ''}</div>
        </div>
        ${song.warnings && song.warnings.length ? `<p class="muted small">${song.warnings.map(esc).join(' ')}</p>` : ''}
      </div>`
    : `<div class="stem-list">
        <div class="stem">
          <span>${esc(STEM_LABELS.mix)}</span>
          <audio controls preload="none" src="${esc(song.files.mix)}"></audio>
          <a href="${esc(song.files.mix)}" download>Descargar</a>
        </div>
        ${stems}
      </div>`;

  result.innerHTML = `
    <div class="result-head">
      <div>
        <div class="eyebrow">${isLibrary ? 'Biblioteca local' : 'Generación local'} · semilla ${esc(song.seed)}</div>
        <div class="result-title">${esc(song.title)}</div>
        <div class="muted small">${esc(song.genreLabel)} · ${esc(MOOD_LABELS[song.mood] || song.mood)}</div>
      </div>
      <span class="chip green">${esc(song.bpm)} BPM</span>
    </div>
    <div class="chip-row">
      <span class="chip accent">${esc(song.key)}</span>
      <span class="chip">${esc(song.bars)} compases</span>
      <span class="chip">${esc(song.duration)} s</span>
      ${song.sampleRate ? `<span class="chip">${esc(song.sampleRate)} Hz</span>` : ''}
    </div>
    ${libraryTracks}
    <div class="action-row">
      <button class="btn primary" id="btnLoadSong">Cargar en el estudio</button>
      <button class="btn" id="btnCertifyBase">Editar y certificar</button>
    </div>
    <p class="muted small" style="margin-top:12px">${esc(song.authorsNote || '')}</p>
  `;

  const loader = isLibrary ? loadLibrarySong : loadGeneratedSong;
  $('btnLoadSong').addEventListener('click', async () => {
    const btn = $('btnLoadSong');
    btn.disabled = true;
    btn.textContent = isLibrary ? 'Cargando sonidos…' : 'Cargando pistas…';
    try {
      await loader(song);
      setProjectTitle(song.title);
      $('certTitle').value = song.title;
      state.certTitleTouched = false;
      setView('estudio');
    } catch (err) {
      toast(err.message || 'No se pudo cargar en el estudio', 'err');
      btn.disabled = false;
      btn.textContent = 'Cargar en el estudio';
    }
  });
  $('btnCertifyBase').addEventListener('click', async () => {
    try {
      await loader(song);
      setProjectTitle(song.title);
      $('certTitle').value = song.title;
      state.certTitleTouched = false;
      setView('derechos');
      toast('Pistas cargadas. Completa el perfil y certifica.', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
  });
}

function renderSpec(song) {
  const spec = song.spec || {};
  const form = spec.form || [];
  const progressions = spec.progression || {};
  const material = spec.material;
  const arrangement = spec.arrangement || {};
  const formRows = form.map((section) => `
    <div class="section-row">
      <span style="width:132px;color:var(--muted)">${esc(section.label)} · ${esc(section.bars)}c${section.development ? `<small style="display:block">${esc(section.development)}</small>` : ''}</span>
      <span class="bar"><i style="width:${Math.round(section.energy * 100)}%"></i></span>
      <span style="width:64px;text-align:right;color:var(--muted)">${esc((section.progression || []).join(' '))}</span>
    </div>
  `).join('');

  const pushPull = (spec.groove && spec.groove.pushPull) || [];
  const tips = (spec.mix && spec.mix.tips) || [];

  $('genSpecCard').innerHTML = `
    <div class="spec-title"><h2>Ficha técnica de la canción</h2><span class="muted small">${esc(song.id)}</span></div>
    <div class="spec-grid">
      <div class="spec-box"><span>Tonalidad</span><strong>${esc(song.key)}</strong></div>
      <div class="spec-box"><span>Tempo</span><strong>${esc(song.bpm)} BPM</strong></div>
      <div class="spec-box"><span>Compases</span><strong>${esc(song.bars)} · 4/4</strong></div>
      <div class="spec-box"><span>Semilla</span><strong>${esc(song.seed)}</strong></div>
    </div>
    <h3 class="spaced">Forma y energía</h3>
    <div class="section-list">${formRows}</div>
    ${material ? `
      <h3 class="spaced">${song.genre === 'metalcore' ? 'Riff de guitarra' : 'Motivo conductor'}</h3>
      <div class="spec-box">
        <p>${esc(material.motif || '')}</p>
        <p class="muted small">${esc(material.character || '')}</p>
        ${Array.isArray(material.contour) ? `<div class="muted small">Contorno: ${material.contour.map((step) => esc(step)).join(' → ')}</div>` : ''}
      </div>
      ${arrangement.hook ? `<p class="muted small">${esc(arrangement.hook)}</p>` : ''}
    ` : ''}
    <h3 class="spaced">Progresiones</h3>
    <div class="spec-grid" style="grid-template-columns:1fr 1fr 1fr">
      <div class="spec-box"><span>Verso</span><strong>${esc((progressions.versos || []).join(' · '))}</strong><div class="muted small" style="margin-top:4px">${esc((progressions.versosRoman || []).join(' – '))}</div></div>
      <div class="spec-box"><span>Coro</span><strong>${esc((progressions.coro || []).join(' · '))}</strong><div class="muted small" style="margin-top:4px">${esc((progressions.coroRoman || []).join(' – '))}</div></div>
      <div class="spec-box"><span>Puente</span><strong>${esc((progressions.puente || []).join(' · '))}</strong><div class="muted small" style="margin-top:4px">${esc((progressions.puenteRoman || []).join(' – '))}</div></div>
    </div>
    <h3 class="spaced">Groove</h3>
    <ul class="feature-list">
      <li>Feel: ${esc(spec.groove?.feel || 'recto')}${spec.groove?.swing ? ` · swing ${esc(spec.groove.swing)}` : ''}</li>
      ${pushPull.map((p) => `<li>${esc(p.part)}: ${esc(p.offset_ms)} ms — ${esc(p.note)}</li>`).join('')}
    </ul>
    <h3 class="spaced">Decisiones de mezcla</h3>
    <ul class="feature-list">${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  `;
}

/* ---------------- Library ---------------- */

const KIND_LABELS = { audio: 'Audio', midi: 'MIDI', clip: 'Clip Ableton', groove: 'Groove', session: 'Sesión' };

function formatDuration(seconds) {
  if (!seconds || !Number.isFinite(seconds)) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

async function readJsonResponse(res) {
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok || !data || data.ok === false) {
    throw new Error((data && data.error) || `Error ${res.status}`);
  }
  return data;
}

function initLibraryView() {
  const lib = state.library;
  if (!lib.initialized) {
    lib.initialized = true;
    bindLibrary();
  }
  refreshLibrary({ autoDetect: true });
}

async function refreshLibrary({ autoDetect = true } = {}) {
  try {
    await loadLibraryRoots({ autoDetect });
    await loadAssets({ reset: true });
  } catch (err) {
    setLibraryStatus(err.message || 'No se pudo cargar la biblioteca.');
    toast(err.message || 'No se pudo cargar la biblioteca.', 'err');
  }
}

async function loadLibraryRoots({ autoDetect = true } = {}) {
  const lib = state.library;
  const data = await readJsonResponse(await fetch('/api/assets/roots'));
  lib.roots = data.roots || [];
  if (autoDetect && !lib.roots.length) {
    const detected = await readJsonResponse(await fetch('/api/assets/detect', { method: 'POST' }));
    lib.roots = detected.roots || [];
    if (lib.roots.length) setLibraryStatus('Carpetas de Ableton detectadas. Pulsa Escanear todo para indexarlas.');
  }
  renderLibraryRoots();
  updateLibraryTotals();
}

function renderLibraryRoots() {
  const lib = state.library;
  const list = $('assetRoots');
  if (!lib.roots.length) {
    list.innerHTML = '<p class="muted small">Sin carpetas todavía. Pulsa «Detectar Ableton» o añade una ruta manualmente.</p>';
    return;
  }
  list.innerHTML = lib.roots.map((root) => `
    <div class="root-item">
      <div class="root-item-head">
        <strong>${esc(root.name)}</strong>
        <span class="muted small">${root.assetCount || 0}</span>
      </div>
      <div class="root-item-path" title="${esc(root.path)}">${esc(root.path)}</div>
      <div class="root-item-actions">
        <button class="btn small-btn" data-scan-root="${esc(root.id)}">Escanear</button>
        <button class="btn small-btn" data-remove-root="${esc(root.id)}">Quitar</button>
      </div>
    </div>
  `).join('');
  renderRootFilter();
}

function renderRootFilter() {
  const lib = state.library;
  const select = $('assetRootFilter');
  if (lib.root && !lib.roots.some((root) => root.id === lib.root)) lib.root = '';
  select.innerHTML = '<option value="">Todas las carpetas</option>' + lib.roots.map((root) =>
    `<option value="${esc(root.id)}"${root.id === lib.root ? ' selected' : ''}>${esc(root.name)} (${root.assetCount || 0})</option>`
  ).join('');
}

function updateLibraryTotals() {
  const lib = state.library;
  const total = lib.roots.reduce((sum, root) => sum + (root.assetCount || 0), 0);
  $('libraryTotals').textContent = `${total} activos · ${lib.roots.length} carpeta${lib.roots.length === 1 ? '' : 's'}`;
}

function setLibraryStatus(text) {
  const node = $('libraryStatus');
  if (node) node.textContent = text;
}

function setLibraryBusy(busy) {
  state.library.busy = busy;
  for (const id of ['btnScanAll', 'btnDetectAbleton', 'btnAddRoot', 'btnRefreshLibrary', 'assetImportFiles', 'assetImportFolder']) {
    const button = $(id);
    if (button) button.disabled = busy;
  }
}

async function importAudioFiles(fileList) {
  const files = [...fileList].filter((file) => file && file.name);
  if (!files.length || state.library.busy) return;
  setLibraryBusy(true);
  const status = $('importStatus');
  let ok = 0;
  let failed = 0;
  let rootId = null;
  for (const file of files) {
    const label = file.webkitRelativePath || file.name;
    if (status) status.textContent = `Importando ${ok + failed + 1}/${files.length}: ${label}`;
    try {
      const res = await fetch('/api/assets/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-file-name': encodeURIComponent(label)
        },
        body: file
      });
      const data = await readJsonResponse(res);
      rootId = data.rootId || rootId;
      ok++;
    } catch {
      failed++;
    }
  }
  setLibraryBusy(false);
  if (status) status.textContent = `${ok} importado${ok === 1 ? '' : 's'}${failed ? `, ${failed} con error` : ''}.`;
  if (ok) {
    toast(`${ok} sonido${ok === 1 ? '' : 's'} importado${ok === 1 ? '' : 's'}. Indexando…`, 'ok');
    await runScan(rootId);
  } else {
    toast('No se pudo importar ningún archivo.', 'err');
  }
}

async function loadAssets({ reset = false } = {}) {
  const lib = state.library;
  if (reset) {
    lib.offset = 0;
    lib.items = [];
  }
  const token = (lib.loadToken || 0) + 1;
  lib.loadToken = token;
  lib.loading = true;
  const params = new URLSearchParams({
    q: lib.query,
    kind: lib.kind,
    root: lib.root,
    limit: String(lib.limit),
    offset: String(lib.offset)
  });
  try {
    const data = await readJsonResponse(await fetch(`/api/assets?${params}`));
    if (token !== lib.loadToken) return;
    lib.items = reset ? data.items : lib.items.concat(data.items);
    lib.total = data.total;
    renderAssets();
  } catch (err) {
    if (token === lib.loadToken) toast(err.message || 'No se pudo consultar la biblioteca.', 'err');
  } finally {
    if (token === lib.loadToken) {
      lib.loading = false;
      if (!lib.items.length && lib.roots.length) setLibraryStatus('No hay resultados. Prueba otra búsqueda o pulsa Escanear todo.');
    }
  }
}

function renderAssets() {
  const lib = state.library;
  const list = $('assetList');
  $('assetCount').textContent = lib.total ? `${lib.items.length} de ${lib.total}` : '';
  $('btnLoadMore').hidden = lib.items.length >= lib.total;

  if (!lib.items.length) {
    const message = lib.roots.length
      ? 'No hay activos que coincidan. Prueba otra búsqueda o escanea las carpetas.'
      : 'Detecta tu biblioteca de Ableton o añade una carpeta y pulsa Escanear.';
    list.innerHTML = `<div class="empty-state small"><p>${message}</p></div>`;
    return;
  }

  list.innerHTML = lib.items.map((asset) => {
    const tags = [KIND_LABELS[asset.kind] || asset.kind];
    if (asset.bpm) tags.push(`${asset.bpm} BPM`);
    if (asset.musicalKey) tags.push(asset.musicalKey);
    const duration = formatDuration(asset.duration);
    if (duration) tags.push(duration);
    const ext = (asset.ext || '').replace('.', '').toUpperCase();
    const playing = lib.playingId === asset.id;
    const actions = asset.playable
      ? `<button class="btn play" data-preview="${esc(asset.id)}">${playing ? 'Detener' : 'Escuchar'}</button>
         <button class="btn" data-add="${esc(asset.id)}">Añadir</button>`
      : '<span class="btn ref" title="Se indexa como referencia, pero este formato no se puede reproducir">Referencia</span>';
    return `
      <div class="asset-row${playing ? ' playing' : ''}" data-asset-id="${esc(asset.id)}" draggable="${asset.playable ? 'true' : 'false'}" title="${esc(asset.relPath || asset.path || '')}">
        <div class="asset-kind ${esc(asset.kind)}">${esc(ext || (asset.kind || '').toUpperCase())}</div>
        <div>
          <div class="asset-name">${esc(asset.name)}</div>
          <div class="asset-meta">${tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}</div>
          <div class="asset-path">${esc(asset.relPath || asset.path || '')}</div>
        </div>
        <div class="asset-actions">${actions}</div>
      </div>
    `;
  }).join('');
}

function findLibraryAsset(id) {
  return state.library.items.find((asset) => asset.id === id);
}

function stopPreview() {
  const lib = state.library;
  if (lib.audio) {
    lib.audio.onended = null;
    lib.audio.onerror = null;
    lib.audio.pause();
    lib.audio.removeAttribute('src');
    try { lib.audio.load(); } catch {}
  }
  if (lib.playingId) {
    lib.playingId = null;
    renderAssets();
  }
}

async function togglePreview(id) {
  const lib = state.library;
  if (lib.playingId === id) {
    stopPreview();
    return;
  }
  const asset = findLibraryAsset(id);
  if (!asset || !asset.playable) return;
  stopPreview();
  if (!lib.audio) lib.audio = new Audio();
  lib.audio.onended = () => stopPreview();
  lib.audio.onerror = () => {
    stopPreview();
    toast('No se pudo reproducir este activo. Revisa la consola del servidor o instala ffmpeg para AIFF.', 'err');
  };
  lib.audio.src = asset.url || `/media/asset/${encodeURIComponent(asset.id)}`;
  lib.playingId = id;
  renderAssets();
  try {
    await lib.audio.play();
  } catch {
    stopPreview();
    toast('El navegador bloqueó la reproducción. Pulsa Escuchar otra vez.', 'err');
  }
}

async function addAssetToStudio(id) {
  const asset = findLibraryAsset(id);
  if (!asset) return;
  const row = document.querySelector(`.asset-row[data-asset-id="${id}"]`);
  const button = row && row.querySelector('[data-add]');
  if (button) { button.disabled = true; button.textContent = 'Añadiendo…'; }
  try {
    await addLibraryAsset(asset);
  } catch (err) {
    toast(err.message || 'No se pudo añadir el activo.', 'err');
  } finally {
    if (button && document.body.contains(button)) { button.disabled = false; button.textContent = 'Añadir'; }
  }
}

async function runScan(rootId) {
  if (state.library.busy) return;
  setLibraryBusy(true);
  setLibraryStatus(rootId ? 'Escaneando la carpeta…' : 'Escaneando carpetas. Puede tardar unos segundos…');
  try {
    const data = await readJsonResponse(await fetch('/api/assets/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rootId ? { rootId } : {})
    }));
    await loadLibraryRoots({ autoDetect: false });
    await loadAssets({ reset: true });
    setLibraryStatus(`Escaneo completado: ${data.total} activos indexados.`);
    toast(`Biblioteca lista: ${data.total} activos.`, 'ok');
  } catch (err) {
    setLibraryStatus(err.message || 'El escaneo falló.');
    toast(err.message || 'El escaneo falló.', 'err');
  } finally {
    setLibraryBusy(false);
  }
}

async function detectLibrary() {
  if (state.library.busy) return;
  setLibraryBusy(true);
  setLibraryStatus('Buscando librerías de Ableton Live, EZdrummer 3 y Packs…');
  try {
    const data = await readJsonResponse(await fetch('/api/assets/detect', { method: 'POST' }));
    await loadLibraryRoots({ autoDetect: false });
    const added = (data.added || []).length;
    if (added) {
      toast(`${added} carpeta${added > 1 ? 's' : ''} de Ableton, EZdrummer y Packs añadida${added > 1 ? 's' : ''}.`, 'ok');
      setLibraryBusy(false);
      await runScan();
    } else {
      setLibraryStatus('No se encontraron carpetas nuevas. Puedes añadir una ruta manualmente.');
      toast('Carpetas de librerías ya registradas.', 'info');
    }
  } catch (err) {
    setLibraryStatus(err.message || 'No se pudieron detectar las librerías.');
    toast(err.message || 'No se pudieron detectar las librerías.', 'err');
  } finally {
    setLibraryBusy(false);
  }
}

async function addLibraryRoot() {
  if (state.library.busy) return;
  const input = $('rootPath');
  const rootPath = input.value.trim();
  if (!rootPath) {
    toast('Escribe la ruta de una carpeta.', 'err');
    input.focus();
    return;
  }
  setLibraryBusy(true);
  setLibraryStatus('Añadiendo carpeta…');
  try {
    const data = await readJsonResponse(await fetch('/api/assets/roots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: rootPath })
    }));
    input.value = '';
    await loadLibraryRoots({ autoDetect: false });
    setLibraryBusy(false);
    toast(`Carpeta añadida: ${data.root.name}`, 'ok');
    await runScan(data.root.id);
  } catch (err) {
    setLibraryStatus(err.message || 'No se pudo añadir la carpeta.');
    toast(err.message || 'No se pudo añadir la carpeta.', 'err');
  } finally {
    setLibraryBusy(false);
  }
}

async function removeLibraryRoot(id) {
  const lib = state.library;
  if (lib.busy) {
    toast('Espera a que termine el escaneo antes de quitar una carpeta.', 'info');
    return;
  }
  const root = lib.roots.find((item) => item.id === id);
  if (!root) return;
  if (!confirm(`¿Quitar «${root.name}» del índice? Los archivos no se borran.`)) return;
  try {
    await readJsonResponse(await fetch(`/api/assets/roots/${encodeURIComponent(id)}`, { method: 'DELETE' }));
    stopPreview();
    await loadLibraryRoots({ autoDetect: false });
    await loadAssets({ reset: true });
    setLibraryStatus('Carpeta quitada del índice.');
    toast('Carpeta quitada del índice.', 'ok');
  } catch (err) {
    toast(err.message || 'No se pudo quitar la carpeta.', 'err');
  }
}

function bindLibrary() {
  $('btnLibraryToStudio').addEventListener('click', () => setView('estudio'));
  $('btnDetectAbleton').addEventListener('click', detectLibrary);
  $('btnScanAll').addEventListener('click', () => runScan());
  $('btnAddRoot').addEventListener('click', addLibraryRoot);
  $('btnRefreshLibrary').addEventListener('click', () => refreshLibrary({ autoDetect: false }));
  $('btnLoadMore').addEventListener('click', () => {
    const lib = state.library;
    if (lib.loading) return;
    lib.offset = lib.items.length;
    loadAssets();
  });

  $('assetSearch').addEventListener('input', (event) => {
    const lib = state.library;
    clearTimeout(lib.searchTimer);
    lib.searchTimer = setTimeout(() => {
      lib.query = event.target.value.trim();
      loadAssets({ reset: true });
    }, 280);
  });
  $('assetKind').addEventListener('change', (event) => {
    state.library.kind = event.target.value;
    loadAssets({ reset: true });
  });
  $('assetRootFilter').addEventListener('change', (event) => {
    state.library.root = event.target.value;
    loadAssets({ reset: true });
  });

  $('assetRoots').addEventListener('click', (event) => {
    const scan = event.target.closest('[data-scan-root]');
    if (scan) { runScan(scan.dataset.scanRoot); return; }
    const remove = event.target.closest('[data-remove-root]');
    if (remove) removeLibraryRoot(remove.dataset.removeRoot);
  });

  const list = $('assetList');
  list.addEventListener('click', (event) => {
    const preview = event.target.closest('[data-preview]');
    if (preview) { togglePreview(preview.dataset.preview); return; }
    const add = event.target.closest('[data-add]');
    if (add) addAssetToStudio(add.dataset.add);
  });
  list.addEventListener('dblclick', (event) => {
    const row = event.target.closest('.asset-row');
    if (row && row.draggable === 'true') addAssetToStudio(row.dataset.assetId);
  });
  list.addEventListener('dragstart', (event) => {
    const row = event.target.closest('.asset-row');
    if (!row || row.draggable !== 'true') return;
    const asset = findLibraryAsset(row.dataset.assetId);
    if (!asset) return;
    const payload = JSON.stringify({ id: asset.id, name: asset.name, url: asset.url });
    event.dataTransfer.setData('application/x-md-asset', payload);
    event.dataTransfer.setData('text/plain', asset.name);
    event.dataTransfer.effectAllowed = 'copy';
  });

  const importFiles = $('assetImportFiles');
  const importFolder = $('assetImportFolder');
  if (importFiles) {
    importFiles.addEventListener('change', () => {
      const files = [...importFiles.files];
      importFiles.value = '';
      importAudioFiles(files);
    });
  }
  if (importFolder) {
    importFolder.addEventListener('change', () => {
      const files = [...importFolder.files];
      importFolder.value = '';
      importAudioFiles(files);
    });
  }
  window.addEventListener('studio:library-search', (event) => {
    const q = String((event.detail && event.detail.q) || '').trim();
    if (!q) return;
    state.library.query = q;
    const search = $('assetSearch');
    if (search) search.value = q;
    setView('biblioteca');
    loadAssets({ reset: true });
  });
}

/* ---------------- Certificate ---------------- */

function bindCertificate() {
  $('certTitle').addEventListener('input', () => { state.certTitleTouched = true; });
  $('projectTitle').addEventListener('input', () => {
    if (!state.certTitleTouched) $('certTitle').value = $('projectTitle').value;
  });
  $('btnCreateCertificate').addEventListener('click', createCertificate);
}

async function createCertificate() {
  const profile = loadProfile();
  const name = $('authorName').value.trim() || profile.name;
  if (!name) {
    toast('Completa y guarda tu perfil de autor antes de certificar.', 'err');
    setView('derechos');
    $('authorName').focus();
    return;
  }
  const button = $('btnCreateCertificate');
  const status = $('certStatus');
  button.disabled = true;
  status.textContent = 'Exportando WAV y calculando huella…';

  try {
    const exported = await exportWav({ download: false });
    status.textContent = 'Subiendo al registro local y firmando…';
    const author = {
      name,
      alias: $('authorAlias').value.trim(),
      document: $('authorDocument').value.trim(),
      country: $('authorCountry').value.trim(),
      email: $('authorEmail').value.trim()
    };
    const title = $('certTitle').value.trim() || getProjectTitle();
    const meta = {
      title,
      author,
      coauthors: parseCoauthors($('certCoauthors').value),
      license: $('certLicense').value,
      humanContributions: humanContributions(),
      projectSession: $('certSession').value.trim(),
      modelLicenses: $('certLicenses').value.trim(),
      notes: $('certNotes').value.trim(),
      declaration: $('certDeclaration').value.trim(),
      duration: exported.duration,
      sampleRate: exported.sampleRate,
      generator: exported.meta.generator
    };
    const res = await fetch('/api/works', {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'x-work-meta': b64url(JSON.stringify(meta))
      },
      body: exported.arrayBuffer
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo certificar la obra');
    renderCertificateResult(data.work, data.urls);
    localStorage.setItem('musicderechos.lastCertificate', JSON.stringify({
      folio: data.work.folio, id: data.work.id, hash: data.work.hash, title: data.work.title
    }));
    localStorage.setItem(PRODUCTION_KEY, JSON.stringify({
      session: meta.projectSession, licenses: meta.modelLicenses
    }));
    toast(`Obra certificada: ${data.work.folio}`, 'ok');
    loadRegistry();
    status.textContent = 'Certificado creado y guardado en data/works.';
  } catch (err) {
    status.textContent = '';
    toast(err.message || 'No se pudo certificar', 'err');
  } finally {
    button.disabled = false;
  }
}

function renderCertificateResult(work, urls) {
  const card = $('certResultCard');
  card.classList.add('cert-success');
  card.innerHTML = `
    <div class="eyebrow">Registro completado</div>
    <div class="cert-folio">${esc(work.folio)}</div>
    <div class="muted small">${esc(work.title)} · ${esc(work.author.name)} · ${new Date(work.createdAt).toLocaleString('es-ES')}</div>
    <div class="cert-hash">${esc(work.hash)}</div>
    <div class="muted small">Huella SHA-256 del WAV certificado. Guarda el archivo original junto a este certificado.</div>
    <div class="cert-links">
      <a class="primary" href="${esc(urls.certificate)}" target="_blank" rel="noopener">Ver certificado</a>
      <a href="${esc(urls.json)}" target="_blank" rel="noopener" download>JSON</a>
      <a href="${esc(urls.text)}" download>Certificado TXT</a>
      <a href="${esc(urls.audio)}" target="_blank" rel="noopener">Escuchar WAV</a>
      <a href="${esc(urls.verify)}" target="_blank" rel="noopener">Verificar</a>
      <button class="btn small-btn" data-copy-hash="1">Copiar hash</button>
    </div>
    <div class="muted small" id="certVerifyInline" style="margin-top:10px"></div>
  `;
  const copy = card.querySelector('[data-copy-hash]');
  if (copy) {
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(work.hash);
        toast('Hash copiado.', 'ok');
      } catch {
        toast('No se pudo copiar. Selecciona el hash manualmente.', 'err');
      }
    });
  }
  fetch(`/api/verify/${work.id}`).then((r) => r.json()).then((data) => {
    const inline = $('certVerifyInline');
    if (!inline || !data.ok) return;
    inline.innerHTML = data.verification.ok
      ? '<span class="verify-ok">● Verificado: el archivo coincide con el registro.</span>'
      : '<span class="verify-bad">● Atención: la verificación no coincide.</span>';
  }).catch(() => {});
}

/* ---------------- Registry ---------------- */

function bindRegistry() {
  $('btnRefreshRegistry').addEventListener('click', loadRegistry);
  $('btnVerifyUpload').addEventListener('click', () => $('verifyInput').click());
  $('verifyInput').addEventListener('change', async () => {
    const file = $('verifyInput').files[0];
    $('verifyInput').value = '';
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
      const res = await fetch('/api/works');
      const data = await res.json();
      const found = (data.works || []).find((work) => work.hash === hash);
      const banner = document.createElement('div');
      banner.className = 'card';
      if (found) {
        banner.innerHTML = `<div class="eyebrow">Archivo verificado</div><h3>${esc(found.title)}</h3>
          <div class="muted small">Folio ${esc(found.folio)} · ${esc(found.author.name)}</div>
          <div class="verify-ok" style="margin-top:8px">● Coincide con una obra registrada.</div>
          <div class="cert-links"><a href="/api/works/${found.id}/certificate" target="_blank" rel="noopener">Ver certificado</a></div>`;
        toast('El archivo coincide con una obra registrada.', 'ok');
      } else {
        banner.innerHTML = `<div class="eyebrow">Sin coincidencia</div><p class="muted small">Este archivo no coincide con ninguna obra del registro local.</p>
          <div class="cert-hash">${esc(hash)}</div>`;
        toast('El archivo no coincide con ninguna obra registrada.', 'err');
      }
      $('registryList').prepend(banner);
    } catch (err) {
      toast('No se pudo calcular la huella del archivo.', 'err');
    }
  });

  $('registryList').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-verify]');
    if (!btn) return;
    const id = btn.dataset.verify;
    const status = btn.closest('.registry-item')?.querySelector('[data-verify-status]');
    if (status) status.textContent = 'Verificando…';
    try {
      const res = await fetch(`/api/verify/${id}`);
      const data = await res.json();
      if (status && data.ok) {
        status.innerHTML = data.verification.ok
          ? '<span class="verify-ok">● Verificado</span>'
          : '<span class="verify-bad">● No coincide</span>';
      }
    } catch {
      if (status) status.textContent = 'Error al verificar';
    }
  });
}

async function loadRegistry() {
  const list = $('registryList');
  list.innerHTML = '<div class="empty-state"><p>Cargando registro…</p></div>';
  try {
    const res = await fetch('/api/works');
    const data = await res.json();
    const works = data.works || [];
    if (!works.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">▤</div><h3>Aún no hay obras certificadas</h3><p>Genera o importa música, edítala y pulsa “Certificar obra”.</p></div>';
      return;
    }
    list.innerHTML = works.map((work) => `
      <article class="registry-item">
        <div>
          <h3>${esc(work.title)}</h3>
          <div class="registry-meta">
            ${esc(work.author?.name || 'Autor no indicado')} · ${esc(work.license || '')}<br>
            Folio <code>${esc(work.folio)}</code> · ${new Date(work.createdAt).toLocaleString('es-ES')}<br>
            ${work.duration ? `${Number(work.duration).toFixed(1)} s · ` : ''}SHA-256 <code>${esc(String(work.hash).slice(0, 24))}…</code>
            <div data-verify-status></div>
          </div>
        </div>
        <div class="registry-actions">
          <a href="/api/works/${work.id}/certificate" target="_blank" rel="noopener">Certificado</a>
          <a href="/api/works/${work.id}/json" target="_blank" rel="noopener">JSON</a>
          <a href="/media/works/${work.id}/master.wav" target="_blank" rel="noopener">Audio</a>
          <button data-verify="${work.id}">Verificar</button>
        </div>
      </article>
    `).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><p>No se pudo cargar el registro: ${esc(err.message)}</p></div>`;
  }
}

/* ---------------- Project files ---------------- */

function bindProject() {
  $('btnSaveProject').addEventListener('click', () => {
    try {
      const project = saveProjectFile();
      toast(`Proyecto guardado con ${project.tracks.length} pistas.`, 'ok');
    } catch (err) {
      toast(err.message || 'No se pudo guardar el proyecto.', 'err');
    }
  });
  $('btnOpenProject').addEventListener('click', () => $('projectFileInput').click());
  $('projectFileInput').addEventListener('change', async () => {
    const input = $('projectFileInput');
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    const button = $('btnOpenProject');
    button.disabled = true;
    button.textContent = 'Abriendo…';
    try {
      const project = JSON.parse(await file.text());
      const result = await loadProject(project);
      setProjectTitle(project.title || 'Proyecto');
      $('certTitle').value = project.title || 'Proyecto';
      state.certTitleTouched = false;
      setView('estudio');
      toast(`Proyecto abierto: ${result.clips} clips.`, 'ok');
    } catch (err) {
      toast(err.message || 'No se pudo abrir el proyecto.', 'err');
    } finally {
      button.disabled = false;
      button.textContent = 'Abrir';
    }
  });
}

/* ---------------- Help + init ---------------- */

function bindHelp() {
  const modal = $('helpModal');
  $('btnHelp').addEventListener('click', () => modal.classList.remove('hidden'));
  $('btnCloseHelp').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.classList.add('hidden');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') modal.classList.add('hidden');
  });
}

function init() {
  initEditor();
  fillProfile();
  fillProduction();
  bindProfile();
  bindGeneration();
  bindProject();
  bindCertificate();
  bindRegistry();
  bindHelp();
  $('btnCertify').addEventListener('click', () => {
    setView('derechos');
    $('certTitle').value = getProjectTitle();
    state.certTitleTouched = false;
  });
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => setView(item.dataset.view));
  });
  window.addEventListener('studio:toast', (event) => {
    const { message, type } = event.detail || {};
    if (message) toast(message, type || 'info');
  });
  $('certTitle').value = getProjectTitle();
  loadRegistry();
  loadDrumCatalog();
}

document.addEventListener('DOMContentLoaded', init);
