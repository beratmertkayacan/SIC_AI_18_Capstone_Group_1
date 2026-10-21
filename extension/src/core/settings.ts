import { COUNT_RETENTION_DAYS } from "../config";

/**
 * Ayarlar ve günlük sayaçlar. Buraya YALNIZCA ayar anahtarları ve sayılar yazılır;
 * mesaj metni, sohbet adresi ya da sohbet kimliği asla yazılmaz.
 */

export interface Settings {
  /** Eklenti tamamen açık mı? Kapalıysa içerik betiği hiçbir şey yapmaz. */
  enabled: boolean;
  /** Çıkış kartı gösterilsin mi? ("Bir daha gösterme" bunu kapatır.) */
  exitCardEnabled: boolean;
  /**
   * Öneriler (şerit ve çıkış kartı) gösterilsin mi? Kapalıysa eklenti "yalnızca say" modunda
   * çalışır: hiçbir şeyi bekletmez ve göstermez, yalnızca günlük sayıları tutar (pilot çalışma için).
   */
  suggestionsEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = { enabled: true, exitCardEnabled: true, suggestionsEnabled: true };

export const COUNTER_NAMES = [
  "stripShown", // "Bunu az önce de sormuştun" şeridi gösterildi
  "stripSendAnyway", // "Yine de gönder"
  "stripEdit", // "Kapat" (düzenlemeye dön)
  "stripRepair", // "Neyin eksik olduğunu söyle" ile cümle eklendi
  "exitCardShown",
  "freshStart", // Taze başlat ile kopyalandı
  "shortBreak", // Kısa ara ver
  "exitCardClosed", // Kapat / yok sayıldı
  "notRelevant", // "Yerinde değildi"
  "exitCardNever", // "Bir daha gösterme"
  // Yalnızca say modunda öneri gösterilseydi kaç kez gösterilecekti (kullanıcı hiçbir şey görmez).
  "stripWouldShow",
  "exitCardWouldShow",
  // Gönderilen mesajlar: karşılaştırılabilenler (en az MIN_NORMALIZED_CHARS karakter) ve bunlardan
  // son mesajlara benzeyenler. Öneriler açıkken ve kapalıyken ayrı sayılır; oran = benzer / karşılaştırılan.
  "checkedSendsOn",
  "similarSendsOn",
  "checkedSendsOff",
  "similarSendsOff",
] as const;
export type CounterName = (typeof COUNTER_NAMES)[number];

/** { "2026-10-21": { stripShown: 3 } } */
export type DailyCounts = Record<string, Partial<Record<CounterName, number>>>;

/** chrome.storage.local ile uyumlu en küçük arayüz (testte bellekteki sahtesi kullanılır). */
export interface KeyValueStorage {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export const SETTINGS_KEY = "kafiai.settings";
const COUNTS_KEY = "kafiai.counts";
export const STORAGE_KEYS = [SETTINGS_KEY, COUNTS_KEY];

/** Yerel takvime göre gün anahtarı: YYYY-MM-DD */
export function dayKey(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Depodan gelen her şeye güvenilmez: bilinmeyen alanlar atılır, bozuk değerler varsayılana döner. */
export function parseSettings(raw: unknown): Settings {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULT_SETTINGS.enabled,
    exitCardEnabled: typeof r.exitCardEnabled === "boolean" ? r.exitCardEnabled : DEFAULT_SETTINGS.exitCardEnabled,
    suggestionsEnabled:
      typeof r.suggestionsEnabled === "boolean" ? r.suggestionsEnabled : DEFAULT_SETTINGS.suggestionsEnabled,
  };
}

export function parseCounts(raw: unknown): DailyCounts {
  const out: DailyCounts = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [day, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || typeof value !== "object" || value === null) continue;
    const row: Partial<Record<CounterName, number>> = {};
    for (const name of COUNTER_NAMES) {
      const n = (value as Record<string, unknown>)[name];
      if (typeof n === "number" && Number.isInteger(n) && n > 0) row[name] = n;
    }
    if (Object.keys(row).length > 0) out[day] = row;
  }
  return out;
}

/** COUNT_RETENTION_DAYS günden eski günleri atar. */
export function pruneCounts(counts: DailyCounts, now: Date): DailyCounts {
  const limit = new Date(now);
  limit.setDate(limit.getDate() - COUNT_RETENTION_DAYS);
  const oldest = dayKey(limit);
  const out: DailyCounts = {};
  for (const [day, row] of Object.entries(counts)) if (day >= oldest) out[day] = row;
  return out;
}

export class SettingsStore {
  constructor(private readonly storage: KeyValueStorage) {}

  async load(): Promise<Settings> {
    const stored = await this.storage.get([SETTINGS_KEY]);
    return parseSettings(stored[SETTINGS_KEY]);
  }

  async update(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...(await this.load()), ...patch };
    await this.storage.set({ [SETTINGS_KEY]: parseSettings(next) });
    return parseSettings(next);
  }

  async loadCounts(): Promise<DailyCounts> {
    const stored = await this.storage.get([COUNTS_KEY]);
    return parseCounts(stored[COUNTS_KEY]);
  }

  /** Yazmalar sırayla yapılır: aynı anda başlayan artırmalar birbirinin sonucunu ezmesin. */
  private queue: Promise<void> = Promise.resolve();

  /** Bugünün sayacını 1 artırır. Depolama hatası eklentiyi bozmaz: sessizce yutulur. */
  increment(name: CounterName, now: Date = new Date()): Promise<void> {
    return this.incrementMany([name], now);
  }

  /** Birkaç sayacı tek okuma-yazmada artırır. Hata verirse sessizce geçer. */
  incrementMany(names: readonly CounterName[], now: Date = new Date()): Promise<void> {
    if (names.length === 0) return Promise.resolve();
    const run = async () => {
      try {
        const counts = pruneCounts(await this.loadCounts(), now);
        const key = dayKey(now);
        const row = { ...(counts[key] ?? {}) };
        for (const name of names) row[name] = (row[name] ?? 0) + 1;
        counts[key] = row;
        await this.storage.set({ [COUNTS_KEY]: counts });
      } catch {
        /* sayaç tutulamadıysa kullanıcı etkilenmesin */
      }
    };
    this.queue = this.queue.then(run);
    return this.queue;
  }

  /** Tüm ayarları ve sayaçları siler; eklenti varsayılana döner. */
  async clearAll(): Promise<void> {
    await this.storage.remove(STORAGE_KEYS);
  }
}
