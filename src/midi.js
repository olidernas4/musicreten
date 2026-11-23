import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import zlib from 'node:zlib';
import { mulberry32 } from './music.js';
import { writeWavFile, decodeWav } from './wav.js';
import {
  SR, setRandom, makeBuffer,
  addKick, addSnare, addHat, addClap, addCrash, addTom,
  addBass, addSub808, addPiano, addEPiano, addPad, addStrings, addLead, addGuitar
} from './synth.js';

function readU16(buf, pos) {
  return (buf[pos] << 8) | buf[pos + 1];
}

function readU32(buf, pos) {
  return ((buf[pos] << 24) | (buf[pos + 1] << 16) | (buf[pos + 2] << 8) | buf[pos + 3]) >>> 0;
}

function readVar(buf, pos) {
  let value = 0;
  let byte;
  do {
    byte = buf[pos++];
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);
  return [value, pos];
}

function decodeText(buf) {
  return Buffer.from(buf).toString('latin1').replace(/\0+$/, '').trim();
}

function tickConverter(division, tempoEvents) {
  const events = tempoEvents.length ? tempoEvents.slice() : [{ tick: 0, us: 500000 }];
  events.sort((a, b) => a.tick - b.tick);
  if (!events.length || events[0].tick !== 0) events.unshift({ tick: 0, us: 500000 });
  const segments = [];
  let seconds = 0;
  for (let i = 0; i < events.length; i++) {
    const current = events[i];
    if (i > 0) {
      const previous = events[i - 1];
      seconds += ((current.tick - previous.tick) / division) * (previous.us / 1e6);
    }
    if (!segments.length || segments[segments.length - 1].tick !== current.tick) {
      segments.push({ tick: current.tick, seconds, us: current.us });
    } else {
      segments[segments.length - 1].us = current.us;
    }
  }
  return (tick) => {
    let segment = segments[0];
    for (const candidate of segments) {
      if (candidate.tick <= tick) segment = candidate;
      else break;
    }
    return segment.seconds + ((tick - segment.tick) / division) * (segment.us / 1e6);
  };
}

