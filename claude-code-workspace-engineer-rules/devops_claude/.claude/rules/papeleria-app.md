---
paths:
  - "papeleria_app/**"
---
# papeleria_app — «Papelería Fernández», administración de una papelería (por confirmar su estado)

- Qué es: sistema web para una papelería, con roles `admin` y `empleado`.
- Stack: backend Express + MySQL (mysql2), bcrypt y JWT con cabecera Bearer (scripts `dev`, `start`); frontend React 19 + Vite 7 + React Router + lucide-react. SPA que llama
  a la API REST. Esquema en `sql/papeleria_fernandez_bd.sql`.
- Dónde mirar: `docs/Arquitectura_Tecnologias_PapeleriaFernandez.md` (capas, diagramas `.drawio`, casos de uso), `backend/README.md` (variables: copiar `.env.example` a `.env`).
- No tocar su `CREATE DATABASE` ni su esquema SQL sin preguntar (regla de DEVOPS). Autenticación con Bearer, no con cookie + CSRF como QR/SIGMA_PGA: antes de agregar
  seguridad o roles, leer cómo está y preguntar si debe alinearse con el molde de roles y permisos de QR.
- Despliegue: no hay nada confirmado todavía. Preguntar a Daniel; si va a producción, copiar el molde de aplicación web (QR, Evalúa o SASTRE360).
## Estado actual

- Estado: por confirmar. Completar esta sección al trabajar aquí.
