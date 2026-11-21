import config from "../data/insights-config.json";
import taskRules from "../data/task-rules.json";
import { BRAND_NAME } from "../brand";
import { percent, type WeekReport } from "../core/week-report";
import { numberIn } from "../popup/insight-text";

/**
 * Haftalık özet sayfasının cümleleri. Her cümle WeekReport'taki bir sayıdan gelir; sayacı olmayan
 * bir şey söylenmez ("sonuca ulaştı" gibi ölçemediğimiz sözler yok). Dil yargılamaz.
 */

const LABELS = taskRules.labels as Record<string, string>;
const TIPS = config.tips as Record<string, string>;

export const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const DAY_SHORT = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
export const DAY_LONG = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
export const SLOT_NAMES: Record<string, { name: string; hours: string }> = {
  "00-06": { name: "Gece", hours: "00.00–06.00" },
  "06-12": { name: "Sabah", hours: "06.00–12.00" },
  "12-18": { name: "Öğleden sonra", hours: "12.00–18.00" },
  "18-24": { name: "Akşam", hours: "18.00–24.00" },
};
export const LEN_NAMES: Record<string, string> = { "1-3": "1–3 mesaj", "4-6": "4–6 mesaj", "7-10": "7–10 mesaj", "11+": "11 ve üstü" };
export const PLATFORM_NAMES = config.platform_labels as Record<string, string>;
/** Platform adının belirtme hali: "ChatGPT'yi", "Claude'u" (okunuşa göre). */
const PLATFORM_ACC: Record<string, string> = {
  chatgpt: "ChatGPT'yi",
  gemini: "Gemini'yi",
  claude: "Claude'u",
  copilot: "Copilot'u",
  google_ai_mode: "Google AI Modu'nu",
};

/** Görev türlerinin ekrandaki sırası ve kısa örnekleri. */
export const TASK_ROWS: { task: string; examples: string }[] = [
  { task: "kod", examples: "Python, SQL, hata mesajları" },
  { task: "soru", examples: "nedir, nasıl, neden; soru çözme" },
  { task: "yazma", examples: "e-posta, CV, ödev metni" },
  { task: "ceviri", examples: "diller arası çeviri" },
  { task: "ozet", examples: "makale ve not özetleri" },
  { task: "diger", examples: `${BRAND_NAME} her sohbetin konusunu ayıramıyor` },
];
export const taskName = (task: string) => LABELS[task] ?? LABELS["diger"] ?? "Diğer";

/** Takılıp kalınan sohbetin görev türüne göre cümle parçası ("kod yazarken"). */
const TASK_WHILE: Record<string, string> = {
  kod: "kod yazarken",
  soru: "bir şey sorarken",
  yazma: "metin yazdırırken",
  ceviri: "çeviri yaptırırken",
  ozet: "özetletirken",
};

// Okunuşun son kelimesi: ekin ünlüsü ve ünsüzü buna göre seçilir.
const UNITS = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
function spoken(n: number): string {
  if (n === 0) return "sıfır";
  if (n % 10 !== 0) return UNITS[n % 10] ?? "";
  if (n % 100 !== 0) return TENS[(n % 100) / 10] ?? "";
  return n % 1000 !== 0 ? "yüz" : "bin";
}

/** "24'tü", "20'ydi", "30'du": sayıya geçmiş zaman eki. */
export function numberWas(n: number): string {
  const word = spoken(n);
  const vowels = word.match(/[aeıioöuü]/g) ?? ["e"];
  const last = vowels[vowels.length - 1] ?? "e";
  const v = ({ a: "ı", ı: "ı", e: "i", i: "i", o: "u", u: "u", ö: "ü", ü: "ü" } as Record<string, string>)[last] ?? "i";
  if (/[aeıioöuü]$/.test(word)) return `${n}'yd${v}`;
  return `${n}'${/[çfhkpsşt]$/.test(word) ? "t" : "d"}${v}`;
}

/** "Bunların 2'si", "34'ün 5'i": sayıya iyelik eki. */
export function numberOf(n: number): string {
  const word = spoken(n);
  const vowels = word.match(/[aeıioöuü]/g) ?? ["e"];
  const last = vowels[vowels.length - 1] ?? "e";
  const v = ({ a: "ı", ı: "ı", e: "i", i: "i", o: "u", u: "u", ö: "ü", ü: "ü" } as Record<string, string>)[last] ?? "i";
  return `${n}'${/[aeıioöuü]$/.test(word) ? "s" : ""}${v}`;
}

