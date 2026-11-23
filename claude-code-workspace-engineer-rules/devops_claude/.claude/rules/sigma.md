---
paths:
  - "SIGMA/**"
---
# SIGMA — alistamiento pedagógico (aplicación web en producción)

- Qué es: catálogo curricular, sábana, planeación y guía de aprendizaje del SENA.
- Stack: backend Express 5 + Kysely + MySQL, argon2, Gemini y un subproceso de Python (pdfplumber); frontend React 19 + Tailwind 4.
- Dónde mirar: `CONFIGURACION VPS GITHUB Y DESPLIEGUE.md` y `backend/src` (routes → controllers → services → repositories).
- Despliegue: aplicación web → regla de «Web en producción» del `CLAUDE.md` global.
- Relación: SIGMA_PGA nació de aquí (fusión con la programación horaria de SGPA). Los cambios de SIGMA no se copian a SIGMA_PGA sin que Daniel lo pida.
- Nota local: su `.claude/settings.local.json` es grande (~61 KB) por permisos acumulados; no contiene claves, pero conviene revisarlo y limpiarlo.
## Estado actual

- Estado: en producción. Completar esta sección al trabajar aquí.
