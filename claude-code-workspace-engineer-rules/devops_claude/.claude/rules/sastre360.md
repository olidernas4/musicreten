---
paths:
  - "SASTRE360/**"
---
# SASTRE360 — gestión de sastrería (aplicación web en producción)

- Qué es: pedidos, prendas con estado, dinero con fuente única y cancelaciones.
- Stack: backend Express + mysql2; frontend React. Las carpetas se llaman **`Backend` y `Frontend` con mayúscula** y el gestor de paquetes es **pnpm**
  (`pnpm -C Backend`, `pnpm -C Frontend`). Scripts del backend: `test`, `dev`, `start`, `test:api`.
- Dónde mirar: `docs/`, la prueba `npm run test:api` que corre en el CI (job «verificacion» contra una segunda MySQL de pruebas), importación y `seedAdmin` por capas.
- Despliegue: aplicación web → regla de «Web en producción» del `CLAUDE.md` global; molde de despliegue junto con QR y Evalúa
  (`DB_USER` normal de la app, p. ej. `sastre`, nunca `root`).
- Pendiente de seguridad (decisión de Daniel): su `.gitignore` no ignora `.claude/settings.local.json`; si algún día aparece ese archivo, se subiría al repositorio.
## Estado actual

- Estado: en producción. Completar esta sección al trabajar aquí.
