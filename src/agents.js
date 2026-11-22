import {
  MOODS, getProgression, progressionLabels, progressionRomans, parseKey,
  NOTE_NAMES, normalizePc, suggestTempo, scaleMidis
} from './music.js';

const GENRE_INFO = {
  lofi: { label: 'Lo-fi / Chill', bpm: [70, 88], roster: ['Bateria boom-bap', 'Bajo sub', 'Rhodes', 'Melodia de piano'], tip: 'Deja el vinilo bajo y usa acordes de septima para el calor analogico.' },
  pop: { label: 'Pop', bpm: [96, 124], roster: ['Bateria pop', 'Bajo', 'Piano', 'Voz / lead'], tip: 'El coro debe abrir en los primeros 8 compases y repetir el gancho melodico.' },
  electronic: { label: 'Electronica / EDM', bpm: [118, 128], roster: ['Kick four-on-the-floor', 'Clap', 'Bajo en octavas', 'Pad', 'Arpegio'], tip: 'Construye por capas: cada 8 compases suma un elemento y quita otro en el breakdown.' },
  cinematic: { label: 'Cinematica', bpm: [60, 84], roster: ['Cuerdas', 'Timbal / impacto', 'Drone de bajo', 'Melodia de cuerdas'], tip: 'La emocion viene del contraste: silencio antes del golpe, no solo volumen.' },
  trap: { label: 'Trap / Urbano', bpm: [68, 80], roster: ['808', 'Hats en 16avos', 'Caja half-time', 'Pad oscuro', 'Campana'], tip: 'El 808 y el kick no deben chocar: deja que el 808 cargue el peso y el kick solo marque.' },
  rock: { label: 'Rock', bpm: [100, 140], roster: ['Bateria', 'Bajo', 'Guitarra power chord', 'Voz / lead'], tip: 'Menos instrumentos al inicio: la entrada de la guitarra en el coro es el gancho.' },
  acustico: { label: 'Acustico / Balada', bpm: [72, 100], roster: ['Guitarra o piano', 'Bajo', 'Percusion suave', 'Voz'], tip: 'La letra y la melodia mandan; deja la produccion al servicio de la voz.' },
  jazz: { label: 'Jazz / Neo-soul', bpm: [84, 110], roster: ['Bateria con ride', 'Contrabajo caminante', 'Rhodes', 'Melodia'], tip: 'Usa extensiones (9, 11, 13) con moderacion y deja respirar los silencios.' }
};

const MOOD_DESC = {
  alegre: 'luminoso y directo, con resolucion hacia la tonica',
  epico: 'amplio y ascendente, con coro de gran altura',
  romantico: 'calido, con progresiones que abrazan la melodia',
  melancolico: 'agridulce, con el modo menor y descensos cromaticos',
  misterioso: 'tenso y nocturno, con acordes suspendidos',
  energetico: 'impulsivo, con ritmo marcado y coro inmediato',
  relajado: 'suave y circular, con septimas y poca densidad'
};

function modeFor(mood, requested) {
  if (requested === 'major' || requested === 'minor') return requested;
  return mood === 'melancolico' || mood === 'misterioso' ? 'minor' : 'major';
}

function keyFor(input, mode) {
  if (input && input !== 'auto') return input;
  return mode === 'minor' ? 'A minor' : 'C major';
}

