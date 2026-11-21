"""tests/fixtures/week_report_parity.json dosyasını üretir: rastgele sayaç günleri ve Python'daki
haftalık özet sonucu. Eklentideki week-report.test.ts aynı girdiden aynı sonucu bekler."""

import json
import random
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai.counters import SCHEMA, is_valid_cell_key  # noqa: E402
from kafiai.week_report import week_report, week_start  # noqa: E402

D = SCHEMA["dimensions"]
E = SCHEMA["events"]


def random_key(rng):
    kind = rng.random()
    pick = rng.choice
    if kind < 0.3:
        return "|".join(["conversation", pick(D["platform"]), pick(D["task"]), pick(D["len"]), pick(D["first_len"]),
                         pick(["dongu", "normal", "normal"])])
    if kind < 0.55:
        return "|".join(["send", pick(D["platform"]), pick(D["slot"]), pick(D["task"]), pick(D["len"]),
                         pick(["benzer", "farkli", "varyasyon", "kisa"])])
    if kind < 0.68:
        return "|".join(["strip", pick(D["platform"]), pick(D["task"]), pick(E["strip"]["details"])])
    if kind < 0.76:
        return "|".join(["strip_action", pick(D["platform"]), pick(E["strip_action"]["details"])])
    if kind < 0.84:
        return "|".join(["repair_button", pick(D["platform"]), pick(D["task"]), pick(E["repair_button"]["details"])])
    if kind < 0.9:
        return "|".join(["card_action", pick(D["platform"]), pick(E["card_action"]["details"])])
    if kind < 0.95:
        return "|".join(["fresh_followup", pick(D["platform"]), pick(D["len"])])
    return "|".join(["signal", pick(D["platform"]), pick(D["task"]), "ozur_dongusu"])


def random_days(rng, last, n_days, per_day):
    days = {}
    for i in range(n_days):
        day = (date.fromisoformat(last) - timedelta(days=i)).isoformat()
        c = {}
        for _ in range(per_day):
            key = random_key(rng)
            assert is_valid_cell_key(key), key
            c[key] = c.get(key, 0) + rng.randint(1, 3)
        days[day] = {"phase": "oneri", "c": c}
    return days


def main():
    rng = random.Random(11)
    cases = []
    # 18 Kasım 2026 Çarşamba; hafta 16 Kasım Pazartesi ile başlar
    for last, n_days, per_day in [("2026-11-18", 0, 0), ("2026-11-18", 3, 2), ("2026-11-22", 9, 6),
                                  ("2026-11-16", 16, 12), ("2027-01-03", 14, 15), ("2026-03-30", 10, 8)]:
        days = random_days(rng, last, n_days, per_day)
        start = week_start(last)
        cases.append({"start": start, "days": days, "expected": week_report(days, start)})
    out = ROOT / "tests" / "fixtures" / "week_report_parity.json"
    out.write_text(json.dumps(cases, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(cases)} örnek yazıldı: {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
