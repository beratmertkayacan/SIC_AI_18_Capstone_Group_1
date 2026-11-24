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
