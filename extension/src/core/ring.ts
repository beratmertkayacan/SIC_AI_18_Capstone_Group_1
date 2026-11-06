import type { Prediction } from "./turn-model";

/**
 * Halka (K29): mesaj kutusunun kenarında duran küçük gösterge. Sohbet akarken neredeyse görünmez;
 * döngü sinyalleri arttıkça tonu koyulaşır. Kesinti yapmaz, hiçbir şeyi bekletmez, kırmızı ya da
 * "risk" kullanmaz. Üzerine gelince tek satır açıklama söyler.
 *
 * Seviyeler:
 *   0  sakin       sinyal yok ya da model henüz karar vermiyor
 *   1  belirgin    modelin öneri eşiği geçildi ya da bir benzer mesaj gönderildi
 *   2  koyu        modelin yüksek güven eşiği geçildi ya da iki ve daha fazla benzer mesaj gönderildi
 */

export type RingLevel = 0 | 1 | 2;

export interface RingSignals {
  prediction: Pick<Prediction, "level" | "reasons"> | null;
  /** Bu sohbette öncekine çok benzeyen gönderilmiş mesaj sayısı */
  similarCount: number;
}

export function ringLevel(s: RingSignals): RingLevel {
  if (s.prediction?.level === "yuksek" || s.similarCount >= 2) return 2;
  if (s.prediction?.level === "oneri" || s.similarCount === 1) return 1;
  return 0;
}

/** Halkanın üzerine gelinince görünen tek satır. Ölçülen bir şeyi söyler; tahmin değil. */
export function ringText(s: RingSignals): string {
  const level = ringLevel(s);
  if (level === 0) return "Şu an dikkat çeken bir şey yok.";
  if (s.similarCount >= 2) return `Son mesajlarından ${s.similarCount} tanesi öncekilere çok benziyor.`;
  if (s.similarCount === 1 && s.prediction?.level !== "yuksek") return "Son mesajlarından biri öncekine çok benziyor.";
  const reason = s.prediction?.reasons[0];
  return reason ? reason.why : "Sohbet aynı yerde dönmeye başlamış olabilir.";
}
