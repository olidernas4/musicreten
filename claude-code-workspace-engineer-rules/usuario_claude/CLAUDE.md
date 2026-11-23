# Reglas generales de Daniel (valen para todos los proyectos)

## Idioma y trato
- Todo en español de Colombia: respuestas, comentarios del código, mensajes de la interfaz, botones y resúmenes.
- Explica despacio y como a principiante cuando se trate de operaciones (servidor, Docker, GitHub, DNS). Si pide
  entender a fondo, explica línea por línea.
- Para cambios grandes: primero verificar y proponer, y esperar su visto bueno antes de tocar código.
- No agregar extras que no pidió (scripts .bat, variables, reglas, logs). Si algo parece útil, proponerlo y preguntar.

## Seguridad
- Nunca escribir ni repetir contraseñas, llaves, tokens ni JWT en respuestas, documentos, comandos permitidos o commits.
  En documentos van como `********` o placeholder.
- Las credenciales reales viven solo en secrets de GitHub; nunca en archivos del repositorio.

## Git y entorno
- Git es solo suyo: no crear ramas, commits, merges ni push, ni ofrecerlos. Si él pide el texto de un commit, dárselo.
- Docker: si está apagado, avisarle y esperar; nunca encenderlo.
- Puertos: en proyectos React/Vite usar los por defecto (5173; 3000 en API). Para pruebas con otros puertos, preguntar antes.
- Las carpetas las borra él. No tocar su `CREATE DATABASE` ni su esquema SQL sin preguntar.

## Arquitectura (como en SIGMA y QR_Control_Asistencia)
- Backend por capas con una sola responsabilidad cada una: routes → controllers → services → repositories → db.
  Validación en `validators`, configuración en `config`, `middlewares`, `types`, `utils`. El SQL solo en repositories.
- Cada archivo empieza con un comentario «Responsabilidad: …» de una o dos líneas.
- Frontend con atomicidad: `components/atomos` → `moleculas` → `organismos` → `plantillas`, y las páginas en `pages`
  (las piezas de un tema, p. ej. `sabana`, `programacion`, van en su propia carpeta de `components`). Llamadas a la API
  solo en `services`, estado compartido en `context`, funciones sueltas en `utils`.
- Todo desplegable lleva buscador (escribir o seleccionar), como el `Selector` de EvalúaApp y QR; nunca un `<select>` nativo.
- Sin triggers en la base de datos: la consistencia (transacciones con rollback, reglas de negocio) vive en los services,
  por si algún proyecto migra a PostgreSQL.
- Las reglas del negocio no se repiten en el frontend: el servidor decide y valida siempre.
- Todo cambio con lógica lleva su prueba automática; antes de dar algo por hecho se corren las pruebas y se compila.

## Web en producción (multiapp en un VPS)
- Docker Compose por aplicación en `/opt/<app>`, con `name:` y `container_name` propios, volumen propio y solo el
  frontend en la red externa `web`. Ningún puerto publicado.
- Un solo proxy compartido (Caddy en `/opt/proxy`) con HTTPS automático; un subdominio por aplicación.
- GitHub Actions: `build-images.yml` (pruebas + imágenes a GHCR) y `deploy.yml` (copia el compose, escribe
  `.env.production` desde los secrets y hace pull + up). El VPS no clona el repositorio.
- El administrador inicial se crea solo al arrancar desde ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD.
- Una llave SSH por aplicación. Nunca `down -v` ni `prune --volumes` en producción.

### Cómo se despliega una app nueva (así se hizo con QR, Evalúa y Sastre360)
- ANTES de armar el despliegue, leer cómo están QR (`QR_Control_Asistencia`), SIGMA y Evalúa y copiar su molde; no inventar
  variantes. Si algo difiere, preguntar por qué.
- Frontend sin `VITE_API_URL` en producción: llama a `/api` en el mismo dominio y el Nginx del frontend lo reenvía al
  backend (en desarrollo sigue `localhost:3000`). Sin `build-args` en el workflow.
- En `build-images.yml` los `secrets` solo se leen dentro de los pasos, nunca en `strategy.matrix` (GitHub lo rechaza).
- `DB_USER` es un usuario normal de la app (p. ej. `sastre`), nunca `root`; `DB_ROOT_PASSWORD` aparte y distinta.
  Claves con `openssl rand -hex 24`; `JWT_SECRET` con `-hex 48`. `CODIGO_ACTIVACION_EXPIRACION_HORAS` va solo el número.
- Si la app tiene prueba automática (`npm run test:api`), corre en el job «verificacion» contra una segunda MySQL de
  pruebas en un puerto distinto de 3306; si falla no se publica ninguna imagen.
- Orden de la primera vez: DNS A en Hostinger → en el VPS: carpeta `/opt/<app>`, llave SSH nueva, bloque en
  `/opt/proxy/Caddyfile` → secrets en GitHub (+ Workflow permissions: Read and write) → commit y push.
- Bloque de Caddy por app (una sola vez), igual que los demás: `<app>.onlydevelop.cloud { import comun` y
  `reverse_proxy <app>-frontend:80 }`. Después SIEMPRE recargar: `cd /opt/proxy && docker compose exec caddy caddy reload
  --config /etc/caddy/Caddyfile` (el `grep` solo prueba el archivo, no que Caddy lo use). Sin eso: `tlsv1 alert internal error`.
- Si el primer deploy falla solo en el chequeo `/api/health` con ese error, no es de la app: recargar Caddy, esperar
  «certificate obtained successfully» en `docker compose logs caddy` y usar «Re-run failed jobs» (no hacer otro push).
- Antes de dar un despliegue por listo, simular CI en Linux limpio (contenedor `node:22`, `pnpm install --frozen-lockfile`).
  No construir las tres imágenes de golpe en su PC: lo satura; de a una y avisando.

## Escritorio y extensiones de VS Code
- Versionado con tag `vX.Y.Z` y `release.yml` en GitHub Actions: crea el Release con el instalador y `latest.yml`.
- Apps de escritorio (Electron): `electron-updater` para actualizar solo. Extensión de VS Code: publicación en el
  marketplace desde el mismo flujo de tags.
- La versión del `package.json` debe coincidir con el tag.
