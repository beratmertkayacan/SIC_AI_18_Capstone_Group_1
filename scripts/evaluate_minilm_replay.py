"""Benzer mesaj sinyalinde 3-gram yerine (ya da yanına) MiniLM cümle gömmesi denenirse yeniden oynatma nasıl değişir?

Eklenti bugün iki mesajı harf 3-gram FNV kosinüs benzerliğiyle karşılaştırıyor (eşik 0,80). Bu betik
aynı yeniden oynatmayı (scripts/evaluate_replay.py, "sonra" politikası) benzer kararını üç biçimde
vererek tekrarlar:

    3gram          bugünkü kural: 3-gram >= 0,80
    minilm_t       çok dilli MiniLM gömmelerinin kosinüsü >= t (t: 0,70 ... 0,90)
    birlesim_t     3-gram >= 0,80 VEYA MiniLM >= t

Yalnızca "benzer" kararı değişir. Yeni içerik kelimesi süzgeci, birebir tekrar (0,99, gönderimi bekletir),
yumuşak tekrar ve varyasyon istisnası bugünkü gibi 3-gram puanıyla çalışır; böylece fark yalnızca
benzerlik ölçüsünden gelir. Süzgecin MiniLM'in yakaladığı yeniden yazımları ne kadar sildiğini görmek
için süzgeçsiz bir MiniLM taraması da ayrıca raporlanır (yalnızca benzer kararı düzeyinde).

Örneklem: seçim örneklemi (rapor örneklemi tohum 42 çıkarıldıktan sonra tohum 7; evaluate_stage3 ile
aynı) içinden ilk N sohbet. Tur modeli tahminleri evaluate_stage3 önbelleğinden okunur.

Çıktı: outputs/minilm_replay.json (yalnızca sayılar; mesaj metni yazılmaz).

Çalıştırma:
    python scripts/evaluate_minilm_replay.py            # 3.000 sohbet
    python scripts/evaluate_minilm_replay.py --max 1500
"""

import argparse
import json
import platform
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

import evaluate_replay as er  # noqa: E402
from evaluate_stage3 import cached_predictions, load_sample  # noqa: E402
from kafiai import config  # noqa: E402
from kafiai.extension_similarity import is_comparable, is_variation, new_content, similarity  # noqa: E402
from kafiai.text import has_strong_repair  # noqa: E402

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
OUT = ROOT / "outputs" / "minilm_replay.json"
THRESHOLDS = [0.70, 0.75, 0.80, 0.85, 0.90]
NGRAM_T = config.EXT_SIMILARITY_THRESHOLD


def load_minilm():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(MODEL_NAME, local_files_only=True, device="cpu")


def embed_all(model, df):
    """Her benzersiz mesaj metni bir kez kodlanır (toplu, normalize); sözlük metin -> vektör."""
    texts = sorted({str(m or "") for msgs in df.user_msgs for m in msgs})
    texts = [t for t in texts if is_comparable(t) and len(t) <= er.MAX_CHARS]
    start = time.time()
    emb = model.encode(texts, batch_size=64, normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False)
    took = time.time() - start
    return dict(zip(texts, emb)), len(texts), took


def pair_scores(msgs, emb):
    """Her mesaj için son pencere içindeki her öncülle (3-gram, MiniLM, yeni içerik var mı) üçlüleri."""
    out = []
    for t, text in enumerate(msgs):
        rows = []
        if t > 0 and text in emb:
            for prev in msgs[max(0, t - config.EXT_RECENT_MESSAGES):t]:
                if prev not in emb:
                    continue
                s3 = similarity(text, prev)
                sm = float(np.dot(emb[text], emb[prev]))
                rows.append((s3, sm, bool(new_content(text, prev))))
        out.append(rows)
    return out


def make_rule(kind, t=None):
    """Bir çift benzer mi? kind: 3gram, minilm, birlesim."""
    if kind == "3gram":
        return lambda s3, sm: s3 >= NGRAM_T
    if kind == "minilm":
        return lambda s3, sm: sm >= t
    return lambda s3, sm: s3 >= NGRAM_T or sm >= t


def flags_with(msgs, scores, rule):
    """evaluate_replay.detector_flags'in "sonra" kolunun aynısı; yalnızca benzer kararı rule ile verilir."""
    flags = []
    for t, text in enumerate(msgs):
        similar = soft = variation = exact = False
        rows = scores[t]
        if rows:
            best = max(s3 for s3, _, _ in rows)
            for s3, sm, has_new in rows:
                if rule(s3, sm) and not has_new:
                    similar = True
                    exact = exact or s3 >= er.HOLD_EXACT
            soft = best >= config.EXT_SOFT_SIMILARITY_THRESHOLD
            if (similar or soft) and is_variation(text, best):
                similar = soft = False
                variation = True
        hold = similar and (exact or has_strong_repair(text))
        flags.append((similar, soft, variation, hold))
    return flags