export function parseMidiFile(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'MThd') throw new Error('El archivo no es un MIDI SMF válido');
  const headerLength = readU32(buffer, 4);
  const format = readU16(buffer, 8);
  const trackCount = readU16(buffer, 10);
  const division = readU16(buffer, 12);
  if (division & 0x8000) throw new Error('MIDI con división SMPTE no soportado');
  const ticksPerBeat = division || 480;

  const rawNotes = [];
  const tempoEvents = [];
  const programs = {};
  const trackNames = [];
  let timeSignature = [4, 4];
  let pos = 8 + headerLength;

  for (let trackIndex = 0; trackIndex < trackCount && pos + 8 <= buffer.length; trackIndex++) {
    if (buffer.toString('ascii', pos, pos + 4) !== 'MTrk') break;
    const trackLength = readU32(buffer, pos + 4);
    const end = Math.min(buffer.length, pos + 8 + trackLength);
    let cursor = pos + 8;
    let tick = 0;
    let running = 0;
    const active = new Map();
    const closeAll = (atTick) => {
      for (const [key, value] of active) {
        const [channel, pitch] = key.split(':').map(Number);
        rawNotes.push({ pitch, channel, startTick: value.tick, endTick: atTick, velocity: value.velocity });
      }
      active.clear();
    };

    while (cursor < end) {
      let delta;
      [delta, cursor] = readVar(buffer, cursor);
      tick += delta;
      let status = buffer[cursor];
      if (status < 0x80) {
        status = running;
      } else {
        cursor++;
        if (status < 0xf0) running = status;
      }
      if (status === 0xff) {
        const type = buffer[cursor++];
        let length;
        [length, cursor] = readVar(buffer, cursor);
        const data = buffer.subarray(cursor, cursor + length);
        cursor += length;
        if (type === 0x51 && length >= 3) {
          const us = (data[0] << 16) | (data[1] << 8) | data[2];
          tempoEvents.push({ tick, us });
        } else if (type === 0x58 && length >= 2) {
          timeSignature = [data[0], data[1]];
        } else if (type === 0x03) {
          const name = decodeText(data);
          if (name) trackNames.push(name);
        } else if (type === 0x2f) {
          closeAll(tick);
          break;
        }
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        let length;
        [length, cursor] = readVar(buffer, cursor);
        cursor += length;
        continue;
      }
      const type = status & 0xf0;
      const channel = status & 0x0f;
      if (type === 0xc0) {
        const program = buffer[cursor++];
        if (!(channel in programs)) programs[channel] = program;
        continue;
      }
      if (type === 0xd0) {
        cursor += 1;
        continue;
      }
      const data1 = buffer[cursor++];
      const data2 = buffer[cursor++];
      if (type === 0x90 && data2 > 0) {
        active.set(`${channel}:${data1}`, { tick, velocity: data2 });
      } else if (type === 0x80 || (type === 0x90 && data2 === 0)) {
        const key = `${channel}:${data1}`;
        const note = active.get(key);
        if (note) {
          rawNotes.push({ pitch: data1, channel, startTick: note.tick, endTick: tick, velocity: note.velocity });
          active.delete(key);
        }
      }
    }
    closeAll(tick);
    pos = end;
  }

  const toSeconds = tickConverter(ticksPerBeat, tempoEvents);
  const notes = rawNotes.map((note) => ({
    pitch: note.pitch,
    channel: note.channel,
    velocity: note.velocity,
    start: toSeconds(note.startTick),
    duration: Math.max(0.02, toSeconds(note.endTick) - toSeconds(note.startTick))
  })).sort((a, b) => a.start - b.start);
  const duration = notes.reduce((max, note) => Math.max(max, note.start + note.duration), 0);
  const tempo = tempoEvents.length ? Math.round(60000000 / tempoEvents[0].us) : 120;

  return {
    format,
    ticksPerBeat,
    tempo,
    timeSignature,
    duration: Number(duration.toFixed(3)),
    notes,
    programs,
    trackNames: [...new Set(trackNames)]
  };
}

