"""Local preview that mimics Cloudflare Pages: applies public/_headers and serves 404.html.
Usage:  python scripts/serve.py [port]   ->  http://127.0.0.1:8080/
"""
import http.server, pathlib, sys, functools

ROOT = pathlib.Path(__file__).resolve().parent.parent / "public"

def load_headers():
    rules, current = [], None
    for line in (ROOT / "_headers").read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line[0].isspace():
            current = (line.strip(), [])
            rules.append(current)
        elif current and ":" in line:
            k, v = line.strip().split(":", 1)
            current[1].append((k.strip(), v.strip()))
    return rules

def matches(pattern, path):
    if pattern.endswith("*"):
        return path.startswith(pattern[:-1])
    return path == pattern

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml"}

    def end_headers(self):
        path = self.path.split("?")[0]
        for pattern, headers in load_headers():
            if matches(pattern, path):
                for k, v in headers:
                    self.send_header(k, v)
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            body = (ROOT / "404.html").read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().send_error(code, message, explain)

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    handler = functools.partial(Handler, directory=str(ROOT))
    print(f"Serving {ROOT} at http://127.0.0.1:{port}/")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
