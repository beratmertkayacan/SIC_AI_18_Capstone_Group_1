"""Anlam desteği (Claude Haiku değerlendiricisi) çevrimdışı denemesi: açık prova vakaları.

Her vaka için sunucunun modele göndereceği metnin aynısı kurulur (src/kafiai/judge.py, istem ve şema
server/judge-spec.json) ve model çağrılır. Cevaplar önbelleğe yazılır; aynı istem sürümüyle yeniden
çalıştırmak ücret doğurmaz.

İki çıktı:
- Anahtarsız (varsayılan): outputs/judge_prova.json. Yalnızca vaka kimliği ve modelin alanları; vaka metni yok.
- --anahtar ile: modelin alanları cevap anahtarıyla karşılaştırılır. Kıyas anahtar bilgisi taşıdığı için
  depoya değil, anahtarın yanındaki cikti/ klasörüne yazılır. Anahtar modele hiçbir zaman verilmez.

Bu set küçük ve sentetik; sonuçlar istem ayarı için eğilimdir, genel doğruluk değildir.

Çalıştırma:
    python scripts/evaluate_judge.py --kuru            # API çağırmadan ilk vakanın metnini gösterir
    python scripts/evaluate_judge.py                   # ANTHROPIC_API_KEY gerekir
    python scripts/evaluate_judge.py --anahtar ../kafi_kapali_kiyas/beklenen_v0.3.json
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai.judge import SPEC, karar_duzelt, sohbet_metni, turlari_al  # noqa: E402

CACHE = ROOT / "outputs" / "judge_cache"
VAKA_DOSYASI = ROOT / "prova" / "sentetik" / "vakalar_prova.py"
SENARYO_DOSYASI = ROOT / "prova" / "sentetik" / "senaryolar_judge.py"
KART_ESIKLERI = (0.5, 0.6, 0.7, 0.75, 0.8, 0.9)


def _modul(yol: Path):
    spec = importlib.util.spec_from_file_location(yol.stem, yol)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _turlar(turns) -> list[dict]:
    return [{"rol": "k" if r == "K" else "a", "metin": t} for r, t in turns]


def vakalari_yukle() -> dict[str, list[dict]]:
    return {vid: _turlar(turns) for vid, turns in _modul(VAKA_DOSYASI).VAKALAR.items()}


def senaryolari_yukle() -> tuple[dict[str, list[dict]], dict[str, dict]]:
    """Açık senaryo seti (uydurma metinler; etiketler senaryo yazarının niyeti, insan etiketi değil)."""
    s = _modul(SENARYO_DOSYASI).SENARYOLAR
    return {sid: _turlar(v["turlar"]) for sid, v in s.items()}, {sid: {**v["beklenen"], "kategori": v["kategori"]} for sid, v in s.items()}


def senaryo_kiyasla(sonuclar: dict[str, dict], beklenen: dict[str, dict]) -> dict:
    """Döngü kararı, tür ve kart eşiği taraması. Kart: dongu ve guven >= T; beklenen kart_uygun ile kıyaslanır."""
    gecerli = {sid: s["karar"] for sid, s in sonuclar.items() if s["karar"] is not None}
    dongu_hata = [sid for sid, k in gecerli.items() if k["dongu"] != beklenen[sid]["dongu"]]
    tur_hata = [sid for sid, k in gecerli.items() if k["tur"] != beklenen[sid]["tur"]]
    tarama = {}
    for t in KART_ESIKLERI:
        tp = fp = fn = 0
        for sid, k in gecerli.items():
            kart = k["dongu"] and k["guven"] >= t
            uygun = beklenen[sid]["kart_uygun"]
            tp += kart and uygun
            fp += kart and not uygun
            fn += (not kart) and uygun
        tarama[str(t)] = {"dogru_kart": tp, "yersiz_kart": fp, "kacan": fn}
    kategori = {}
    for sid, k in gecerli.items():
        c = kategori.setdefault(beklenen[sid]["kategori"], {"vaka": 0, "dongu_dogru": 0})
        c["vaka"] += 1
        c["dongu_dogru"] += k["dongu"] == beklenen[sid]["dongu"]
    return {
        "dongu": {"dogru": len(gecerli) - len(dongu_hata), "toplam": len(gecerli), "hatalar": dongu_hata},
        "tur": {"dogru": len(gecerli) - len(tur_hata), "toplam": len(gecerli), "hatalar": tur_hata},
        "kategori": kategori,
        "kart_esik_taramasi": tarama,
    }


def parametreler(metin: str) -> dict:
    """Sunucudaki (server/api/judge.ts) istekle aynı parametreler. Toplu değerlendirme de bunu kullanır."""
    p = {
        "model": SPEC["model"],
        "max_tokens": SPEC["max_tokens"],
        "output_config": {"effort": SPEC["effort"], "format": {"type": "json_schema", "schema": SPEC["sema"]}},
        "system": [{"type": "text", "text": SPEC["sistem"], "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": metin}],
    }
    if SPEC.get("dusunme") == "kapali":
        # Haiku 5.5'te düşünme ancak effort high ya da altındayken kapatılabilir; low uygundur.
        p["thinking"] = {"type": "disabled"}
    return p


def _anahtar(metin: str) -> str:
    # Önbellek anahtarı istem, şema, model ve ayarlar değişince değişir; eski cevap yeni sürüme karışmaz.
    h = hashlib.sha256()
    ayarlar = f"{SPEC['model']}|{SPEC['effort']}|{SPEC['max_tokens']}|{SPEC.get('dusunme', 'acik')}"
    for parca in (ayarlar, SPEC["sistem"], json.dumps(SPEC["sema"], sort_keys=True), metin):
        h.update(parca.encode("utf-8"))
    return h.hexdigest()[:24]


def sor(client, metin: str) -> dict:
    """Tek çağrı; önbellekte varsa oradan. Dönüş: {"karar": {...} | None, "neden": str, "ms": int}."""
    yol = CACHE / f"{_anahtar(metin)}.json"
    if yol.exists():
        return json.loads(yol.read_text(encoding="utf-8"))
    t0 = time.time()
    response = client.messages.create(**parametreler(metin))
    ms = int((time.time() - t0) * 1000)
    if response.stop_reason in ("refusal", "max_tokens"):
        sonuc = {"karar": None, "neden": response.stop_reason, "ms": ms}
    else:
        text = next(b.text for b in response.content if b.type == "text")
        sonuc = {"karar": karar_duzelt(json.loads(text)), "neden": "tamam", "ms": ms}
    sonuc["kullanim"] = {
        "giris": response.usage.input_tokens,
        "onbellek_okuma": response.usage.cache_read_input_tokens or 0,
        "cikis": response.usage.output_tokens,
    }
    CACHE.mkdir(parents=True, exist_ok=True)
    yol.write_text(json.dumps(sonuc, ensure_ascii=False), encoding="utf-8")
    return sonuc


def kiyasla(sonuclar: dict[str, dict], anahtar: dict) -> dict:
    """Modelin ara alanlarını anahtarla karşılaştırır. Anahtarda "belirsiz" olan vakalar o alanda sayılmaz."""

    def tablo(alan_model, alan_anahtar, donustur):
        dogru, toplam, hatalar = 0, 0, []
        for vid, s in sonuclar.items():
            ref = anahtar.get(vid, {}).get(alan_anahtar)
            if s["karar"] is None or ref in (None, "belirsiz"):
                continue
            tahmin = donustur(s["karar"][alan_model])
            toplam += 1
            if tahmin == ref:
                dogru += 1
            else:
                hatalar.append({"vaka": vid, "anahtar": ref, "model": tahmin})
        return {"dogru": dogru, "toplam": toplam, "hatalar": hatalar}

    evet_hayir = lambda b: "evet" if b else "hayir"  # noqa: E731
    for ref in anahtar.values():
        # Aynı istek, herhangi bir önceki istekle: anahtarda o anki geçerli istekle aynıysa ayni_istek "evet",
        # daha eski bir istekle aynıysa eslesen_onceki_tur dolu. Döngüyü yakalamak için ikisi de önemli.
        if ref.get("ayni_istek") == "evet" or ref.get("eslesen_onceki_tur") is not None:
            ref["_ayni_herhangi"] = "evet"
        else:
            ref["_ayni_herhangi"] = ref.get("ayni_istek")
        # Döngü: anahtarda en az iki başarısız deneme. Tekrarlanan ihlal "tikanma" ve
        # "tekrar_ihlal_dogrulanmis" ile işaretlenir; ilk ihlal (tek yeniden sorma) döngü değildir.
        ref["_dongu"] = evet_hayir(ref.get("tikanma") == "evet" or ref.get("durum") == "tekrar_ihlal_dogrulanmis")
    return {
        "ayni_istek (herhangi önceki)": tablo("ayni_istek", "_ayni_herhangi", evet_hayir),
        "ayni_istek (o anki istek, protokol)": tablo("ayni_istek", "ayni_istek", evet_hayir),
        "onceki_cevap_karsiladi": tablo("onceki_cevap_karsiladi", "onceki_cevap_karsiladi", lambda x: x),
        "tikanma": tablo("tikanma", "tikanma", evet_hayir),
        "dongu (iki başarısız deneme)": tablo("dongu", "_dongu", evet_hayir),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--set", choices=["prova", "senaryo"], default="prova", help="açık prova (P vakaları) ya da açık senaryo seti")
    ap.add_argument("--anahtar", type=Path, help="cevap anahtarı (beklenen_v*.json); yalnızca prova kıyası için")
    ap.add_argument("--kuru", action="store_true", help="API çağırmadan ilk vakanın model metnini göster")
    ap.add_argument("--paralel", type=int, default=4)
    ap.add_argument("--dusunme", choices=["acik", "kapali"], help="spec'teki düşünme ayarını bu çalıştırma için değiştir")
    args = ap.parse_args()
    if args.dusunme:
        SPEC["dusunme"] = args.dusunme

    beklenen = None
    if args.set == "senaryo":
        ham, beklenen = senaryolari_yukle()
    else:
        ham = vakalari_yukle()
    vakalar = {vid: sohbet_metni(turlari_al({"turlar": t})) for vid, t in ham.items()}
    if args.kuru:
        vid, metin = next(iter(vakalar.items()))
        print(f"{len(vakalar)} vaka. Örnek ({vid}):\n\n{metin}")
        return

    import anthropic  # yalnızca gerçek çağrıda gerekir

    client = anthropic.Anthropic()
    with ThreadPoolExecutor(args.paralel) as ex:
        sonuclar = dict(zip(vakalar, ex.map(lambda m: sor(client, m), vakalar.values())))

    gecikme = sorted(s["ms"] for s in sonuclar.values())
    ozet = {
        "UYARI": "Yalnızca açık prova; küçük, sentetik ve kuralları yazanlarca hazırlanmış set. Genel doğruluk değildir.",
        "spec_surum": SPEC["surum"],
        "model": SPEC["model"],
        "dusunme": SPEC.get("dusunme", "acik"),
        "vaka": len(sonuclar),
        "karar_yok": sum(s["karar"] is None for s in sonuclar.values()),
        "gecikme_ms_medyan": gecikme[len(gecikme) // 2],
        "kullanim": {k: sum(s.get("kullanim", {}).get(k, 0) for s in sonuclar.values()) for k in ("giris", "onbellek_okuma", "cikis")},
        "vakalar": {vid: s["karar"] for vid, s in sonuclar.items()},
    }
    if beklenen is not None:
        ozet["kiyas"] = senaryo_kiyasla(sonuclar, beklenen)
        hedef = ROOT / "outputs" / f"judge_senaryo_v{SPEC['surum']}_{SPEC.get('dusunme', 'acik')}.json"
    elif args.anahtar:
        anahtar = json.loads(args.anahtar.read_text(encoding="utf-8"))
        ozet["anahtar"] = {"dosya": args.anahtar.name, "surum": anahtar.get("surum")}
        ozet["kiyas"] = kiyasla(sonuclar, anahtar["vakalar"])
        hedef = args.anahtar.parent / "cikti" / f"judge_prova_kiyas_v{SPEC['surum']}_{SPEC.get('dusunme', 'acik')}.json"
    else:
        hedef = ROOT / "outputs" / f"judge_prova_{SPEC.get('dusunme', 'acik')}.json"
    hedef.parent.mkdir(parents=True, exist_ok=True)
    hedef.write_text(json.dumps(ozet, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    print(f"{ozet['vaka']} vaka, karar yok {ozet['karar_yok']}, medyan gecikme {ozet['gecikme_ms_medyan']} ms")
    for alan, t in ozet.get("kiyas", {}).items():
        if "dogru" in t:
            print(f"  {alan}: {t['dogru']}/{t['toplam']}")
    for esik, t in ozet.get("kiyas", {}).get("kart_esik_taramasi", {}).items():
        print(f"  kart eşiği {esik}: doğru {t['dogru_kart']}, yersiz {t['yersiz_kart']}, kaçan {t['kacan']}")
    print(f"Yazıldı: {hedef}")


if __name__ == "__main__":
    main()