function xmlUnescape(text) {
  return String(text ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

export function parseAlcFile(buffer) {
  let xml;
  try {
    xml = zlib.gunzipSync(buffer).toString('utf8');
  } catch {
    xml = buffer.toString('utf8');
  }
  if (!xml.includes('<MidiClip')) throw new Error('El clip de Ableton no contiene notas MIDI');
  const tempoMatch = xml.match(/<Tempo>\s*<LomId[^>]*\/>[\s\S]{0,200}?<Manual Value="([\d.]+)"/);
  const tempo = tempoMatch ? Number(tempoMatch[1]) : 120;
  const clipBlocks = [...xml.matchAll(/<MidiClip\b[^>]*>([\s\S]*?)<\/MidiClip>/g)].map((m) => m[1]);
  const block = clipBlocks.find((part) => part.includes('<MidiNoteEvent'));
  if (!block) throw new Error('El clip de Ableton no contiene notas MIDI');

  const nameMatch = block.match(/<Name Value="([^"]*)"/);
  const startMatch = block.match(/<CurrentStart Value="([\d.eE+-]+)"/);
  const endMatch = block.match(/<CurrentEnd Value="([\d.eE+-]+)"/);
  const loopStartMatch = block.match(/<LoopStart Value="([\d.eE+-]+)"/);
  const loopEndMatch = block.match(/<LoopEnd Value="([\d.eE+-]+)"/);
  const numeratorMatch = block.match(/<Numerator Value="(\d+)"/);
  const notes = [];
  for (const track of block.matchAll(/<KeyTrack\b[^>]*>([\s\S]*?)<\/KeyTrack>/g)) {
    const content = track[1];
    const keyMatch = content.match(/<MidiKey Value="(\d+)"/);
    if (!keyMatch) continue;
    const pitch = Number(keyMatch[1]);
    for (const event of content.matchAll(/<MidiNoteEvent Time="([\d.eE+-]+)" Duration="([\d.eE+-]+)" Velocity="(\d+)"/g)) {
      notes.push({
        pitch,
        velocity: Number(event[3]),
        startBeats: Number(event[1]),
        durationBeats: Number(event[2])
      });
    }
  }
  if (!notes.length) throw new Error('El clip de Ableton no contiene notas MIDI');
  const currentStart = startMatch ? Number(startMatch[1]) : 0;
  const currentEnd = endMatch ? Number(endMatch[1]) : 0;
  const loopStart = loopStartMatch ? Number(loopStartMatch[1]) : 0;
  const loopEnd = loopEndMatch ? Number(loopEndMatch[1]) : 0;
  const lengthBeats = Math.max(
    currentEnd - currentStart,
    loopEnd - loopStart,
    ...notes.map((note) => note.startBeats + note.durationBeats),
    1
  );

  return {
    clipName: xmlUnescape(nameMatch ? nameMatch[1] : ''),
    tempo,
    timeSignature: [numeratorMatch ? Number(numeratorMatch[1]) : 4, 4],
    lengthBeats,
    duration: Number(((lengthBeats * 60) / tempo).toFixed(3)),
    notes: notes.map((note) => ({
      pitch: note.pitch,
      velocity: note.velocity,
      start: (note.startBeats * 60) / tempo,
      duration: Math.max(0.02, (note.durationBeats * 60) / tempo)
    })).sort((a, b) => a.start - b.start)
  };
}

export const DRUM_MAP = new Map([
  [12, 'kick'], [13, 'kick'], [35, 'kick'], [36, 'kick'],
  [25, 'snare'], [26, 'snare'], [37, 'snare'], [38, 'snare'], [40, 'snare'],
  [39, 'clap'],
  [21, 'closedHat'], [22, 'closedHat'], [42, 'closedHat'], [44, 'closedHat'], [62, 'closedHat'],
  [46, 'openHat'], [61, 'openHat'],
  [49, 'crash'], [51, 'crash'], [52, 'crash'], [53, 'crash'], [55, 'crash'], [57, 'crash'], [59, 'crash'],
  [24, 'tom'], [41, 'tom'], [43, 'tom'], [45, 'tom'], [47, 'tom'], [48, 'tom'], [50, 'tom'],
  [2, 'shaker'], [3, 'shaker'], [14, 'shaker'], [15, 'shaker'], [16, 'shaker'],
  [54, 'shaker'], [56, 'shaker'], [60, 'shaker'], [63, 'shaker'], [64, 'shaker'], [75, 'shaker'], [80, 'shaker'], [82, 'shaker']
]);

export function isDrumMidi({ category = '', name = '', notes = [], source = '' } = {}) {
  const text = `${category} ${name} ${source}`.toLowerCase();
  if (/\.(mid|midi|alc)$/i.test(name) && /ezdrummer|toontrack|drum/.test(text) && !/bass|guitar|piano/.test(text)) return true;
  if (/drum|percussion|perc|kit|beat|break|groove|fill/.test(text)) return true;
  if (!notes.length) return false;
  const drumNotes = notes.filter((note) => note.channel === 9 || DRUM_MAP.has(note.pitch)).length;
  return drumNotes > notes.length * 0.6;
}

function instrumentFor(category, name, notes) {
  const text = `${category || ''} ${name || ''}`.toLowerCase();
  if (isDrumMidi({ category, name, notes })) return 'drums';
  if (/bass|sub/.test(text)) return 'bass';
  if (/rhodes|electric piano|epiano|wurli/.test(text)) return 'epiano';
  if (/pad|texture|ambient|atmos|choir/.test(text)) return 'pad';
  if (/string|violin|cello|orchestra/.test(text)) return 'strings';
  if (/guitar|riff|strum/.test(text)) return 'guitar';
  if (/lead|synth|arp|pluck|melod/.test(text)) return 'lead';
  if (/key|piano|organ/.test(text)) return 'piano';
  return 'piano';
}

function addDrumNote(buffer, note) {
  const gain = 0.35 + (note.velocity / 127) * 0.75;
  const hit = DRUM_MAP.get(note.pitch);
  if (hit === 'kick') addKick(buffer, SR, note.start, gain);
  else if (hit === 'snare') addSnare(buffer, SR, note.start, gain * 0.9);
  else if (hit === 'clap') addClap(buffer, SR, note.start, gain * 0.8);
  else if (hit === 'openHat') addHat(buffer, SR, note.start, true, gain * 0.6);
  else if (hit === 'closedHat') addHat(buffer, SR, note.start, false, gain * 0.55);
  else if (hit === 'shaker') addHat(buffer, SR, note.start, false, gain * 0.3);
  else if (hit === 'crash') addCrash(buffer, SR, note.start, gain * 0.55);
  else if (hit === 'tom') addTom(buffer, SR, note.start, note.pitch, gain * 0.7);
  else if (note.pitch < 40) addKick(buffer, SR, note.start, gain * 0.7);
  else addSnare(buffer, SR, note.start, gain * 0.5);
}

function groupChords(notes, gap = 0.045) {
  const sorted = notes.slice().sort((a, b) => a.start - b.start);
  const groups = [];
  for (const note of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(note.start - last.start) <= gap) {
      last.notes.push(note);
      last.start = Math.min(last.start, note.start);
      last.duration = Math.max(last.duration, note.duration);
      last.velocity = Math.max(last.velocity, note.velocity);
    } else {
      groups.push({ start: note.start, duration: note.duration, velocity: note.velocity, notes: [note] });
    }
  }
  return groups;
}

