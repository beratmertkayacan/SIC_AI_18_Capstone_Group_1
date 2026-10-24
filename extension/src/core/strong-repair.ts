import rules from "../data/repair-rules.json";
import { normalizeText } from "./text";

/**
 * Güçlü onarım ifadesi: kullanıcının bir önceki cevabın işe yaramadığını söylediği mesaj
 * ("still not working", "olmadı", "aynı hata"). Kurallar src/data/repair-rules.json dosyasında;
 * Python tarafı (src/kafiai/text.py, has_strong_repair) aynı dosyayı okur ve parite testi
 * iki tarafın aynı cevabı verdiğini kontrol eder.
 */

const words = new Set<string>(rules.words);

function matchNormalized(normalized: string): boolean {
  const tokens = normalized.split(" ").filter((w) => w !== "");
  if (tokens.some((w) => words.has(w))) return true;
  if (tokens.some((w) => rules.prefixes.some((p) => w.startsWith(p)))) return true;
  const padded = ` ${normalized} `;
  if (rules.phrases.some((p) => padded.includes(` ${p} `))) return true;
  const head = tokens[0];
  return head !== undefined && rules.starts_with.includes(head);
}

export function hasStrongRepair(text: string): boolean {
  const raw = text ?? "";
  if (rules.markers.some((m) => raw.includes(m))) return true;
  // Türkçe kural "I"yı "ı" yapar ("HAYIR" -> "hayır"); İngilizce "I said" için ikinci deneme.
  return matchNormalized(normalizeText(raw)) || matchNormalized(normalizeText(raw.replace(/I/g, "i")));
}
