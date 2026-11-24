import { MIN_NORMALIZED_CHARS } from "../config";
import rules from "../data/signal-rules.json";
import { isBareContinue } from "./intents";
import { hasVariationCue } from "./repeat-detector";
import { cosine, ngramVector } from "./similarity";
import { hasStrongRepair } from "./strong-repair";
import { taskType, type TaskType } from "./tasks";
import { foldTurkish, normalizeText, withFolded } from "./text";

/**
 * Sohbet sinyalleri (karar K32). Tekrar dedektörünün ötesinde, bir sohbetin gidişini anlatan dört
 * küçük kural; hepsi yalnızca bellekte çalışır, hiçbir metin saklanmaz:
 *
 *   özür döngüsü   yapay zekanın cevapları üst üste "haklısınız, özür dilerim" ile başlıyor
 *   çıkış          kullanıcı teşekkür etti ya da "oldu, çalıştı" dedi: döngü sinyalleri sıfırlanır
 *   belirsiz istek "daha iyi yap", "kısalt" gibi neyin değişeceğini söylemeyen kısa düzeltme
 *   konu kayması   sohbet başka bir konuya geçti: yeni bir bölüm başlar
 *   kısa onarım    "olmadı", "yanlış" gibi kısa ama açık bir memnuniyetsizlik: tekrar denemesi gibi sayılır
 *   kısa tekrar    aynı kısa mesaj ("devam") üst üste: yalnızca rules.short.repeat_streak kez olunca halkaya yansır
 *
 * Kurallar src/data/signal-rules.json dosyasında; Python ikizi src/kafiai/signals.py.
 */

// Çıkış ve belirsiz istek listeleri Türkçe karaktersiz yazımı da kapsar ("tesekkurler", "kisalt").
const EXIT_WORDS = new Set<string>([
  ...withFolded(rules.exit.words.filter((w) => !rules.exit.fold_exclude.includes(w))),
  ...rules.exit.fold_exclude,
]);
const EXIT_PHRASES = withFolded(rules.exit.phrases);
const VAGUE_CORE = new Set<string>(withFolded(rules.vague.core));
const VAGUE_ALLOWED = new Set<string>(withFolded([...rules.vague.allowed, ...rules.vague.core]));

const tokensOf = (normalized: string) => normalized.split(" ").filter((t) => t !== "");

/** Türkçe kuralla, İngilizce "I" için ikinci kez ve Türkçe karaktersiz olarak sadeleştirilmiş biçimler. */
function forms(text: string): string[] {
  const raw = text ?? "";
  const tr = normalizeText(raw);
  const en = normalizeText(raw.replace(/I/g, "i"));
  return [...new Set([tr, en, foldTurkish(tr)])];
}

/** Cevabın başında özür ya da "haklısınız" var mı? */
export function apologizes(answer: string | null | undefined): boolean {
  if (!answer) return false;
  const head = answer.slice(0, rules.apology.head_chars);
  return forms(head).some((n) => {
    const padded = ` ${n} `;
    return rules.apology.phrases.some((p) => padded.includes(` ${p} `));
  });
}

/** Kullanıcı döngüden çıktığını söylüyor mu ("teşekkürler", "oldu", "it works")? */
export function isExitMessage(text: string): boolean {
  if (hasStrongRepair(text)) return false;
  return forms(text).some((n) => {
    const tokens = tokensOf(n);
    if (tokens.length === 0 || tokens.length > rules.exit.max_words) return false;
    if (tokens.some((t) => EXIT_WORDS.has(t))) return true;
    const padded = ` ${n} `;
    return EXIT_PHRASES.some((p) => padded.includes(` ${p} `));
  });
}

/** Kısa ve açıklamasız düzeltme isteği mi ("daha iyi yap", "kısalt", "make it better")? */
export function isVague(text: string): boolean {
  return forms(text).some((n) => {
    const tokens = tokensOf(n);
    if (tokens.length === 0 || tokens.length > rules.vague.max_words) return false;
    return tokens.every((t) => VAGUE_ALLOWED.has(t)) && tokens.some((t) => VAGUE_CORE.has(t));
  });
}

/** Karşılaştırılamayacak kadar kısa mesaj mı (tekrar dedektörü bunlara bakmaz)? */
export function isShort(text: string): boolean {
  const length = Array.from(normalizeText(text)).length;
  return length > 0 && length < MIN_NORMALIZED_CHARS;
}

const DECLINE_WORDS = new Set<string>(withFolded(rules.short.decline_words));

