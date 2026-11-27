"""Sohbet sinyallerinin Python ikizi (eklentide src/core/signals.ts, karar K32).

Dört kural: yapay zeka cevabında özür döngüsü, kullanıcının döngüden çıkışı (teşekkür, "oldu"),
kısa ve açıklamasız düzeltme isteği ("daha iyi yap") ve konu kayması. Kurallar
extension/src/data/signal-rules.json dosyasında; iki tarafın aynı kararı verdiğini parite testi
(tests/test_signals.py ve extension/src/core/signals.test.ts) kontrol eder.
"""

import json
from pathlib import Path

from kafiai.config import EXT_MIN_NORMALIZED_CHARS
from kafiai.extension_similarity import cosine, fold_turkish, has_variation_cue, is_bare_continue, ngram_vector, normalize_text, with_folded
from kafiai.tasks import task_type

RULES = json.loads(
    (Path(__file__).resolve().parents[2] / "extension" / "src" / "data" / "signal-rules.json").read_text(encoding="utf-8")
)
# Çıkış ve belirsiz istek listeleri Türkçe karaktersiz yazımı da kapsar ("tesekkurler", "kisalt").
_EXIT_WORDS = set(with_folded([w for w in RULES["exit"]["words"] if w not in RULES["exit"]["fold_exclude"]])) | set(RULES["exit"]["fold_exclude"])
_EXIT_PHRASES = with_folded(RULES["exit"]["phrases"])
_VAGUE_CORE = set(with_folded(RULES["vague"]["core"]))
_VAGUE_ALLOWED = set(with_folded(RULES["vague"]["allowed"])) | _VAGUE_CORE


def _forms(text):
    raw = text or ""
    tr = normalize_text(raw)
    en = normalize_text(raw.replace("I", "i"))
    return list(dict.fromkeys([tr, en, fold_turkish(tr)]))


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
        if any(f" {p} " in f" {n} " for p in _EXIT_PHRASES):
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


_DECLINE = set(with_folded(RULES["short"]["decline_words"]))


def ends_with_question(answer):
    """Cevap bir soruyla mı bitiyor? Cevabın son tail_chars karakterine bakılır (signals.ts ile aynı)."""
    if not answer:
        return False
    tail = answer[-RULES["short"]["tail_chars"]:].rstrip()
    i = len(tail)
    while i > 0 and not (tail[i - 1] == "?" or tail[i - 1].isalnum()):
        i -= 1
    return i > 0 and tail[i - 1] == "?"


def is_offer_decline(text, answer_asked_question):
    """Soruyla biten bir cevaba verilen yalın "hayır": teklifi geri çevirmek, şikayet değil."""
    if not answer_asked_question:
        return False
    tokens = fold_turkish(normalize_text(text)).split()
    return 0 < len(tokens) <= RULES["short"]["decline_max_words"] and tokens[0] in _DECLINE


_AFFIRM = RULES["affirm"]
_AFFIRM_WORDS = set(with_folded(_AFFIRM["words"]))
_AFFIRM_ALLOWED = set(with_folded(_AFFIRM["allowed"] + _AFFIRM["words"]))


def is_affirmation(text):
    """Kısa onay ya da ret ("evet", "aynen", "hayır gerek yok"); "devam" sayılmaz (signals.ts ile aynı)."""
    if is_exit_message(text):
        return False
    tokens = fold_turkish(normalize_text(text)).split()
    return (0 < len(tokens) <= _AFFIRM["max_words"] and all(t in _AFFIRM_ALLOWED for t in tokens)
            and any(t in _AFFIRM_WORDS for t in tokens))


def short_repeat_key(text):
    """Kısa tekrar serisinin anahtarı: yönsüz devam istekleri tek seri ("niyet:devam"); signals.ts ile aynı."""
    if is_bare_continue(text):
        return "niyet:devam"
    return normalize_text(text) if is_short(text) else None


_REPAIR_MAX_CHARS = RULES["short"]["repair_max_chars"]


def is_short_repair(text):
    """Kısa ve güçlü onarım ifadesi taşıyan mesaj ("olmadı", "yanlış", "olmadi tekrar yap").
    Sınır genel kısa mesaj sınırından (12) geniştir: orta uzunluktaki onarımlar da aynı isabetle şerit alır."""
    n = normalize_text(text)
    return 0 < len(n) < _REPAIR_MAX_CHARS and _strong_repair(text) and not is_exit_message(text)


