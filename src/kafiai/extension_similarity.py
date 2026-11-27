"""Eklentinin benzerlik hesabının Python ikizi.

Chrome eklentisi (`extension/src/core/text.ts` ve `similarity.ts`) iki mesajın benzerliğini
şöyle hesaplıyor:

    1. Metni sadeleştir: Türkçeye uygun küçük harf, noktalamayı at, boşlukları teke indir.
    2. Başına ve sonuna birer boşluk ekleyip 3 karakterlik parçalara (3-gram) böl.
    3. Her parçayı FNV-1a ile 1024 kutudan birine at ve kutuları say.
    4. İki sayım vektörünün kosinüs benzerliğini al.

Bu dosya aynı hesabı Python'da birebir yapar. Böylece eklentinin eşiklerini gerçek
WildChat sohbetleri üzerinde deneyebiliyoruz: Python'da 0,62 çıkan bir benzerlik,
tarayıcıda da 0,62 çıkar. İki tarafın aynı sonucu verdiğini
`tests/fixtures/similarity_parity.json` dosyası üzerinden hem Python hem JavaScript
testleri kontrol eder.
"""

import json
import math
import re
import unicodedata
from pathlib import Path

from kafiai.config import EXT_HASH_DIM, EXT_MIN_NORMALIZED_CHARS, EXT_NGRAM_SIZE

_SPACES = re.compile(r"\s+")


def normalize_text(text):
    """`text.ts` içindeki normalizeText fonksiyonunun aynısı."""
    text = unicodedata.normalize("NFC", text or "")
    text = text.replace("İ", "i").replace("I", "ı").lower()
    # Harf ve rakam dışındaki her karakter (noktalama, emoji) boşluğa çevrilir.
    kept = []
    for ch in text:
        category = unicodedata.category(ch)
        if category[0] in ("L", "N") or ch.isspace():
            kept.append(ch)
        else:
            kept.append(" ")
    return _SPACES.sub(" ", "".join(kept)).strip()


_FOLD = str.maketrans("çğıöşüâîû", "cgiosuaiu")


def fold_turkish(normalized):
    """Türkçe karakterleri düz harfe indirir ("yanlış" -> "yanlis"); `text.ts` foldTurkish ile aynı.

    Birçok kullanıcı Türkçe klavye olmadan yazıyor. Kural listeleri bu yazımı da tanısın diye
    eşleştirmede ikinci biçim olarak kullanılır.
    """
    return normalized.translate(_FOLD)


_TURKISH_LETTERS = set("çğıöşüâîû")


def has_turkish_letter(normalized):
    """Sadeleştirilmiş kelimede Türkçe harf var mı? `text.ts` hasTurkishLetter ile aynı.

    Hiç Türkçe harf yoksa kelime Türkçe klavye olmadan yazılmış olabilir ("baskenti").
    """
    return bool(set(normalized) & _TURKISH_LETTERS)


def with_folded(items):
    """Kural listesine her ifadenin Türkçe karaktersiz hâlini de ekler (sıra korunur, tekrar yok)."""
    return list(dict.fromkeys(list(items) + [fold_turkish(i) for i in items]))


def _fnv1a(chunk):
    """32 bitlik FNV-1a; JavaScript'teki Math.imul ile aynı sonucu verir."""
    value = 0x811C9DC5
    for ch in chunk:
        value ^= ord(ch)
        value = (value * 0x01000193) & 0xFFFFFFFF
    return value


def ngram_vector(normalized, n=EXT_NGRAM_SIZE, dim=EXT_HASH_DIM):
    """Sadeleştirilmiş metni {kutu: sayı} sözlüğüne çevirir."""
    chars = f" {normalized} "
    vector = {}
    for i in range(len(chars) - n + 1):
        bucket = _fnv1a(chars[i:i + n]) % dim
        vector[bucket] = vector.get(bucket, 0) + 1
    return vector


def cosine(a, b):
    dot = sum(value * b.get(key, 0) for key, value in a.items())
    norm_a = sum(v * v for v in a.values())
    norm_b = sum(v * v for v in b.values())
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / math.sqrt(norm_a * norm_b)


