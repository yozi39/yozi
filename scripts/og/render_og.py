"""Regenerate public/assets/social.png (1200x630 Open Graph image).
1. python scripts/og/render_og.py
2. Open http://127.0.0.1:8081/ in a browser; the page draws the image and saves it automatically.
Edit og.html to change the artwork. Mountain paths come from scripts/gen_mountains.py."""
import http.server, pathlib

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent.parent / "public" / "assets" / "social.png"

class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = (HERE / "og.html").read_bytes()
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        data = self.rfile.read(int(self.headers["Content-Length"]))
        OUT.write_bytes(data)
        self.send_response(200); self.end_headers(); self.wfile.write(f"saved {OUT.name} ({len(data)} bytes)".encode())

print("Open http://127.0.0.1:8081/ to render", OUT)
http.server.HTTPServer(("127.0.0.1", 8081), H).serve_forever()
