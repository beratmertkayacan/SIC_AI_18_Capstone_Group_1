import { MIN_NORMALIZED_CHARS } from "../config";
import rules from "../data/signal-rules.json";
import { cosine, ngramVector } from "./similarity";
import { hasStrongRepair } from "./strong-repair";
import { taskType, type TaskType } from "./tasks";
import { normalizeText } from "./text";

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

const EXIT_WORDS = new Set<string>(rules.exit.words);
const VAGUE_CORE = new Set<string>(rules.vague.core);
const VAGUE_ALLOWED = new Set<string>([...rules.vague.allowed, ...rules.vague.core]);

const tokensOf = (normalized: string) => normalized.split(" ").filter((t) => t !== "");

/** Türkçe kuralla ve İngilizce "I" için ikinci kez sadeleştirilmiş iki biçim. */
function forms(text: string): string[] {
  const raw = text ?? "";
  const tr = normalizeText(raw);
  const en = normalizeText(raw.replace(/I/g, "i"));
  return tr === en ? [tr] : [tr, en];
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
    return rules.exit.phrases.some((p) => padded.includes(` ${p} `));
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
    }
    const normalized = normalizeText(text);
    const previous = this.recentTexts[this.recentTexts.length - 1];
    this.lastShortRepair = index > 0 && isShortRepair(text);
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
      if (isShort(text) && !this.lastShortRepair) {
        this.shortRepeatRun = normalized === previous ? this.shortRepeatRun + 1 : 1;
      } else {
        this.shortRepeatRun = 0;
      }
    }
    this.recentTexts.push(normalized);
    if (this.recentTexts.length > 5) this.recentTexts.shift();
  }

  /** Yapay zekanın cevabı bitti; cevabın başı (yalnızca kural için, saklanmaz). */
  noteAnswer(answer: string | null): void {
    this.apologyRun = apologizes(answer) ? this.apologyRun + 1 : 0;
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
  }
}