export function renderMidiEvents({ notes, category = '', name = '', tempo = 120 }) {
  if (!Array.isArray(notes) || !notes.length) throw new Error('El clip no tiene notas que renderizar');
  const instrument = instrumentFor(category, name, notes);
  const end = notes.reduce((max, note) => Math.max(max, note.start + note.duration), 0);
  const duration = Math.min(300, Math.max(1, end + 2));
  const buffer = makeBuffer(duration, SR);
  setRandom(mulberry32(Math.floor((tempo * 1000 + notes.length * 97 + end * 13) % 2147483647)));

  if (instrument === 'drums') {
    for (const note of notes) addDrumNote(buffer, note);
  } else {
    const groups = groupChords(notes);
    for (const group of groups) {
      const midis = [...new Set(group.notes.map((note) => note.pitch))].sort((a, b) => a - b);
      const gain = 0.18 + (group.velocity / 127) * 0.32;
      const dur = Math.max(0.08, group.duration);
      if (instrument === 'bass') {
        for (const midi of midis) addBass(buffer, SR, group.start, dur, midi, gain * 1.05, 1.35);
      } else if (instrument === 'sub') {
        for (const midi of midis) addSub808(buffer, SR, group.start, dur, midi, gain);
      } else if (instrument === 'epiano') {
        addEPiano(buffer, SR, group.start, dur, midis, gain);
      } else if (instrument === 'pad') {
        addPad(buffer, SR, group.start, dur, midis, gain * 0.9);
      } else if (instrument === 'strings') {
        addStrings(buffer, SR, group.start, dur, midis, gain * 0.85);
      } else if (instrument === 'guitar') {
        addGuitar(buffer, SR, group.start, dur, midis, gain * 0.8, 1.6);
      } else if (instrument === 'lead') {
        for (const midi of midis) addLead(buffer, SR, group.start, dur, midi, gain * 0.75);
      } else {
        addPiano(buffer, SR, group.start, dur, midis, gain);
      }
    }
  }

  let peak = 0;
  for (let i = 0; i < buffer.length; i++) peak = Math.max(peak, Math.abs(buffer[i]));
  const factor = peak > 0 ? 0.86 / peak : 1;
  const fadeIn = Math.floor(0.012 * SR);
  const fadeOut = Math.floor(0.9 * SR);
  for (let i = 0; i < buffer.length; i++) {
    let gain = factor;
    if (i < fadeIn) gain *= i / fadeIn;
    if (i > buffer.length - fadeOut) gain *= Math.max(0, (buffer.length - i) / fadeOut);
    buffer[i] *= gain;
  }
  return { buffer, instrument, duration, tempo };
}

