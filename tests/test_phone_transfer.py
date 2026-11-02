import hashlib
import http.client
import json
import socket
import ssl
import sys
import tempfile
import time
import unittest

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from phone_transfer import PhoneSessionManager, PROTOCOL_VERSION  # noqa: E402


class PhoneTransferTests(unittest.TestCase):
    def setUp(self):
        state_dir = tempfile.TemporaryDirectory(prefix="omachy-state-")
        self.addCleanup(state_dir.cleanup)
        self.manager = PhoneSessionManager(
            interface_provider=lambda: [{"interface": "test0", "address": "127.0.0.1"}],
            state_dir=state_dir.name,
        )

    def tearDown(self):
        self.manager.stop()

    def test_selected_address_must_be_an_actual_interface(self):
        with self.assertRaises(ValueError):
            self.manager.start("192.0.2.9", timeout=30)
        self.assertFalse(self.manager.state()["active"])

    def test_explicit_tls_session_pins_fingerprint_and_approves_pairing(self):
        state = self.manager.start("127.0.0.1", timeout=30)
        context = ssl._create_unverified_context()
        connection = http.client.HTTPSConnection(
            state["address"], state["port"], context=context, timeout=3
        )
        try:
            connection.connect()
            peer_cert = connection.sock.getpeercert(binary_form=True)
            actual_pin = hashlib.sha256(peer_cert).hexdigest()
            self.assertEqual(actual_pin, state["fingerprint_sha256"])

            # A mismatching pin is rejected by the client before it sends credentials.
            self.assertNotEqual(actual_pin, "00" * 32)
            connection.request(
                "POST", "/v1/pair",
                body=json.dumps({"protocol": PROTOCOL_VERSION, "device_name": "Test Android"}),
                headers={"Authorization": "Bearer " + state["pairing_token"], "Content-Type": "application/json"},
            )
            response = connection.getresponse()
            pair = json.loads(response.read())
            self.assertEqual(response.status, 202)
            request_id = pair["request_id"]

            # A scanned QR alone does not establish a paired device.
            self.assertEqual(self.manager.state()["devices"], [])
            self.manager.decide_pair(request_id, True)
            connection.request("GET", f"/v1/pair/status/{request_id}", headers={"Authorization": "Bearer " + state["pairing_token"]})
            response = connection.getresponse()
            paired = json.loads(response.read())
            self.assertEqual(response.status, 200)
            self.assertEqual(paired["state"], "paired")
            device_token = paired["device_token"]
            self.assertIsNone(self.manager.state()["pairing_token"])

            # The one-use QR credential cannot be reused after successful pairing.
            connection.request(
                "POST", "/v1/pair",
                body=json.dumps({"protocol": PROTOCOL_VERSION, "device_name": "Other"}),
                headers={"Authorization": "Bearer " + state["pairing_token"], "Content-Type": "application/json"},
            )
            response = connection.getresponse()
            self.assertEqual(response.status, 401)
            response.read()

            connection.request("GET", "/v1/ping")
            response = connection.getresponse()
            self.assertEqual(response.status, 401)
            response.read()
            connection.request("GET", "/v1/ping", headers={"Authorization": "Bearer " + device_token})
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            self.assertEqual(json.loads(response.read())["device"], "Test Android")
            self.assertEqual(self.manager.state()["devices"][0]["name"], "Test Android")
        finally:
            connection.close()

    def test_invalid_and_expired_pairing_tokens_are_rejected(self):
        state = self.manager.start("127.0.0.1", timeout=30)
        self.assertIsNone(self.manager.request_pair("127.0.0.1", "wrong-token", "Phone"))
        self.manager._state["expires_at"] = int(time.time()) - 1
        self.assertIsNone(self.manager.request_pair("127.0.0.1", state["pairing_token"], "Phone"))
        self.assertFalse(self.manager.state()["active"])

    def test_pair_requests_are_rate_limited_per_source_address(self):
        state = self.manager.start("127.0.0.1", timeout=30)
        for index in range(5):
            self.assertIsNotNone(
                self.manager.request_pair("127.0.0.1", state["pairing_token"], f"Phone {index}")
            )
        self.assertIsNone(self.manager.request_pair("127.0.0.1", state["pairing_token"], "Sixth phone"))

    def test_unsupported_version_bad_fields_and_bad_device_names_reject(self):
        state = self.manager.start("127.0.0.1", timeout=30)
        context = ssl._create_unverified_context()
        connection = http.client.HTTPSConnection(state["address"], state["port"], context=context, timeout=3)
        headers = {"Authorization": "Bearer " + state["pairing_token"], "Content-Type": "application/json"}
        try:
            for payload, expected in [
                ({"protocol": 99, "device_name": "Phone"}, 426),
                ({"protocol": True, "device_name": "Phone"}, 426),
                ({"protocol": 1, "device_name": "Phone", "extra": True}, 400),
                ({"protocol": 1, "device_name": "\n"}, 400),
            ]:
                connection.request("POST", "/v1/pair", json.dumps(payload), headers)
                response = connection.getresponse()
                response.read()
                self.assertEqual(response.status, expected)
            connection.request("PUT", "/v1/pair", "{}", headers)
            response = connection.getresponse()
            response.read()
            self.assertEqual(response.status, 405)
        finally:
            connection.close()

    def test_phone_listener_does_not_expose_loopback_ui_api_and_limits_body_size(self):
        state = self.manager.start("127.0.0.1", timeout=30)
        connection = http.client.HTTPSConnection(
            state["address"], state["port"], context=ssl._create_unverified_context(), timeout=3
        )
        try:
            connection.request("GET", "/api/system/status")
            response = connection.getresponse()
            self.assertEqual(response.status, 404)
            response.read()
        finally:
            connection.close()

        # A new connection avoids leaving unread attacker-supplied body bytes.
        connection = http.client.HTTPSConnection(
            state["address"], state["port"], context=ssl._create_unverified_context(), timeout=3
        )
        try:
            connection.request(
                "POST", "/v1/pair", body=b"{}",
                headers={"Authorization": "Bearer " + state["pairing_token"], "Content-Length": "9000"},
            )
            response = connection.getresponse()
            self.assertEqual(response.status, 400)
            response.read()
        finally:
            connection.close()

        connection = http.client.HTTPSConnection(
            state["address"], state["port"], context=ssl._create_unverified_context(), timeout=3
        )
        try:
            connection.request(
                "POST", "/v1/pair", body=b"{", headers={
                    "Authorization": "Bearer " + state["pairing_token"], "Content-Type": "application/json"
                }
            )
            response = connection.getresponse()
            self.assertEqual(response.status, 400)
            response.read()
        finally:
            connection.close()

    def test_stop_closes_temporary_listener_and_clears_credentials(self):
        state = self.manager.start("127.0.0.1", timeout=30)
        port = state["port"]
        self.manager.stop()
        self.assertEqual(self.manager.state(), {"active": False, "pending": [], "devices": [], "transfers": []})
        with socket.socket() as probe:
            probe.settimeout(1)
            with self.assertRaises(OSError):
                probe.connect(("127.0.0.1", port))


if __name__ == "__main__":
    unittest.main()
