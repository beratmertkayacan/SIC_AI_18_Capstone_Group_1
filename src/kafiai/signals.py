"""Sohbet sinyallerinin Python ikizi (eklentide src/core/signals.ts, karar K32).

Dört kural: yapay zeka cevabında özür döngüsü, kullanıcının döngüden çıkışı (teşekkür, "oldu"),
kısa ve açıklamasız düzeltme isteği ("daha iyi yap") ve konu kayması. Kurallar
extension/src/data/signal-rules.json dosyasında; iki tarafın aynı kararı verdiğini parite testi
(tests/test_signals.py ve extension/src/core/signals.test.ts) kontrol eder.
"""

import json
from pathlib import Path

from kafiai.config import EXT_MIN_NORMALIZED_CHARS
from kafiai.extension_similarity import cosine, ngram_vector, normalize_text
from kafiai.tasks import task_type

RULES = json.loads(
    (Path(__file__).resolve().parents[2] / "extension" / "src" / "data" / "signal-rules.json").read_text(encoding="utf-8")
)
_EXIT_WORDS = set(RULES["exit"]["words"])
_VAGUE_CORE = set(RULES["vague"]["core"])
_VAGUE_ALLOWED = set(RULES["vague"]["allowed"]) | _VAGUE_CORE


def _forms(text):
    raw = text or ""
    tr = normalize_text(raw)
    en = normalize_text(raw.replace("I", "i"))
    return [tr] if tr == en else [tr, en]


def _strong_repair(text):
    from kafiai.text import has_strong_repair
    return has_strong_repair(text)


def apologizes(answer):
    if not answer:
        return False
    head = answer[:RULES["apology"]["head_chars"]]
    return any(f" {p} " in f" {n} " for n in _forms(head) for p in RULES["apology"]["phrases"])


def is_exit_message(text):
    if _strong_repair(text):
        return False
    for n in _forms(text):
        tokens = n.split()
        if not tokens or len(tokens) > RULES["exit"]["max_words"]:
            continue
        if any(t in _EXIT_WORDS for t in tokens):
            return True
        if any(f" {p} " in f" {n} " for p in RULES["exit"]["phrases"]):
            return True
    return False


def is_vague(text):
    for n in _forms(text):
        tokens = n.split()
        if not tokens or len(tokens) > RULES["vague"]["max_words"]:
            continue
        if all(t in _VAGUE_ALLOWED for t in tokens) and any(t in _VAGUE_CORE for t in tokens):
            return True
    return False


def is_short(text):
    n = normalize_text(text)
    return 0 < len(n) < EXT_MIN_NORMALIZED_CHARS


def is_short_repair(text):
    """Kısa ve güçlü onarım ifadesi taşıyan mesaj ("olmadı", "yanlış", "hala hata")."""
    return is_short(text) and _strong_repair(text) and not is_exit_message(text)


def is_new_topic(text, recent, segment_task):
    normalized = normalize_text(text)
    if len(normalized) < RULES["topic"]["min_chars"] or _strong_repair(text):
        return False
    task = task_type(text)
    if task == "diger" or task == segment_task:
        return False
    vec = ngram_vector(normalized)
    return all(cosine(vec, ngram_vector(r)) < RULES["topic"]["max_similarity"] for r in recent)


class ConversationSignals:
    """ConversationSignals (signals.ts) ile aynı durum makinesi."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.recent_flags = []
        self.recent_texts = []
        self.apology_streak = 0
        self.vague_streak = 0
        self.segments = 1
        self.segment_start = 0
        self.segment_task = None
        self.turns = 0
        self.exited = False
        self.short_repeat_streak = 0
        self.last_short_repair = False

    def note_user(self, text, similar):
        index = self.turns
        self.turns += 1
        self.exited = False
        if self.segment_task is None:
            self.segment_task = task_type(text)
        elif is_new_topic(text, self.recent_texts, self.segment_task):
            self.segments += 1
            self.segment_start = index
            self.segment_task = task_type(text)
            self.recent_flags = []
            self.apology_streak = 0
            self.vague_streak = 0
            self.short_repeat_streak = 0
        normalized = normalize_text(text)
        previous = self.recent_texts[-1] if self.recent_texts else None
        self.last_short_repair = index > 0 and is_short_repair(text)
        if is_exit_message(text):
            self.exited = True
            self.recent_flags = []
            self.apology_streak = 0
            self.vague_streak = 0
            self.short_repeat_streak = 0
        else:
            self.recent_flags.append(bool(similar) or self.last_short_repair)
            if len(self.recent_flags) > RULES["recent_window"]:
                self.recent_flags.pop(0)
            self.vague_streak = self.vague_streak + 1 if is_vague(text) else 0
            if is_short(text) and not self.last_short_repair:
                self.short_repeat_streak = self.short_repeat_streak + 1 if normalized == previous else 1
            else:
                self.short_repeat_streak = 0
        self.recent_texts.append(normalized)
        if len(self.recent_texts) > 5:
            self.recent_texts.pop(0)

    def note_answer(self, answer):
        self.apology_streak = self.apology_streak + 1 if apologizes(answer) else 0

    @property
    def recent_similar(self):
        return sum(self.recent_flags)
