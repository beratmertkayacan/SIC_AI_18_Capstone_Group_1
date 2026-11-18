"""Haftalık özet sayfasının sayıları: eklentideki src/core/week-report.ts ile aynı hesap.

Takvim haftası Pazartesi ile Pazar arasıdır. Sayaç çıktısından (K18) bir haftanın sayfasında ne
görüneceğini yeniden üretmek ve iki dilin aynı sonucu verdiğini sınamak için kullanılır
(tests/fixtures/week_report_parity.json).
"""

import json
from datetime import date, timedelta
from pathlib import Path

from kafiai.counters import SCHEMA

CONFIG = json.loads(
    (Path(__file__).resolve().parents[2] / "extension" / "src" / "data" / "insights-config.json").read_text(encoding="utf-8")
)
TASKS = SCHEMA["dimensions"]["task"]
LENS = SCHEMA["dimensions"]["len"]
PLATFORMS = SCHEMA["dimensions"]["platform"]
SLOTS = SCHEMA["dimensions"]["slot"]
REPAIRS = SCHEMA["events"]["repair_button"]["details"]
STRIP_KINDS = {"gosterildi": "benzer", "gosterildi_kisa": "kisa", "gosterildi_tekrar": "tekrar"}
ACTIONS = ["yine_de_gonder", "duzenle", "yerinde_degil", "yeni_sohbet"]


def week_start(day):
    """Verilen günün (YYYY-MM-DD) haftasının Pazartesisi."""
    d = date.fromisoformat(day)
    return (d - timedelta(days=d.weekday())).isoformat()


def week_days(start):
    s = date.fromisoformat(start)
    return [(s + timedelta(days=i)).isoformat() for i in range(7)]


def shift_week(start, back):
    return (date.fromisoformat(start) - timedelta(days=7 * back)).isoformat()


def _previous(days, start):
    wanted = set(week_days(start))
    out = {"conversations": 0, "loops": 0, "strips_benzer": 0}
    for day, rec in days.items():
        if day not in wanted:
            continue
        for key, n in rec["c"].items():
            if key.startswith("conversation|"):
                out["conversations"] += n
                if key.endswith("|dongu"):
                    out["loops"] += n
            elif key.startswith("strip|") and key.endswith("|gosterildi"):
                out["strips_benzer"] += n
    return out


def week_report(days, start):
    """`days`: sayaç çıktısındaki days alanı; `start`: haftanın Pazartesisi."""
    week = week_days(start)
    index = {d: i for i, d in enumerate(week)}
    per_day = [{"conversations": 0, "loops": 0} for _ in week]
    conv = dict.fromkeys(TASKS, 0)
    loops = dict.fromkeys(TASKS, 0)
    lens = dict.fromkeys(LENS, 0)
    plats = dict.fromkeys(PLATFORMS, 0)
    grid = [[0] * 7 for _ in SLOTS]
    strips = {"benzer": 0, "kisa": 0, "tekrar": 0}
    actions = dict.fromkeys(ACTIONS, 0)
    repairs = dict.fromkeys(REPAIRS, 0)
    follow = dict.fromkeys(LENS, 0)
    similar = fresh = 0

    for day, rec in days.items():
        di = index.get(day)
        if di is None:
            continue
        for key, n in rec["c"].items():
            p = key.split("|")
            event, detail = p[0], p[-1]
            if event == "conversation":
                platform, task, length = (p[1:4] + ["na"] * 3)[:3]
                is_loop = detail == "dongu"
                per_day[di]["conversations"] += n
                if is_loop:
                    per_day[di]["loops"] += n
                if task in conv:
                    conv[task] += n
                    if is_loop:
                        loops[task] += n
                if length in lens:
                    lens[length] += n
                if platform in plats:
                    plats[platform] += n
            elif event == "send" and detail == "benzer":
                similar += n
                slot = p[2] if len(p) > 2 else ""
                if slot in SLOTS:
                    grid[SLOTS.index(slot)][di] += n
            elif event == "strip" and detail in STRIP_KINDS:
                strips[STRIP_KINDS[detail]] += n
            elif event == "strip_action" and detail in actions:
                actions[detail] += n
            elif event == "repair_button" and detail in repairs:
                repairs[detail] += n
            elif event == "card_action" and detail == "taze_baslat":
                fresh += n
            elif event == "fresh_followup" and detail in follow:
                follow[detail] += n

    total = sum(d["conversations"] for d in per_day)
    return {
        "start": start,
        "end": week[6],
        "conversations": total,
        "loops": sum(d["loops"] for d in per_day),
        "days": per_day,
        "tasks": [{"task": t, "conversations": conv[t], "loops": loops[t]} for t in TASKS],
        "lengths": [{"len": b, "conversations": lens[b]} for b in LENS],
        "platforms": [{"platform": p, "conversations": plats[p]} for p in PLATFORMS],
        "similar_sends": similar,
        "similar_grid": grid,
        "strips": strips,
        "strip_actions": actions,
        "repairs": repairs,
        "fresh_starts": fresh,
        "fresh_followups": follow,
        "previous": _previous(days, shift_week(start, 1)),
        "enough": total >= CONFIG["min_conversations"],
    }