/** "16–22 Kasım 2026", "27 Ekim – 2 Kasım 2026", yıl geçişinde iki yıl da yazılır. */
export function weekLabel(start: string, end: string): string {
  const [y1, m1, d1] = start.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = end.split("-").map(Number) as [number, number, number];
  if (y1 !== y2) return `${d1} ${MONTHS[m1 - 1]} ${y1} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  return `${d1}–${d2} ${MONTHS[m2 - 1]} ${y2}`;
}

export const loopShare = (r: Pick<WeekReport, "loops" | "conversations">) => percent(r.loops, r.conversations);

/** Genel Görünüm'ün altındaki cümle. comparable false ise (en eski hafta) geçen haftaya değinmez. */
export function headline(r: WeekReport, comparable = true): string {
  if (r.loops === 0) return "Bu hafta hiçbir sohbette aynı isteği tekrar tekrar yazman gerekmedi.";
  const now = `Bu hafta sohbetlerinin %${numberIn(loopShare(r))} takılıp kaldın`;
  if (!comparable || r.previous.conversations < config.min_conversations) return `${now}.`;
  return `${now}; geçen hafta bu oran %${numberWas(percent(r.previous.loops, r.previous.conversations))}.`;
}

export function previousLoopLine(r: WeekReport): string {
  if (r.previous.conversations < config.min_conversations) return "Geçen hafta karşılaştırma için az sohbet vardı";
  return `Geçen hafta %${numberWas(percent(r.previous.loops, r.previous.conversations))}`;
}

export function freshFootLine(r: WeekReport): string {
  const total = Object.values(r.fresh_followups).reduce((a, b) => a + b, 0);
  if (total === 0) return r.fresh_starts > 0 ? "Yeni sohbetler bitince burada görünür" : "Bu hafta kullanılmadı";
  const short = r.fresh_followups[config.short_followup_bucket] ?? 0;
  return `Biten ${total} yeni sohbetin ${numberOf(short)} 3 mesaj içinde bitti`;
}

/** Bir görev satırının sağ alt cümlesi: "5 sohbet · 2'sinde takıldın". */
export function taskMeta(conversations: number, loops: number): string {
  if (conversations === 0) return "0 sohbet";
  return loops > 0 ? `${conversations} sohbet · ${numberIn(loops)} takıldın` : `${conversations} sohbet`;
}

/** Ne Zaman: benzer mesajların en yoğun olduğu saat dilimi; az veriyle bir şey söylenmez. */
export function slotLine(r: WeekReport, slots: string[]): string {
  if (r.similar_sends === 0) return "Bu hafta öncekine çok benzeyen bir mesaj göndermedin.";
  if (r.similar_sends < config.min_pattern_loops) return "Bir örüntüden söz etmek için bu hafta benzer mesaj az.";
  const sums = r.similar_grid.map((row) => row.reduce((a, b) => a + b, 0));
  let best = 0;
  sums.forEach((n, i) => {
    if (n > (sums[best] ?? 0)) best = i;
  });
  const slot = SLOT_NAMES[slots[best] ?? ""];
  if (!slot) return "";
  return `Benzer mesajlarının %${numberOf(percent(sums[best] ?? 0, r.similar_sends))} ${slot.name.toLocaleLowerCase("tr")} (${slot.hours}) geldi.`;
}

/** Sohbet süresi: en kalabalık kova. */
export function lengthLine(r: WeekReport): string {
  if (r.conversations === 0) return "";
  const top = [...r.lengths].sort((a, b) => b.conversations - a.conversations)[0]!;
  const name = LEN_NAMES[top.len] ?? top.len;
  return `Sohbetlerinin %${numberOf(percent(top.conversations, r.conversations))} ${top.len === "11+" ? "11 ya da daha fazla mesaj sürdü" : `${name}da bitti`}.`;
}

export function platformLine(r: WeekReport): string {
  const top = [...r.platforms].sort((a, b) => b.conversations - a.conversations)[0];
  if (!top || top.conversations === 0) return "";
  const tied = r.platforms.filter((p) => p.conversations === top.conversations).length > 1;
  return tied ? "Birden çok aracı aynı sıklıkta kullandın." : `En çok ${PLATFORM_ACC[top.platform] ?? top.platform} kullandın.`;
}

/** İstersen bir dahaki sefere: en çok takılınan görev türünün ipucu. Takılma yoksa null. */
export function nextTimeTip(r: WeekReport): { tip: string; because: string | null } | null {
  // Eşitlikte bilinen bir tür "Diğer"in önüne geçer: ipucu daha somut olur.
  const top = [...r.tasks].sort((a, b) => b.loops - a.loops || Number(a.task === "diger") - Number(b.task === "diger") || b.conversations - a.conversations)[0];
  if (!top || top.loops === 0) return null;
  const tip = TIPS[top.task] ?? TIPS["diger"] ?? "";
  const phrase = TASK_WHILE[top.task];
  const because = phrase ? `Bu hafta takılıp kaldığın sohbetlerin ${numberOf(top.loops)} ${phrase} oldu.` : null;
  return { tip, because };
}

/** Taze başlat sonrası: "Yeni açtığın sohbetlerin 2'si 3 mesaj içinde bitti." */
export function followupLine(r: WeekReport): string | null {
  const total = Object.values(r.fresh_followups).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const short = r.fresh_followups[config.short_followup_bucket] ?? 0;
  return short === 0
    ? `Yeni açtığın ${total} sohbetin hiçbiri 3 mesaj içinde bitmedi.`
    : `Yeni açtığın sohbetlerin ${numberOf(short)} 3 mesaj içinde bitti.`;
}
