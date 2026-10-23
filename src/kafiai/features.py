"""Sohbetin ilk k turundan öznitelik çıkarımı.

Model yalnızca kullanıcının ilk k mesajını görür. Böylece eklenti, sohbet daha
döngüye girmeden uyarı verebilir. Sohbetin geri kalanı sadece etiket için kullanılır
(bkz. labels.py), modele asla girdi olarak verilmez.

Her öznitelik kullanıcıya açıklanabilecek kadar basittir. Örneğin "ikinci mesaj
birinciye %90 benziyor" cümlesi doğrudan bir uyarı gerekçesine dönüşebilir.
"""

import math

import pandas as pd

from kafiai.config import K_TURNS, REPEAT_SIM_THRESHOLD
from kafiai.extension_similarity import similarity as extension_similarity
from kafiai.tasks import TASK_TYPES, task_type
from kafiai.text import consecutive_similarities, has_repair, has_strong_repair, request_type, safe_mean

# İlk sürümün 11 özniteliği (outputs/baseline_metrics.json bu listeyle üretildi).
BASE_FEATURES = [
    "sim_mean",           # ilk k mesaj arasındaki ortalama benzerlik
    "sim_max",            # en yüksek benzerlik
    "n_repeats",          # eşiği geçen (neredeyse aynı) mesaj çifti sayısı
    "n_repairs",          # 2. mesajdan itibaren onarım ifadesi sayısı
    "first_chars",        # ilk mesajın uzunluğu
    "last_chars",         # k. mesajın uzunluğu
    "len_ratio",          # son mesaj / ilk mesaj uzunluğu
    "short_followup",     # k. mesaj 30 karakterden kısa mı (ör. "tekrar yaz")
    "first_is_produce",   # ilk talep doğrudan üretim mi
    "first_is_understand",# ilk talep anlamaya yönelik mi
    "has_code",           # ilk k mesajda kod parçası var mı
]

# Veri hazırlama ve model keşfi aşamasında eklenenler (docs/08, Bölüm 5).
EXTRA_FEATURES = [
    "ext_sim",            # eklentinin kullandığı benzerlik (3-gram, 1024 boyut), 1. ve 2. mesaj
    "first_words_log",    # ilk mesajdaki kelime sayısı, log ölçeğinde
    "first_lines",        # ilk mesajdaki satır sayısı (yapıştırılmış metin ya da kod işareti)
    "first_question",     # ilk mesaj soru işaretiyle bitiyor mu
    "second_question",    # ikinci mesaj soru işaretiyle bitiyor mu
    "second_words_log",   # ikinci mesajdaki kelime sayısı, log ölçeğinde
    "digit_ratio",        # ilk iki mesajdaki rakam oranı (sayısal görevler)
    "second_strong_repair",  # ikinci mesajda güçlü onarım ifadesi var mı ("still wrong", "olmadı")
] + [f"task_{t}" for t in TASK_TYPES]  # ilk mesajın görev türü (eklentideki kurallarla aynı)

FEATURE_COLUMNS = BASE_FEATURES + EXTRA_FEATURES


def conversation_features(user_messages, k=K_TURNS):
    """Tek bir sohbetin kullanıcı mesajlarından öznitelik sözlüğü üretir."""
    msgs = list(user_messages[:k])
    sims = consecutive_similarities(msgs)
    first = msgs[0] if msgs else ""
    last = msgs[-1] if msgs else ""
    first_type = request_type(first)

    second = msgs[1] if len(msgs) > 1 else ""
    joined = first + second
    task = task_type(first)

    row = {
        "sim_mean": safe_mean(sims),
        "sim_max": max(sims) if sims else 0.0,
        "n_repeats": sum(s >= REPEAT_SIM_THRESHOLD for s in sims),
        "n_repairs": sum(has_repair(m) for m in msgs[1:]),
        "first_chars": len(first),
        "last_chars": len(last),
        "len_ratio": len(last) / max(len(first), 1),
        "short_followup": int(len(msgs) > 1 and len(last.strip()) < 30),
        "first_is_produce": int(first_type == "uretim"),
        "first_is_understand": int(first_type == "anlama"),
        "has_code": int(any("```" in m or "def " in m or "{" in m for m in msgs)),
        "ext_sim": extension_similarity(first, second) if second else 0.0,
        "first_words_log": math.log1p(len(first.split())),
        "first_lines": first.count("\n") + 1,
        "first_question": int(first.rstrip().endswith("?")),
        "second_question": int(second.rstrip().endswith("?")),
        "second_words_log": math.log1p(len(second.split())),
        "digit_ratio": sum(c.isdigit() for c in joined) / max(len(joined), 1),
        "second_strong_repair": int(has_strong_repair(second)),
    }
    for t in TASK_TYPES:
        row[f"task_{t}"] = int(task == t)
    return row


def text_of_first_turns(user_messages, k=K_TURNS):
    """Metin tabanlı model için ilk k mesajı tek metinde birleştirir."""
    return " \n ".join(str(m) for m in list(user_messages[:k]))


def build_feature_table(df, k=K_TURNS):
    """DataFrame'in her satırı (sohbet) için öznitelikleri hesaplar."""
    rows = [conversation_features(msgs, k) for msgs in df["user_msgs"]]
    return pd.DataFrame(rows, index=df.index)[FEATURE_COLUMNS]
