@echo off
title CENTENARYO - New PC Setup Wizard
echo ===================================================
echo         🇵🇭 CENTENARYO - NEW PC SETUP WIZARD         
echo ===================================================
echo.
echo Ang utility na ito ay awtomatikong mag-se-setup ng system sa computer na ito.
echo Siguraduhing naka-install na ang Node.js at Python sa PC na ito bago magpatuloy.
echo.
pause

echo.
echo [1/3] Inihahanda ang Python Backend Environment...
cd backend
if exist "venv" (
    echo Mayroon nang umiiral na Virtual Environment. Inilalagay ang packages...
) else (
    echo Gumagawa ng bagong Python Virtual Environment...
    python -m venv venv
)
echo Nag-i-install ng Backend Python Dependencies (pip)...
call venv\Scripts\python.exe -m pip install --upgrade pip
call venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..

echo.
echo [2/3] Inihahanda ang Frontend Node Environment...
cd frontend
echo Nag-i-install ng Frontend Node Packages (npm)...
call npm install
cd ..

echo.
echo [3/3] Kinu-compile ang Native Desktop Launcher...
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe /out:CENTENARYO.exe Launcher.cs

echo.
echo ===================================================
echo 🎉 HAWAK MO NA ANG KONTROL! HANDANG-HANDA NA ANG PC NA ITO!
echo ===================================================
echo Maaari mo nang patakbuhin ang application sa pamamagitan ng:
echo    Double-click sa: CENTENARYO.exe sa root directory!
echo ===================================================
echo.
pause
