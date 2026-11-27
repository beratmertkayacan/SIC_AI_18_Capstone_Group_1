import type { Prediction } from "./turn-model";

/**
 * Halka (K29): mesaj kutusunun kenarında duran küçük gösterge. Sohbet akarken neredeyse görünmez;
 * döngü sinyalleri arttıkça tonu koyulaşır. Kesinti yapmaz, hiçbir şeyi bekletmez, kırmızı ya da
 * "risk" kullanmaz. Üzerine gelince tek satır açıklama söyler.
 *
 * Seviyeler:
 *   0  sakin       sinyal yok ya da model henüz karar vermiyor
 *   1  belirgin    modelin öneri eşiği geçildi, son mesajlardan biri öncekine çok benziyor, cevap özürle
 *                  başladı ya da üst üste iki kısa ve açıklamasız düzeltme isteği gönderildi. Aynı kısa
 *                  mesajın ("devam") üçüncü kez gelmesi halkayı yükseltmez; onun yerine şerit çıkar
 *   2  koyu        modelin yüksek güven eşiği geçildi, son mesajlardan iki ve daha fazlası öncekilere çok
 *                  benziyor, cevaplar üst üste iki kez özürle başladı ya da kullanıcı düzeltme istediği
 *                  hâlde cevap öncekinin neredeyse aynısı
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
  /** Kullanıcı düzeltme istedi ama son cevap öncekinin neredeyse aynısı */
  ignoredRepair?: boolean;
  /** Anlam desteğinin seviyesi (src/core/judge.ts; yalnızca kullanıcı izin verdiyse) */
  judgeRing?: 0 | 1 | 2;
  /** Anlam desteğinin gerekçesi; halka onun yüzünden koyulaştıysa üzerine gelince bu görünür */
  judgeWhy?: string;
}

export function ringLevel(s: RingSignals): RingLevel {
  const rules = ruleLevel(s);
  return Math.max(rules, s.judgeRing ?? 0) as RingLevel;
}

function ruleLevel(s: RingSignals): RingLevel {
  const apology = s.apologyStreak ?? 0;
  const vague = s.vagueStreak ?? 0;
  if (s.prediction?.level === "yuksek" || s.similarCount >= 2 || apology >= 2 || s.ignoredRepair) return 2;
  if (s.prediction?.level === "oneri" || s.similarCount === 1 || apology === 1 || vague >= 2) return 1;
  return 0;
}

/** Halkanın üzerine gelinince görünen tek satır. Ölçülen bir şeyi söyler; tahmin değil. */
export function ringText(s: RingSignals): string {
  const level = ringLevel(s);
  if (level === 0) return "Şu an dikkat çeken bir şey yok.";
  if ((s.judgeRing ?? 0) > ruleLevel(s) && s.judgeWhy) return s.judgeWhy;
  if (s.ignoredRepair) return "Düzeltme istedin ama son cevap öncekinin neredeyse aynısı; model düzeltmeyi almamış olabilir.";
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
  const reason = s.prediction?.reasons[0];
  return reason ? reason.why : "Sohbet aynı yerde dönmeye başlamış olabilir.";
}
