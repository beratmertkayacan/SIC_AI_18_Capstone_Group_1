import { MIN_NORMALIZED_CHARS, RECENT_MESSAGES, SIMILARITY_THRESHOLD, SOFT_SIMILARITY_THRESHOLD } from "../config";
import rules from "../data/repeat-rules.json";
import { ngramVector, cosine } from "./similarity";
import { isBareContinue } from "./intents";
import { hasStrongRepair } from "./strong-repair";
import { foldTurkish, hasTurkishLetter, normalizeText, withFolded } from "./text";

export interface RepeatCheck {
  /** Bu mesaj, yakın zamanda gönderilen birinin neredeyse aynısı mı? (şerit çıkar) */
  similar: boolean;
  /** Farklı kelimelerle de olsa aynı talebe benziyor mu? (yalnızca çıkış kartı için sayılır) */
  soft: boolean;
  /** En yüksek benzerlik (0..1); karşılaştırılamadıysa 0. */
  score: number;
  /** Karşılaştırılamayan kısa mesaj mı? */
  tooShort: boolean;
  /** Benzerlik eşiği geçti ama yeni bir içerik kelimesi var (seri iş ya da yeni istek); şerit çıkmaz. */
  newContent: boolean;
  /**
   * Benzer bir mesaj ama bilerek yapılan bir varyasyon isteği ("sonraki soruyu sor", "başka fikir ver");
   * onarım ifadesi yok. Şerit çıkmaz, çıkış kartı için tekrar sayılmaz.
   */
  variation: boolean;
  /**
   * Gönderim bekletilip şerit gösterilir mi? Benzer olmanın üstüne birebir tekrar ya da güçlü onarım
   * ifadesi gerekir. Birebir olmayan yeniden yazım yalnızca halka ve kart için sayılır (repeat-rules.json, hold_note).
   */
  hold: boolean;
  /** Son mesajlardan kaç tanesi bu mesajın tekrarı (eşiği geçen ve yeni içerik getirmeyen); şeritteki "N. deneme" için. */
  matches: number;
}

interface Remembered {
  vec: Map<number, number>;
  tokens: Set<string>;
  stems: Set<string>;
  /** Kelimelerin Türkçe karakterleri düz harfe indirilmiş biçimleri (tüm kelimeler). */
  foldedTokens: Set<string>;
  /** Aynısı, yalnızca klavyesiz (Türkçe harfsiz) yazılmış kelimelerden. */
  foldedPlainTokens: Set<string>;
  /** Düz harfe indirilmiş kökler (tüm kelimeler / yalnızca klavyesiz kelimeler). */
  foldedStems: Set<string>;
  foldedPlainStems: Set<string>;
}

interface KeyboardWord {
  word: string;
  /** Kelimede hiç Türkçe harf yok mu (Türkçe klavye olmadan yazılmış olabilir mi)? */
  plain: boolean;
}

const FILLER = new Set<string>(withFolded(rules.filler));
// Yalnızca mesajın başındaki dolgu dizisinde dolgu sayılan sözcükler ("Olmadı, ..."); ortada içeriktir.
const LEADING_FILLER = new Set<string>(withFolded(rules.leading_filler));
const hasDigit = (t: string) => /\p{N}/u.test(t);
const STEM = rules.stem_chars;
const CHOICE = new Set<string>(rules.choice_letters);
const VARIATION_WORDS = new Set<string>(withFolded(rules.variation.words));
const VARIATION_PREFIXES = withFolded(rules.variation.prefixes);
const VARIATION_PHRASES = withFolded(rules.variation.phrases);

/**
 * Varyasyon işareti: kullanıcı yeni bir örnek istiyor ("başka", "farklı", "sonraki", "bir tane daha",
 * "more", "next"). Python: extension_similarity.has_variation_cue.
 */
