import { MIN_NORMALIZED_CHARS, RECENT_MESSAGES, SIMILARITY_THRESHOLD } from "../config";
import { ngramVector, cosine } from "./similarity";
import { normalizeText } from "./text";

export interface RepeatCheck {
  /** Bu mesaj, yakın zamanda gönderilen birine benziyor mu? */
  similar: boolean;
  /** En yüksek benzerlik (0..1); karşılaştırılamadıysa 0. */
  score: number;
  /** Karşılaştırılamayan kısa mesaj mı? */
  tooShort: boolean;
}

/**
 * Oturumdaki son kullanıcı mesajlarını yalnızca bellekte tutar (sayfa kapanınca/sohbet
 * değişince silinir, hiçbir yere yazılmaz) ve yeni mesajın benzer olup olmadığına bakar.
 */
export class RepeatDetector {
  private recent: Map<number, number>[] = [];

  /** Mesaj gönderilmeden önce çağrılır; mesajı listeye eklemez. */
  check(text: string): RepeatCheck {
    const normalized = normalizeText(text);
    if (normalized.length < MIN_NORMALIZED_CHARS) return { similar: false, score: 0, tooShort: true };
    const vec = ngramVector(normalized);
    let score = 0;
    for (const previous of this.recent) score = Math.max(score, cosine(vec, previous));
    return { similar: score >= SIMILARITY_THRESHOLD, score, tooShort: false };
  }

  /** Mesaj gönderildikten sonra çağrılır. Kısa mesajlar saklanmaz. */
  remember(text: string): void {
    const normalized = normalizeText(text);
    if (normalized.length < MIN_NORMALIZED_CHARS) return;
    this.recent.push(ngramVector(normalized));
    if (this.recent.length > RECENT_MESSAGES) this.recent.shift();
  }

  reset(): void {
    this.recent = [];
  }
}
