---
paths:
  - "Parking_App/**"
---
# Parking_App — gestión de parqueaderos de Palmira (por confirmar su estado)

- Qué es: sistema de gestión de estacionamientos que cumple la resolución de tarifas 2025 del municipio de Palmira. Su corazón es un **motor de reglas de cobro** configurable
  desde la base de datos (tarifas urbanas con fracción base de 3 h para motos y 4 h para autos, y tarifas escalonadas de aeropuerto): no hay tarifas fijas en el código.
- Stack: `backend_park` Express + MySQL, JWT, bcrypt, QR (`qrcode`, `html5-qrcode`), PDF (`jspdf`); `frontend_park` React + Vite + Tailwind + MUI y Radix.
- Dónde mirar: `backend_park/README.md` (explica el motor de reglas), `Park_documentacion` (resolución en PDF, tarifas en Excel, MER y `park.sql`).
- No tocar su `CREATE DATABASE` ni su esquema SQL sin preguntar (regla de DEVOPS). Las tarifas salen de una norma: no cambiar reglas de cobro sin confirmarlo con Daniel.
- Despliegue: no hay nada confirmado todavía. Preguntar a Daniel; si va a producción, copiar el molde de aplicación web.
## Estado actual

- Estado: por confirmar (último cambio conocido: febrero de 2026). Completar esta sección al trabajar aquí.