export function hasVariationCue(text: string): boolean {
  // Türkçe karaktersiz yazım da sayılır ("baska fikir").
  const normalized = foldTurkish(normalizeText(text));
  const tokens = normalized.split(" ").filter((t) => t !== "");
  if (tokens.some((t) => VARIATION_WORDS.has(t))) return true;
  if (tokens.some((t) => VARIATION_PREFIXES.some((p) => t.startsWith(p)))) return true;
  const padded = ` ${normalized} `;
  return VARIATION_PHRASES.some((p) => padded.includes(` ${p} `));
}

/**
 * Varyasyon isteği: işaret var, güçlü onarım ifadesi yok (Python: extension_similarity.is_variation).
 * Orta uzunlukta bir mesajın birebir yeniden gönderimi varyasyon sayılmaz: "farklı olanları işaretle" gibi
 * isteklerde işaret kelimesi içeriğin parçasıdır. score: önceki mesajlarla en yüksek benzerlik.
 */
export function isVariation(text: string, score = 0): boolean {
  if (!hasVariationCue(text) || hasStrongRepair(text)) return false;
  const words = normalizeText(text).split(" ").filter((t) => t !== "").length;
  const v = rules.variation;
  // Çok uzun birebir tekrarlar yeniden kullanılan istem şablonlarıdır; onlar yine varyasyon sayılır.
  return !(score >= v.exact_similarity && words > v.max_exact_words && words <= v.template_words);
}

/**
 * Mesajın kelimeleri ve her kelimenin klavyesiz yazılıp yazılmadığı (Python: extension_similarity._keyboard_words).
 * Türkçe harf denetimi büyük I'yı İngilizce kurala göre i yapılmış metne bakar: normalizeText "I"yı "ı"ya
 * çevirdiği için "Imparatorlugu" yoksa Türkçe harfli sayılırdı.
 */
function keyboardWords(text: string): KeyboardWord[] {
  const words = normalizeText(text).split(" ").filter((t) => t !== "");
  let plain = normalizeText(text.replace(/I/g, "i")).split(" ").filter((t) => t !== "");
  // Beklenmedik bölünme farkında güvenli taraf: kelimenin kendisine bak.
  if (plain.length !== words.length) plain = words;
  return words.map((word, i) => ({ word, plain: !hasTurkishLetter(plain[i] ?? word) }));
}

const stemOf = (t: string) => Array.from(t).slice(0, STEM).join("");
const hasStem = (t: string) => Array.from(t).length >= STEM && !hasDigit(t);

function remembered(text: string): Remembered {
  const words = keyboardWords(text);
  const tokens = words.map((w) => w.word);
  const plainTokens = words.filter((w) => w.plain).map((w) => w.word);
  return {
    vec: ngramVector(normalizeText(text)),
    tokens: new Set(tokens),
    stems: new Set(tokens.filter(hasStem).map(stemOf)),
    foldedTokens: new Set(tokens.map(foldTurkish)),
    foldedPlainTokens: new Set(plainTokens.map(foldTurkish)),
    foldedStems: new Set(tokens.filter(hasStem).map((t) => stemOf(foldTurkish(t)))),
    foldedPlainStems: new Set(plainTokens.filter(hasStem).map((t) => stemOf(foldTurkish(t)))),
  };
}

/**
 * Yeni mesajın öncekinde karşılığı olmayan içerik kelimeleri (Python: extension_similarity.new_content).
 * text ham mesajdır; kelimeler yeni mesajdaki özgün yazımıyla döner. Türkçe karakterleri düz harfe indirilmiş
 * eşleşme ("baskenti" / "başkenti") yalnızca iki kelimeden en az biri klavyesiz yazılmışsa sayılır; ikisi de
 * Türkçe harfliyse ("kaslarımı" / "kaşlarımı") farklı kelimelerdir.
 */
