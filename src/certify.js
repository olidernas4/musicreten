import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const APP_NAME = 'MusicDerechos Studio';
export const APP_VERSION = '1.0.0';

export function ensureDirs(...dirs) {
  for (const dir of dirs) fs.mkdirSync(dir, { recursive: true });
}

export function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export function readWavInfo(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(44);
    fs.readSync(fd, header, 0, 44, 0);
    fs.closeSync(fd);
    if (header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WAVE') return null;
    const channels = header.readUInt16LE(22);
    const sampleRate = header.readUInt32LE(24);
    const bits = header.readUInt16LE(34);
    const dataSize = header.readUInt32LE(40);
    const byteRate = header.readUInt32LE(28);
    const seconds = byteRate ? dataSize / byteRate : 0;
    return {
      channels,
      sampleRate,
      bits,
      bytes: fs.statSync(filePath).size,
      duration: Number(seconds.toFixed(2))
    };
  } catch {
    return null;
  }
}

export function readRegistry(registryFile) {
  try {
    const raw = fs.readFileSync(registryFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { version: 1, works: parsed };
    return parsed;
  } catch {
    return { version: 1, works: [] };
  }
}

export function writeRegistry(registryFile, registry) {
  registry.updatedAt = new Date().toISOString();
  fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2));
}

export function entryHashFor(entry) {
  const payload = {
    folio: entry.folio,
    id: entry.id,
    title: entry.title,
    author: entry.author,
    coauthors: entry.coauthors,
    license: entry.license,
    hash: entry.hash,
    createdAt: entry.createdAt,
    humanContributions: entry.humanContributions,
    projectSession: entry.projectSession,
    modelLicenses: entry.modelLicenses,
    generator: entry.generator
  };
  return crypto.createHash('sha256').update((entry.prevEntryHash || 'GENESIS') + JSON.stringify(payload)).digest('hex');
}

export async function createWork({ filePath, hash, meta, paths }) {
  const actualHash = await sha256File(filePath);
  if (actualHash !== hash) {
    throw new Error('La huella del archivo no coincide con la declarada. Intenta exportar de nuevo.');
  }
  const info = readWavInfo(filePath) || {};
  const id = crypto.randomUUID();
  const folio = `MD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${actualHash.slice(0, 8).toUpperCase()}`;
  const registry = readRegistry(paths.registryFile);
  const prevEntryHash = registry.works.length ? registry.works[registry.works.length - 1].entryHash : 'GENESIS';

  const author = {
    name: String(meta.author?.name || 'Autor no indicado').slice(0, 200),
    document: String(meta.author?.document || '').slice(0, 80),
    email: String(meta.author?.email || '').slice(0, 200),
    country: String(meta.author?.country || '').slice(0, 120),
    alias: String(meta.author?.alias || '').slice(0, 120)
  };

  const entry = {
    folio,
    id,
    title: String(meta.title || 'Obra sin titulo').slice(0, 200),
    author,
    coauthors: Array.isArray(meta.coauthors) ? meta.coauthors.slice(0, 20).map((c) => ({
      name: String(c.name || '').slice(0, 200),
      role: String(c.role || '').slice(0, 120)
    })) : [],
    license: String(meta.license || 'Todos los derechos reservados').slice(0, 160),
    hash: actualHash,
    hashAlgorithm: 'SHA-256',
    sizeBytes: info.bytes || fs.statSync(filePath).size,
    duration: info.duration || meta.duration || null,
    sampleRate: info.sampleRate || meta.sampleRate || null,
    channels: info.channels || 2,
    bits: info.bits || 16,
    createdAt: new Date().toISOString(),
    generator: {
      app: APP_NAME,
      version: APP_VERSION,
      engine: String(meta.generator?.engine || 'musicderechos-local-v1'),
      params: meta.generator?.params || null,
      externalAi: false
    },
    humanContributions: Array.isArray(meta.humanContributions) ? meta.humanContributions.slice(0, 40) : [],
    projectSession: String(meta.projectSession || '').slice(0, 500),
    modelLicenses: String(meta.modelLicenses || '').slice(0, 2000),
    notes: String(meta.notes || '').slice(0, 5000),
    declaration: String(meta.declaration || '').slice(0, 3000),
    prevEntryHash: prevEntryHash || 'GENESIS',
    entryHash: '',
    file: `works/${id}/master.wav`
  };
  entry.entryHash = entryHashFor(entry);

  const workDir = path.join(paths.worksDir, id);
  fs.mkdirSync(workDir, { recursive: true });
  const destFile = path.join(workDir, 'master.wav');
  if (path.resolve(destFile) !== path.resolve(filePath)) {
    fs.copyFileSync(filePath, destFile);
  }

  fs.writeFileSync(path.join(workDir, 'certificate.json'), JSON.stringify(entry, null, 2));
  fs.writeFileSync(path.join(workDir, 'certificate.html'), buildCertificateHTML(entry));
  fs.writeFileSync(path.join(workDir, 'certificate.txt'), buildCertificateText(entry));
  fs.writeFileSync(path.join(workDir, 'master.wav.sha256'), `${entry.hash}  master.wav\n`);

  registry.works.push(entry);
  writeRegistry(paths.registryFile, registry);
  return entry;
}

