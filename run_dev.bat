@echo off
title CENTENARYO (Live Development Mode)
echo ===================================================
echo      🇵🇭 CENTENARYO: LIVE DEVELOPMENT MODE
echo ===================================================
echo.

echo [1/2] Starting Django API Backend with Auto-Reload (http://127.0.0.1:8000)...
start "CENTENARYO Backend (API)" cmd /k "cd backend && call venv\Scripts\activate.bat && python manage.py runserver"

echo [2/2] Starting Next.js Frontend with Fast Refresh (http://localhost:3000)...
start "CENTENARYO Frontend (Live)" cmd /k "cd frontend && npm.cmd run dev"

echo.
echo ===================================================
echo Both servers have been launched in separate windows!
echo - Web App (Live Changes): http://localhost:3000
echo - Django REST API:        http://127.0.0.1:8000/api
echo.
echo Any changes you save in code will reflect instantly.
echo ===================================================
timeout /t 3 >nul
start http://localhost:3000
