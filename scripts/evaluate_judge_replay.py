"""Anlam desteği (Claude Haiku değerlendiricisi) WildFeedback yeniden oynatmasında: eşik seçimi ve önce/sonra.

Eklentinin karar zinciri (scripts/evaluate_replay.py, "sonra" politikası) aynen oynatılır; üstüne
değerlendiricinin kararı yeni bir kart kaynağı ("anlam") ve halka sinyali olarak eklenir. Değerlendirici
eklentide nasıl sorulacaksa öyle sorulur:

    kapı      cevap bittikten sonra, tur >= 3, sohbet o ana kadar kişisel görünmüyor (kafiai.personal,
              eklentide olduğu gibi bir kez kişisel olunca sohbet boyu), her kullanıcı turunda bir istek
    gönderim  son en fazla 12 tur; kullanıcı mesajları kafiai.judge.turlari_al ile kesilir; asistan
              cevapları eklentideki responseText kuralıyla kısaltılır (boşluklar teke iner, 800 karakteri
              aşarsa ilk 600 + " … " + son 200; extension/src/adapters/response-text.ts)

Alt komutlar (sırasıyla):
    hazirla      istekleri JSONL dosyasına yazar (outputs/judge_cache/, git dışında); önbellekte cevabı
                 olanlar atlanır; istek sayısı ve tahmini maliyet basılır. API çağırmaz.
    gonder       JSONL'daki istekleri Message Batches API ile gönderir (yüzde 50 ucuz); batch kimliğini yazar.
    topla        batch bitince sonuçları indirir, her birini evaluate_judge ile ortak önbelleğe yazar.
    degerlendir  önbellekten okur; T_kart ve T_halka eşiklerini tarar; bugünkü sistemle hibriti karşılaştırır.
                 Çıktı outputs/judge_replay_<orneklem>.json, yalnızca sayılar.

Örneklem: secim = rapor örneklemi çıkarıldıktan sonra tohum 7 (eşik burada seçilir), rapor = tohum 42
(evaluate_stage3.load_sample ile aynı 20.000 sohbet); --max ile bu sohbetlerin ilk N'i alınır.

Çalıştırma:
    python scripts/evaluate_judge_replay.py hazirla --orneklem secim --max 2000
    python scripts/evaluate_judge_replay.py gonder --orneklem secim --max 2000     # ANTHROPIC_API_KEY gerekir
    python scripts/evaluate_judge_replay.py topla --orneklem secim --max 2000
    python scripts/evaluate_judge_replay.py degerlendir --orneklem secim --max 2000
    python scripts/evaluate_judge_replay.py degerlendir --orneklem rapor --max 2000 --t-kart 0.7 --t-halka 0.5
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

import evaluate_judge as ej  # noqa: E402
from evaluate_replay import Tally, replay  # noqa: E402
from evaluate_stage3 import cached_predictions, load_sample  # noqa: E402
from kafiai.judge import SPEC, karar_duzelt, sohbet_metni, turlari_al  # noqa: E402
from kafiai.personal import is_personal  # noqa: E402
from kafiai.turn_model import load_model, load_reasons  # noqa: E402

CACHE = ej.CACHE
MIN_TUR = 3                 # judge-gate: tur >= 3
EN_FAZLA_TUR = SPEC["sinirlar"]["en_fazla_tur"]
BAS, SON = 600, 200         # response-text.ts: RESPONSE_HEAD_CHARS, RESPONSE_TAIL_CHARS
# Haiku 5.5 fiyatı (100K token altı istemler), Batches API yüzde 50 indirimli.
GIRIS_USD, CIKIS_USD, BATCH_INDIRIM = 0.10 / 1e6, 0.50 / 1e6, 0.5
KARAKTER_PER_TOKEN = 3.5
T_KART_TARAMA = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9]
T_HALKA_TARAMA = [0.3, 0.4, 0.5, 0.6, 0.7]


def cevap_kisalt(text: str) -> str:
    """Eklentideki responseText (response-text.ts) ile aynı: boşluklar teke iner, Array.from gibi kod
    noktasıyla sayılır, BAS + SON karakteri aşan cevap baştan ve sondan kısaltılır."""
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= BAS + SON:
        return text
    return f"{text[:BAS]} … {text[-SON:]}"


def istekler(msgs: list[str], answers: list[str]) -> dict[int, str]:
    """Sohbet için kapıdan geçen her tur: {tur indeksi: modele gidecek metin}."""
    out, kisisel = {}, False
    for t, text in enumerate(msgs):
        kisisel = kisisel or is_personal(text)
        if t + 1 < MIN_TUR or kisisel or t >= len(answers):
            continue
        turlar = []
        for i in range(t + 1):
            turlar.append({"rol": "k", "metin": msgs[i]})
            cevap = cevap_kisalt(answers[i])
            if cevap:  # okunamayan (boş) cevap eklentide de gönderilmez
                turlar.append({"rol": "a", "metin": cevap})
        govde = turlari_al({"turlar": turlar[-EN_FAZLA_TUR:]})
        if govde:
            out[t] = sohbet_metni(govde)
    return out


def istek_parametreleri(metin: str) -> dict:
    """evaluate_judge.parametreler ile aynı çağrı (tek kaynak; sunucudaki istekle aynı)."""
    return ej.parametreler(metin)


def sohbetler(orneklem: str, n: int):
    df = load_sample(orneklem)
    if "assistant_msgs" not in df.columns:
        sys.exit("assistant_msgs kolonu yok. Önce: python scripts/fetch_wildfeedback.py")
    return df.head(n) if n else df


def _satirlar(df):
    for cid, msgs, answers, dsat in zip(df.conv_id, df.user_msgs, df.assistant_msgs, df.dsat_turns):
        yield cid, [str(m or "") for m in msgs], [str(a or "") for a in answers], {int(x) for x in dsat}


def _yollar(args):
    ad = f"{args.orneklem}_{args.max}_v{SPEC['surum']}_{SPEC.get('dusunme', 'acik')}"
    return CACHE / f"batch_{ad}.jsonl", CACHE / f"batch_{ad}.id"


def hazirla(args):
    df = sohbetler(args.orneklem, args.max)
    jsonl, _ = _yollar(args)
    toplam = yeni = karakter = 0
    gorulen = set()
    CACHE.mkdir(parents=True, exist_ok=True)
    with jsonl.open("w", encoding="utf-8") as f:
        for _, msgs, answers, _ in _satirlar(df):
            for metin in istekler(msgs, answers).values():
                toplam += 1
                anahtar = ej._anahtar(metin)
                if anahtar in gorulen or (CACHE / f"{anahtar}.json").exists():
                    continue
                gorulen.add(anahtar)
                yeni += 1
                karakter += len(metin)
                f.write(json.dumps({"custom_id": anahtar, "params": istek_parametreleri(metin)}, ensure_ascii=False) + "\n")
    # Sistem istemi önbellekten okunur (yaklaşık 0,1 kat); kaba tahminde ilk istek dışında hep önbellek sayılır.
    sistem_tok = len(SPEC["sistem"]) / KARAKTER_PER_TOKEN
    giris_tok = karakter / KARAKTER_PER_TOKEN + yeni * sistem_tok * 0.1
    cikis_tok = yeni * 250  # düşünme dahil kaba ortalama; prova ölçümü istek başına yaklaşık 150
    usd = (giris_tok * GIRIS_USD + cikis_tok * CIKIS_USD) * BATCH_INDIRIM
    print(f"{len(df):,} sohbet, kapıdan geçen tur: {toplam:,}, önbellekte olmayan istek: {yeni:,}")
    print(f"Tahmini token: giriş ~{giris_tok / 1e6:.2f}M, çıkış ~{cikis_tok / 1e6:.2f}M; tahmini maliyet ~${usd:.2f} (Batch indirimli)")
    print(f"Yazıldı: {jsonl.relative_to(ROOT)}")


def gonder(args):
    import anthropic

    jsonl, id_yolu = _yollar(args)
    if not jsonl.exists():
        sys.exit("Önce: hazirla")
    reqs = [json.loads(line) for line in jsonl.read_text(encoding="utf-8").split("\n") if line.strip()]
    if not reqs:
        sys.exit("Gönderilecek istek yok (hepsi önbellekte).")
    client = anthropic.Anthropic()
    batch = client.messages.batches.create(requests=reqs)
    id_yolu.write_text(batch.id, encoding="utf-8")
    print(f"{len(reqs):,} istek gönderildi. Batch: {batch.id} ({batch.processing_status}). Sonra: topla")


def topla(args):
    import anthropic

    _, id_yolu = _yollar(args)
    if not id_yolu.exists():
        sys.exit("Batch kimliği yok. Önce: gonder")
    client = anthropic.Anthropic()
    bid = id_yolu.read_text(encoding="utf-8").strip()
    while True:
        b = client.messages.batches.retrieve(bid)
        if b.processing_status == "ended":
            break
        if not args.bekle:
            sys.exit(f"Batch henüz bitmedi ({b.processing_status}, {b.request_counts}). Sonra yeniden: topla (ya da --bekle)")
        time.sleep(30)
    sayac = {"tamam": 0, "max_tokens": 0, "refusal": 0, "hata": 0}
    for r in client.messages.batches.results(bid):
        if r.result.type != "succeeded":
            sayac["hata"] += 1  # hata ve süresi dolanlar önbelleğe yazılmaz; yeniden hazirla ile tekrar denenir
            continue
        m = r.result.message
        kullanim = {"giris": m.usage.input_tokens, "onbellek_okuma": m.usage.cache_read_input_tokens or 0,
                    "cikis": m.usage.output_tokens}
        if m.stop_reason in ("refusal", "max_tokens"):
            sonuc = {"karar": None, "neden": m.stop_reason, "ms": None, "kullanim": kullanim}
            sayac[m.stop_reason] += 1
        else:
            text = next(b.text for b in m.content if b.type == "text")
            sonuc = {"karar": karar_duzelt(json.loads(text)), "neden": "tamam", "ms": None, "kullanim": kullanim}
            sayac["tamam"] += 1
        (CACHE / f"{r.custom_id}.json").write_text(json.dumps(sonuc, ensure_ascii=False), encoding="utf-8")
    print(f"Toplandı: {sayac}")


def _pct(a, b):
    return round(100 * a / b, 2) if b else None


def degerlendir(args):
    df = sohbetler(args.orneklem, args.max)
    model, reasons = load_model(), load_reasons()
    preds = cached_predictions(df, args.orneklem, model, reasons)

    # Her sohbet için değerlendirici kararları: {tur: karar}. Cevapsız (önbellekte yok) turlar sayılır.
    veri, istenen, cevapsiz, karar_yok = [], 0, 0, 0
    for cid, msgs, answers, ds in _satirlar(df):
        kararlar = {}
        for t, metin in istekler(msgs, answers).items():
            istenen += 1
            yol = CACHE / f"{ej._anahtar(metin)}.json"
            if not yol.exists():
                cevapsiz += 1
                continue
            k = json.loads(yol.read_text(encoding="utf-8"))["karar"]
            if k is None:
                karar_yok += 1
                continue
            kararlar[t] = k
        veri.append((msgs, answers, ds, preds[cid], kararlar))
    if istenen == 0:
        sys.exit("Kapıdan geçen tur yok.")
    if cevapsiz:
        print(f"Uyarı: {istenen:,} istekten {cevapsiz:,} tanesinin cevabı önbellekte yok "
              f"(önce hazirla, gonder, topla). Bu turlar değerlendiriciden sinyal almamış sayılır.")
    if cevapsiz == istenen:
        sys.exit("Önbellekte hiç cevap yok; değerlendirme yapılmadı.")

    # 1) Değerlendiricinin tek başına tur düzeyinde DSAT ile ilişkisi (o tur ya da sonraki).
    tur, tur_dsat, guvene_gore = 0, 0, {}
    for msgs, _, ds, _, kararlar in veri:
        for t, k in kararlar.items():
            hit = (t in ds) or ((t + 1) in ds)
            tur += 1
            tur_dsat += hit
            for esik in T_KART_TARAMA:
                if k["dongu"] and k["guven"] >= esik:
                    g = guvene_gore.setdefault(esik, [0, 0])
                    g[0] += 1
                    g[1] += hit
    tek_basina = {
        "degerlendirilen_tur": tur,
        "taban_dsat_yuzde": _pct(tur_dsat, tur),
        "dongu_ve_guven_esigi": {f"{e:.2f}": {"tur_yuzde": _pct(v[0], tur), "dsat_yuzde": _pct(v[1], v[0])}
                                 for e, v in sorted(guvene_gore.items())},
    }

    def oynat(t_kart, t_halka, t_onay=None):
        tally = Tally()
        for msgs, answers, ds, p, kararlar in veri:
            extra = None
            if t_onay is not None:
                # Onaylayıcı kullanım: değerlendirici o turu gördüyse ve döngüyü bu güvenle onaylamadıysa kart çıkmaz.
                veto = {t for t, k in kararlar.items() if not (k["dongu"] and k["guven"] >= t_onay)}
                extra = {"veto": veto}
                if t_kart is not None:
                    extra["card"] = {t: "anlam" for t, k in kararlar.items() if k["dongu"] and k["guven"] >= t_kart}
            elif t_kart is not None:
                card = {t: "anlam" for t, k in kararlar.items() if k["dongu"] and k["guven"] >= t_kart}
                ring = {}
                for t, k in kararlar.items():
                    if k["dongu"] and k["guven"] >= t_kart:
                        ring[t] = 2
                    elif t_halka is not None and k["dongu"] and k["guven"] >= t_halka:
                        ring[t] = 1
                extra = {"card": card, "ring": ring}
            tally.add(replay(msgs, answers, model, reasons, "sonra", p, extra), ds, len(msgs))
        return tally.result()

    def ozet(r):
        k = r["kart"]
        return {"kart_100_sohbette": k["100_sohbette"], "kart_isabet_yuzde": k["isabet_yuzde"],
                "yakalama_yuzde": k["tekrarlayan_memnuniyetsizlikte_yakalama_yuzde"],
                "anlam_karti": k["kaynaga_gore"].get("anlam"),
                "halka2_tur_yuzde": r["halka"]["seviye2_tur_yuzde"], "halka2_isabet_yuzde": r["halka"]["seviye2_isabet_yuzde"]}

    print(f"{len(veri):,} sohbet, {tur:,} değerlendirilmiş tur. Oynatılıyor...", flush=True)
    once = oynat(None, None)
    sonuc = {
        "UYARI": "Yalnızca sayılar. Eşik seçimi seçim örnekleminde yapılır; rapor örnekleminde yalnızca seçilen eşik koşulur.",
        "orneklem": args.orneklem, "sohbet": len(veri), "spec_surum": SPEC["surum"], "model": SPEC["model"],
        "dusunme": SPEC.get("dusunme", "acik"),
        "istek": {"kapidan_gecen": istenen, "cevapsiz": cevapsiz, "karar_yok": karar_yok},
        "degerlendirici_tek_basina": tek_basina,
        "bugunku_sistem": ozet(once),
    }
    if args.t_kart is not None or args.t_onay is not None:
        ad = f"kart{args.t_kart}_halka{args.t_halka}_onay{args.t_onay}"
        tam = oynat(args.t_kart, args.t_halka, args.t_onay)
        sonuc["hibrit"] = {ad: ozet(tam)}
        sonuc["hibrit_tam"] = tam
        sonuc["bugunku_sistem_tam"] = once
    else:
        sonuc["tarama_kart"] = {f"{e:.2f}": ozet(oynat(e, None)) for e in T_KART_TARAMA}
        sonuc["tarama_halka"] = {f"{h:.2f}": ozet(oynat(1.01, h)) for h in T_HALKA_TARAMA}  # yalnız halka; kart kapalı
        # Onaylayıcı kullanım: bugünkü kartlar ancak değerlendirici döngüyü onaylarsa; ek olarak anlam kartı (0,85/0,90/yok).
        sonuc["tarama_onay"] = {
            f"onay{o:.2f}_kart{'yok' if k is None else f'{k:.2f}'}": ozet(oynat(k, None, o))
            for o in (0.0, 0.5, 0.6, 0.7) for k in (None, 0.85, 0.90)
        }
    out = ROOT / "outputs" / f"judge_replay_{args.orneklem}_{SPEC.get('dusunme', 'acik')}.json"
    out.write_text(json.dumps(sonuc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({k: sonuc[k] for k in ("istek", "bugunku_sistem", "tarama_onay", "hibrit") if k in sonuc}, ensure_ascii=False, indent=1))
    print(f"Yazıldı: {out.relative_to(ROOT)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("komut", choices=["hazirla", "gonder", "topla", "degerlendir"])
    ap.add_argument("--orneklem", choices=["secim", "rapor"], default="secim")
    ap.add_argument("--max", type=int, default=2000, help="örneklemin ilk N sohbeti (0 = 20.000'in hepsi)")
    ap.add_argument("--bekle", action="store_true", help="topla: batch bitene kadar 30 sn arayla bekle")
    ap.add_argument("--t-kart", type=float, help="degerlendir: tarama yerine bu kart eşiğini koş (rapor örneklemi)")
    ap.add_argument("--t-halka", type=float, help="degerlendir: --t-kart ile birlikte halka eşiği")
    ap.add_argument("--t-onay", type=float, help="degerlendir: bugünkü kartlar için onay eşiği (değerlendirici döngüyü bu güvenle onaylamadıysa kart çıkmaz)")
    ap.add_argument("--dusunme", choices=["acik", "kapali"], help="spec'teki düşünme ayarını bu çalıştırma için değiştir")
    args = ap.parse_args()
    if args.dusunme:
        SPEC["dusunme"] = args.dusunme  # önbellek anahtarı ve dosya adları bu ayara göre ayrışır
    {"hazirla": hazirla, "gonder": gonder, "topla": topla, "degerlendir": degerlendir}[args.komut](args)


if __name__ == "__main__":
    main()
