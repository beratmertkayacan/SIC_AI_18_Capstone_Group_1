/**
 * Metni karşılaştırma için hazırlar: Türkçe'ye uygun küçük harf (İ→i, I→ı),
 * noktalama atılır, boşluklar teke indirilir. Yalnızca bellekte kullanılır.
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFC")
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
