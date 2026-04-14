@echo off
echo.
echo  ========================================
echo   ServiRed O'Higgins - Sexta Region
echo  ========================================
echo.

where node >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Node.js no esta instalado.
    echo.
    echo  Por favor descarga e instala Node.js desde:
    echo  https://nodejs.org  (version LTS recomendada)
    echo.
    pause
    exit /b 1
)

echo  Instalando dependencias...
cd /d "%~dp0"
npm install

echo.
echo  Iniciando servidor...
echo  Abre tu navegador en: http://localhost:3000
echo.
start "" "http://localhost:3000"
node server.js
pause
