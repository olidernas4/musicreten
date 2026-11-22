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
