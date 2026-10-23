"""WildChat 4.8M keşif analizi ve etiket doğrulaması.

Bölüm 2'deki analiz WildChat 1M üzerindeydi. Bu script üç soruya cevap arar:

    1. Temizleme her adımda ne kadar veri eliyor? (1M ve 4.8M karşılaştırması)
    2. WildChat 4.8M zaman içinde nasıl değişiyor? (şablon trafiği, çok turlu sohbet, modeller)
    3. Etiketimiz gerçek memnuniyetsizliği yakalıyor mu? (WildFeedback ile doğrulama)
    4. Sohbet uzadıkça kullanıcının "olmadı, hâlâ hata" deme oranı artıyor mu? (context window)

Çalıştırma (önce fetch_wildchat48.py, fetch_wildfeedback.py ve build_dataset.py):
    python scripts/run_eda_48m.py
Çıktılar:
    figures/16_cleaning_funnel.png, 17_wildchat48_over_time.png,
    figures/18_1m_vs_48m.png, 19_label_validation.png, 25_repair_by_turn.png
    outputs/eda_48m_summary.json, outputs/label_validation.json
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

from kafiai.config import EXACT_REPEAT_THRESHOLD, K_TURNS, REPEAT_SIM_THRESHOLD, SEED  # noqa: E402
from kafiai.data import PROCESSED, clean_conversations, load_source  # noqa: E402
from kafiai.split import mark_templates  # noqa: E402
from kafiai.tasks import TASK_TYPES  # noqa: E402
from kafiai.text import has_strong_repair  # noqa: E402

SHORT_TASK = {"kod": "Kod", "ceviri": "Çeviri", "ozet": "Özet", "yazma": "Yazma", "soru": "Soru", "diger": "Diğer"}

FIG, OUT = ROOT / "figures", ROOT / "outputs"
TEAL, ORANGE, GREY, GOLD = "#1F5F6B", "#C4562A", "#9AA5A8", "#D9A441"
plt.rcParams.update({"figure.dpi": 130, "axes.spines.top": False, "axes.spines.right": False,
                     "font.size": 9.5, "axes.grid": True, "grid.alpha": 0.25})


def save(fig, name):
    fig.tight_layout()
    fig.savefig(FIG / name, bbox_inches="tight")
    plt.close(fig)
    print(f"kaydedildi: figures/{name}")


def model_family(name):
    name = str(name)
    for prefix, label in [("o1", "o1"), ("gpt-4.1", "GPT-4.1"), ("gpt-4o", "GPT-4o"),
                          ("gpt-4", "GPT-4"), ("gpt-3.5", "GPT-3.5")]:
        if name.startswith(prefix):
            return label
    return "diğer"


def main():
    summary = {}
    sample48 = load_source("48m_sample")
    sample1m = load_source("1m")

    # ------------------------------------------------------------------
    # 1. Temizleme hunisi: iki rastgele örneklem aynı adımlardan geçer.
    # ------------------------------------------------------------------
    _, steps1m = clean_conversations(sample1m)
    _, steps48 = clean_conversations(sample48)
    summary["cleaning_steps_random_sample"] = {"1m": steps1m, "48m": steps48}

    fig, ax = plt.subplots(figsize=(9, 4))
    names = list(steps1m)
    x = np.arange(len(names))
    for offset, steps, color, label in [(-0.2, steps1m, GREY, "WildChat 1M (50 bin)"),
                                        (0.2, steps48, TEAL, "WildChat 4.8M (150 bin)")]:
        pct = [steps[n] / steps["ham veri"] * 100 for n in names]
        bars = ax.bar(x + offset, pct, 0.4, color=color, label=label)
        for b, p in zip(bars, pct):
            ax.text(b.get_x() + b.get_width() / 2, p + 1, f"%{p:.0f}", ha="center", fontsize=7.5)
    short = ["ham veri", "tekrar kayıt", "boş ilk mesaj", "şablon", "4 turdan kısa", "100 turdan uzun",
             "ilk 2 mesajda boş"]
    ax.set_xticks(x, ["ham veri"] + [f"{s}\nçıkarıldı" for s in short[1:]], fontsize=8)
    ax.set_ylabel("ham verinin yüzdesi")
    ax.set_title("Temizleme hunisi: her adımdan sonra kalan sohbetler")
    ax.legend()
    save(fig, "16_cleaning_funnel.png")

    # ------------------------------------------------------------------
    # 2. 4.8M'in zaman içindeki değişimi (her parça dosya bir dönem).
    # ------------------------------------------------------------------
    s = sample48.drop_duplicates("conversation_hash").copy()
    s["templated"] = mark_templates(s)
    s["family"] = s["model"].map(model_family)
    s["period"] = s.groupby("shard")["timestamp"].transform("min").dt.strftime("%Y-%m")
    by_period = s.groupby("period").agg(
        templated=("templated", "mean"),
        multiturn=("n_user_msgs", lambda n: (n >= 4).mean()),
        turkish=("language", lambda lang: (lang == "Turkish").mean()),
        n=("templated", "size"),
    )
    organic = s[~s["templated"]]
    by_period["multiturn_organic"] = organic.groupby("period")["n_user_msgs"].apply(lambda n: (n >= 4).mean())
    families = pd.crosstab(s["period"], s["family"], normalize="index")
    summary["by_period"] = by_period.round(4).to_dict(orient="index")
    summary["model_family_by_period"] = families.round(4).to_dict(orient="index")

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4))
    ax1.plot(by_period.index, by_period["templated"] * 100, marker="o", color=ORANGE, label="şablon sohbet")
    ax1.plot(by_period.index, by_period["multiturn_organic"] * 100, marker="o", color=TEAL,
             label="şablon dışında en az 4 turlu")
    ax1.set_ylabel("%")
    ax1.set_title("Otomatik trafik zamanla artıyor")
    ax1.tick_params(axis="x", rotation=45)
    ax1.legend()
    order = [c for c in ["GPT-3.5", "GPT-4", "GPT-4o", "o1", "GPT-4.1", "diğer"] if c in families.columns]
    colors = [GREY, "#7FB3BC", TEAL, GOLD, ORANGE, "#DDD"]
    bottom = np.zeros(len(families))
    for col, color in zip(order, colors):
        ax2.bar(families.index, families[col] * 100, bottom=bottom, color=color, label=col)
        bottom += families[col].to_numpy() * 100
    ax2.set_title("Hangi modelle konuşuluyor?")
    ax2.set_ylabel("sohbetlerin %")
    ax2.tick_params(axis="x", rotation=45)
    ax2.legend(fontsize=7.5, ncol=3)
    save(fig, "17_wildchat48_over_time.png")

    # ------------------------------------------------------------------
    # 3. Eğitim tablolarında 1M ile 4.8M: uzunluk, görev türü, etiket.
    # ------------------------------------------------------------------
    t1 = pd.read_parquet(PROCESSED / "train_table_1m.parquet")
    t48 = pd.read_parquet(PROCESSED / "train_table_48m.parquet")
    summary["train_tables"] = {}
    for name, t in [("1m", t1), ("48m", t48)]:
        summary["train_tables"][name] = {
            "n": int(len(t)), "users": int(t["hashed_ip"].nunique()),
            "median_turns": float(t["n_user_msgs"].median()),
            "label_v1_pct": round(float(t["label_v1"].mean() * 100), 2),
            "label_v2_pct": round(float(t["label"].mean() * 100), 2),
            "task_share_pct": {k: round(float(t[f"task_{k}"].mean() * 100), 1) for k in TASK_TYPES},
            "label_v2_by_task_pct": {k: round(float(t.loc[t[f"task_{k}"] == 1, "label"].mean() * 100), 1)
                                     for k in TASK_TYPES},
        }

    fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(12, 3.8))
    for t, color, label in [(t1, GREY, "1M"), (t48, TEAL, "4.8M")]:
        turns = np.sort(t["n_user_msgs"].to_numpy())
        ax1.plot(turns, 1 - np.arange(len(turns)) / len(turns), color=color, label=label)
    ax1.set(xscale="log", yscale="log", xlabel="kullanıcı mesajı sayısı", ylabel="bu uzunluktan uzun olanların payı",
            title="Sohbet uzunluğu (en az 4 tur)")
    ax1.legend()
    x = np.arange(len(TASK_TYPES))
    for offset, name, color in [(-0.2, "1m", GREY), (0.2, "48m", TEAL)]:
        vals = [summary["train_tables"][name]["task_share_pct"][k] for k in TASK_TYPES]
        ax2.bar(x + offset, vals, 0.4, color=color, label=name.upper().replace("48M", "4.8M"))
    ax2.set_xticks(x, [SHORT_TASK[k] for k in TASK_TYPES])
    ax2.set(title="İlk mesajın görev türü", ylabel="%")
    ax2.legend()
    vals = [summary["train_tables"]["48m"]["label_v2_by_task_pct"][k] for k in TASK_TYPES]
    ax3.bar(x, vals, color=ORANGE)
    ax3.axhline(summary["train_tables"]["48m"]["label_v2_pct"], ls="--", color="#666", lw=1)
    ax3.set_xticks(x, [SHORT_TASK[k] for k in TASK_TYPES])
    ax3.set(title="Döngü oranı görev türüne göre (4.8M)", ylabel="%")
    save(fig, "18_1m_vs_48m.png")

    # ------------------------------------------------------------------
    # 4. Etiket doğrulaması: WildFeedback'te DSAT ile karşılaştırma.
    # Etiket kuralını seçerken sohbetlerin yarısına (geliştirme) baktık; burada iki yarı ayrı raporlanır.
    # ------------------------------------------------------------------
    wf = pd.read_parquet(PROCESSED / "train_table_wildfeedback.parquet")
    rng = np.random.default_rng(SEED)
    wf["half"] = np.where(rng.random(len(wf)) < 0.5, "geliştirme", "kontrol")
    signals = {
        "İlk etiket (v1)": wf["label_v1"] == 1,
        f"Benzer mesaj (≥{REPEAT_SIM_THRESHOLD})": wf["future_repeats"] >= 1,
        f"Birebir yeniden gönderim (≥{EXACT_REPEAT_THRESHOLD})": wf["future_exact"] >= 1,
        "Güçlü onarım ifadesi": wf["future_strong_repairs"] >= 1,
        "Yeni etiket (v2)": wf["label"] == 1,
    }
    validation = {"n": int(len(wf)), "dsat_rate": round(float(wf["label_dsat"].mean()), 4), "signals": {}}
    for name, mask in signals.items():
        entry = {}
        for half in ["geliştirme", "kontrol"]:
            h = wf["half"] == half
            base = wf.loc[h, "label_dsat"].mean()
            p = wf.loc[h & mask, "label_dsat"].mean()
            entry[half] = {"share_pct": round(float(mask[h].mean() * 100), 2),
                           "p_dsat": round(float(p), 4), "lift": round(float(p / base), 2)}
        validation["signals"][name] = entry
    (OUT / "label_validation.json").write_text(json.dumps(validation, indent=2, ensure_ascii=False), encoding="utf-8")

    fig, ax = plt.subplots(figsize=(8.5, 3.8))
    names = list(signals)
    y = np.arange(len(names))
    lifts = [validation["signals"][n]["kontrol"]["lift"] for n in names]
    shares = [validation["signals"][n]["kontrol"]["share_pct"] for n in names]
    colors = [ORANGE if "v2" in n else (GREY if "v1" in n else "#7FB3BC") for n in names]
    ax.barh(y, lifts, color=colors)
    for yi, lift, share in zip(y, lifts, shares):
        ax.text(lift + 0.03, yi, f"{lift:.2f} kat  (sohbetlerin %{share:.0f}'i)", va="center", fontsize=8.5)
    ax.axvline(1, ls="--", color="#666", lw=1)
    ax.set_yticks(y, names)
    ax.invert_yaxis()
    ax.set_xlim(0, max(lifts) * 1.45)
    ax.set_xlabel("memnuniyetsizlik (DSAT) oranı / genel oran")
    ax.set_title(f"Hangi sinyal gerçek memnuniyetsizliği gösteriyor? (WildFeedback kontrol yarısı, "
                 f"n={int((wf['half'] == 'kontrol').sum()):,})")
    save(fig, "19_label_validation.png")

    summary["repair_by_turn"] = repair_by_turn(sample48)

    (OUT / "eda_48m_summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False, default=str),
                                             encoding="utf-8")
    print(json.dumps(validation, indent=2, ensure_ascii=False))


def repair_by_turn(sample48):
    """Sohbet uzadıkça onarım ve memnuniyetsizlik oranı nasıl değişiyor? (Şekil 25)

    Uzun sohbetler zaten sorunlu sohbetlerden oluşuyor olabilir (seçilim etkisi). Bunu ayırmak için
    ikinci bir ölçüm yapılır: yalnızca en az 10 (ve 20) turlu sohbetler alınır ve aynı sohbetlerin
    2., 3., ... mesajları karşılaştırılır. Böylece her noktada aynı sohbet kümesine bakılmış olur.
    """
    chats, _ = clean_conversations(load_source("48m"), template_reference=sample48)
    wf = load_source("wildfeedback")
    result = {}

    # Her kullanıcı mesajı için: güçlü onarım ifadesi var mı (4.8M), DSAT işareti var mı (WildFeedback)
    def per_message(messages_list, flag):
        rows = [(i, flag(msgs, i)) for msgs in messages_list for i in range(1, min(len(msgs), 40))]
        return pd.DataFrame(rows, columns=["idx", "flag"]).assign(turn=lambda d: d["idx"] + 1)

    repair = per_message(chats["user_msgs"], lambda m, i: has_strong_repair(m[i]))
    dsat_sets = [set(t) for t in wf["dsat_turns"]]
    rows = [(i, i in s) for s, n in zip(dsat_sets, wf["n_user_msgs"]) for i in range(1, min(n, 40))]
    dsat = pd.DataFrame(rows, columns=["idx", "flag"]).assign(turn=lambda d: d["idx"] + 1)

    bins, labels = [1, 2, 3, 5, 10, 20, 40], ["2", "3", "4-5", "6-10", "11-20", "21-40"]
    for name, d in [("48m_strong_repair", repair), ("wildfeedback_dsat", dsat)]:
        grouped = d.groupby(pd.cut(d["turn"], bins, labels=labels), observed=True)["flag"].mean()
        result[name + "_all"] = {k: round(float(v) * 100, 2) for k, v in grouped.items()}

    # Seçilim etkisini ayırmak için aynı sohbetler içinde mesaj sırasına göre
    within = {}
    for name, msgs_list, flag, min_len in [
        ("4.8M, en az 10 turlu", chats["user_msgs"], lambda m, i: has_strong_repair(m[i]), 10),
        ("4.8M, en az 20 turlu", chats["user_msgs"], lambda m, i: has_strong_repair(m[i]), 20),
        ("WildFeedback DSAT, en az 10 turlu", list(zip(dsat_sets, wf["n_user_msgs"])), None, 10),
    ]:
        if flag is None:
            subset = [s for s, n in msgs_list if n >= min_len]
            within[name] = [round(float(np.mean([(i in s) for s in subset])) * 100, 2) for i in range(1, min_len)]
        else:
            subset = [m for m in msgs_list if len(m) >= min_len]
            within[name] = [round(float(np.mean([flag(m, i) for m in subset])) * 100, 2) for i in range(1, min_len)]
        within[name + " (sohbet sayısı)"] = len(subset)
    result["within_conversation"] = within

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4))
    ax1.plot(labels, list(result["48m_strong_repair_all"].values()), marker="o", color=TEAL,
             label="4.8M: güçlü onarım ifadesi")
    ax1.plot(labels, list(result["wildfeedback_dsat_all"].values()), marker="o", color=ORANGE,
             label="WildFeedback: memnuniyetsizlik (DSAT)")
    ax1.set(xlabel="kullanıcı mesajının sırası", ylabel="mesajların %",
            title="Tüm sohbetler: mesaj sırasına göre", ylim=(0, None))
    ax1.legend(fontsize=8)
    for (name, vals), color in zip([(k, v) for k, v in within.items() if not k.endswith("sayısı)")],
                                   [TEAL, "#7FB3BC", ORANGE]):
        n = within[name + " (sohbet sayısı)"]
        ax2.plot(range(2, len(vals) + 2), vals, marker=".", color=color, label=f"{name} (n={n:,})")
    ax2.set(xlabel="kullanıcı mesajının sırası", ylabel="mesajların %",
            title="Aynı sohbetlerin içinde: seçilim etkisi ayrılmış", ylim=(0, None))
    ax2.set_xticks(range(2, 21, 2))
    ax2.legend(fontsize=8)
    save(fig, "25_repair_by_turn.png")
    return result


if __name__ == "__main__":
    main()
