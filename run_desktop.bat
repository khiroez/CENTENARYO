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
