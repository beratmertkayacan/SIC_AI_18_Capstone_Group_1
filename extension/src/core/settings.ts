import schema from "../data/counter-schema.json";
import { COUNTS_V1_KEY, COUNTS_V2_KEY } from "./counters";

/**
 * Ayarlar. Buraya YALNIZCA ayar anahtarları yazılır; mesaj metni, sohbet adresi ya da sohbet
 * kimliği asla yazılmaz. Sayaçlar src/core/counters.ts içinde (sayaç şeması v2, K18).
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
  /** Mesaj kutusunun kenarındaki halka gösterilsin mi? (K29) Öneriler kapalıyken zaten gösterilmez. */
  ringEnabled: boolean;
  /** Araç çubuğu penceresinde "Bu hafta" özeti gösterilsin mi? Kapalıyken de sayılar tutulur. */
  habitsEnabled: boolean;
  /**
   * Haftalık özetteki "İstersen…" önerilerinden susturulanlar: öneri kimliği → susturulduğu haftanın
   * Pazartesisi ve kaç hafta susacağı. "Yerinde değildi" 4 hafta, "Kapat" yalnızca o hafta (1).
   * Kimlikler koddaki sabit listeden (TIP_IDS); metin yazılmaz.
   */
  mutedTips: Record<string, MutedTip>;
  /** "Özeti bugünden başlat" denen gün (YYYY-MM-DD); özet bu günden önceki sayıları okumaz. Yoksa null. */
  habitsFrom: string | null;
}

export interface MutedTip {
  since: string;
  weeks: number;
}

/** Haftalık özetin önerebileceği önerilerin kimlikleri (habits-text.ts içindeki pickTip ile aynı liste). */
export const TIP_IDS: string[] = [
  "kart_kapat",
  "taze_baslat",
  "kisa_duzeltme",
  "yon_sende",
  ...schema.dimensions.task.map((t) => `gorev_${t}`),
];
/** Susturmanın geçerli süreleri (hafta): "Kapat" 1, "Yerinde değildi" 4. */
export const MUTE_WEEKS = { kapat: 1, yerinde_degil: 4 } as const;

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  exitCardEnabled: true,
  suggestionsEnabled: true,
  ringEnabled: true,
  habitsEnabled: true,
  mutedTips: {},
  habitsFrom: null,
};

/** chrome.storage.local ile uyumlu en küçük arayüz (testte bellekteki sahtesi kullanılır). */
export interface KeyValueStorage {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export const SETTINGS_KEY = "kafiai.settings";
/** "Taze başlat" sonrası açılan yeni sohbeti tanımak için: yalnızca platform kimliği ve son geçerlilik zamanı. */
export const PENDING_FRESH_KEY = "kafiai.pending_fresh";
/** Depoda bulunabilecek anahtarların tamamı (gizlilik testi bu listeyi kullanır). */
export const STORAGE_KEYS = [SETTINGS_KEY, COUNTS_V2_KEY, COUNTS_V1_KEY, PENDING_FRESH_KEY];

/** Gerçek bir takvim günü mü? (YYYY-MM-DD; "2026-02-30" gibi olmayan günler reddedilir.) */
function isDay(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Susturma listesinden yalnızca bilinen kimlikler ve geçerli değerler kalır; gerisi atılır. */
function parseMuted(raw: unknown): Record<string, MutedTip> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const allowed: number[] = Object.values(MUTE_WEEKS);
  const out: Record<string, MutedTip> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!TIP_IDS.includes(id) || typeof v !== "object" || v === null) continue;
    const { since, weeks } = v as Record<string, unknown>;
    if (isDay(since) && typeof weeks === "number" && allowed.includes(weeks)) out[id] = { since, weeks };
  }
  return out;
}

/** Depodan gelen her şeye güvenilmez: bilinmeyen alanlar atılır, bozuk değerler varsayılana döner. */
export function parseSettings(raw: unknown): Settings {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULT_SETTINGS.enabled,
    exitCardEnabled: typeof r.exitCardEnabled === "boolean" ? r.exitCardEnabled : DEFAULT_SETTINGS.exitCardEnabled,
    suggestionsEnabled:
      typeof r.suggestionsEnabled === "boolean" ? r.suggestionsEnabled : DEFAULT_SETTINGS.suggestionsEnabled,
    ringEnabled: typeof r.ringEnabled === "boolean" ? r.ringEnabled : DEFAULT_SETTINGS.ringEnabled,
    habitsEnabled: typeof r.habitsEnabled === "boolean" ? r.habitsEnabled : DEFAULT_SETTINGS.habitsEnabled,
    mutedTips: parseMuted(r.mutedTips),
    habitsFrom: isDay(r.habitsFrom) ? r.habitsFrom : DEFAULT_SETTINGS.habitsFrom,
  };
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

  /** Tüm ayarları ve sayaçları siler; eklenti varsayılana döner. */
  async clearAll(): Promise<void> {
    await this.storage.remove(STORAGE_KEYS);
  }
}
