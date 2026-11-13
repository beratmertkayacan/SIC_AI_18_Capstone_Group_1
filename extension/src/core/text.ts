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

const FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/**
 * Türkçe karakterleri düz harfe indirir ("yanlış" → "yanlis"). Birçok kullanıcı Türkçe klavye
 * olmadan yazıyor; kural listeleri bu biçimi de tanısın diye eşleştirmede ikinci biçim olarak kullanılır.
 * Python: extension_similarity.fold_turkish.
 */
export function foldTurkish(normalized: string): string {
  return normalized.replace(/[çğıöşüâîû]/g, (c) => FOLD[c] ?? c);
}

/** Kural listesine her ifadenin Türkçe karaktersiz hâlini de ekler (sıra korunur, tekrar yok). */
export function withFolded(list: readonly string[]): string[] {
  return [...new Set([...list, ...list.map(foldTurkish)])];
}