/** Cevap bir soruyla mı bitiyor ("… ekleyeyim mi?")? Sondaki emoji, tırnak ve boşluklar yok sayılır. */
export function endsWithQuestion(answer: string | null | undefined): boolean {
  if (!answer) return false;
  const tail = Array.from(answer).slice(-rules.short.tail_chars).join("");
  return /\?[^\p{L}\p{N}?]*$/u.test(tail);
}

/** Soruyla biten bir cevaba verilen yalın "hayır": teklifi geri çevirmek, şikayet değil. */
export function isOfferDecline(text: string, answerAskedQuestion: boolean): boolean {
  if (!answerAskedQuestion) return false;
  const tokens = tokensOf(foldTurkish(normalizeText(text)));
  return tokens.length > 0 && tokens.length <= rules.short.decline_max_words && DECLINE_WORDS.has(tokens[0] ?? "");
}

/** Aynı kısa mesaj bu kadar kez üst üste gelince şerit çıkar. */
export const SHORT_REPEAT_STREAK: number = rules.short.repeat_streak;
/** Soruyla biten cevaplara bu kadar ardışık kısa onaydan sonra öneri çıkar. */
export const AFFIRM_STREAK: number = rules.affirm.streak;

const AFFIRM_WORDS = new Set<string>(withFolded(rules.affirm.words));
const AFFIRM_ALLOWED = new Set<string>(withFolded([...rules.affirm.allowed, ...rules.affirm.words]));

/** Kısa onay ya da ret mi ("evet", "aynen", "tamam", "hayır gerek yok")? "devam" sayılmaz. */
export function isAffirmation(text: string): boolean {
  if (isExitMessage(text)) return false;
  const tokens = tokensOf(foldTurkish(normalizeText(text)));
  return (
    tokens.length > 0 &&
    tokens.length <= rules.affirm.max_words &&
    tokens.every((t) => AFFIRM_ALLOWED.has(t)) &&
    tokens.some((t) => AFFIRM_WORDS.has(t))
  );
}

/**
 * Kısa tekrar serisinin anahtarı: yönsüz devam isteklerinin hepsi "devam" sayılır ("devam",
 * "devam et", "continue" aynı seri), öbür kısa mesajlar kendi metniyle. Seriye girmeyen mesajda null.
 */
export function shortRepeatKey(text: string): string | null {
  if (isBareContinue(text)) return "niyet:devam";
  return isShort(text) ? normalizeText(text) : null;
}

const RESTATE_PHRASES = withFolded(rules.restate.phrases);
/** Taze başlat taslağına en fazla bu kadar yeniden hatırlatılan kural girer. */
export const RESTATE_MAX_RULES: number = rules.restate.max_rules;

/**
 * Kullanıcı daha önce koyduğu bir kuralı yeniden mi hatırlatıyor ("söylemiştim", "dediğim gibi", "I told you")?
 * Uzun mesajda (yapıştırılmış metin) yalnızca baş ve sona bakılır; talimat orada durur.
 */
export function restatesRule(text: string): boolean {
  return forms(text).some((n) => {
    const chars = Array.from(n);
    const parts =
      chars.length <= rules.restate.whole_chars
        ? [n]
        : [chars.slice(0, rules.restate.edge_chars).join(""), chars.slice(-rules.restate.edge_chars).join("")];
    return parts.some((part) => {
      const padded = ` ${part.trim()} `;
      return RESTATE_PHRASES.some((p) => padded.includes(` ${p} `));
    });
  });
}

/** Kısa ve güçlü onarım ifadesi taşıyan mesaj mı ("olmadı", "yanlış", "hala hata")? */
export function isShortRepair(text: string): boolean {
  return isShort(text) && hasStrongRepair(text) && !isExitMessage(text);
}

export interface TopicContext {
  /** Son kullanıcı mesajlarının sadeleştirilmiş metinleri (eskiden yeniye). */
  recent: string[];
  /** O anki bölümün görev türü. */
  segmentTask: TaskType;
}

/** Bu mesaj yeni bir konu mu açıyor? */
export function isNewTopic(text: string, ctx: TopicContext): boolean {
  const normalized = normalizeText(text);
  if (Array.from(normalized).length < rules.topic.min_chars || hasStrongRepair(text)) return false;
  // Varyasyon isteği ("farklı tonda 5 tane daha") aynı işin devamıdır, yeni konu değildir.
  if (hasVariationCue(text)) return false;
  const task = taskType(text);
  if (task === "diger" || task === ctx.segmentTask) return false;
  const vec = ngramVector(normalized);
  return ctx.recent.every((r) => cosine(vec, ngramVector(r)) < rules.topic.max_similarity);
}

export interface UserTurn {
  /** Tekrar dedektörüne göre öncekine çok benziyor (şerit kuralı). */
  similar: boolean;
}

