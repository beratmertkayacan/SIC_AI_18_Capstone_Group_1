import config from "../data/insights-config.json";
import schema from "../data/counter-schema.json";
import { dayOf, type CountsV2 } from "./counters";

/**
 * Haftalık özet sayfasının sayıları: takvim haftası (Pazartesi ile Pazar) için sayaçlardan
 * (K18) toplanır. Yalnızca sayılar okunur ve sonuç da yalnızca sayılardır; metinler sayfa
 * tarafında bu yapıdan üretilir. Python'daki kafiai.week_report.week_report ile aynı sonucu
 * verir (tests/fixtures/week_report_parity.json).
 *
 * Her sayının kaynağı (sayaç anahtarının biçimi counter-schema.json içinde):
 *   conversations, loops, days, tasks, lengths, platforms  ← conversation|platform|task|len|first_len|dongu/normal
 *   similar_sends, similar_grid                            ← send|platform|slot|task|len|benzer
 *   strips                                                 ← strip|platform|task|gosterildi(_kisa, _tekrar)
 *   strip_actions                                          ← strip_action|platform|...
 *   repairs                                                ← repair_button|platform|task|...
 *   fresh_starts                                           ← card_action|platform|taze_baslat
 *   fresh_followups                                        ← fresh_followup|platform|kova
 *   loop_ends, tasks[].loop_ends, days[].loop_ends         ← loop_end|platform|task|len|toparlandi/yeni_sohbet/birakildi
 *   cards_shown                                            ← card|platform|task|len|gosterildi_*
 *   hints                                                  ← hint|platform|task|...
 *   not_helpful                                            ← strip_action, card_action ve hint içindeki yerinde_degil
 *   strips_by_task                                         ← strip|platform|task|gosterildi (yalnızca benzer mesaj şeridi)
 * Sohbet, bittiği günün sayacına yazılır; bu yüzden hala açık olan sohbetler henüz sayılmaz.
 *
 * `from` (isteğe bağlı, YYYY-MM-DD): kullanıcı "Özeti bugünden başlat" dediyse o günden önceki
 * sayılar ne bu haftaya ne geçen haftaya girer. Sayılar silinmez, yalnızca okunmaz.
 */

export interface WeekReport {
  /** Haftanın Pazartesi ve Pazar günü (YYYY-MM-DD) */
  start: string;
  end: string;
  conversations: number;
  loops: number;
  /** Pazartesiden Pazara, gün başına biten sohbet, döngülü sohbet ve döngü görülüp biten sohbet (loop_end) */
  days: { conversations: number; loops: number; loop_ends: number }[];
  /** Şemadaki görev sırasıyla, hepsi (sıfır olanlar dahil) */
  tasks: { task: string; conversations: number; loops: number; loop_ends: number }[];
  /** Sohbet uzunluğu kovaları (kullanıcı mesajı sayısı) */
  lengths: { len: string; conversations: number }[];
  /** Şemadaki platform sırasıyla, hepsi */
  platforms: { platform: string; conversations: number }[];
  /** Öncekine çok benzeyen gönderilmiş mesajlar (şerit çıksın ya da çıkmasın) */
  similar_sends: number;
  /** similar_sends'in saat dilimi (satır, şemadaki sırayla) ve gün (sütun, Pazartesiden) dağılımı */
  similar_grid: number[][];
  /** Gösterilen şeritler türüne göre: benzer mesaj, kısa düzeltme, kısa devam */
  strips: { benzer: number; kisa: number; tekrar: number };
  /** Şeritlerdeki tepkiler (şeridin türü sayaçta ayrılmaz; üç türün toplamıdır) */
  strip_actions: { yine_de_gonder: number; duzenle: number; yerinde_degil: number; yeni_sohbet: number };
  /** Onarım düğmeleri, şemadaki ayrıntı sırasıyla */
  repairs: Record<string, number>;
  fresh_starts: number;
  /** "Taze başlat" ile açılan ve biten yeni sohbetler, uzunluk kovasına göre */
  fresh_followups: Record<string, number>;
  /**
   * Aynı yerde dönmeye başlayan sohbetler nasıl bitti (loop_end). Kullanıcıya gösterilen tek döngü
   * tanımı budur; yukarıdaki `loops` (sohbet sonunda metinden verilen karar) yalnızca hesapta kalır.
   */
  loop_ends: { toparlandi: number; yeni_sohbet: number; birakildi: number };
  /** Gösterilen çıkış kartları (tüm gosterildi_* türleri) */
  cards_shown: number;
  /** "Yön sende" önerisi: gösterilme ve tepkiler */
  hints: { gosterildi: number; ozetlet: number; adim_yaz: number; yerinde_degil: number; kapat: number };
  /** "Yerinde değildi" denen öneriler, yüzeye göre */
  not_helpful: { strip: number; card: number; hint: number };
  /** Gösterilen benzer mesaj şeritleri, şemadaki görev sırasıyla */
  strips_by_task: Record<string, number>;
  /** Bir önceki takvim haftası, karşılaştırma için */
  previous: { conversations: number; loops: number; strips_benzer: number };
  /** Yüzde ve örüntü söylemeye yetecek kadar sohbet var mı? */
  enough: boolean;
}

