"""Sohbetin ilk k turundan öznitelik çıkarımı.

Model yalnızca kullanıcının ilk k mesajını görür. Böylece eklenti, sohbet daha
döngüye girmeden uyarı verebilir. Sohbetin geri kalanı sadece etiket için kullanılır
(bkz. labels.py), modele asla girdi olarak verilmez.

Her öznitelik kullanıcıya açıklanabilecek kadar basittir. Örneğin "ikinci mesaj
birinciye %90 benziyor" cümlesi doğrudan bir uyarı gerekçesine dönüşebilir.
"""

import pandas as pd

from kafiai.config import K_TURNS, REPEAT_SIM_THRESHOLD
from kafiai.text import consecutive_similarities, has_repair, request_type, safe_mean

FEATURE_COLUMNS = [
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


def conversation_features(user_messages, k=K_TURNS):
    """Tek bir sohbetin kullanıcı mesajlarından öznitelik sözlüğü üretir."""
    msgs = list(user_messages[:k])
    sims = consecutive_similarities(msgs)
    first = msgs[0] if msgs else ""
    last = msgs[-1] if msgs else ""
    first_type = request_type(first)

    return {
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
    }


def build_feature_table(df, k=K_TURNS):
    """DataFrame'in her satırı (sohbet) için öznitelikleri hesaplar."""
    rows = [conversation_features(msgs, k) for msgs in df["user_msgs"]]
    return pd.DataFrame(rows, index=df.index)[FEATURE_COLUMNS]
