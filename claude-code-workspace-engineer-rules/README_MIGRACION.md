# Migración de Claude Code a un PC nuevo

Esta carpeta es el respaldo de la configuración de Claude Code (reglas, memoria, skills y ajustes). No contiene `.env`, llaves ni contraseñas.

## Qué hay aquí
| Carpeta o archivo | Se restaura en |
|---|---|
| `usuario_claude\CLAUDE.md`, `settings.json` | `%USERPROFILE%\.claude\` |
| `usuario_claude\skills\` | `%USERPROFILE%\.claude\skills\` |
| `usuario_claude\memory\` | `%USERPROFILE%\.claude\projects\D--DESARROLLO-WEB-DEVOPS\memory\` |
| `devops_claude\CLAUDE.md` | `D:\DESARROLLO_WEB\DEVOPS\CLAUDE.md` |
| `devops_claude\.claude\` (`rules\`, `settings.json`, `launch.json`) | `D:\DESARROLLO_WEB\DEVOPS\.claude\` |
| `actualizar_respaldo.bat` | Copia la configuración de ESTE PC hacia esta carpeta |
| `restaurar_en_pc_nuevo.bat` | Copia esta carpeta hacia las rutas de arriba |

## Antes de formatear
1. Ejecuta `actualizar_respaldo.bat` (doble clic) y revisa que no salga ninguna línea con «ERROR».
2. Sube la carpeta completa a Google Drive.

## En el PC nuevo, en este orden
1. Instala Claude (app de escritorio) e inicia sesión.
2. Crea la carpeta `D:\DESARROLLO_WEB\DEVOPS\` y copia ahí tus proyectos (clonados desde GitHub). Las reglas no dependen de ellos para cargarse, pero `launch.json` y los `paths` sí usan esa ruta.
3. Baja esta carpeta de Google Drive.
4. Ejecuta `restaurar_en_pc_nuevo.bat`, escribe `S` y Enter. Solo copia y sobrescribe; no borra nada.
5. Abre Claude en `D:\DESARROLLO_WEB\DEVOPS`: debe cargar solo el `CLAUDE.md` y las reglas.

## Reconectar los MCP (conectores)
Los conectores y sus sesiones NO viajan en este respaldo; se reconectan desde la app:
1. Abre Claude → Configuración → Conectores.
2. Conecta de nuevo los que uses y autoriza cada uno.
3. Por defecto deja activos solo los de la app (navegador integrado y terminal). Activa Chrome, Documentos, Artefactos y los demás solo cuando los necesites, para ahorrar cuota.

## Si cambia la letra de unidad `D:`
1. Edita la línea `set "DEVOPS=D:\DESARROLLO_WEB\DEVOPS"` en los dos `.bat`.
2. En `devops_claude\.claude\launch.json` reemplaza `D:/DESARROLLO_WEB/DEVOPS` por la nueva ruta (con barras `/`).
3. La memoria vive en una carpeta cuyo nombre sale de la ruta (`D--DESARROLLO-WEB-DEVOPS`). Si la ruta cambia, abre Claude una vez en la nueva carpeta de trabajo, mira qué carpeta nueva aparece en `%USERPROFILE%\.claude\projects\` y copia ahí el contenido de `usuario_claude\memory\`. Cambia también `MEMORIA` en el `.bat`.
4. Revisa en `DEVOPS\CLAUDE.md` y en las reglas las rutas escritas con `D:\`.

## Lo que este respaldo NO incluye (guárdalo aparte y cifrado)
- Archivos `.env`, llaves SSH y contraseñas. Los secrets de despliegue viven en GitHub.
- El hook de tipos de bikeshop: `E-COMMERCE\bikeshop\.claude\settings.local.json` está ignorado por Git y no forma parte de este respaldo. Si lo quieres, copia ese archivo aparte.
- El historial de chats y la caché.