function productor(payload) {
  const genre = GENRE_INFO[payload.genre] ? payload.genre : 'pop';
  const info = GENRE_INFO[genre];
  const mood = MOODS.includes(payload.mood) ? payload.mood : 'alegre';
  const mode = modeFor(mood, payload.mode);
  const key = keyFor(payload.key, mode);
  const parsed = parseKey(key);
  const bpm = Number(payload.bpm) || suggestTempo(genre);
  const verse = getProgression(mood, mode, 0);
  const chorus = getProgression(mood, mode, 1);
  const verseLabels = progressionLabels(parsed.tonicPc, mode, verse);
  const verseRomans = progressionRomans(mode, verse);
  const chorusLabels = progressionLabels(parsed.tonicPc, mode, chorus);
  const chorusRomans = progressionRomans(mode, chorus);
  return {
    agent: 'productor',
    title: 'Plan de produccion',
    summary: `Para ${info.label.toLowerCase()} ${MOOD_DESC[mood]}, te propongo ${bpm} BPM en ${NOTE_NAMES[normalizePc(parsed.tonicPc)]} ${mode === 'minor' ? 'menor' : 'mayor'}.`,
    sections: [
      {
        title: 'Tempo y tonalidad',
        items: [
          `Tempo: ${bpm} BPM (rango del estilo ${info.bpm[0]}-${info.bpm[1]}).`,
          `Tonalidad: ${NOTE_NAMES[normalizePc(parsed.tonicPc)]} ${mode === 'minor' ? 'menor' : 'mayor'}.`,
          mode === 'minor' ? 'El modo menor sostiene la melancolia; si quieres un respiro, sube al relativo mayor en el puente.' : 'El modo mayor da claridad; puedes oscurecer el puente con el acorde iv menor.'
        ]
      },
      {
        title: 'Progresiones',
        items: [
          `Verso: ${verseRomans.join(' – ')}  (${verseLabels.join(' – ')})`,
          `Coro: ${chorusRomans.join(' – ')}  (${chorusLabels.join(' – ')})`,
          'No repitas la misma progresion en verso y coro: el cambio de comienzo es lo que hace despegar el coro.'
        ]
      },
      {
        title: 'Forma sugerida',
        items: [
          'Intro 4 compases · Verso 8 · Coro 8 · Verso 2 8 · Coro final 8 · Outro 4.',
          'El coro final puede subir medio tono o sumar una octava de melodia.',
          'Deja un compas de silencio antes del ultimo coro: el contraste vende la entrada.'
        ]
      },
      {
        title: 'Instrumentacion',
        items: [
          `Base: ${info.roster.join(', ')}.`,
          info.tip,
          'Entra por capas: no pongas todos los instrumentos en el compas 1.'
        ]
      },
      {
        title: 'Gancho de arreglo',
        items: [
          'Elige un detalle no vocal que se repita: un arpegio, un golpe de percusion o un riff corto.',
          'Ese detalle debe aparecer en intro y coro; es lo que la gente recuerda cuando no recuerda la letra.'
        ]
      }
    ],
    apply: { genre, mood, key: `${NOTE_NAMES[normalizePc(parsed.tonicPc)]} ${mode}`, mode, bpm }
  };
}

function composicion(payload) {
  const mood = MOODS.includes(payload.mood) ? payload.mood : 'melancolico';
  const mode = modeFor(mood, payload.mode);
  const parsed = parseKey(keyFor(payload.key, mode));
  const options = [0, 1, 2].map((variant, i) => {
    const steps = getProgression(mood, mode, variant);
    const labels = progressionLabels(parsed.tonicPc, mode, steps);
    const romans = progressionRomans(mode, steps);
    const notes = [
      'Progresion base: funciona tal cual, sin adiciones.',
      'Version con septimas: agrega color sin cambiar la funcion.',
      'Version de contraste: usala en puente o ultimo coro.'
    ];
    return { name: `Opcion ${i + 1}`, romans, chords: labels, note: notes[i] };
  });
  const scale = scaleMidis(parsed.tonicPc, mode, 60, 84);
  return {
    agent: 'composicion',
    title: 'Ideas de composicion',
    summary: `Tres progresiones en ${NOTE_NAMES[normalizePc(parsed.tonicPc)]} ${mode === 'minor' ? 'menor' : 'mayor'} para un caracter ${mood}.`,
    options,
    sections: [
      {
        title: 'Motivo melodico',
        items: [
          'Construye un motivo de 2 compases y repitelo variando solo la ultima nota.',
          'Movimiento recomendado: grados conjuntos, con un salto maximo de cuarta.',
          'Termina las frases en nota del acorde, no en cualquier nota de la escala.'
        ]
      },
      {
        title: 'Registro',
        items: [
          `Notas disponibles entre ${scale[0]} y ${scale[scale.length - 1]} MIDI (${scale.length} notas de la escala).`,
          'Verso en registro medio; coro un 3 a 5 semitonos mas arriba.',
          'Si la melodia no se puede cantar sin aire, tiene demasiadas notas.'
        ]
      },
      {
        title: 'Ritmo',
        items: [
          'Alterna frases densas con frases de una sola nota larga.',
          'Deja el final de cada 4 compases con espacio para respirar.',
          'La melodia puede ir 10-15 ms atrasada respecto a la bateria para sonar humana.'
        ]
      }
    ],
    apply: { mood, mode, key: `${NOTE_NAMES[normalizePc(parsed.tonicPc)]} ${mode}` }
  };
}

