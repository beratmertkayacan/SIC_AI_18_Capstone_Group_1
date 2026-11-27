/**
 * Kısıt kontrolü (deney, varsayılanı kapalı; src/config.ts experimentOn). Yalnızca tamamlanmış düz metin
 * cevabın TAMAMINA uygulanan açık kelime ya da karakter ÜST sınırlarına bakar. Kullanıcıya hiçbir şey
 * göstermez; karar yalnızca bellekte kurulur. Python eşi src/kafiai/constraint_check.py, ortak örnekler
 * tests/fixtures/constraint_parity.json.
 *
 * Görev sınırı eklenti tarafından bilinmediği için temkinli kural: yalnızca cevabın ait olduğu gönderimin
 * mesajında söylenen (ya da yinelenen) sınır uygulanır ve etkin kısıt turu o mesajın turudur. Önceki bir
 * mesajdaki sınır bu mesajda yinelenmiyorsa hâlâ geçerli olduğu doğrulanamaz: sonuç "değerlendirilemiyor".
 *
 * Sayım kuralı:
 *   kelime   = boşluklara göre ayrılan ve en az bir harf ya da rakam içeren parçalar
 *   karakter = baştaki ve sondaki boşluk atıldıktan sonra Unicode karakter sayısı (NFC); boşluklu ve boşluksuz
 *              iki sayım. Kullanıcı tercihini söylemediyse ve iki sayım farklı karar veriyorsa "değerlendirilemiyor".
 *   "en fazla N" (<= N) ile "N'den az" (< N) ayrıdır: tam N ilkine uyar, ikincisine uymaz.
 */

export type Unit = "kelime" | "karakter";
export type Kind = "<=" | "<";
export type ConstraintResult = "uyuyor" | "aşıyor" | "tanınan kısıt yok" | "değerlendirilemiyor";

export interface Constraint {
  n: number;
  unit: Unit;
  kind: Kind;
  /** Mesaj sınırın cevabın bir bölümüne ait olabileceğini söylüyor mu (başlık, madde…)? Öyleyse kapsam belirsiz. */
  partial: boolean;
  /** Kullanıcının boşluk tercihi (yalnızca karakter sınırında anlamlı). */
  space: "haric" | "dahil" | null;
}

export interface ConstraintDecision {
  result: ConstraintResult;
  constraint: Constraint | null;
  /** Etkin kısıtın söylendiği tur (cevabın ait olduğu gönderim); kısıt yoksa null. */
  constraintTurn: number | null;
  words: number;
  chars: number;
  charsNoSpace: number;
  /** Kısa, sabit gerekçe; mesaj ya da cevap metni içermez. */
  reason: string;
}

const UNIT: Record<string, Unit> = {
  kelime: "kelime", word: "kelime", words: "kelime",
  karakter: "karakter", character: "karakter", characters: "karakter", char: "karakter", chars: "karakter",
};

const PATTERNS: [RegExp, Kind][] = [
  [/(?:en fazla|en çok|maksimum|max\.?)\s*(\d+)\s*(kelime|karakter)/gu, "<="],
  [/(\d+)\s*(kelime|karakter)(?:yi|i|ı)?\s*(?:geçmesin|geçmemeli|aşmasın|aşmamalı)/gu, "<="],
  [/(\d+)\s*(kelime|karakter)(?:nin|in|ın|den|dan|ten|tan)\s*(?:altında|az)/gu, "<"],
  [/(?:at most|no more than|up to|maximum of|max\.?)\s*(\d+)\s*(words?|characters?|chars?)/gu, "<="],
  [/(?:under|fewer than|less than|below)\s*(\d+)\s*(words?|characters?|chars?)/gu, "<"],
];
/** "30 kelime sınırını 50'ye çıkar": yeni sınır 50 (kapsayan). */
const CHANGE = /(\d+)\s*(kelime|karakter)\s*sınırını\s*(\d+)\S*\s*(?:çıkar|yükselt|indir|düşür)/gu;
const PART = /(?<![\p{L}\p{N}_])(başlık|madde|paragraf|her biri|her bir|title|heading|bullet|each|per)(?![\p{L}\p{N}_])/u;
const NO_SPACE = /boşluklar hariç|boşluksuz|boşluk hariç|excluding spaces|without spaces/u;
const WITH_SPACE = /boşluklar dahil|boşluk dahil|including spaces|with spaces/u;

