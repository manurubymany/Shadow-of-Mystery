@echo off
title Shadow Of Mystery Server
cd /d "%~dp0"
echo Iniciando o servidor... Acesse http://localhost:3000
start /b cmd /c "timeout /t 3 >nul & start http://localhost:3000"
npm start
pause