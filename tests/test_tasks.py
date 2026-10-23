"""Görev türü kurallarının testi. Aynı örnekleri eklentideki tasks.test.ts de okur."""

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai.tasks import TASK_LABELS, TASK_TYPES, task_type  # noqa: E402

FIXTURE = json.loads((ROOT / "tests" / "fixtures" / "task_types.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("row", FIXTURE, ids=[r["text"][:30] for r in FIXTURE])
def test_task_type(row):
    assert task_type(row["text"]) == row["task"]


def test_every_type_has_label():
    assert set(TASK_TYPES) == set(TASK_LABELS)
