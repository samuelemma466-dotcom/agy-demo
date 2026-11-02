"""
Omachy Desktop — Native Linux Window Runner
Uses PyGObject + Gtk 3 + WebKit2 4.1 to open standalone native Wayland/X11 windows.
"""

import sys
import os
import argparse
import subprocess
import time
import urllib.request
from pathlib import Path

# Require GTK 3.0 and WebKit2 4.1
import gi
gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import Gtk, Gdk, WebKit2, GLib

PORT = 48123
SERVER_SCRIPT = Path(__file__).parent / "service.py"
ICON_PATH = Path(__file__).resolve().parent.parent / "public" / "omachy-icon.svg"

APP_CONFIGS = {
    "control-center": {
        "title": "Omachy Control Center",
        "width": 380,
        "height": 590,
        "app_id": "omachy-control-center",
        "resizable": True,
    },
    "connect": {
        "title": "Omachy Connect",
        "width": 480,
        "height": 620,
        "app_id": "omachy-connect",
        "resizable": True,
    },
    "drop": {
        "title": "Omachy Drop",
        "width": 480,
        "height": 580,
        "app_id": "omachy-drop",
        "resizable": True,
    },
    "jarvis": {
        "title": "Omachy Jarvis",
        "width": 520,
        "height": 680,
        "app_id": "omachy-jarvis",
        "resizable": True,
    },
    "developer": {
        "title": "Omachy Developer Tools",
        "width": 780,
        "height": 620,
        "app_id": "omachy-developer",
        "resizable": True,
    },
    "suite": {
        "title": "Omachy Desktop Suite",
        "width": 980,
        "height": 680,
        "app_id": "omachy-suite",
        "resizable": True,
    },
}


def is_service_running(port=PORT):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=0.8) as response:
            if response.status != 200:
                return False
            content_type = response.headers.get("Content-Type", "")
            body = response.read(4096)
            # Older Omachy daemons don't have /health and return the SPA shell
            # for unknown paths. Recognize that shell to avoid starting a second
            # daemon on its occupied port.
            if content_type.startswith("application/json"):
                return b'"ok": true' in body
            return content_type.startswith("text/html") and b"Omachy Desktop" in body
    except Exception:
        return False


def start_service_in_background(port=PORT):
    if is_service_running(port):
        return

    state_home = os.environ.get("XDG_STATE_HOME")
    state_dir = (Path(state_home) if state_home and os.path.isabs(state_home)
                 else Path.home() / ".local" / "state") / "omachy"
    state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    log_path = state_dir / "service.log"
    log_fd = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    os.chmod(log_path, 0o600)
    service_process = None
    with os.fdopen(log_fd, "ab", buffering=0) as service_log:
        service_process = subprocess.Popen(
            [sys.executable, str(SERVER_SCRIPT), str(port)],
            cwd=str(SERVER_SCRIPT.parent),
            stdin=subprocess.DEVNULL,
            stdout=service_log,
            stderr=subprocess.STDOUT,
            close_fds=True,
            start_new_session=True,
        )

    # The service is independent of either GTK window, so closing Connect
    # doesn't unexpectedly break Drop while it remains open.
    for _ in range(15):
        if is_service_running(port):
            return
        if service_process.poll() is not None:
            break
        time.sleep(0.1)
    raise RuntimeError(f"Omachy local service failed to start; see {log_path}")


class OmachyWindow(Gtk.Window):
    def __init__(self, app_name="suite", port=PORT):
        config = APP_CONFIGS.get(app_name, APP_CONFIGS["suite"])
        super().__init__(title=config["title"])

        self.set_default_size(config["width"], config["height"])
        self.set_resizable(config["resizable"])
        display = Gdk.Display.get_default()
        # WM_CLASS is an X11 concept and deprecated by GTK on Wayland. Keep
        # the existing class for X11 window matching without warning on Hyprland.
        if display and "wayland" not in display.get_name().lower():
            self.set_wmclass(config["app_id"], config["app_id"])
        self.set_role(config["app_id"])

        # Try to load icon
        if ICON_PATH.exists():
            try:
                self.set_icon_from_file(str(ICON_PATH))
            except Exception:
                pass

        # Create WebKit WebView
        self.webview = WebKit2.WebView()
        settings = self.webview.get_settings()
        settings.set_enable_developer_extras(False)
        settings.set_javascript_can_access_clipboard(True)

        # Set transparent or dark background to match design
        rgba = Gdk.RGBA()
        rgba.parse("#0a0d14")
        self.webview.set_background_color(rgba)

        # Scrolled window wrapper
        scrolled = Gtk.ScrolledWindow()
        scrolled.add(self.webview)
        self.add(scrolled)

        # Connect window close
        self.connect("destroy", Gtk.main_quit)

        # Load application view with ?app=<name> parameter
        target_url = f"http://127.0.0.1:{port}/?app={app_name}"
        self.webview.load_uri(target_url)


def main():
    parser = argparse.ArgumentParser(description="Omachy Linux Desktop App Runner")
    parser.add_argument(
        "--app",
        choices=["control-center", "connect", "drop", "jarvis", "developer", "suite"],
        default="suite",
        help="Omachy application to launch",
    )
    parser.add_argument("--port", type=int, default=PORT, help="Internal port")

    args = parser.parse_args()

    # Ensure internal service is running
    start_service_in_background(args.port)

    # Initialize Gtk window
    win = OmachyWindow(app_name=args.app, port=args.port)
    win.show_all()

    Gtk.main()


if __name__ == "__main__":
    main()
