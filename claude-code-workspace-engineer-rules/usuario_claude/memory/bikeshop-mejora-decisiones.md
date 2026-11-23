---
name: bikeshop-mejora-decisiones
description: "Plan y decisiones para rehacer BikeOnline como repositorio nuevo (bikeshop.onlydevelop.cloud): auditoría de los 3 proyectos E-COMMERCE, fases, pagos y reglas acordadas con Daniel"
metadata:
  node_type: memory
  type: project
  originSessionId: ba86d354-033b-4704-9c04-051c9d13599f
  modified: 2026-11-19T00:31:52.838Z
---

Daniel quiere un repositorio NUEVO a partir de `E-COMMERCE/bikeonline_shop` (su proyecto de maestría, registrado en el DNDA, bajado hace ~4 meses), mejorado con lo mejor de `bikestore` y `store_beauty`. Auditoría hecha el 2026-11-17 (solo lectura de código).

**Decisiones (2026-11-17):**
- Subdominio `bikeshop.onlydevelop.cloud`; despliegue con el molde Caddy + GHCR + GitHub Actions (QR/Evalúa/SASTRE360).
- Backend en TypeScript, arquitectura por capas como SIGMA_PGA/QR; frontend por atomicidad; todos los desplegables/filtros con el `Selector` con buscador de SIGMA_PGA/QR.
- Tiene RUT pero NO empresa constituida: por ahora pagos manuales (comprobante Nequi/banco con referencia, validado), datos simulados, y todo listo para cuando constituya empresa. Pasarela Wompi: usar lo gratuito (ambiente de pruebas) y dejarla lista.
- Sin facturación electrónica DIAN por ahora; explicarle qué haría falta si algún día la necesita.
- Imágenes en Cloudflare R2 (plan gratis alcanza) con conversión a WebP; nunca base64 en la base de datos.
- Repositorio nuevo SIN el historial del viejo; rotar llaves (Gemini, Google OAuth, R2, Vectorize, correo); no copiar `gemini.txt` ni `docker_hostinger.txt`.

**Hallazgos graves del BikeOnline viejo (no repetir):** guarda número de tarjeta completo en `ventas.numero_tarjeta` y lo precarga; el servidor confía en precios e `id_usuario` del cliente; sin control de propiedad de pedidos (se pueden ver y cancelar los ajenos); sin helmet ni rate-limit; cuentas semilla admin@gmail.com / empleado@gmail.com con clave `1`; sin proveedores ni compras; bikestore NO genera imágenes con IA (usa biblioteca fija por categoría, imagen subida como base64).

**Fases:** 0 base limpia y esquema · 1 cimientos (capas, permisos por catálogo, seguridad, pruebas, CI) · 2 catálogo e imágenes R2 · 3 compra segura · 4 pagos (manual + Wompi pruebas) · 5 proveedores/compras/kárdex/margen · 6 reseñas, deseos, taller, notificaciones, chat IA con escalamiento · 7 frontend rediseño · 8 despliegue Caddy · 9 legal/DIAN.

**Diseño acordado (2026-11-17, tras correr los 3 proyectos y vistos sus paneles):** tienda pública al estilo de `bikestore` (fotos, filtros por tipo y precio, insignias, favoritos, modo oscuro); panel admin con la barra lateral y tablero de `bikestore` + catálogo de permisos de `store_beauty`; `usuarios` (personal, roles por permisos) separado de `clientes` (compradores, invitado permitido); imagen de muestra = SVG generado con el nombre del producto (como store_beauty) cuando no hay foto.
**Benchmark de 7 tiendas (solo portadas, 2026-11-17):** bikehouse.co, bicistore.com.co, bikestorecolombia.com, bikestore.com.co, proelitebikestore.com, rocabikestore.co y quest.com.co repiten: botón flotante de WhatsApp, barra superior con envío gratis desde un monto, insignias de descuento y precio tachado, financiación (Addi/Sistecrédito), boletín con casilla de aceptación, aviso de cookies con «Rechazar», páginas de garantías/reembolso/términos, mapa de tienda física. Falta en los 3 proyectos: VARIANTES de producto (talla/color con stock propio).

