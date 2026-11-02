"""Short-lived TLS pairing and bounded Omachy phone file transfers."""

from __future__ import annotations

import base64
import hashlib
import hmac
import http.server
import ipaddress
import json
import os
import re
import secrets
import shutil
import socket
import ssl
import stat
import subprocess
import tempfile
import threading
import time
import unicodedata
from pathlib import Path
from collections import defaultdict, deque

PROTOCOL_VERSION = 1
SESSION_SECONDS = 300
PHONE_TRANSFER_PORT = 32975
CONNECT_STATE_DIR = os.environ.get("OMACHY_STATE_DIR",
    str(Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local" / "state")) / "omachy" / "connect"))
PERSISTENT_CERT_PATH = Path(CONNECT_STATE_DIR) / "certificate.pem"
PERSISTENT_KEY_PATH = Path(CONNECT_STATE_DIR) / "private-key.pem"
PAIRED_DEVICES_PATH = Path(CONNECT_STATE_DIR) / "paired-devices.json"
AUTOSTART_PATH = Path(CONNECT_STATE_DIR) / "autostart.json"
MAX_REQUEST_BYTES = 8192
MAX_PAIR_ATTEMPTS = 5
PAIR_WINDOW_SECONDS = 60
MAX_TRANSFER_SIZE = 10 * 1024 * 1024 * 1024
TRANSFER_CHUNK_BYTES = 1024 * 1024
LOCAL_CHUNK_BYTES = 1024 * 1024
MAX_TRANSFER_HISTORY = 100
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def safe_filename(value):
    if not isinstance(value, str):
        raise ValueError("Filename must be text.")
    normalized = unicodedata.normalize("NFC", value)
    if not normalized or normalized in {".", ".."} or normalized.startswith("."):
        raise ValueError("Hidden, empty, and traversal filenames are not accepted.")
    if "/" in normalized or "\\" in normalized or len(normalized.encode("utf-8")) > 255:
        raise ValueError("Filename contains a path separator or is too long.")
    if any(unicodedata.category(char).startswith("C") for char in normalized):
        raise ValueError("Filename contains a control character.")
    return normalized


def _validate_size(size):
    if isinstance(size, bool) or not isinstance(size, int) or not 0 <= size <= MAX_TRANSFER_SIZE:
        raise ValueError(f"File size must be between 0 and {MAX_TRANSFER_SIZE} bytes.")
    return size


def _unique_filename(name, occupied):
    if name not in occupied:
        return name
    stem, suffix = os.path.splitext(name)
    for number in range(2, 10000):
        candidate = f"{stem} ({number}){suffix}"
        if candidate not in occupied:
            return candidate
    raise FileExistsError("Could not find an unused filename.")


def local_ipv4_interfaces():
    """Return active interface addresses from `ip` using fixed argv only."""
    executable = shutil.which("ip")
    if not executable:
        raise RuntimeError("The ip utility is required to list local IPv4 addresses.")
    try:
        result = subprocess.run(
            [executable, "-j", "-4", "addr", "show", "up"],
            check=True,
            capture_output=True,
            text=True,
            timeout=3,
            shell=False,
        )
        entries = json.loads(result.stdout)
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Could not inspect network interfaces: {exc}") from exc

    found = []
    for interface in entries:
        name = interface.get("ifname")
        for address in interface.get("addr_info", []):
            if address.get("family") != "inet" or address.get("scope") != "global":
                continue
            value = address.get("local")
            try:
                parsed = ipaddress.IPv4Address(value)
            except ipaddress.AddressValueError:
                continue
            if not parsed.is_loopback and not parsed.is_unspecified:
                wireless_path = Path("/sys/class/net") / str(name) / "wireless"
                found.append({
                    "interface": name,
                    "address": str(parsed),
                    "wireless": wireless_path.exists(),
                })
    return found


class _TransferHTTPServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, *args, **kwargs):
        self._connection_slots = threading.BoundedSemaphore(8)
        super().__init__(*args, **kwargs)

    def process_request(self, request, client_address):
        if not self._connection_slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self._connection_slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._connection_slots.release()

    def handle_error(self, _request, _client_address):
        # Peers can disappear during an expiring session; avoid logging secrets
        # or treating routine TLS disconnects as application failures.
        return


class _Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "OmachyTransfer/1"

    def setup(self):
        super().setup()
        # Parallel ranged streams share a narrow hotspot link, so one stream can
        # sit idle while the others drain the socket. This timeout only has to
        # catch a dead phone, not a momentarily starved stream.
        self.connection.settimeout(45)
        # The hotspot link is the bottleneck; larger kernel buffers and no
        # Nagle delay keep bulk transfers close to the link speed.
        for level, option, value in (
            (socket.IPPROTO_TCP, socket.TCP_NODELAY, 1),
            (socket.SOL_SOCKET, socket.SO_SNDBUF, 1024 * 1024),
            (socket.SOL_SOCKET, socket.SO_RCVBUF, 1024 * 1024),
        ):
            try:
                self.connection.setsockopt(level, option, value)
            except OSError:
                pass

    def log_message(self, _format, *_args):
        # Do not log Authorization headers, credentials, or device payloads.
        return

    def _send(self, status, payload):
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if self.close_connection:
            self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        raw_length = self.headers.get("Content-Length", "")
        if not raw_length.isdecimal():
            self.close_connection = True
            return None
        length = int(raw_length)
        if length > MAX_REQUEST_BYTES:
            self.close_connection = True
            return None
        try:
            value = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.close_connection = True
            return None
        return value if isinstance(value, dict) else None

    def _bearer(self):
        value = self.headers.get("Authorization", "")
        if not value.startswith("Bearer ") or len(value) > 256:
            return ""
        return value[7:]

    def do_GET(self):
        if self.path == "/v1/transfers":
            key = self.server.manager.authenticated_device_key(self._bearer())
            if not key:
                return self._send(401, {"error": "Unauthorized."})
            return self._send(200, {"transfers": self.server.manager.remote_transfers(key)})

        if self.path == "/v1/ping":
            device = self.server.manager.authenticate_device(self._bearer())
            if not device:
                return self._send(401, {"error": "Unauthorized."})
            return self._send(200, {"protocol": PROTOCOL_VERSION, "connected": True, "device": device})

        match = re.fullmatch(r"/v1/transfers/([A-Za-z0-9_-]{16,64})", self.path)
        if match:
            key = self.server.manager.authenticated_device_key(self._bearer())
            if not key:
                return self._send(401, {"error": "Unauthorized."})
            record = self.server.manager.remote_transfer(key, match.group(1))
            if record is None:
                return self._send(404, {"error": "Unknown transfer."})
            return self._send(200, record)

        match = re.fullmatch(r"/v1/transfers/([A-Za-z0-9_-]{16,64})/content", self.path)
        if match:
            key = self.server.manager.authenticated_device_key(self._bearer())
            if not key:
                return self._send(401, {"error": "Unauthorized."})
            return self.server.manager.stream_desktop_file(key, match.group(1), self, self.headers.get("Range"))

        if self.path.startswith("/v1/pair/status/"):
            request_id = self.path.removeprefix("/v1/pair/status/")
            response = self.server.manager.pair_status(request_id, self._bearer())
            return self._send(response.pop("status"), response)

        return self._send(404, {"error": "Unknown endpoint."})

    def do_POST(self):
        if self.path == "/v1/pair":
            body = self._body()
            if body is None:
                return self._send(400, {"error": "Malformed or oversized JSON."})
            if set(body) != {"protocol", "device_name"}:
                return self._send(400, {"error": "Unexpected pairing message fields."})
            if type(body.get("protocol")) is not int or body.get("protocol") != PROTOCOL_VERSION:
                return self._send(426, {"error": "Unsupported protocol version."})
            name = body.get("device_name")
            if not isinstance(name, str) or not name.strip() or len(name) > 80 or any(ord(c) < 32 for c in name):
                return self._send(400, {"error": "Invalid device name."})
            request_id = self.server.manager.request_pair(
                self.client_address[0], self._bearer(), name.strip()
            )
            if not request_id:
                return self._send(401, {"error": "Pairing credential invalid, expired, or rate limited."})
            return self._send(202, {"request_id": request_id, "state": "awaiting_approval"})

        if self.path == "/v1/transfers/offers":
            self.close_connection = True
            key = self.server.manager.authenticated_device_key(self._bearer())
            if not key:
                return self._send(401, {"error": "Unauthorized."})
            body = self._body()
            if body is None:
                return self._send(400, {"error": "Malformed or oversized JSON."})
            try:
                transfer = self.server.manager.create_phone_offer(key, body)
            except ValueError as exc:
                return self._send(400, {"error": str(exc)})
            except OSError as exc:
                return self._send(507, {"error": str(exc)})
            return self._send(202, transfer)

        match = re.fullmatch(r"/v1/transfers/([A-Za-z0-9_-]{16,64})/decision", self.path)
        if match:
            self.close_connection = True
            key = self.server.manager.authenticated_device_key(self._bearer())
            if not key:
                return self._send(401, {"error": "Unauthorized."})
            body = self._body()
            if body is None or set(body) != {"accepted"} or not isinstance(body["accepted"], bool):
                return self._send(400, {"error": "Provide an accepted boolean."})
            try:
                transfer = self.server.manager.phone_decide_transfer(key, match.group(1), body["accepted"])
            except ValueError as exc:
                return self._send(404, {"error": str(exc)})
            return self._send(200, transfer)

        match = re.fullmatch(r"/v1/transfers/([A-Za-z0-9_-]{16,64})/complete", self.path)
        if match:
            self.close_connection = True
            key = self.server.manager.authenticated_device_key(self._bearer())
            if not key:
                return self._send(401, {"error": "Unauthorized."})
            body = self._body()
            if body is None or set(body) != {"protocol", "sha256"}:
                return self._send(400, {"error": "Provide protocol and verified SHA-256."})
            try:
                result = self.server.manager.verify_desktop_transfer(key, match.group(1), body)
            except ValueError as exc:
                return self._send(400, {"error": str(exc)})
            return self._send(200 if result["status"] == "completed" else 422, result)

        if self.path == "/v1/ping":
            self.close_connection = True
            device = self.server.manager.authenticate_device(self._bearer())
            if not device:
                return self._send(401, {"error": "Unauthorized."})
            body = self._body()
            if body != {"protocol": PROTOCOL_VERSION}:
                return self._send(400, {"error": "Invalid protocol message."})
            return self._send(200, {"protocol": PROTOCOL_VERSION, "connected": True, "device": device})

        return self._send(404, {"error": "Unknown endpoint."})

    def do_PUT(self):
        self.close_connection = True
        match = re.fullmatch(r"/v1/transfers/([A-Za-z0-9_-]{16,64})/content", self.path)
        if not match:
            return self._send(405, {"error": "Method not allowed."})
        key = self.server.manager.authenticated_device_key(self._bearer())
        if not key:
            return self._send(401, {"error": "Unauthorized."})
        raw_length = self.headers.get("Content-Length", "")
        if not raw_length.isdecimal():
            self.close_connection = True
            return self._send(411, {"error": "Content-Length is required."})
        length = int(raw_length)
        if length > MAX_TRANSFER_SIZE:
            self.close_connection = True
            return self._send(413, {"error": "Transfer is too large."})
        try:
            result = self.server.manager.receive_phone_file(key, match.group(1), length, self.rfile)
        except ValueError as exc:
            return self._send(400, {"error": str(exc)})
        except OSError as exc:
            return self._send(507, {"error": str(exc)})
        return self._send(200 if result.get("status") == "completed" else 400, result)

    def do_DELETE(self):
        match = re.fullmatch(r"/v1/transfers/([A-Za-z0-9_-]{16,64})", self.path)
        if not match:
            return self._send(405, {"error": "Method not allowed."})
        key = self.server.manager.authenticated_device_key(self._bearer())
        if not key:
            return self._send(401, {"error": "Unauthorized."})
        try:
            return self._send(200, self.server.manager.cancel_transfer(key, match.group(1)))
        except ValueError as exc:
            return self._send(404, {"error": str(exc)})


class PhoneSessionManager:
    """Owns one explicit, expiring TLS listener and its ephemeral credentials."""

    def __init__(self, interface_provider=local_ipv4_interfaces, incoming_dir=None, state_dir=None):
        self._interfaces = interface_provider
        self._incoming_dir = Path(incoming_dir or (Path.home() / "Downloads" / "OmachyDrop"))
        state_root = Path(state_dir or CONNECT_STATE_DIR)
        self._persistent_cert_path = state_root / "certificate.pem"
        self._persistent_key_path = state_root / "private-key.pem"
        self._paired_devices_path = state_root / "paired-devices.json"
        self._lock = threading.RLock()
        self._server = None
        self._thread = None
        self._timer = None
        self._tempdir = None
        self._state = None
        self._pair_token = None
        self._pair_requests = {}
        self._device_tokens = {}
        self._attempts = defaultdict(deque)
        self._transfers = {}
        self._roster = self._load_roster()

    def _load_roster(self):
        """Remembered paired devices: digest -> {"name": str, "added_at": int}."""
        try:
            raw = json.loads(self._paired_devices_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            return {}
        if not isinstance(raw, dict):
            return {}
        roster = {}
        for digest, item in raw.items():
            if (isinstance(digest, str) and _SHA256_RE.fullmatch(digest)
                    and isinstance(item, dict) and isinstance(item.get("name"), str)
                    and item["name"].strip() and len(item["name"]) <= 80):
                roster[digest] = {
                    "name": item["name"].strip(),
                    "added_at": int(item.get("added_at") or 0),
                    "auto_accept": item.get("auto_accept") is True,
                }
        return roster

    def _save_roster(self):
        try:
            self._paired_devices_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            os.chmod(self._paired_devices_path.parent, 0o700)
            temp = self._paired_devices_path.parent / ".paired-devices.tmp"
            with open(temp, "w", encoding="utf-8") as handle:
                json.dump(self._roster, handle, separators=(",", ":"))
            os.chmod(temp, 0o600)
            os.replace(temp, self._paired_devices_path)
        except OSError:
            # Roster persistence is a convenience only; pairing still works.
            pass

    def forget_device(self, name):
        """Remove every roster entry for a device name and drop live credentials."""
        removed = 0
        with self._lock:
            for digest in [key for key, item in self._roster.items() if item["name"] == name]:
                self._roster.pop(digest, None)
                self._device_tokens.pop(digest, None)
                removed += 1
            self._save_roster()
        return removed

    def known_devices(self):
        with self._lock:
            return [
                {"name": item["name"], "auto_accept": bool(item.get("auto_accept"))}
                for item in self._roster.values()
            ]

    def set_device_auto_accept(self, name, enabled):
        """Trust one paired device to place files without a per-file prompt."""
        with self._lock:
            matched = 0
            for item in self._roster.values():
                if item["name"] == name:
                    item["auto_accept"] = bool(enabled)
                    matched += 1
            if matched:
                self._save_roster()
            return matched

    def interfaces(self):
        return self._interfaces()

    def start(self, address, timeout=SESSION_SECONDS, persistent=False):
        with self._lock:
            if self._state:
                raise RuntimeError("A phone connection session is already active.")
            try:
                ipaddress.IPv4Address(address)
            except ipaddress.AddressValueError as exc:
                raise ValueError("Choose a valid IPv4 address.") from exc
            options = self._interfaces()
            if not any(item["address"] == address for item in options):
                raise ValueError("The selected address is not an active local interface.")
            if not persistent and not 30 <= int(timeout) <= 900:
                raise ValueError("Session timeout must be from 30 to 900 seconds.")
            self._tempdir = tempfile.TemporaryDirectory(prefix="omachy-phone-")
            os.chmod(self._tempdir.name, 0o700)
            cert_path = os.path.join(self._tempdir.name, "certificate.pem")
            key_path = os.path.join(self._tempdir.name, "private-key.pem")
            try:
                openssl = shutil.which("openssl")
                qrencode = shutil.which("qrencode")
                if not openssl or not qrencode:
                    raise RuntimeError("OpenSSL and qrencode are required for secure QR pairing.")
                # Persistent mode keeps one stable self-signed certificate on
                # disk so previously paired phones keep verifying our TLS
                # identity across sessions and desktop restarts.
                reused_identity = False
                if persistent and self._persistent_cert_path.exists() and self._persistent_key_path.exists():
                    try:
                        shutil.copyfile(self._persistent_cert_path, cert_path)
                        shutil.copyfile(self._persistent_key_path, key_path)
                        reused_identity = True
                    except OSError:
                        reused_identity = False
                if not reused_identity:
                    subprocess.run(
                        [openssl, "req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-days", "1825",
                         "-subj", "/CN=omachy-transfer-session", "-keyout", key_path, "-out", cert_path],
                        check=True, capture_output=True, timeout=10, shell=False,
                    )
                os.chmod(key_path, 0o600)
                context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                context.minimum_version = ssl.TLSVersion.TLSv1_2
                context.load_cert_chain(cert_path, key_path)
                with open(cert_path, encoding="ascii") as certificate_file:
                    cert_der = ssl.PEM_cert_to_DER_cert(certificate_file.read())
                fingerprint = hashlib.sha256(cert_der).hexdigest()
                if persistent:
                    # Remember this identity so re-pairing keeps the same
                    # fingerprint the phone already pinned.
                    try:
                        self._persistent_cert_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                        os.chmod(self._persistent_cert_path.parent, 0o700)
                        shutil.copyfile(cert_path, self._persistent_cert_path)
                        shutil.copyfile(key_path, self._persistent_key_path)
                        os.chmod(self._persistent_key_path, 0o600)
                    except OSError:
                        persistent = False
                # A stable port lets users keep one narrowly scoped firewall
                # rule. TLS credentials remain session-only and pairing still
                # requires explicit approval.
                server = _TransferHTTPServer((address, PHONE_TRANSFER_PORT), _Handler, bind_and_activate=True)
                server.manager = self
                server.socket = context.wrap_socket(server.socket, server_side=True)
                self._server = server
                self._pair_token = secrets.token_urlsafe(32)
                self._pair_requests = {}
                # Previously paired devices reconnect without scanning again.
                self._device_tokens = {
                    digest: {
                        "name": item["name"],
                        "connected_at": item.get("added_at") or int(time.time()),
                        "paired": True,
                    }
                    for digest, item in self._roster.items()
                }
                self._attempts.clear()
                self._transfers = {}
                port = server.server_address[1]
                qr_payload = json.dumps({
                    "protocol": "omachy-connect", "version": PROTOCOL_VERSION,
                    "address": address, "port": port, "fingerprint_sha256": fingerprint,
                    "pairing_token": self._pair_token,
                }, separators=(",", ":"))
                payload_path = os.path.join(self._tempdir.name, "pairing-qr.json")
                with open(payload_path, "x", encoding="utf-8") as payload_file:
                    payload_file.write(qr_payload)
                os.chmod(payload_path, 0o600)
                qr = subprocess.run(
                    [qrencode, "-o", "-", "-s", "5", "-r", payload_path],
                    check=True, capture_output=True, timeout=5, shell=False,
                ).stdout
                os.unlink(payload_path)
                if not qr.startswith(b"\x89PNG\r\n\x1a\n"):
                    raise RuntimeError("qrencode did not produce a PNG image.")
                expires_at = None if persistent else int(time.time()) + int(timeout)
                self._state = {
                    "active": True, "address": address, "port": port,
                    "protocol": PROTOCOL_VERSION, "fingerprint_sha256": fingerprint,
                    "pairing_token": self._pair_token,
                    "qr_png_base64": base64.b64encode(qr).decode("ascii"),
                    "persistent": persistent, "expires_at": expires_at, "pending": [], "devices": [],
                }
                self._thread = threading.Thread(target=server.serve_forever, name="omachy-phone-tls", daemon=True)
                self._thread.start()
                if not persistent:
                    self._timer = threading.Timer(int(timeout), self.stop)
                    self._timer.daemon = True
                    self._timer.start()
                return self.state()
            except Exception:
                self._cleanup_locked()
                raise

    def state(self):
        with self._lock:
            self._expire_if_needed_locked()
            if not self._state:
                return {"active": False, "pending": [], "devices": [], "transfers": []}
            value = dict(self._state)
            value["pending"] = [
                {"id": key, "device_name": item["name"]}
                for key, item in self._pair_requests.items() if item["status"] == "pending"
            ]
            value["devices"] = [
                {
                    "name": item["name"],
                    "connected_at": item["connected_at"],
                    "auto_accept": self._roster.get(digest, {}).get("auto_accept") is True,
                }
                for digest, item in self._device_tokens.items()
                if item.get("paired")
            ]
            value["transfers"] = [self._public_transfer(item) for item in self._transfers.values()]
            return value

    def request_pair(self, remote_address, token, device_name, fingerprint=None):
        with self._lock:
            self._expire_if_needed_locked()
            now = time.monotonic()
            bucket = self._attempts[remote_address]
            while bucket and now - bucket[0] > PAIR_WINDOW_SECONDS:
                bucket.popleft()
            if len(bucket) >= MAX_PAIR_ATTEMPTS or not self._state or not self._pair_token:
                return None
            bucket.append(now)
            if not token or not hmac.compare_digest(token, self._pair_token):
                return None
            if any(item["name"] == device_name and item["status"] == "pending" for item in self._pair_requests.values()):
                return None
            request_id = secrets.token_urlsafe(18)
            self._pair_requests[request_id] = {"name": device_name, "status": "pending", "device_token": None}
            return request_id

    def decide_pair(self, request_id, approved):
        with self._lock:
            self._expire_if_needed_locked()
            request = self._pair_requests.get(request_id)
            if not request or request["status"] != "pending":
                raise ValueError("Pairing request is no longer pending.")
            if approved is True:
                token = secrets.token_urlsafe(32)
                request["status"] = "approved"
                request["device_token"] = token
                digest = hashlib.sha256(token.encode()).hexdigest()
                self._device_tokens[digest] = {
                    "name": request["name"], "connected_at": int(time.time()), "paired": False
                }
                # Remember the device so it reconnects without re-pairing, and
                # retire any superseded credential for the same device name.
                for stale_digest in [key for key, item in self._roster.items() if item["name"] == request["name"]]:
                    self._roster.pop(stale_digest, None)
                    self._device_tokens.pop(stale_digest, None)
                self._roster[digest] = {"name": request["name"], "added_at": int(time.time())}
                self._save_roster()
            else:
                request["status"] = "rejected"

    def pair_status(self, request_id, token):
        with self._lock:
            self._expire_if_needed_locked()
            if not self._pair_token or not token or not hmac.compare_digest(token, self._pair_token):
                return {"status": 401, "error": "Unauthorized."}
            request = self._pair_requests.get(request_id)
            if not request:
                return {"status": 404, "error": "Unknown pairing request."}
            if request["status"] == "approved" and request["device_token"]:
                credential = request.pop("device_token")
                request["status"] = "paired"
                persistent = bool(self._state and self._state.get("persistent"))
                if not persistent:
                    # One-shot pairing: invalidate the QR credential once used.
                    self._pair_token = None
                    if self._state:
                        self._state["pairing_token"] = None
                digest = hashlib.sha256(credential.encode()).hexdigest()
                if digest in self._device_tokens:
                    self._device_tokens[digest]["paired"] = True
                return {"status": 200, "state": "paired", "device_token": credential}
            if request["status"] == "rejected":
                return {"status": 200, "state": "rejected"}
            return {"status": 200, "state": "awaiting_approval"}

    def authenticate_device(self, token):
        if not token:
            return None
        digest = hashlib.sha256(token.encode()).hexdigest()
        with self._lock:
            self._expire_if_needed_locked()
            device = self._device_tokens.get(digest, {})
            return device.get("name") if device.get("paired") else None

    def authenticated_device_key(self, token):
        if not token:
            return None
        digest = hashlib.sha256(token.encode()).hexdigest()
        with self._lock:
            self._expire_if_needed_locked()
            device = self._device_tokens.get(digest)
            return digest if device and device.get("paired") else None

    def _public_transfer(self, transfer):
        fields = (
            "id", "name", "size", "direction", "status", "bytes_transferred",
            "source_bytes", "sha256", "created_at", "mtime", "device_name", "error", "saved_path",
        )
        result = {key: transfer[key] for key in fields if key in transfer}
        result["progress"] = 100 if transfer["size"] == 0 and transfer["status"] == "completed" else (
            round(transfer["bytes_transferred"] * 100 / transfer["size"], 1) if transfer["size"] else 0
        )
        return result

    def _active_transfers_locked(self):
        terminal = {"completed", "rejected", "canceled", "failed"}
        return sum(item["status"] not in terminal for item in self._transfers.values())

    def _device_name(self, key):
        device = self._device_tokens.get(key)
        if not device or not device.get("paired"):
            raise ValueError("The paired device is no longer connected.")
        return device["name"]

    def _check_destination(self, size):
        self._incoming_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
        directory_fd = os.open(self._incoming_dir, flags)
        try:
            free = shutil.disk_usage(self._incoming_dir).free
            if free < size + 8 * 1024 * 1024:
                raise OSError("There is not enough free space for this transfer.")
        except Exception:
            os.close(directory_fd)
            raise
        return directory_fd

    def _new_transfer_locked(self, *, direction, name, size, digest, device_key, device_name, mtime=None, transfer_id=None, **extra):
        if self._active_transfers_locked() >= 20:
            raise ValueError("The session already has 20 active transfers.")
        if len(self._transfers) >= MAX_TRANSFER_HISTORY:
            terminal = {"completed", "rejected", "canceled", "failed"}
            oldest = next((key for key, item in self._transfers.items() if item["status"] in terminal), None)
            if oldest is None:
                raise ValueError("Transfer history is full; finish or cancel an active transfer first.")
            self._transfers.pop(oldest)
        transfer_id = transfer_id or secrets.token_urlsafe(18)
        transfer = {
            "id": transfer_id, "direction": direction, "name": name,
            "size": size, "sha256": digest, "mtime": mtime,
            "device_key": device_key, "device_name": device_name,
            "status": "offered", "bytes_transferred": 0,
            "created_at": int(time.time()), "error": None,
            "cancel_event": threading.Event(), "source_lock": threading.Lock(), **extra,
        }
        self._transfers[transfer_id] = transfer
        return transfer

    def create_phone_offer(self, device_key, body):
        required = {"protocol", "name", "size", "sha256"}
        if not isinstance(body, dict) or set(body) not in (required, required | {"mtime"}):
            raise ValueError("Provide exactly protocol, name, size, SHA-256, and optional mtime.")
        if type(body["protocol"]) is not int or body["protocol"] != PROTOCOL_VERSION:
            raise ValueError("Unsupported protocol version.")
        name = safe_filename(body["name"])
        size = _validate_size(body["size"])
        digest = body["sha256"]
        if not isinstance(digest, str) or not _SHA256_RE.fullmatch(digest):
            raise ValueError("SHA-256 must be 64 lowercase hexadecimal characters.")
        mtime = body.get("mtime")
        if mtime is not None and (isinstance(mtime, bool) or not isinstance(mtime, int) or not 315532800 <= mtime <= 4102444800):
            raise ValueError("mtime must be a Unix timestamp between 1980 and 2100.")
        with self._lock:
            self._expire_if_needed_locked()
            device_name = self._device_name(device_key)
            if not self._state:
                raise ValueError("The connection session has expired.")
            directory_fd = self._check_destination(size)
            os.close(directory_fd)
            transfer = self._new_transfer_locked(
                direction="phone_to_desktop", name=name, size=size, digest=digest,
                device_key=device_key, device_name=device_name, mtime=mtime,
            )
            trusted = self._roster.get(device_key, {}).get("auto_accept") is True
            if trusted:
                # Trusted devices skip the per-file prompt; verification of the
                # received bytes still happens exactly as for a manual accept.
                try:
                    directory_fd = self._check_destination(size)
                    os.close(directory_fd)
                    transfer["status"] = "accepted"
                    transfer["auto_accepted"] = True
                except OSError:
                    pass
            return self._public_transfer(transfer)

    def remote_transfers(self, device_key):
        with self._lock:
            return [self._public_transfer(item) for item in self._transfers.values()
                    if item["device_key"] == device_key and item["status"] != "source_uploading"]

    def remote_transfer(self, device_key, transfer_id):
        with self._lock:
            transfer = self._transfers.get(transfer_id)
            if not transfer or transfer["device_key"] != device_key:
                return None
            return self._public_transfer(transfer)

    def local_transfers(self):
        with self._lock:
            self._expire_if_needed_locked()
            return [self._public_transfer(item) for item in self._transfers.values()]

    def _find_transfer_locked(self, transfer_id, device_key=None):
        transfer = self._transfers.get(transfer_id)
        if transfer is None or (device_key is not None and transfer["device_key"] != device_key):
            return None
        return transfer

    def phone_decide_transfer(self, device_key, transfer_id, accepted):
        with self._lock:
            self._expire_if_needed_locked()
            transfer = self._find_transfer_locked(transfer_id, device_key)
            if not transfer or transfer["direction"] != "desktop_to_phone" or transfer["status"] != "offered":
                raise ValueError("Transfer offer is unavailable.")
            transfer["status"] = "accepted" if accepted else "rejected"
            if not accepted:
                self._remove_outgoing_file(transfer)
            return self._public_transfer(transfer)

    def verify_desktop_transfer(self, device_key, transfer_id, body):
        if (set(body) != {"protocol", "sha256"} or type(body.get("protocol")) is not int
                or body["protocol"] != PROTOCOL_VERSION or not isinstance(body.get("sha256"), str)
                or not _SHA256_RE.fullmatch(body["sha256"])):
            raise ValueError("Invalid transfer completion message.")
        with self._lock:
            self._expire_if_needed_locked()
            transfer = self._find_transfer_locked(transfer_id, device_key)
            if not transfer or transfer["direction"] != "desktop_to_phone":
                raise ValueError("Transfer is not awaiting verification.")
            # A parallel download can finish its last range a few milliseconds
            # before this acknowledgement arrives; accept complete coverage.
            if transfer["status"] == "transferring" and self._coverage(transfer) >= transfer["size"]:
                transfer["status"] = "awaiting_verification"
                transfer["bytes_transferred"] = transfer["size"]
            if transfer["status"] != "awaiting_verification":
                raise ValueError("Transfer is not awaiting verification.")
            if not hmac.compare_digest(body["sha256"], transfer["sha256"]):
                transfer["status"] = "failed"
                transfer["error"] = "Recipient SHA-256 verification failed."
                self._remove_outgoing_file(transfer)
                return self._public_transfer(transfer)
            transfer["status"] = "completed"
            transfer["verified_at"] = int(time.time())
            self._remove_outgoing_file(transfer)
            return self._public_transfer(transfer)

    def decide_local_transfer(self, transfer_id, accepted):
        with self._lock:
            self._expire_if_needed_locked()
            transfer = self._find_transfer_locked(transfer_id)
            if not transfer or transfer["direction"] != "phone_to_desktop" or transfer["status"] != "offered":
                raise ValueError("Incoming transfer is unavailable.")
            if accepted:
                directory_fd = self._check_destination(transfer["size"])
                os.close(directory_fd)
                transfer["status"] = "accepted"
            else:
                transfer["status"] = "rejected"
            return self._public_transfer(transfer)

    def create_desktop_transfer(self, name, size, device_name):
        name = safe_filename(name)
        size = _validate_size(size)
        with self._lock:
            self._expire_if_needed_locked()
            if not self._state:
                raise ValueError("Start a Connect session and pair a phone first.")
            matching = [item for item in self._device_tokens.values() if item.get("paired") and item["name"] == device_name]
            if not matching:
                raise ValueError("Choose a currently paired phone.")
            if self._active_transfers_locked() >= 20:
                raise ValueError("The session already has 20 active transfers.")
            if not self._tempdir:
                raise ValueError("The secure session storage is unavailable.")
            free = shutil.disk_usage(self._tempdir.name).free
            if free < size + 8 * 1024 * 1024:
                raise OSError("There is not enough free space to prepare this file.")
            # The map key is already the SHA-256 digest of the device credential.
            device_key = next(key for key, item in self._device_tokens.items() if item is matching[0])
            transfer_id = secrets.token_urlsafe(18)
            outgoing_path = os.path.join(self._tempdir.name, f"outgoing-{transfer_id}.bin")
            fd = os.open(outgoing_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0), 0o600)
            os.close(fd)
            transfer = self._new_transfer_locked(
                direction="desktop_to_phone", name=name, size=size, digest=None,
                device_key=device_key, device_name=device_name, status="source_uploading",
                source_path=outgoing_path, source_hasher=hashlib.sha256(), transfer_id=transfer_id,
            )
            if size == 0:
                transfer["sha256"] = hashlib.sha256(b"").hexdigest()
                transfer["status"] = "offered"
            return self._public_transfer(transfer)

    def write_desktop_source_chunk(self, transfer_id, start, total, length, reader):
        if length < 0 or length > LOCAL_CHUNK_BYTES:
            raise ValueError("Source chunk must be at most 1 MiB.")
        with self._lock:
            self._expire_if_needed_locked()
            transfer = self._find_transfer_locked(transfer_id)
            if not transfer or transfer["direction"] != "desktop_to_phone" or transfer["status"] != "source_uploading":
                raise ValueError("File preparation is no longer active.")
            source_lock = transfer["source_lock"]
        with source_lock:
            with self._lock:
                transfer = self._find_transfer_locked(transfer_id)
                if not transfer or transfer["status"] != "source_uploading":
                    raise ValueError("File preparation is no longer active.")
                if total != transfer["size"] or start != transfer["bytes_transferred"] or start + length > total:
                    raise ValueError("Source chunk range is invalid or out of order.")
                path = transfer["source_path"]
                hasher = transfer["source_hasher"]
                transfer["cancel_event"].clear()
            remaining = length
            fd = os.open(path, os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0))
            try:
                os.lseek(fd, start, os.SEEK_SET)
                while remaining:
                    block = reader.read(min(LOCAL_CHUNK_BYTES, remaining))
                    if not block:
                        raise ValueError("Source chunk ended before its declared length.")
                    offset = 0
                    while offset < len(block):
                        offset += os.write(fd, block[offset:])
                    hasher.update(block)
                    remaining -= len(block)
            except Exception:
                try:
                    self.cancel_local_transfer(transfer_id)
                except ValueError:
                    pass
                raise
            finally:
                os.close(fd)
            with self._lock:
                transfer = self._find_transfer_locked(transfer_id)
                if not transfer or transfer["cancel_event"].is_set():
                    raise ValueError("File preparation was canceled.")
                transfer["bytes_transferred"] += length
                transfer["source_bytes"] = transfer["bytes_transferred"]
                if transfer["bytes_transferred"] == total:
                    transfer["sha256"] = hasher.hexdigest()
                    del transfer["source_hasher"]
                    transfer["status"] = "offered"
                    transfer["bytes_transferred"] = 0
                return self._public_transfer(transfer)

    def receive_phone_file(self, device_key, transfer_id, content_length, reader):
        with self._lock:
            self._expire_if_needed_locked()
            transfer = self._find_transfer_locked(transfer_id, device_key)
            if not transfer or transfer["direction"] != "phone_to_desktop" or transfer["status"] != "accepted":
                raise ValueError("Incoming transfer has not been approved.")
            if content_length != transfer["size"]:
                transfer["status"] = "failed"
                transfer["error"] = "Content-Length did not match the offered file size."
                raise ValueError(transfer["error"])
            transfer["status"] = "transferring"
            transfer["cancel_event"].clear()

        try:
            directory_fd = self._check_destination(transfer["size"])
        except OSError as exc:
            with self._lock:
                transfer["status"] = "failed"
                transfer["error"] = str(exc)
            raise
        part_name = f".omachy-{transfer_id}.part"
        transfer["part_name"] = part_name
        fd = None
        final_name = None
        final_link_created = False
        part_identity = None
        try:
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
            fd = os.open(part_name, flags, 0o600, dir_fd=directory_fd)
            hasher = hashlib.sha256()
            remaining = content_length
            with os.fdopen(fd, "wb", closefd=True) as output:
                fd = None
                while remaining:
                    if transfer["cancel_event"].is_set():
                        raise InterruptedError("Transfer canceled.")
                    block = reader.read(min(TRANSFER_CHUNK_BYTES, remaining))
                    if not block:
                        raise EOFError("Connection ended before the offered file was complete.")
                    output.write(block)
                    hasher.update(block)
                    remaining -= len(block)
                    with self._lock:
                        transfer["bytes_transferred"] = content_length - remaining
                output.flush()
                os.fsync(output.fileno())

            actual = hasher.hexdigest()
            if not hmac.compare_digest(actual, transfer["sha256"]):
                raise ValueError("SHA-256 digest mismatch; the incomplete file was discarded.")

            with self._lock:
                if self._transfers.get(transfer_id) is not transfer or transfer["cancel_event"].is_set():
                    raise InterruptedError("Transfer canceled or session ended before finalizing the file.")
                part_identity = os.stat(part_name, dir_fd=directory_fd, follow_symlinks=False)
                for _attempt in range(10000):
                    occupied = set(os.listdir(directory_fd))
                    final_name = _unique_filename(transfer["name"], occupied)
                    try:
                        os.link(part_name, final_name, src_dir_fd=directory_fd, dst_dir_fd=directory_fd, follow_symlinks=False)
                        final_link_created = True
                        break
                    except FileExistsError:
                        continue
                else:
                    raise FileExistsError("Could not find an unused filename.")
                os.unlink(part_name, dir_fd=directory_fd)
                if transfer["mtime"] is not None:
                    os.utime(final_name, (transfer["mtime"], transfer["mtime"]), dir_fd=directory_fd, follow_symlinks=False)
                transfer["status"] = "completed"
                transfer["sha256_verified"] = True
                transfer["bytes_transferred"] = content_length
                transfer["saved_path"] = str(self._incoming_dir / final_name)
                transfer.pop("part_name", None)
            return self._public_transfer(transfer)
        except (EOFError, InterruptedError, OSError, ValueError) as exc:
            if final_link_created and final_name and part_identity:
                try:
                    final_identity = os.stat(final_name, dir_fd=directory_fd, follow_symlinks=False)
                    if (final_identity.st_dev, final_identity.st_ino) == (part_identity.st_dev, part_identity.st_ino):
                        os.unlink(final_name, dir_fd=directory_fd)
                except FileNotFoundError:
                    pass
            try:
                os.unlink(part_name, dir_fd=directory_fd)
            except FileNotFoundError:
                pass
            with self._lock:
                transfer["status"] = "canceled" if transfer["cancel_event"].is_set() else "failed"
                transfer["error"] = str(exc)
                transfer.pop("part_name", None)
            if isinstance(exc, OSError):
                raise
            return self._public_transfer(transfer)
        finally:
            if fd is not None:
                os.close(fd)
            os.close(directory_fd)

    def accept_download(self, device_key, transfer_id):
        """Authorize one content stream (full file or byte range).

        Parallel ranged downloads open several streams for the same transfer,
        so a transfer in `transferring` state stays downloadable until every
        byte has been served.
        """
        with self._lock:
            self._expire_if_needed_locked()
            transfer = self._find_transfer_locked(transfer_id, device_key)
            if not transfer or transfer["direction"] != "desktop_to_phone":
                return None
            if transfer["status"] not in {"accepted", "transferring"}:
                return None
            if transfer["status"] == "accepted":
                transfer["status"] = "transferring"
                transfer["bytes_transferred"] = 0
                transfer["served_ranges"] = []
                transfer["stream_ranges"] = {}
            transfer.setdefault("served_ranges", [])
            transfer.setdefault("stream_ranges", {})
            return transfer

    @staticmethod
    def _coverage(transfer):
        """Merged number of distinct bytes served or in flight."""
        intervals = list(transfer.get("served_ranges", ()))
        intervals.extend(transfer.get("stream_ranges", {}).values())
        intervals = sorted((item[0], item[1]) for item in intervals if item[1] >= item[0])
        covered = 0
        current = None
        for start, end in intervals:
            if current is None:
                current = [start, end]
            elif start <= current[1] + 1:
                current[1] = max(current[1], end)
            else:
                covered += current[1] - current[0] + 1
                current = [start, end]
        if current is not None:
            covered += current[1] - current[0] + 1
        return covered

    def stream_desktop_file(self, device_key, transfer_id, handler, range_header=None):
        transfer = self.accept_download(device_key, transfer_id)
        if transfer is None:
            return handler._send(409, {"error": "Transfer must be accepted on the phone first."})
        size = transfer["size"]
        start, end = 0, max(size - 1, 0)
        partial = range_header is not None
        if partial:
            match = re.fullmatch(r"bytes=(\d{1,15})-(\d{0,15})", range_header.strip())
            if not match:
                return handler._send(416, {"error": "Unsupported byte range."})
            start = int(match.group(1))
            end = int(match.group(2)) if match.group(2) else size - 1
            if size == 0 or start > end or start >= size:
                return handler._send(416, {"error": "Requested byte range is outside the file."})
            end = min(end, size - 1)
        length = end - start + 1
        stream_id = id(handler)
        with self._lock:
            transfer["stream_ranges"][stream_id] = [start, start - 1]
        fd = None
        try:
            flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
            fd = os.open(transfer["source_path"], flags)
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_size != size:
                raise OSError("Prepared file is no longer available.")
            handler.send_response(206 if partial else 200)
            handler.send_header("Content-Type", "application/octet-stream")
            handler.send_header("Content-Length", str(length))
            handler.send_header("Accept-Ranges", "bytes")
            if partial:
                handler.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            handler.send_header("X-Omachy-SHA256", transfer["sha256"])
            handler.send_header("X-Omachy-Size", str(size))
            handler.send_header("X-Content-Type-Options", "nosniff")
            handler.send_header("Cache-Control", "no-store")
            handler.send_header("Connection", "close")
            handler.close_connection = True
            handler.end_headers()
            remaining = length
            with os.fdopen(fd, "rb") as source:
                fd = None
                source.seek(start)
                while remaining:
                    if transfer["cancel_event"].is_set():
                        raise InterruptedError("Transfer canceled.")
                    block = source.read(min(TRANSFER_CHUNK_BYTES, remaining))
                    if not block:
                        raise EOFError("Prepared source file ended early.")
                    handler.wfile.write(block)
                    remaining -= len(block)
                    with self._lock:
                        transfer["stream_ranges"][stream_id] = [start, start + length - remaining - 1]
                        transfer["bytes_transferred"] = min(self._coverage(transfer), size)
            with self._lock:
                transfer["stream_ranges"].pop(stream_id, None)
                transfer["served_ranges"].append((start, end))
                covered = min(self._coverage(transfer), size)
                transfer["bytes_transferred"] = covered
                if covered >= size:
                    transfer["status"] = "awaiting_verification"
                    transfer["bytes_transferred"] = size
        except (BrokenPipeError, ConnectionResetError, EOFError, InterruptedError, OSError) as exc:
            with self._lock:
                transfer["stream_ranges"].pop(stream_id, None)
                if transfer["cancel_event"].is_set():
                    transfer["status"] = "canceled"
                    transfer["error"] = "Transfer canceled."
                    self._remove_outgoing_file(transfer)
                else:
                    # Leave the transfer open so the phone can retry a dropped
                    # range instead of failing the whole download.
                    transfer["error"] = str(exc)
                    transfer["bytes_transferred"] = min(self._coverage(transfer), size)
        finally:
            if fd is not None:
                os.close(fd)

    def cancel_transfer(self, device_key, transfer_id):
        with self._lock:
            self._expire_if_needed_locked()
            transfer = self._find_transfer_locked(transfer_id, device_key)
            if not transfer or transfer["status"] in {"completed", "rejected", "canceled", "failed"}:
                raise ValueError("Transfer is no longer active.")
            transfer["cancel_event"].set()
            transfer["status"] = "canceled"
            self._remove_outgoing_file(transfer)
            return self._public_transfer(transfer)

    def cancel_local_transfer(self, transfer_id):
        with self._lock:
            transfer = self._find_transfer_locked(transfer_id)
            if not transfer or transfer["status"] in {"completed", "rejected", "canceled", "failed"}:
                raise ValueError("Transfer is no longer active.")
            transfer["cancel_event"].set()
            transfer["status"] = "canceled"
            self._remove_outgoing_file(transfer)
            return self._public_transfer(transfer)

    def _remove_outgoing_file(self, transfer):
        path = transfer.get("source_path")
        if path:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass

    def _expire_if_needed_locked(self):
        if self._state and self._state.get("expires_at") and time.time() >= self._state["expires_at"]:
            self._cleanup_locked()

    def stop(self):
        with self._lock:
            self._cleanup_locked()

    def _cleanup_locked(self):
        server, self._server = self._server, None
        if self._timer and self._timer is not threading.current_thread():
            self._timer.cancel()
        self._timer = None
        if server:
            try:
                if self._thread and self._thread.is_alive():
                    server.shutdown()
            finally:
                server.server_close()
        for transfer in self._transfers.values():
            transfer["cancel_event"].set()
            part_name = transfer.get("part_name")
            if part_name:
                try:
                    directory_fd = os.open(
                        self._incoming_dir,
                        os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0),
                    )
                    try:
                        os.unlink(part_name, dir_fd=directory_fd)
                    finally:
                        os.close(directory_fd)
                except (FileNotFoundError, NotADirectoryError, OSError):
                    pass
        self._state = None
        self._pair_token = None
        self._pair_requests.clear()
        self._device_tokens.clear()
        self._transfers.clear()
        self._attempts.clear()
        self._thread = None
        if self._tempdir:
            self._tempdir.cleanup()
            self._tempdir = None


phone_sessions = PhoneSessionManager()
