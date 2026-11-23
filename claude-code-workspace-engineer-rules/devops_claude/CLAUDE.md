# DEVOPS — espacio de trabajo de Daniel (mapa de sus proyectos)

Esta carpeta agrupa el código de los proyectos propios de Daniel, los que están en producción y los que van camino a producción.
**Todos los proyectos son de Daniel**, aunque algunos los hayan desarrollado otras personas por encargo suyo y sus repositorios en GitHub estén en cuentas ajenas. Cada
proyecto es su propia carpeta, con su propio `.git` y su propio repositorio (excepto `E-COMMERCE`, que agrupa tres proyectos independientes, cada uno con su propia regla).
DEVOPS en sí NO es un repositorio: es solo la carpeta de trabajo local. Los PDF de registro DNDA y el `iniciar.bat` de la raíz son información y un atajo para abrir la carpeta
en VS Code: no se tocan. Mapa al 2026-11-16.

## Cómo está organizado lo que Claude debe saber (3 capas, ninguna dentro de un repositorio de proyecto)
| Capa | Dónde | Qué contiene |
|---|---|---|
| Personal | `C:\Users\RAMCRACK_DHANIEL\.claude\CLAUDE.md` | Lo que vale siempre: español de Colombia, seguridad, Git solo de Daniel, capas del backend, atomicidad del frontend, moldes de despliegue web (Caddy) y de escritorio (tags). |
| Espacio de trabajo | este archivo | El mapa de proyectos y las reglas de cómo trabajar entre ellos. |
| Proyecto | `.claude/rules/<proyecto>.md` (aquí mismo, en `DEVOPS\.claude\rules`) | Stack, estado, decisiones, cómo probar y cómo se despliega ese proyecto. Se cargan solos al trabajar en su carpeta (`paths`). |

Por eso las reglas y el contexto de un proyecto **nunca se suben a su repositorio** ni afectan sus despliegues.

## Reglas de esta carpeta
- **Un chat, una tarea.** Al empezar, identificar el proyecto y leer su regla (`.claude/rules/<proyecto>.md`): ahí está el estado y lo ya decidido.
  Al terminar una fase o una tanda importante, **actualizar la sección «## Estado actual» de esa regla** para no depender del historial de chats.
- **Trabajar dentro de UN proyecto a la vez.** Los demás sirven para consultar cómo se resolvió algo, no para modificarlos desde otra sesión
  (cambiar otro proyecto solo si Daniel lo pide).
- **Git es solo de Daniel:** aquí y en cada proyecto no se crean ramas, commits, merges ni push, ni se ofrecen. Si pide el texto de un commit, dárselo.
- **Nunca leer secretos:** `.env`, `.env.*` (incluido `.env.production`), llaves, tokens ni credenciales. En respuestas y documentos van como `********`.
  Una contraseña de pruebas que Daniel escriba en el chat se usa solo en el navegador local y no se repite ni se guarda en ningún archivo.
- **No recorrer** `node_modules`, `dist`, `build`, `out`, `release`, `.venv`, `.git`. Abrir solo la carpeta o el archivo que se necesita.
- Antes de armar algo nuevo (un despliegue, un módulo, una pantalla), **leer primero cómo está hecho en el proyecto que ya lo resolvió**
  (tabla de abajo) y copiar el molde; si algo difiere, preguntar por qué.
- Las carpetas las borra Daniel. No tocar su `CREATE DATABASE` ni su esquema SQL sin preguntar.
- Puertos por defecto (5173 el frontend, 3000 la API). Para pruebas con otros puertos, preguntar antes. Docker apagado: avisar y esperar.

## Protocolo de ingeniería auditada (por cada subtarea de código)
1. **Plan y molde.** Leer el molde de la tabla de abajo y la regla del proyecto. Entregar SOLO: lista de archivos a crear/tocar y firmas/contratos
   (rutas, tipos, funciones públicas). No escribir código hasta el visto bueno de Daniel.
