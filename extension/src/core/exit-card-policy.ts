import { EXIT_CARD_COOLDOWN_TURNS, EXIT_CARD_MIN_REPEATS, EXIT_CARD_MIN_TURNS } from "../config";

/**
 * Çıkış kartının ne zaman çıkacağına karar verir. Yalnızca bellekte; sohbet değişince sıfırlanır.
 * Kural tamamen açık: tur sayısı + gerçekleşmiş benzer mesaj denemesi + bekleme süresi.
 */
export class ExitCardPolicy {
  private repeats = 0;
  private quietUntilTurn = 0;

  /** Kullanıcı bu sohbette benzer bir mesaj göndermeyi denedi. */
  noteRepeat(): void {
    this.repeats += 1;
  }

  shouldShow(turns: number): boolean {
    return turns >= EXIT_CARD_MIN_TURNS && this.repeats >= EXIT_CARD_MIN_REPEATS && turns >= this.quietUntilTurn;
  }

  /** Kart kapatıldı ya da yok sayıldı: bir süre tekrar çıkmasın. */
  dismissed(turns: number): void {
    this.quietUntilTurn = turns + EXIT_CARD_COOLDOWN_TURNS;
  }

  reset(): void {
    this.repeats = 0;
    this.quietUntilTurn = 0;
  }
}
