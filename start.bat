@echo off
chcp 65001 >nul
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" launcher.py
  goto :done
)

where py >nul 2>&1
if not errorlevel 1 (
  py -3.12 -c "import sys" >nul 2>&1
  if not errorlevel 1 (
    py -3.12 launcher.py
    goto :done
  )
  py -3 launcher.py
  goto :done
)

where python >nul 2>&1
if not errorlevel 1 (
  python launcher.py
  goto :done
)

if exist "%LocalAppData%\Programs\Python\Python312\python.exe" (
  "%LocalAppData%\Programs\Python\Python312\python.exe" launcher.py
  goto :done
)

where winget >nul 2>&1
if errorlevel 1 (
  echo Python ne nayden i winget nedostupen.
  echo Ustanovite Python 3.12 i zapustite start.bat eshche raz.
  pause
  exit /b 1
)

echo Ustanavlivayu Python 3.12 cherez winget...
winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo Ne udalos ustanovit Python.
  pause
  exit /b 1
)

if exist "%LocalAppData%\Programs\Python\Python312\python.exe" (
  "%LocalAppData%\Programs\Python\Python312\python.exe" launcher.py
  goto :done
)

echo Python ustanovlen, no ne nayden v tekushchem PATH. Zapustite start.bat eshche raz.
pause
exit /b 1

:done
if errorlevel 1 pause
exit /b %ERRORLEVEL%
