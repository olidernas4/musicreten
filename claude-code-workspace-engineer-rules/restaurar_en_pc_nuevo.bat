@echo off
rem Responsabilidad: copiar este respaldo a sus rutas de trabajo en un PC nuevo (o recien formateado).
rem Asume %USERPROFILE%\.claude\ y D:\DESARROLLO_WEB\DEVOPS\. No borra nada del PC: solo copia y sobrescribe.
rem Si cambia la letra de unidad D:, edita solo la linea DEVOPS de abajo (y lee README_MIGRACION.md).

set "DEVOPS=D:\DESARROLLO_WEB\DEVOPS"
set "CLAUDE_USUARIO=%USERPROFILE%\.claude"
set "RESPALDO=%~dp0"
set "MEMORIA=%CLAUDE_USUARIO%\projects\D--DESARROLLO-WEB-DEVOPS\memory"

echo.
echo === Restaurando desde %RESPALDO% ===
echo Capa personal  : %CLAUDE_USUARIO%
echo Espacio trabajo: %DEVOPS%
echo.
echo Si ya existe configuracion en este PC, se sobrescribira con la del respaldo.
set /p CONFIRMA=Escribe S y Enter para continuar:
if /i not "%CONFIRMA%"=="S" (
  echo Cancelado. No se copio nada.
  pause
  exit /b 1
)

if not exist "%RESPALDO%usuario_claude\CLAUDE.md" (
  echo ERROR: este .bat debe estar junto a las carpetas usuario_claude y devops_claude.
  pause
  exit /b 1
)

if not exist "%CLAUDE_USUARIO%" mkdir "%CLAUDE_USUARIO%"
if not exist "%DEVOPS%\.claude" mkdir "%DEVOPS%\.claude"

rem --- Capa personal ---
robocopy "%RESPALDO%usuario_claude" "%CLAUDE_USUARIO%" CLAUDE.md settings.json /NJH /NJS /NDL /NP
robocopy "%RESPALDO%usuario_claude\skills" "%CLAUDE_USUARIO%\skills" /E /NJH /NJS /NDL /NP
robocopy "%RESPALDO%usuario_claude\memory" "%MEMORIA%" /E /NJH /NJS /NDL /NP

rem --- Capa del espacio de trabajo ---
robocopy "%RESPALDO%devops_claude" "%DEVOPS%" CLAUDE.md /NJH /NJS /NDL /NP
robocopy "%RESPALDO%devops_claude\.claude" "%DEVOPS%\.claude" settings.json launch.json /NJH /NJS /NDL /NP
robocopy "%RESPALDO%devops_claude\.claude\rules" "%DEVOPS%\.claude\rules" /E /NJH /NJS /NDL /NP

echo.
echo Listo. Revisa arriba que no aparezca ninguna linea con "ERROR".
echo Siguiente: abre Claude, reconecta los conectores y lee README_MIGRACION.md.
pause
