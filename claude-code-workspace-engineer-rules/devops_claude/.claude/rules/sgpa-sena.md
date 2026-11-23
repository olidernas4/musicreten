---
paths:
  - "sgpa_sena/**"
---
# sgpa_sena — programación horaria (base de la fusión SIGMA_PGA)

- Qué es: la aplicación original de programación horaria: reglas de cruces, ambientes, jornadas, co-formación y contrajornada.
- Stack: backend Express + mysql2, bcrypt, socket.io; frontend React + FullCalendar. Scripts del backend: `dev`, `start`.
- Dónde mirar: `backend` (las reglas viven en servicios; p. ej. el tope del 80 % por competencia y la co-formación en `programaciones.service.js`) y `docs/`.
- Uso actual: **referencia** para SIGMA_PGA, que ya trae esas reglas reescritas por capas y con pruebas. No se modifica desde otra sesión.
## Estado actual

- Estado: ver SIGMA_PGA. Completar esta sección al trabajar aquí.
