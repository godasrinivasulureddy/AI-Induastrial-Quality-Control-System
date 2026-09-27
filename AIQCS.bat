@echo off
title AIQCS Launcher
echo ==================================================
echo AI Quality Control System Launcher
echo ==================================================
echo.

echo [1/2] Starting Backend Server (FastAPI)...
start "AIQCS Backend" cmd /k "cd /d "%~dp0backend" && call .venv\Scripts\activate.bat && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Starting Frontend Server (React)...
start "AIQCS Frontend" cmd /k "cd /d "%~dp0frontend" && npm.cmd run dev"

echo.
echo Launch commands sent successfully!
echo.
echo - Backend API will be at: http://127.0.0.1:8000
echo - Frontend UI will be at:  http://localhost:5173
echo.
echo You can safely close this launcher window.
echo The servers are running in their respective new terminal windows.
pause
