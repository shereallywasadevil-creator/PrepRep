"""Run PrepRep's screens in a normal browser while you build them:

    python tools/devserver.py      then open http://127.0.0.1:8790

Answers the same requests as Engine.cs (ping, load, save), so the page behaves like the real app.
Add a branch here whenever you add a case to Engine.HandleAsync."""
import json
import os
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

WEB = next((Path(__file__).resolve().parent.parent / "src").glob("*/web"))
DATA = Path(tempfile.gettempdir()) / "PrepRep_dev_data.json"


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        f = (WEB / (self.path.split("?")[0].lstrip("/") or "index.html")).resolve()
        if WEB not in f.parents or not f.is_file():
            return self.send_error(404)
        types = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css"}
        self.send(f.read_bytes(), types.get(f.suffix, "application/octet-stream"))

    def do_POST(self):
        p = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        kind = self.path.rsplit("/", 1)[-1]
        if kind == "ping":
            return self.send({"ok": True, "version": "dev"})
        if kind == "load":
            try:
                return self.send(json.loads(DATA.read_text()))
            except (OSError, ValueError):
                return self.send({})
        if kind == "save":
            try:
                cur = json.loads(DATA.read_text())
            except (OSError, ValueError):
                cur = {}
            cur.update(p.get("data") or {})
            DATA.write_text(json.dumps(cur))
            return self.send({"ok": True})
        if kind in ("logic", "brain"):              # runs the brain file like Logic.cs does
            brain = os.environ.get("PREPREP_BRAIN", r"C:\LocalAI\app\prepwise.py")
            if not os.path.exists(brain):
                return self.send({"missing": True} if kind == "logic" else {"source": None, "functions": []})
            runner = (Path(__file__).resolve().parent.parent / "src" / "PrepRep" / "Logic.cs").read_text().split('@"', 2)[2].split('";', 1)[0].replace('""', '"')
            req = {"path": brain, "fn": "__list__" if kind == "brain" else p.get("fn", ""), "args": p.get("args", [])}
            out = subprocess.run([sys.executable, "-E", "-s", "-c", runner], input=json.dumps(req), capture_output=True, text=True).stdout.strip().splitlines()[-1]
            r = json.loads(out)
            return self.send({"source": brain, "functions": r.get("ok", [])} if kind == "brain" else r)
        self.send({"error": f"The app doesn't know how to do '{kind}' yet."})


if __name__ == "__main__":
    print("PrepRep dev server: http://127.0.0.1:8790")
    ThreadingHTTPServer(("127.0.0.1", 8790), H).serve_forever()
