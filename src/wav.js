import fs from 'node:fs';

export function encodeWav(channels, sampleRate) {
  const numChannels = channels.length;
  const numFrames = channels[0].length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      if (sample > 1) sample = 1;
      else if (sample < -1) sample = -1;
      buffer.writeInt16LE(Math.round(sample * 32767), offset);
      offset += 2;
    }
  }
  return buffer;
}

export function writeWavFile(filePath, channels, sampleRate) {
  fs.writeFileSync(filePath, encodeWav(channels, sampleRate));
}

export function decodeWav(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('No es un archivo WAV válido');
  }
  let offset = 12;
  let channels = 1;
  let sampleRate = 44100;
  let bitsPerSample = 16;
  let dataOffset = 44;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') {
      channels = buffer.readUInt16LE(offset + 8 + 2);
      sampleRate = buffer.readUInt32LE(offset + 8 + 4);
      bitsPerSample = buffer.readUInt16LE(offset + 8 + 14);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  const bytesPerSample = Math.max(1, Math.floor(bitsPerSample / 8));
  const blockAlign = channels * bytesPerSample;
  const numFrames = Math.floor(Math.min(dataSize, buffer.length - dataOffset) / blockAlign);
  const resultChannels = [];
  for (let c = 0; c < channels; c++) {
    resultChannels.push(new Float32Array(numFrames));
  }

  let pos = dataOffset;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < channels; c++) {
      let val = 0;
      if (bitsPerSample === 16) {
        val = buffer.readInt16LE(pos) / 32768;
        pos += 2;
      } else if (bitsPerSample === 24) {
        val = ((buffer[pos] | (buffer[pos + 1] << 8) | (buffer[pos + 2] << 16)) << 8) >> 8;
        val /= 8388608;
        pos += 3;
      } else if (bitsPerSample === 32) {
        val = buffer.readFloatLE(pos);
        pos += 4;
      } else if (bitsPerSample === 8) {
        val = (buffer.readUInt8(pos) - 128) / 128;
        pos += 1;
      } else {
        pos += bytesPerSample;
      }
      resultChannels[c][i] = val;
    }
  }
  return { channels: resultChannels, sampleRate, numFrames };
}

