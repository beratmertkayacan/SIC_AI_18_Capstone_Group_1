"""Anlam desteği değerlendiricisinin Python ikizi (sunucuda server/lib/judge.ts).

İstem, şema ve sınırlar tek kaynaktan, server/judge-spec.json dosyasından okunur. Buradaki işlevler
sunucudakilerle birebir aynı metni üretmek zorunda; tests/test_judge.py ve server/lib/judge.parity.test.ts
aynı fikstürü (tests/fixtures/judge_parity.json) okur. Böylece çevrimdışı değerlendirmede modele giden
metin ile eklentideki gerçek kullanımda giden metin aynı olur.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

SPEC_PATH = Path(__file__).resolve().parents[2] / "server" / "judge-spec.json"
SPEC = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
_S = SPEC["sinirlar"]


def turlari_al(body) -> list[dict] | None:
    """Gövdeyi doğrular; geçersizse None. Fazla turlar baştan atılır, uzun metinler kesilir."""
    if not isinstance(body, dict):
        return None
    raw = body.get("turlar")
    if not isinstance(raw, list) or not raw:
        return None
    turlar = []
    for t in raw:
        if not isinstance(t, dict):
            return None
        rol, metin = t.get("rol"), t.get("metin")
        if rol not in ("k", "a") or not isinstance(metin, str):
            return None
        sinir = _S["kullanici_mesaji_karakter"] if rol == "k" else _S["asistan_cevabi_karakter"]
        turlar.append({"rol": rol, "metin": _js_slice(metin, sinir)})
    son = turlar[-_S["en_fazla_tur"]:]
    return son if any(t["rol"] == "k" for t in son) else None


def sohbet_metni(turlar: list[dict]) -> str:
    """Modele giden kullanıcı içeriği. Tur numaraları 1'den başlar; son kullanıcı mesajı işaretlenir."""
    son_k = max((i for i, t in enumerate(turlar) if t["rol"] == "k"), default=-1)
    satirlar = []
    for i, t in enumerate(turlar):
        kim = ("SON kullanıcı mesajı" if i == son_k else "Kullanıcı") if t["rol"] == "k" else "Asistan"
        satirlar.append(f"[Tur {i + 1}] {kim}:\n{t['metin']}")
    return "<sohbet>\n" + "\n\n".join(satirlar) + "\n</sohbet>"


def karar_duzelt(k: dict) -> dict:
    """Modelin cevabını sınırlar: güven 0 ile 1 arasında, metinler kısaltılmış, döngü yoksa metin yok."""
    g = k.get("guven")
    guven = min(1.0, max(0.0, float(g))) if isinstance(g, (int, float)) and math.isfinite(g) else 0.0
    dongu = k.get("dongu") is True
    return {
        **k,
        "guven": guven,
        "dongu": dongu,
        "gerekce": _js_slice(k.get("gerekce", "").strip(), _S["gerekce_karakter"]) if dongu else "",
        "oneri": _js_slice(k.get("oneri", "").strip(), _S["oneri_karakter"]) if dongu else "",
    }


def _js_slice(s: str, n: int) -> str:
    """JavaScript'in String.slice'ı UTF-16 birimiyle keser; emoji gibi karakterlerde aynı sonuç için."""
    b = s.encode("utf-16-le")
    if len(b) <= 2 * n:
        return s
    return b[: 2 * n].decode("utf-16-le", errors="ignore")


# --- Kartın kuralı (eklentide extension/src/core/judge.ts: judgeAction ve repeatKind) ---------------------
# Eşikler ve mod eklentinin ayar dosyasından okunur; değerlendirme betiği kartları bu işlevle hesaplar,
# böylece ölçülen kural eklentide çalışan kuralla aynıdır (parite: tests/fixtures/judge_action_parity.json).
EKLENTI_AYAR = json.loads((Path(__file__).resolve().parents[2] / "extension" / "src" / "data" / "judge.json").read_text(encoding="utf-8"))


def tekrar_turu(k: dict) -> str | None:
    """Aynı istek kartı: aynı istek ya da aynı bilgiye dönüş VE son cevap yeni bilgi vermedi; önceki cevap
    açıkça karşılamadıysa her durumda. Döner: "cevaplanmis", "karsilanmamis" ya da None."""
    if not (k.get("ayni_istek") is True or k.get("ayni_bilgiye_donus") is True):
        return None
    if k.get("onceki_cevap_karsiladi") == "hayir":
        return "karsilanmamis"
    return None if k.get("son_cevap_yeni_bilgi") is True else "cevaplanmis"


def onaylar(k: dict | None, ayar: dict | None = None) -> bool:
    """confirmsLoop: değerlendirici kartı onayladı mı? "isaret": döngü, tıkanma ya da "karşılamadı" yeterli."""
    a = ayar or EKLENTI_AYAR
    if k is None:
        return False
    if a.get("confirm_rule") == "isaret":
        return k.get("dongu") is True or k.get("tikanma") is True or k.get("onceki_cevap_karsiladi") == "hayir"
    return k.get("dongu") is True and k.get("guven", 0) >= a["confirm_threshold"]


def kart_eylemi(k: dict | None, ayar: dict | None = None, onarim_kelimesi: bool = False) -> dict:
    """judgeAction'ın kart kısmı: döngü kartı (card, loop_card açıksa), anlam onarımı (repair) ve aynı istek kartı (repeat).
    onarim_kelimesi: son kullanıcı mesajı onarım kelimesi taşıyor ve kısa onarım değil."""
    a = ayar or EKLENTI_AYAR
    if k is None:
        return {"card": False, "repair": False, "repeat": None}
    mod = a["mode"] if a["mode"] in ("onay", "ikisi") else "ek_kart"
    acar = mod != "onay"
    gerekce = k.get("gerekce", "").strip() if k.get("dongu") is True else ""
    oneri = k.get("oneri", "").strip() if k.get("dongu") is True else ""
    guven = k.get("guven", 0)
    esik = a["card_threshold_evidence"] if (k.get("tikanma") is True or k.get("ozur_dongusu") is True) else a["card_threshold"]
    card = bool(a.get("loop_card", True)) and acar and k.get("dongu") is True and guven >= esik and gerekce != "" and oneri != ""
    repair = bool(a.get("repair_card", False)) and acar and not card and onarim_kelimesi and k.get("onceki_cevap_karsiladi") == "hayir"
    repeat = None if card or repair or not acar else tekrar_turu(k)
    return {"card": card, "repair": repair, "repeat": repeat}
