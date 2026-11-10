import rules from "../data/signal-rules.json";
import type { Prediction } from "./turn-model";

/**
 * Halka (K29): mesaj kutusunun kenarında duran küçük gösterge. Sohbet akarken neredeyse görünmez;
 * döngü sinyalleri arttıkça tonu koyulaşır. Kesinti yapmaz, hiçbir şeyi bekletmez, kırmızı ya da
 * "risk" kullanmaz. Üzerine gelince tek satır açıklama söyler.
 *
 * Seviyeler:
 *   0  sakin       sinyal yok ya da model henüz karar vermiyor
 *   1  belirgin    modelin öneri eşiği geçildi, son mesajlardan biri öncekine çok benziyor, cevap özürle
 *                  başladı, üst üste iki kısa ve açıklamasız düzeltme isteği gönderildi ya da aynı kısa
 *                  mesaj ("devam") üst üste üç kez geldi
 *   2  koyu        modelin yüksek güven eşiği geçildi, son mesajlardan iki ve daha fazlası öncekilere çok
 *                  benziyor ya da cevaplar üst üste iki kez özürle başladı
 *
 * Halka yalnızca son birkaç mesaja bakar (src/core/signals.ts): kullanıcı teşekkür edip döngüden
 * çıkınca ya da konu değişince sakinleşir (K32).
 */

export type RingLevel = 0 | 1 | 2;

export interface RingSignals {
  prediction: Pick<Prediction, "level" | "reasons"> | null;
  /** Son birkaç mesajdan öncekine çok benzeyenlerin sayısı (çıkış ve konu değişiminde sıfırlanır) */
  similarCount: number;
  /** Üst üste özürle başlayan cevap sayısı */
  apologyStreak?: number;
  /** Üst üste kısa ve açıklamasız düzeltme isteği sayısı */
  vagueStreak?: number;
  /** Aynı kısa mesajın üst üste gelme sayısı */
  shortRepeatStreak?: number;
  /** Son mesaj kısa bir onarımdı ("olmadı") */
  shortRepair?: boolean;
}

const SHORT_REPEAT_STREAK: number = rules.short.repeat_streak;

export function ringLevel(s: RingSignals): RingLevel {
  const apology = s.apologyStreak ?? 0;
  const vague = s.vagueStreak ?? 0;
  if (s.prediction?.level === "yuksek" || s.similarCount >= 2 || apology >= 2) return 2;
  const shortRepeat = (s.shortRepeatStreak ?? 0) >= SHORT_REPEAT_STREAK;
  if (s.prediction?.level === "oneri" || s.similarCount === 1 || apology === 1 || vague >= 2 || shortRepeat) return 1;
  return 0;
}

/** Halkanın üzerine gelinince görünen tek satır. Ölçülen bir şeyi söyler; tahmin değil. */
export function ringText(s: RingSignals): string {
  const level = ringLevel(s);
  if (level === 0) return "Şu an dikkat çeken bir şey yok.";
  if ((s.apologyStreak ?? 0) >= 2) return "Son cevaplar üst üste özürle başladı; model aynı yerde dönüyor olabilir.";
  if (s.similarCount >= 2) return `Son mesajlarından ${s.similarCount} tanesi öncekilere çok benziyor.`;
  if (s.similarCount === 1 && s.shortRepair && s.prediction?.level !== "yuksek") {
    return "Son mesajın önceki cevabın olmadığını söylüyor; neyin olmadığını eklemek modelin işini kolaylaştırır.";
  }
  if (s.similarCount === 1 && s.prediction?.level !== "yuksek") return "Son mesajlarından biri öncekine çok benziyor.";
  if ((s.apologyStreak ?? 0) === 1 && s.prediction?.level !== "yuksek") return "Son cevap bir özürle başladı.";
  if ((s.vagueStreak ?? 0) >= 2 && s.prediction?.level !== "yuksek") {
    return "Son isteklerin kısa; neyin değişmesini istediğini yazmak modelin işini kolaylaştırır.";
  }
  if ((s.shortRepeatStreak ?? 0) >= SHORT_REPEAT_STREAK && s.prediction?.level !== "yuksek") {
    return "Aynı kısa mesajı üst üste gönderdin; ne görmek istediğini biraz açarsan farklı bir cevap gelebilir.";
  }
  const reason = s.prediction?.reasons[0];
  return reason ? reason.why : "Sohbet aynı yerde dönmeye başlamış olabilir.";
}
