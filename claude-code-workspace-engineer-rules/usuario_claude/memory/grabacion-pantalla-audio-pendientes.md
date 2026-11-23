---
name: grabacion-pantalla-audio-pendientes
description: "Hallazgos y mejoras pendientes de audio en Grabacion_Pantalla (Desktop Capture Pro): alias duplicados de micrófono, eco y etiqueta «Sin audio»; más el teloprompter que Daniel quiere trabajar aparte"
metadata:
  node_type: memory
  type: project
  originSessionId: ba86d354-033b-4704-9c04-051c9d13599f
  modified: 2026-11-18T03:57:54.046Z
---

Revisión del audio de `Grabacion_Pantalla` (Electron, motor en `src/renderer/engine/`), hecha el 2026-11-17 solo leyendo código, sin cambios ni pruebas grabando.

**Cómo está:** dos fuentes que se mezclan: micrófono (compresor + ganancia +15 dB + limitador, `audioCapture.js`) y «Sonido del equipo» (loopback de Windows, tal cual, ajuste `systemAudio`). Solo audio del sistema ya se logra con mic apagado + sonido del equipo encendido.

**Hallazgos:**
- `useMics.js` lista los alias de Windows «Default» y «Communications» además del dispositivo real (mismo micrófono 3 veces) y elige `list[0]` («Default»).
- La etiqueta de la barra dice «Sin audio» con el mic apagado aunque se grabe el sonido del equipo (`InputsGroup.jsx`).
- Eco probable: mic + sonido del equipo con parlantes (el mic recoge lo que ya entra por loopback; el `echoCancellation` del mic no cancela el audio del sistema) o «Escuchar este dispositivo» activado en Windows.

**Mejoras propuestas (sin aprobar):** ocultar alias; selector de modo (solo mic / solo sistema / ambos / ninguno); aviso de audífonos; ajuste de ganancia del mic.
**Pruebas que Daniel iba a hacer:** A) con audífonos, B) solo sonido del equipo con mic apagado, C) escoger el micrófono sin prefijo «Default».

**Why:** Daniel pidió guardarlo para retomarlo más adelante, junto con un cambio sobre el telepronter («ya te diré»); la barra ya tiene opción de prompter (`prompter.toggle`).
**How to apply:** al volver a `Grabacion_Pantalla`, preguntar el resultado de las pruebas A/B/C y qué mejoras aprueba antes de tocar código; leer cómo está hecho el prompter antes de proponer nada.
