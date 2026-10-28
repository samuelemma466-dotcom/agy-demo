"""
Omachy Desktop — Local Loopback HTTP & API Service
Serves static assets from dist/ and provides REST endpoints for system controls.
"""

import sys
import os
import json
import mimetypes
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import socketserver

from system_bridge import (
    collect_system_summary,
    set_audio_volume,
    toggle_audio_mute,
    set_bluetooth_power,
    set_wifi_radio,
    get_wifi_status,
    get_drop_files,
    open_drop_folder,
    execute_jarvis_command,
    DROP_DIR,
)

DIST_DIR = Path(__file__).resolve().parent.parent / "dist"
PORT = 48123


class OmachyRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress noisy HTTP logging for clean desktop output
        pass

    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]

        # REST API endpoints
        if path == "/api/system/status":
            return self.send_json(collect_system_summary())
        elif path == "/api/drop/files":
            return self.send_json(get_drop_files())
        elif path == "/api/system/wifi/scan":
            return self.send_json(get_wifi_status())

        # Static file serving from dist/
        req_path = path.lstrip("/")
        if not req_path or req_path == "":
            req_path = "index.html"

        file_path = DIST_DIR / req_path

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
        path = self.path.split("?")[0]
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b"{}"

        try:
            body = json.loads(post_data.decode("utf-8")) if post_data else {}
        except Exception:
            body = {}

        if path == "/api/system/audio/volume":
            vol = body.get("volume", 80)
            return self.send_json(set_audio_volume(vol))

        elif path == "/api/system/audio/mute":
            return self.send_json(toggle_audio_mute())

        elif path == "/api/system/bluetooth/power":
            powered = body.get("powered", True)
            return self.send_json(set_bluetooth_power(powered))

        elif path == "/api/system/wifi/radio":
            enabled = body.get("enabled", True)
            return self.send_json(set_wifi_radio(enabled))

        elif path == "/api/drop/open-folder":
            return self.send_json(open_drop_folder())

        elif path == "/api/drop/stage-file":
            filename = body.get("filename", "staged_file.txt")
            content = body.get("content", "Omachy drop file")
            # Write to real DROP_DIR
            target_path = DROP_DIR / filename
            target_path.write_text(content)
            return self.send_json({"success": True, "path": str(target_path)})

        elif path == "/api/jarvis/execute":
            cmd = body.get("command", "")
            return self.send_json(execute_jarvis_command(cmd))

        elif path == "/api/app/launch":
            app_name = body.get("app", "suite")
            import subprocess
            runner = Path(__file__).parent / "app_runner.py"
            subprocess.Popen([sys.executable, str(runner), "--app", app_name])
            return self.send_json({"success": True, "launched": app_name})

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Endpoint not found")


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def run_service(port=PORT):
    server = ReusableTCPServer(("127.0.0.1", port), OmachyRequestHandler)
    print(f"Omachy Desktop local daemon running on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Omachy daemon.")
        server.server_close()


if __name__ == "__main__":
    p = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else PORT
    run_service(p)
