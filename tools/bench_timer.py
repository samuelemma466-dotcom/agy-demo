import json
import subprocess
import sys
import time

SIZE = int(sys.argv[1])
ID = sys.argv[2]
started = None
while True:
    out = subprocess.run(["curl", "-s", "--max-time", "3", "http://127.0.0.1:48123/api/connect/session"],
                         capture_output=True, text=True).stdout
    try:
        data = json.loads(out)
    except Exception:
        time.sleep(0.2)
        continue
    record = next((t for t in data["transfers"] if t["id"] == ID), None)
    if record:
        state = record["status"]
        if started is None and record["bytes_transferred"] > 0:
            started = time.time()
        if state in {"completed", "failed", "rejected", "canceled"}:
            break
    time.sleep(0.1)
total = time.time() - started if started else 0
print(f"status={state} elapsed={total:.2f}s rate={SIZE/total/1048576:.2f} MB/s" if total else f"status={state}")
