"""Kısıt kontrolünün (deney) Python eşi ile eklentinin aynı sonucu verdiğini sınar.

tests/fixtures/constraint_parity.json dosyasını extension/src/core/constraint-check.test.ts de okur.
"""

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai.constraint_check import decide_constraint  # noqa: E402

ROWS = json.loads((ROOT / "tests" / "fixtures" / "constraint_parity.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("row", ROWS, ids=[r["name"] for r in ROWS])
def test_constraint_parity(row):
    d = decide_constraint(row["user_texts"], row["turn"], row["answer"], row["earlier_unknown"])
    assert d["result"] == row["result"]
    assert d["constraint_turn"] == row["constraint_turn"]
    c = d["constraint"]
    assert (None if c is None else {"n": c["n"], "unit": c["unit"], "kind": c["kind"]}) == row["rule"]
    assert (d["words"], d["chars"], d["chars_no_space"]) == (row["words"], row["chars"], row["chars_no_space"])
    assert d["reason"] == row["reason"]


def test_exact_limit_differs_between_inclusive_and_strict():
    answer = " ".join(["kelime"] * 30)
    assert decide_constraint(["En fazla 30 kelime yaz."], 1, answer)["result"] == "uyuyor"
    assert decide_constraint(["30 kelimeden az yaz."], 1, answer)["result"] == "aşıyor"
