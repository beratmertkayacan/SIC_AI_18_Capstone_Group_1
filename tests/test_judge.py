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
        assert kart_eylemi(o["sonuc"], onarim_kelimesi=o.get("onarim_kelimesi", False)) == o["beklenen"], o["ad"]


def test_kart_kurali_modlar_ve_onay():
    """Ayardaki anahtarlar (loop_card, mode, confirm_rule) Python ikizinde de eklentideki gibi çalışır."""
    from kafiai.judge import EKLENTI_AYAR, kart_eylemi, onaylar

    dongu = {"ayni_istek": False, "dongu": True, "guven": 0.9, "gerekce": "Aynı hata sürüyor.", "oneri": "Hata çıktısını ekle.",
             "tikanma": True, "ozur_dongusu": False, "onceki_cevap_karsiladi": "hayir", "son_cevap_yeni_bilgi": False}
    # Döngü kartı kapalı (varsayılan): onarım kelimesi varsa anlam onarımı kartı, yoksa hiçbir kart.
    assert kart_eylemi(dongu, onarim_kelimesi=True) == {"card": False, "repair": True, "repeat": None}
    assert kart_eylemi(dongu) == {"card": False, "repair": False, "repeat": None}
    # Döngü kartı açık: döngü kartı onarım kartının yerini alır.
    acik = dict(EKLENTI_AYAR, loop_card=True)
    assert kart_eylemi(dongu, acik, onarim_kelimesi=True) == {"card": True, "repair": False, "repeat": None}
    # Onay modu yeni kart açmaz.
    onay = dict(EKLENTI_AYAR, mode="onay", loop_card=True)
    assert kart_eylemi(dongu, onay, onarim_kelimesi=True) == {"card": False, "repair": False, "repeat": None}
    # Onay kuralı: belirtilerden biri yeterli; eski kural güven ister.
    sakin = dict(dongu, dongu=False, tikanma=False, onceki_cevap_karsiladi="evet")
    assert onaylar(dongu) and onaylar(dict(sakin, tikanma=True)) and onaylar(dict(sakin, onceki_cevap_karsiladi="hayir"))
    assert not onaylar(sakin) and not onaylar(None)
    eski = dict(EKLENTI_AYAR, confirm_rule="guven")
    assert onaylar(dongu, eski) and not onaylar(dict(dongu, guven=EKLENTI_AYAR["confirm_threshold"] - 0.01), eski)
