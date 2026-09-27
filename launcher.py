from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / ".runtime"
FRONTEND = ROOT / "frontend"
BACKEND = ROOT / "backend"
API_URL = "http://127.0.0.1:8000/api/v1/health"
WEB_URL = "http://127.0.0.1:5173/"


def say(message: str = "") -> None:
    print(message, flush=True)


def fail(message: str):
    say()
    say(message)
    raise SystemExit(1)


def run(command: list[str], *, cwd: Path | None = None) -> None:
    result = subprocess.run(command, cwd=cwd or ROOT)
    if result.returncode != 0:
        fail(f"Команда завершилась с ошибкой ({result.returncode}): {' '.join(command)}")


def find_node() -> Path | None:
    found = shutil.which("node")
    if found:
        return Path(found)
    candidates = [
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "nodejs" / "node.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "nodejs" / "node.exe",
    ]
    return next((path for path in candidates if path.exists()), None)


def install_node() -> Path:
    winget = shutil.which("winget")
    if not winget:
        fail("Node.js не найден, и winget тоже нет. Установите Node.js LTS и запустите start.bat снова.")
    say("Ставлю Node.js LTS через winget...")
    run([winget, "install", "-e", "--id", "OpenJS.NodeJS.LTS", "--accept-package-agreements", "--accept-source-agreements"])
    node = find_node()
    if not node:
        fail("Node.js установлен, но node.exe не найден. Перезапустите start.bat.")
    return node


def npm_cli(node: Path) -> Path | None:
    candidate = node.parent / "node_modules" / "npm" / "bin" / "npm-cli.js"
    return candidate if candidate.exists() else None


def http_ok(url: str, contains: str | None = None, timeout: float = 2.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.status < 400 and (contains is None or contains in body)
    except Exception:
        return False


def port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.25)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def wait_http(url: str, seconds: int, contains: str | None = None) -> bool:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if http_ok(url, contains=contains):
            return True
        time.sleep(0.5)
    return False


def hidden_flags() -> int:
    if os.name != "nt":
        return 0
    return getattr(subprocess, "CREATE_NO_WINDOW", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)


def launch_hidden(command: list[str], *, cwd: Path, log_name: str, pid_name: str) -> subprocess.Popen:
    RUNTIME.mkdir(parents=True, exist_ok=True)
    log_path = RUNTIME / log_name
    log = open(log_path, "ab", buffering=0)
    process = subprocess.Popen(
        command,
        cwd=cwd,
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        creationflags=hidden_flags(),
        close_fds=True,
    )
    log.close()
    (RUNTIME / pid_name).write_text(str(process.pid), encoding="ascii")
    return process


def log_tail(name: str, max_bytes: int = 5000) -> str:
    path = RUNTIME / name
    if not path.exists():
        return ""
    data = path.read_bytes()
    return data[-max_bytes:].decode("utf-8", errors="replace")


def stop_pid_file(name: str, label: str) -> None:
    path = RUNTIME / name
    if not path.exists():
        return
    try:
        pid = int(path.read_text(encoding="ascii").strip())
    except Exception:
        path.unlink(missing_ok=True)
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    else:
        try:
            os.kill(pid, 15)
        except ProcessLookupError:
            pass
    path.unlink(missing_ok=True)
    say(f"Остановлен {label}.")


def stop_all() -> None:
    stop_pid_file("web.pid", "интерфейс")
    stop_pid_file("api.pid", "API")
    say("HEMA Motion Coach остановлен.")


def open_app_page() -> None:
    """Open the app in the default browser using the OS URL handler."""
    try:
        if os.name == "nt":
            os.startfile(WEB_URL)  # type: ignore[attr-defined]
            return
        import webbrowser
        if webbrowser.open(WEB_URL, new=2):
            return
    except Exception as exc:
        fail(f"Не удалось автоматически открыть страницу {WEB_URL}: {exc}")
    fail(f"Не удалось автоматически открыть страницу {WEB_URL}.")


