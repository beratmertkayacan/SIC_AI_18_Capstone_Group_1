import { BRAND_NAME } from "../brand";
import config from "../data/insights-config.json";
import schema from "../data/counter-schema.json";
import { MUTE_WEEKS, type MutedTip, type Settings } from "../core/settings";
import { shiftWeek, type WeekReport } from "../core/week-report";
import { numberIn } from "./insight-text";

/**
 * "Bu hafta" özetinin cümleleri ve tek "İstersen…" önerisi. Araç çubuğu penceresi ve haftalık özet
 * sayfası aynı fonksiyonları kullanır; iki yüzey aynı haftada farklı bir şey söylemesin diye.
 *
 * İlke: her cümle tek bir sayaçtan gelir, yalnızca sayı ve sabit sözcük içerir. Yüzde, yön ("daha
 * az", "daha çok"), puan ya da seri yok. Kullanıcıya gösterilen tek döngü tanımı loop_end'dir
 * ("aynı yerde dönmeye başladın"); sohbet sonundaki `dongu` kararı burada hiç kullanılmaz.
 */

const MIN = config.min_conversations; // 5: öneri ve ayrıntı için gereken en az sohbet
const MIN_DETAIL = config.min_pattern_loops; // 3: "takılınca nasıl bitti" ayrıntısı için

export interface HabitRow {
  label: string;
  n: number;
  /** Nötr ama vurgusuz satır ("Sohbetten çıktın"): ara mı verdin, vazgeçtin mi ayıramıyoruz. */
  quiet: boolean;
}

export interface HabitSummary {
  state: "bos" | "az" | "dolu";
  /** Satır 1: "Bu hafta 14 sohbet bitti." (boş haftada boş hafta cümlesi) */
  total: string;
  /** Boş ya da az veri haftasının açıklaması; dolu haftada null. */
  note: string | null;
  /** Satır 2: takılınca nasıl bitti. Hiç döngü yoksa ya da az veride null. */
  loops: { intro: string; rows: HabitRow[] } | null;
  /** Satır 3: kullanıcının kendi hamleleri; hepsi sıfırsa null. */
  moves: string | null;
  /** Satır 4: Kâfi'nin bu hafta kaç kez araya girdiği (şeffaflık). Boş haftada null. */
  kafi: string | null;
  /** Satır 5: geçen haftanın düz sayısı; geçen hafta 5'ten az sohbet varsa null. */
  previous: string | null;
}

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

/** Satır 4: gösterilen şerit, kart ve "Yön sende" önerileri ile "yerinde değildi" tepkileri. */
function kafiLine(r: WeekReport): string {
  const shown = r.strips.benzer + r.strips.kisa + r.strips.tekrar + r.cards_shown + r.hints.gosterildi;
  if (shown === 0) return `${BRAND_NAME} araya girmedi.`;
  const notHelpful = sum(r.not_helpful);
  const base = `${BRAND_NAME} ${shown} kez araya girdi`;
  return notHelpful > 0 ? `${base}; ${numberIn(notHelpful)} “yerinde değildi” dedin.` : `${base}.`;
}

/** Satır 3: sıfır olan parça cümleye girmez. */
function movesLine(r: WeekReport): string | null {
  const repairs = sum(r.repairs);
  const parts = [
    repairs > 0 ? `${repairs} kez eksik olanı bir cümleyle ekledin` : null,
    r.strip_actions.duzenle > 0 ? `${r.strip_actions.duzenle} kez mesajını düzenledin` : null,
    r.hints.adim_yaz > 0 ? `${r.hints.adim_yaz} kez bir sonraki adımı kendin yazdın` : null,
    r.hints.ozetlet > 0 ? `${r.hints.ozetlet} kez modelden şu ana kadar anladığını özetlemesini istedin` : null,
    r.fresh_starts > 0 ? `${r.fresh_starts} kez Taze başlat'ı kullandın` : null,
  ].filter((x): x is string => x !== null);
  return parts.length > 0 ? `${parts.join(", ")}.` : null;
}

/** Satır 2: loop_end'in üç sonucu; "Sohbetten çıktın" en sonda ve vurgusuz. */
function loopsBlock(r: WeekReport): HabitSummary["loops"] {
  const e = r.loop_ends;
  const total = e.toparlandi + e.yeni_sohbet + e.birakildi;
  if (total === 0) return null;
  const intro = `${total} sohbette aynı yerde dönmeye başladın.`;
  if (total < MIN_DETAIL) return { intro, rows: [] };
  const rows: HabitRow[] = [
    { label: "Aynı sohbette yolunu buldun", n: e.toparlandi, quiet: false },
    { label: "Yeni sohbete geçtin", n: e.yeni_sohbet, quiet: false },
    { label: "Sohbetten çıktın", n: e.birakildi, quiet: true },
  ];
  return { intro, rows: rows.filter((x) => x.n > 0) };
}

/**
 * Haftanın özeti. Cümleler "Bu hafta" demez: iki yüzeyde de başlık zaten haftayı ve tarih aralığını söyler.
 * comparable false ise (saklama süresinin en eski haftası ya da dar pencere) geçen haftaya değinilmez.
 * restartedToday: "Özeti bugünden başlat" bugün dendiyse boş hafta cümlesi bunu söyler.
 */
