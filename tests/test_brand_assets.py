"""Logo betiği: koyu zemindeki yuvarlak köşeli kareyi ayırıp doğru boyutlarda simge üretiyor mu? (uydurma görselle)"""

import importlib.util
from pathlib import Path

import pytest

PIL = pytest.importorskip("PIL")
from PIL import Image, ImageDraw  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("make_brand_assets", ROOT / "scripts" / "make_brand_assets.py")
mba = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mba)


def fake_logo(path):
    img = Image.new("RGB", (400, 400), (30, 18, 8))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((60, 70, 340, 330), radius=60, fill=(55, 32, 14), outline=(110, 70, 35), width=3)
    d.arc((120, 120, 280, 280), 30, 300, fill=(240, 225, 205), width=16)
    img.save(path)


def test_square_found_and_icons_written(tmp_path):
    src = tmp_path / "logo.png"
    fake_logo(src)
    assert mba.main(["--source", str(src), "--out", str(tmp_path / "icons")]) == 0
    for name, size in mba.SIZES.items():
        icon = Image.open(tmp_path / "icons" / name)
        assert icon.size == (size, size) and icon.mode == "RGBA"
    big = Image.open(tmp_path / "icons" / "logo256.png")
    assert big.getpixel((0, 0))[3] == 0          # köşe saydam
    assert big.getpixel((128, 128))[3] == 255    # kare içi (koyu orta kısım dahil) opak


def test_missing_source_returns_error(tmp_path):
    assert mba.main(["--source", str(tmp_path / "yok.png"), "--out", str(tmp_path)]) == 1
