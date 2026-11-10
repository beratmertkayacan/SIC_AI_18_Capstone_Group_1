import type { TaskType } from "./tasks";

/**
 * Araç çubuğu penceresi ile sekmedeki içerik betiği arasındaki mesajlar. Yalnızca eklentinin
 * kendi parçaları arasında, tarayıcının içinde gider (ağ değil). Mesaj metni hiçbir zaman
 * bu mesajlara girmez: içerik betiği yalnızca sayıları ve sabit sözcükleri gönderir.
 */

export const MSG_THIS_CONVERSATION = "kafiai.this_conversation";
export const MSG_OPEN_CARD = "kafiai.open_card";

export type PopupMessage = { type: typeof MSG_THIS_CONVERSATION } | { type: typeof MSG_OPEN_CARD };

export interface ConversationSnapshot {
  platform: string;
  /** Eklenti açık mı? */
  active: boolean;
  /** Öneriler açık mı ("yalnızca say" değil)? */
  suggesting: boolean;
  /** Bu platformda öneri gösterilebiliyor mu (platform kaydı)? */
  intervening: boolean;
  /** Sohbet kişisel ya da duygusal görünüyor mu? Öyleyse öneri gösterilmez. */
  personal: boolean;
  /** Bu sohbetteki kullanıcı mesajı sayısı */
  turns: number;
  task: TaskType | null;
  /** Öncekine çok benzeyen mesaj sayısı (sohbet boyu) */
  similar: number;
  /** Son dört mesajdan öncekine çok benzeyenler (çıkışta ve konu değişince sıfırlanır, K32) */
  recent_similar: number;
  /** Üst üste özürle başlayan cevap sayısı */
  apology_streak: number;
  /** Üst üste kısa ve açıklamasız düzeltme isteği */
  vague_streak: number;
  /** Sohbetteki konu bölümü sayısı (1 = tek konu) */
  segments: number;
  /** Son mesaj "teşekkürler, oldu" gibi bir çıkış mesajı mıydı? */
  exited: boolean;
  /** Bu görev türünde sohbetlerin genelde bittiği tur sayıları */
  norm: { median: number; p75: number } | null;
  /** "Yeni sohbete geç" kartı şu an açılabilir mi? */
  card_available: boolean;
}

/** Penceredeki sohbet özetinde bulunabilecek alanların tam listesi (gizlilik testi bunu denetler). */
export const SNAPSHOT_KEYS: (keyof ConversationSnapshot)[] = [
  "platform",
  "active",
  "suggesting",
  "intervening",
  "personal",
  "turns",
  "task",
  "similar",
  "recent_similar",
  "apology_streak",
  "vague_streak",
  "segments",
  "exited",
  "norm",
  "card_available",
];

export function isPopupMessage(m: unknown): m is PopupMessage {
  const t = (m as { type?: unknown } | null)?.type;
  return t === MSG_THIS_CONVERSATION || t === MSG_OPEN_CARD;
}