export async function verifyWork(entry, filePath) {
  const checks = [];
  let actualHash = null;
  if (fs.existsSync(filePath)) {
    actualHash = await sha256File(filePath);
    checks.push({
      name: 'Huella del archivo',
      ok: actualHash === entry.hash,
      detail: actualHash === entry.hash ? 'El archivo coincide exactamente con el registrado.' : `Hash actual: ${actualHash}`
    });
  } else {
    checks.push({ name: 'Huella del archivo', ok: false, detail: 'No se encontro el archivo registrado en el disco.' });
  }
  const recomputedEntry = entryHashFor(entry);
  checks.push({
    name: 'Firma del registro',
    ok: recomputedEntry === entry.entryHash,
    detail: recomputedEntry === entry.entryHash ? 'El registro no fue alterado.' : 'El registro no coincide con su firma.'
  });
  return {
    ok: checks.every((c) => c.ok),
    checks,
    actualHash,
    expectedHash: entry.hash,
    verifiedAt: new Date().toISOString()
  };
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'medium' });
  } catch {
    return iso;
  }
}

function fmtDuration(seconds) {
  if (!seconds && seconds !== 0) return 'No indicada';
  const s = Number(seconds);
  const m = Math.floor(s / 60);
  const rest = (s % 60).toFixed(0).padStart(2, '0');
  return `${m}:${rest}`;
}

const LICENSE_TEXT = {
  'Todos los derechos reservados': 'El autor conserva todos los derechos de explotacion. Cualquier uso requiere autorizacion expresa.',
  'CC BY 4.0': 'Creative Commons Atribucion 4.0: se permite usar y adaptar citando al autor.',
  'CC BY-NC 4.0': 'Creative Commons Atribucion-NoComercial 4.0: uso no comercial citando al autor.',
  'CC0 1.0': 'Dominio publico: renuncia de derechos en la medida permitida por la ley.'
};

