"""Tur modeli için eğitim tablosu: her sohbetten birden fazla satır.

Bir sohbet en az k + 2 mesajlıysa, k = 2, 3, ..., MAX_TURN_K için birer satır üretilir.
Her satırda öznitelikler ilk k mesajdan, etiket (labels.loop_label) k. mesajdan sonrasından gelir.
Böylece model, eklentide her yeni mesajda vereceği kararın aynısını öğrenir.

Aynı sohbetin satırları aynı kullanıcıya ait olduğu için eğitim ve testte kullanıcı bazlı
bölme sızıntıyı engeller (bkz. train_turn_model.py).

Çalıştırma (repo kök klasöründe, önce build_dataset.py ile aynı ham dosyalar gerekir):
    python scripts/build_turn_dataset.py --source 48m
    python scripts/build_turn_dataset.py --source 48m_turkish
    python scripts/build_turn_dataset.py --source 1m
    python scripts/build_turn_dataset.py --source wildfeedback
Çıktı:
    data/processed/turns_<kaynak>.parquet   (repoya eklenmez)
    outputs/turn_dataset_<kaynak>.json      (satır sayıları ve tur başına döngü oranı)
"""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai.config import MAX_TURN_K  # noqa: E402
from kafiai.data import PROCESSED, SOURCES, clean_conversations, load_source  # noqa: E402
from kafiai.labels import loop_label  # noqa: E402
from kafiai.turn_features import TURN_FEATURES, turn_features  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Tur modeli tablosu")
    parser.add_argument("--source", choices=["1m", "48m", "48m_turkish", "wildfeedback"], default="48m")
    args = parser.parse_args()

    df = load_source(args.source)
    reference = load_source("48m_sample") if args.source.startswith("48m") and SOURCES["48m_sample"].exists() else None
    df, _ = clean_conversations(df, template_reference=reference)

    rows = []
    for conv in df.itertuples(index=False):
        msgs = list(conv.user_msgs)
        # Aynı sohbetin başka bir veri setinde de geçip geçmediğini anlamak için ilk iki mesaj
        key = " ".join(str(x) for x in msgs[:2]).strip().lower()
        for k in range(2, MAX_TURN_K + 1):
            if len(msgs) < k + 2:  # etiket için k'dan sonra en az 2 mesaj gerekir
                break
            row = {"conversation_hash": conv.conversation_hash, "hashed_ip": conv.hashed_ip,
                   "language": conv.language, "text_key": key, "k": k, "label": loop_label(msgs, k=k)}
            if hasattr(conv, "dsat_turns"):
                row["label_dsat"] = int(any(t >= k for t in conv.dsat_turns))
            row.update(turn_features(msgs, k))
            rows.append(row)

    table = pd.DataFrame(rows)
    out = PROCESSED / f"turns_{args.source}.parquet"
    table.to_parquet(out)

    by_k = table.groupby("k")["label"].agg(["size", "mean"])
    summary = {
        "source": args.source,
        "n_rows": int(len(table)),
        "n_conversations": int(table["conversation_hash"].nunique()),
        "n_features": len(TURN_FEATURES),
        "rows_by_k": {int(k): int(v) for k, v in by_k["size"].items()},
        "positive_rate_by_k_pct": {int(k): round(float(v) * 100, 2) for k, v in by_k["mean"].items()},
    }
    (ROOT / "outputs" / f"turn_dataset_{args.source}.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"Tablo yazıldı: {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