def similarity(a, b):
    """İki mesajın benzerliği, 0 ile 1 arası. Mesajlar önce sadeleştirilir."""
    return cosine(ngram_vector(normalize_text(a)), ngram_vector(normalize_text(b)))


_SIGNAL_RULES = json.loads(
    (Path(__file__).resolve().parents[2] / "extension" / "src" / "data" / "signal-rules.json").read_text(encoding="utf-8")
)
_CONTINUE = _SIGNAL_RULES["continue"]


def is_bare_continue(text):
    """Yönsüz devam isteği ("devam", "devam et", "tamam devam", "continue", "go on"); intents.ts ile aynı.

    Yönlü devam ("devam et ama tablo olarak", "continue to day 2") sayılmaz.
    """
    words = set(with_folded(_CONTINUE["words"]))
    allowed = set(with_folded(_CONTINUE["allowed"] + _CONTINUE["words"]))
    normalized = fold_turkish(normalize_text(text))
    tokens = normalized.split()
    if not tokens or len(tokens) > _CONTINUE["max_words"] or not all(t in allowed for t in tokens):
        return False
    padded = f" {normalized} "
    return any(t in words for t in tokens) or any(f" {p} " in padded for p in with_folded(_CONTINUE["phrases"]))


def is_comparable(text):
    """Eklenti 12 karakterden kısa mesajları ("devam et", "evet") ve yönsüz devam isteklerini karşılaştırmaz."""
    return len(normalize_text(text)) >= EXT_MIN_NORMALIZED_CHARS and not is_bare_continue(text)


_REPEAT_RULES = json.loads(
    (Path(__file__).resolve().parents[2] / "extension" / "src" / "data" / "repeat-rules.json").read_text(encoding="utf-8")
)
_FILLER = set(with_folded(_REPEAT_RULES["filler"]))
# Yalnızca mesajın başındaki dolgu dizisinde dolgu sayılan sözcükler ("Olmadı, ..."); ortada içeriktir.
_LEADING_FILLER = set(with_folded(_REPEAT_RULES["leading_filler"]))


_CHOICE = set(_REPEAT_RULES["choice_letters"])
_VARIATION = _REPEAT_RULES["variation"]
_VARIATION_WORDS = set(with_folded(_VARIATION["words"]))
_VARIATION_PREFIXES = with_folded(_VARIATION["prefixes"])
_VARIATION_PHRASES = with_folded(_VARIATION["phrases"])


def has_variation_cue(text):
    """Varyasyon işareti: yeni bir örnek isteği ("başka", "sonraki", "bir tane daha", "more", "next")."""
    normalized = fold_turkish(normalize_text(text))  # "baska fikir" de sayılır
    tokens = normalized.split()
    if any(t in _VARIATION_WORDS for t in tokens):
        return True
    if any(t.startswith(p) for t in tokens for p in _VARIATION_PREFIXES):
        return True
    padded = f" {normalized} "
    return any(f" {p} " in padded for p in _VARIATION_PHRASES)


def is_variation(text, score=0.0):
    """Varyasyon isteği: işaret var, güçlü onarım ifadesi yok (repeat-detector.ts, isVariation).

    Orta uzunlukta (16-40 kelime) bir mesajın birebir yeniden gönderimi varyasyon sayılmaz; score önceki mesajlarla en yüksek benzerliktir.
    """
    from kafiai.text import has_strong_repair
    if not has_variation_cue(text) or has_strong_repair(text):
        return False
    words = len(normalize_text(text).split())
    # Çok uzun birebir tekrarlar yeniden kullanılan istem şablonlarıdır; onlar yine varyasyon sayılır.
    return not (score >= _VARIATION["exact_similarity"]
                and _VARIATION["max_exact_words"] < words <= _VARIATION["template_words"])


def _keyboard_words(text):
    """Mesajın kelimeleri ve her kelimenin klavyesiz (Türkçe harfsiz) yazılıp yazılmadığı (repeat-detector.ts ile aynı).

    Türkçe harf denetimi büyük I İngilizce kurala göre i yapılmış metne bakar: normalize_text "I"yı "ı"ya
    çevirdiği için "Imparatorlugu" yoksa Türkçe harfli sayılırdı.
    """
    words = normalize_text(text).split()
    plain = normalize_text((text or "").replace("I", "i")).split()
    if len(plain) != len(words):
        plain = words  # beklenmedik bölünme farkında güvenli taraf: kelimenin kendisine bak
    return [(w, not has_turkish_letter(p)) for w, p in zip(words, plain)]


