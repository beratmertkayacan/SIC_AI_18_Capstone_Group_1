"""Tur modeli için Python ile eklenti arasındaki parite örneklerini üretir.

Her örnek bir sohbetin o ana kadarki kullanıcı mesajlarıdır. Python öznitelikleri, olasılığı,
risk seviyesini ve gerekçeleri hesaplar; eklentinin testi (src/core/turn-model.parity.test.ts)
aynı mesajlardan aynı sonucu bulmak zorundadır. Örnekler Türkçe ve İngilizce onarım ifadelerini,
büyük İ ve I harflerini, kod bloklarını, birebir tekrarları ve uzun sohbetleri kapsayacak şekilde
elle yazıldı; gerçek kullanıcı mesajı içermez.

Çalıştırma (repo kök klasöründe, train_turn_model.py'den sonra):
    python scripts/make_turn_parity_fixture.py
Çıktı: tests/fixtures/turn_model_parity.json
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai.text import has_strong_repair  # noqa: E402
from kafiai.turn_features import turn_features  # noqa: E402
from kafiai.turn_model import predict  # noqa: E402

CONVERSATIONS = [
    ["Python'da bir listeyi tersine çeviren fonksiyon yaz", "Teşekkürler, şimdi de sıralayan bir tane yaz"],
    ["fix this code:\n```python\ndef f(x):\n    return x+1\n```", "it still gives an error", "same error again!!",
     "you didn't change anything"],
    ["Bana bir dilekçe yaz", "olmadı, daha resmi olsun", "HAYIR, öyle değil", "Ben ne dedim, tekrar yaz"],
    ["Write an essay about climate change", "Write an essay about climate change", "Write an essay about climate change"],
    ["İSTANBUL'un nüfusu kaç?", "IŞIK hızı nedir?"],
    ["I asked for a summary, not a list", "I said shorter", "No, that's wrong"],
    ["Summarize this article in 3 bullet points: " + "lorem ipsum " * 40, "make it shorter", "shorter",
     "even shorter please", "ok"],
    ["Объясни теорию относительности", "подробнее", "ещё подробнее"],
    ["Çeviri yap: 'Merhaba dünya' İngilizceye", "Şimdi Almancaya", "Fransızcaya da çevir", "İspanyolcaya",
     "İtalyancaya", "Japoncaya", "Korece", "Çince"],
    ["What is 2^10?", "And 2^20?", "What about 3³ and 10²?"],
    ["   boşluklu   mesaj   ", "", "hata hâlâ var", "hala çalışmıyor"],
    ["Generate SQL for top 10 customers", "doesnt work", "isn't working either", "not what i wanted"],
]

REPAIR_SAMPLES = [
    "olmadı", "Olmadı ya", "HAYIR", "hayır bu değil", "I said no", "I SAID NO", "It doesn't work", "it doesnt work",
    "same problem", "still", "Still wrong!!", "anlamadın beni", "yanlışsın", "please try again", "thanks, great",
    "no worries", "but why", "But it fails", "error", "KeyError: 'x'", "some_error_handler", "hâlâ aynı", "yine mi",
    "you forgot the title", "aynı hata çıkıyor", "öyle değil", "teşekkürler",
]


def main():
    rows = []
    for conv in CONVERSATIONS:
        for k in range(2, len(conv) + 1):
            msgs = conv[:k]
            features = turn_features(msgs, k)
            result = predict(features)
            rows.append({"messages": msgs, "features": features, **result})
    fixture = {"conversations": rows,
               "repairs": [{"text": t, "strong_repair": has_strong_repair(t)} for t in REPAIR_SAMPLES]}
    out = ROOT / "tests" / "fixtures" / "turn_model_parity.json"
    out.write_text(json.dumps(fixture, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(rows)} tur ve {len(REPAIR_SAMPLES)} onarım örneği yazıldı: {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
