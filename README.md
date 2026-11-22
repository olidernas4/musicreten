# MusicDerechos Studio

Estudio local de música con IA, editor multipista y certificado privado de autoría.
No usa servicios externos ni claves de API: todo se genera y se guarda en tu ordenador.

## Requisitos

- Node.js 18 o superior (probado con Node 24 en Windows).
- Navegador moderno (Chrome, Edge o Firefox).
- Opcional: `ffmpeg` en el `PATH` para previsualizar AIFF/AIF. Sin él, el resto de formatos
  funciona igual.
- Opcional: Python 3.12 y Demucs para separar mezclas de audio localmente en stems.

## Arrancar

```powershell
npm start
```

Abre <http://127.0.0.1:4321>. Para desarrollo con recarga automática del servidor:

```powershell
npm run dev
```

Puedes cambiar el puerto con la variable `PORT` (por ejemplo, `$env:PORT=5000; npm start`).

## Flujo de trabajo

1. **Generar**: elige género, ánimo, tonalidad, BPM y duración, o escribe una descripción
   libre de estilos/géneros como en Suno ("bachata urbana, ambient dub techno, casio core").
   El botón *Usar estilo* permite activar o ignorar el texto, que se conserva completo; el motor
   local solo aplica los rasgos que reconoce. La generación es instrumental por ahora y no crea voces.
   Con *Usar sonidos de mi biblioteca* activado, el compositor local elige un kit de batería
   y multisamples coherentes y crea pistas separadas de batería, percusión, bajo, armonía y melodía.
   Sin esa opción se usa el motor procedural (stems + mezcla) y su ficha técnica. También puedes
   subir una canción y separarla localmente en batería, bajo, voz y otros instrumentos.
   Si escribes metalcore/post-hardcore y dejas activada la biblioteca, se usa un loop de guitarra
   eléctrica en Si menor y samples acústicos de batería disponibles en la colección. El loop se
   repite y varía por secciones; no genera una interpretación nueva nota por nota. Sin biblioteca
   se usa la guitarra sintetizada del motor procedural, que no equivale a una grabación real ni a
   un modelo especializado.
   La interfaz muestra el avance de subida y separación; al cargar los resultados al estudio
   indica cuántas pistas se han descargado y decodificado.
2. **Biblioteca**: detecta la Core Library de Ableton, añade tus propias carpetas de samples
   o packs y pulsa *Escanear*. Busca por nombre, BPM o tonalidad, previsualiza los sonidos y
   añádelos al estudio con el botón *Añadir* o arrastrándolos a la línea de tiempo.
   *Importar archivos* y *Importar carpeta* copian audio a `data/assets/imported` y lo indexan.
3. **Estudio**: carga la generación, abre un proyecto guardado o importa tus propios
   WAV/MP3/FLAC/OGG/M4A. Puedes mover clips, recortar, dividir, duplicar, cambiar el tono de
   un sample con su velocidad, ajustar volumen, paneo y fades, y escuchar en bucle.
   El panel *Sonidos usados* agrupa los samples de la biblioteca y permite localizarlos,
   buscarlos o quitarlos del proyecto. *Guardar* descarga un proyecto `.mdproj.json` y *Abrir*
   lo reconstruye en el editor. La exportación ofrece WAV, MP3, FLAC u OGG.
4. **Agentes**: pide ayuda al productor (ideas de género, tempo y tonalidad), al compositor
   (progresiones alternativas), al ingeniero de mezcla (analiza tus pistas cargadas) o al
   asesor de derechos (según país y uso de IA). Los parámetros propuestos se pueden aplicar
   directamente al generador.
5. **Derechos**: guarda tu perfil de autor, marca las aportaciones humanas, añade la sesión
   DAW y las licencias de modelos o plugins, y pulsa *Certificar obra*. Se calcula el SHA-256
   del WAV exportado y se crea un certificado privado imprimible con folio, fecha, ficha
   técnica y cadena de integridad.
6. **Registro**: consulta las obras certificadas, abre su certificado, verifica la huella
   del WAV registrado o suelta cualquier archivo para compararlo con el registro local.

Atajos del editor: `Espacio` reproduce/pausa, `Supr` elimina la selección, `Esc` cierra menús.

## Biblioteca de sonidos

La biblioteca indexa los archivos **en su ubicación original**: no copia samples ni packs.
El índice vive en `data/assets/index.json` y solo se cachean en `data/assets/cache` las
conversiones necesarias y los clips MIDI renderizados.

