"""Haftalık özet sayfasının hesabı: takvim haftası ve toplamların birbirini tutması."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai.week_report import shift_week, week_days, week_report, week_start  # noqa: E402

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "week_report_parity.json").read_text(encoding="utf-8"))


def test_hafta_pazartesi_baslar_pazar_biter():
    assert week_start("2026-11-18") == "2026-11-16"  # Çarşamba
    assert week_start("2026-11-22") == "2026-11-16"  # Pazar aynı haftada
    assert week_start("2026-11-23") == "2026-11-23"  # Pazartesi yeni hafta
    assert week_days("2026-12-28")[-1] == "2027-01-03"  # yıl geçişi
    assert shift_week("2026-11-16", 1) == "2026-11-09"


def test_fikstur_python_ile_ayni():
    for c in FIXTURE:
        assert week_report(c["days"], c["start"], c.get("from")) == c["expected"]


def test_fikstur_yeni_olaylari_icerir():
    # Haftalık özetin yeni alanları gerçekten sınanıyor olmalı: hepsi en az bir örnekte sıfırdan büyük.
    exp = [c["expected"] for c in FIXTURE]
    assert any(sum(e["loop_ends"].values()) for e in exp)
    assert any(e["cards_shown"] for e in exp)
    assert any(sum(e["hints"].values()) for e in exp)
    assert any(e["not_helpful"]["card"] for e in exp)
    assert any("from" in c for c in FIXTURE)


def test_baslangic_gunu_oncesi_okunmaz():
    days = {
        "2026-11-10": {"phase": "oneri", "c": {"conversation|chatgpt|kod|1-3|kisa|normal": 6}},
        "2026-11-17": {"phase": "oneri", "c": {"conversation|chatgpt|kod|1-3|kisa|normal": 2,
                                                "loop_end|chatgpt|kod|1-3|birakildi": 1}},
        "2026-11-19": {"phase": "oneri", "c": {"conversation|chatgpt|kod|1-3|kisa|normal": 3,
                                                "loop_end|chatgpt|kod|1-3|toparlandi": 2}},
    }
    r = week_report(days, "2026-11-16", "2026-11-18")
    assert r["conversations"] == 3
    assert r["previous"]["conversations"] == 0
    assert r["loop_ends"] == {"toparlandi": 2, "yeni_sohbet": 0, "birakildi": 0}


def test_toplamlar_birbirini_tutar():
    # Ekranda yan yana duran sayılar aynı kaynaktan gelir; dağılımların toplamı ana sayıya eşit olmalı.
    for c in FIXTURE:
        r = c["expected"]
        assert sum(t["conversations"] for t in r["tasks"]) == r["conversations"]
        assert sum(t["loops"] for t in r["tasks"]) == r["loops"]
        assert sum(x["conversations"] for x in r["lengths"]) == r["conversations"]
        assert sum(x["conversations"] for x in r["platforms"]) == r["conversations"]
        assert sum(d["conversations"] for d in r["days"]) == r["conversations"]
        assert sum(sum(row) for row in r["similar_grid"]) == r["similar_sends"]
        assert all(t["loops"] <= t["conversations"] for t in r["tasks"])
        assert sum(t["loop_ends"] for t in r["tasks"]) <= sum(r["loop_ends"].values())
        assert sum(d["loop_ends"] for d in r["days"]) == sum(r["loop_ends"].values())
        assert sum(r["strips_by_task"].values()) <= r["strips"]["benzer"]


def test_hafta_disindaki_gunler_sayilmaz():
    days = {
        "2026-11-15": {"phase": "oneri", "c": {"conversation|chatgpt|kod|1-3|kisa|dongu": 4}},  # önceki Pazar
        "2026-11-16": {"phase": "oneri", "c": {"conversation|chatgpt|kod|1-3|kisa|normal": 2}},
        "2026-11-23": {"phase": "oneri", "c": {"conversation|chatgpt|kod|1-3|kisa|normal": 9}},  # sonraki Pazartesi
    }
    r = week_report(days, "2026-11-16")
    assert r["conversations"] == 2 and r["loops"] == 0
    assert r["previous"] == {"conversations": 4, "loops": 4, "strips_benzer": 0}
    assert r["days"][0]["conversations"] == 2
    assert r["enough"] is False
