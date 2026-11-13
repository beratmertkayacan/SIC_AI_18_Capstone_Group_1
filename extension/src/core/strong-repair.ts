import rules from "../data/repair-rules.json";
import { foldTurkish, normalizeText, withFolded } from "./text";

/**
 * Güçlü onarım ifadesi: kullanıcının bir önceki cevabın işe yaramadığını söylediği mesaj
 * ("still not working", "olmadı", "aynı hata"). Kurallar src/data/repair-rules.json dosyasında;
 * Python tarafı (src/kafiai/text.py, has_strong_repair) aynı dosyayı okur ve parite testi
 * iki tarafın aynı cevabı verdiğini kontrol eder.
 */

// Listeler Türkçe karaktersiz yazımı da kapsar ("yanlis", "olmadi").
const words = new Set<string>(withFolded(rules.words));
/** Yalnızca kısa mesajlarda sayılan kelime ve ifadeler ("still", "is not", "yine"): uzun metinde ayırt etmiyorlar. */
const limitedWords = new Set<string>(withFolded(rules.limited_words.words));
const limitedPhrases = withFolded(rules.limited_words.phrases);
const prefixes = withFolded(rules.prefixes);
const phrases = withFolded(rules.phrases);
const startsWith = withFolded(rules.starts_with);

function matchNormalized(normalized: string): boolean {
  const tokens = normalized.split(" ").filter((w) => w !== "");
  if (tokens.some((w) => words.has(w))) return true;
  if (tokens.some((w) => prefixes.some((p) => w.startsWith(p)))) return true;
  const padded = ` ${normalized} `;
  if (phrases.some((p) => padded.includes(` ${p} `))) return true;
  if (tokens.length < rules.limited_words.max_words) {
    if (tokens.some((w) => limitedWords.has(w))) return true;
    if (limitedPhrases.some((p) => padded.includes(` ${p} `))) return true;
  }
  const head = tokens[0];
  return head !== undefined && startsWith.includes(head);
}

export function hasStrongRepair(text: string): boolean {
  const raw = text ?? "";
  if (rules.markers.some((m) => raw.includes(m))) return true;
  // Türkçe kural "I"yı "ı" yapar ("HAYIR" -> "hayır"); İngilizce "I said" için ikinci deneme.
  const tr = normalizeText(raw);
  return matchNormalized(tr) || matchNormalized(normalizeText(raw.replace(/I/g, "i"))) || matchNormalized(foldTurkish(tr));
}