export function habitSummary(r: WeekReport, opts: { comparable?: boolean; restartedToday?: boolean } = {}): HabitSummary {
  const comparable = opts.comparable ?? true;
  if (r.conversations === 0) {
    return {
      state: "bos",
      total: opts.restartedToday ? "Özet bugün yeniden başladı." : "Henüz biten bir sohbet yok.",
      note: "Bir sohbeti bitirdiğinde ya da sekmeyi kapattığında burada görünür.",
      loops: null,
      moves: null,
      kafi: null,
      previous: null,
    };
  }
  const total = `${r.conversations} sohbet bitti.`;
  const previous = comparable && r.previous.conversations >= MIN ? `Geçen hafta ${r.previous.conversations} sohbet bitmişti.` : null;
  if (!r.enough) {
    return { state: "az", total, note: `Bir şey önermek için en az ${MIN} sohbet gerekiyor.`, loops: null, moves: null, kafi: kafiLine(r), previous: null };
  }
  return { state: "dolu", total, note: null, loops: loopsBlock(r), moves: movesLine(r), kafi: kafiLine(r), previous };
}

// ---------------------------------------------------------------------------
// Tek "İstersen…" önerisi
// ---------------------------------------------------------------------------

export interface Tip {
  id: string;
  text: string;
  /** Öneri Ayarlar'daki bir anahtarı gösteriyor mu? (Pencerede "Ayarlar'a git" bağlantısı çıkar.) */
  settingsLink: boolean;
}

/** Öncelik tablosundaki eşikler (taslak 4.2). Şerit, kart ya da halka eşiklerini DEĞİŞTİRMEZ; yalnızca öneri seçer. */
export const TIP_MIN = { kart_kapat: 2, taze_baslat: 2, kisa_duzeltme: 3, yon_sende: 2, gorev: 3 } as const;

const TIP_TEXT: Record<string, string> = {
  kart_kapat: "İstersen yeni sohbet önerisini Ayarlar'dan kapatabilirsin; sayılar yine tutulur.",
  taze_baslat: "İstersen kart bir dahaki sefere çıktığında Taze başlat'ı dene; isteklerini tek bir taslakta toplar, hatırlattığın kuralları en başa koyar.",
  kisa_duzeltme: "İstersen “olmadı” yazarken neyin olmadığını da bir cümleyle ekle; model neyi düzelteceğini daha kolay anlar.",
  yon_sende: "İstersen modelin teklif sorusuna “evet” demek yerine bir sonraki adımı kendin yaz.",
};
const TASK_TIPS = config.tips as Record<string, string>;
const TASKS: string[] = schema.dimensions.task;

/** Bu öneri bu hafta susturulmuş mu? since ≤ hafta < since + weeks hafta. */
const isMuted = (m: MutedTip | undefined, week: string): boolean =>
  m !== undefined && m.since <= week && week < shiftWeek(m.since, -m.weeks);

/**
 * Haftanın tek önerisi ya da null. YALNIZCA araya girme sayaçlarından seçer (şerit, kart, "Yön sende"
 * gösterimleri ve tepkileri, benzer mesaj şeridinin görev boyutu). Bu sayaçlar kişisel sohbette ve
 * "yalnızca say" modunda hiç yazılmaz; böylece kişisel bir sohbet öneri üretemez. conversation,
 * loop_end ve signal kişisel sohbette de yazıldığı için burada BİLEREK okunmaz.
 */
export function pickTip(r: WeekReport, settings: Settings, weekStart: string): Tip | null {
  if (!settings.enabled || !settings.suggestionsEnabled || !settings.habitsEnabled) return null;
  if (!r.enough) return null;
  const muted = Object.values(settings.mutedTips);
  // Bu hafta bir öneri kapatıldıysa ya da "yerinde değildi" dendiyse yerine başka öneri gelmez.
  if (muted.some((m) => m.since === weekStart)) return null;

  const candidates: { id: string; when: boolean }[] = [
    { id: "kart_kapat", when: settings.exitCardEnabled && r.not_helpful.card >= TIP_MIN.kart_kapat },
    { id: "taze_baslat", when: settings.exitCardEnabled && r.cards_shown >= TIP_MIN.taze_baslat && r.fresh_starts === 0 },
    { id: "kisa_duzeltme", when: r.strips.kisa >= TIP_MIN.kisa_duzeltme },
    { id: "yon_sende", when: r.hints.gosterildi >= TIP_MIN.yon_sende && r.hints.adim_yaz + r.hints.ozetlet === 0 },
  ];
  // 5. sıra: benzer mesaj şeridinin en çok çıktığı görev; eşitlikte bilinen tür "Diğer"in önüne geçer.
  const top = [...TASKS].sort((a, b) =>
    (r.strips_by_task[b] ?? 0) - (r.strips_by_task[a] ?? 0) || Number(a === "diger") - Number(b === "diger"))[0];
  if (top) candidates.push({ id: `gorev_${top}`, when: (r.strips_by_task[top] ?? 0) >= TIP_MIN.gorev });

  for (const c of candidates) {
    if (!c.when || isMuted(settings.mutedTips[c.id], weekStart)) continue;
    const text = c.id.startsWith("gorev_") ? TASK_TIPS[c.id.slice(6)] ?? TASK_TIPS["diger"] ?? "" : TIP_TEXT[c.id] ?? "";
    return { id: c.id, text, settingsLink: c.id === "kart_kapat" };
  }
  return null;
}

/**
 * Bir öneriyi susturur: "yerinde_degil" 4 hafta, "kapat" yalnızca bu hafta. Süresi geçmiş kayıtlar
 * bu sırada atılır; liste büyümez. Dönen değer Settings.mutedTips olarak kaydedilir.
 */
export function muteTip(mutedTips: Settings["mutedTips"], id: string, weekStart: string, kind: keyof typeof MUTE_WEEKS): Settings["mutedTips"] {
  const kept = Object.fromEntries(Object.entries(mutedTips).filter(([, m]) => weekStart < shiftWeek(m.since, -m.weeks)));
  return { ...kept, [id]: { since: weekStart, weeks: MUTE_WEEKS[kind] } };
}
