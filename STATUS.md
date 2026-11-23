# MusicDerechos Studio — Estado del Proyecto & Hoja de Ruta

**Fecha de actualización:** 22 de noviembre de 2026  
**Documento de referencia arquitectónica:** [Proyecto de música IA (ChatGPT Share)](https://chatgpt.com/share/6afa2221-f578-83e9-b9f9-b7ff07f939f0)  
**Entorno de ejecución:** 100% Local (Node.js, WebAudio, FluidSynth, Ableton Live 12, Toontrack EZdrummer 3).

---

## 1. Resumen Ejecutivo de lo Realizado

En esta fase se han completado los requerimientos críticos solicitados:

1. **Eliminación total del sonido "Nintendo" / 8-bit:** Se eliminó la herramienta `audio-as-code` que forzaba síntesis matemática procedural simple similar a timbres de consola retro.
2. **Motor de sonido real con FluidSynth y SoundFonts GM2:** Se integró el binario nativo de `FluidSynth v2.6.1` y el banco SoundFont `FluidR3 GM2-2.SF2` (148 MB) dentro del espacio de trabajo.
3. **Bajo real eléctrico en sustitución de sintetizadores:** Se renderizaron e indexaron multisamples reales de bajo eléctrico con púa (`Electric Bass Pick` notas C1 a G3). Se ajustaron las prioridades del compositor para que el bajo eléctrico sea siempre la opción preferente en todos los géneros, eliminando definitivamente cualquier sonido sintético que recordaba a un videojuego clásico.
4. **Composición de Metalcore con instrumentos reales:** Al escribir `metalcore` o `heavy breakdown` en el estilo, el sistema activa automáticamente afinación menor, tempo enérgico (145–150 BPM), loops de guitarra eléctrica con distorsión real y baterías acústicas pesadas con platos crash.
5. **Catálogo de Ableton Live 12 y EZdrummer 3:** Se indexaron **más de 7.690 recursos reales** de audio y MIDI procedentes de Ableton Suite 12, EZdrummer 3 (3.133 grooves de batería reales), Superior Drummer 3 y los packs de usuario descomprimidos (`Whack Studio Metal Drum Tracks` 1–4, `TMKD-VORTEX` y `Breakdown MIDI Pack`).
6. **Rediseño completo estilo Suno UI:** Se reconstruyó la interfaz de generación siguiendo al detalle las tres capturas aportadas (tarjetas oscuras acordeón: `Letra`, `Estilos`, `Más opciones`, selectores de píldora, deslizadores rosas de Rareza e Influencia, etiquetas dinámicas y botón inferior ancho `Crear`).
7. **Grooves reales de EZdrummer 3 en la batería:** Los 3.133 MIDI de EZdrummer y los 162 grooves de packs se parsean y se usan compás a compás para bombo, caja, platos, toms y fills; el render MIDI se reenvía al canal 10 de percusión GM para que suene a batería y no a piano.

---

## 2. Diagnóstico y Correcciones Aplicadas

### A. ¿Por qué el bajo sonaba como un juego de Nintendo?
* **Causa:** En versiones previas, la selección de bajo recurría a muestras sintéticas de Ableton (`Infected Bass.wav` y `Pulse Bass.wav`), que al ser remuestreadas con `playbackRate` en el navegador producían artefactos de onda cuadrada/sierra parecidos al chip de sonido de una NES de 8 bits.
* **Solución implementada:** Se añadieron 11 multisamples de bajo eléctrico real (`C1` a `G3`) generados con SoundFont de alta fidelidad. Se configuró `INSTRUMENT_PREFS.bass` para priorizar `electric bass` como primera opción en todos los estilos.

### B. ¿Por qué escribir "metalcore" no hacía esa música?
* **Causa:** La suite de Ableton incluye pistas de guitarra como racks de dispositivos `.adg`, no como loops de audio WAV directos. Al pedir metalcore sin loops de audio WAV en la tonalidad correspondiente, el sistema o bien fallaba o recurría a generadores no apropiados.
* **Solución implementada:** 
  1. Se incorporaron loops de guitarra eléctrica grabada con amplificador (`Amp Bmin 150 bpm`, `Amp Dmin 140 bpm`, etc.).
  2. Se configuró el detector de estilos para reconocer de inmediato `metalcore`, `heavy breakdown`, `djent`, `deathcore`, `post-hardcore` y `thrash`.
  3. Se diseñó el patrón rítmico de bajo y batería específico de metalcore (octavos continuos, bombo acústico contundente, caja acústica seca y platos pesados).

---

## 3. Estado de la Biblioteca Local de Instrumentos

| Origen | Tipo de Contenido | Ubicación en el Sistema | Archivos Indexados |
| :--- | :--- | :--- | :--- |
| **Ableton Live 12 Suite** | Core Library (Drums, Multisamples, Instrumentos) | `C:\ProgramData\Ableton\Live 12 Suite\Resources\Core Library` | 4.099 |
| **Toontrack EZdrummer 3** | Grooves MIDI auténticos categorizados (Metal, Rock, Blues, Funk, etc.) | `C:\Program Files (x86)\Common Files\Toontrack\EZDrummer\Midi` | 3.133 |
| **Packs de Usuario** | 110 pistas metal drum WAV, Vortex Free Pack, Breakdown MIDI | `C:\Users\Usuario\Documents\Packs` | 384 |
| **SoundFonts & Multisamples** | FluidR3 GM2-2 (Guitarras, bajos, pianos reales, multisamples WAV) | `./soundfonts/` y `./data/assets/imported/` | 27 |
| **Grabaciones de Usuario** | Sobras Cicatrices Remix, baterías y sesiones | `C:\Users\Usuario\Documents\...` | 15 |
| **Total en Catálogo** | Audio WAV/AIFF y MIDI utilizable | `data/assets/index.json` | **7.696 recursos** |

---

## 4. Nueva Interfaz Suno UI (`public/index.html` & `public/css/styles.css`)

Siguiendo las tres capturas proporcionadas por el usuario:

* **Barra superior:**
  * Selector segmented de píldora: `Sencillo` | `Avanzado`.
  * Desplegable de modelo: `v6-mini ▾` / `v6-pro` / `Ableton + EZdrummer 3`.
* **Chips de acción rápida:**
  * `+ Audio` (abre la biblioteca de sonidos para arrastrar clips).
  * `+ Voice` (guía para letras y doblajes vocales).
  * `+ Inspiración` (carga ideas de estilo automáticas).
* **Tarjeta 1 — Letra (`∨ Letra`):**
  * Cabecera acordeón plegable con herramientas: Deshacer (`↩`), Rehacer (`↪`), Formato (`✏`), Estructura (`|||\`) y Expandir (`⤢`).
  * Textarea con formato estándar de estrofas y coros (`[Verse]`, `[Chorus]`, `[Outro]`).
  * Botón circular flotante con destello `✨` para redactar o mejorar la letra con IA local.
* **Tarjeta 2 — Estilos (`∨ Estilos`):**
  * Textarea para escribir prompts libres de estilo.
  * Botón azul con varita mágica `🪄` para combinaciones sugeridas.
  * Botón de rotación `🔄` para refrescar etiquetas.
  * Píldoras de estilo activables con un clic: `metalcore`, `heavy breakdown`, `driving drums`, `electric guitar`, `bittersweet`, `girl vocal`, `lofi hip hop`, `dark ethereal`, `heavy 808 bass`, `acoustic rock`, `deathcore`.
* **Tarjeta 3 — Más opciones (`∨ Más opciones`):**
  * Cabecera acordeón con botón de restablecer (`🗑`).
   * `Género vocal ℹ`: Botones de opción `Masculino`, `Femenino`, `Instrumental`.
   * `Batería ℹ`: Selectores de kit (`Acoustic Room`, `909`, `808`, etc.) y de groove (`Auto`, `Recto`, `Swing`, `Half-time`, `Fills`, `Sin grooves`).
   * `Duración ℹ`: Botones `Personalizada` (muestra slider de segundos) y `Auto`.
  * `Modo Max ℹ`: `Desactivado` | `Activado`.
  * `Rareza ℹ`: Deslizador rosa con marcas de graduación `| | | |` y porcentaje en tiempo real (`50%`).
  * `Influencia del estilo ℹ`: Deslizador rosa con porcentaje (`50%`).
  * `Variedad ℹ`: Deslizador rosa con indicador (`Normal` / `Baja` / `Alta`).
  * `Personalizar ℹ` (`Mi gusto`): `Desactivado` | `Activado`.
  * `🎵 Título de la canción (opcional)`: Campo de texto con icono.
  * `📁 Guardar en...`: Botón `Seleccionar espacio de trabajo`.
* **Botón principal inferior:**
  * Píldora de ancho completo: `[ 🎵 Crear ]` conectada a la API `/api/compose/library`.
* **Panel derecho:**
  * Tarjeta de reproducción con vúmetro y stems (batería, bajo, guitarra, armonía, melodía).
  * Botón `Cargar en el estudio` (abre las pistas en el timeline multipista para edición directa).
  * Botón `Editar y certificar` (genera hash SHA-256 y certificado de autoría).

---

## 5. Comparativa con el Plan de Arquitectura (Link ChatGPT)

En el documento de arquitectura discutido en ChatGPT ([Proyecto de música IA](https://chatgpt.com/share/6afa2221-f578-83e9-b9f9-b7ff07f939f0)), se definieron cinco pilares:

| Pilar Arquitectónico | Propuesta en ChatGPT | Implementación en MusicDerechos | Estado |
| :--- | :--- | :--- | :--- |
| **1. Ingesta de Audio & MIDI** | Leer carpetas locales de DAWs sin alterar archivos originales. | `src/library.js` escanea Ableton Suite 12, EZdrummer 3 y Packs de usuario sin duplicar archivos. | **Completado (7.696 archivos)** |
| **2. Motor de Muestras Reales** | Usar SoundFonts / Sampler local para evitar sintetizadores retro. | `FluidSynth v2.6.1` integrado + SoundFont `FluidR3 GM2-2.SF2` + multisamples WAV. | **Completado** |
| **3. Composición por roles** | Separación por roles (Batería, Bajo, Armonía, Melodía, Mezcla). | `src/libraryComposer.js` + `src/drumGrooves.js` con grooves reales, metalcore, rock, lofi y pop. | **Completado** |
| **4. Interfaz de Creación Visual** | Flujo rápido similar a Suno con edición multipista tipo DAW. | Vista `Generar` rediseñada exactamente como Suno + Vista `Estudio` con canvas timeline editable. | **Completado** |
| **5. Registro & Propiedad Intelectual** | Constancia inmutable de autoría local y hash SHA-256. | `src/certify.js` emite certificados PDF/JSON con sello de tiempo, huella SHA-256 y aportes humanos. | **Completado** |

---

## 6. Próximos Pasos Recomendados (Siguiente Línea de Trabajo)

Una vez verificados los instrumentos reales y la interfaz Suno:

1. **Ampliación de Loops de Guitarra en más tonalidades:**
   - Renderizar o importar riffs adicionales en Do menor, Sol menor y Fa sostenido menor para dar más variedad armónica al metalcore.
2. **Motor de Humanización de Batería con Grooves de EZdrummer 3 (completado):**
   - Los archivos `.mid` de `C:\Program Files (x86)\Common Files\Toontrack\EZDrummer\Midi\02_@EZDRUMMER_3` se mapean a los compases de verso/coro, con fills y variaciones dinámicas, y se renderizan en canal 10 de percusión.
3. **Generación de Voz / Doblaje Local (Opcional):**
   - Evaluar la integración de un modelo TTS/SVS local ligero (como Bark o Piper) para cantar o recitar las letras escritas en la tarjeta `Letra`.
4. **Exportación directa a proyecto de Ableton Live (`.als`):**
   - Permitir exportar el resultado no solo como WAV/MP3, sino como un archivo de proyecto `.als` listo para abrir en Ableton Live 12 con las pistas asignadas.

---

## 7. Instrucciones para Ejecutar y Probar

Para iniciar el servidor y probar la nueva interfaz:

```bash
# Iniciar el servidor local
node server.js
```

Abrir en el navegador:
```
http://127.0.0.1:4321
```

* Ir a la pestaña **Generar música** para interactuar con la nueva interfaz Suno.
* Probar escribir `metalcore, heavy breakdown` y hacer clic en **Crear**.
* Verificar que el bajo suena como bajo eléctrico real y no como juego de Nintendo.
* Escuchar la batería acústica y las guitarras eléctricas amplificadas.
* Hacer clic en **Cargar en el estudio** para editar los clips en la línea de tiempo multipista.

