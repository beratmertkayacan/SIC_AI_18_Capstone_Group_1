"""Metinle ilgili küçük yardımcılar.

Buradaki her fonksiyon tek bir mesajı ya da iki mesajı alır ve bir sayı veya etiket döner.
Model eğitimi sırasında da, ileride tarayıcı eklentisinde de aynı mantık kullanılacağı için
fonksiyonlar bilerek basit tutuldu: büyük bir dil modeli ya da internet bağlantısı gerektirmez.
"""

import re

import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer

from kafiai.config import MAX_CHARS

# Karakter n-gram tabanlı vektörleştirici. Eğitim gerektirmez (fit yok), bu yüzden
# aynı sonuç tarayıcıda JavaScript ile de üretilebilir.
_VECTORIZER = HashingVectorizer(
    analyzer="char_wb", ngram_range=(3, 5), n_features=2**18, alternate_sign=False, norm="l2"
)


def clean(text):
    """Küçük harfe çevirir, fazla boşlukları siler, çok uzun metni keser."""
    text = (text or "").lower()
    text = re.sub(r"\s+", " ", text).strip()
    return text[:MAX_CHARS]


def similarity(a, b):
    """İki mesaj arasındaki karakter benzerliği, 0 ile 1 arası.

    1'e yakın değer kullanıcının neredeyse aynı şeyi tekrar yazdığını gösterir.
    """
    a, b = clean(a), clean(b)
    if not a or not b:
        return 0.0
    vecs = _VECTORIZER.transform([a, b])
    return float(vecs[0].multiply(vecs[1]).sum())


def consecutive_similarities(messages):
    """Art arda gelen her mesaj çifti için benzerlik listesi döner."""
    return [similarity(a, b) for a, b in zip(messages, messages[1:])]


# Kullanıcının bir önceki cevaptan memnun olmadığını gösteren ifadeler (İngilizce ve Türkçe).
REPAIR_PATTERNS = [
    r"\bnot what i (asked|wanted|meant)\b", r"\bthat'?s (not|wrong)\b", r"\b(still|is) (wrong|not working)\b",
    r"\btry again\b", r"\bdoesn'?t work\b", r"\bdidn'?t work\b", r"\byou didn'?t\b", r"\bi (said|asked)\b",
    r"\bwrong\b", r"\bincorrect\b",
    r"yanlış", r"olmadı", r"\btekrar\b", r"\bhala\b", r"hâlâ", r"çalışmıyor", r"anlamadın", r"öyle değil",
    r"ben ne dedim",
]
_REPAIR_RX = re.compile("|".join(REPAIR_PATTERNS), re.IGNORECASE)


def has_repair(text):
    """Mesajda memnuniyetsizlik veya düzeltme talebi var mı? (ilk sürüm listesi)"""
    return bool(_REPAIR_RX.search(text or ""))


# İkinci sürüm: WildFeedback'teki memnuniyetsizlik (DSAT) işaretleriyle seçildi (docs/08, Bölüm 5).
# Her ifade, geçtiği sohbetlerde memnuniyetsizlik oranını genel orana göre en az 2 kat artırıyor.
# "try again", "please" gibi yeniden üretme istekleri bilerek yok: bunlar memnuniyetsizliği ancak
# 1,3 kat artırıyor, yani çoğu zaman normal bir iş akışının parçası.
STRONG_REPAIR_PATTERNS = [
    r"\berror\b", r"not work", r"doesn'?t work", r"isn'?t working", r"\bwrong\b", r"\bincorrect\b",
    r"^\s*no\b", r"^\s*but\b", r"\bsame (error|problem|issue|result|thing)\b",
    r"\byou (didn'?t|did not|forgot|missed|ignored)\b", r"\bi (said|asked|told)\b", r"not what i",
    r"\bstill\b", r"\bagain\b", r"!!",
    r"olmadı", r"\bhala\b", r"hâlâ", r"\byine\b", r"\bhata\b", r"çalışmıyor", r"yanlış", r"anlamadın",
    r"ben ne dedim", r"öyle değil", r"^\s*hayır\b", r"aynı hata",
]
_STRONG_REPAIR_RX = re.compile("|".join(STRONG_REPAIR_PATTERNS), re.IGNORECASE)


def has_strong_repair(text):
    """Mesajda bir önceki cevabın işe yaramadığını gösteren güçlü bir ifade var mı?"""
    return bool(_STRONG_REPAIR_RX.search(text or ""))


# Talep türü: kullanıcı işi doğrudan yaptırmak mı, yoksa anlamak mı istiyor?
_PRODUCE_RX = re.compile(
    r"\b(write|generate|create|make|rewrite|paraphrase|translate|summari[sz]e|draft|compose|solve|"
    r"fix|code|implement|complete|continue|list|give me|answer|correct|improve|"
    r"yaz|çöz|oluştur|hazırla|çevir|özetle|düzelt|tamamla|devam et|listele|cevapla)\b",
    re.IGNORECASE,
)
_UNDERSTAND_RX = re.compile(
    r"\b(explain|why|how does|how do|how can|how to|what is|what are|what does|difference between|"
    r"help me understand|teach|meaning of|açıkla|neden|niçin|nasıl|nedir|ne demek|farkı|anlat)\b",
    re.IGNORECASE,
)


def request_type(text):
    """Mesajı üç gruptan birine koyar: 'uretim', 'anlama' veya 'diger'."""
    head = (text or "")[:200]
    if _PRODUCE_RX.search(head):
        return "uretim"
    if _UNDERSTAND_RX.search(head) or head.strip().endswith("?"):
        return "anlama"
    return "diger"


def safe_mean(values):
    """Boş listede hata vermeyen ortalama."""
    return float(np.mean(values)) if len(values) else 0.0
