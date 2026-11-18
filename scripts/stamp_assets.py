"""Add content-hash version tags to CSS/JS URLs so browsers never run a stale copy.

    python scripts/stamp_assets.py

Cloudflare may let browsers cache /assets/* for hours. With `?v=<hash>` on every
reference (HTML <script>/<link> tags and the `import` lines between modules), a changed
file gets a new URL and is fetched fresh, while unchanged files stay cached.
Run it before committing (fetch_github.py also runs it). Safe to run repeatedly.
"""
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent / "public"
JS = ROOT / "assets" / "js"
CSS = ROOT / "assets" / "css" / "site.css"
PAGES = [ROOT / "index.html", ROOT / "404.html"]
IMPORT = re.compile(r"""(from\s+|import\s*\(\s*)(['"])\./([\w-]+\.js)(?:\?v=[0-9a-f]+)?\2""")


def digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:10]


def main():
    sources = {p.name: p.read_text(encoding="utf-8") for p in JS.glob("*.js")}
    deps = {name: set(m.group(3) for m in IMPORT.finditer(src)) for name, src in sources.items()}
    versions = {}

    def stamp(name, seen=()):
        if name in versions:
            return versions[name]
        if name in seen:
            raise SystemExit(f"import cycle through {name}")
        for dep in deps[name]:
            stamp(dep, seen + (name,))
        text = IMPORT.sub(lambda m: f"{m.group(1)}{m.group(2)}./{m.group(3)}?v={versions[m.group(3)]}{m.group(2)}", sources[name])
        if text != sources[name]:
            (JS / name).write_text(text, encoding="utf-8", newline="\n")
        versions[name] = digest(text)
        return versions[name]

    for name in sources:
        stamp(name)
    versions["site.css"] = digest(CSS.read_text(encoding="utf-8"))

    for page in PAGES:
        html = page.read_text(encoding="utf-8")
        new = re.sub(r'(/assets/(?:js|css)/)([\w-]+\.(?:js|css))(?:\?v=[0-9a-f]+)?"',
                     lambda m: f'{m.group(1)}{m.group(2)}?v={versions[m.group(2)]}"' if m.group(2) in versions else m.group(0), html)
        if new != html:
            page.write_text(new, encoding="utf-8", newline="\n")
    print("stamped:", ", ".join(f"{k}={v}" for k, v in sorted(versions.items())))


if __name__ == "__main__":
    main()
