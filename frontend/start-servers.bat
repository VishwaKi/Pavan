@echo off
echo ========================================
echo   AI Chat Assistant - Startup Script
echo ========================================
echo.

echo Starting Backend Server...
echo.
start cmd /k "cd /d "%~dp0.." && echo Starting FastAPI Backend... && python app1.py"

timeout /t 3 /nobreak >nul

echo Starting Frontend Server...
echo.
start cmd /k "cd /d "%~dp0" && echo Starting Next.js Frontend... && npm run dev"

echo.
echo ========================================
echo   Both servers are starting!
echo ========================================
echo.
echo Backend:  http://localhost:8003
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit this window...
echo (The servers will continue running)
pause >nul