function mezcla(payload) {
  const tracks = Array.isArray(payload.tracks) ? payload.tracks : [];
  const withClips = tracks.filter((t) => Number(t.clips) > 0);
  const findings = [];
  const names = withClips.map((t) => String(t.name).toLowerCase());
  const hasBass = names.some((n) => /bajo|bass|808/.test(n));
  const hasDrums = names.some((n) => /bater|drum|percus/.test(n));
  const melodias = withClips.filter((t) => /melod|lead|voz|vocal/.test(String(t.name).toLowerCase()));
  const totalClips = withClips.reduce((sum, t) => sum + Number(t.clips), 0);
  if (!hasBass) findings.push({ level: 'warn', text: 'No hay una pista de bajo o 808: el mix va a sonar delgado en telefonos y laptops.' });
  else findings.push({ level: 'ok', text: 'Hay bajo/808: revisa que el kick y el bajo no ocupen la misma frecuencia al mismo tiempo.' });
  if (!hasDrums) findings.push({ level: 'warn', text: 'No hay bateria o percusion: el pulso queda a cargo de la armonia.' });
  if (melodias.length > 1) findings.push({ level: 'warn', text: `Hay ${melodias.length} pistas de melodia/voz: decide cual es la protagonista y baja las demas 3-6 dB.` });
  if (withClips.length >= 6) findings.push({ level: 'tip', text: `${withClips.length} pistas activas: usa paneo y frecuencia para separar, no solo volumen.` });
  if (totalClips > 30) findings.push({ level: 'tip', text: `${totalClips} clips: revisa que no haya capas duplicadas que solo suman volumen y no informacion.` });
  const hot = withClips.filter((t) => Number(t.gain) > 1.05);
  if (hot.length) findings.push({ level: 'warn', text: 'Hay pistas con ganancia por encima de 0 dB: es mejor bajar el resto que saturar una sola.' });
  const noFade = withClips.filter((t) => Number(t.fades) === 0);
  if (noFade.length) findings.push({ level: 'tip', text: 'Algunos clips no tienen fades: unos milisegundos de entrada y salida evitan chasquidos.' });
  findings.push({ level: 'tip', text: 'Panorama sugerido: bateria y bajo al centro, armonia 15% a la izquierda, melodia 15% a la derecha.' });
  findings.push({ level: 'tip', text: 'Un pad sostenido enmascara mucho mas que un instrumento percusivo: si algo no se entiende, empieza por bajar el pad.' });
  return {
    agent: 'mezcla',
    title: 'Diagnostico de mezcla',
    summary: withClips.length
      ? `Analice ${withClips.length} pistas activas y ${totalClips} clips en tu proyecto.`
      : 'Tu proyecto esta vacio: agrega o genera musica para recibir un diagnostico.',
    findings,
    sections: [
      {
        title: 'Prioridades',
        items: [
          '1. Baja el volumen maestro y mezcla desde abajo: el oido confunde mas volumen con mejor sonido.',
          '2. Define el protagonista de cada seccion y baja 3 dB todo lo que compita con el.',
          '3. Resuelve el enmascaramiento editando (octavas, silencios, registro) antes de tocar EQ.'
        ]
      },
      {
        title: 'Antes de exportar',
        items: [
          'Deja entre 3 y 6 dB de margen en el pico master.',
          'Revisa la mezcla en auriculares, parlantes y telefono.',
          'Compara con una cancion de referencia del mismo estilo, igualando volumen.'
        ]
      }
    ]
  };
}

