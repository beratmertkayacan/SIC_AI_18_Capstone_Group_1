"""Kâfi logosundan eklenti simgelerini üretir.

Kaynak, tasarım panosundaki uygulama simgesinin kendisidir (`brand/logo-kaynak.png`): düz bir zemin
(koyu, beyaz ya da saydam) üzerinde yuvarlak köşeli kahverengi kare ve krem rengi yaylar. Betik kareyi zeminden ayırır, köşelerin
dışını saydam yapar, kareyi saydam bir kareye ortalar ve Chrome'un istediği boyutlarda kaydeder.
Simgeler bu yüzden logonun birebir kendisidir; elle çizilmiş bir benzeri değildir.

Çalıştırma (repo kökünde; Pillow ve numpy gerekir, ikisi de requirements.txt içinde):
    python scripts/make_brand_assets.py
    python scripts/make_brand_assets.py --source baska/yol/logo.png
Çıktı: extension/public/icons/icon16.png, icon32.png, icon48.png, icon128.png ve logo256.png
"""

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "brand" / "logo-kaynak.png"
OUT_DIR = ROOT / "extension" / "public" / "icons"
SIZES = {"icon16.png": 16, "icon32.png": 32, "icon48.png": 48, "icon128.png": 128, "logo256.png": 256}
# Kare zeminden en az bu kadar farklı (0 ile 255 arası parlaklık farkı)
THRESHOLD = 12


def extract_square(img):
    """Koyu zeminden ayrılan yuvarlak köşeli kareyi saydam köşeli RGBA olarak döner."""
    rgb = np.asarray(img.convert("RGB")).astype(np.int16)
    lum = rgb.mean(axis=2)
    if img.mode in ("RGBA", "LA"):
        lum = np.where(np.asarray(img.convert("RGBA"))[..., 3] < 128, 0, lum)  # saydam pikseller zemin sayılır
    h, w = lum.shape
    corners = [lum[:20, :20], lum[:20, -20:], lum[-20:, :20], lum[-20:, -20:]]
    background = float(np.median(np.concatenate([c.ravel() for c in corners])))
    # Zemin koyuysa kare ondan açıktır, açıksa (beyaz) kare ondan koyudur. Yön sabit tutulur ki karenin
    # altındaki gölge (zeminden de koyu) kareye katılmasın.
    bright = lum > background + THRESHOLD if background < 128 else lum < background - THRESHOLD
    # Zemin, köşelerden başlayıp yalnızca koyu piksellerden geçerek ulaşılabilen alandır. Karenin içindeki
    # koyu kısımlar açık renkli kenarla çevrili olduğu için zemine karışmaz.
    flood = Image.fromarray((bright * 255).astype(np.uint8)).copy()
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if flood.getpixel(seed) == 0:
            ImageDraw.floodfill(flood, seed, 128)
    mask = np.asarray(flood) != 128
    rows, cols = np.where(mask.any(axis=1))[0], np.where(mask.any(axis=0))[0]
    if len(rows) == 0 or len(cols) == 0:
        raise ValueError("Logo zeminden ayrılamadı: kaynak görselde düz bir zemin üzerinde kare olmalı.")
    top, bottom, left, right = rows[0], rows[-1] + 1, cols[0], cols[-1] + 1
    crop = rgb[top:bottom, left:right].astype(np.uint8)
    alpha = (mask[top:bottom, left:right] * 255).astype(np.uint8)
    if img.mode in ("RGBA", "LA"):
        # Kaynak zaten saydam köşeliyse (önceden kesilmiş logo), kendi saydamlığı da korunur.
        source_alpha = np.asarray(img.convert("RGBA"))[top:bottom, left:right, 3]
        alpha = np.minimum(alpha, source_alpha)
    # Kenar yumuşatma: maskeyi bir kez küçültüp büyütmek kenardaki tek piksellik basamakları siler.
    a = Image.fromarray(alpha)
    small = a.resize((max(1, a.width // 2), max(1, a.height // 2)), Image.LANCZOS)
    alpha = small.resize(a.size, Image.LANCZOS)
    square = Image.fromarray(crop).convert("RGBA")
    square.putalpha(alpha)
    return square, (left, top, right, bottom), background


def to_canvas(square):
    """Dikdörtgeni saydam bir karenin ortasına koyar (Chrome simgeleri kare olmalı)."""
    side = max(square.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(square, ((side - square.width) // 2, (side - square.height) // 2), square)
    return canvas


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--source", type=Path, default=SOURCE)
    ap.add_argument("--out", type=Path, default=OUT_DIR)
    args = ap.parse_args(argv)
    if not args.source.exists():
        print(f"Kaynak bulunamadı: {args.source}\nLogoyu bu yola kaydet (tasarım panosundaki uygulama simgesi).")
        return 1
    square, box, background = extract_square(Image.open(args.source))
    canvas = to_canvas(square)
    args.out.mkdir(parents=True, exist_ok=True)
    for name, size in SIZES.items():
        icon = canvas.resize((size, size), Image.LANCZOS)
        icon.save(args.out / name, optimize=True)
    left, top, right, bottom = (int(v) for v in box)
    shown = args.out.relative_to(ROOT) if args.out.is_relative_to(ROOT) else args.out
    print(f"Kare bulundu: ({left}, {top}, {right}, {bottom}), zemin parlaklığı {background:.0f}; {len(SIZES)} dosya yazıldı: {shown}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
