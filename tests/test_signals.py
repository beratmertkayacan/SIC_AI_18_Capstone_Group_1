"""Sohbet sinyalleri (K32): Python ikizinin parite örnekleriyle aynı kararı verdiğini denetler."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from kafiai.signals import ConversationSignals, apologizes, is_exit_message, is_short_repair, is_vague  # noqa: E402

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "signals_parity.json").read_text(encoding="utf-8"))


def test_unit_rules_match_fixture():
    for text, expected in FIXTURE["units"]["apology"]:
        assert apologizes(text) == expected, text
    for text, expected in FIXTURE["units"]["exit"]:
        assert is_exit_message(text) == expected, text
    for text, expected in FIXTURE["units"]["vague"]:
        assert is_vague(text) == expected, text
    for text, expected in FIXTURE["units"]["short_repair"]:
        assert is_short_repair(text) == expected, text


def test_conversation_states_match_fixture():
    for conv in FIXTURE["conversations"]:
        s = ConversationSignals()
        for user, answer, similar, expected in zip(conv["user"], conv["answers"], conv["similar"], conv["expected"]):
            s.note_user(user, similar)
            s.note_answer(answer)
            got = {"recent_similar": s.recent_similar, "apology": s.apology_streak, "vague": s.vague_streak,
                   "segments": s.segments, "segment_start": s.segment_start, "exited": s.exited,
                   "short_repeat": s.short_repeat_streak, "short_repair": s.last_short_repair}
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


def test_short_repair_counts_as_retry_but_not_on_first_message():
    s = ConversationSignals()
    s.note_user("olmadı", False)
    assert not s.last_short_repair and s.recent_similar == 0
    s.note_user("olmadı", False)
    assert s.last_short_repair and s.recent_similar == 1


def test_same_short_message_streak():
    s = ConversationSignals()
    for expected in (1, 2, 3):
        s.note_user("devam et", False)
        assert s.short_repeat_streak == expected
    s.note_user("başka", False)
    assert s.short_repeat_streak == 1
    s.note_user("Bu fonksiyonu daha okunur hale getirir misin lütfen", False)
    assert s.short_repeat_streak == 0
