# Checks Python, Node, the virtualenv, browser pose model, then starts the app.
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
$Host.UI.RawUI.WindowTitle = "HEMA Motion Coach"
try { chcp 65001 > $null } catch {}
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Say($text) { Write-Host $text }

function Stop-Launcher([string]$message) {
    Say ""
    Say $message
    exit 1
}

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($machine -or $user) { $env:Path = "$machine;$user" }
    $extra = @(
        "$env:LocalAppData\Programs\Python\Python312",
        "$env:LocalAppData\Programs\Python\Python312\Scripts",
        "$env:ProgramFiles\nodejs"
    )
    $env:Path = (($extra + $env:Path.Split(";")) | Where-Object { $_ } | Select-Object -Unique) -join ";"
}

function Find-PythonExecutable {
    $attempts = @(
        @{ Name = "py"; Args = @("-3.12") },
        @{ Name = "py"; Args = @("-3.11") },
        @{ Name = "py"; Args = @("-3.10") },
        @{ Name = "python"; Args = @() }
    )
    foreach ($attempt in $attempts) {
        if (-not (Get-Command $attempt.Name -ErrorAction SilentlyContinue)) { continue }
        try {
            $exe = & $attempt.Name @($attempt.Args) -c "import sys; print(sys.executable)" 2>$null
            if ($LASTEXITCODE -eq 0 -and $exe) { return $exe.Trim() }
        } catch { }
    }
    $fallback = "$env:LocalAppData\Programs\Python\Python312\python.exe"
    if (Test-Path -LiteralPath $fallback) { return $fallback }
    return $null
}

function Install-WithWinget($id, $label) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Stop-Launcher "$label не найден, и winget тоже нет. Установите $label вручную и запустите start.bat ещё раз."
    }
    Say "Ставлю $label через winget..."
    & winget install -e --id $id --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { Stop-Launcher "winget не смог поставить $label." }
    Refresh-Path
}

function Test-Listening([int]$port) {
    $lines = netstat -ano | Select-String -Pattern ":$port\s"
    return [bool]($lines | Select-String -Pattern "LISTENING")
}

function Test-OurApi {
    try {
        $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8000/api/v1/health" -TimeoutSec 2
        return $response.Content -match '"status"\s*:\s*"ok"'
    } catch {
        return $false
    }
}

function Test-OurWeb {
    try {
        $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:5173/" -TimeoutSec 2
        return $response.Content -match "HEMA Motion Coach"
    } catch {
        return $false
    }
}

function Wait-Http($url, [int]$seconds) {
    for ($i = 0; $i -lt $seconds; $i++) {
        try {
            Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 2 | Out-Null
            return $true
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    return $false
}

Refresh-Path
Say ""
Say "HEMA Motion Coach — проверка и запуск"
Say ""

$python = Find-PythonExecutable
if (-not $python) {
    Install-WithWinget "Python.Python.3.12" "Python 3.12"
    $python = Find-PythonExecutable
}
if (-not $python) { Stop-Launcher "Python не найден. Нужен Python 3.12: https://www.python.org/downloads/" }
Say "Python: $python"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js LTS"
    $node = Get-Command node -ErrorAction SilentlyContinue
}
if (-not $node) { Stop-Launcher "Node.js не найден. Нужен Node.js 18 или новее: https://nodejs.org" }
$nodeMajor = [int]((& node -p "process.versions.node.split('.')[0]"))
if ($nodeMajor -lt 18) { Stop-Launcher "Node.js слишком старый ($nodeMajor). Нужна версия 18 или новее." }
Say "Node: $($node.Source)"

$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $venvPython)) {
    Say "Создаю окружение Python..."
    & $python -m venv (Join-Path $PSScriptRoot ".venv")
    if ($LASTEXITCODE -ne 0) { Stop-Launcher "Не удалось создать .venv" }
}

$pyVersion = & $venvPython -c "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')"
if ($LASTEXITCODE -ne 0) { Stop-Launcher "Окружение .venv не запускается." }
$pyParts = $pyVersion.Trim().Split(".")
if ([int]$pyParts[0] -lt 3 -or ([int]$pyParts[0] -eq 3 -and [int]$pyParts[1] -lt 9)) {
    Stop-Launcher "Нужен Python 3.9 или новее. В .venv сейчас $pyVersion."
}