const COUNTRIES = {
  espana: ['España (Registro de la Propiedad Intelectual / Safe Creative)', 'Registro General de la Propiedad Intelectual de tu comunidad autonoma', 'https://www.culturaydeporte.gob.es/cultura/propiedadintelectual/registro.html'],
  mexico: ['Mexico (INDAUTOR)', 'Instituto Nacional del Derecho de Autor', 'https://www.gob.mx/indautor'],
  argentina: ['Argentina (DNDA)', 'Direccion Nacional del Derecho de Autor', 'https://www.argentina.gob.ar/justicia/derechodeautor'],
  colombia: ['Colombia (DNDA)', 'Direccion Nacional de Derecho de Autor', 'https://www.derechodeautor.gov.co'],
  chile: ['Chile (Registro de Propiedad Intelectual)', 'Departamento de Propiedad Intelectual', 'https://www.propiedadintelectual.gob.cl'],
  peru: ['Peru (INDECOPI)', 'Registro de Derecho de Autor', 'https://www.indecopi.gob.pe'],
  estados_unidos: ['Estados Unidos (U.S. Copyright Office)', 'Registro federal de copyright', 'https://www.copyright.gov/registration/'],
  otro: ['Registro nacional de propiedad intelectual de tu pais', 'Busca la autoridad de propiedad intelectual o cultura de tu pais.', '']
};

function derechos(payload) {
  const countryKey = String(payload.country || 'otro').toLowerCase();
  const country = COUNTRIES[countryKey] || COUNTRIES.otro;
  const usesAI = payload.usesAI !== false;
  const human = Array.isArray(payload.humanContributions) ? payload.humanContributions : [];
  return {
    agent: 'derechos',
    title: 'Ruta de proteccion de tu obra',
    summary: usesAI
      ? 'La IA acelera la produccion, pero tu proteccion depende de la huella humana: decisiones de composicion, edicion, arreglos y letra.'
      : 'Tu obra instrumental fue creada contigo como autor: documenta el proceso y registra el archivo final.',
    sections: [
      {
        title: 'Lo que ya tienes con este certificado',
        items: [
          'Fecha y hora de registro con sello local.',
          'Huella SHA-256 que identifica exactamente tu archivo.',
          'Registro encadenado: cada obra hereda la firma de la anterior.',
          'Declaracion de tus aportaciones humanas.'
        ]
      },
      {
        title: 'Lo que el certificado NO hace',
        items: [
          'No es un titulo oficial de propiedad intelectual.',
          'No sustituye el deposito ante el registro publico de tu pais.',
          'No determina por si solo la originalidad ni la titularidad si hay disputa.'
        ]
      },
      {
        title: 'Paso a paso',
        items: [
          `1. Guarda el WAV original sin editar y este certificado con su JSON.`,
          `2. Inscribe la obra en: ${country[0]}.`,
          country[2] ? `3. Tramite oficial: ${country[1]} (${country[2]}).` : `3. Tramite oficial: ${country[1]}.`,
          '4. Si hay coautores, firma un acuerdo de porcentajes antes de publicar.',
          '5. Si publicas en plataformas, conserva capturas de fechas y metadatos.'
        ]
      },
      {
        title: usesAI ? 'Aportaciones humanas que debes documentar' : 'Documenta tu proceso',
        items: human.length
          ? human.map((h) => `- ${h}`)
          : [
            'Melodia y armonia elegidas o modificadas por ti.',
            'Recortes, fades, silencios y estructura final.',
            'Sonidos agregados y decisiones de mezcla.',
            'Letra escrita por ti (si existe).'
          ]
      },
      {
        title: 'Aviso importante',
        items: [
          'En varias jurisdicciones, una obra generada integramente por IA sin aportacion humana puede no ser protegible.',
          'La proteccion se refuerza cuando hay seleccion, arreglo, edicion y decision creativa humana documentada.',
          'Esto es informacion general, no asesoria legal. Para un caso concreto consulta un abogado de propiedad intelectual.'
        ]
      }
    ],
    country: country[0],
    checklist: [
      'Guarde el WAV original en dos lugares distintos.',
      'Descargue el certificado HTML y el JSON.',
      'Complete el formulario de registro oficial de mi pais.',
      'Documente mis aportaciones humanas.',
      'Firme acuerdo con coautores si corresponde.'
    ]
  };
}

export function runAgent(agent, payload = {}) {
  switch (agent) {
    case 'productor': return productor(payload);
    case 'composicion': return composicion(payload);
    case 'mezcla': return mezcla(payload);
    case 'derechos': return derechos(payload);
    default: throw Object.assign(new Error('Agente no reconocido'), { status: 404 });
  }
}

export const AGENTS = ['productor', 'composicion', 'mezcla', 'derechos'];
export function genreCatalog() {
  return Object.entries(GENRE_INFO).map(([id, g]) => ({ id, label: g.label, bpm: g.bpm }));
}
