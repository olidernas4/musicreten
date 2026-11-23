---
paths:
  - "E-COMMERCE/store_beauty/**"
---
# store_beauty — «Tienday», tienda en línea de belleza, calzado y bolsos (por confirmar su estado)

- Dentro de la carpeta `E-COMMERCE`, que agrupa tres proyectos independientes. Esta regla es solo de este.
- Qué es: tienda pública en `/` y panel de administración en `/admin`. Reemplaza la versión PHP (`../tienda`) y la vitrina estática (`../vitrinapro_publicacion`): los productos
  y categorías de VitrinaPro (calzado, bolsos, cosméticos) viven en la misma base.
- Stack: backend Express 5 **por capas** (routes → controllers → services → repositories → db), mysql2, JWT, bcrypt, multer, express-rate-limit; frontend React 19 + Vite +
  React Router. `sql/` trae `DB_Tienday.sql` (esquema), `semilla_base.sql` y `semilla_muestra.sql` (opcional).
- Puesta en marcha: importar en MySQL 8, en este orden, `DB_Tienday.sql` → `semilla_base.sql` → `semilla_muestra.sql`; luego backend y frontend (scripts `dev`). Ver `README.md`.
- No tocar su `CREATE DATABASE` ni su esquema SQL sin preguntar (regla de DEVOPS).
- Despliegue: no hay nada confirmado todavía. Preguntar a Daniel; si va a producción, copiar el molde de aplicación web.
## Estado actual

- Estado: por confirmar. Completar esta sección al trabajar aquí.