def _has_digit(token):
    return any(c.isdigit() for c in token)


def new_content(new_text, previous_text):
    """Yeni mesajın öncekinde karşılığı olmayan içerik kelimeleri (repeat-detector.ts ile aynı kural).

    Kelimeler yeni mesajdaki özgün yazımıyla döner. Türkçe karakterleri düz harfe indirilmiş eşleşme
    ("baskenti" / "başkenti") yalnızca iki kelimeden en az biri klavyesiz yazılmışsa sayılır; ikisi de
    Türkçe harfliyse ("kaslarımı" / "kaşlarımı") farklı kelimelerdir.
    """
    stem = _REPEAT_RULES["stem_chars"]
    prev = _keyboard_words(previous_text)
    prev_set = {t for t, _ in prev}
    prev_stems = {t[:stem] for t, _ in prev if len(t) >= stem and not _has_digit(t)}
    # Düz harfe indirilmiş biçimler: tüm kelimelerden ve yalnızca klavyesiz yazılmış kelimelerden.
    folded_all = {fold_turkish(t) for t, _ in prev}
    folded_plain = {fold_turkish(t) for t, plain in prev if plain}
    folded_stems_all = {fold_turkish(t)[:stem] for t, _ in prev if len(t) >= stem and not _has_digit(t)}
    folded_stems_plain = {fold_turkish(t)[:stem] for t, plain in prev if plain and len(t) >= stem and not _has_digit(t)}
    words = _keyboard_words(new_text)
    short = len(words) <= _REPEAT_RULES["choice_max_words"]
    out = []
    leading = True  # mesajın başındaki dolgu dizisi sürüyor mu?
    for t, plain in words:
        if leading and t in _LEADING_FILLER:
            continue
        if t not in _FILLER:
            leading = False
        if short and t in _CHOICE:
            # Kısa mesajda tek başına şık harfi içeriktir: "cevabım B" ile "cevabım C" farklı.
            if t not in prev_set:
                out.append(t)
            continue
        if t in _FILLER or not (len(t) >= _REPEAT_RULES["min_token_chars"] or _has_digit(t)):
            continue
        if t in prev_set:
            continue
        folded = fold_turkish(t)
        # Yeni kelime klavyesizse öncekindeki her kelimeyle, değilse yalnızca klavyesiz olanlarla düz harfte eşleşir.
        if folded in (folded_all if plain else folded_plain):
            continue
        if not _has_digit(t) and len(t) >= stem and (
                t[:stem] in prev_stems or folded[:stem] in (folded_stems_all if plain else folded_stems_plain)):
            continue
        out.append(t)
    return out


def is_repeat(new_text, previous_text, threshold=None):
    """Şerit kuralı: benzerlik eşiği geçiyor, yeni mesaj yeni bir içerik getirmiyor ve bir varyasyon isteği değil."""
    from kafiai.config import EXT_SIMILARITY_THRESHOLD
    limit = EXT_SIMILARITY_THRESHOLD if threshold is None else threshold
    score = similarity(new_text, previous_text)
    return score >= limit and not new_content(new_text, previous_text) and not is_variation(new_text, score)


def holds_send(new_text, previous_text):
    """Gönderimi bekleten şerit: tekrar kuralı geçer ve ya birebir tekrardır ya da güçlü onarım ifadesi taşır.

    Birebir olmayan yeniden yazımlar halka ve çıkış kartı için benzer sayılır ama gönderim bekletilmez
    (repeat-rules.json, hold_note; eklentide RepeatDetector.check().hold).
    """
    from kafiai.text import has_strong_repair
    if not is_repeat(new_text, previous_text):
        return False
    return similarity(new_text, previous_text) >= _REPEAT_RULES["hold_exact_similarity"] or has_strong_repair(new_text)
