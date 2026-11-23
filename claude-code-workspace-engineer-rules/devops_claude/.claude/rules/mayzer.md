---
paths:
  - "MAYZER/**"
---
# Mayzer — aplicación web con informes y calendario (por confirmar su estado)

- Qué es: aplicación web con backend y frontend, con reportes en Excel y PDF, un calendario y archivos subidos. La carpeta se llama `MAYZER`; el proyecto se conoce como **Mayzer**.
- Stack: backend Express + MySQL con helmet, express-rate-limit, compression, JWT, multer, nodemailer, pdfkit, `xlsx-js-style` y `archiver` (scripts `dev`, `start`); frontend React +
  Vite con axios, sonner y `xlsx-js-style`. Base de datos en `database/` (`schema.sql` y `datos_iniciales.sql`).
- Despliegue: `docker-compose.yml` con tres servicios (`mayzer_db` con MySQL 8, `mayzer_backend`, `mayzer_frontend`) y los volúmenes `mayzer_db_data` y `mayzer_uploads`.
  Es anterior al molde actual (Caddy compartido): antes de cambiar algo, leer cómo está y preguntar si debe alinearse con el molde de QR/Evalúa/SASTRE360.
- No tocar su `CREATE DATABASE` ni su esquema SQL sin preguntar (regla de DEVOPS).
## Estado actual

- Estado: por confirmar (último cambio conocido: julio de 2026, entrega final). Completar esta sección al trabajar aquí.