| Formato | Uso |
| --- | --- |
| WAV, MP3, FLAC, OGG, M4A | Reproducción directa y edición en el estudio. |
| AIFF / AIF | Se convierten a WAV con `ffmpeg` para previsualizar y editar. |
| `.alc` (clips Ableton) | Se leen sus notas MIDI y se renderizan con el motor interno. |
| `.mid` / `.midi` | Se renderizan con el motor interno y se pueden editar como audio. |
| `.agr` (grooves) | Se indexan como referencia; Ableton los reproduce, la app no. |
| `.als` (sesiones) | Se indexan como referencia; no se abren ni se modifican. |

La detección busca la User Library, Factory Packs y la Core Library de Live 12. También
puedes pegar cualquier ruta local. Los archivos no se envían a Internet. La app rechaza
indexar la raíz de una unidad completa y limita el escaneo a 80.000 archivos por pasada.

### Composición con la biblioteca

La generación con biblioteca no elige loops al azar ni usa un modelo de IA entrenado.
Agrupa los multisamples por carpeta,
lee la nota raíz del nombre del archivo y ajusta el tono con `playbackRate` para tocar la
melodía, la armonía y el bajo. La batería usa one-shots filtrados por familia (kick, snare,
hi-hat, clap, shaker, tom) y elige un kit coherente según el género. Se descartan nombres
con alien, glitch, noise o FX para evitar sonidos raros. La respuesta incluye `usedAssets`
y `warnings` para que el panel de sonidos usados y la ficha sean verificables.
El compositor mantiene un motivo melódico y lo varía entre estrofas, puente y coro final;
también cambia patrones y densidad entre secciones. Sigue siendo un generador procedural
de maquetas: los multisamples heredados de un teclado pueden sonar artificiales al cambiar
su velocidad, y el resultado no sustituye un arreglo ni una producción de DAW.

Los proyectos con samples de la biblioteca se guardan como referencias (`assetId`) y los
generados por el motor procedural como URLs locales; solo los audios sueltos se incrustan
como WAV en base64 dentro del `.mdproj.json`. Así el proyecto de una canción con biblioteca
suele pesar unos cientos de KB. Si mueves o borras un sample original, ese clip no se podrá
recargar y la app lo indicará al abrir el proyecto.

## Agentes incluidos

| Agente | Para qué sirve |
| --- | --- |
| Productor | Traduce una idea a género, tempo, tonalidad, referencias y prompt de generación. |
| Composición | Propone progresiones con grados romanos y explica el color armónico. |
| Mezcla | Revisa niveles, paneo y fades de las pistas del editor con hallazgos accionables. |
| Derechos | Orienta sobre registro, aportación humana, IA y plazos según el país elegido. |

## Certificado de autoría: qué es y qué no es

El certificado demuestra que un archivo WAV concreto existía en una fecha determinada y que
no ha cambiado desde entonces (huella SHA-256 más registro local encadenado). Es una prueba
privada de fecha e integridad, **no** un título oficial de propiedad intelectual ni un
registro público. Para protección legal completa, acude al registro oficial de tu país.

Si una obra se genera al 100 % con IA puede no ser protegible por derechos de autor en muchas
jurisdicciones. La app deja constancia de la aportación humana (selección, edición, arreglos,
letra, interpretación) y avisa de esta limitación. El certificado incluye una declaración
explícita en ese sentido y campos para la sesión DAW y las licencias de modelos o plugins,
de modo que puedas documentar la procedencia de cada sonido. Esta herramienta no ofrece
asesoramiento jurídico.

Guarda siempre el WAV original junto al certificado y conserva la sesión del DAW y los stems.
Si el archivo cambia, la verificación fallará. Haz copia de seguridad de `data/` porque el
registro vive en tu disco.

## Estructura

```
server.js            Servidor HTTP y API (sin dependencias)
src/generator.js     Motor de composición y mezcla por stems
src/music.js         Escalas, acordes, progresiones y detección de prompts
src/synth.js         Síntesis procedural de instrumentos
src/library.js       Índice de la biblioteca local, escaneo, caché y detección de Ableton
src/libraryComposer.js Composición con multisamples y kits reales de la biblioteca
src/midi.js          Lectura de MIDI/.alc y render de clips con el motor interno
src/certify.js       Hash, registro encadenado y certificados HTML/TXT
src/agents.js        Lógica de los cuatro agentes
public/              Interfaz: HTML, CSS, editor multipista y orquestación
data/generated/      Canciones generadas (stems + mezcla + meta.json)
data/works/          Obras certificadas (master.wav + certificado + hash)
data/registry/       index.json con la cadena de integridad
data/assets/         index.json de la biblioteca y caché de conversiones/renderizados
data/assets/imported/ Sonidos añadidos desde la interfaz
test/smoke.js        Pruebas de humo (npm test)
```

