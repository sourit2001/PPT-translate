# Worker entrypoint (skeleton)
import os
import time

if __name__ == "__main__":
    print("[worker] started. mode=skeleton")
    interval = int(os.getenv("WORKER_POLL_INTERVAL", "10"))
    try:
        while True:
            print("[worker] heartbeat: idle")
            time.sleep(interval)
    except KeyboardInterrupt:
        print("[worker] stopped")
