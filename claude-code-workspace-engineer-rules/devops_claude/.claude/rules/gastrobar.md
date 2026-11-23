---
paths:
  - "GASTROBAR/**"
---
# GASTROBAR — «Gastrobar POS», punto de venta de escritorio

- Qué es: punto de venta y administración de un gastrobar para un solo computador (administrador y cajero comparten equipo). Módulos: salón y mesas, caja por turnos,
  catálogos, recetas con subrecetas, inventario (compras, lotes con vencimiento, descuento FEFO), reportes, anulación de tiquetes, impresión térmica ESC/POS, usuarios
  (admin y caja), respaldo de la base. No es facturación electrónica DIAN.
- Stack: Electron + React + Vite + SQLite (`better-sqlite3`), `electron-updater`, `electron-builder`. Versión actual en `package.json` (la versión debe coincidir con el tag).
- Scripts: `dev`, `start`, `test`, `build`, `release`, `rebuild` (si `better-sqlite3` falla al compilar, ver el README: instalar sin scripts y descargar el binario para Electron).
- Dónde mirar: `README.md`, `docs/Documentacion.md` y `docs/respaldo.md`, `src/`, `.github/workflows/release.yml`.
- Despliegue: aplicación de escritorio → regla «Escritorio y extensiones» del `CLAUDE.md` global: tag `vX.Y.Z` + `release.yml` crea el Release; molde en `Grabacion_Pantalla` y `download_bringr`.
- Carpetas generadas (no recorrer): `build`, `dist`, `dist-electron`.
## Estado actual

- Estado: en desarrollo activo (último cambio conocido: versión visible en la barra lateral). Completar esta sección al trabajar aquí.
