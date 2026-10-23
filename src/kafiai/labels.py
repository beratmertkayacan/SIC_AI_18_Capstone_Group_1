"""Kural tabanlı zayıf etiket.

Veri setlerinde "bu sohbet verimsiz bir döngüye girdi" diyen hazır bir etiket yok.
İlk adımda etiketi açık ve denetlenebilir kurallarla üretiyoruz. Sonraki adımda
bir dil modeli aynı soruyu bir değerlendirme ölçütüyle cevaplayacak ve ekip
küçük bir örneklemi elle doğrulayacak (bkz. docs/04_concept_note.md, Metodoloji).

Kural: modelin görmediği kısımda, yani k. turdan sonra,
    en az LABEL_MIN_REPEATS kez neredeyse aynı mesaj tekrarlanmışsa
    ya da en az LABEL_MIN_REPAIRS kez onarım ifadesi kullanılmışsa
sohbet "döngü" (1) olarak etiketlenir, aksi halde 0.

İkinci sürüm (loop_label): WildFeedback'teki memnuniyetsizlik işaretleriyle karşılaştırınca ilk
kuralın benzerlik kısmının gerçek memnuniyetsizliği yakalamadığı görüldü. Yeni kural güçlü onarım
ifadelerine dayanır; birebir yeniden gönderim yalnızca bir onarım ifadesiyle birlikte sayılır.
Ayrıntı ve sayılar: docs/08_data_preparation_and_model.md, Bölüm 5.
"""

from kafiai.config import (EXACT_REPEAT_THRESHOLD, K_TURNS, LABEL_MIN_REPAIRS, LABEL_MIN_REPEATS,
                           LABEL_V2_MIN_REPAIRS, REPEAT_SIM_THRESHOLD)
from kafiai.text import consecutive_similarities, has_repair, has_strong_repair


def future_signals(user_messages, k=K_TURNS):
    """k. turdan sonraki tekrar ve onarım sayılarını döner.

    k-1. indeksten başlamamızın nedeni: k. mesaj ile k+1. mesaj arasındaki geçiş
    de "sonrası" sayılır, çünkü model k+1. mesajı henüz görmemiştir.
    """
    later = list(user_messages[k - 1:])
    sims = consecutive_similarities(later)
    repeats = sum(s >= REPEAT_SIM_THRESHOLD for s in sims)
    repairs = sum(has_repair(m) for m in user_messages[k:])
    return repeats, repairs


def weak_label(user_messages, k=K_TURNS):
    """Tek bir sohbet için 0 veya 1 döner."""
    repeats, repairs = future_signals(user_messages, k)
    return int(repeats >= LABEL_MIN_REPEATS or repairs >= LABEL_MIN_REPAIRS)


def future_signals_v2(user_messages, k=K_TURNS):
    """İkinci sürüm için k. turdan sonraki birebir yeniden gönderim ve güçlü onarım sayıları."""
    later = list(user_messages[k - 1:])
    sims = consecutive_similarities(later)
    exact = sum(s >= EXACT_REPEAT_THRESHOLD for s in sims)
    repairs = sum(has_strong_repair(m) for m in user_messages[k:])
    return exact, repairs


def loop_label(user_messages, k=K_TURNS):
    """Etiketin ikinci sürümü; modeller bununla eğitilir. 0 veya 1 döner."""
    exact, repairs = future_signals_v2(user_messages, k)
    return int(repairs >= LABEL_V2_MIN_REPAIRS or (repairs >= 1 and exact >= 1))
