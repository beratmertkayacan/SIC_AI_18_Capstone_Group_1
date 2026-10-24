"""Her yeni mesajda yeniden hesaplanan öznitelikler (tur modeli).

Task 3'teki model yalnızca ilk iki mesajı görüyordu ve sohbet başına bir kez karar veriyordu.
Eklentide ise kullanıcı her mesaj gönderdiğinde elimizde daha fazla bilgi var: kaç kez
"olmadı" dedi, son mesajı bir öncekinin tekrarı mı, sohbet kaçıncı turda. Bu dosya, sohbetin
ilk k mesajına bakarak (k = 2, 3, 4, ...) aynı öznitelik listesini üretir. Etiket yine
yalnızca k. mesajdan sonrasından gelir, yani model geleceği görmez.

Bütün öznitelikler eklentide birebir aynı şekilde hesaplanabilecek biçimde seçildi:
    benzerlik     eklentinin benzerlik hesabı (extension_similarity, 3-gram, 1024 boyut)
    onarım        eklentiyle ortak kural dosyası (extension/src/data/repair-rules.json)
    görev türü    eklentiyle ortak kural dosyası (extension/src/data/task-rules.json)
Hiçbiri sklearn ya da büyük bir sözlük gerektirmiyor. TypeScript karşılığı:
extension/src/core/turn-features.ts; iki tarafın aynı sayıları verdiği parite testiyle kontrol edilir.
"""

import math

from kafiai.config import EXACT_REPEAT_THRESHOLD, EXT_SIMILARITY_THRESHOLD
from kafiai.extension_similarity import similarity
from kafiai.tasks import TASK_TYPES, task_type
from kafiai.text import has_strong_repair

TURN_FEATURES = [
    "turn",               # modelin gördüğü mesaj sayısı (k)
    "first_words_log",    # ilk mesajdaki kelime sayısı, log ölçeğinde
    "last_words_log",     # son mesajdaki kelime sayısı, log ölçeğinde
    "first_lines",        # ilk mesajdaki satır sayısı (en fazla 50)
    "last_lines",         # son mesajdaki satır sayısı (en fazla 50)
    "first_question",     # ilk mesaj soru işaretiyle bitiyor mu
    "last_question",      # son mesaj soru işaretiyle bitiyor mu
    "last_short",         # son mesaj 30 karakterden kısa mı ("olmadı", "devam")
    "digit_ratio",        # ilk ve son mesajdaki rakam oranı
    "has_code",           # görülen mesajlarda kod işareti var mı
    "last_sim",           # son mesajın bir öncekine benzerliği
    "max_sim",            # görülen ardışık mesaj çiftlerindeki en yüksek benzerlik
    "n_similar",          # benzerliği eklenti eşiğini (0,8) geçen çift sayısı
    "n_exact",            # birebir yeniden gönderim sayısı (0,97 üstü)
    "last_strong_repair",  # son mesajda güçlü onarım ifadesi var mı
    "n_strong_repairs",   # 2. mesajdan bu yana güçlü onarım ifadesi sayısı
] + [f"task_{t}" for t in TASK_TYPES]

MAX_LINES = 50  # yapıştırılmış uzun metinlerin satır sayısı tek başına baskın olmasın


def _words_log(text):
    return math.log1p(len(text.split()))


def _lines(text):
    return min(text.count("\n") + 1, MAX_LINES)


def _has_code(text):
    return "```" in text or "def " in text or "{" in text


def turn_features(user_messages, k):
    """Sohbetin ilk k kullanıcı mesajından öznitelik sözlüğü üretir (k en az 2)."""
    msgs = [str(m or "") for m in list(user_messages)[:k]]
    first, last = msgs[0], msgs[-1]
    sims = [similarity(a, b) for a, b in zip(msgs, msgs[1:])]
    joined = first + last
    task = task_type(first)

    row = {
        "turn": len(msgs),
        "first_words_log": _words_log(first),
        "last_words_log": _words_log(last),
        "first_lines": _lines(first),
        "last_lines": _lines(last),
        "first_question": int(first.rstrip().endswith("?")),
        "last_question": int(last.rstrip().endswith("?")),
        "last_short": int(len(last.strip()) < 30),
        # isdecimal: yalnızca 0-9 gibi ondalık rakamlar ("²" sayılmaz); JavaScript'teki \p{Nd} ile aynı
        "digit_ratio": sum(c.isdecimal() for c in joined) / max(len(joined), 1),
        "has_code": int(any(_has_code(m) for m in msgs)),
        "last_sim": sims[-1] if sims else 0.0,
        "max_sim": max(sims) if sims else 0.0,
        "n_similar": sum(s >= EXT_SIMILARITY_THRESHOLD for s in sims),
        "n_exact": sum(s >= EXACT_REPEAT_THRESHOLD for s in sims),
        "last_strong_repair": int(len(msgs) > 1 and has_strong_repair(last)),
        "n_strong_repairs": sum(has_strong_repair(m) for m in msgs[1:]),
    }
    for t in TASK_TYPES:
        row[f"task_{t}"] = int(task == t)
    return row
