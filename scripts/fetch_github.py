"""Refresh the real GitHub numbers shown on the home page.

    python scripts/fetch_github.py

Reads public data for USER (the CURATED repositories and the public contribution
calendar) and rewrites the blocks in public/index.html that sit
between <!-- gh:NAME --> and <!-- /gh:NAME --> markers.

Safe to use as the Cloudflare Pages build command: on any network / parse error it
prints a warning and leaves index.html unchanged (the committed snapshot is shown),
and it always exits 0. Set GITHUB_TOKEN to raise the API rate limit (optional).
"""
import datetime as dt
import html
import json
import os
import pathlib
import re
import sys
import urllib.request

USER = "yozi39"
INDEX = pathlib.Path(__file__).resolve().parent.parent / "public" / "index.html"
WEEKS = 53

# Repositories shown on the home page: (repo name, title, subtitle, Chinese subtitle).
# Only these are listed; stars are refreshed from GitHub on every run.
CURATED = [
    ("vscode-coding-time-tracker", "Coding Time Tracker", "VS Code extension · TypeScript", "VS Code 扩展 · TypeScript"),
    ("unity-minesweeper", "Unity Minesweeper", "2D game · Unity / C#", "2D 小游戏 · Unity / C#"),
]


def get(url, accept="application/vnd.github+json"):
    headers = {"User-Agent": "yozi.win-build", "Accept": accept}
    token = os.environ.get("GITHUB_TOKEN")
    if token and "api.github.com" in url:
        headers["Authorization"] = f"Bearer {token}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=20) as r:
        return r.read().decode("utf-8")



def contributions():
    page = get(f"https://github.com/users/{USER}/contributions", accept="text/html")
    total = re.search(r"([\d,]+)\s+contributions?\s+in the last year", page)
    tips = dict(re.findall(r'<tool-tip[^>]*\bfor="([^"]+)"[^>]*>([^<]+)</tool-tip>', page))
    days = []
    for m in re.finditer(r"<td\b[^>]*>", page):
        tag = m.group(0)
        date = re.search(r'data-date="([\d-]+)"', tag)
        level = re.search(r'data-level="(\d)"', tag)
        ident = re.search(r'\bid="([^"]+)"', tag)
        if date and level:
            days.append((date.group(1), int(level.group(1)), tips.get(ident.group(1) if ident else "", "").strip()))
    if not total or len(days) < 300:
        raise ValueError("unexpected contributions page format")
    days.sort()
    return int(total.group(1).replace(",", "")), days


def render_graph(days):
    # Pad the front so the first column starts on Sunday, like GitHub.
    first = dt.date.fromisoformat(days[0][0])
    pad = (first.weekday() + 1) % 7
    cells = ['<i class="gh-pad"></i>'] * pad
    for date, level, tip in days:
        label = html.escape(tip or date, quote=True)
        cells.append(f'<i class="l{level}" title="{label}"></i>')
    return "".join(cells)


def render_repos(repos):
    out = []
    for name, title, sub, sub_zh in CURATED:
        r = repos.get(name)
        if not r:
            continue
        out.append(
            f'<li><a href="{html.escape(r["html_url"], quote=True)}" target="_blank" rel="noopener">'
            f'<svg aria-hidden="true"><use href="#i-github"/></svg>'
            f'<span><b>{html.escape(title)}</b><small data-zh="{html.escape(sub_zh, quote=True)}">{html.escape(sub)}</small></span>'
            f'<em aria-label="{r["stargazers_count"]} stars"><svg aria-hidden="true"><use href="#i-star"/></svg>{r["stargazers_count"]}</em></a></li>'
        )
    return "\n".join(out)


def main():
    repos = {}
    for name, *_ in CURATED:
        repos[name] = json.loads(get(f"https://api.github.com/repos/{USER}/{name}"))
    total, days = contributions()

    blocks = {
        "contrib-total": f"{total:,}",
        "graph": render_graph(days),
        "repo-list": render_repos(repos),
        "updated": dt.date.today().isoformat(),
    }

    text = INDEX.read_text(encoding="utf-8")
    for name, value in blocks.items():
        pattern = re.compile(rf"(<!-- gh:{name} -->)(.*?)(<!-- /gh:{name} -->)", re.S)
        if not pattern.search(text):
            print(f"warning: marker gh:{name} not found", file=sys.stderr)
            continue
        text = pattern.sub(lambda m: m.group(1) + value + m.group(3), text)
    INDEX.write_text(text, encoding="utf-8", newline="\n")
    print(f"GitHub data updated: {len(repos)} curated repos, {total} contributions")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # never fail the deploy because GitHub was unreachable
        print(f"warning: GitHub data not refreshed ({exc}); keeping the committed snapshot", file=sys.stderr)
    sys.exit(0)
