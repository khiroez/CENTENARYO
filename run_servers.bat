@echo off
title CENTENARYO Launcher
echo ===================================================
echo             🇵🇭 STARTING CENTENARYO SYSTEM          
echo ===================================================
echo.

:: Launch Django Backend in a new command window
echo Launching Django Server serving both API & Frontend (http://127.0.0.1:8000)...
start "CENTENARYO Server" cmd /k "cd backend && call venv\Scripts\activate.bat && python manage.py runserver --noreload"

echo.
echo ===================================================
echo CENTENARYO Server has been launched!
echo - Web App & API: http://127.0.0.1:8000
echo.
echo Press any key to exit this launcher...
echo ===================================================
pause >nul
