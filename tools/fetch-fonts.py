"""Download the site's Google Fonts (latin subset) for self-hosting.

Same files Google Fonts serves for:
  Bricolage Grotesque (opsz 12..96, wght 400..800) and JetBrains Mono (400, 500, 700)
Both are licensed under the SIL Open Font License 1.1.

Usage:  python3 tools/fetch-fonts.py        (writes assets/fonts/*.woff2, prints @font-face CSS)
"""
import pathlib
import re
import urllib.request

CSS_URL = ("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800"
           "&family=JetBrains+Mono:wght@400;500;700&display=swap")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "fonts"
NAMES = {"Bricolage Grotesque": "bricolage-grotesque-latin.woff2", "JetBrains Mono": "jetbrains-mono-latin.woff2"}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30).read()


def main():
    css = get(CSS_URL).decode()
    OUT.mkdir(parents=True, exist_ok=True)
    seen, faces = set(), []
    for subset, body in re.findall(r"/\*\s*([\w-]+)\s*\*/\s*@font-face\s*{([^}]*)}", css):
        if subset != "latin":
            continue
        family = re.search(r"font-family: '([^']+)'", body).group(1)
        weight = re.search(r"font-weight: ([^;]+);", body).group(1)
        url = re.search(r"url\(([^)]+)\)", body).group(1)
        rng = re.search(r"unicode-range: ([^;]+);", body).group(1)
        name = NAMES[family]
        if name not in seen:
            (OUT / name).write_bytes(get(url))
            seen.add(name)
        faces.append((family, weight, name, rng))
    # one @font-face per family: the files are variable fonts covering every weight requested
    for family, name in NAMES.items():
        weights = [w for f, w, _, _ in faces if f == family]
        lo = min(int(w.split()[0]) for w in weights)
        hi = max(int(w.split()[-1]) for w in weights)
        rng = next(r for f, _, _, r in faces if f == family)
        print(f"@font-face {{ font-family: \"{family}\"; font-style: normal; font-weight: {lo} {hi}; font-display: swap;\n"
              f"  src: url(\"fonts/{name}\") format(\"woff2\"); unicode-range: {rng}; }}")
    for name in sorted(seen):
        print(f"/* {name}: {(OUT / name).stat().st_size} bytes */")


if __name__ == "__main__":
    main()
