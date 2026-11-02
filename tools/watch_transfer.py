"""Poll one transfer and report its throughput from desktop coverage."""
import json
import subprocess
import sys
import time

ID = sys.argv[1]
DURATION = float(sys.argv[2]) if len(sys.argv) > 2 else 180.0
started = None
last_bytes = 0
last_time = None
deadline = time.time() + DURATION
state = "unknown"
while time.time() < deadline:
    out = subprocess.run(
        ["curl", "-s", "--max-time", "3", "http://127.0.0.1:48123/api/connect/session"],
        capture_output=True, text=True,
    ).stdout
    try:
        data = json.loads(out)
    except Exception:
        time.sleep(0.5)
        continue
    record = next((t for t in data["transfers"] if t["id"] == ID), None)
    if record is None:
        break
    state = record["status"]
    now = time.time()
    served = record["bytes_transferred"]
    if served > 0 and started is None:
        started = now
    if started and last_time and now > last_time:
        rate = (served - last_bytes) / (now - last_time) / 1048576
        print(f"{now - started:6.1f}s {state:22s} {served/1048576:8.1f} MiB {rate:5.2f} MB/s", flush=True)
    last_bytes, last_time = served, now
    if state in {"completed", "failed", "rejected", "canceled"}:
        break
    time.sleep(1)
elapsed = time.time() - started if started else 0
if elapsed and last_bytes:
    print(f"RESULT status={state} elapsed={elapsed:.1f}s avg={last_bytes/elapsed/1048576:.2f} MB/s")
else:
    print(f"RESULT status={state}")
