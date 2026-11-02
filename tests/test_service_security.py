import sys
import io
import re
import tempfile
import unittest
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

import service  # noqa: E402
import system_bridge  # noqa: E402


class ServiceSecurityTests(unittest.TestCase):
    port = 48123

    class Request(service.OmachyRequestHandler):
        def __init__(self, path, body=None, *, origin=None, host=None, fetch_site=""):
            self.path = path
            self.body = body
            self.server = SimpleNamespace(server_port=ServiceSecurityTests.port)
            self.headers = {"Host": host or f"127.0.0.1:{self.server.server_port}"}
            if origin is not None:
                self.headers["Origin"] = origin
            if fetch_site:
                self.headers["Sec-Fetch-Site"] = fetch_site
            self.response_status = None
            self.response_body = None
            self.wfile = io.BytesIO()
            self.response_headers = {}

        def _read_json(self):
            return self.body

        def send_json(self, data, status=200):
            self.response_status = status
            self.response_body = data

        def send_response(self, status):
            self.response_status = status

        def end_headers(self):
            pass

        def send_header(self, key, value):
            self.response_headers[key] = value

    def test_cross_origin_request_is_rejected_before_action(self):
        with patch.object(service, "set_wifi_radio") as action:
            request = self.Request(
                "/api/system/wifi/radio",
                {"enabled": False},
                origin="https://attacker.example",
            )
            request.do_POST()
        self.assertEqual(request.response_status, 403)
        action.assert_not_called()

    def test_missing_origin_is_rejected_for_post(self):
        request = self.Request("/api/system/wifi/radio", {"enabled": False})
        request.do_POST()
        self.assertEqual(request.response_status, 403)

    def test_untrusted_host_is_rejected(self):
        request = self.Request(
            "/api/system/wifi/radio",
            {"enabled": False},
            origin=f"http://127.0.0.1:{self.port}",
            host=f"evil.example:{self.port}",
        )
        request.do_POST()
        self.assertEqual(request.response_status, 403)

    def test_old_arbitrary_shell_endpoint_is_gone(self):
        request = self.Request(
            "/api/jarvis/execute",
            {"command": "touch /tmp/omachy-security-test"},
            origin=f"http://127.0.0.1:{self.port}",
        )
        request.do_POST()
        self.assertEqual(request.response_status, 404)

    def test_unknown_action_and_command_injection_fields_are_rejected(self):
        origin = f"http://127.0.0.1:{self.port}"
        with patch.object(system_bridge.subprocess, "run") as run:
            unknown = self.Request("/api/actions/run", {"action": "unknown"}, origin=origin)
            unknown.do_POST()
            bypass = self.Request(
                "/api/actions/run",
                {"action": "disk_usage", "command": "touch /tmp/omachy-security-test"},
                origin=origin,
            )
            bypass.do_POST()
        self.assertEqual(unknown.response_status, 403)
        self.assertEqual(bypass.response_status, 400)
        run.assert_not_called()

    def test_permitted_action_route_passes_only_action_identifier(self):
        request = self.Request(
            "/api/actions/run",
            {"action": "disk_usage"},
            origin=f"http://127.0.0.1:{self.port}",
        )
        with patch.object(service, "run_allowed_action", return_value={"success": True}) as run:
            request.do_POST()
        self.assertEqual(request.response_status, 200)
        run.assert_called_once_with("disk_usage")

    def test_phone_session_route_rejects_extra_client_parameters(self):
        request = self.Request(
            "/api/connect/session/start",
            {"address": "192.0.2.4", "port": 4444},
            origin=f"http://127.0.0.1:{self.port}",
        )
        with patch.object(service.phone_sessions, "start") as start:
            request.do_POST()
        self.assertEqual(request.response_status, 400)
        start.assert_not_called()

    def test_drop_transfer_chunk_uses_a_bounded_raw_body_on_loopback(self):
        request = self.Request(
            "/api/drop/transfers/AbCdEf0123456789/source",
            origin=f"http://127.0.0.1:{self.port}",
        )
        request.headers.update({
            "Content-Length": "3",
            "X-Omachy-Chunk-Start": "0",
            "X-Omachy-File-Size": "3",
        })
        request.rfile = io.BytesIO(b"abc")
        with patch.object(service.phone_sessions, "write_desktop_source_chunk", return_value={"status": "offered"}) as write_chunk:
            request.do_POST()
        self.assertEqual(request.response_status, 200)
        write_chunk.assert_called_once_with("AbCdEf0123456789", 0, 3, 3, request.rfile)

    def test_drop_folder_alias_returns_directory_listing(self):
        request = self.Request(
            "/api/drop/folder",
            origin=f"http://127.0.0.1:{self.port}",
        )
        with patch.object(service, "get_drop_files", return_value={"dir": "/tmp/omachy-drop", "files": []}) as listing:
            request.do_GET()
        self.assertEqual(request.response_status, 200)
        listing.assert_called_once()

    def test_app_launcher_rejects_unlisted_name(self):
        request = self.Request(
            "/api/app/launch",
            {"app": "../../bin/sh"},
            origin=f"http://127.0.0.1:{self.port}",
        )
        with patch("subprocess.Popen") as popen:
            request.do_POST()
        self.assertEqual(request.response_status, 400)
        popen.assert_not_called()

    def test_staging_rejects_path_traversal(self):
        request = self.Request(
            "/api/drop/stage-file",
            {"filename": "../../outside.txt", "content": "safe test"},
            origin=f"http://127.0.0.1:{self.port}",
        )
        with patch.object(Path, "mkdir") as mkdir:
            request.do_POST()
        self.assertEqual(request.response_status, 400)
        mkdir.assert_not_called()

    def test_staging_replaces_symlink_without_writing_through_it(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            drop_dir = root / "drop"
            drop_dir.mkdir()
            outside = root / "outside.txt"
            outside.write_text("must remain unchanged")
            link = drop_dir / "linked.txt"
            link.symlink_to(outside)
            request = self.Request(
                "/api/drop/stage-file",
                {"filename": "linked.txt", "content": "safe replacement"},
                origin=f"http://127.0.0.1:{self.port}",
            )
            with patch.object(service, "DROP_DIR", drop_dir):
                request.do_POST()
            self.assertEqual(request.response_status, 200)
            self.assertEqual(outside.read_text(), "must remain unchanged")
            self.assertFalse(link.is_symlink())
            self.assertEqual(link.read_text(), "safe replacement")

    def test_permitted_action_uses_fixed_argument_vector_without_shell(self):
        self.assertEqual(
            set(system_bridge.ALLOWED_ACTIONS),
            {
                "process_summary",
                "disk_usage",
                "network_interfaces",
                "user_services",
                "git_status",
                "docker_containers",
            },
        )
        for action_id, expected in system_bridge.ALLOWED_ACTIONS.items():
            with self.subTest(action=action_id):
                with patch.object(system_bridge.shutil, "which", return_value=f"/usr/bin/{expected[0]}"), patch.object(
                    system_bridge.subprocess,
                    "run",
                    return_value=type("Result", (), {"returncode": 0, "stdout": "ok", "stderr": ""})(),
                ) as run:
                    result = system_bridge.run_allowed_action(action_id)
                self.assertTrue(result["success"])
                self.assertEqual(run.call_args.args[0], expected)
                self.assertIs(run.call_args.kwargs["shell"], False)

    def test_built_frontend_assets_are_served_by_local_handler(self):
        index_path = service.DIST_DIR / "index.html"
        self.assertTrue(index_path.is_file(), "Production build is required before this asset test")
        html = index_path.read_text()
        assets = re.findall(r'(?:src|href)="(/assets/[^\"]+\.(?:js|css))"', html)
        self.assertGreaterEqual(len(assets), 2)
        for asset_path in assets:
            with self.subTest(asset=asset_path):
                request = self.Request(asset_path)
                request.do_GET()
                self.assertEqual(request.response_status, 200)
                self.assertTrue(request.wfile.getvalue())

        api_source = (ROOT / "src/services/systemApi.ts").read_text()
        self.assertIn(f"http://127.0.0.1:{service.PORT}", api_source)


if __name__ == "__main__":
    unittest.main()