**Fase 0 escrita (2026-11-18):** `E-COMMERCE/bikeshop/docs/FASE_0_DISENO.md` (arquitectura, esquema, permisos, flujos, gestor de contenido, diseño, despliegue, plan por fases). Dirección de diseño A aprobada. Pendiente: su revisión del documento y respuestas a la sección 14 antes de empezar la Fase 1. En BikeOnline viejo los banners (título, descripción, imagen, vigencia, estado) y `negocio` (alimenta el footer) ya eran editables; la versión nueva los amplía (enlace, imagen móvil, orden, anuncios, portada, páginas, horarios, WhatsApp) y guarda imágenes en R2. Confirmado: tiene tienda física y taller; chat → WhatsApp con wa.me.

**Fase 0 APROBADA (2026-11-18).** Cambios al aprobar: varias sucursales y bodegas escalables (`ubicaciones`, inventario por ubicación, traslados, alcance por sede), taller solo agenda citas (sin precios), cupones en Fase 4, envío por ciudad/departamento, reseñas verificadas y aprobadas, COP. Daniel hace TODO el Git y el despliegue. Registrado en `DEVOPS/CLAUDE.md` y `.claude/rules/bikeshop.md`. Siguiente: Fase 1 (cimientos); verificar con MySQL temporal en Docker (3390), sin tocar su MySQL de 3306.

**FASE 1 COMPLETA (2026-11-18):** tramos 1 a 4 hechos y verificados en `E-COMMERCE/bikeshop` (esquema 61 tablas con tipos generados del SQL, auth staff/cliente con audiencias y CSRF, usuarios y roles, auditoría, Docker, CI, despliegue y frontend provisional). Detalle y secrets en `.claude/rules/bikeshop.md`. Pendiente de Daniel: primer despliegue (guía `docs/DESPLIEGUE.md`) y su Git. Siguiente: Fase 2 (catálogo con variantes e imágenes en R2). Daniel decidió: contraseña mínima 6 (`CLAVE_MINIMA`), `JWT_SECRET_MINIMO` 10, y dejar su `.env.example` con sus valores (ojo: se versiona).

**FASE 2 COMPLETA (2026-11-18):** catálogo en `E-COMMERCE/bikeshop` (categorías en árbol, marcas, colores, productos en borrador→publicado con variantes talla/color, imágenes WebP en 4 tamaños con driver local/R2, catálogo público `/api/catalogo` con filtros, ficha, sugerencias y SVG de muestra). Daniel decidió: **el despliegue se hace al FINAL de todo el aplicativo**, no por fases. Siguiente: Fase 3 (inventario, kárdex, traslados, proveedores, compras). Detalle en `.claude/rules/bikeshop.md`.

**FASE 3 COMPLETA (2026-11-18):** inventario por ubicación con kárdex (`moverStock` es la única puerta para cambiar stock), ubicaciones y alcance por sede, proveedores, compras (recibir sube stock y recalcula costo promedio ponderado), traslados y disponibilidad pública. Siguiente: Fase 4 (carrito, pedidos con precios del servidor, envío por ciudad, cupones/ofertas, reserva de stock). Detalle en `.claude/rules/bikeshop.md`.

**FASE 4 COMPLETA (2026-11-18):** compra segura en `E-COMMERCE/bikeshop`: precios como funciones puras (IVA incluido, ofertas que no se acumulan, cupones, envío por ciudad/departamento), cotización única del servidor (el navegador solo manda variante y cantidad), pedidos de invitado y cliente con reserva de stock bloqueada (sin sobreventa), expiración de reservas, cancelaciones, estados desde el panel y factura interna. `confirmarPago` existe pero sin ruta: la usa la Fase 5. Siguiente: Fase 5 (pagos manuales con comprobante + Wompi sandbox). Detalle en `.claude/rules/bikeshop.md`.

**Why:** Daniel pidió auditoría y luego plan; el trabajo es grande y se retoma en varios chats.
**How to apply:** antes de tocar código, leer esta nota y la regla `bikeonline-shop.md`; no empezar una fase sin su visto bueno; Git es solo de él; no leer .env ni archivos con claves.
