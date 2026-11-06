import { HISTORY_STABLE_TICKS, HISTORY_TIMEOUT_MS } from "../config";

/**
 * Var olan bir sohbet açıldığında eski kullanıcı mesajlarını sayfadan okumak için bekler.
 * Sayfa mesajları geç çizdiği için sayı birkaç ölçüm boyunca değişmeyene kadar bekler.
 * Okunan metinler yalnızca bellekte kullanılır.
 */
export class HistoryWatcher {
  private running = false;
  private startedAt = 0;
  private lastCount = -1;
  private stableTicks = 0;

  constructor(
    private readonly read: () => string[],
    private readonly onReady: (texts: string[]) => void,
    private readonly stableNeeded: number = HISTORY_STABLE_TICKS,
    private readonly timeoutMs: number = HISTORY_TIMEOUT_MS,
  ) {}

  get active(): boolean {
    return this.running;
  }

  begin(now: number): void {
    this.running = true;
    this.startedAt = now;
    this.lastCount = -1;
    this.stableTicks = 0;
  }

  cancel(): void {
    this.running = false;
  }

  tick(now: number): void {
    if (!this.running) return;
    const texts = this.read();
    if (texts.length > 0 && texts.length === this.lastCount) {
      this.stableTicks += 1;
      if (this.stableTicks >= this.stableNeeded) {
        this.running = false;
        this.onReady(texts);
        return;
      }
    } else {
      this.stableTicks = 0;
      this.lastCount = texts.length;
    }
    if (now - this.startedAt > this.timeoutMs) this.running = false;
  }
}

/** Açılan sohbetin geçmişinden ne kadarını bildiğimiz. */
export interface HistorySeed {
  /** Sohbetteki kullanıcı mesajı sayısı (sayfanın bildirdiği toplam ya da okunan sayı). */
  turns: number;
  /** Okunamayan, sayfada çizilmemiş eski mesaj sayısı. */
  hidden: number;
  /** Geçmişin bir kısmı okunamadı mı? O zaman ilk mesaj gerçek ilk mesaj değildir. */
  partial: boolean;
}

/**
 * Okunan metinleri sayfanın bildirdiği toplamla birleştirir. Sanal liste kullanan sitelerde
 * (Claude) yalnızca ekrandaki mesajlar okunabilir; toplam yine de doğru sayılır, eksik kısım
 * "gizli" olarak işaretlenir. Bildirilen toplam okunandan azsa okunan sayı esas alınır.
 */
export function historySeed(texts: readonly string[], reported: number | null | undefined): HistorySeed {
  const turns = Math.max(texts.length, reported ?? 0);
  const hidden = turns - texts.length;
  return { turns, hidden, partial: hidden > 0 };
}
