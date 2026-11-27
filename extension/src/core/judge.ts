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

const CONFIRM_SOURCES: readonly string[] = JUDGE.confirm_sources;

/**
 * Bu kaynaktan gelen kart, gösterilmeden önce değerlendiricinin onayını bekler mi? Yalnızca confirm_sources
 * listesindeki kaynaklar (bugün yalnızca tur modeli: WildFeedback'te en düşük isabetli kart kaynağı) bekler.
 */
export const needsConfirm = (source: string): boolean => judgeMode() !== "ek_kart" && CONFIRM_SOURCES.includes(source);

/**
 * Değerlendirici kartı onayladı mı? confirm_rule "isaret": döngü, tıkanma ya da "önceki cevap karşılamadı"
 * belirtilerinden biri yeterli; "guven": yalnızca confirm_threshold güvenle döngü (eski kural).
 */
export const confirmsLoop = (v: JudgeVerdict | null): boolean => {
  if (v === null) return false;
  if (JUDGE.confirm_rule === "isaret") return v.dongu || v.tikanma || v.karsiladi === "hayir";
  return v.dongu && v.guven >= JUDGE.confirm_threshold;
};

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
  /** Asistan üst üste özür dileyip aynı hatayı mı tekrarlıyor */
  ozurDongusu: boolean;
  /** Son mesajdan önceki cevap o anki isteği karşıladı mı (aynı istek kartının metni buna göre değişir) */
  karsiladi: "evet" | "hayir" | "belirsiz";
  /** Aynı isteğin sorulduğu tur (gönderilen listede, 1 tabanlı); yoksa -1 */
  oncekiTur: number;
  /** Son asistan cevabı önceki cevaplarda olmayan, istenen yeni bir bilgi verdi mi */
  sonCevapYeniBilgi: boolean;
  /** Kullanıcı farklı sözcüklerle ya da farklı görünen bir soruyla aynı bilgiye mi döndü */
  ayniBilgiyeDonus: boolean;
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
    ozurDongusu: r.ozur_dongusu === true,
    karsiladi: r.onceki_cevap_karsiladi === "evet" || r.onceki_cevap_karsiladi === "hayir" ? r.onceki_cevap_karsiladi : "belirsiz",
    oncekiTur: typeof r.onceki_istek_turu === "number" && Number.isInteger(r.onceki_istek_turu) ? r.onceki_istek_turu : -1,
    sonCevapYeniBilgi: r.son_cevap_yeni_bilgi === true,
    ayniBilgiyeDonus: r.ayni_bilgiye_donus === true,
    tikanma: r.tikanma === true,
    tur,
    dongu: r.dongu,
    guven: Math.min(1, Math.max(0, r.guven)),
    gerekce: r.dongu ? text(r.gerekce, 140) : "",
    oneri: r.dongu ? text(r.oneri, 160) : "",
  };
}

export interface JudgeAction {
  /** Değerlendiricinin kendi gerekçesiyle açtığı döngü kartı (loop_card açıksa) */
  card: boolean;
  /**
   * Anlam onarımı: son mesaj onarım kelimesi taşıyan ama kısa onarım şeridine girmeyen bir mesaj ve değerlendirici
   * önceki cevabın karşılamadığını söyledi. Kart "anlam" kaynağıyla açılabilir ve mesaj tekrar denemesi sayılır.
   */
  repair: boolean;
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

/**
 * Kararın ürüne etkisi; eşikler ve anahtarlar src/data/judge.json'da.
 * repairWords: son kullanıcı mesajı onarım kelimesi taşıyor ve kısa onarım değil (içerik betiği hesaplar;
 * mesaj metni bu dosyaya gelmez).
 */
export function judgeAction(v: JudgeVerdict | null, repairWords = false): JudgeAction {
  if (!v) return { card: false, repair: false, ring: 0, sameRequest: false, repeat: null };
  const opens = judgeMode() !== "onay";
  // Döngü kartı (loop_card): kanıtlı döngüde (tıkanma ya da özür döngüsü) düşük eşik, kanıtsız döngüde yüksek eşik.
  const threshold = v.tikanma || v.ozurDongusu ? JUDGE.card_threshold_evidence : JUDGE.card_threshold;
  const card = JUDGE.loop_card && opens && v.dongu && v.guven >= threshold && v.gerekce !== "" && v.oneri !== "";
  const repair = JUDGE.repair_card && opens && !card && repairWords && v.karsiladi === "hayir";
  // Halka: döngü kartı kapalıyken değerlendirici halkayı doğrudan koyulaştırmaz; anlam onarımı tekrar denemesi
  // sayıldığı için halka kurallar üzerinden yükselir (yeniden oynatmada ölçülen biçim).
  const ring = !JUDGE.loop_card
    ? 0
    : card || (v.dongu && v.guven >= JUDGE.card_threshold)
      ? 2
      : v.dongu && v.guven >= JUDGE.ring_threshold
        ? 1
        : 0;
  // Yeniden yazım sayacı yalnızca karşılanmamış bir isteğin yeniden sorulmasında; doğru cevaptan sonra
  // aynı soruyu başka dilde sormak döngü değildir (açık prova P1a).
  const sameRequest = v.ayniIstek && v.tur === "ayni_istek_yeniden";
  // Aynı istek kartı döngü kartının yerini almaz; onay modunda (yeni kart açılmaz) çıkmaz.
  const repeat = card || repair || !opens ? null : repeatKind(v);
  return { card, repair, ring, sameRequest, repeat };
}

/**
 * Aynı istek kartının kuralı (davranış tanımı, K51 taslağı; Python ikizi src/kafiai/judge.py tekrar_turu):
 * kullanıcı aynı isteği ya da aynı bilgiyi yeniden sordu VE son cevap yeni bilgi vermedi. Önceki cevap açıkça
 * karşılamadıysa son cevap ne getirirse getirsin kart çıkar ("glutensiz demiştim"). Araya başka sorular girmiş
 * olabilir (A, B, C, sonra yine A).
 */
export function repeatKind(v: JudgeVerdict): "cevaplanmis" | "karsilanmamis" | null {
  if (!v.ayniIstek && !v.ayniBilgiyeDonus) return null;
  if (v.karsiladi === "hayir") return "karsilanmamis";
  return v.sonCevapYeniBilgi ? null : "cevaplanmis";
}

/**
 * Değerlendiricinin tur numarasını (gönderilen listede, kullanıcı ve asistan birlikte, 1 tabanlı) kullanıcının
 * kaçıncı mesajı olduğuna çevirir. Liste baştan kesildiyse kesilen mesajlar eklenir. Kullanıcı mesajı değilse null.
 */
export function userMessageNumber(turns: readonly JudgeTurn[], tur: number, totalUserTexts: number): number | null {
  const t = turns[tur - 1];
  if (!Number.isInteger(tur) || tur < 1 || !t || t.rol !== "k") return null;
  const inList = turns.filter((x) => x.rol === "k").length;
  const before = turns.slice(0, tur).filter((x) => x.rol === "k").length;
  return totalUserTexts - inList + before;
}
