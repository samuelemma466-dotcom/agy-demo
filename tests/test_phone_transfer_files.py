import hashlib
import http.client
import io
import json
import time
import ssl
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from phone_transfer import PhoneSessionManager, PROTOCOL_VERSION  # noqa: E402


class ObservedReader(io.BytesIO):
    def __init__(self, data):
        super().__init__(data)
        self.max_read = 0

    def read(self, size=-1):
        self.max_read = max(self.max_read, size)
        return super().read(size)


class PhoneTransferFileTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="omachy-transfer-test-")
        self.root = Path(self.temp.name)
        self.drop_dir = self.root / "OmachyDrop"
        self.drop_dir.mkdir(mode=0o700)
        state_dir = tempfile.TemporaryDirectory(prefix="omachy-state-")
        self.addCleanup(state_dir.cleanup)
        self.manager = PhoneSessionManager(
            interface_provider=lambda: [{"interface": "loopback-test", "address": "127.0.0.1"}],
            incoming_dir=self.drop_dir,
            state_dir=state_dir.name,
        )
        self.state = self.manager.start("127.0.0.1", timeout=60)
        pending_id = self.manager.request_pair("127.0.0.1", self.state["pairing_token"], "Test Android")
        self.manager.decide_pair(pending_id, True)
        paired = self.manager.pair_status(pending_id, self.state["pairing_token"])
        self.device_token = paired["device_token"]
        self.device_key = self.manager.authenticated_device_key(self.device_token)

    def tearDown(self):
        self.manager.stop()
        self.temp.cleanup()

    def wait_status(self, transfer_id, expected, timeout=3.0):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            status = self.manager.remote_transfer(self.device_key, transfer_id)["status"]
            if status == expected:
                return status
            time.sleep(0.01)
        return self.manager.remote_transfer(self.device_key, transfer_id)["status"]

    def client(self):
        connection = http.client.HTTPSConnection(
            self.state["address"], self.state["port"],
            context=ssl._create_unverified_context(), timeout=5,
        )
        connection.connect()
        fingerprint = hashlib.sha256(connection.sock.getpeercert(binary_form=True)).hexdigest()
        self.assertEqual(fingerprint, self.state["fingerprint_sha256"])
        return connection

    def offer_from_phone(self, name, data, *, expected_hash=None, mtime=None):
        payload = {
            "protocol": PROTOCOL_VERSION,
            "name": name,
            "size": len(data),
            "sha256": expected_hash or hashlib.sha256(data).hexdigest(),
        }
        if mtime is not None:
            payload["mtime"] = mtime
        return self.manager.create_phone_offer(self.device_key, payload)

    def test_phone_to_desktop_requires_explicit_approval_and_verifies_digest(self):
        data = b"a real sequence of bytes\x00" * 10000
        offer = self.offer_from_phone("photo.bin", data, mtime=1700000000)
        self.assertEqual(offer["status"], "offered")
        self.assertEqual(self.manager.local_transfers()[0]["status"], "offered")
        with self.assertRaises(ValueError):
            self.manager.receive_phone_file(self.device_key, offer["id"], len(data), io.BytesIO(data))

        self.manager.decide_local_transfer(offer["id"], True)
        reader = ObservedReader(data)
        result = self.manager.receive_phone_file(self.device_key, offer["id"], len(data), reader)
        saved = self.drop_dir / "photo.bin"
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["bytes_transferred"], len(data))
        self.assertEqual(saved.read_bytes(), data)
        self.assertEqual(hashlib.sha256(saved.read_bytes()).hexdigest(), offer["sha256"])
        self.assertLessEqual(reader.max_read, 256 * 1024)
        self.assertEqual(int(saved.stat().st_mtime), 1700000000)

    def test_invalid_names_and_digest_are_rejected_before_creating_an_offer(self):
        for name in ("../escape", "dir/file.txt", "..", ".hidden", "nul\x00name"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.offer_from_phone(name, b"x")
        with self.assertRaises(ValueError):
            self.manager.create_phone_offer(self.device_key, {
                "protocol": 1, "name": "safe.txt", "size": 1, "sha256": "z" * 64,
            })
        self.assertEqual(self.manager.local_transfers(), [])

    def test_phone_upload_http_route_authenticates_and_streams_bytes(self):
        payload = b"authenticated phone upload" * 2000
        offer_body = json.dumps({
            "protocol": 1, "name": "from-phone.bin", "size": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
        })
        client = self.client()
        try:
            client.request("POST", "/v1/transfers/offers", body=offer_body,
                headers={"Authorization": f"Bearer {self.device_token}", "Content-Type": "application/json"})
            response = client.getresponse()
            offer = json.loads(response.read())
            self.assertEqual(response.status, 202)
        finally:
            client.close()

        self.manager.decide_local_transfer(offer["id"], True)
        unauthorized = self.client()
        try:
            unauthorized.request("PUT", f"/v1/transfers/{offer['id']}/content",
                headers={"Content-Length": str(len(payload))})
            response = unauthorized.getresponse()
            self.assertEqual(response.status, 401)
            response.read()
        finally:
            unauthorized.close()

        client = self.client()
        try:
            client.request("PUT", f"/v1/transfers/{offer['id']}/content", body=payload,
                headers={"Authorization": f"Bearer {self.device_token}", "Content-Type": "application/octet-stream"})
            response = client.getresponse()
            result = json.loads(response.read())
            self.assertEqual(response.status, 200)
            self.assertEqual(result["status"], "completed")
            self.assertEqual(Path(result["saved_path"]).read_bytes(), payload)
        finally:
            client.close()

    def test_existing_symlink_is_not_followed_and_duplicate_names_are_preserved(self):
        outside = self.root / "outside.txt"
        outside.write_text("keep this content")
        (self.drop_dir / "same.txt").symlink_to(outside)
        first = self.offer_from_phone("same.txt", b"first")
        self.manager.decide_local_transfer(first["id"], True)
        self.manager.receive_phone_file(self.device_key, first["id"], 5, io.BytesIO(b"first"))
        second = self.offer_from_phone("same.txt", b"second")
        self.manager.decide_local_transfer(second["id"], True)
        self.manager.receive_phone_file(self.device_key, second["id"], 6, io.BytesIO(b"second"))
        self.assertEqual(outside.read_text(), "keep this content")
        self.assertTrue((self.drop_dir / "same.txt").is_symlink())
        self.assertEqual((self.drop_dir / "same (2).txt").read_bytes(), b"first")
        self.assertEqual((self.drop_dir / "same (3).txt").read_bytes(), b"second")

    def test_mismatched_digest_and_content_length_leave_no_received_file(self):
        offer = self.offer_from_phone("bad.bin", b"expected", expected_hash=hashlib.sha256(b"different").hexdigest())
        self.manager.decide_local_transfer(offer["id"], True)
        result = self.manager.receive_phone_file(self.device_key, offer["id"], 8, io.BytesIO(b"expected"))
        self.assertEqual(result["status"], "failed")
        self.assertFalse((self.drop_dir / "bad.bin").exists())

        other = self.offer_from_phone("wrong-length.bin", b"12345")
        self.manager.decide_local_transfer(other["id"], True)
        with self.assertRaises(ValueError):
            self.manager.receive_phone_file(self.device_key, other["id"], 4, io.BytesIO(b"1234"))
        self.assertFalse((self.drop_dir / "wrong-length.bin").exists())

    def test_interrupted_and_canceled_incoming_files_are_discarded(self):
        interrupted = self.offer_from_phone("partial.bin", b"12345")
        self.manager.decide_local_transfer(interrupted["id"], True)
        result = self.manager.receive_phone_file(self.device_key, interrupted["id"], 5, io.BytesIO(b"12"))
        self.assertEqual(result["status"], "failed")
        self.assertFalse((self.drop_dir / f".omachy-{interrupted['id']}.part").exists())

        canceled = self.offer_from_phone("canceled.bin", b"12345")
        self.manager.decide_local_transfer(canceled["id"], True)
        self.manager.cancel_transfer(self.device_key, canceled["id"])
        with self.assertRaises(ValueError):
            self.manager.receive_phone_file(self.device_key, canceled["id"], 5, io.BytesIO(b"12345"))
        self.assertFalse((self.drop_dir / "canceled.bin").exists())

    def test_desktop_to_phone_stream_waits_for_receiver_sha256_ack(self):
        payload = b"desktop file bytes" * 5000
        record = self.manager.create_desktop_transfer("report.txt", len(payload), "Test Android")
        for offset in range(0, len(payload), 1024 * 1024):
            self.manager.write_desktop_source_chunk(
                record["id"], offset, len(payload), min(1024 * 1024, len(payload) - offset),
                io.BytesIO(payload[offset:offset + 1024 * 1024]),
            )
        self.assertEqual(self.manager.remote_transfer(self.device_key, record["id"])["status"], "offered")
        self.manager.phone_decide_transfer(self.device_key, record["id"], True)
        client = self.client()
        try:
            client.request("GET", f"/v1/transfers/{record['id']}/content", headers={"Authorization": f"Bearer {self.device_token}"})
            response = client.getresponse()
            self.assertEqual(response.status, 200)
            received = response.read()
            self.assertEqual(received, payload)
            digest = hashlib.sha256(received).hexdigest()
            self.assertEqual(response.getheader("X-Omachy-SHA256"), digest)
            self.assertEqual(self.manager.remote_transfer(self.device_key, record["id"])["status"], "awaiting_verification")
            client.request("POST", f"/v1/transfers/{record['id']}/complete",
                body=json.dumps({"protocol": 1, "sha256": digest}),
                headers={"Authorization": f"Bearer {self.device_token}", "Content-Type": "application/json"})
            response = client.getresponse()
            result = json.loads(response.read())
            self.assertEqual(response.status, 200)
            self.assertEqual(result["status"], "completed")
        finally:
            client.close()

    def test_trusted_device_offers_are_accepted_without_a_prompt(self):
        self.assertFalse(next(d for d in self.manager.known_devices() if d["name"] == "Test Android")["auto_accept"])
        offer = self.offer_from_phone("prompted.bin", b"needs approval")
        self.assertEqual(offer["status"], "offered")

        self.manager.set_device_auto_accept("Test Android", True)
        self.assertTrue(next(d for d in self.manager.known_devices() if d["name"] == "Test Android")["auto_accept"])
        trusted = self.offer_from_phone("trusted.bin", b"no prompt")
        self.assertEqual(trusted["status"], "accepted")

    def test_ranged_downloads_serve_parallel_segments_and_complete(self):
        payload = bytes(range(256)) * 4096  # 1 MiB
        record = self.manager.create_desktop_transfer("parallel.bin", len(payload), "Test Android")
        self.manager.write_desktop_source_chunk(record["id"], 0, len(payload), len(payload), io.BytesIO(payload))
        self.manager.phone_decide_transfer(self.device_key, record["id"], True)

        total = len(payload)
        step = total // 3
        segments = [(0, step - 1), (step, 2 * step - 1), (2 * step, total - 1)]
        for index, (start, end) in enumerate(segments):
            client = self.client()
            try:
                client.request("GET", f"/v1/transfers/{record['id']}/content", headers={
                    "Authorization": f"Bearer {self.device_token}",
                    "Range": f"bytes={start}-{end}",
                })
                response = client.getresponse()
                self.assertEqual(response.status, 206)
                self.assertEqual(response.getheader("Content-Range"), f"bytes {start}-{end}/{total}")
                self.assertEqual(response.getheader("Accept-Ranges"), "bytes")
                self.assertEqual(response.getheader("X-Omachy-Size"), str(total))
                self.assertEqual(response.read(), payload[start:end + 1])
            finally:
                client.close()
            if index < len(segments) - 1:
                self.assertNotEqual(self.wait_status(record["id"], "awaiting_verification", 0.2), "awaiting_verification")
        self.assertEqual(self.wait_status(record["id"], "awaiting_verification"), "awaiting_verification")

        result = self.manager.verify_desktop_transfer(self.device_key, record["id"], {
            "protocol": 1, "sha256": hashlib.sha256(payload).hexdigest(),
        })
        self.assertEqual(result["status"], "completed")

    def test_out_of_range_and_malformed_ranges_are_rejected(self):
        payload = b"0123456789"
        record = self.manager.create_desktop_transfer("ranges.txt", len(payload), "Test Android")
        self.manager.write_desktop_source_chunk(record["id"], 0, len(payload), len(payload), io.BytesIO(payload))
        self.manager.phone_decide_transfer(self.device_key, record["id"], True)
        for value in ("bytes=10-", "bytes=5-2", "bytes=abc", "bytes=999-1000"):
            with self.subTest(range=value):
                client = self.client()
                try:
                    client.request("GET", f"/v1/transfers/{record['id']}/content", headers={
                        "Authorization": f"Bearer {self.device_token}", "Range": value,
                    })
                    response = client.getresponse()
                    self.assertEqual(response.status, 416)
                    response.read()
                finally:
                    client.close()

    def test_recipient_hash_mismatch_is_not_reported_as_success(self):
        payload = b"data"
        record = self.manager.create_desktop_transfer("digest.txt", len(payload), "Test Android")
        self.manager.write_desktop_source_chunk(record["id"], 0, len(payload), len(payload), io.BytesIO(payload))
        self.manager.phone_decide_transfer(self.device_key, record["id"], True)
        streamed = self.manager.stream_desktop_file(self.device_key, record["id"], _FakeResponse())
        self.assertIsNone(streamed)
        result = self.manager.verify_desktop_transfer(self.device_key, record["id"], {
            "protocol": 1, "sha256": "0" * 64,
        })
        self.assertEqual(result["status"], "failed")
        self.assertIn("verification failed", result["error"])


class _FakeResponse:
    def __init__(self):
        self.headers = {}
        self.wfile = io.BytesIO()
        self.close_connection = False

    def send_response(self, status):
        self.status = status

    def send_header(self, key, value):
        self.headers[key] = value

    def end_headers(self):
        pass


if __name__ == "__main__":
    unittest.main()
