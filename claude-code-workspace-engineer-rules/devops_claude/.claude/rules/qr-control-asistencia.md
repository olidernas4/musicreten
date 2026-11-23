---
paths:
  - "QR_Control_Asistencia/**"
---
# QR_Control_Asistencia — control de acceso con carnets QR (aplicación web en producción)

- Qué es: carnets QR, visitas, asistencia y reportes. Es el **molde base** de roles/permisos y de despliegue en el VPS.
- Stack: backend Express + Kysely + MySQL, argon2, JWT en cookie + CSRF, pdfkit, exceljs; frontend React + Vite, socket.io.
- Dónde mirar: `sql/qr_control_esquema.sql` (roles y permisos), `backend/src/middlewares/seguridad.middleware.ts`, `backend/src/services/cuenta.service.ts`,
  `docs/DESPLIEGUE_VPS.md`, `.github/workflows/` (`build-images.yml`, `deploy.yml`).
- Despliegue: aplicación web → regla de «Web en producción» del `CLAUDE.md` global (Docker Compose por app en `/opt/<app>`, Caddy compartido, un subdominio por app).
- Scripts del backend: `dev`, `build`, `start`, `typecheck`, `test`. Frontend: `dev`, `build`, `preview`.
## Estado actual

- Estado: en producción. Al trabajar aquí, completar esta sección con lo que se decida (convenciones propias, pendientes).