2. **Pruebas primero.** Escribir antes las pruebas de caracterización, integración o casos borde (inválidos, permisos, concurrencia) y verlas fallar.
3. **Implementar y verificar.** Implementar por capas (`routes → controllers → services → repositories → db`) o por atomicidad en el frontend;
   correr compilación (`npx tsc --noEmit`) y pruebas hasta dejarlas en verde. No dar nada por hecho sin ese resultado a la vista.
- **Contexto:** al pasar de ~120k tokens, o al cerrar una subfase, actualizar «## Estado actual» en `.claude/rules/<proyecto>.md` y recomendar
  a Daniel `/clear` antes de la siguiente subfase. Lo decidido vive en la regla, no en el chat.
- **Auditoría cruzada:** al cerrar una fase crítica (pagos, seguridad, inventario/kárdex, facturación, permisos), proponer a Daniel el prompt exacto
  para una sesión limpia (o subagente) que revise lo nuevo contra este `CLAUDE.md`, las reglas de negocio y OWASP (IDOR, validación de entrada,
  autorización por recurso, condiciones de carrera, secretos en logs). Quien revisa no es quien escribió el código.
- **Verificación automática:** `.claude/settings.json` permite correr pruebas/compilación sin preguntar y bloquea `git` y la lectura de secretos.
  Un hook `PostToolUse` de tipos se activa por proyecto (no global: `tsc` en cada edición es lento); ver la guía de portabilidad entregada en la auditoría.

## Proyectos

