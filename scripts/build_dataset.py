"""Model eğitimi için öznitelik ve etiket tablosunu hazırlar.

Kaynaklar (bkz. src/kafiai/data.py):
    1m           WildChat 1M örneklemi (50.000 sohbet)
    48m          WildChat 4.8M, en az 4 turlu sohbetler (ana eğitim verisi)
    48m_turkish  WildChat 4.8M, Türkçe sohbetler (ayrı test seti)
    wildfeedback WildFeedback; ayrıca hazır memnuniyetsizlik etiketi (label_dsat) eklenir

Çıktılar:
    data/processed/train_table_<kaynak>.parquet   (repoya eklenmez)
    outputs/dataset_summary_<kaynak>.json         (repoda durur, yalnızca sayılar)

Çalıştırma (repo kök klasöründe):
    python scripts/build_dataset.py --source 48m
    python scripts/build_dataset.py --source 1m
    python scripts/build_dataset.py --source 48m_turkish
"""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai.config import K_TURNS, LABEL_MIN_REPAIRS, LABEL_MIN_REPEATS  # noqa: E402
from kafiai.data import PROCESSED, SOURCES, clean_conversations, load_source  # noqa: E402
from kafiai.features import build_feature_table, text_of_first_turns  # noqa: E402
from kafiai.labels import future_signals, future_signals_v2  # noqa: E402
from kafiai.config import LABEL_V2_MIN_REPAIRS  # noqa: E402

KEEP = ["conversation_hash", "hashed_ip", "timestamp", "model", "language", "country", "n_user_msgs"]


def main():
    parser = argparse.ArgumentParser(description="Öznitelik ve etiket tablosu")
    parser.add_argument("--source", choices=["1m", "48m", "48m_turkish", "wildfeedback"], default="48m")
    args = parser.parse_args()

    df = load_source(args.source)

    # 4.8M'de şablon sıklığı, verinin genelini temsil eden rastgele örneklemle birlikte sayılır.
    reference = None
    if args.source.startswith("48m") and SOURCES["48m_sample"].exists():
        reference = load_source("48m_sample")
    df, steps = clean_conversations(df, template_reference=reference)
    for name, n in steps.items():
        print(f"{n:>9,}  {name}")

    # Öznitelikler yalnızca ilk K_TURNS mesajdan, etiket yalnızca sonrasından.
    features = build_feature_table(df, k=K_TURNS)
    signals = df["user_msgs"].apply(lambda m: future_signals(m, k=K_TURNS))
    df["future_repeats"] = signals.str[0]
    df["future_repairs"] = signals.str[1]
    df["label_v1"] = ((df["future_repeats"] >= LABEL_MIN_REPEATS)
                      | (df["future_repairs"] >= LABEL_MIN_REPAIRS)).astype(int)

    # Modelin hedefi ikinci sürüm etiket (labels.loop_label ile aynı kural).
    v2 = df["user_msgs"].apply(lambda m: future_signals_v2(m, k=K_TURNS))
    df["future_exact"] = v2.str[0]
    df["future_strong_repairs"] = v2.str[1]
    df["label"] = ((df["future_strong_repairs"] >= LABEL_V2_MIN_REPAIRS)
                   | ((df["future_strong_repairs"] >= 1) & (df["future_exact"] >= 1))).astype(int)
    df["text"] = df["user_msgs"].apply(text_of_first_turns)

    # WildFeedback: modelin görmediği turlarda (K_TURNS ve sonrası) kullanıcı memnuniyetsizliği var mı?
    if "dsat_turns" in df.columns:
        df["label_dsat"] = df["dsat_turns"].apply(lambda turns: int(any(t >= K_TURNS for t in turns)))

    keep = [c for c in KEEP + ["shard", "label_dsat", "text_key"] if c in df.columns]
    table = pd.concat([df[keep + ["future_repeats", "future_repairs", "label_v1",
                                       "future_exact", "future_strong_repairs", "label", "text"]], features], axis=1)
    table_path = PROCESSED / f"train_table_{args.source}.parquet"
    table.to_parquet(table_path)

    summary = {
        "source": args.source,
        "cleaning_steps": steps,
        "n_labelable": int(len(table)),
        "n_users": int(table["hashed_ip"].nunique()),
        "k_turns": K_TURNS,
        "positive_rate_pct": round(float(table["label"].mean() * 100), 2),
        "positive_rate_v1_pct": round(float(table["label_v1"].mean() * 100), 2),
        "positive_by_reason_v1_pct": {
            "repeat_rule": round(float((table["future_repeats"] >= LABEL_MIN_REPEATS).mean() * 100), 2),
            "repair_rule": round(float((table["future_repairs"] >= LABEL_MIN_REPAIRS).mean() * 100), 2),
        },
        "turkish_rows": int((table["language"] == "Turkish").sum()),
    }
    if table["timestamp"].notna().any():
        summary["date_range"] = [str(table["timestamp"].min().date()), str(table["timestamp"].max().date())]
    if "label_dsat" in table.columns:
        summary["dsat_after_k_pct"] = round(float(table["label_dsat"].mean() * 100), 2)
    out = ROOT / "outputs" / f"dataset_summary_{args.source}.json"
    out.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in summary.items() if k != "cleaning_steps"}, indent=2, ensure_ascii=False))
    print(f"Tablo yazıldı: {table_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
