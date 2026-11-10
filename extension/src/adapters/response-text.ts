/** Bir cevabın başından okunan en fazla karakter. Yalnızca bellekte, yalnızca kural için kullanılır. */
export const RESPONSE_HEAD_CHARS = 600;

/**
 * Bir cevap öğesinin metni: ekran okuyucuya özel başlıklar gibi okunmaması gereken parçalar
 * (exclude) çıkarılarak, ilk RESPONSE_HEAD_CHARS karakter. Metin hiçbir yere yazılmaz.
 */
export function responseText(el: Element | null | undefined, exclude?: string): string | null {
  if (!el) return null;
  const copy = el.cloneNode(true) as Element;
  if (exclude) copy.querySelectorAll(exclude).forEach((n) => n.remove());
  const text = (copy.textContent ?? "").replace(/\s+/g, " ").trim();
  return text === "" ? null : text.slice(0, RESPONSE_HEAD_CHARS);
}

/** Seçiciye uyan son öğe. */
export function lastOf(selector: string, root: ParentNode = document): Element | undefined {
  const all = root.querySelectorAll(selector);
  return all[all.length - 1];
}
