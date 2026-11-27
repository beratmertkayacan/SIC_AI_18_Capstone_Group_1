/**
 * Eklenti yeniden yüklendiğinde ya da güncellendiğinde açık sekmelerdeki eski içerik betiği çalışmaya devam
 * eder ama eklentiyle bağı kopar: chrome.runtime.id boşalır ve chrome.* çağrıları "Extension context
 * invalidated" hatası fırlatır. Bu kontrol, betiğin çökmek yerine kenara çekilmesini sağlar.
 */
export function extensionAlive(): boolean {
  try {
    return typeof chrome !== "undefined" && typeof chrome.runtime?.id === "string";
  } catch {
    return false;
  }
}
