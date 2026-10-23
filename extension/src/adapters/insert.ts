/** Mesaj kutusunun içeriği (kırpılmamış): satır sonları dahil. */
function rawText(box: HTMLElement): string {
  return box.innerText || box.textContent || "";
}

/**
 * Metni kutunun sonuna, kutu doluysa yeni bir satır olarak ekler. Sayfanın kendi düzenleyicisi
 * değişikliği görsün diye tarayıcının yazma komutlarını kullanır; innerHTML'e dokunmaz.
 */
export function appendAsNewLine(composer: HTMLElement, text: string): boolean {
  if (typeof document.execCommand !== "function") return false;
  composer.focus();
  const selection = window.getSelection();
  if (!selection) return false;
  const range = document.createRange();
  range.selectNodeContents(composer);
  range.collapse(false); // imleci sona koy
  selection.removeAllRanges();
  selection.addRange(range);
  if (rawText(composer).trim() !== "") {
    // Önce yeni paragraf; düzenleyici bunu görmezse satır sonu dene.
    const lineBreaks = () => (rawText(composer).match(/\n/g) ?? []).length;
    const before = lineBreaks();
    document.execCommand("insertParagraph");
    if (lineBreaks() === before) document.execCommand("insertLineBreak");
  }
  return document.execCommand("insertText", false, text);
}
