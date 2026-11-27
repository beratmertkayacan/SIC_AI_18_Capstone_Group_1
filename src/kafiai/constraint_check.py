"""Kısıt kontrolü (deney, varsayılanı kapalı): extension/src/core/constraint-check.ts dosyasının Python eşi.

Yalnızca tamamlanmış düz metin cevabın TAMAMINA uygulanan açık kelime ya da karakter ÜST sınırlarına bakar.
Görev sınırı bilinmediği için yalnızca cevabın ait olduğu gönderimin mesajında söylenen (ya da yinelenen)
sınır uygulanır; önceki bir mesajdaki sınır yinelenmiyorsa geçerliliği doğrulanamaz ("değerlendirilemiyor").
Ortak örnekler: tests/fixtures/constraint_parity.json (iki taraf aynı sonucu vermeli).
"""

import re
import unicodedata

UNIT = {"kelime": "kelime", "word": "kelime", "words": "kelime", "karakter": "karakter", "character": "karakter",
        "characters": "karakter", "char": "karakter", "chars": "karakter"}
PATTERNS = [
    (re.compile(r"(?:en fazla|en çok|maksimum|max\.?)\s*(\d+)\s*(kelime|karakter)"), "<="),
    (re.compile(r"(\d+)\s*(kelime|karakter)(?:yi|i|ı)?\s*(?:geçmesin|geçmemeli|aşmasın|aşmamalı)"), "<="),
    (re.compile(r"(\d+)\s*(kelime|karakter)(?:nin|in|ın|den|dan|ten|tan)\s*(?:altında|az)"), "<"),
    (re.compile(r"(?:at most|no more than|up to|maximum of|max\.?)\s*(\d+)\s*(words?|characters?|chars?)"), "<="),
    (re.compile(r"(?:under|fewer than|less than|below)\s*(\d+)\s*(words?|characters?|chars?)"), "<"),
]
CHANGE = re.compile(r"(\d+)\s*(kelime|karakter)\s*sınırını\s*(\d+)\S*\s*(?:çıkar|yükselt|indir|düşür)")
PART = re.compile(r"(?<!\w)(başlık|madde|paragraf|her biri|her bir|title|heading|bullet|each|per)(?!\w)")
NO_SPACE = re.compile(r"boşluklar hariç|boşluksuz|boşluk hariç|excluding spaces|without spaces")
WITH_SPACE = re.compile(r"boşluklar dahil|boşluk dahil|including spaces|with spaces")


def parse_constraints(message):
    """Mesajdaki tanınan üst sınırlar; tanınmayan ifade boş liste verir (bu "kısıt yok" demek değildir)."""
    text = message.lower()
    partial = bool(PART.search(text))
    space = "haric" if NO_SPACE.search(text) else "dahil" if WITH_SPACE.search(text) else None
    found = [{"n": int(m.group(3)), "unit": UNIT[m.group(2)], "kind": "<=", "partial": partial, "space": space}
             for m in CHANGE.finditer(text)]
    if found:
        return found
    for pattern, kind in PATTERNS:
        for m in pattern.finditer(text):
            found.append({"n": int(m.group(1)), "unit": UNIT[m.group(2)], "kind": kind, "partial": partial, "space": space})
    return found


def count_words(text):
    return sum(1 for token in re.split(r"\s+", text) if any(ch.isalnum() for ch in token))


def count_chars(text):
    s = unicodedata.normalize("NFC", text).strip()
    return len(s), len(re.sub(r"\s", "", s))


def _fits(count, c):
    return count <= c["n"] if c["kind"] == "<=" else count < c["n"]


def decide_constraint(user_texts, turn, answer, earlier_unknown=False):
    """user_texts: o ana kadarki kullanıcı mesajları; turn: cevabın ait olduğu gönderimin sırası (1'den)."""
    words = count_words(answer)
    chars, chars_no_space = count_chars(answer)
    base = {"words": words, "chars": chars, "chars_no_space": chars_no_space}
    current = parse_constraints(user_texts[turn - 1] if 0 < turn <= len(user_texts) else "")
    if not current:
        earlier = any(parse_constraints(m) for m in user_texts[:max(0, turn - 1)])
        if earlier or earlier_unknown:
            return {**base, "result": "değerlendirilemiyor", "constraint": None, "constraint_turn": None,
                    "reason": "önceki kısıtın geçerliliği doğrulanamadı"}
        return {**base, "result": "tanınan kısıt yok", "constraint": None, "constraint_turn": None, "reason": ""}
    c = current[0]
    out = {**base, "constraint": c, "constraint_turn": turn, "reason": ""}
    if c["partial"]:
        return {**out, "result": "değerlendirilemiyor", "reason": "kapsam belirsiz"}
    if c["unit"] == "kelime":
        return {**out, "result": "uyuyor" if _fits(words, c) else "aşıyor"}
    if c["space"] == "haric":
        return {**out, "result": "uyuyor" if _fits(chars_no_space, c) else "aşıyor", "reason": "boşluklar hariç"}
    if c["space"] == "dahil":
        return {**out, "result": "uyuyor" if _fits(chars, c) else "aşıyor", "reason": "boşluklar dahil"}
    if _fits(chars, c) != _fits(chars_no_space, c):
        return {**out, "result": "değerlendirilemiyor", "reason": "boşluk tercihi yok; iki sayım farklı karar veriyor"}
    return {**out, "result": "uyuyor" if _fits(chars, c) else "aşıyor"}