## API local

- `GET /api/health` — estado y número de obras registradas.
- `POST /api/generate` — `{prompt, genre, mood, key, mode, bpm, duration, seed}`.
- `POST /api/compose/library` — misma entrada; compone con samples de la biblioteca.
- `POST /api/separate` — archivo de audio binario + cabecera `x-file-name`; separa cuatro stems localmente.
- `GET /api/separate/:jobId` — consulta estado, etapa y porcentaje de una separación en curso.
- `POST /api/export?format=mp3|flac|ogg|m4a` — recibe un WAV y devuelve el formato pedido.
- `POST /api/assets/import` — audio binario + cabecera `x-file-name`; copia a `data/assets/imported`.
- `GET /api/catalog` — géneros, ánimos y países disponibles.
- `POST /api/agent` — `{agent, payload}`.
- `POST /api/works` — WAV binario + cabecera `x-work-meta` (JSON en base64url).
- `GET /api/works` — lista de obras certificadas.
- `GET /api/works/:id/certificate|json|text` — certificado y metadatos.
- `GET /api/verify/:id` — verificación de integridad.
- `GET /verificar/:id` — página de verificación para compartir.
- `GET/POST /api/assets/roots` — listar o añadir carpetas de la biblioteca.
- `DELETE /api/assets/roots/:id` — quitar una carpeta del índice (no borra archivos).
- `POST /api/assets/detect` — detectar User Library, Factory Packs y Core Library.
- `POST /api/assets/scan` — `{rootId?}`; escanear una carpeta o todas.
- `GET /api/assets?q=&kind=&root=&limit=&offset=` — buscar y paginar activos.
- `GET /api/assets/:id/info` — metadatos y detalles del clip.
- `GET /media/asset/:id` — audio del activo (convierte o renderiza si hace falta).
- `GET /media/...` — audio y certificados con lista blanca de extensiones.

## Pruebas

```powershell
npm test
```

Genera dos canciones cortas, comprueba las muestras y la cabecera WAV, certifica y verifica
una obra de prueba, indexa una biblioteca temporal con WAV, `.alc` y `.agr`, prueba el motivo
desarrollado del compositor de biblioteca y ejecuta los cuatro agentes. No deja datos en el
registro real ni toca tus carpetas de Ableton.

### Separación local de audio

Instala Python 3.12 y las dependencias opcionales fijadas a una pareja compatible de PyTorch
con backend de audio SoundFile:

```powershell
py -3.12 -m pip install -r requirements-audio.txt
```

La primera separación descarga los pesos HTDemucs en la caché local de PyTorch. El archivo de
audio se procesa en el equipo, sin subirlo a ningún servicio; la separación puede tardar varios
minutos en CPU. Los WAV resultantes son pistas editables de audio, no notas MIDI ni recuperación
garantizada de los samples originales. Puedes indexar WAV y MIDI exportados desde Ableton o tu
instrumento de batería; la app no ejecuta plugins VST ni lee formatos propietarios de instrumentos.

## Limitaciones actuales

- La síntesis es procedural y ligera: sirve para maquetas, no sustituye a un DAW profesional.
- MP3/FLAC/OGG requieren `ffmpeg`; sin él solo funciona la exportación WAV. No hay conexión
  con plugins VST.
- La composición con biblioteca depende de que los samples sigan en su ruta original. Los
  multisamples se afinan por velocidad, así que un sample con mucho vibrato o ruido puede
  sonar artificial al transportarlo.
- Los grooves `.agr` y las sesiones `.als` se indexan como referencia: no se reproducen ni se
  editan. Los clips `.alc` que contienen audio en vez de MIDI no se pueden renderizar.
- AIFF requiere `ffmpeg`; sin él se indexa pero no se previsualiza.
- El registro es local y privado: no se publica en blockchain ni en un organismo oficial.
- El asistente de derechos es orientativo y no constituye asesoramiento legal.
- Pensado para uso local en `127.0.0.1`; no expongas el servidor a Internet sin autenticación.