def is_new_topic(text, recent, segment_task):
    normalized = normalize_text(text)
    if len(normalized) < RULES["topic"]["min_chars"] or _strong_repair(text):
        return False
    # Varyasyon isteği ("farklı tonda 5 tane daha") aynı işin devamıdır, yeni konu değildir.
    if has_variation_cue(text):
        return False
    task = task_type(text)
    if task == "diger" or task == segment_task:
        return False
    vec = ngram_vector(normalized)
    return all(cosine(vec, ngram_vector(r)) < RULES["topic"]["max_similarity"] for r in recent)


_RESTATE = RULES["restate"]
_RESTATE_PHRASES = with_folded(_RESTATE["phrases"])


def restates_rule(text):
    """Kullanıcı daha önce koyduğu bir kuralı yeniden mi hatırlatıyor (signals.ts restatesRule ile aynı)?"""
    for n in _forms(text):
        if len(n) <= _RESTATE["whole_chars"]:
            parts = [n]
        else:
            parts = [n[:_RESTATE["edge_chars"]], n[-_RESTATE["edge_chars"]:]]
        if any(f" {p} " in f" {part.strip()} " for part in parts for p in _RESTATE_PHRASES):
            return True
    return False


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
        self.answer_asked_question = False
        self.affirm_streak = 0
        self.last_short_key = None
        self.last_user_repair = False
        self.prev_answer_vec = None
        self.answer_ignored_repair = False
        self.clean_run = 0
        self.recovered = False
        self.restated_turns = []

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
            self.restated_turns = []
        # Kuralın yeniden hatırlatılması: yalnızca sıra numarası tutulur (signals.ts ile aynı).
        if index > 0 and restates_rule(text):
            self.restated_turns.append(index)
        normalized = normalize_text(text)
        self.last_short_repair = index > 0 and is_short_repair(text) and not is_offer_decline(text, self.answer_asked_question)
        self.affirm_streak = self.affirm_streak + 1 if self.answer_asked_question and is_affirmation(text) else 0
        self.last_user_repair = _strong_repair(text) and not is_offer_decline(text, self.answer_asked_question)
        clean = not similar and not self.last_user_repair and not self.last_short_repair and not is_vague(text)
        self.clean_run = self.clean_run + 1 if clean else 0
        self.recovered = False
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
            key = short_repeat_key(text)
            if key is not None and not self.last_short_repair:
                self.short_repeat_streak = self.short_repeat_streak + 1 if key == self.last_short_key else 1
            else:
                self.short_repeat_streak = 0
        self.last_short_key = None if self.exited else short_repeat_key(text)
        self.recent_texts.append(normalized)
        if len(self.recent_texts) > 5:
            self.recent_texts.pop(0)

    def note_answer(self, answer):
        self.apology_streak = self.apology_streak + 1 if apologizes(answer) else 0
        self.answer_asked_question = ends_with_question(answer)
        # Düzeltme alınmadı: kullanıcı onarım istedi ama cevabın başı öncekinin neredeyse aynısı (signals.ts ile aynı).
        rule = RULES["answer_repeat"]
        head = normalize_text(" ".join((answer or "").split())[:rule["head_chars"]])
        vec = ngram_vector(head) if head else None
        repeated = vec is not None and self.prev_answer_vec is not None and cosine(vec, self.prev_answer_vec) >= rule["similarity"]
        self.answer_ignored_repair = repeated and self.last_user_repair and not self.exited
        self.prev_answer_vec = vec
        # Davranışsal çıkış: döngü sinyali varken iki temiz tur (signals.ts ile aynı).
        if self.apology_streak > 0 or self.answer_ignored_repair:
            self.clean_run = 0
        looping = self.recent_similar > 0 or self.apology_streak > 0 or self.vague_streak >= 2
        if looping and self.clean_run >= RULES["recovery"]["clean_turns"]:
            self.recent_flags = []
            self.apology_streak = 0
            self.vague_streak = 0
            self.clean_run = 0
            self.recovered = True

    def mark_last_similar(self):
        """Anlam desteği son mesajı karşılanmamış isteğin yeniden yazımı saydı (K51 taslağı); eklentide markLastSimilar."""
        if self.recent_flags:
            self.recent_flags[-1] = True

    @property
    def recent_similar(self):
        return sum(self.recent_flags)

    @property
    def looping(self):
        """Şu an bir döngü sinyali sürüyor mu (sohbet sonu ölçümü için)?"""
        return self.recent_similar > 0 or self.apology_streak > 0 or self.vague_streak >= 2 or self.answer_ignored_repair
