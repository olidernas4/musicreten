---
paths:
  - "CASERCON.S.A.S/**"
---
# Casercon — sistema de la empresa Casercon (aplicación web con despliegue de producción)

- Qué es: aplicación web de la empresa. La carpeta se llama `CASERCON.S.A.S` y el proyecto se conoce como **Casercon**.
- Stack: backend Express + MySQL con validación `zod`, helmet, JWT, bcrypt, multer y nodemailer (scripts `dev`, `start`, `test`); frontend React + Vite + Tailwind + Radix, axios,
  sonner y pruebas de extremo a extremo con Playwright (`test:e2e`).
- Despliegue: `docker-compose.yml` (desarrollo) y `docker-compose.prod.yml` (producción, red `casercon_network`) y `.github/workflows/deploy.yml`. Es anterior al molde actual
  (Caddy compartido): antes de cambiar algo del despliegue, leer cómo está y preguntar si debe alinearse con el molde de QR/Evalúa/SASTRE360.
- Dónde mirar: `Informe_GITFLOW.docx` (flujo de trabajo con Git).
- **Seguridad — no abrir `Credenciales.txt`.** Está en la raíz y **versionado en git** (no hay `.gitignore`): si trae claves reales, están en el historial del repositorio. Daniel
  debe revisarlo, cambiar las que estén vivas y agregarlo a un `.gitignore`. Nunca leerlo ni repetir su contenido.
## Estado actual

- Estado: por confirmar. Completar esta sección al trabajar aquí.
