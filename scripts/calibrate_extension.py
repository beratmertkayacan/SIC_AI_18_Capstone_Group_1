"""Eklentinin eşiklerini gerçek WildChat sohbetleri üzerinde dener.

Eklentinin kural tabanlı çekirdeği (benzer mesaj şeridi ve çıkış kartı) birkaç sabit
sayıyla çalışıyor. Bu script, eklentinin davranışını gerçek sohbetler üzerinde birebir
taklit eder ve şu sorulara cevap verir:

    1. Benzerlik skorları nasıl dağılıyor?
    2. Eşik 0,6 olursa mesajların ve sohbetlerin ne kadarında şerit çıkar? Başka eşiklerde?
    3. Çıkış kartı bugünkü kurallarla hangi sohbetlerde, kaçıncı turda açılır?
    4. Görev türüne göre sohbetler genelde kaç turda bitiyor? (çıkış kartı normları)
    5. Eşiği insan gözüyle doğrulamak için hangi mesaj çiftlerine bakmalıyız?
    6. Etiketlenmiş çiftlere göre her eşikte şerit ne kadar isabetli?

Benzerlik hesabı eklentinin Python ikiziyle yapılır (src/kafiai/extension_similarity.py).

Çalıştırma:
    python scripts/calibrate_extension.py
Çıktılar:
    outputs/calibration_summary.json        tüm sayılar
    extension/src/data/task-norms.json      eklentinin okuyacağı görev normları
    figures/14_similarity_distribution.png  benzerlik dağılımı ve şerit oranı
    figures/15_task_norms.png               görev türüne göre tur sayıları
    data/processed/labeling/threshold_pairs.csv   elle etiketlenecek çiftler (repoya girmez)
"""

import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai import config  # noqa: E402
from kafiai.extension_similarity import cosine, ngram_vector, normalize_text  # noqa: E402
from kafiai.split import mark_templates  # noqa: E402
from kafiai.tasks import TASK_LABELS, TASK_TYPES, task_type  # noqa: E402

SAMPLE = ROOT / "data" / "processed" / "wildchat_sample_50000.pkl"
SUMMARY = ROOT / "outputs" / "calibration_summary.json"
NORMS = ROOT / "extension" / "src" / "data" / "task-norms.json"
LABELING = ROOT / "data" / "processed" / "labeling" / "threshold_pairs.csv"
LABELS = ROOT / "outputs" / "threshold_labels_preliminary.json"
FIG_SIM = ROOT / "figures" / "14_similarity_distribution.png"
FIG_NORMS = ROOT / "figures" / "15_task_norms.png"

THRESHOLDS = [round(t, 2) for t in np.arange(0.40, 0.96, 0.05)]
CARD_THRESHOLDS = [0.6, 0.7, 0.8, 0.85]
COLOR, ACCENT = "#1F5F6B", "#C4562A"


def simulate_conversation(messages):
    """Eklentinin RepeatDetector sınıfını taklit eder.

    Her mesaj, kendinden önceki son 5 karşılaştırılabilir mesajla karşılaştırılır.
    Dönen liste: her gönderim için (tur, skor, en çok benzediği mesajın sırası).
    Kısa mesajlarda skor None olur, tıpkı eklentide olduğu gibi.
    """
    recent = []  # (sıra, vektör)
    sends = []
    for turn, text in enumerate(messages, start=1):
        normalized = normalize_text(text)
        if len(normalized) < config.EXT_MIN_NORMALIZED_CHARS:
            sends.append((turn, None, None))
            continue
        vector = ngram_vector(normalized)
        best_score, best_index = 0.0, None
        for index, previous in recent:
            score = cosine(vector, previous)
            if score > best_score:
                best_score, best_index = score, index
        sends.append((turn, best_score if recent else None, best_index))
        recent.append((turn - 1, vector))
        recent = recent[-config.EXT_RECENT_MESSAGES:]
    return sends