/** Bir sohbetin sinyallerini tur tur izler. Sohbet değişince reset() çağrılır. */
export class ConversationSignals {
  private recentFlags: boolean[] = [];
  private recentTexts: string[] = [];
  private apologyRun = 0;
  private vagueRun = 0;
  private segmentCount = 1;
  private segmentBegin = 0;
  private segmentTask: TaskType | null = null;
  private turns = 0;
  private lastExit = false;
  private shortRepeatRun = 0;
  private lastShortRepair = false;
  private answerAskedQuestion = false;
  private affirmRun = 0;
  private lastShortKey: string | null = null;
  private lastUserRepair = false;
  private prevAnswerVec: Map<number, number> | null = null;
  private ignoredRepair = false;
  private cleanRun = 0;
  private recovered = false;
  private restateIndices: number[] = [];

  /**
   * Bu mesaj gönderilirse aynı kısa mesaj üst üste kaçıncı kez gelmiş olur (noteUser ile aynı kural)?
   * Gönderim öncesi şerit için; durumu değiştirmez.
   */
  previewShortRepeat(text: string): number {
    const key = shortRepeatKey(text);
    if (isExitMessage(text) || key === null) return 0;
    if (this.turns > 0 && isShortRepair(text) && !isOfferDecline(text, this.answerAskedQuestion)) return 0;
    // Soruyla biten cevaba verilen kısa onay ("evet", "tamam") bir teklife cevaptır, yönsüz tekrar değil:
    // "Kısa devam" şeridi çıkmasın, onay zinciri önerisi ("Yön sende") kendi yolundan gelsin.
    // Yalnızca gönderim öncesi önizleme değişir; noteUser'daki sayım Python ikiziyle aynı kalır.
    if (this.answerAskedQuestion && isAffirmation(text)) return 0;
    return key === this.lastShortKey ? this.shortRepeatRun + 1 : 1;
  }

  /** Kullanıcı bir mesaj gönderdi (ya da geçmişten okundu). */
  noteUser(text: string, turn: UserTurn): void {
    const index = this.turns;
    this.turns += 1;
    this.lastExit = false;
    if (this.segmentTask === null) {
      this.segmentTask = taskType(text);
    } else if (isNewTopic(text, { recent: this.recentTexts, segmentTask: this.segmentTask })) {
      this.segmentCount += 1;
      this.segmentBegin = index;
      this.segmentTask = taskType(text);
      this.recentFlags = [];
      this.apologyRun = 0;
      this.vagueRun = 0;
      this.shortRepeatRun = 0;
      this.restateIndices = [];
    }
    // Kuralın yeniden hatırlatılması: yalnızca sıra numarası tutulur, metin değil (taslak userTexts'ten okur).
    if (index > 0 && restatesRule(text)) this.restateIndices.push(index);
    const normalized = normalizeText(text);
    this.lastShortRepair = index > 0 && isShortRepair(text) && !isOfferDecline(text, this.answerAskedQuestion);
    this.lastUserRepair = hasStrongRepair(text) && !isOfferDecline(text, this.answerAskedQuestion);
    // Temiz tur: kullanıcı şikayet etmiyor ve aynı isteğe dönmüyor (cevap tarafı noteAnswer'da bakılır).
    this.cleanRun = !turn.similar && !this.lastUserRepair && !this.lastShortRepair && !isVague(text) ? this.cleanRun + 1 : 0;
    this.recovered = false;
    // Soruyla biten cevaba verilen kısa onay ya da ret zinciri (yön modelde kalıyor).
    this.affirmRun = this.answerAskedQuestion && isAffirmation(text) ? this.affirmRun + 1 : 0;
    if (isExitMessage(text)) {
      this.lastExit = true;
      this.recentFlags = [];
      this.apologyRun = 0;
      this.vagueRun = 0;
      this.shortRepeatRun = 0;
    } else {
      this.recentFlags.push(turn.similar || this.lastShortRepair);
      if (this.recentFlags.length > rules.recent_window) this.recentFlags.shift();
      this.vagueRun = isVague(text) ? this.vagueRun + 1 : 0;
      const key = shortRepeatKey(text);
      if (key !== null && !this.lastShortRepair) {
        this.shortRepeatRun = key === this.lastShortKey ? this.shortRepeatRun + 1 : 1;
      } else {
        this.shortRepeatRun = 0;
      }
    }
    this.lastShortKey = this.lastExit ? null : shortRepeatKey(text);
    this.recentTexts.push(normalized);
    if (this.recentTexts.length > 5) this.recentTexts.shift();
  }

