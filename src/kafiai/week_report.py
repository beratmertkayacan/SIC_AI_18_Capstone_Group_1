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
LOOP_ENDS = ["toparlandi", "yeni_sohbet", "birakildi"]
HINTS = ["gosterildi", "ozetlet", "adim_yaz", "yerinde_degil", "kapat"]


def week_start(day):
    """Verilen günün (YYYY-MM-DD) haftasının Pazartesisi."""
    d = date.fromisoformat(day)
    return (d - timedelta(days=d.weekday())).isoformat()


def week_days(start):
    s = date.fromisoformat(start)
    return [(s + timedelta(days=i)).isoformat() for i in range(7)]


def shift_week(start, back):
    return (date.fromisoformat(start) - timedelta(days=7 * back)).isoformat()


def _previous(days, start, from_day=None):
    wanted = {d for d in week_days(start) if from_day is None or d >= from_day}
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


def week_report(days, start, from_day=None):
    """`days`: sayaç çıktısındaki days alanı; `start`: haftanın Pazartesisi.

    `from_day` (YYYY-MM-DD ya da None): "Özeti bugünden başlat" sonrası bu günden önceki sayılar
    okunmaz (silinmez). Eklentideki weekReport'un `from` parametresiyle aynı.
    """
    week = week_days(start)
    index = {d: i for i, d in enumerate(week) if from_day is None or d >= from_day}
    per_day = [{"conversations": 0, "loops": 0, "loop_ends": 0} for _ in week]
    conv = dict.fromkeys(TASKS, 0)
    loops = dict.fromkeys(TASKS, 0)
    task_ends = dict.fromkeys(TASKS, 0)
    ends = dict.fromkeys(LOOP_ENDS, 0)
    hints = dict.fromkeys(HINTS, 0)
    strip_tasks = dict.fromkeys(TASKS, 0)
    cards = card_not_helpful = 0
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
                task = p[2] if len(p) > 2 else ""
                if detail == "gosterildi" and task in strip_tasks:
                    strip_tasks[task] += n
            elif event == "strip_action" and detail in actions:
                actions[detail] += n
            elif event == "repair_button" and detail in repairs:
                repairs[detail] += n
            elif event == "card_action" and detail == "taze_baslat":
                fresh += n
            elif event == "card_action" and detail == "yerinde_degil":
                card_not_helpful += n
            elif event == "fresh_followup" and detail in follow:
                follow[detail] += n
            elif event == "loop_end" and detail in ends:
                ends[detail] += n
                per_day[di]["loop_ends"] += n
                task = p[2] if len(p) > 2 else ""
                if task in task_ends:
                    task_ends[task] += n
            elif event == "card" and detail.startswith("gosterildi_"):
                cards += n
            elif event == "hint" and detail in hints:
                hints[detail] += n

    total = sum(d["conversations"] for d in per_day)
    return {
        "start": start,
        "end": week[6],
        "conversations": total,
        "loops": sum(d["loops"] for d in per_day),
        "days": per_day,
        "tasks": [{"task": t, "conversations": conv[t], "loops": loops[t], "loop_ends": task_ends[t]} for t in TASKS],
        "lengths": [{"len": b, "conversations": lens[b]} for b in LENS],
        "platforms": [{"platform": p, "conversations": plats[p]} for p in PLATFORMS],
        "similar_sends": similar,
        "similar_grid": grid,
        "strips": strips,
        "strip_actions": actions,
        "repairs": repairs,
        "fresh_starts": fresh,
        "fresh_followups": follow,
        "loop_ends": ends,
        "cards_shown": cards,
        "hints": hints,
        "not_helpful": {"strip": actions["yerinde_degil"], "card": card_not_helpful, "hint": hints["yerinde_degil"]},
        "strips_by_task": strip_tasks,
        "previous": _previous(days, shift_week(start, 1), from_day),
        "enough": total >= CONFIG["min_conversations"],
    }
