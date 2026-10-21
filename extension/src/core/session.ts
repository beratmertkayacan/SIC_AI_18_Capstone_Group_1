export type NavigationResult = "keep" | "adopt" | "reset";

/**
 * Bir sekmedeki sohbet oturumunun durumu. Yalnızca bellekte yaşar, sekme kapanınca silinir.
 *
 * Önemli ayrıntı: yeni bir sohbette ilk mesaj gönderilince adres "/" iken "/c/<kimlik>" olur.
 * Bu aynı sohbettir, oturum sıfırlanmamalıdır ("adopt").
 */
export class Session {
  key: string | null;
  turns = 0;

  constructor(initialKey: string | null) {
    this.key = initialKey;
  }

  /** Bir mesaj gönderildi; oturumdaki mesaj sayısını döndürür. */
  recordSend(): number {
    this.turns += 1;
    return this.turns;
  }

  onNavigate(nextKey: string | null): NavigationResult {
    if (nextKey === this.key) return "keep";
    if (this.key === null && nextKey !== null && this.turns > 0) {
      this.key = nextKey;
      return "adopt";
    }
    this.key = nextKey;
    this.turns = 0;
    return "reset";
  }
}
