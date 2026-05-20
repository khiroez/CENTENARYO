@echo off
title CENTENARYO Desktop Shell Launcher
echo ===================================================
echo             🏛️ CENTENARYO DESKTOP LAUNCHER          
echo ===================================================
echo.

:: Detect if Electron is installed in the desktop app container
if not exist "desktop\node_modules" (
    echo [System Info] First-time setup detected. Installing native desktop frame requirements...
    cd desktop
    call npm install
    cd ..
    echo [System Info] Desktop requirements installed successfully!
    echo.
)

:: Clear existing listening processes on Port 3000 (Next.js) and Port 8000 (Django)
echo [System Info] Ensuring local ports 3000 and 8000 are clean...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Cleaning up orphaned Next.js process %%a...
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Cleaning up orphaned Django process %%a...
    taskkill /f /pid %%a >nul 2>&1
)
echo [System Info] Clean-up complete! Ports are ready.
echo.

echo Starting CENTENARYO Desktop Application...
echo Background servers are initiating silently.
echo Please keep this launcher open while using the application.
echo.

:: Run the desktop app shell
cd desktop
call npm start
cd ..

echo.
echo ===================================================
echo Desktop application shell closed successfully.
echo Internal background processes cleaned up and freed!
echo ===================================================
echo.
pause
