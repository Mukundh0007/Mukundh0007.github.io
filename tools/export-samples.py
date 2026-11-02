"""Export the live detection demo's sample photos from scikit-image's bundled data.

Licences (from scikit-image's docstrings):
  astronaut.jpg  Eileen Collins, NASA Great Images database: public domain
  chelsea.jpg    Chelsea the cat, photo by Stefan van der Walt: CC0
  coffee.jpg     Coffee cup, photo by Rachel Michetti (Pikolo Espresso Bar): CC0

Usage:  python3 tools/export-samples.py      (needs scikit-image and Pillow)
"""
import pathlib

import skimage.data
from PIL import Image

OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "samples"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ("astronaut", "chelsea", "coffee"):
        img = Image.fromarray(getattr(skimage.data, name)()).convert("RGB")
        img.thumbnail((640, 640), Image.LANCZOS)
        path = OUT / f"{name}.jpg"
        img.save(path, "JPEG", quality=82, optimize=True, progressive=True)
        print(path.name, img.size, path.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