def ensure_python_env() -> Path:
    if sys.version_info < (3, 9):
        fail(f"Нужен Python 3.9 или новее. Сейчас {sys.version.split()[0]}.")
    venv_python = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not venv_python.exists():
        say("Создаю окружение Python...")
        run([sys.executable, "-m", "venv", str(ROOT / ".venv")])
    if not venv_python.exists():
        fail("Не удалось создать .venv.")

    source = (BACKEND / "requirements.txt").read_text(encoding="utf-8")
    if sys.version_info >= (3, 13):
        say(f"Python {sys.version_info.major}.{sys.version_info.minor}: серверный MediaPipe пропускаю; live-режим в браузере работает.")
        lines = [line for line in source.splitlines() if not line.strip().lower().startswith("mediapipe")]
        requirements = "\n".join(lines) + "\n"
    else:
        requirements = source

    RUNTIME.mkdir(parents=True, exist_ok=True)
    generated = RUNTIME / "requirements-launcher.txt"
    generated.write_text(requirements, encoding="utf-8")
    digest = hashlib.sha256(requirements.encode("utf-8")).hexdigest()
    stamp = ROOT / ".venv" / "installed-requirements.sha256"
    if not stamp.exists() or stamp.read_text(encoding="ascii").strip() != digest:
        say("Ставлю/обновляю библиотеки Python...")
        run([str(venv_python), "-m", "pip", "install", "-r", str(generated)])
        stamp.write_text(digest, encoding="ascii")
    else:
        say("Python-библиотеки уже готовы.")
    return venv_python


def ensure_frontend(node: Path) -> None:
    version = subprocess.check_output([str(node), "-p", "process.versions.node"], text=True).strip()
    try:
        major = int(version.split(".", 1)[0])
    except ValueError:
        fail(f"Не удалось определить версию Node.js: {version}")
    if major < 18:
        fail(f"Node.js слишком старый ({version}). Нужна версия 18 или новее.")
    say(f"Node: {node} ({version})")

    vite = FRONTEND / "node_modules" / "vite" / "package.json"
    mediapipe = FRONTEND / "node_modules" / "@mediapipe" / "tasks-vision" / "package.json"
    if not vite.exists() or not mediapipe.exists():
        cli = npm_cli(node)
        if not cli:
            fail("npm-cli.js не найден рядом с Node.js. Переустановите Node.js LTS.")
        say("Ставлю библиотеки интерфейса...")
        run([str(node), str(cli), "install"], cwd=FRONTEND)
    else:
        say("Библиотеки интерфейса уже готовы.")

    say("Проверяю модель позы для браузера...")
    run([str(node), str(FRONTEND / "scripts" / "prepare-live.mjs")], cwd=FRONTEND)


def start_app(with_backend: bool = False) -> None:
    os.chdir(ROOT)
    say()
    say("HEMA Motion Coach — проверка и запуск")
    say()

    node = find_node() or install_node()
    ensure_frontend(node)

    api_started = False
    web_started = False
    if with_backend:
        venv_python = ensure_python_env()
        if port_open(8000):
            if not http_ok(API_URL, contains='"status":"ok"') and not http_ok(API_URL, contains='"status": "ok"'):
                fail("Порт 8000 занят другим приложением.")
            say("Legacy API уже запущен.")
        else:
            say("Запускаю legacy API скрыто...")
            launch_hidden(
                [str(venv_python), "-m", "uvicorn", "app.main:app", "--app-dir", str(BACKEND), "--host", "127.0.0.1", "--port", "8000"],
                cwd=ROOT,
                log_name="api.log",
                pid_name="api.pid",
            )
            api_started = True
    else:
        say("Browser-first режим: FastAPI не запускается.")

    if port_open(5173):
        if not http_ok(WEB_URL, contains="HEMA Motion Coach"):
            fail("Порт 5173 занят другим приложением.")
        say("Интерфейс уже запущен.")
    else:
        vite_js = FRONTEND / "node_modules" / "vite" / "bin" / "vite.js"
        if not vite_js.exists():
            fail("Vite не найден после установки зависимостей.")
        say("Запускаю интерфейс скрыто...")
        launch_hidden(
            [str(node), str(vite_js), "--host", "127.0.0.1", "--port", "5173"],
            cwd=FRONTEND,
            log_name="web.log",
            pid_name="web.pid",
        )
        web_started = True

    if api_started and not wait_http(API_URL, 30):
        stop_pid_file("api.pid", "API")
        fail("API не запустился. Последние строки .runtime/api.log:\n" + log_tail("api.log"))
    if web_started and not wait_http(WEB_URL, 60, contains="HEMA Motion Coach"):
        stop_pid_file("web.pid", "интерфейс")
        fail("Интерфейс не запустился. Последние строки .runtime/web.log:\n" + log_tail("web.log"))

    open_app_page()
    say()
    say(f"Приложение открыто: {WEB_URL}")
    if with_backend:
        say("Legacy API включён (--with-backend).")
    else:
        say("Видео, MediaPipe, DTW и comparison работают в браузере; API не запущен.")
    say("Для остановки используйте stop.bat.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stop", action="store_true")
    parser.add_argument("--with-backend", action="store_true", help="Start legacy FastAPI routes")
    args = parser.parse_args()
    if args.stop:
        stop_all()
    else:
        start_app(with_backend=args.with_backend)


if __name__ == "__main__":
    main()