export function readClipFile(filePath, ext) {
  const buffer = fs.readFileSync(filePath);
  if (ext === '.mid' || ext === '.midi') {
    const parsed = parseMidiFile(buffer);
    return {
      tempo: parsed.tempo,
      timeSignature: parsed.timeSignature,
      duration: parsed.duration,
      clipName: parsed.trackNames[0] || '',
      notes: parsed.notes,
      noteCount: parsed.notes.length
    };
  }
  if (ext === '.alc') {
    const parsed = parseAlcFile(buffer);
    return { ...parsed, noteCount: parsed.notes.length };
  }
  throw new Error('Formato MIDI no soportado');
}

function writeVarBytes(val) {
  const bytes = [val & 0x7f];
  val >>= 7;
  while (val > 0) {
    bytes.push((val & 0x7f) | 0x80);
    val >>= 7;
  }
  return Buffer.from(bytes.reverse());
}

export function notesToMidiBuffer(notes, tempo = 120, channel = 0, program = 0) {
  const division = 480;
  const usPerBeat = Math.round(60000000 / Math.max(20, Math.min(300, tempo)));
  const tempoBuf = Buffer.from([
    0x00, 0xff, 0x51, 0x03,
    (usPerBeat >> 16) & 0xff, (usPerBeat >> 8) & 0xff, usPerBeat & 0xff
  ]);
  const progBuf = Buffer.from([0x00, 0xc0 | (channel & 0x0f), program & 0x7f]);

  const events = [];
  for (const n of notes) {
    const startTick = Math.max(0, Math.round((n.start * tempo * division) / 60));
    const durTick = Math.max(12, Math.round((n.duration * tempo * division) / 60));
    const endTick = startTick + durTick;
    const vel = Math.max(1, Math.min(127, Math.round(n.velocity || 90)));
    const pitch = Math.max(0, Math.min(127, Math.round(n.pitch)));
    events.push({ tick: startTick, type: 'on', pitch, vel, channel });
    events.push({ tick: endTick, type: 'off', pitch, vel: 0, channel });
  }
  events.sort((a, b) => a.tick - b.tick || (a.type === 'off' ? -1 : 1));

  const trkBytes = [tempoBuf, progBuf];
  let lastTick = 0;
  for (const ev of events) {
    const delta = Math.max(0, ev.tick - lastTick);
    lastTick = ev.tick;
    const deltaBuf = writeVarBytes(delta);
    const status = (ev.type === 'on' ? 0x90 : 0x80) | (ev.channel & 0x0f);
    trkBytes.push(deltaBuf, Buffer.from([status, ev.pitch, ev.vel]));
  }
  trkBytes.push(Buffer.from([0x00, 0xff, 0x2f, 0x00]));

  const trkData = Buffer.concat(trkBytes);
  const trkHead = Buffer.alloc(8);
  trkHead.write('MTrk', 0, 'ascii');
  trkHead.writeUInt32BE(trkData.length, 4);

  const mthd = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x01, 0xe0]);
  return Buffer.concat([mthd, trkHead, trkData]);
}

