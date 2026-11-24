import config from "../data/judge.json";

/**
 * Anlam desteği (K51 taslağı): kullanıcı izin verdiyse, cevap bittiğinde sohbetin son turları
 * arka plan çalışanı üzerinden Kâfi sunucusuna gider; sunucu Claude Haiku'ya sorup bir karar döner
 * (server/api/judge.ts, istem ve şema server/judge-spec.json).
 *
 * Bu dosya saftır: ne zaman sorulacağı, ne gönderileceği ve gelen kararın neye dönüşeceği burada.
 * Ağ isteği yalnızca src/background/judge-client.ts içinde yapılır.
 */

export const JUDGE = config;

/** ek_kart: değerlendirici yeni kart açabilir; onay: kurallardan gelen kartı onaylar ya da bastırır; ikisi: ikisi birden. */
export type JudgeMode = "ek_kart" | "onay" | "ikisi";
export const judgeMode = (): JudgeMode => (JUDGE.mode === "onay" || JUDGE.mode === "ikisi" ? JUDGE.mode : "ek_kart");

/** Kurallardan gelen kart, gösterilmeden önce değerlendiricinin onayını bekler mi? */
export const needsConfirm = (): boolean => judgeMode() !== "ek_kart";

/** Değerlendirici bu turda döngüyü yeterli güvenle onayladı mı? (onay ve ikisi modlarında) */
export const confirmsLoop = (v: JudgeVerdict | null): boolean => v !== null && v.dongu && v.guven >= JUDGE.confirm_threshold;

/** İçerik betiği ile arka plan çalışanı arasındaki mesajın adı ve biçimi (ağ kodu burada yok). */
export const JUDGE_MESSAGE = "kafi-judge" as const;
export interface JudgeRequest {
  type: typeof JUDGE_MESSAGE;
  turlar: JudgeTurn[];
}
export type JudgeReply = { ok: true; data: unknown; ms: number } | { ok: false; hata: string; ms: number };

export interface JudgeTurn {
  rol: "k" | "a";
  metin: string;
}

export type JudgeKind = "ayni_istek_yeniden" | "karsilanmayan_engel" | "ozur_dongusu" | "konu_kaymasi" | "yok";
export interface JudgeVerdict {
  ayniIstek: boolean;
  /** Son mesajdan önceki cevap o anki isteği karşıladı mı (aynı istek kartının metni buna göre değişir) */
  karsiladi: "evet" | "hayir" | "belirsiz";
  tikanma: boolean;
  tur: JudgeKind;
  dongu: boolean;
  guven: number;
  gerekce: string;
  oneri: string;
}

export interface GateState {
  /** Ayarlarda anlam desteği açık mı (kullanıcının açık izni) */
  consent: boolean;
  /** Sunucu adresi yapılandırılmış mı */
  configured: boolean;
  personal: boolean;
  /** Oturumdaki kullanıcı mesajı sayısı */
  turns: number;
  /** En son hangi tur için soruldu (-1: hiç) */
  lastAskedTurn: number;
}

/** Bu cevap bittiğinde sunucuya sorulsun mu? Her kullanıcı turu için en fazla bir kez. */
export function shouldAsk(s: GateState): boolean {
  return s.consent && s.configured && !s.personal && s.turns >= JUDGE.min_turn && s.turns > s.lastAskedTurn;
}

/**
 * Gönderilecek turlar: kullanıcı mesajları ve her birine gelen cevabın bellekteki başı ve sonu
 * (adapter.lastResponse, ilk 600 + son 200 karakter). Cevabı okunamamış turlarda yalnızca mesaj gider.
 * Sunucu da aynı sınırları yeniden uygular; burada kesmek yalnızca gereksiz veri göndermemek için.
 */
export function buildJudgeTurns(userTexts: readonly string[], answers: readonly (string | null)[]): JudgeTurn[] {
  const turns: JudgeTurn[] = [];
  userTexts.forEach((text, i) => {
    turns.push({ rol: "k", metin: text.slice(0, JUDGE.user_chars) });
    const a = answers[i];
    if (a) turns.push({ rol: "a", metin: a });
  });
  return turns.slice(-JUDGE.max_turns);
}

const KINDS: readonly JudgeKind[] = ["ayni_istek_yeniden", "karsilanmayan_engel", "ozur_dongusu", "konu_kaymasi", "yok"];

/** Ağdan gelen cevaba güvenilmez: beklenen biçimde değilse null. */
export function parseVerdict(raw: unknown): JudgeVerdict | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = (raw as { sonuc?: unknown }).sonuc;
  if (typeof s !== "object" || s === null) return null;
  const r = s as Record<string, unknown>;
  if (typeof r.dongu !== "boolean" || typeof r.guven !== "number" || !Number.isFinite(r.guven)) return null;
  const tur = KINDS.includes(r.tur as JudgeKind) ? (r.tur as JudgeKind) : "yok";
  const text = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  return {
    ayniIstek: r.ayni_istek === true,
    karsiladi: r.onceki_cevap_karsiladi === "evet" || r.onceki_cevap_karsiladi === "hayir" ? r.onceki_cevap_karsiladi : "belirsiz",
    tikanma: r.tikanma === true,
    tur,
    dongu: r.dongu,
    guven: Math.min(1, Math.max(0, r.guven)),
    gerekce: r.dongu ? text(r.gerekce, 140) : "",
    oneri: r.dongu ? text(r.oneri, 160) : "",
  };
}

export interface JudgeAction {
  /** Çıkış kartı "anlam" kaynağıyla açılabilir */
  card: boolean;
  /** Halkanın anlam desteğinden gelen seviyesi */
  ring: 0 | 1 | 2;
  /** Son mesaj, 3-gram'ın kaçırmış olabileceği bir yeniden yazım: benzer mesaj sayacına eklenir */
  sameRequest: boolean;
  /**
   * Aynı istek kartı: son mesaj daha önce sorulmuş bir isteğin yeniden sorulması, ama henüz döngü değil.
   * Cevaptan sonra "Bunu az önce de sormuştun" kartı çıkar (ikinci soruşta). Önceki cevap karşıladıysa
   * "cevaplanmis", karşılamadıysa ya da belli değilse "karsilanmamis". Döngü kartı varsa null.
   */
  repeat: "cevaplanmis" | "karsilanmamis" | null;
}

/** Kararın ürüne etkisi. Döngü yoksa hiçbir şey değişmez; eşikler src/data/judge.json'da. */
export function judgeAction(v: JudgeVerdict | null): JudgeAction {
  if (!v) return { card: false, ring: 0, sameRequest: false, repeat: null };
  const card = judgeMode() !== "onay" && v.dongu && v.guven >= JUDGE.card_threshold && v.gerekce !== "" && v.oneri !== "";
  const ring = card || (v.dongu && v.guven >= JUDGE.card_threshold) ? 2 : v.dongu && v.guven >= JUDGE.ring_threshold ? 1 : 0;
  // Yeniden yazım sayacı yalnızca karşılanmamış bir isteğin yeniden sorulmasında; doğru cevaptan sonra
  // aynı soruyu başka dilde sormak döngü değildir (açık prova P1a).
  const sameRequest = v.ayniIstek && v.tur === "ayni_istek_yeniden";
  // Aynı istek kartı döngü kartının yerini almaz; onay modunda (yeni kart açılmaz) çıkmaz.
  const repeat = !card && judgeMode() !== "onay" && v.ayniIstek ? (v.karsiladi === "evet" ? "cevaplanmis" : "karsilanmamis") : null;
  return { card, ring, sameRequest, repeat };
}