  /** Yapay zekanın cevabı bitti; cevabın başı (yalnızca kural için, saklanmaz). */
  noteAnswer(answer: string | null): void {
    this.apologyRun = apologizes(answer) ? this.apologyRun + 1 : 0;
    this.answerAskedQuestion = endsWithQuestion(answer);
    // Düzeltme alınmadı: kullanıcı onarım istedi ama cevabın başı öncekinin neredeyse aynısı.
    const head = normalizeText(Array.from(answer ?? "").slice(0, rules.answer_repeat.head_chars).join(""));
    const vec = head === "" ? null : ngramVector(head);
    const repeated = vec !== null && this.prevAnswerVec !== null && cosine(vec, this.prevAnswerVec) >= rules.answer_repeat.similarity;
    this.ignoredRepair = repeated && this.lastUserRepair && !this.lastExit;
    this.prevAnswerVec = vec;
    // Davranışsal çıkış: döngü sinyali varken iki temiz tur geldi; teşekkür beklenmeden sakinleşir.
    if (this.apologyRun > 0 || this.ignoredRepair) this.cleanRun = 0;
    const looping = this.recentSimilar > 0 || this.apologyRun > 0 || this.vagueRun >= 2;
    if (looping && this.cleanRun >= rules.recovery.clean_turns) {
      this.recentFlags = [];
      this.apologyRun = 0;
      this.vagueRun = 0;
      this.cleanRun = 0;
      this.recovered = true;
    }
  }

  /** Bu cevapla döngü sinyalleri davranışla sakinleşti mi (iki temiz tur)? */
  get recoveredNow(): boolean {
    return this.recovered;
  }

  /** Şu an bir döngü sinyali sürüyor mu (sohbet sonu ölçümü için)? */
  get looping(): boolean {
    return this.recentSimilar > 0 || this.apologyRun > 0 || this.vagueRun >= 2 || this.ignoredRepair;
  }

  /** Son cevap, kullanıcının düzeltme isteğine rağmen öncekinin neredeyse aynısı mı? */
  get answerIgnoredRepair(): boolean {
    return this.ignoredRepair;
  }

  /** Bu konu bölümünde kuralın yeniden hatırlatıldığı mesajların sırası (0'dan başlar). */
  get restatedTurns(): number[] {
    return [...this.restateIndices];
  }

  /** Son mesaj bir kuralı yeniden hatırlattı mı? */
  get restatedNow(): boolean {
    return this.restateIndices[this.restateIndices.length - 1] === this.turns - 1;
  }

  /** Soruyla biten cevaplara üst üste verilen kısa onay ya da ret sayısı. */
  get affirmStreak(): number {
    return this.affirmRun;
  }

  /** Son cevap bir soruyla mı bitti (yalın "hayır" o zaman şikayet sayılmaz)? */
  get lastAnswerAskedQuestion(): boolean {
    return this.answerAskedQuestion;
  }

  /** Son birkaç mesajdan kaçı öncekine çok benziyordu (çıkış ya da konu değişince sıfırlanır). */
  get recentSimilar(): number {
    return this.recentFlags.filter(Boolean).length;
  }

  get apologyStreak(): number {
    return this.apologyRun;
  }

  get vagueStreak(): number {
    return this.vagueRun;
  }

  /** Aynı kısa mesaj üst üste kaç kez geldi (1 = tek). */
  get shortRepeatStreak(): number {
    return this.shortRepeatRun;
  }

  /** Son mesaj kısa bir onarım mıydı ("olmadı")? */
  get shortRepair(): boolean {
    return this.lastShortRepair;
  }

  /** Sohbetteki konu bölümü sayısı (1 = tek konu). */
  get segments(): number {
    return this.segmentCount;
  }

  /** Şu anki bölümün ilk kullanıcı mesajının sırası (0'dan başlar). */
  get segmentStart(): number {
    return this.segmentBegin;
  }

  /** Son mesaj bir çıkış mesajı mıydı? */
  get exited(): boolean {
    return this.lastExit;
  }

  reset(): void {
    this.recentFlags = [];
    this.recentTexts = [];
    this.apologyRun = 0;
    this.vagueRun = 0;
    this.segmentCount = 1;
    this.segmentBegin = 0;
    this.segmentTask = null;
    this.turns = 0;
    this.lastExit = false;
    this.shortRepeatRun = 0;
    this.lastShortRepair = false;
    this.answerAskedQuestion = false;
    this.affirmRun = 0;
    this.lastShortKey = null;
    this.lastUserRepair = false;
    this.prevAnswerVec = null;
    this.ignoredRepair = false;
    this.cleanRun = 0;
    this.recovered = false;
    this.restateIndices = [];
  }
}
