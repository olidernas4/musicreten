---
paths:
  - "E-COMMERCE/bikestore/**"
---
# bikestore — BS Bike Store, tienda de bicicletas (por confirmar su estado)

- Dentro de la carpeta `E-COMMERCE`, que agrupa tres proyectos independientes. Esta regla es solo de este.
- Qué es: catálogo, cuentas, pedidos y reseñas de una tienda de bicicletas. Los precios de los pedidos se calculan en el servidor y el inventario se reserva dentro de una
  transacción MySQL. No procesa pagos.
- Stack: carpetas `Backend` y `Frontend` con mayúscula y `SQL`. Backend Express + TypeScript + MySQL 8, zod, helmet, express-rate-limit, scripts `dev`, `build`, `start`,
  `admin:create`, `catalog:seed`; frontend React + Tailwind + Vite + vitest (scripts `dev`, `build`, `preview`, `format`, `test`). Pruebas de extremo a extremo con Playwright
  en la raíz (`playwright.config.ts`, `tests/`).
- Dónde mirar: `Backend/README.md` (configuración local: crear base y datos iniciales desde la raíz, en ese orden).
- Despliegue: no hay nada confirmado todavía. Preguntar a Daniel si está o va a producción; si sí, copiar el molde de aplicación web (QR, Evalúa o SASTRE360).
## Estado actual

- Estado: por confirmar. Completar esta sección al trabajar aquí.
