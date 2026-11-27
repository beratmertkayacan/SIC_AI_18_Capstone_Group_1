"""Eşik taraması: kart ve halka eşiklerini değiştirmek ne kazandırır, ne kaybettirir?

Eklentinin karar zinciri (scripts/evaluate_replay.py, "sonra") WildFeedback'te aynen oynatılır; her adayda
yalnızca bir ya da birkaç eşik değişir. Tur modelinin olasılığı önbellekten okunur (evaluate_stage3), seviye
("öneri", "yüksek") adayın eşiğiyle yeniden hesaplanır; böylece model yeniden çalıştırılmadan eşik denenir.

Ölçütler: kart 100 sohbette, isabet (kart turunda ya da sonrakinde memnuniyetsizlik), yakalama (tekrarlayan
memnuniyetsizlik yaşanan sohbetlerde kartın ikinci şikayetten önce gelmesi) ve isabetsiz kart (100 sohbette,
memnuniyetsizliğe denk gelmeyen kart). Seçim seçim örnekleminde, doğrulama rapor örnekleminde yapılır.

Çalıştırma:
    python scripts/evaluate_thresholds.py secim                 # bütün adaylar
    python scripts/evaluate_thresholds.py rapor bugun yuksek_0.25 # seçilenler
Çıktı: outputs/thresholds_<orneklem>.json (yalnızca sayılar)
"""
from __future__ import annotations

import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

import evaluate_replay as er  # noqa: E402
from evaluate_stage3 import cached_predictions, load_sample  # noqa: E402
from kafiai import config  # noqa: E402
from kafiai.text import has_strong_repair  # noqa: E402
from kafiai.turn_model import load_model, load_reasons  # noqa: E402

MODEL = load_model()
CUTS = MODEL["thresholds"]

# Her aday: değişen eşikler. Anlamları:
#   yuksek      tur modelinin "yüksek" eşiği (kart); bugün 0,30
#   oneri       "öneri" eşiği (halka 1 ve uzun sohbet kartının model şartı); bugün 0,1677
#   kanit       yüksek seviye için sohbette en az bir onarım ifadesi şartı; bugün açık
#   bekleme     kart kapanınca yeni kart için beklenen tur; K53 ile 5 → 3 (tarama bu karardan önce 5 tabanıyla yapıldı)
#   benzerlik   3-gram benzer mesaj eşiği; bugün 0,80
#   ozur        özür kartı için üst üste özürlü cevap; bugün 2
ADAYLAR: dict[str, dict] = {
    "bugun": {},
    "yuksek_0.20": {"yuksek": 0.20},
    "yuksek_0.25": {"yuksek": 0.25},
    "yuksek_0.35": {"yuksek": 0.35},
    "kanitsiz_0.30": {"kanit": False},
    "kanitsiz_0.35": {"kanit": False, "yuksek": 0.35},
    "bekleme_5": {"bekleme": 5},
    "bekleme_3": {"bekleme": 3},
    "bekleme_2": {"bekleme": 2},
    "benzerlik_0.75": {"benzerlik": 0.75},
    "benzerlik_0.70": {"benzerlik": 0.70},
    "oneri_0.14": {"oneri": 0.14},
    "yuksek_0.25+bekleme_3": {"yuksek": 0.25, "bekleme": 3},
}


def seviye(p: dict | None, kanit_var: bool, a: dict) -> dict | None:
    """Önbellekteki tahminin seviyesini adayın eşikleriyle yeniden hesaplar (turn_model.predict ile aynı kural)."""
    if p is None:
        return None
    yuksek = a.get("yuksek", CUTS["yuksek_guven"])
    oneri = a.get("oneri", CUTS["oneri"])
    sart = kanit_var or not a.get("kanit", True)
    level = "yuksek" if p["probability"] >= yuksek and sart else "oneri" if p["probability"] >= oneri else "dusuk"
    return dict(p, level=level)


_VERI = None


def _yukle(orneklem: str):
    global _VERI
    if _VERI is None:
        df = load_sample(orneklem)
        preds = cached_predictions(df, orneklem, MODEL, load_reasons())
        satirlar = []
        for cid, msgs, ans, ds in zip(df.conv_id, df.user_msgs, df.assistant_msgs, df.dsat_turns):
            msgs = [str(m or "") for m in msgs]
            ans = [str(a or "") for a in ans]
            # Kanıt şartı: 2. mesajdan o tura kadar en az bir güçlü onarım ifadesi (turn_features n_strong_repairs >= 1).
            kanit, gorulen = [], False
            for i, m in enumerate(msgs):
                gorulen = gorulen or (i > 0 and has_strong_repair(m))
                kanit.append(gorulen)
            satirlar.append((msgs, ans, {int(x) for x in ds}, preds[cid], kanit))
        _VERI = satirlar
    return _VERI


def oynat(args: tuple[str, str]) -> tuple[str, dict]:
    orneklem, ad = args
    a = ADAYLAR[ad]
    config.EXT_EXIT_CARD_COOLDOWN_TURNS = a.get("bekleme", 3)
    config.EXT_SIMILARITY_THRESHOLD = a.get("benzerlik", 0.8)
    config.EXT_APOLOGY_CARD_STREAK = a.get("ozur", 2)
    tally = er.Tally()
    for msgs, ans, ds, preds, kanit in _yukle(orneklem):
        p2 = [seviye(p, k, a) for p, k in zip(preds, kanit)]
        tally.add(er.replay(msgs, ans, MODEL, None, "sonra", p2), ds, len(msgs))
    r = tally.result()
    k = r["kart"]
    return ad, {
        "kart_100": k["100_sohbette"], "kart_isabet": k["isabet_yuzde"],
        "yakalama": k["tekrarlayan_memnuniyetsizlikte_yakalama_yuzde"],
        "isabetsiz_100": round(k["100_sohbette"] * (1 - (k["isabet_yuzde"] or 0) / 100), 2),
        "isabetli_100": round(k["100_sohbette"] * (k["isabet_yuzde"] or 0) / 100, 2),
        "kaynak": {s: [v["sayi"], v["isabet_yuzde"]] for s, v in k["kaynaga_gore"].items()},
        "halka2_tur": r["halka"]["seviye2_tur_yuzde"], "halka2_isabet": r["halka"]["seviye2_isabet_yuzde"],
        "halka1_tur": r["halka"]["seviye1_ve_ustu_tur_yuzde"],
        "serit_100": r["serit"]["100_sohbette"], "serit_isabet": r["serit"]["isabet_yuzde"],
    }


def main():
    orneklem = sys.argv[1]
    secilen = sys.argv[2:] or list(ADAYLAR)
    with ProcessPoolExecutor(max_workers=min(4, len(secilen))) as ex:
        sonuc = dict(ex.map(oynat, [(orneklem, ad) for ad in secilen]))
    out = ROOT / "outputs" / f"thresholds_{orneklem}.json"
    veri = {"UYARI": "Yalnızca sayılar. Eşik seçimi seçim örnekleminde; rapor örnekleminde yalnızca seçilenler koşulur.",
            "orneklem": orneklem, "adaylar": {ad: ADAYLAR[ad] for ad in secilen}, "sonuc": sonuc}
    out.write_text(json.dumps(veri, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for ad, v in sonuc.items():
        print(f"{ad:24s} kart {v['kart_100']:6} isabet {v['kart_isabet']:6} yakalama {v['yakalama']:6} "
              f"isabetli {v['isabetli_100']:5} isabetsiz {v['isabetsiz_100']:6} halka2 {v['halka2_tur']}/{v['halka2_isabet']}")


if __name__ == "__main__":
    main()
