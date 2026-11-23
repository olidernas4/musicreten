---
paths:
  - "Grabacion_Pantalla/**"
  - "download_bringr/**"
  - "ramcrack_request/**"
---
# Aplicaciones de escritorio y extensión (versionado con tags `vX.Y.Z`)

Reglas comunes (también en el `CLAUDE.md` global): el Release lo crea GitHub Actions al subir el tag `vX.Y.Z` (`release.yml`: instalador + `latest.yml`);
la versión del `package.json` debe coincidir con el tag; las apps Electron se actualizan solas con `electron-updater`.

## Grabacion_Pantalla — «Desktop Capture Pro», grabadora de pantalla
- Electron (electron-vite), electron-updater, mediabunny. Mirar `.github/workflows/release.yml` (Windows, `npm run release`, publica `latest.yml`) y `package.json`.

## download_bringr — «Descargador de videos»
- Electron + servidor Python empaquetado (PyInstaller → `servidor.exe`) + React. Mirar `.github/workflows/release.yml`
  (crea el Release una sola vez y luego electron-builder) y `escritorio/package.json`.

## ramcrack_request — extensión de VS Code tipo cliente HTTP (licencia MIT)
- TypeScript, sin dependencias de ejecución. Mirar `.github/workflows/release.yml` (`.vsix` en el Release) y `publish-marketplace.yml`
  (`vsce publish --oidc`). Es el molde para publicar una extensión.

## Estado actual

- Grabacion_Pantalla, download_bringr y ramcrack_request: completar aquí al cerrar cada versión o subfase.