/** Mesajdaki tanınan üst sınırlar (tanınmayan ifade boş liste verir; bu "kısıt yok" demek değildir). */
export function parseConstraints(message: string): Constraint[] {
  const text = message.toLowerCase();
  const partial = PART.test(text);
  const space = NO_SPACE.test(text) ? "haric" : WITH_SPACE.test(text) ? "dahil" : null;
  const found: Constraint[] = [];
  for (const m of text.matchAll(CHANGE)) {
    const unit = UNIT[m[2] ?? ""];
    if (unit) found.push({ n: Number(m[3]), unit, kind: "<=", partial, space });
  }
  if (found.length > 0) return found;
  for (const [re, kind] of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const unit = UNIT[m[2] ?? ""];
      if (unit) found.push({ n: Number(m[1]), unit, kind, partial, space });
    }
  }
  return found;
}

export function countWords(text: string): number {
  return text.split(/\s+/u).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

export function countChars(text: string): { chars: number; charsNoSpace: number } {
  const s = text.normalize("NFC").trim();
  return { chars: Array.from(s).length, charsNoSpace: Array.from(s.replace(/\s/gu, "")).length };
}

const fits = (count: number, c: Constraint) => (c.kind === "<=" ? count <= c.n : count < c.n);

/**
 * userTexts: o ana kadarki kullanıcı mesajları (eskiden yeniye); turn: cevabın ait olduğu gönderimin sırası (1'den).
 * earlierUnknown: önceki mesajların bir kısmı okunamadıysa true (önceki bir sınır olup olmadığı bilinemez).
 */
export function decideConstraint(userTexts: readonly string[], turn: number, answer: string, earlierUnknown = false): ConstraintDecision {
  const words = countWords(answer);
  const { chars, charsNoSpace } = countChars(answer);
  const base = { words, chars, charsNoSpace };
  const current = parseConstraints(userTexts[turn - 1] ?? "");
  const c = current[0];
  if (!c) {
    const earlier = userTexts.slice(0, Math.max(0, turn - 1)).some((m) => parseConstraints(m).length > 0);
    if (earlier || earlierUnknown) {
      return { ...base, result: "değerlendirilemiyor", constraint: null, constraintTurn: null, reason: "önceki kısıtın geçerliliği doğrulanamadı" };
    }
    return { ...base, result: "tanınan kısıt yok", constraint: null, constraintTurn: null, reason: "" };
  }
  if (c.partial) {
    return { ...base, result: "değerlendirilemiyor", constraint: c, constraintTurn: turn, reason: "kapsam belirsiz" };
  }
  if (c.unit === "kelime") {
    return { ...base, result: fits(words, c) ? "uyuyor" : "aşıyor", constraint: c, constraintTurn: turn, reason: "" };
  }
  if (c.space === "haric") return { ...base, result: fits(charsNoSpace, c) ? "uyuyor" : "aşıyor", constraint: c, constraintTurn: turn, reason: "boşluklar hariç" };
  if (c.space === "dahil") return { ...base, result: fits(chars, c) ? "uyuyor" : "aşıyor", constraint: c, constraintTurn: turn, reason: "boşluklar dahil" };
  if (fits(chars, c) !== fits(charsNoSpace, c)) {
    return { ...base, result: "değerlendirilemiyor", constraint: c, constraintTurn: turn, reason: "boşluk tercihi yok; iki sayım farklı karar veriyor" };
  }
  return { ...base, result: fits(chars, c) ? "uyuyor" : "aşıyor", constraint: c, constraintTurn: turn, reason: "" };
}
