"""Anlam desteği: Python ikizi sunucuyla birebir aynı metni ve kararı üretmeli (fikstürü sunucu kodu üretir)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from kafiai.judge import SPEC, karar_duzelt, sohbet_metni, turlari_al  # noqa: E402

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "judge_parity.json").read_text(encoding="utf-8"))


def test_govde_ve_metin_parite():
    for ornek in FIXTURE["govde"]:
        turlar = turlari_al(ornek["girdi"])
        assert turlar == ornek["turlar"]
        assert (sohbet_metni(turlar) if turlar else None) == ornek["metin"]


def test_karar_parite():
    for ornek in FIXTURE["karar"]:
        assert karar_duzelt(ornek["girdi"]) == ornek["cikti"]


def test_sema_istemle_uyumlu():
    # İstemde anlatılan her alan şemada zorunlu olmalı; biri unutulursa model o alanı uydurmaz, hiç vermez.
    alanlar = set(SPEC["sema"]["properties"])
    assert alanlar == set(SPEC["sema"]["required"])
    for alan in alanlar:
        assert f"- {alan}:" in SPEC["sistem"], alan


def test_kart_kurali_eklentiyle_ayni():
    from kafiai.judge import kart_eylemi

    fx = json.loads((Path(__file__).parent / "fixtures" / "judge_action_parity.json").read_text(encoding="utf-8"))
    for o in fx["ornekler"]:
        assert kart_eylemi(o["sonuc"]) == o["beklenen"], o["ad"]
