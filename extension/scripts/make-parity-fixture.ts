/**
 * Python ikiziyle eşleşme testi için ortak örnekleri üretir.
 * Çalıştırma (extension klasöründe): npm run parity-fixture
 * Çıktı: ../tests/fixtures/similarity_parity.json
 *
 * Örnekler Türkçe karakterleri, büyük İ ve I harflerini, noktalamayı, emojiyi,
 * Latin dışı alfabeleri ve çok kısa mesajları kapsayacak şekilde seçildi.
 */
import { writeFileSync } from "node:fs";
import { similarity } from "../src/core/similarity";
import { normalizeText } from "../src/core/text";

const PAIRS: [string, string][] = [
  ["Bu kodu düzelt", "bu kodu düzelt!"],
  ["Bu kodu düzelt", "Kodda hata var, tekrar yazar mısın?"],
  ["İSTANBUL'da hava nasıl?", "istanbulda hava nasil"],
  ["IŞIK hızı nedir", "ışık hızı nedir?"],
  ["Write an essay about climate change", "write an essay about climate change please"],
  ["Write an essay about climate change", "Explain how transformers work"],
  ["fix this python code: def f(x): return x+1", "fix this python code: def f(x): return x + 2"],
  ["that's not what I asked, try again", "That is not what I asked. Try again!!"],
  ["Bana bir dilekçe yaz 🙏", "bana bir dilekçe yaz"],
  ["Объясни теорию относительности", "объясни теорию относительности подробно"],
  ["用中文解释机器学习", "用中文解释深度学习"],
  ["devam et", "devam et"],
  ["", "boş mesajla karşılaştırma"],
  ["Ödevimi özetle: Osmanlı İmparatorluğu'nun çöküş nedenleri", "Osmanlı İmparatorluğu'nun çöküş nedenlerini özetle"],
  ["Résumé: café, naïve, coöperate", "resume cafe naive cooperate"],
  ["   çok   fazla    boşluk   var   ", "çok fazla boşluk var"],
];

const fixture = PAIRS.map(([a, b]) => ({
  a,
  b,
  normalized_a: normalizeText(a),
  normalized_b: normalizeText(b),
  similarity: similarity(normalizeText(a), normalizeText(b)),
}));

writeFileSync(new URL("../../tests/fixtures/similarity_parity.json", import.meta.url), JSON.stringify(fixture, null, 2) + "\n");
console.log(`${fixture.length} örnek yazıldı`);
