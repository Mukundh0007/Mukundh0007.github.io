"""Make responsive WebP versions of assets/photo.jpg for the hero <picture>.

Usage:  python3 tools/make-photo-variants.py      (needs Pillow)
Writes assets/photo-320.webp, photo-480.webp, photo-640.webp (4:5, metadata stripped).
"""
import pathlib

from PIL import Image

ASSETS = pathlib.Path(__file__).resolve().parent.parent / "assets"


def main():
    src = Image.open(ASSETS / "photo.jpg").convert("RGB")
    for w in (320, 480, 640):
        out = ASSETS / f"photo-{w}.webp"
        src.resize((w, round(w * 5 / 4)), Image.LANCZOS).save(out, "WEBP", quality=80, method=6)
        print(out.name, out.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
