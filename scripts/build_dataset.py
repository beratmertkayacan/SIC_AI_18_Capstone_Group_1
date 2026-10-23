"""Model eğitimi için öznitelik ve etiket tablosunu hazırlar.

Girdi:  data/processed/wildchat_sample_50000.pkl  (run_eda.py ilk çalıştığında oluşur)
Çıktı:  data/processed/train_table.parquet         (repoya eklenmez)
        outputs/dataset_summary.json               (repoda durur, sadece sayılar)

Çalıştırma (repo kök klasöründe):
    python scripts/build_dataset.py
"""

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai.config import K_TURNS, MIN_TURNS_FOR_LABEL  # noqa: E402
from kafiai.features import build_feature_table  # noqa: E402
from kafiai.labels import future_signals  # noqa: E402
from kafiai.split import mark_templates  # noqa: E402
from kafiai.config import LABEL_MIN_REPAIRS, LABEL_MIN_REPEATS  # noqa: E402

SAMPLE = ROOT / "data" / "processed" / "wildchat_sample_50000.pkl"
TABLE = ROOT / "data" / "processed" / "train_table.parquet"
SUMMARY = ROOT / "outputs" / "dataset_summary.json"


def main():
    if not SAMPLE.exists():
        sys.exit(f"Örneklem bulunamadı: {SAMPLE}\nÖnce 'python scripts/run_eda.py' çalıştırın.")

    df = pd.read_pickle(SAMPLE)
    n_total = len(df)

    # 1. Şablon sohbetleri çıkar
    df["templated"] = mark_templates(df)
    df = df[~df["templated"]]
    n_organic = len(df)

    # 2. Yalnızca etiket üretilebilecek kadar uzun sohbetleri tut
    df = df[df["n_user_msgs"] >= MIN_TURNS_FOR_LABEL].copy()
    print(f"{n_total:,} sohbet, şablon dışı {n_organic:,}, en az {MIN_TURNS_FOR_LABEL} turlu {len(df):,}")

    # 3. Öznitelikler (yalnızca ilk K_TURNS mesaj)
    features = build_feature_table(df, k=K_TURNS)

    # 4. Etiket (yalnızca K_TURNS sonrası)
    signals = df["user_msgs"].apply(lambda m: future_signals(m, k=K_TURNS))
    df["future_repeats"] = signals.str[0]
    df["future_repairs"] = signals.str[1]
    df["label"] = ((df["future_repeats"] >= LABEL_MIN_REPEATS) | (df["future_repairs"] >= LABEL_MIN_REPAIRS)).astype(int)

    table = pd.concat(
        [df[["conversation_hash", "hashed_ip", "language", "country", "n_user_msgs",
             "future_repeats", "future_repairs", "label"]], features],
        axis=1,
    )
    TABLE.parent.mkdir(parents=True, exist_ok=True)
    table.to_parquet(TABLE)

    summary = {
        "n_sample": n_total,
        "n_after_template_filter": n_organic,
        "n_labelable": int(len(table)),
        "n_users": int(table["hashed_ip"].nunique()),
        "k_turns": K_TURNS,
        "positive_rate_pct": round(float(table["label"].mean() * 100), 2),
        "positive_by_reason_pct": {
            "repeat_rule": round(float((table["future_repeats"] >= LABEL_MIN_REPEATS).mean() * 100), 2),
            "repair_rule": round(float((table["future_repairs"] >= LABEL_MIN_REPAIRS).mean() * 100), 2),
        },
        "turkish_rows": int((table["language"] == "Turkish").sum()),
    }
    SUMMARY.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"Tablo yazıldı: {TABLE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
