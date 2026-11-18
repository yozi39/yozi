"""Build public/data/templates.json from the `模板题整理/` folder of yozi39/learning_log.

    python scripts/fetch_templates.py

Used by the terminal's `tpl` command. Only that folder is indexed (nothing else in the
repository). Run by scripts/fetch_github.py too, so the Pages build command refreshes it.
On any error it keeps the existing JSON and exits 0.
"""
import datetime as dt
import json
import os
import pathlib
import re
import sys
import urllib.parse
import urllib.request

USER, REPO, FOLDER = "yozi39", "learning_log", "模板题整理/"
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "data" / "templates.json"
MAX_BYTES = 12_000  # skip anything unusually large

# Extra search words so `tpl segment tree`, `tpl dsu` … also find the Chinese file names.
ALIASES = {
    "线段树": "segment tree segtree", "并查集": "dsu union find", "快速幂": "fast pow qpow binpow",
    "背包": "knapsack dp", "筛": "sieve prime", "素数": "prime sieve", "拓扑": "topo topological sort",
    "二分": "binary search bisect", "高精度": "bigint big integer high precision", "最小生成树": "mst",
    "pirm": "prim mst", "kruskal": "mst", "博弈": "game theory", "nim": "game theory", "sg": "game theory grundy",
    "直径": "tree diameter", "重心": "centroid", "差分": "difference prefix", "前缀和": "prefix sum",
    "哈希": "hash", "矩阵": "matrix", "高斯": "gauss elimination", "状压": "bitmask dp", "数位": "digit dp",
    "上升子序列": "lis", "组合数": "combination binomial ncr", "中国剩余定理": "crt", "欧几里得": "exgcd gcd",
    "欧拉回路": "euler circuit", "欧拉路径": "euler path", "欧拉筛": "euler sieve linear sieve", "欧拉定理": "euler theorem",
    "负环": "negative cycle spfa", "堆": "heap priority queue", "trie": "trie", "lca": "lca lowest common ancestor",
    "分层图": "layered graph", "同余最短路": "shortest path modulo", "双指针": "two pointers",
    "离散化": "discretize compress", "迭代加深": "iddfs iterative deepening", "双向": "bidirectional meet in the middle",
    "mitm": "meet in the middle", "st表": "sparse table rmq", "树形dp": "tree dp", "二叉树": "binary tree",
    "遍历": "traversal", "归并": "merge sort recursion", "快速读写": "fast io int128", "带权": "weighted",
    "扩展域": "extended domain", "01分数规划": "fractional programming", "秦九韶": "horner", "贪心": "greedy",
    "dijkstra": "shortest path", "spfa": "shortest path", "bellman": "shortest path", "floyd": "shortest path all pairs",
    "kmp": "string match", "manacher": "palindrome string", "哈曼": "huffman", "tsp": "travelling salesman",
}


def get(url, accept=None):
    headers = {"User-Agent": "yozi.win-build"}
    if accept:
        headers["Accept"] = accept
    token = os.environ.get("GITHUB_TOKEN")
    if token and "api.github.com" in url:
        headers["Authorization"] = f"Bearer {token}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=20) as r:
        return r.read()


def main():
    tree = json.loads(get(f"https://api.github.com/repos/{USER}/{REPO}/git/trees/HEAD?recursive=1", "application/vnd.github+json"))
    files = [t for t in tree["tree"] if t["type"] == "blob" and t["path"].startswith(FOLDER)
             and t["path"].endswith((".cpp", ".cc", ".h", ".hpp", ".py")) and t["size"] <= MAX_BYTES]
    items = []
    for f in sorted(files, key=lambda t: t["path"]):
        rel = f["path"][len(FOLDER):]
        raw = get(f"https://raw.githubusercontent.com/{USER}/{REPO}/HEAD/{urllib.parse.quote(f['path'])}")
        code = raw.decode("utf-8", errors="replace").replace("\r\n", "\n").rstrip() + "\n"
        name = re.sub(r"\.(cpp|cc|h|hpp|py)$", "", rel.split("/")[-1])
        group = rel.split("/")[0] if "/" in rel else ""
        low = (name + " " + group).lower()
        keys = " ".join(v for k, v in ALIASES.items() if k in low)
        items.append({
            "name": name, "group": group, "path": f["path"], "keys": keys, "code": code,
            "url": f"https://github.com/{USER}/{REPO}/blob/HEAD/{urllib.parse.quote(f['path'])}",
        })
    if len(items) < 10:
        raise ValueError(f"only {len(items)} templates found")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = {"source": f"https://github.com/{USER}/{REPO}/tree/HEAD/{urllib.parse.quote(FOLDER)}",
            "updated": dt.date.today().isoformat(), "items": items}
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"templates.json: {len(items)} templates, {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"warning: templates not refreshed ({exc}); keeping the existing file", file=sys.stderr)
    sys.exit(0)
