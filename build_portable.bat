@echo off
title CENTENARYO Portable Build Automator
echo ===================================================
echo     🇵🇭 CENTENARYO PORTABLE BUILD AUTOMATOR          
echo ===================================================
echo.

:: 1. Build Next.js Static Export
echo [1/3] Gumagawa ng optimized static frontend export...
cd frontend
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Nabigo ang Next.js build!
    pause
    exit /b %ERRORLEVEL%
)
cd ..

:: 2. Terminate any running CENTENARYO process to avoid file locks
echo.
echo [2/3] Nililinis ang mga background processes at previous builds...
taskkill /F /IM CENTENARYO.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
if exist "dist\CENTENARYO" (
    powershell -Command "Remove-Item -Recurse -Force dist\CENTENARYO"
)

:: 3. Compile with PyInstaller
echo.
echo [3/3] Kinokompile ang buong system gamit ang PyInstaller...
call backend\venv\Scripts\pyinstaller.exe -y --name="CENTENARYO" --onedir --collect-all rest_framework --collect-all rest_framework_simplejwt --collect-all corsheaders --collect-all whitenoise --add-data "backend;backend" --add-data "frontend\out;frontend\out" app_launcher.py
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Nabigo ang PyInstaller compilation!
    pause
    exit /b %ERRORLEVEL%
)

:: 4. Clean up unnecessary virtual environment files inside the portable folder
echo.
echo [CLEANUP] Tinatanggal ang mga hindi kailangang files sa portable app...
if exist "dist\CENTENARYO\_internal\backend\venv" (
    powershell -Command "Remove-Item -Recurse -Force dist\CENTENARYO\_internal\backend\venv"
)

echo.
echo ===================================================
echo     ✅ MATAGUMPAY NA NA-UPDATE ANG PORTABLE APP!   
echo ===================================================
echo Ang iyong optimized portable application ay handa na sa:
echo 👉 D:\codes\cen4\dist\CENTENARYO
echo.
echo Kopyahin lamang ang CENTENARYO folder papunta sa USB!
echo ===================================================
pause