def simulate_exit_card(sends, threshold, min_turns=config.EXT_EXIT_CARD_MIN_TURNS):
    """Eklentinin ExitCardPolicy sınıfını taklit eder. Kartın ilk açıldığı turu döner.

    min_turns sabit bir sayı (bugünkü kural) ya da görev normundan gelen bir sayı olabilir.
    """
    repeats = 0
    for turn, score, _ in sends:
        if score is not None and score >= threshold:
            repeats += 1
        if turn >= min_turns and repeats >= config.EXT_EXIT_CARD_MIN_REPEATS:
            return turn
    return None


def precision_by_threshold(sends_scores, labels_path, pairs_path, thresholds):
    """Etiketlenmiş çiftlerden her eşik için tahmini isabet.

    Her 0,05'lik benzerlik aralığının isabeti etiketlerden hesaplanır, sonra o aralığa
    gerçekte düşen mesaj sayısıyla ağırlıklandırılır.
    """
    if not labels_path.exists() or not pairs_path.exists():
        return None
    labels = {int(k): v for k, v in json.loads(labels_path.read_text(encoding="utf-8"))["labels"].items()}
    pairs = pd.read_csv(pairs_path).set_index("id")
    labelled = pairs.loc[[i for i in labels if i in pairs.index], ["score"]].copy()
    labelled["y"] = [labels[i] for i in labelled.index]
    labelled["bin"] = (labelled["score"] // 0.05 * 0.05).round(2)
    bin_precision = labelled.groupby("bin")["y"].mean()
    bin_size = (sends_scores // 0.05 * 0.05).round(2).value_counts()

    table = []
    for t in thresholds:
        bins = [b for b in bin_precision.index if b >= t - 1e-9]
        if not bins:
            continue
        weights = np.array([bin_size.get(b, 0) for b in bins], dtype=float)
        values = np.array([bin_precision[b] for b in bins])
        table.append({"threshold": t, "estimated_precision": round(float((weights * values).sum() / weights.sum()), 3)})
    return {"n_labelled": int(len(labelled)),
            "bin_precision": {str(k): round(float(v), 3) for k, v in bin_precision.items()},
            "by_threshold": table}


def main():
    if not SAMPLE.exists():
        sys.exit("Örneklem bulunamadı. Önce 'python scripts/run_eda.py' çalıştırın.")

    df = pd.read_pickle(SAMPLE)
    df["templated"] = mark_templates(df)
    df = df[~df["templated"] & (df["n_user_msgs"] >= 1)].copy()
    df["task"] = df["first_prompt"].map(task_type)
    print(f"Şablon dışı {len(df):,} sohbet")

    # 1 ve 2: her gönderimin benzerlik skoru
    rows = []
    for conv_id, messages in zip(df.index, df["user_msgs"]):
        for turn, score, best_index in simulate_conversation(messages):
            rows.append((conv_id, turn, score, best_index))
    sends = pd.DataFrame(rows, columns=["conv", "turn", "score", "best_index"])
    later_sends = sends[sends["turn"] >= 2]  # ilk mesajın karşılaştırılacağı bir şey yok
    checked = sends[sends["score"].notna()]
    multi = df[df["n_user_msgs"] >= 2]
    print(f"{len(sends):,} gönderim, karşılaştırılan {len(checked):,}")

    threshold_table = []
    for t in THRESHOLDS:
        flagged = checked["score"] >= t
        conv_flagged = checked[flagged]["conv"].nunique()
        threshold_table.append({
            "threshold": t,
            "flagged_send_pct": round(float(flagged.mean() * 100), 2),
            "conversations_with_strip_pct": round(conv_flagged / len(multi) * 100, 2),
        })

    # 4: görev normları (yalnızca çok turlu sohbetler; tek mesajlık sohbette kart zaten çıkmaz)
    norms = {}
    for name in TASK_TYPES:
        turns = multi.loc[df.loc[multi.index, "task"] == name, "n_user_msgs"]
        if len(turns) < 30:
            continue
        norms[name] = {
            "label": TASK_LABELS[name],
            "conversations": int(len(turns)),
            "median_turns": float(turns.median()),
            "p75_turns": float(turns.quantile(0.75)),
            "p90_turns": float(turns.quantile(0.90)),
            "share_pct": round(len(turns) / len(multi) * 100, 2),
        }

    # 3: çıkış kartı simülasyonu: bugünkü sabit kural ile göreve göre norm kuralının karşılaştırması
    sends_by_conv = {conv: [(t, None if pd.isna(sc) else sc, bi) for t, sc, bi in
                            zip(g["turn"], g["score"], g["best_index"])]
                     for conv, g in sends.groupby("conv")}
    long_convs = multi["n_user_msgs"] >= config.EXT_EXIT_CARD_MIN_TURNS
    card_table = []
    for t in CARD_THRESHOLDS:
        for rule in ("sabit", "norm"):
            first_turns = []
            for i in multi.index:
                if rule == "sabit":
                    min_turns = config.EXT_EXIT_CARD_MIN_TURNS
                else:
                    task = df.at[i, "task"]
                    min_turns = int(norms.get(task, norms["diger"])["p90_turns"]) + 1
                first_turns.append(simulate_exit_card(sends_by_conv.get(i, []), t, min_turns))
            shown = pd.Series([x is not None for x in first_turns], index=multi.index)
            card_table.append({
                "threshold": t,
                "rule": rule,
                "multi_turn_with_card_pct": round(float(shown.mean() * 100), 2),
                "long_with_card_pct": round(float(shown[long_convs].mean() * 100), 2),
                "first_card_turn_median": float(np.median([x for x in first_turns if x is not None])) if shown.any() else None,
            })

    precision = precision_by_threshold(checked["score"], LABELS, LABELING, THRESHOLDS)

    summary = {
        "source": "WildChat 1M, 50.000 sohbetlik örneklem, şablon sohbetler hariç",
        "n_conversations": int(len(df)),
        "n_multi_turn": int(len(multi)),
        "n_sends": int(len(sends)),
        "n_checked_sends": int(len(checked)),
        "too_short_pct": round(float(later_sends["score"].isna().mean() * 100), 2),
        "current_settings": {
            "similarity_threshold": config.EXT_SIMILARITY_THRESHOLD,
            "soft_similarity_threshold": config.EXT_SOFT_SIMILARITY_THRESHOLD,
            "min_normalized_chars": config.EXT_MIN_NORMALIZED_CHARS,
            "recent_messages": config.EXT_RECENT_MESSAGES,
            "exit_card_min_turns": config.EXT_EXIT_CARD_MIN_TURNS,
            "exit_card_min_repeats": config.EXT_EXIT_CARD_MIN_REPEATS,
        },
        "score_quantiles": {str(q): round(float(checked["score"].quantile(q)), 3) for q in (0.5, 0.75, 0.9, 0.95, 0.99)},
        "thresholds": threshold_table,
        "long_conversations_pct_of_multi_turn": round(float(long_convs.mean() * 100), 2),
        "exit_card": card_table,
        "strip_precision_preliminary": precision,
        "task_norms": norms,
    }
    SUMMARY.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    NORMS.parent.mkdir(parents=True, exist_ok=True)
    NORMS.write_text(json.dumps({
        "source": summary["source"],
        "note": "scripts/calibrate_extension.py tarafından üretildi; elle değiştirmeyin.",
        "norms": {k: {"label": v["label"], "median_turns": v["median_turns"], "p75_turns": v["p75_turns"],
                      "p90_turns": v["p90_turns"]} for k, v in norms.items()},
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # Grafikler
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    axes[0].hist(checked["score"], bins=50, color=COLOR)
    axes[0].axvline(config.EXT_SIMILARITY_THRESHOLD, color=ACCENT, ls="--",
                    label=f"şerit eşiği = {config.EXT_SIMILARITY_THRESHOLD}")
    axes[0].axvline(config.EXT_SOFT_SIMILARITY_THRESHOLD, color="#8A6D3B", ls=":",
                    label=f"yumuşak eşik = {config.EXT_SOFT_SIMILARITY_THRESHOLD}")
    axes[0].set_yscale("log")
    axes[0].set_title("Her mesajın son 5 mesaja en yüksek benzerliği")
    axes[0].set_xlabel("Benzerlik (eklentinin hesabı)")
    axes[0].set_ylabel("Gönderim (log)")
    axes[0].legend()
    tt = pd.DataFrame(threshold_table)
    axes[1].plot(tt["threshold"], tt["flagged_send_pct"], marker="o", color=COLOR, label="mesajların %'si")
    axes[1].plot(tt["threshold"], tt["conversations_with_strip_pct"], marker="o", color=ACCENT,
                 label="çok turlu sohbetlerin %'si")
    if precision:
        pt = pd.DataFrame(precision["by_threshold"])
        axes[1].plot(pt["threshold"], pt["estimated_precision"] * 100, marker="s", color="#8A6D3B",
                     label="tahmini isabet (ön etiket)")
    axes[1].axvline(config.EXT_SIMILARITY_THRESHOLD, color="grey", ls="--")
    axes[1].set_title("Eşiğe göre şeridin çıkma oranı")
    axes[1].set_xlabel("Benzerlik eşiği")
    axes[1].set_ylabel("%")
    axes[1].legend()
    for ax in axes:
        ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(FIG_SIM, dpi=150)
    plt.close(fig)

    nt = pd.DataFrame(norms).T.sort_values("median_turns")
    fig, ax = plt.subplots(figsize=(8, 4))
    y = np.arange(len(nt))
    ax.barh(y, nt["p90_turns"], color="#D9CFC1", label="%90'lık dilim")
    ax.barh(y, nt["p75_turns"], color="#9AA5A8", label="%75'lik dilim")
    ax.barh(y, nt["median_turns"], color=COLOR, label="ortanca")
    ax.set_yticks(y)
    ax.set_yticklabels([f"{r.label} (n={int(r.conversations):,})" for r in nt.itertuples()])
    ax.set_xlabel("Kullanıcı mesajı sayısı")
    ax.set_title("Görev türüne göre sohbet uzunluğu")
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.18), ncol=3, frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(FIG_NORMS, dpi=150)
    plt.close(fig)

    # 5: elle etiketlenecek çiftler (her 0,05'lik aralıktan 15 çift)
    pairs = checked[checked["score"] >= 0.40].copy()
    pairs["bin"] = (pairs["score"] // 0.05 * 0.05).round(2)
    sample = pairs.groupby("bin", group_keys=False).apply(lambda g: g.sample(min(15, len(g)), random_state=config.SEED))
    message_lists = df["user_msgs"]
    sample["mesaj_once"] = [message_lists[c][int(i)][:400] for c, i in zip(sample["conv"], sample["best_index"])]
    sample["mesaj_sonra"] = [message_lists[c][t - 1][:400] for c, t in zip(sample["conv"], sample["turn"])]
    sample["ayni_talep_mi"] = ""
    LABELING.parent.mkdir(parents=True, exist_ok=True)
    sample[["score", "mesaj_once", "mesaj_sonra", "ayni_talep_mi"]].sample(frac=1, random_state=config.SEED) \
        .to_csv(LABELING, index_label="id")

    print(json.dumps({k: summary[k] for k in ("too_short_pct", "score_quantiles")}, indent=2, ensure_ascii=False))
    print(pd.DataFrame(card_table).to_string(index=False))
    if precision:
        print(pd.DataFrame(precision["by_threshold"]).to_string(index=False))
    print(pd.DataFrame(threshold_table).to_string(index=False))
    print(pd.DataFrame(norms).T[["conversations", "median_turns", "p75_turns", "p90_turns"]].to_string())


if __name__ == "__main__":
    main()
