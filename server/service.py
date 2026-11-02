"""
Omachy Desktop — Local Loopback HTTP & API Service
Serves static assets from dist/ and provides REST endpoints for system controls.
"""

import sys
import os
import json
import mimetypes
import tempfile
import re
import subprocess
import threading
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import socketserver

from system_bridge import (
    collect_system_summary,
    ALLOWED_ACTIONS,
    set_audio_volume,
    toggle_audio_mute,
    set_bluetooth_power,
    set_wifi_radio,
    get_wifi_status,
    get_drop_files,
    open_drop_folder,
    run_allowed_action,
    DROP_DIR,
)
from phone_transfer import phone_sessions, AUTOSTART_PATH
from display_env import graphical_environment

DIST_DIR = Path(__file__).resolve().parent.parent / "dist"
PORT = 48123
AUTOCONNECT_WATCH_SECONDS = 10


def _autostart_enabled(address=None):
    try:
        config = json.loads(AUTOSTART_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return None
    if not isinstance(config, dict) or config.get("enabled") is not True:
        return None
    remembered = config.get("address")
    return remembered if isinstance(remembered, str) else None


def _remember_autostart(address):
    try:
        AUTOSTART_PATH.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        AUTOSTART_PATH.write_text(json.dumps({"enabled": True, "address": address}), encoding="utf-8")
        os.chmod(AUTOSTART_PATH, 0o600)
    except OSError:
        pass


def _forget_autostart():
    try:
        AUTOSTART_PATH.unlink(missing_ok=True)
    except OSError:
        pass


def _autoconnect_watch():
    """Keep an always-on Connect session alive while the remembered network is up."""
    while True:
        try:
            state = phone_sessions.state()
            remembered = _autostart_enabled()
            if remembered and not state.get("active"):
                options = phone_sessions.interfaces()
                match = next((item["address"] for item in options if item["address"] == remembered), None)
                if not match:
                    # The hotspot may have handed out a new address; follow the
                    # active Wi-Fi interface so the session stays available.
                    match = next((item["address"] for item in options if item.get("wireless")), None)
                    if match:
                        _remember_autostart(match)
                if match:
                    phone_sessions.start(match, persistent=True)
            elif state.get("active") and state.get("persistent") and state.get("address"):
                # The computer may have moved networks; a listener bound to a
                # vanished address is unusable, so restart on the saved one.
                current = {item["address"] for item in phone_sessions.interfaces()}
                if state["address"] not in current:
                    remembered = _autostart_enabled()
                    wireless = next(
                        (item["address"] for item in phone_sessions.interfaces() if item.get("wireless")),
                        None,
                    )
                    if remembered and wireless and remembered != wireless:
                        _remember_autostart(wireless)
                    phone_sessions.stop()
        except Exception:
            pass
        threading.Event().wait(AUTOCONNECT_WATCH_SECONDS)


MDNS_SERVICE_TYPE = "_omachy-connect._tcp"
MDNS_POLL_SECONDS = 5


def _mdns_txt(state):
    """TXT records let the phone verify it found the right desktop."""
    return [
        f"fp={state.get('fingerprint_sha256', '')}",
        "proto=1",
        f"host={os.uname().nodename}",
    ]


class _MDNSPublisher(threading.Thread):
    """Advertise the active Connect session so the phone can rediscover it.

    The listening port and hotspot address change whenever the desktop moves
    networks or restarts, so a saved address alone is not durable. Avahi is
    used because it is already the system mDNS responder on Omarchy.
    """

    def __init__(self):
        super().__init__(name="omachy-mdns", daemon=True)
        self._process = None
        self._published = None

    def _stop(self):
        if self._process is not None:
            try:
                self._process.terminate()
                self._process.wait(timeout=3)
            except (OSError, subprocess.TimeoutExpired):
                try:
                    self._process.kill()
                except OSError:
                    pass
            self._process = None
        self._published = None

    def _publish(self, state):
        name = f"Omachy Connect on {os.uname().nodename}"
        command = [
            "avahi-publish-service", "--no-reverse", name, MDNS_SERVICE_TYPE,
            str(state["port"]), *_mdns_txt(state),
        ]
        self._process = subprocess.Popen(
            command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        self._published = state.get("port")

    def run(self):
        while True:
            try:
                state = phone_sessions.state()
                active = bool(state.get("active") and state.get("port"))
                fingerprint = state.get("fingerprint_sha256")
                if active and fingerprint and self._published != state["port"]:
                    self._stop()
                    self._publish(state)
                elif not active and self._process is not None:
                    self._stop()
            except Exception:
                pass
            threading.Event().wait(MDNS_POLL_SECONDS)


class OmachyRequestHandler(BaseHTTPRequestHandler):
    APP_NAMES = {"control-center", "connect", "drop", "jarvis", "developer", "suite"}
    MAX_BODY_BYTES = 1_048_576

    def log_message(self, format, *args):
        # Suppress noisy HTTP logging for clean desktop output
        pass

    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        if getattr(self, "close_connection", False):
            self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def _trusted_local_request(self, require_origin=False):
        port = self.server.server_port
        expected_host = f"127.0.0.1:{port}"
        if self.headers.get("Host", "").lower() != expected_host:
            return False
        origin = self.headers.get("Origin")
        expected_origin = f"http://127.0.0.1:{port}"
        if require_origin and origin != expected_origin:
            return False
        if origin is not None and origin != expected_origin:
            return False
        if self.headers.get("Sec-Fetch-Site", "").lower() in {"cross-site", "same-site"}:
            return False
        return True

    def _read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None
        if length < 0 or length > self.MAX_BODY_BYTES:
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None

    def do_OPTIONS(self):
        if not self._trusted_local_request(require_origin=True):
            return self.send_json({"error": "Forbidden origin."}, 403)
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", f"http://127.0.0.1:{self.server.server_address[1]}")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Vary", "Origin")
        self.end_headers()

    def do_GET(self):
        if not self._trusted_local_request():
            return self.send_json({"error": "Forbidden host or origin."}, 403)
        path = self.path.split("?")[0]

        # Keep liveness checks independent from optional system integrations.
        if path == "/health":
            return self.send_json({"ok": True})

        # REST API endpoints
        if path == "/api/system/status":
            try:
                return self.send_json(collect_system_summary())
            except Exception:
                # Return a response instead of leaving clients with an empty reply.
                import traceback
                traceback.print_exc()
                return self.send_json({"error": "Could not collect system status."}, 500)
        elif path == "/api/drop/files":
            return self.send_json(get_drop_files())
        elif path == "/api/drop/folder":
            # Alias used by the status bar / Connect UI for the receive folder.
            return self.send_json(get_drop_files())
        elif path == "/api/drop/transfers":
            return self.send_json({"transfers": phone_sessions.local_transfers()})
        elif path == "/api/system/wifi/scan":
            return self.send_json(get_wifi_status())
        elif path == "/api/connect/interfaces":
            try:
                return self.send_json({"interfaces": phone_sessions.interfaces()})
            except RuntimeError as exc:
                return self.send_json({"error": str(exc)}, 503)
        elif path == "/api/connect/session":
            return self.send_json(phone_sessions.state())
        elif path == "/api/connect/devices":
            return self.send_json({"devices": phone_sessions.known_devices()})

        # Static file serving from dist/
        req_path = path.lstrip("/")
        if not req_path or req_path == "":
            req_path = "index.html"

        file_path = (DIST_DIR / req_path).resolve()
        if not file_path.is_relative_to(DIST_DIR.resolve()):
            self.send_response(404)
            self.end_headers()
            return

        # If file does not exist, fallback to index.html (SPA routing)
        if not file_path.exists() or file_path.is_dir():
            file_path = DIST_DIR / "index.html"

        if file_path.exists() and file_path.is_file():
            content_type, _ = mimetypes.guess_type(str(file_path))
            content_type = content_type or "application/octet-stream"
            try:
                content = file_path.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode())
                return

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not Found")

    def do_POST(self):
        if not self._trusted_local_request(require_origin=True):
            return self.send_json({"error": "Forbidden host or origin."}, 403)
        path = self.path.split("?")[0]

        # Desktop file uploads are chunked over the loopback-only service.
        source_match = re.fullmatch(r"/api/drop/transfers/([A-Za-z0-9_-]{16,64})/source", path)
        if source_match:
            self.close_connection = True
            length_text = self.headers.get("Content-Length", "")
            start_text = self.headers.get("X-Omachy-Chunk-Start", "")
            total_text = self.headers.get("X-Omachy-File-Size", "")
            if not length_text.isdecimal() or not start_text.isdecimal() or not total_text.isdecimal():
                return self.send_json({"error": "Valid chunk length and offsets are required."}, 400)
            length = int(length_text)
            if length > 1024 * 1024:
                return self.send_json({"error": "Source chunk exceeds 1 MiB."}, 413)
            try:
                result = phone_sessions.write_desktop_source_chunk(
                    source_match.group(1), int(start_text), int(total_text), length, self.rfile
                )
                return self.send_json(result)
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
            except OSError as exc:
                return self.send_json({"error": str(exc)}, 507)

        body = self._read_json()
        if not isinstance(body, dict):
            return self.send_json({"error": "Invalid JSON request body."}, 400)

        if path == "/api/system/audio/volume":
            if set(body) != {"volume"} or isinstance(body.get("volume"), bool) or not isinstance(body.get("volume"), int) or not 0 <= body["volume"] <= 100:
                return self.send_json({"error": "Volume must be an integer from 0 to 100."}, 400)
            vol = body.get("volume", 80)
            return self.send_json(set_audio_volume(vol))

        elif path == "/api/connect/session/start":
            if not isinstance(body.get("address"), str) or not (set(body) <= {"address", "persistent"}):
                return self.send_json({"error": "Provide an IPv4 address and an optional persistent flag."}, 400)
            persistent = bool(body.get("persistent", True))
            try:
                result = phone_sessions.start(body["address"], persistent=persistent)
                if persistent:
                    _remember_autostart(body["address"])
                return self.send_json(result)
            except (RuntimeError, ValueError) as exc:
                return self.send_json({"error": str(exc)}, 400)
            except OSError as exc:
                return self.send_json({"error": f"Could not bind the phone transfer port: {exc}"}, 503)

        elif path == "/api/connect/session/stop":
            if body:
                return self.send_json({"error": "This action takes no parameters."}, 400)
            phone_sessions.stop()
            # A manual stop means the user wants Connect off; forget the
            # auto-reconnect preference so the watcher does not restart it.
            _forget_autostart()
            return self.send_json({"active": False, "pending": [], "devices": []})

        elif path == "/api/connect/pairing/decision":
            if set(body) != {"request_id", "approved"} or not isinstance(body.get("request_id"), str) or not isinstance(body.get("approved"), bool):
                return self.send_json({"error": "Provide a request ID and an approval decision."}, 400)
            try:
                phone_sessions.decide_pair(body["request_id"], body["approved"])
                return self.send_json(phone_sessions.state())
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 404)

        elif path == "/api/connect/devices":
            return self.send_json({"devices": phone_sessions.known_devices()})

        elif path == "/api/connect/devices/auto-accept":
            if (set(body) != {"name", "auto_accept"} or not isinstance(body.get("name"), str)
                    or not body["name"].strip() or not isinstance(body.get("auto_accept"), bool)):
                return self.send_json({"error": "Provide a device name and an auto-accept flag."}, 400)
            phone_sessions.set_device_auto_accept(body["name"].strip(), body["auto_accept"])
            return self.send_json({"devices": phone_sessions.known_devices()})

        elif path == "/api/connect/devices/forget":
            if set(body) != {"name"} or not isinstance(body.get("name"), str) or not body["name"].strip():
                return self.send_json({"error": "Provide a device name to forget."}, 400)
            phone_sessions.forget_device(body["name"].strip())
            return self.send_json(phone_sessions.state())

        elif path == "/api/drop/transfers":
            if set(body) != {"name", "size", "device_name"}:
                return self.send_json({"error": "Provide a filename, byte size, and paired device name."}, 400)
            try:
                return self.send_json(phone_sessions.create_desktop_transfer(body["name"], body["size"], body["device_name"]), 201)
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
            except OSError as exc:
                return self.send_json({"error": str(exc)}, 507)

        elif path.startswith("/api/drop/transfers/") and path.endswith("/decision"):
            match = re.fullmatch(r"/api/drop/transfers/([A-Za-z0-9_-]{16,64})/decision", path)
            if not match or set(body) != {"accepted"} or not isinstance(body.get("accepted"), bool):
                return self.send_json({"error": "Provide a transfer ID and accepted boolean."}, 400)
            try:
                return self.send_json(phone_sessions.decide_local_transfer(match.group(1), body["accepted"]))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 404)
            except OSError as exc:
                return self.send_json({"error": str(exc)}, 507)

        elif path.startswith("/api/drop/transfers/") and path.endswith("/cancel"):
            match = re.fullmatch(r"/api/drop/transfers/([A-Za-z0-9_-]{16,64})/cancel", path)
            if not match or body:
                return self.send_json({"error": "Provide a transfer ID and no body fields."}, 400)
            try:
                return self.send_json(phone_sessions.cancel_local_transfer(match.group(1)))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 404)

        elif path == "/api/system/audio/mute":
            if body:
                return self.send_json({"error": "This action takes no parameters."}, 400)
            return self.send_json(toggle_audio_mute())

        elif path == "/api/system/bluetooth/power":
            if set(body) != {"powered"} or not isinstance(body.get("powered"), bool):
                return self.send_json({"error": "powered must be a boolean."}, 400)
            powered = body.get("powered", True)
            return self.send_json(set_bluetooth_power(powered))

        elif path == "/api/system/wifi/radio":
            if set(body) != {"enabled"} or not isinstance(body.get("enabled"), bool):
                return self.send_json({"error": "enabled must be a boolean."}, 400)
            enabled = body.get("enabled", True)
            return self.send_json(set_wifi_radio(enabled))

        elif path == "/api/drop/open-folder":
            if body:
                return self.send_json({"error": "This action takes no parameters."}, 400)
            return self.send_json(open_drop_folder())

        elif path == "/api/drop/stage-file":
            if set(body) != {"filename", "content"}:
                return self.send_json({"error": "Provide only filename and text content."}, 400)
            filename = body.get("filename")
            content = body.get("content")
            if not isinstance(filename, str) or not filename or filename in {".", ".."} or any(c in filename for c in ("/", "\\", "\x00")):
                return self.send_json({"error": "Invalid filename."}, 400)
            if not isinstance(content, str):
                return self.send_json({"error": "File content must be text."}, 400)
            if len(content.encode("utf-8")) > self.MAX_BODY_BYTES:
                return self.send_json({"error": "Text file exceeds the allowed size."}, 413)
            # Write to real DROP_DIR
            DROP_DIR.mkdir(parents=True, exist_ok=True)
            target_path = DROP_DIR / filename
            staged_path = None
            try:
                fd, staged_path = tempfile.mkstemp(prefix=".omachy-", suffix=".tmp", dir=DROP_DIR)
                with os.fdopen(fd, "w", encoding="utf-8") as staged_file:
                    staged_file.write(content)
                # Replacing the directory entry does not follow a pre-existing symlink.
                os.replace(staged_path, target_path)
            except OSError:
                if staged_path and os.path.exists(staged_path):
                    os.unlink(staged_path)
                return self.send_json({"error": "Could not stage the file safely."}, 400)
            return self.send_json({"success": True, "path": str(target_path)})

        elif path == "/api/actions/run":
            if set(body) != {"action"} or not isinstance(body["action"], str):
                return self.send_json({"error": "Provide exactly one permitted action identifier."}, 400)
            if body["action"] not in ALLOWED_ACTIONS:
                return self.send_json({"error": "Action is not permitted."}, 403)
            return self.send_json(run_allowed_action(body["action"]))

        elif path == "/api/app/launch":
            app_name = body.get("app")
            if set(body) != {"app"} or not isinstance(app_name, str) or app_name not in self.APP_NAMES:
                return self.send_json({"error": "Unknown application."}, 400)
            runner = Path(__file__).parent / "app_runner.py"
            subprocess.Popen(
                [sys.executable, str(runner), "--app", app_name],
                env=graphical_environment(),
                start_new_session=True,
                close_fds=True,
            )
            return self.send_json({"success": True, "launched": app_name})

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Endpoint not found")


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

    @property
    def server_port(self):
        """Expose the bound port used by the local request checks."""
        return self.server_address[1]


def run_service(port=PORT):
    # Bind only to IPv4 loopback: this service must never be reachable over Wi-Fi.
    server = ReusableTCPServer(("127.0.0.1", port), OmachyRequestHandler)
    print(f"Omachy Desktop local daemon running on http://127.0.0.1:{port}")
    threading.Thread(target=_autoconnect_watch, name="omachy-autoconnect", daemon=True).start()
    _MDNSPublisher().start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Omachy daemon.")
        server.server_close()


if __name__ == "__main__":
    p = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else PORT
    run_service(p)