const TASKS: string[] = schema.dimensions.task;
const LENS: string[] = schema.dimensions.len;
const PLATFORMS: string[] = schema.dimensions.platform;
const SLOTS: string[] = schema.dimensions.slot;
const REPAIRS: string[] = schema.events.repair_button.details;

const noon = (day: string): Date => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
};

/** Verilen günün içinde bulunduğu haftanın Pazartesisi (yerel saat). */
export function weekStart(date: Date): string {
  const offset = (date.getDay() + 6) % 7; // Pazartesi 0, Pazar 6
  return dayOf(new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset, 12));
}

/** Pazartesiden başlayan haftanın yedi günü. */
export function weekDays(start: string): string[] {
  const s = noon(start);
  return Array.from({ length: 7 }, (_, i) => dayOf(new Date(s.getFullYear(), s.getMonth(), s.getDate() + i, 12)));
}

/** Bu haftadan `back` hafta önceki haftanın Pazartesisi. */
export function shiftWeek(start: string, back: number): string {
  const s = noon(start);
  return dayOf(new Date(s.getFullYear(), s.getMonth(), s.getDate() - 7 * back, 12));
}

const zeros = (keys: string[]): Record<string, number> => Object.fromEntries(keys.map((k) => [k, 0]));

/** `start` Pazartesisiyle başlayan haftanın raporu. */
export function weekReport(counts: CountsV2, start: string, from: string | null = null): WeekReport {
  const days = weekDays(start);
  // "Özeti bugünden başlat" sonrası: başlangıçtan önceki günler okunmaz (tarih dizgileri sıralanabilir).
  const dayIndex = new Map(days.map((d, i) => [d, i] as const).filter(([d]) => from === null || d >= from));
  const perDay = days.map(() => ({ conversations: 0, loops: 0, loop_ends: 0 }));
  const conv = zeros(TASKS);
  const loops = zeros(TASKS);
  const taskEnds = zeros(TASKS);
  const ends = { toparlandi: 0, yeni_sohbet: 0, birakildi: 0 };
  const hints = { gosterildi: 0, ozetlet: 0, adim_yaz: 0, yerinde_degil: 0, kapat: 0 };
  const stripTasks = zeros(TASKS);
  let cards = 0;
  let cardNotHelpful = 0;
  const lens = zeros(LENS);
  const plats = zeros(PLATFORMS);
  const grid = SLOTS.map(() => days.map(() => 0));
  const strips = { benzer: 0, kisa: 0, tekrar: 0 };
  const actions = { yine_de_gonder: 0, duzenle: 0, yerinde_degil: 0, yeni_sohbet: 0 };
  const repairs = zeros(REPAIRS);
  const follow = zeros(LENS);
  let similar = 0;
  let fresh = 0;

  for (const [day, rec] of Object.entries(counts.days)) {
    const di = dayIndex.get(day);
    if (di === undefined) continue;
    for (const [key, n] of Object.entries(rec.c)) {
      const p = key.split("|");
      const event = p[0];
      const detail = p[p.length - 1] ?? "";
      if (event === "conversation") {
        const [platform = "na", task = "na", len = "na"] = p.slice(1, 4);
        const isLoop = detail === "dongu";
        perDay[di]!.conversations += n;
        if (isLoop) perDay[di]!.loops += n;
        if (task in conv) {
          conv[task]! += n;
          if (isLoop) loops[task]! += n;
        }
        if (len in lens) lens[len]! += n;
        if (platform in plats) plats[platform]! += n;
      } else if (event === "send" && detail === "benzer") {
        similar += n;
        const si = SLOTS.indexOf(p[2] ?? "");
        if (si !== -1) grid[si]![di]! += n;
      } else if (event === "strip") {
        if (detail === "gosterildi") {
          strips.benzer += n;
          const task = p[2] ?? "";
          if (task in stripTasks) stripTasks[task]! += n;
        }
        else if (detail === "gosterildi_kisa") strips.kisa += n;
        else if (detail === "gosterildi_tekrar") strips.tekrar += n;
      } else if (event === "strip_action" && detail in actions) {
        actions[detail as keyof typeof actions] += n;
      } else if (event === "repair_button" && detail in repairs) {
        repairs[detail]! += n;
      } else if (event === "card_action" && detail === "taze_baslat") {
        fresh += n;
      } else if (event === "card_action" && detail === "yerinde_degil") {
        cardNotHelpful += n;
      } else if (event === "fresh_followup" && detail in follow) {
        follow[detail]! += n;
      } else if (event === "loop_end" && detail in ends) {
        ends[detail as keyof typeof ends] += n;
        perDay[di]!.loop_ends += n;
        const task = p[2] ?? "";
        if (task in taskEnds) taskEnds[task]! += n;
      } else if (event === "card" && detail.startsWith("gosterildi_")) {
        cards += n;
      } else if (event === "hint" && detail in hints) {
        hints[detail as keyof typeof hints] += n;
      }
    }
  }

  const total = perDay.reduce((s, d) => s + d.conversations, 0);
  return {
    start,
    end: days[6]!,
    conversations: total,
    loops: perDay.reduce((s, d) => s + d.loops, 0),
    days: perDay,
    tasks: TASKS.map((task) => ({ task, conversations: conv[task]!, loops: loops[task]!, loop_ends: taskEnds[task]! })),
    lengths: LENS.map((len) => ({ len, conversations: lens[len]! })),
    platforms: PLATFORMS.map((platform) => ({ platform, conversations: plats[platform]! })),
    similar_sends: similar,
    similar_grid: grid,
    strips,
    strip_actions: actions,
    repairs,
    fresh_starts: fresh,
    fresh_followups: follow,
    loop_ends: ends,
    cards_shown: cards,
    hints,
    not_helpful: { strip: actions.yerinde_degil, card: cardNotHelpful, hint: hints.yerinde_degil },
    strips_by_task: stripTasks,
    previous: previousWeek(counts, shiftWeek(start, 1), from),
    enough: total >= config.min_conversations,
  };
}

function previousWeek(counts: CountsV2, start: string, from: string | null): WeekReport["previous"] {
  const wanted = new Set(weekDays(start).filter((d) => from === null || d >= from));
  const out = { conversations: 0, loops: 0, strips_benzer: 0 };
  for (const [day, rec] of Object.entries(counts.days)) {
    if (!wanted.has(day)) continue;
    for (const [key, n] of Object.entries(rec.c)) {
      if (key.startsWith("conversation|")) {
        out.conversations += n;
        if (key.endsWith("|dongu")) out.loops += n;
      } else if (key.startsWith("strip|") && key.endsWith("|gosterildi")) out.strips_benzer += n;
    }
  }
  return out;
}

/**
 * Bir sayıyı toplamın yüzdesine yuvarlar. Toplam sıfırsa 0. Aynı listedeki yüzdelerin toplamı
 * yuvarlama yüzünden 100'den bir iki puan sapabilir; sayfa her zaman yanına sayının kendisini de yazar.
 */
export const percent = (n: number, total: number): number => (total > 0 ? Math.round((100 * n) / total) : 0);
