import { QUIET_MS, START_TIMEOUT_MS } from "../config";

type Phase = "idle" | "awaiting" | "generating";

export interface WatcherCallbacks {
  onComplete(): void;
  onNoSignal(): void;
}

/**
 * Bir mesaj gönderildikten sonra cevabın başlayıp bittiğini izleyen küçük durum makinesi.
 *
 *   idle ──begin()──▶ awaiting ──"üretiliyor"──▶ generating ──sessizlik──▶ idle (onComplete)
 *                        └─ zaman aşımı ──▶ idle (onNoSignal)
 *
 * Zamanı dışarıdan alır (tick(now)), bu yüzden gerçek zamanlayıcı olmadan test edilebilir.
 */
export class ResponseWatcher {
  private phase: Phase = "idle";
  private since = 0;
  private quietSince: number | null = null;

  constructor(
    private readonly isGenerating: () => boolean,
    private readonly callbacks: WatcherCallbacks,
    private readonly quietMs = QUIET_MS,
    private readonly startTimeoutMs = START_TIMEOUT_MS,
  ) {}

  get active(): boolean {
    return this.phase !== "idle";
  }

  begin(now: number): void {
    this.phase = "awaiting";
    this.since = now;
    this.quietSince = null;
  }

  cancel(): void {
    this.phase = "idle";
    this.quietSince = null;
  }

  tick(now: number): void {
    if (this.phase === "idle") return;
    const generating = this.isGenerating();

    if (this.phase === "awaiting") {
      if (generating) {
        this.phase = "generating";
        this.quietSince = null;
      } else if (now - this.since > this.startTimeoutMs) {
        this.phase = "idle";
        this.callbacks.onNoSignal();
      }
      return;
    }

    // generating
    if (generating) {
      this.quietSince = null;
      return;
    }
    if (this.quietSince === null) {
      this.quietSince = now;
      return;
    }
    if (now - this.quietSince >= this.quietMs) {
      this.phase = "idle";
      this.quietSince = null;
      this.callbacks.onComplete();
    }
  }
}