$requirements = Join-Path $env:TEMP "hema-requirements.txt"
$sourceRequirements = Join-Path $PSScriptRoot "backend\requirements.txt"
if ([int]$pyParts[1] -ge 13) {
    Say "Python ${pyVersion}: MediaPipe для серверного разбора видео недоступен. Живая тренировка в браузере будет работать."
    Get-Content -LiteralPath $sourceRequirements | Where-Object { $_ -notmatch "mediapipe" } | Set-Content -LiteralPath $requirements -Encoding ascii
} else {
    Copy-Item -LiteralPath $sourceRequirements -Destination $requirements -Force
}

$stamp = Join-Path $PSScriptRoot ".venv\installed-requirements.txt"
$needInstall = -not (Test-Path -LiteralPath $stamp)
if (-not $needInstall) {
    $needInstall = (Get-FileHash $stamp).Hash -ne (Get-FileHash $requirements).Hash
}
if ($needInstall) {
    Say "Ставлю библиотеки Python..."
    & $venvPython -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) { Stop-Launcher "pip не обновился." }
    & $venvPython -m pip install -r $requirements
    if ($LASTEXITCODE -ne 0) { Stop-Launcher "Не удалось поставить библиотеки Python." }
    Copy-Item -LiteralPath $requirements -Destination $stamp -Force
} else {
    Say "Библиотеки Python уже стоят."
}

$vite = Join-Path $PSScriptRoot "frontend\node_modules\vite\package.json"
$mediapipe = Join-Path $PSScriptRoot "frontend\node_modules\@mediapipe\tasks-vision\package.json"
if (-not (Test-Path -LiteralPath $vite) -or -not (Test-Path -LiteralPath $mediapipe)) {
    Say "Ставлю библиотеки интерфейса..."
    Push-Location (Join-Path $PSScriptRoot "frontend")
    try {
        & npm install
        if ($LASTEXITCODE -ne 0) { Stop-Launcher "npm install не удался." }
    } finally {
        Pop-Location
    }
} else {
    Say "Библиотеки интерфейса уже стоят."
}

Say "Проверяю модель позы для браузера..."
Push-Location (Join-Path $PSScriptRoot "frontend")
try {
    & node .\scripts\prepare-live.mjs
    if ($LASTEXITCODE -ne 0) { Stop-Launcher "Не удалось подготовить модель позы. Для первой загрузки нужен интернет." }
} finally {
    Pop-Location
}

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Say "ffmpeg не найден. Живая тренировка работает. Перекодирование загруженного видео заработает, когда ffmpeg появится в PATH."
}

$skipApi = $false
$skipWeb = $false
if (Test-Listening 8000) {
    if (Test-OurApi) {
        Say "API уже запущен."
        $skipApi = $true
    } else {
        Stop-Launcher "Порт 8000 занят другим приложением. Освободите его и запустите start.bat ещё раз."
    }
}
if (Test-Listening 5173) {
    if (Test-OurWeb) {
        Say "Интерфейс уже запущен."
        $skipWeb = $true
    } else {
        Stop-Launcher "Порт 5173 занят другим приложением. Освободите его и запустите start.bat ещё раз."
    }
}

if (-not $skipApi) {
    Say "Запускаю API на порту 8000..."
    Start-Process -FilePath $venvPython -ArgumentList @(
        "-m", "uvicorn", "app.main:app",
        "--app-dir", (Join-Path $PSScriptRoot "backend"),
        "--host", "127.0.0.1",
        "--port", "8000"
    ) -WorkingDirectory $PSScriptRoot -WindowStyle Normal
}

if (-not $skipWeb) {
    Say "Запускаю интерфейс на порту 5173..."
    $npm = (Get-Command npm).Source
    Start-Process -FilePath $npm -ArgumentList @("run", "dev") -WorkingDirectory (Join-Path $PSScriptRoot "frontend") -WindowStyle Normal
    if (-not (Wait-Http "http://127.0.0.1:5173/" 90)) {
        Stop-Launcher "Интерфейс не ответил на порту 5173. Смотрите окно, где запущен npm."
    }
}

Start-Process "http://127.0.0.1:5173/"
Say ""
Say "Приложение открыто: http://127.0.0.1:5173/"
Say "Окна с API и интерфейсом не закрывайте — в них работает программа."
Start-Sleep -Seconds 4
exit 0
