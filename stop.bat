@echo off
chcp 65001 >nul
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" launcher.py --stop
  exit /b %ERRORLEVEL%
)

where py >nul 2>&1
if not errorlevel 1 (
  py -3 launcher.py --stop
  exit /b %ERRORLEVEL%
)

where python >nul 2>&1
if not errorlevel 1 (
  python launcher.py --stop
  exit /b %ERRORLEVEL%
)

echo Python ne nayden. Ne mogu prochitat PID-fayly.
pause
exit /b 1
