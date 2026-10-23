"""Sohbetin ilk mesajından görev türünü tahmin eder.

Çıkış kartındaki "bu tür işler genelde kaç turda biter" cümlesi görev türüne göre
hesaplanıyor. Kurallar `extension/src/data/task-rules.json` dosyasında duruyor ve
eklenti de aynı dosyayı okuyor; böylece Python'da hesaplanan normlar, eklentide aynı
türe uygulanıyor.

Kurallar dört çeşit:
    markers    ham metinde (küçük harfle) geçen işaretler, örneğin ``` ya da "def "
    words      sadeleştirilmiş metindeki tam kelimeler
    prefixes   bu harflerle başlayan kelimeler ("özet" -> özetle, özetler)
    phrases    sadeleştirilmiş metinde geçen kelime grupları
Bir mesaj birden çok türe uyuyorsa listedeki ilk tür seçilir.
"""

import json
from pathlib import Path

from kafiai.extension_similarity import normalize_text

RULES_FILE = Path(__file__).resolve().parents[2] / "extension" / "src" / "data" / "task-rules.json"
_RULES = json.loads(RULES_FILE.read_text(encoding="utf-8"))

TASK_TYPES = _RULES["order"] + [_RULES["fallback"]]
TASK_LABELS = _RULES["labels"]


def _matches(rule, raw_lower, normalized, words):
    if any(marker in raw_lower for marker in rule.get("markers", [])):
        return True
    if any(word in words for word in rule.get("words", [])):
        return True
    if any(w.startswith(prefix) for w in words for prefix in rule.get("prefixes", [])):
        return True
    padded = f" {normalized} "
    if any(f" {phrase} " in padded for phrase in rule.get("phrases", [])):
        return True
    return bool(rule.get("ends_with_question")) and raw_lower.rstrip().endswith("?")


def task_type(first_message):
    """İlk mesajın baş kısmına bakarak görev türünü döner."""
    head = (first_message or "")[:_RULES["head_chars"]]
    raw_lower = head.lower()
    normalized = normalize_text(head)
    words = set(normalized.split())
    for name in _RULES["order"]:
        if _matches(_RULES["rules"][name], raw_lower, normalized, words):
            return name
    return _RULES["fallback"]
