"""Kural ölçümleri (etiketleyici elle saymaz). Kelime sayımı ürünün Python eşindeki count_words ile aynıdır."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
from kafiai.constraint_check import count_words  # noqa: E402


def dolu_satir(text):
    return sum(1 for line in text.splitlines() if line.strip())


def olcumler(turns):
    """Her asistan cevabı için (tur, kelime, dolu satır). Hangi ölçümün önemli olduğu söylenmez."""
    return [(i, count_words(t), dolu_satir(t)) for i, (r, t) in enumerate(turns) if r == "A"]


def kitapcik_bolumu(vid, turns):
    lines = [f"## Vaka {vid}", "", "### Konuşma", ""]
    for i, (r, t) in enumerate(turns):
        label = "YENİ (kullanıcı)" if i == len(turns) - 1 else ("Kullanıcı" if r == "K" else "Asistan")
        lines += [f"**{i}. {label}:**", "", "```text", t, "```", ""]
    if not any(r == "A" for r, _ in turns):
        lines += ["*(Önceki istek ve cevap görünmüyor.)*", ""]
    m = olcumler(turns)
    lines += ["### Kural ölçümü (konuşmanın parçası değildir; alıntılamayın)", ""]
    lines += [f"- Tur {i} asistan cevabı: {w} kelime, {s} dolu satır" for i, w, s in m] or ["- Asistan cevabı yok"]
    return lines + [""]


FORM_COLS = ["vaka", "etiketleyici", "ayni_is", "ayni_istek", "istek_degisimi", "onceki_kosulla_iliski",
             "onceki_cevap_karsiladi", "gerekli_girdi_eksik", "durum", "tikanma", "konusma_alintisi",
             "kural_olcumune_dayandi", "guven", "not"]
