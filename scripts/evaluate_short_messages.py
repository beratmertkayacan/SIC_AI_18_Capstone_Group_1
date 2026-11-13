"""Kısa mesajlar (12 karakterden az) memnuniyetsizlikle ne kadar ilişkili?

Tekrar dedektörü bu mesajlara bakmaz. Bu betik WildFeedback sohbetlerinde kısa mesajları dört gruba
ayırır ve her grupta o turda ve bir sonraki turda memnuniyetsizlik (DSAT) oranını hesaplar:

  kısa onarım       güçlü onarım ifadesi taşıyor ("olmadı", "yanlış", "still wrong")
  kısa aynı tekrar  son dört kısa mesajdan biriyle birebir aynı ("devam", "continue")
  kısa belirsiz     açıklamasız düzeltme ("kısalt", "better")
  kısa diğer        geri kalanı

Sonuçlar signal-rules.json içindeki "short" kuralının dayanağıdır (karar K34).

Kullanım:
    python scripts/evaluate_short_messages.py
Girdi:  data/processed/wildfeedback_conversations.parquet
Çıktı:  outputs/short_messages.json (yalnızca sayılar)
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai import config  # noqa: E402
from kafiai.extension_similarity import normalize_text  # noqa: E402
from kafiai.signals import is_exit_message, is_short_repair, is_vague  # noqa: E402

DATA = ROOT / "data" / "processed" / "wildfeedback_conversations.parquet"
OUT = ROOT / "outputs" / "short_messages.json"


def group_of(text, previous_short):
    normalized = normalize_text(text)
    if len(normalized) >= config.EXT_MIN_NORMALIZED_CHARS:
        return "uzun", normalized
    if not normalized:
        return None, normalized
    if is_short_repair(text):
        return "kisa_onarim", normalized
    if is_exit_message(text):
        return "kisa_cikis", normalized
    if normalized in previous_short[-4:]:
        return "kisa_ayni_tekrar", normalized
    if is_vague(text):
        return "kisa_belirsiz", normalized
    return "kisa_diger", normalized


def main():
    df = pd.read_parquet(DATA)
    df = df[df.n_user_msgs >= 2]
    stats = defaultdict(lambda: {"n": 0, "dsat": 0, "sonraki_n": 0, "sonraki_dsat": 0})
    for msgs, dsat in zip(df.user_msgs, df.dsat_turns):
        msgs = [str(m or "") for m in msgs]
        ds = {int(x) for x in dsat}
        previous_short = []
        for t, text in enumerate(msgs):
            if t == 0:
                continue  # ilk mesajda önceki cevap yok
            group, normalized = group_of(text, previous_short)
            if group is None:
                continue
            s = stats[group]
            s["n"] += 1
            s["dsat"] += t in ds
            if t + 1 < len(msgs):
                s["sonraki_n"] += 1
                s["sonraki_dsat"] += (t + 1) in ds
            if group != "uzun":
                previous_short.append(normalized)
    total = sum(s["n"] for s in stats.values())
    result = {
        "kaynak": "WildFeedback (sat_dsat_annotation), ilk mesaj hariç tüm kullanıcı turları",
        "kisa_esik_karakter": config.EXT_MIN_NORMALIZED_CHARS,
        "gruplar": {
            g: {
                "tur": s["n"],
                "tur_yuzde": round(100 * s["n"] / total, 2),
                "bu_turda_dsat_yuzde": round(100 * s["dsat"] / s["n"], 1),
                "sonraki_turda_dsat_yuzde": round(100 * s["sonraki_dsat"] / s["sonraki_n"], 1) if s["sonraki_n"] else None,
            }
            for g, s in sorted(stats.items(), key=lambda kv: -kv[1]["n"])
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