### Aplicaciones web (VPS: Docker Compose por app + Caddy compartido, HTTPS, un subdominio por app)
| Carpeta | Qué es | Stack | Dónde mirar |
|---|---|---|---|
| `QR_Control_Asistencia` | Control de acceso con carnets QR, visitas, asistencia, reportes | Express + Kysely + MySQL, argon2, JWT en cookie + CSRF, pdfkit, exceljs; React + Vite, socket.io | `sql/qr_control_esquema.sql` (roles y permisos), `backend/src/middlewares/seguridad.middleware.ts`, `backend/src/services/cuenta.service.ts`, `docs/DESPLIEGUE_VPS.md`, `.github/workflows/` |
| `evalua_app` | Evaluaciones/exámenes con carga de aprendices a un curso por documento y correo | Express + mysql2, bcrypt, exceljs; React con Radix (shadcn) | `DESPLIEGUE.md`, `.github/workflows/`, la vinculación de aprendices por cédula/correo |
| `SASTRE360` | Gestión de sastrería: pedidos, prendas con estado, dinero con fuente única, cancelaciones | Express + mysql2; React; carpetas `Backend` y `Frontend` con mayúscula; pnpm | `docs/`, pruebas `npm run test:api` en el CI, importación y `seedAdmin` por capas |
| `SIGMA` | Alistamiento pedagógico: catálogo curricular, sábana, planeación, guía de aprendizaje | Express 5 + Kysely + MySQL, argon2, Gemini y un subproceso de Python (pdfplumber), React 19 + Tailwind 4 | `CONFIGURACION VPS GITHUB Y DESPLIEGUE.md`, `backend/src` (routes → controllers → services → repositories) |
| `sgpa_sena` | Programación horaria (la base de la fusión): reglas de cruces, ambientes, jornadas | Express + mysql2, bcrypt, socket.io; React + FullCalendar | `backend` (reglas en servicios), `docs/` |
| `SIGMA_PGA` | **Fusión de SIGMA + programación de SGPA, desplegada** (F1 a F10 hechas; en producción desde 2026-11-17) | Igual que SIGMA; permisos por catálogo en código, personas/cuentas/instructores, átomos de UI, FullCalendar, SSE | `backend/src/config/permisos.catalogo.ts`, `backend/src/services/programacionReglas/`, `backend/tests/` (caracterización), `sql/init/` |
| `partitura_guitarra` | Transcripción de audio de guitarra a partitura (aún no en producción) | Express + mysql2; React + `@spotify/basic-pitch`, pitchy | `README.md` (completar más adelante) |
| `E-COMMERCE/bikeonline_shop` | **BikeOnline.shop**, tienda de bicicletas con asistente de IA (en producción: bikeonline.shop) | Express (ESM) + MySQL 8, Google OAuth, Gemini RAG, Cloudflare R2/Vectorize; React 18 + Vite | `README.md`, `DEPLOY.md`, `DEPLOY_CHECKLIST.md`, `docker-compose.yml` |
| `E-COMMERCE/bikestore` | **BS Bike Store**, tienda de bicicletas (estado por confirmar) | Express + TypeScript + MySQL 8, zod; React + Tailwind; Playwright; carpetas `Backend`, `Frontend`, `SQL` | `Backend/README.md` |
| `E-COMMERCE/store_beauty` | **Tienday**, tienda de belleza, calzado y bolsos con panel `/admin` (estado por confirmar) | Express 5 por capas + MySQL; React 19 + Vite | `README.md`, `sql/` |
| `E-COMMERCE/bikeshop` | **BikeShop**, evolución nueva de BikeOnline (repositorio nuevo, `bikeshop.onlydevelop.cloud`): variantes, varias sucursales, pagos manuales con comprobante, Wompi, taller, contenido editable. **Fases 0 a 4 hechas (diseño, esquema de 61 tablas, autenticación, Docker y CI, catálogo con variantes e imágenes R2, inventario por ubicación con kárdex, compras y traslados, compra segura con pedidos y reservas de stock); el primer despliegue se hará al final de todo el aplicativo; sigue la Fase 5 (pagos)** | Express 5 + TypeScript + Kysely + MySQL 8.4; React 19 + Vite + Tailwind 4; R2; Gemini | `docs/FASE_0_DISENO.md` (diseño aprobado) |
| `papeleria_app` | **Papelería Fernández**, administración de una papelería con roles admin y empleado (estado por confirmar) | Express + MySQL, bcrypt, JWT Bearer; React 19 + Vite 7 | `docs/Arquitectura_Tecnologias_PapeleriaFernandez.md`, `sql/` |
| `Parking_App` | Gestión de parqueaderos de Palmira con motor de reglas de cobro según la resolución 2025 (estado por confirmar) | Express + MySQL, QR, jspdf; React + MUI/Radix + Tailwind | `backend_park/README.md`, `Park_documentacion/` |
| `CASERCON.S.A.S` | **Casercon**, sistema de la empresa, con despliegue de producción (estado por confirmar) | Express + MySQL + zod; React + Radix; Playwright; Docker Compose prod | `docker-compose.prod.yml`, `.github/workflows/deploy.yml`, `Informe_GITFLOW.docx` (⚠ `Credenciales.txt` está versionado: no abrirlo) |
| `Banca-Juridica` | **Banca Jurídica** («BankDash»), sistema bancario con roles (estado por confirmar) | Express + TypeScript + MySQL; **Angular** + Tailwind | `Banca_Back`, `Banca_Front`, `Banca_sql` (cada una con su `README.md`) |
| `MAYZER` | **Mayzer**, aplicación web con reportes en Excel/PDF y calendario (estado por confirmar) | Express + MySQL + Docker Compose; React + Vite | `database/`, `docker-compose.yml` |
| `quincost` | **Quincora**, aplicación de escritorio .NET de 2023 (pendiente de decidir qué hacer con ella) | C# / Windows Forms, SQLite | `QuincoraBD.sql`, `Quincora Lite.txt` |

> `QR_Control_Asistencia` y `SIGMA_PGA` ya están dentro de DEVOPS y sus reglas se cargan solas. `SIGMA_PGA` ya tiene su repositorio propio (`Dhaniel-05/sigma_gpa_sena`) y está desplegado en `sigma.onlydevelop.cloud`.
> La regla `store-online.md` quedó sin efecto (la carpeta `Store_Online` ya no existe; ahora cada tienda tiene su propia regla); no se borra hasta que Daniel lo pida.

