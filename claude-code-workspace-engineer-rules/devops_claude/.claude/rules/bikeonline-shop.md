---
paths:
  - "E-COMMERCE/bikeonline_shop/**"
---
# bikeonline_shop — BikeOnline.shop, tienda de bicicletas en línea (aplicación web en producción)

- Dentro de la carpeta `E-COMMERCE`, que agrupa tres proyectos independientes (`bikeonline_shop`, `bikestore`, `store_beauty`). Esta regla es solo de este.
- Qué es: e-commerce con panel de administración, asistente de IA (RAG sobre el catálogo) y CRUD completo. En producción: https://bikeonline.shop
- Stack: backend Node + Express (ESM) + MySQL 8 (esquema `onlineshop`), JWT en cookie `HttpOnly` + Google OAuth 2.0, Gemini con RAG, imágenes en Cloudflare R2, búsqueda
  semántica en Cloudflare Vectorize (script `sync:vectorize`), pdfkit, nodemailer; frontend React 18 + Vite (SWC), axios, sonner, Playwright.
- Dónde mirar: `README.md`, `DEPLOY.md`, `DEPLOY_CHECKLIST.md`, `GUIA_USUARIO.md`, `docker-compose.yml`, carpetas `arquitectura`, `performance`, `ataque` (pruebas de seguridad).
- Despliegue: Docker Compose + Nginx en VPS con CI/CD de GitHub Actions (ver `DEPLOY.md`). Es anterior al molde actual (Caddy compartido): antes de cambiar algo del despliegue,
  leer cómo está y preguntar si debe alinearse con el molde de QR/Evalúa/SASTRE360.
- No leer `docker_hostinger.txt`, `gemini.txt` ni ningún `.env`: pueden traer claves.
## Estado actual

- Estado: en producción. Completar esta sección al trabajar aquí.
