---
paths:
  - "Banca-Juridica/**"
---
# Banca Jurídica — «BankDash», sistema bancario (por confirmar su estado)

- Qué es: sistema para la gestión de operaciones bancarias: solicitudes de crédito, apertura de cuentas de ahorro, transacciones y control de saldos, con varios roles
  (asesores, directores, cajeros). La carpeta se llama `Banca-Juridica`; el proyecto se conoce como **Banca Jurídica**.
- Stack: `Banca_Back` Node + Express + **TypeScript** + MySQL, JWT, bcrypt, multer (scripts `dev`, `build`, `start`); `Banca_Front` **Angular** (no React) + Tailwind con
  `@ng-select/ng-select` (scripts `start`, `build`, `build:prod`, `test` con Karma); `Banca_sql` con el esquema (`schema.sql`).
- Dónde mirar: el `README.md` de cada una de las tres carpetas.
- Diferencias con el resto: el frontend es Angular, así que las reglas de atomicidad de React del `CLAUDE.md` global no aplican tal cual (conservar la intención: componentes
  pequeños, llamadas a la API solo en servicios). Los desplegables sí deben llevar buscador (`ng-select` ya está instalado).
- No tocar su `CREATE DATABASE` ni su esquema SQL sin preguntar (regla de DEVOPS).
- Despliegue: no hay nada confirmado todavía. Preguntar a Daniel.
## Estado actual

- Estado: por confirmar (último cambio conocido: julio de 2026). Completar esta sección al trabajar aquí.
