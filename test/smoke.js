import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { generateSong } from '../src/generator.js';
import { writeWavFile } from '../src/wav.js';
import { sha256File, readWavInfo, createWork, verifyWork, ensureDirs } from '../src/certify.js';
import { runAgent, AGENTS } from '../src/agents.js';
import {
  initLibrary, addRoot, scanRoots, queryAssets, prepareAssetAudio, assetInfo, getRoots
} from '../src/library.js';
import { composeLibrarySong } from '../src/libraryComposer.js';

const root = path.resolve('.');
const tmp = path.join(root, 'data', 'tmp', 'smoke');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function checkBuffers(song) {
  const buffers = { masterL: song.master.L, masterR: song.master.R, ...song.stems };
  let peak = 0;
  for (const [name, value] of Object.entries(buffers)) {
    const channels = Array.isArray(value) ? value : [value];
    for (const channel of channels) {
      assert(channel instanceof Float32Array, `${name} no es Float32Array`);
      assert(channel.length > 0, `${name} está vacío`);
      for (let i = 0; i < channel.length; i += 97) {
        const sample = channel[i];
        assert(Number.isFinite(sample), `${name} contiene muestras no finitas`);
        peak = Math.max(peak, Math.abs(sample));
      }
    }
  }
  assert(peak > 0.05, 'La mezcla está en silencio');
  return peak;
}

