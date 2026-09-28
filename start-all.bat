@echo off
title WaOutreach Launcher
color 0B

echo ========================================================
echo           WaOutreach Application Launcher
echo ========================================================
echo.
echo [1/3] Starting Backend Server...
start "WaOutreach Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
echo       Backend process initiated in a dedicated window.
echo.

echo Waiting 3 seconds for backend initialization...
timeout /t 3 /nobreak >nul
echo.

echo [2/3] Starting Frontend Dashboard...
start "WaOutreach Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo       Frontend process initiated in a dedicated window.
echo.

echo Waiting 2 seconds for Vite development server...
timeout /t 2 /nobreak >nul
echo.

echo [3/3] Launching web browser...
start http://localhost:5173
echo       Browser directed to http://localhost:5173
echo.

echo ========================================================
echo   Services are running in separate terminal windows:
echo     * Backend API:       http://localhost:5000
echo     * Frontend Client:   http://localhost:5173
echo.
echo   Press any key to close this launcher window.
echo   (Note: Backend and Frontend windows will remain open)
echo ========================================================
echo.
pause