### Aplicaciones de escritorio y extensión (versionado con tags `vX.Y.Z` + GitHub Actions que crea el Release)
| Carpeta | Qué es | Stack | Dónde mirar |
|---|---|---|---|
| `Grabacion_Pantalla` | «Desktop Capture Pro»: grabadora de pantalla | Electron (electron-vite), electron-updater, mediabunny | `.github/workflows/release.yml` (Windows, `npm run release`, publica `latest.yml`), `package.json` |
| `download_bringr` | «Descargador de videos» | Electron + servidor Python empaquetado (PyInstaller → `servidor.exe`) + React | `.github/workflows/release.yml` (crea el Release una sola vez y luego electron-builder), `escritorio/package.json` |
| `GASTROBAR` | **Gastrobar POS**: punto de venta de un gastrobar para un solo computador (caja, recetas, inventario FEFO, impresión térmica) | Electron + React + Vite + SQLite (`better-sqlite3`), electron-updater | `README.md`, `docs/`, `.github/workflows/release.yml` |
| `ramcrack_request` | Extensión de VS Code tipo cliente HTTP, licencia MIT | TypeScript, sin dependencias de ejecución | `.github/workflows/release.yml` (`.vsix` en el Release) y `publish-marketplace.yml` (`vsce publish --oidc`) |

## Moldes que se reutilizan
- **Despliegue de una app nueva en el VPS** → copiar `QR_Control_Asistencia`, `evalua_app` o `SASTRE360`: `build-images.yml` (pruebas + imágenes a GHCR),
  `deploy.yml` (copia el compose, escribe `.env.production` desde los secrets, pull + up), frontend sin `VITE_API_URL` (Nginx reenvía `/api`).
- **Roles y permisos** → `QR_Control_Asistencia` (base) y `SIGMA_PGA` (versión con catálogo en código, varios roles por cuenta y roles dentro de la ficha).
- **Backend por capas** (routes → controllers → services → repositories → db) → `SIGMA_PGA`, `QR_Control_Asistencia`, `SASTRE360`.
- **Frontend por atomicidad** (átomos → moléculas → organismos → plantillas → páginas) → `SIGMA_PGA`.
- **Prueba de caracterización de la API** (base MySQL de pruebas, instantánea de respuestas) → `SIGMA_PGA/backend/tests/caracterizacion` y `SASTRE360`.
- **Reglas de negocio en servicios, una regla por archivo** → `SIGMA_PGA/backend/src/services/programacionReglas`.
- **Actualización automática de apps Electron** (`electron-updater`, `latest.yml`) → `Grabacion_Pantalla` y `download_bringr`.
- **Publicar una extensión de VS Code** → `ramcrack_request`.
- **Carga masiva y comparación por cédula y correo** → `evalua_app` (modelo para la carga de instructores de SIGMA_PGA).
- **Tiempo real con SSE** (el servidor avisa, el navegador escucha) → `SIGMA_PGA` (`programacionEventos.service.ts`, hook `useEnVivo`).

## Cómo agregar o quitar un proyecto
1. **Agregar:** poner la carpeta del proyecto (con su `.git`) dentro de `D:\DESARROLLO_WEB\DEVOPS`. Los remotos de GitHub no cambian.
2. Agregar su fila a la tabla de arriba.
3. Crear `DEVOPS\.claude\rules\<proyecto>.md` con el encabezado `paths: ["<carpeta>/**"]` (copiar el de un proyecto parecido) y, si tiene
   servidor de desarrollo, una entrada en `DEVOPS\.claude\launch.json`.
4. **Quitar:** Daniel mueve o borra la carpeta; después se quitan su fila, su regla y su entrada de `launch.json`.