export function newContent(text: string, previous: Remembered): string[] {
  const out: string[] = [];
  const words = keyboardWords(text);
  const short = words.length <= rules.choice_max_words;
  let leading = true; // mesajın başındaki dolgu dizisi sürüyor mu?
  for (const { word: t, plain } of words) {
    if (leading && LEADING_FILLER.has(t)) continue;
    if (!FILLER.has(t)) leading = false;
    if (short && CHOICE.has(t)) {
      // Kısa mesajda tek başına şık harfi içeriktir: "cevabım B" ile "cevabım C" farklı.
      if (!previous.tokens.has(t)) out.push(t);
      continue;
    }
    if (FILLER.has(t)) continue;
    const chars = Array.from(t);
    if (chars.length < rules.min_token_chars && !hasDigit(t)) continue;
    if (previous.tokens.has(t)) continue;
    const folded = foldTurkish(t);
    // Yeni kelime klavyesizse öncekindeki her kelimeyle, değilse yalnızca klavyesiz olanlarla düz harfte eşleşir.
    if ((plain ? previous.foldedTokens : previous.foldedPlainTokens).has(folded)) continue;
    if (
      hasStem(t) &&
      (previous.stems.has(stemOf(t)) || (plain ? previous.foldedStems : previous.foldedPlainStems).has(stemOf(folded)))
    ) {
      continue;
    }
    out.push(t);
  }
  return out;
}

/**
 * Oturumdaki son kullanıcı mesajlarını yalnızca bellekte tutar (sayfa kapanınca/sohbet
 * değişince silinir, hiçbir yere yazılmaz) ve yeni mesajın benzer olup olmadığına bakar.
 * Şerit için iki koşul: 3-gram benzerliği eşiği geçer ve yeni mesaj yeni bir içerik kelimesi
 * getirmez ("1. soruyu çöz" / "2. soruyu çöz" gibi seri işler tekrar sayılmaz; src/data/repeat-rules.json).
 */
export class RepeatDetector {
  private recent: Remembered[] = [];

  /** Mesaj gönderilmeden önce çağrılır; mesajı listeye eklemez. */
  check(text: string): RepeatCheck {
    const normalized = normalizeText(text);
    // Yönsüz devam ("devam edebilir misin lütfen") bir istek değil; kısa mesaj gibi karşılaştırılmaz.
    if (Array.from(normalized).length < MIN_NORMALIZED_CHARS || isBareContinue(text)) {
      return { similar: false, soft: false, score: 0, tooShort: true, newContent: false, variation: false, hold: false, matches: 0 };
    }
    const vec = ngramVector(normalized);
    let score = 0;
    let similar = false;
    let exact = false;
    let matches = 0;
    let aboveThreshold = false;
    for (const previous of this.recent) {
      const s = cosine(vec, previous.vec);
      score = Math.max(score, s);
      if (s >= SIMILARITY_THRESHOLD) {
        aboveThreshold = true;
        if (newContent(text, previous).length === 0) {
          similar = true;
          matches += 1;
          if (s >= rules.hold_exact_similarity) exact = true;
        }
      }
    }
    const soft = score >= SOFT_SIMILARITY_THRESHOLD;
    if ((similar || soft) && isVariation(text, score)) {
      // Bilerek yapılan seri üretim: döngü sayılmaz.
      return { similar: false, soft: false, score, tooShort: false, newContent: false, variation: true, hold: false, matches: 0 };
    }
    const hold = similar && (exact || hasStrongRepair(text));
    return { similar, soft, score, tooShort: false, newContent: aboveThreshold && !similar, variation: false, hold, matches };
  }

  /** Mesaj gönderildikten sonra çağrılır. Kısa mesajlar saklanmaz. */
  remember(text: string): void {
    const normalized = normalizeText(text);
    if (Array.from(normalized).length < MIN_NORMALIZED_CHARS || isBareContinue(text)) return;
    this.recent.push(remembered(text));
    if (this.recent.length > RECENT_MESSAGES) this.recent.shift();
  }

  reset(): void {
    this.recent = [];
  }
}

export { remembered as rememberForTest };