async function main() {
  fs.rmSync(tmp, { recursive: true, force: true });
  ensureDirs(tmp);

  for (const genre of ['pop', 'lofi']) {
    const song = generateSong({ genre, duration: 20, seed: 4242, bpm: 100 });
    assert(song.bars >= 4, 'Forma demasiado corta');
    assert(song.spec.form.length >= 3, 'La forma no tiene secciones');
    assert(song.spec.progression.coro.length === 4, 'Progresión de coro inválida');
    assert(song.files === undefined || typeof song.files === 'object', 'files inválido');
    const peak = checkBuffers(song);
    console.log(`ok generación ${genre}: ${song.bars} compases, ${song.key}, pico ${peak.toFixed(3)}`);
  }

  const styledSong = generateSong({
    genre: 'pop', mood: 'alegre', bpm: 100, duration: 20, seed: 4242,
    prompt: 'bachata urbana, ambient dub techno, casio core, classique, 2020s'
  });
  assert(styledSong.prompt === 'bachata urbana, ambient dub techno, casio core, classique, 2020s',
    'No se conservó el texto libre de estilos');
  const plainSong = generateSong({
    genre: 'pop', mood: 'alegre', bpm: 100, duration: 20, seed: 4242,
    prompt: 'bachata urbana, ambient dub techno, casio core, classique, 2020s', useStyle: false
  });
  assert(plainSong.genre === 'pop' && plainSong.mood === 'alegre' && plainSong.bpm === 100 && plainSong.prompt === '',
    'La descripción desactivada alteró la generación');

  const metalcoreSong = generateSong({
    genre: 'auto', mood: 'auto', mode: 'auto', key: 'auto',
    duration: 20, seed: 4242, prompt: 'metalcore', useStyle: true
  });
  assert(metalcoreSong.genre === 'metalcore' && metalcoreSong.mode === 'minor' && metalcoreSong.bpm === 145,
    'El estilo metalcore no seleccionó el preset instrumental adecuado');
  checkBuffers(metalcoreSong);
  const ignoredMetalcore = generateSong({
    genre: 'auto', mood: 'auto', mode: 'auto', duration: 20, seed: 4242,
    prompt: 'metalcore', useStyle: false
  });
  assert(ignoredMetalcore.genre === 'pop' && ignoredMetalcore.prompt === '',
    'El texto metalcore desactivado alteró la generación');
  console.log(`ok estilo metalcore: ${metalcoreSong.bpm} BPM, modo ${metalcoreSong.mode}`);

  const song = generateSong({ genre: 'pop', duration: 20, seed: 99 });
  const wavPath = path.join(tmp, 'smoke.wav');
  writeWavFile(wavPath, [song.master.L, song.master.R], 44100);
  const info = readWavInfo(wavPath);
  assert(info && info.channels === 2 && info.sampleRate === 44100, 'Cabecera WAV inválida');
  assert(info.bits === 16, 'El WAV no es de 16 bits');
  console.log(`ok WAV: ${info.channels} canales, ${info.sampleRate} Hz, ${info.duration.toFixed(2)} s`);

  const hash = await sha256File(wavPath);
  const paths = { worksDir: path.join(tmp, 'works'), registryFile: path.join(tmp, 'registry.json') };
  ensureDirs(paths.worksDir);
  const entry = await createWork({
    filePath: wavPath,
    hash,
    meta: {
      title: 'Prueba de humo',
      author: { name: 'Autor de prueba', country: 'España' },
      license: 'Todos los derechos reservados',
      humanContributions: ['seleccion'],
      projectSession: 'smoke-test.als',
      modelLicenses: 'Motor interno MIT',
      generator: { engine: 'smoke-test', params: { genre: 'pop' } }
    },
    paths
  });
  assert(entry.hash === hash, 'El registro guardó otra huella');
  assert(entry.entryHash.length === 64, 'entryHash inválido');
  const verification = await verifyWork(entry, path.join(paths.worksDir, entry.id, 'master.wav'));
  assert(verification.ok, 'La verificación de la obra falló');
  assert(entry.projectSession === 'smoke-test.als', 'La sesión DAW no se guardó');
  assert(entry.modelLicenses === 'Motor interno MIT', 'Las licencias no se guardaron');
  const certHtml = fs.readFileSync(path.join(paths.worksDir, entry.id, 'certificate.html'), 'utf8');
  assert(certHtml.includes('smoke-test.als') && certHtml.includes('Motor interno MIT'), 'El certificado HTML no incluye la evidencia de producción');
  const certText = fs.readFileSync(path.join(paths.worksDir, entry.id, 'certificate.txt'), 'utf8');
  assert(certText.includes('EVIDENCIA DE PRODUCCION'), 'El certificado TXT no incluye la evidencia de producción');
  console.log(`ok certificado: ${entry.folio} verificado`);

  const libRoot = path.join(tmp, 'library-source');
  ensureDirs(path.join(libRoot, 'Drums'));
  writeWavFile(path.join(libRoot, 'Drums', 'Kick 120 bpm.wav'), [new Float32Array(4410).fill(0.2)], 44100);
  const alcXml = `<LiveSet><Tempo><LomId Value="0"/><Manual Value="100"/></Tempo><MidiClip><Name Value="Test Clip"/><CurrentStart Value="0"/><CurrentEnd Value="2"/><LoopStart Value="0"/><LoopEnd Value="2"/><KeyTrack><MidiKey Value="36"/><MidiNoteEvent Time="0" Duration="0.25" Velocity="120"/><MidiNoteEvent Time="0.5" Duration="0.25" Velocity="100"/><MidiNoteEvent Time="1" Duration="0.25" Velocity="110"/></KeyTrack></MidiClip></LiveSet>`;
  fs.writeFileSync(path.join(libRoot, 'Test Clip 100 bpm.alc'), zlib.gzipSync(Buffer.from(alcXml)));
  fs.writeFileSync(path.join(libRoot, 'Fake Groove.agr'), Buffer.from('AB1E5678', 'hex'));

  initLibrary({
    indexFile: path.join(tmp, 'library-index.json'),
    cacheDir: path.join(tmp, 'library-cache')
  });
  addRoot(libRoot);
  const scans = await scanRoots([]);
  assert(scans.length === 1 && scans[0].count === 3, 'El escaneo de biblioteca devolvió un recuento inesperado');
  const kick = queryAssets({ q: 'kick' }).items[0];
  assert(kick && kick.kind === 'audio' && kick.playable, 'No se encontró el WAV de la biblioteca');
  const wavPrepared = await prepareAssetAudio(kick.id);
  assert(wavPrepared.file.toLowerCase().endsWith('.wav'), 'El WAV no se sirve directamente');
  const clip = queryAssets({ kind: 'clip' }).items[0];
  assert(clip && clip.playable, 'No se encontró el clip .alc');
  const clipPrepared = await prepareAssetAudio(clip.id);
  assert(fs.existsSync(clipPrepared.file) && fs.statSync(clipPrepared.file).size > 44, 'El clip .alc no se renderizó');
  const clipDetails = assetInfo(clip.id);
  assert(clipDetails.clip && clipDetails.clip.tempo === 100, 'Tempo del clip .alc incorrecto');
  const groove = queryAssets({ kind: 'groove' }).items[0];
  assert(groove && !groove.playable, 'El groove debería indexarse como referencia');
  let rejected = false;
  try { await prepareAssetAudio(groove.id); } catch { rejected = true; }
  assert(rejected, 'El groove no debería reproducirse');
  assert(getRoots()[0].assetCount === 3, 'El recuento de la raíz es incorrecto');
  console.log('ok biblioteca: WAV directo, clip .alc renderizado y groove como referencia');

  const multisamples = [
    ['Bass', ['C2', 'E2', 'G2', 'B2']],
    ['Keys', ['C3', 'E3', 'G3', 'B3']],
    ['Lead', ['C5', 'E5', 'G5', 'B5']]
  ];
  for (const [instrument, notes] of multisamples) {
    const folder = path.join(libRoot, 'Multisamples', instrument);
    ensureDirs(folder);
    for (const note of notes) {
      writeWavFile(path.join(folder, `${note}.wav`), [new Float32Array(4410).fill(0.1)], 44100);
    }
  }
  const drumRoot = path.join(libRoot, 'Samples', 'One Shots', 'Drums');
  ensureDirs(path.join(drumRoot, 'Kick'));
  ensureDirs(path.join(drumRoot, 'Snare'));
  ensureDirs(path.join(drumRoot, 'Hihat'));
  ensureDirs(path.join(drumRoot, 'Cymbal'));
  writeWavFile(path.join(drumRoot, 'Kick', 'Kick Acoustic Room.wav'), [new Float32Array(4410).fill(0.1)], 44100);
  writeWavFile(path.join(drumRoot, 'Snare', 'Snare Acoustic.wav'), [new Float32Array(4410).fill(0.1)], 44100);
  writeWavFile(path.join(drumRoot, 'Hihat', 'Hihat Closed Acoustic Room.wav'), [new Float32Array(4410).fill(0.1)], 44100);
  writeWavFile(path.join(drumRoot, 'Cymbal', 'Crash Heavy Rock.wav'), [new Float32Array(44100).fill(0.1)], 44100);
  ensureDirs(path.join(libRoot, 'Samples', 'Loops', 'Tonal', 'Guitar'));
  writeWavFile(
    path.join(libRoot, 'Samples', 'Loops', 'Tonal', 'Guitar', 'Amp Bmin 150 bpm.wav'),
    [new Float32Array(44100 * 128 / 10).fill(0.1)],
    44100
  );
  await scanRoots([]);
  const composed = composeLibrarySong({ genre: 'pop', duration: 90, seed: 4242 });
  const repeated = composeLibrarySong({ genre: 'pop', duration: 90, seed: 4242 });
  const styledComposition = composeLibrarySong({
    genre: 'pop', mood: 'alegre', bpm: 100, duration: 90, seed: 4242,
    prompt: 'bachata urbana, ambient dub techno, casio core, classique, 2020s'
  });
  const plainComposition = composeLibrarySong({
    genre: 'pop', mood: 'alegre', bpm: 100, duration: 90, seed: 4242,
    prompt: 'bachata urbana, ambient dub techno, casio core, classique, 2020s', useStyle: false
  });
  const metalcoreComposition = composeLibrarySong({
    genre: 'auto', mood: 'auto', mode: 'auto', key: 'auto',
    prompt: 'metalcore', duration: 90, seed: 4242, useStyle: true
  });
  const guitarTrack = metalcoreComposition.tracks.find((track) => track.role === 'guitar');
  assert(metalcoreComposition.genre === 'metalcore' && metalcoreComposition.key === 'B minor' && metalcoreComposition.bpm === 150,
    'Metalcore no eligió el tono y tempo del loop de guitarra disponible');
  assert(guitarTrack && guitarTrack.clips.length > 0 && guitarTrack.clips.every((clip) => clip.assetName === 'Amp Bmin 150 bpm.wav'),
    'Metalcore no creó clips con el loop de guitarra eléctrica real');
  assert(metalcoreComposition.tracks.some((track) => track.name === 'Batería' && track.clips.some((clip) => /Acoustic/.test(clip.assetName))),
    'Metalcore no usó samples acústicos de batería');
  assert(metalcoreComposition.tracks.some((track) => track.name === 'Batería' && track.clips.some((clip) => clip.role === 'cymbal')),
    'Metalcore no añadió el crash al coro');
  assert(!metalcoreComposition.tracks.some((track) => track.name === 'Percusión'),
    'Metalcore no debe añadir shaker ni palmadas de pop');
  assert(!metalcoreComposition.tracks.some((track) => track.role === 'lead' || track.role === 'keys'),
    'Metalcore no debe añadir leads o armonía sintéticos genéricos');
  let incompatibleMetalcoreKeyRejected = false;
  try {
    composeLibrarySong({
      genre: 'metalcore', mood: 'auto', mode: 'auto', key: 'D minor',
      prompt: 'metalcore', duration: 30, seed: 4242, useStyle: true
    });
  } catch (error) {
    incompatibleMetalcoreKeyRejected = error.status === 422 && /D minor/.test(error.message);
  }
  assert(incompatibleMetalcoreKeyRejected, 'Se debe avisar si la biblioteca no tiene guitarra en la tonalidad elegida');
  assert(styledComposition.prompt === 'bachata urbana, ambient dub techno, casio core, classique, 2020s',
    'El compositor no conservó el texto libre de estilos');
  assert(plainComposition.genre === 'pop' && plainComposition.mood === 'alegre' && plainComposition.bpm === 100 && plainComposition.prompt === '',
    'La descripción desactivada alteró el compositor de biblioteca');
  assert(composed.spec.material.contour.length >= 8, 'El compositor no definió un motivo melódico');
  assert(composed.spec.form.some((section) => section.development === 'variación del motivo'), 'La segunda estrofa no varía el motivo');
  assert(composed.tracks.some((track) => track.name === 'Melodía' && track.clips.length > 0), 'El motivo no generó clips de melodía');
  assert(JSON.stringify(composed.spec.material.contour) === JSON.stringify(repeated.spec.material.contour), 'El motivo no es reproducible con la misma semilla');
  assert(JSON.stringify(composed.spec.form.map((section) => section.name)) === JSON.stringify(repeated.spec.form.map((section) => section.name)), 'La forma no es reproducible con la misma semilla');
  console.log(`ok compositor de biblioteca: motivo desarrollado en ${composed.spec.form.length} secciones`);

  const agentRuns = [
    ['productor', { genre: 'pop', mood: 'alegre', bpm: 120 }],
    ['composicion', { mood: 'melancolico', mode: 'minor' }],
    ['mezcla', { tracks: [
      { name: 'Batería', gain: 8, pan: 0 },
      { name: 'Bajo', gain: 5, pan: 0 },
      { name: 'Armonía', gain: -3, pan: -0.2 }
    ] }],
    ['derechos', { country: 'espana', usesAI: true, humanContributions: ['edicion'] }]
  ];
  for (const [agent, payload] of agentRuns) {
    const result = runAgent(agent, payload);
    assert(result && result.summary, `El agente ${agent} no devolvió resumen`);
    console.log(`ok agente ${agent}`);
  }
  assert(AGENTS.length === 4, 'Catálogo de agentes inesperado');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nSmoke test OK · ${crypto.createHash('sha256').update('musicderechos').digest('hex').slice(0, 12)}`);
}

main().catch((err) => {
  console.error('FALLO:', err.message);
  process.exitCode = 1;
});
