import type { CounterName } from "./settings";

/**
 * Gönderilen bir mesaj için hangi sayaçlar artırılır? (Yalnızca sayaç adları; metin yok.)
 * - Karşılaştırılamayan kısa mesajlar hiçbir orana girmez.
 * - Oran = similarSends / checkedSends; öneriler açıkken ve kapalıyken ayrı tutulur.
 * - Yalnızca say modunda benzer bir mesaj, öneri açık olsaydı şerit çıkacağı için "stripWouldShow" sayılır.
 */
export function sendCounters(check: { similar: boolean; tooShort: boolean }, suggesting: boolean): CounterName[] {
  if (check.tooShort) return [];
  const out: CounterName[] = [suggesting ? "checkedSendsOn" : "checkedSendsOff"];
  if (check.similar) {
    out.push(suggesting ? "similarSendsOn" : "similarSendsOff");
    if (!suggesting) out.push("stripWouldShow");
  }
  return out;
}