def run(df, preds, model, reasons, all_scores, configs):
    tallies = {name: er.Tally() for name in configs}
    sim_turns = {name: 0 for name in configs}
    sim_dsat = {name: 0 for name in configs}  # benzer işaretli turun kendisi ya da sonraki tur DSAT
    original = er.detector_flags
    try:
        for cid, msgs, answers, dsat in zip(df.conv_id, df.user_msgs, df.assistant_msgs, df.dsat_turns):
            msgs, answers = [str(m or "") for m in msgs], [str(a or "") for a in answers]
            ds = {int(x) for x in dsat}
            scores = all_scores[cid]
            for name, rule in configs.items():
                flags = flags_with(msgs, scores, rule)
                er.detector_flags = lambda _m, use_variation, _f=flags: _f  # replay benzer kararını buradan alır
                tallies[name].add(er.replay(msgs, answers, model, reasons, "sonra", preds[cid]), ds, len(msgs))
                for t, f in enumerate(flags):
                    if f[0]:
                        sim_turns[name] += 1
                        sim_dsat[name] += (t in ds) or ((t + 1) in ds)
    finally:
        er.detector_flags = original
    out = {}
    for name, tally in tallies.items():
        r = tally.result()
        out[name] = {
            "benzer_tur_yuzde": round(100 * sim_turns[name] / r["kullanici_turu"], 3),
            "benzer_tur_sayi": sim_turns[name],
            "benzer_tur_dsat_isabet_yuzde": round(100 * sim_dsat[name] / sim_turns[name], 2) if sim_turns[name] else None,
            "serit_100_sohbette": r["serit"]["100_sohbette"],
            "halka2_tur_yuzde": r["halka"]["seviye2_tur_yuzde"],
            "halka2_isabet_yuzde": r["halka"]["seviye2_isabet_yuzde"],
            "kart_100_sohbette": r["kart"]["100_sohbette"],
            "kart_isabet_yuzde": r["kart"]["isabet_yuzde"],
            "kart_kaynaga_gore": r["kart"]["kaynaga_gore"],
            "dsat_yakalama_yuzde": r["kart"]["tekrarlayan_memnuniyetsizlikte_yakalama_yuzde"],
            "tekrarlayan_dsat_sohbeti": r["kart"]["tekrarlayan_memnuniyetsizlik_sohbeti"],
        }
    return out


def pair_level(df, all_scores):
    """Yalnızca benzer kararı: MiniLM'in yakalayıp 3-gram'ın kaçırdığı çiftler DSAT'lı sohbetlerde mi?

    Çift = (mesaj, pencere içindeki öncül). "dsat_sohbet": sohbette en az bir DSAT turu var.
    "dsat_tur": yeni mesajın turu ya da sonraki tur DSAT. Taban oranlar karşılaştırma için verilir.
    """
    base_pairs = base_conv = base_turn = 0
    res = {}
    acc = {(f, t): [0, 0, 0] for f in ("suzgecli", "suzgecsiz") for t in THRESHOLDS}
    ng = {"suzgecli": [0, 0, 0], "suzgecsiz": [0, 0, 0]}
    for cid, dsat in zip(df.conv_id, df.dsat_turns):
        ds = {int(x) for x in dsat}
        has = bool(ds)
        for t_idx, rows in enumerate(all_scores[cid]):
            hit_turn = (t_idx in ds) or ((t_idx + 1) in ds)
            for s3, sm, has_new in rows:
                base_pairs += 1
                base_conv += has
                base_turn += hit_turn
                for f in ("suzgecli", "suzgecsiz"):
                    if f == "suzgecli" and has_new:
                        continue
                    if s3 >= NGRAM_T:
                        a = ng[f]
                        a[0] += 1
                        a[1] += has
                        a[2] += hit_turn
                    for t in THRESHOLDS:
                        if sm >= t and s3 < NGRAM_T:
                            a = acc[(f, t)]
                            a[0] += 1
                            a[1] += has
                            a[2] += hit_turn
    pct = lambda a, b: round(100 * a / b, 2) if b else None  # noqa: E731
    res["tum_ciftler"] = {"sayi": base_pairs, "dsat_sohbet_yuzde": pct(base_conv, base_pairs),
                          "dsat_tur_yuzde": pct(base_turn, base_pairs)}
    for f in ("suzgecli", "suzgecsiz"):
        a = ng[f]
        res[f"3gram_benzer_{f}"] = {"sayi": a[0], "dsat_sohbet_yuzde": pct(a[1], a[0]), "dsat_tur_yuzde": pct(a[2], a[0])}
        for t in THRESHOLDS:
            a = acc[(f, t)]
            res[f"yalniz_minilm_{f}_{t:.2f}"] = {"sayi": a[0], "dsat_sohbet_yuzde": pct(a[1], a[0]),
                                                  "dsat_tur_yuzde": pct(a[2], a[0])}
    return res