export function buildCertificateHTML(entry) {
  const contributions = entry.humanContributions.length
    ? entry.humanContributions.map((c) => `<li>${esc(c)}</li>`).join('')
    : '<li>No se declararon aportaciones humanas detalladas.</li>';
  const coauthors = entry.coauthors.length
    ? entry.coauthors.map((c) => `<li>${esc(c.name)}${c.role ? ` — ${esc(c.role)}` : ''}</li>`).join('')
    : '<li>Sin coautores declarados.</li>';
  const license = LICENSE_TEXT[entry.license] || entry.license;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Certificado de autoria ${esc(entry.folio)}</title>
<style>
  :root { --ink:#14131a; --muted:#5b5968; --line:#d9d5e6; --gold:#8a6d2f; --paper:#fffdf8; }
  * { box-sizing: border-box; }
  body { margin:0; background:#ece9f2; font-family: Georgia, 'Times New Roman', serif; color:var(--ink); }
  .sheet { width: 210mm; min-height: 297mm; margin: 18px auto; background: var(--paper); padding: 22mm 18mm; box-shadow: 0 20px 50px rgba(20,19,26,.18); }
  .brand { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid var(--ink); padding-bottom:10px; }
  .brand h1 { margin:0; font-size: 20px; letter-spacing:2px; text-transform:uppercase; }
  .brand p { margin:4px 0 0; font-family: Arial, sans-serif; font-size:11px; color:var(--muted); letter-spacing:.5px; }
  .folio { text-align:right; font-family: Arial, sans-serif; font-size:11px; color:var(--muted); }
  .folio strong { display:block; font-size:15px; color:var(--ink); letter-spacing:1px; }
  h2 { text-align:center; font-size: 30px; letter-spacing:6px; text-transform:uppercase; margin:26px 0 6px; font-weight:normal; }
  .sub { text-align:center; font-family: Arial, sans-serif; font-size:12px; color:var(--muted); margin-bottom:26px; }
  .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 10px 26px; font-family: Arial, sans-serif; font-size:12px; }
  .field { border-bottom:1px solid var(--line); padding:6px 0 7px; }
  .field span { display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:1px; color:var(--muted); margin-bottom:3px; }
  .field strong { font-size:13px; font-weight:600; overflow-wrap:anywhere; }
  .full { grid-column: 1 / -1; }
  h3 { font-size:12px; text-transform:uppercase; letter-spacing:2px; margin:24px 0 8px; border-bottom:1px solid var(--line); padding-bottom:6px; }
  ul { margin:0; padding-left:20px; font-family: Arial, sans-serif; font-size:12px; line-height:1.65; }
  .hash { font-family: Consolas, monospace; font-size:10.5px; background:#f4f1ea; border:1px solid var(--line); padding:10px 12px; word-break:break-all; user-select:all; }
  .declaration { font-size:12.5px; line-height:1.7; text-align:justify; }
  .small { font-family: Arial, sans-serif; font-size:10px; color:var(--muted); line-height:1.55; }
  .sign { margin-top:26px; display:grid; grid-template-columns:1fr 1fr; gap:40px; font-family: Arial, sans-serif; font-size:11px; }
  .sign div { border-top:1px solid var(--ink); padding-top:6px; color:var(--muted); }
  .seal { margin-top:22px; border:1px dashed var(--gold); color:var(--gold); padding:12px 14px; font-family: Arial, sans-serif; font-size:10.5px; line-height:1.5; }
  .notprint { text-align:center; margin: 14px auto 26px; font-family: Arial, sans-serif; }
  .notprint button { background:var(--ink); color:#fff; border:0; padding:11px 22px; border-radius:999px; font-size:13px; cursor:pointer; }
  @media print {
    body { background:#fff; }
    .sheet { box-shadow:none; margin:0; width:auto; min-height:auto; padding:12mm 10mm; }
    .notprint { display:none; }
  }
</style>
</head>
<body>
<div class="notprint"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>
<main class="sheet">
  <div class="brand">
    <div>
      <h1>MusicDerechos</h1>
      <p>Registro privado de autoria y prueba de integridad</p>
    </div>
    <div class="folio">
      Folio
      <strong>${esc(entry.folio)}</strong>
      ${esc(new Date(entry.createdAt).toISOString().slice(0, 10))}
    </div>
  </div>

  <h2>Certificado de autoria</h2>
  <p class="sub">Emitido por ${esc(entry.generator.app)} v${esc(entry.generator.version)} · Generacion local, sin servicios externos</p>

  <div class="grid">
    <div class="field"><span>Titulo de la obra</span><strong>${esc(entry.title)}</strong></div>
    <div class="field"><span>Autor / autora</span><strong>${esc(entry.author.name)}</strong></div>
    <div class="field"><span>Documento / identificacion</span><strong>${esc(entry.author.document || 'No indicado')}</strong></div>
    <div class="field"><span>Pais</span><strong>${esc(entry.author.country || 'No indicado')}</strong></div>
    <div class="field"><span>Correo de contacto</span><strong>${esc(entry.author.email || 'No indicado')}</strong></div>
    <div class="field"><span>Fecha y hora de registro (UTC)</span><strong>${esc(fmtDate(entry.createdAt))}</strong></div>
    <div class="field"><span>Duracion</span><strong>${esc(fmtDuration(entry.duration))}</strong></div>
    <div class="field"><span>Formato</span><strong>WAV · ${esc(entry.sampleRate || '—')} Hz · ${esc(entry.bits)} bits · ${esc(entry.channels)} canales</strong></div>
    <div class="field full"><span>Licencia declarada</span><strong>${esc(entry.license)}</strong><div class="small">${esc(license)}</div></div>
  </div>

  <h3>Huella digital de la obra (SHA-256)</h3>
  <div class="hash">${esc(entry.hash)}</div>
  <p class="small">Cualquier modificacion, aunque sea de un solo bit, cambia esta huella. La huella identifica exactamente la grabacion registrada.</p>

  <h3>Aportaciones humanas declaradas</h3>
  <ul>${contributions}</ul>

  <h3>Coautoria</h3>
  <ul>${coauthors}</ul>

  <h3>Evidencia de produccion</h3>
  <div class="grid">
    <div class="field full"><span>Sesion o proyecto DAW</span><strong>${esc(entry.projectSession || 'No indicada')}</strong></div>
    <div class="field full"><span>Licencias de modelos / plugins</span><strong>${esc(entry.modelLicenses || 'No indicadas')}</strong></div>
  </div>
  <p class="small">Se recomienda conservar la sesion original del DAW, los stems y las licencias de los modelos o samples utilizados junto a este certificado. Declara unicamente como propias las aportaciones creativas que realmente realizaste.</p>

  <h3>Procedencia de la generacion</h3>
  <div class="grid">
    <div class="field"><span>Motor</span><strong>${esc(entry.generator.engine)}</strong></div>
    <div class="field"><span>IA externa</span><strong>${entry.generator.externalAi ? 'Si' : 'No'}</strong></div>
    <div class="field full"><span>Parametros creativos</span><strong>${esc(JSON.stringify(entry.generator.params || {}))}</strong></div>
  </div>

  <h3>Declaracion del autor / autora</h3>
  <p class="declaration">${esc(entry.declaration || 'Declaro que la informacion consignada es veraz y que las aportaciones creativas humanas descritas en este certificado fueron realizadas por mi persona o por las personas acreditadas como coautoras.')}</p>
  <p class="small">Este certificado acredita la fecha de registro y la integridad del archivo mediante criptografia. No es un titulo de propiedad intelectual otorgado por una autoridad publica. La proteccion legal de una obra depende de la legislacion de cada pais y del grado de aportacion creativa humana. Se recomienda complementar este registro con el deposito ante el registro oficial correspondiente.</p>

  <div class="seal">
    Integridad en cadena: este registro hereda la huella del registro anterior (<span style="word-break:break-all">${esc(entry.prevEntryHash)}</span>) y produce la firma <span style="word-break:break-all">${esc(entry.entryHash)}</span>. Alterar cualquier entrada invalida las siguientes.
  </div>

  <div class="sign">
    <div>Firma del autor / autora</div>
    <div>${esc(entry.author.name)} · ${esc(entry.author.document || 'Documento no indicado')}</div>
  </div>

  <h3>Como reforzar tu registro</h3>
  <p class="small">1) Conserva el archivo WAV original sin editar. 2) Guarda este certificado y el JSON junto al archivo. 3) Inscribe la obra en el registro de propiedad intelectual de tu pais o en un servicio de deposito con sello de tiempo. 4) Si usaste IA, documenta tus decisiones creativas (melodia, letra, arreglos, edicion) como se hace en este certificado.</p>
</main>
</body>
</html>`;
}

export function buildCertificateText(entry) {
  const lines = [
    'CERTIFICADO DE AUTORIA — MUSICDERECHOS STUDIO',
    `Folio: ${entry.folio}`,
    `Fecha de registro: ${entry.createdAt}`,
    `Titulo: ${entry.title}`,
    `Autor: ${entry.author.name}`,
    `Documento: ${entry.author.document || 'No indicado'}`,
    `Pais: ${entry.author.country || 'No indicado'}`,
    `Correo: ${entry.author.email || 'No indicado'}`,
    `Licencia: ${entry.license}`,
    `Duracion: ${entry.duration || 'No indicada'} s`,
    `Formato: WAV ${entry.sampleRate || ''} Hz ${entry.bits || ''} bits ${entry.channels || ''} canales`,
    '',
    'HUELLA SHA-256',
    entry.hash,
    '',
    'APORTACIONES HUMANAS',
    ...(entry.humanContributions.length ? entry.humanContributions.map((c) => `- ${c}`) : ['- No detalladas']),
    '',
    'COAUTORES',
    ...(entry.coauthors.length ? entry.coauthors.map((c) => `- ${c.name}${c.role ? ` (${c.role})` : ''}`) : ['- Sin coautores']),
    '',
    'EVIDENCIA DE PRODUCCION',
    `Sesion DAW: ${entry.projectSession || 'No indicada'}`,
    `Licencias de modelos/plugins: ${entry.modelLicenses || 'No indicadas'}`,
    '',
    'GENERACION',
    `Motor: ${entry.generator.engine}`,
    `Parametros: ${JSON.stringify(entry.generator.params || {})}`,
    `IA externa: ${entry.generator.externalAi ? 'Si' : 'No'}`,
    '',
    'DECLARACION',
    entry.declaration || 'Declaro que las aportaciones humanas descritas fueron realizadas por mi persona o por las personas acreditadas.',
    '',
    'INTEGRIDAD EN CADENA',
    `Registro anterior: ${entry.prevEntryHash}`,
    `Firma del registro: ${entry.entryHash}`,
    '',
    'Este certificado acredita fecha e integridad, no sustituye el registro oficial de propiedad intelectual.'
  ];
  return lines.join('\n');
}
