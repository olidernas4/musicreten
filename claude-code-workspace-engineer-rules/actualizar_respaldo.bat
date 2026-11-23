@echo off
rem Responsabilidad: copiar la configuracion VIGENTE de Claude Code (de este PC) hacia esta carpeta de respaldo.
rem Se ejecuta ANTES de formatear o de subir la carpeta a Google Drive. No copia .env, llaves ni tokens.
rem Si cambia la letra de unidad D:, edita solo la linea DEVOPS de abajo.

set "DEVOPS=D:\DESARROLLO_WEB\DEVOPS"
set "CLAUDE_USUARIO=%USERPROFILE%\.claude"
set "RESPALDO=%~dp0"
set "MEMORIA=%CLAUDE_USUARIO%\projects\D--DESARROLLO-WEB-DEVOPS\memory"

echo.
echo === Actualizando respaldo en %RESPALDO% ===

if not exist "%CLAUDE_USUARIO%\CLAUDE.md" (
  echo ERROR: no encuentro %CLAUDE_USUARIO%\CLAUDE.md. Revisa la ruta y vuelve a intentar.
  pause
  exit /b 1
)
if not exist "%DEVOPS%\CLAUDE.md" (
  echo ERROR: no encuentro %DEVOPS%\CLAUDE.md. Revisa la letra de unidad en este .bat.
  pause
  exit /b 1
)

rem --- Capa personal (usuario_claude) ---
robocopy "%CLAUDE_USUARIO%" "%RESPALDO%usuario_claude" CLAUDE.md settings.json /NJH /NJS /NDL /NP
robocopy "%CLAUDE_USUARIO%\skills" "%RESPALDO%usuario_claude\skills" /MIR /NJH /NJS /NDL /NP
robocopy "%MEMORIA%" "%RESPALDO%usuario_claude\memory" /MIR /NJH /NJS /NDL /NP

rem --- Capa del espacio de trabajo (devops_claude) ---
robocopy "%DEVOPS%" "%RESPALDO%devops_claude" CLAUDE.md /NJH /NJS /NDL /NP
robocopy "%DEVOPS%\.claude" "%RESPALDO%devops_claude\.claude" settings.json launch.json /NJH /NJS /NDL /NP
robocopy "%DEVOPS%\.claude\rules" "%RESPALDO%devops_claude\.claude\rules" /MIR /NJH /NJS /NDL /NP

echo.
echo Listo. Revisa arriba que no aparezca ninguna linea con "ERROR".
echo Ahora puedes subir esta carpeta a Google Drive.
pause
