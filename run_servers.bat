@echo off
title CENTENARYO Launcher
echo ===================================================
echo             🇵🇭 STARTING CENTENARYO SYSTEM          
echo ===================================================
echo.

:: Launch Django Backend in a new command window
echo [1/2] Launching Django Backend Server (http://127.0.0.1:8000)...
start "CENTENARYO Backend" cmd /k "cd backend && call venv\Scripts\activate.bat && python manage.py runserver --noreload"

:: Give the backend a brief moment to initialize
timeout /t 2 /nobreak >nul

:: Launch Next.js Frontend in another new command window
echo [2/2] Launching Next.js Frontend Server (http://localhost:3000)...
start "CENTENARYO Frontend" cmd /k "cd frontend && npm run start"

echo.
echo ===================================================
echo Both servers have been launched in separate windows!
echo - Django Backend: http://127.0.0.1:8000
echo - Next.js Frontend: http://localhost:3000
echo.
echo Press any key to exit this launcher...
echo ===================================================
pause >nul
