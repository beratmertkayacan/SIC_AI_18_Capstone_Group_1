"""Sohbet sinyalleri (K32): Python ikizinin parite örnekleriyle aynı kararı verdiğini denetler."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from kafiai.signals import ConversationSignals, apologizes, is_exit_message, is_vague  # noqa: E402

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "signals_parity.json").read_text(encoding="utf-8"))


def test_unit_rules_match_fixture():
    for text, expected in FIXTURE["units"]["apology"]:
        assert apologizes(text) == expected, text
    for text, expected in FIXTURE["units"]["exit"]:
        assert is_exit_message(text) == expected, text
    for text, expected in FIXTURE["units"]["vague"]:
        assert is_vague(text) == expected, text


def test_conversation_states_match_fixture():
    for conv in FIXTURE["conversations"]:
        s = ConversationSignals()
        for user, answer, similar, expected in zip(conv["user"], conv["answers"], conv["similar"], conv["expected"]):
            s.note_user(user, similar)
            s.note_answer(answer)
            got = {"recent_similar": s.recent_similar, "apology": s.apology_streak, "vague": s.vague_streak,
                   "segments": s.segments, "segment_start": s.segment_start, "exited": s.exited}
            assert got == expected, user


def test_exit_resets_loop_signals():
    s = ConversationSignals()
    s.note_user("bu kodu düzelt hata veriyor", False)
    s.note_answer("I apologize, here is the fix")
    s.note_user("bu kodu düzelt hata veriyor", True)
    s.note_answer("I apologize again")
    assert (s.recent_similar, s.apology_streak) == (1, 2)
    s.note_user("teşekkürler, oldu", False)
    assert s.exited and s.recent_similar == 0 and s.apology_streak == 0