export function getFluidSynthPath() {
  const local = path.resolve('tools/fluidsynth/bin/fluidsynth.exe');
  const candidates = [
    local,
    process.env.FLUIDSYNTH_PATH,
    'C:\\Users\\Usuario\\musica-ia\\tools\\fluidsynth\\fluidsynth-v2.6.1-win10-x64-cpp11\\bin\\fluidsynth.exe',
    'C:/Users/Usuario/musica-ia/tools/fluidsynth/fluidsynth-v2.6.1-win10-x64-cpp11/bin/fluidsynth.exe',
    'fluidsynth'
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return 'fluidsynth';
}

export function getSoundFontPath() {
  const local = path.resolve('soundfonts/FluidR3 GM2-2.SF2');
  const candidates = [
    local,
    process.env.SOUNDFONT_PATH,
    'C:\\Users\\Usuario\\musica-ia\\soundfonts\\FluidR3 GM2-2.SF2',
    'C:/Users/Usuario/musica-ia/soundfonts/FluidR3 GM2-2.SF2'
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return null;
}

export async function renderClipToWavFile({ filePath = null, notes = [], tempo = 120, category = '', name = '', outputPath }) {
  const sfPath = getSoundFontPath();
  const fsBin = getFluidSynthPath();
  const instrument = instrumentFor(category, name, notes);
  const drum = instrument === 'drums';

  if (sfPath && fs.existsSync(sfPath)) {
    let sourceMid = filePath;
    let tempMid = null;

    if (!sourceMid || !fs.existsSync(sourceMid) || (drum && notes.length)) {
      if (!Array.isArray(notes) || !notes.length) throw new Error('El clip no contiene notas');
      let ch = 0;
      let prog = 0;
      const text = `${category || ''} ${name || ''}`.toLowerCase();
      if (drum) {
        ch = 9;
        prog = 0;
      } else if (instrument === 'bass') {
        ch = 0;
        prog = /slap/i.test(text) ? 36 : /pick/i.test(text) ? 34 : /synth|sub/i.test(text) ? 38 : 33;
      } else if (instrument === 'guitar') {
        ch = 0;
        prog = /dist|metal|heavy/i.test(text) ? 30 : /clean/i.test(text) ? 27 : /acoust/i.test(text) ? 25 : 29;
      } else if (instrument === 'epiano') {
        ch = 0;
        prog = 4;
      } else if (instrument === 'pad') {
        ch = 0;
        prog = 89;
      } else if (instrument === 'strings') {
        ch = 0;
        prog = 48;
      } else if (instrument === 'lead') {
        ch = 0;
        prog = 29;
      } else {
        ch = 0;
        prog = 0;
      }

      const smfBuf = notesToMidiBuffer(notes, tempo, ch, prog);
      tempMid = path.join(path.dirname(outputPath), `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mid`);
      fs.writeFileSync(tempMid, smfBuf);
      sourceMid = tempMid;
    }

    try {
      await new Promise((resolve, reject) => {
        const child = spawn(fsBin, ['-ni', '-F', outputPath, sfPath, sourceMid], { windowsHide: true });
        let stderr = '';
        child.stderr.on('data', (d) => { stderr += d.toString(); });
        child.on('error', reject);
        child.on('close', (code) => {
          if (code === 0 && fs.existsSync(outputPath)) resolve();
          else reject(new Error(`FluidSynth error (code ${code}): ${stderr}`));
        });
      });
      const decoded = decodeWav(fs.readFileSync(outputPath));
      let peak = 0;
      for (const channel of decoded.channels) {
        for (let i = 0; i < channel.length; i++) peak = Math.max(peak, Math.abs(channel[i]));
      }
      if (peak > 0 && peak < 0.95) {
        const factor = 0.9 / peak;
        for (const channel of decoded.channels) {
          for (let i = 0; i < channel.length; i++) channel[i] = Math.min(1, channel[i] * factor);
        }
        writeWavFile(outputPath, decoded.channels, decoded.sampleRate);
      }
      return { method: 'fluidsynth', instrument, midiChannel: drum ? 10 : 1 };
    } catch (err) {
      // If FluidSynth failed on a specific mid, fall back to internal
    } finally {
      if (tempMid) {
        try { fs.unlinkSync(tempMid); } catch {}
      }
    }
  }

  // Fallback to internal buffer rendering if FluidSynth is not available or failed
  const rendered = renderMidiEvents({ notes, category, name, tempo });
  writeWavFile(outputPath, [rendered.buffer], 44100);
  return { method: 'internal', instrument: rendered.instrument };
}

