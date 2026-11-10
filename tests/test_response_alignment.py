"""Cevapların kullanıcı mesajlarıyla doğru eşlendiğini denetler (indirme betikleri, ağ gerekmez)."""

import importlib.util
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


def _load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_wildfeedback_answers_align_with_user_turns():
    wf = _load("fetch_wildfeedback")
    rows = [
        # sohbet 1: kullanıcı, cevap, kullanıcı, iki parçalı cevap
        (0, "user", "soru 1", "False", "False", "N/A"),
        (1, "assistant", "cevap 1", "", "", ""),
        (2, "user", "soru 2", "True", "False", "Revision"),
        (3, "assistant", "cevap 2a", "", "", ""),
        (4, "assistant", "cevap 2b", "", "", ""),
        # sohbet 2: cevapsız tek mesaj
        (0, "user", "yalnız soru", "False", "True", "N/A"),
    ]
    df = pd.DataFrame(rows, columns=["UtteranceId", "Role", "Content", "Disatisfaction",
                                     "Satisfaction", "Disatisfaction Justification"])
    df["Intent"] = "x"
    df["Domain"] = "y"
    conv = wf.to_conversations(df)
    assert conv.loc[0, "user_msgs"] == ["soru 1", "soru 2"]
    assert conv.loc[0, "assistant_msgs"] == ["cevap 1", "cevap 2a\ncevap 2b"]
    assert conv.loc[0, "dsat_turns"] == [1]
    assert conv.loc[1, "assistant_msgs"] == [""]
    assert conv.loc[1, "sat_turns"] == [0]


def test_wildchat_extract_answers_align():
    try:
        wc = _load("fetch_wildchat48")
    except ImportError:
        import pytest
        pytest.skip("indirme bağımlılıkları yok")
    row = {"conversation_hash": "h", "timestamp": None, "model": "m", "turn": 2, "language": "Turkish",
           "country": "Turkey", "hashed_ip": "ip", "toxic": False, "redacted": False,
           "conversation": [{"role": "user", "content": "a"}, {"role": "assistant", "content": "A"},
                            {"role": "user", "content": "b"}]}
    out = wc.extract(row)
    assert out["user_msgs"] == ["a", "b"]
    assert out["assistant_msgs"] == ["A", ""]


def test_response_signal_rows():
    rs = _load("evaluate_response_signal")
    users = ["bu kodu düzelt lütfen", "bu kodu düzelt lütfen", "teşekkürler"]
    same = ["def f(): return 1  # düzeltildi", "def f(): return 1  # düzeltildi"]
    rows = list(rs.repeat_rows(users, same + ["rica ederim"], dsat=[2]))
    assert len(rows) == 1
    assert rs.bucket(rows[0]["cevap_benzerligi"]) == "ayni_cevap"
    assert rows[0]["sonraki_dsat"] is True
    diff = ["Soru 1: Hücrenin enerji merkezi neresidir?", "Soru 2: Fotosentez hangi organelde olur?"]
    rows = list(rs.repeat_rows(["sonraki soruyu sor", "sonraki soruyu sor"], diff))
    assert rs.bucket(rows[0]["cevap_benzerligi"]) == "farkli_cevap"
    assert rows[0]["varyasyon"] is True


def test_apology_detection():
    rs = _load("evaluate_response_signal")
    assert rs.apologizes("I apologize for the confusion. Here is the corrected code")
    assert rs.apologizes("Haklısınız, özür dilerim. Doğrusu şu:")
    assert not rs.apologizes("Here is the code you asked for")
