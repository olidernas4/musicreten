---
paths:
  - "SIGMA_PGA/**"
---
# SIGMA_PGA — fusión de SIGMA (alistamiento pedagógico) + programación horaria de SGPA

## Qué es y cómo se corre
- Stack: backend Express 5 + Kysely + MySQL (mysql2), argon2, JWT en cookie httpOnly + CSRF (header `x-csrf-token`); frontend React 19 + Vite 8 +
  Tailwind 4, lucide-react, react-hot-toast, FullCalendar; Python/pdfplumber + Gemini para leer PDFs del SENA.
- Carpetas: `backend`, `frontend`, `sql/init/sigma_gpa_db.sql` (esquema único), `backend/tests`. Puertos por defecto: API 3000, front 5173.
- El esquema SQL lo recrea Daniel a mano; si el esquema cambia, avisarle exactamente qué ejecutar (p. ej. solo el `CREATE TABLE` nuevo). Sin triggers:
  la consistencia va en los services con transacciones y rollback (puede migrar a PostgreSQL).
- Pruebas (todas desde `backend`): `npm run test:unidades`, `npm run test:permisos`, `npm run test:api` (base aparte `<DB_NAME>_test`, se recrea sola;
  compara con `tests/caracterizacion/esperado.txt`; `-- --actualizar` si el cambio fue a propósito, revisando antes qué respuestas antiguas cambiaron).
  Frontend: `npm run build` (`tsc -b` + vite) y ESLint sobre lo que se toque. Antes de dar algo por hecho: pruebas + compilar.

## Arquitectura propia de este proyecto
- Backend por capas: routes → controllers → services → repositories → db. SQL solo en repositories. Cada archivo abre con «Responsabilidad: …».
- Permisos por catálogo en código (`backend/src/config/permisos.catalogo.ts`, hoy 68): `requierePermiso` (de la cuenta) y `requierePermisoEnFicha`
  (de la cuenta o del rol en la ficha: Gestor, Cogestor, Instructor). Nunca se compara por nombre de rol. El test `test:permisos` exige que todo permiso se use.
- Frontend por atomicidad: `components/atomos` → `moleculas` → `organismos` → `plantillas`, más módulos por tema (`sabana`, `programacion`, `ubicacion`…);
  páginas en `pages`, llamadas a la API solo en `services`, estado compartido en `context`, funciones sueltas en `utils`, listas con `useListado` (loaders estables).
- El servidor decide y valida siempre; el frontend solo muestra. Nada se borra: se inactiva.

## Estado actual (actualizar al terminar cada fase) — al 2026-11-18
- **DESPLEGADO** desde 2026-11-17 en https://sigma.onlydevelop.cloud. Repositorio propio privado `Dhaniel-05/sigma_gpa_sena` (Git lo maneja Daniel). `DEVOPS/SIGMA` es el proyecto anterior (solo referencia). Nombres `sigma-*` de contenedores, volumen e imágenes se conservan.
- F1 a F10 hechas y verificadas, más mejoras de UX (menú lateral desde `config/modulos.ts`, calendario 12 h, `Selector` con buscador), pantalla «Usuarios», «Programar», sábana «Empezar desde…» y calendario por jornada. Prueba API más reciente: 714 peticiones. Detalle de cada una: `docs/HISTORIAL_ESTADO.md`.
- Roles vigentes además de los administrativos: Subdirector (solo `programacion.ver`, todos los centros) y Aprendiz (solo `programacion.ver_mi_ficha`; la ficha ajena da 404). Cargas masivas Excel (`/api/admin/carga-masiva`) de instructores, equipos y aprendices: vista previa, todo o nada, nunca pisan datos de quien ya existe.
- La base de producción nace vacía: catálogo, fichas, equipos y distribución se cargan desde la interfaz. En una base ya creada, los cambios de esquema se aplican a mano (avisar a Daniel exactamente qué ejecutar).
- Despliegue: guía vigente `docs/DESPLIEGUE.md`. `CONFIGURACION VPS GITHUB Y DESPLIEGUE.md` (raíz) es una guía VIEJA, no aplica. Los `package-lock.json` deben estar en sincronía (`npm ci --dry-run` en backend y frontend) o el CI falla. Lecciones del primer despliegue (paquetes GHCR, Caddy sin `request_body`, `Python/output` con chown): en el historial.
- Pendientes menores: confirmar si la competencia 999999999 del proyecto ADSO es la genérica de etapa práctica; recargar el proyecto GA con el lector nuevo; la ficha de prueba 2900001 y la franja 18:00–22:00 Nocturna son datos de prueba locales de Daniel.

## Decisiones ya tomadas (no re-litigar)
- Programación: las horas = franja × veces que cae ese día entre las dos fechas, comparadas con `horas_trimestre` de la sábana. Fechas fuera del contrato de un
  contratista solo advierten. Bloquean: cruce del instructor, ambiente ocupado por OTRA ficha, desplazamiento entre ciudades (sin configurar = pide configurarlo),
  duplicado, tope del 80 % por competencia (por ficha), datos inválidos. Piden confirmar: contrajornada y co-formación. Solo advierten: carga (<36 h o ≥42 h; ambiente ≥48 h), casilla sobreasignada.
- Tiempo real con SSE (no socket.io). El Nginx del frontend ya lleva el bloque de `eventos` con `proxy_buffering off`.
- Concurrencia: transacciones en READ COMMITTED con bloqueo (`FOR UPDATE`) del instructor y del ambiente, siempre en el mismo orden.
- Una casilla con franjas activas no se desmarca de la sábana; un instructor con franjas activas no sale del equipo de la ficha.
- Los centros, sedes y ambientes los administra el superadmin; ambientes por rango (máx. 500) o uno por uno. Desplazamiento solo entre ciudades distintas.
- Pruebas de API: el arnés enmascara la fecha de exportación de los Excel; mantener la prueba de concurrencia AL FINAL de `pasosProgramacion.ts` (si no, es inestable).