def feasibility(model):
    """Tarayıcı fizibilitesi için ölçümler (kod üretmez)."""
    tr = model[0].auto_model
    params = sum(p.numel() for p in tr.parameters())
    emb = tr.embeddings.word_embeddings.weight
    emb_params = emb.numel()
    # Gecikme: 50 farklı sentetik cümle, tek tek kodlanır (gerçek mesaj kullanılmaz).
    sentences = [f"Bu cümle gecikme ölçümü için yazılmış {i}. örnek, lütfen kısa bir özet çıkar." for i in range(50)]
    model.encode(sentences[:5], normalize_embeddings=True)  # ısınma
    times = []
    for s in sentences:
        st = time.perf_counter()
        model.encode([s], normalize_embeddings=True, show_progress_bar=False)
        times.append(1000 * (time.perf_counter() - st))
    import torch
    return {
        "parametre": int(params),
        "gomme_matrisi_boyutu": list(emb.shape),
        "gomme_matrisi_parametre": int(emb_params),
        "gomme_payi_yuzde": round(100 * emb_params / params, 1),
        "fp32_mb_tahmin": round(params * 4 / 1e6, 1),
        "fp16_mb_tahmin": round(params * 2 / 1e6, 1),
        "int8_mb_tahmin": round(params * 1 / 1e6, 1),
        "cikti_boyutu": int(model.get_sentence_embedding_dimension()),
        "tek_cumle_gecikme_ms_ortalama": round(float(np.mean(times)), 2),
        "tek_cumle_gecikme_ms_medyan": round(float(np.median(times)), 2),
        "olcum_ortami": f"{platform.machine()} {platform.system()}, torch {torch.__version__}, "
                        f"{torch.get_num_threads()} iş parçacığı, Python CPU",
    }


def main():
    ap = argparse.ArgumentParser(description="MiniLM benzerliği ile yeniden oynatma")
    ap.add_argument("--max", type=int, default=3000)
    args = ap.parse_args()
    t0 = time.time()
    full = load_sample("secim")
    preds = cached_predictions(full, "secim", er.load_model(), er.load_reasons())
    df = full.head(args.max)
    model_turn, reasons = er.load_model(), er.load_reasons()

    print(f"{len(df):,} sohbet; MiniLM yükleniyor...", flush=True)
    st = load_minilm()
    emb, n_texts, enc_s = embed_all(st, df)
    print(f"  {n_texts:,} mesaj kodlandı ({enc_s:.0f} sn)", flush=True)

    all_scores = {cid: pair_scores([str(m or "") for m in msgs], emb) for cid, msgs in zip(df.conv_id, df.user_msgs)}

    configs = {"3gram_0.80": make_rule("3gram")}
    for t in THRESHOLDS:
        configs[f"minilm_{t:.2f}"] = make_rule("minilm", t)
    for t in THRESHOLDS:
        configs[f"birlesim_{t:.2f}"] = make_rule("birlesim", t)
    print("Yeniden oynatılıyor...", flush=True)
    options = run(df, preds, model_turn, reasons, all_scores, configs)

    base_dsat = sum(len(d) for d in df.dsat_turns) / max(1, sum(df.n_user_msgs))
    result = {
        "orneklem": "secim (rapor orneklemi tohum 42 disindan tohum 7), ilk N sohbet",
        "sohbet": len(df),
        "kullanici_turu": int(sum(df.n_user_msgs)),
        "tum_turlarda_dsat_yuzde": round(100 * base_dsat, 2),
        "kodlanan_mesaj": n_texts,
        "kodlama_suresi_sn": round(enc_s, 1),
        "politika": "sonra; yalnizca benzer karari degisir, yeni icerik suzgeci ve 0,99 bekletme 3-gram ile",
        "secenekler": options,
        "benzer_karari_ciftler": pair_level(df, all_scores),
        "fizibilite": feasibility(st),
        "toplam_sure_sn": round(time.time() - t0, 1),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"\nYazıldı: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
