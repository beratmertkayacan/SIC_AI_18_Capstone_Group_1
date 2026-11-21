/** Bir cevabın başından okunan en fazla karakter. Yalnızca bellekte, yalnızca kural için kullanılır. */
export const RESPONSE_HEAD_CHARS = 600;
/** Cevabın sonundan okunan en fazla karakter: cevabın bir soruyla bitip bitmediğine bakmak için. */
export const RESPONSE_TAIL_CHARS = 200;

/**
 * Bir cevap öğesinin metni: ekran okuyucuya özel başlıklar gibi okunmaması gereken parçalar
 * (exclude) çıkarılarak, ilk RESPONSE_HEAD_CHARS karakter; cevap daha uzunsa araya " … " konup son
 * RESPONSE_TAIL_CHARS karakter eklenir (özür kuralı başa, teklif sorusu kuralı sona bakar).
 * Metin hiçbir yere yazılmaz.
 */
export function responseText(el: Element | null | undefined, exclude?: string): string | null {
  if (!el) return null;
  const copy = el.cloneNode(true) as Element;
  if (exclude) copy.querySelectorAll(exclude).forEach((n) => n.remove());
  const text = (copy.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text === "") return null;
  const chars = Array.from(text);
  if (chars.length <= RESPONSE_HEAD_CHARS + RESPONSE_TAIL_CHARS) return text;
  return `${chars.slice(0, RESPONSE_HEAD_CHARS).join("")} … ${chars.slice(-RESPONSE_TAIL_CHARS).join("")}`;
}

/**
 * Bir cevap öğesinin metninin tamamı, kısaltılmadan (deney: kısıt kontrolü). responseText ile aynı
 * temizlik yapılır. Metin yalnızca bellekte kullanılır; hiçbir yere yazılmaz.
 */
export function fullResponseText(el: Element | null | undefined, exclude?: string): string | null {
  if (!el) return null;
  const copy = el.cloneNode(true) as Element;
  if (exclude) copy.querySelectorAll(exclude).forEach((n) => n.remove());
  const text = (copy.textContent ?? "").replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/** Seçiciye uyan son öğe. */
export function lastOf(selector: string, root: ParentNode = document): Element | undefined {
  const all = root.querySelectorAll(selector);
  return all[all.length - 1];
}
