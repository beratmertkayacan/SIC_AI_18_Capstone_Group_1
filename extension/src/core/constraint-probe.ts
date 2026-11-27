import type { ExchangeSnapshot } from "../adapters/types";
import { CONSTRAINT_CONFIRM_MS } from "../config";
import { type Constraint, type ConstraintDecision, decideConstraint } from "./constraint-check";

/**
 * Kısıt kontrolünün akışı (deney, varsayılanı kapalı). Kullanıcıya hiçbir şey göstermez, gönderimi
 * bekletmez, depoya yazmaz; kararı yalnızca konsola sayı ve sabit etiketlerle yazar (mesaj ya da cevap
 * metni yazılmaz).
 *
 * İhlal yazmadan önce aranan kanıtlar (biri eksikse sonuç "değerlendirilemiyor"):
 *   1. Tamamlanma: "cevap bitti" sinyalinden sonra iki okuma (aradan CONSTRAINT_CONFIRM_MS geçer); ikisinde
 *      de üretim yok, cevabın anahtarı ve tam metni aynı. 600 ms sessizlik tek başına yeterli sayılmaz.
 *   2. Cevap ile gönderim bağı: son kullanıcı öğesi ile son asistan öğesi aynı tur ön ekini taşıyor
 *      ("…:0:user" / "…:1:assistant"), asistan öğesi kullanıcı öğesinden sonra geliyor ve son kullanıcı
 *      öğesinin metni son gönderilen mesajla aynı.
 *   3. Görünür dal: bu sohbette mesaj düzenlenmediyse dal belirsiz sayılmaz.
 * Aynı cevap anahtarı için ikinci karar üretilmez.
 *
 * Not (ayrı deney, noteEnabled): yalnızca önceki turun doğrulanmış cevabı bir sınırı aştıysa, bu turun mesajı AYNI
 * sınırı açıkça yinelediyse ve bu turun cevabı da aynı sınırı aştıysa, ikinci cevabın altında bir kez gösterilir.
 * Sınır değiştiyse, cevap uyduysa, sonuç "değerlendirilemiyor" ise ya da turlar ardışık değilse not çıkmaz.
 */
export interface ConstraintProbeDeps {
  enabled(): boolean;
  read(): ExchangeSnapshot | null;
  userTexts(): { texts: readonly string[]; hidden: number };
  log(line: string): void;
  schedule(fn: () => void, ms: number): void;
  /** Not deneyi açık ve şu an not gösterilebilir mi (öneriler açık, kişisel sohbet değil…)? */
  noteEnabled?(): boolean;
  /** Notu verilen cevap anahtarının altına gösterir; gösterilebildiyse true. */
  showNote?(assistantKey: string, text: string): boolean;
}

const PREFIX = "[KafiAI] kısıt kontrolü (deney)";
const NOTE_PREFIX = "[KafiAI] kısıt notu (deney)";

const sameConstraint = (a: Constraint, b: Constraint) => a.n === b.n && a.unit === b.unit && a.kind === b.kind;

/**
 * Deney metni (ürün metni değil; kullanıcıya gösterilecek metin ayrıca onaylanacak). Rehberdeki "kısıta dönme
 * önerisi" tanımına dayanır: karşılanmayan sınırı adıyla anar, sınırı mesajın başında yeniden yazmayı önerir.
 */
export function constraintNoteText(d: ConstraintDecision): string {
  const c = d.constraint;
  if (!c) return "";
  const count = c.unit === "kelime" ? `${d.words} kelime` : `${c.space === "haric" ? d.charsNoSpace : d.chars} karakter`;
  return `Bu cevap da ${c.n} ${c.unit} sınırını aşıyor (${count}). Sınırı mesajının başında tek cümleyle yeniden yazmak işe yarayabilir.`;
}
const norm = (s: string) => s.replace(/\s+/gu, " ").trim();

function sameTurn(s: ExchangeSnapshot): boolean {
  const u = s.userKey ?? "";
  const a = s.assistantKey ?? "";
  if (!u.endsWith(":user") || !a.endsWith(":assistant")) return false;
  const prefix = (key: string) => key.split(":")[0] ?? "";
  return prefix(u) !== "" && prefix(u) === prefix(a) && s.assistantAfterUser;
}

export class ConstraintProbe {
  private readonly decided = new Set<string>();
  private readonly noted = new Set<string>();
  private branchUncertain = false;
  /** Son doğrulanmış karar (not için: önceki turun sonucu). Belirsiz sonuçta silinir. */
  private last: { turn: number; result: string; constraint: Constraint | null } | null = null;

  constructor(private readonly deps: ConstraintProbeDeps, private readonly confirmMs = CONSTRAINT_CONFIRM_MS) {}

  /** Sohbet değişti ya da eklenti yeniden açıldı: bellekteki her şey silinir. */
  reset(): void {
    this.decided.clear();
    this.noted.clear();
    this.branchUncertain = false;
    this.last = null;
  }

  /** Kullanıcı önceki bir mesajını düzenledi: görünür dal artık bellekteki mesaj listesiyle doğrulanamaz. */
  onEdit(): void {
    if (this.deps.enabled()) this.branchUncertain = true;
  }

  onResponseComplete(): void {
    if (!this.deps.enabled()) return;
    const first = this.deps.read();
    this.deps.schedule(() => this.confirm(first), this.confirmMs);
  }

  private confirm(first: ExchangeSnapshot | null): void {
    if (!this.deps.enabled()) return;
    const second = this.deps.read();
    const key = second?.assistantKey ?? first?.assistantKey ?? null;
    if (key !== null && this.decided.has(key)) {
      this.deps.log(`${PREFIX}: aynı cevap, yeni kayıt yok`);
      return;
    }
    if (key !== null) this.decided.add(key);
    const { texts, hidden } = this.deps.userTexts();
    const turn = texts.length + hidden;
    const why = this.unresolved(first, second, texts);
    if (why !== null || second === null || second.assistantText === null || second.assistantKey === null) {
      this.last = null; // belirsiz bir tur, ardışık ihlal zincirini koparır
      this.deps.log(`${PREFIX}: tur ${turn}, sonuç değerlendirilemiyor (${why ?? "cevap okunamadı"})`);
      return;
    }
    const d = decideConstraint(texts, texts.length, second.assistantText, hidden > 0);
    const c = d.constraint;
    const rule = c ? `, kural ${c.kind} ${c.n} ${c.unit}, kısıt turu [${(d.constraintTurn ?? 0) + hidden}]` : "";
    const count = c?.unit === "karakter" ? `, sayım boşluklu ${d.chars} / boşluksuz ${d.charsNoSpace}` : c ? `, sayım ${d.words} kelime` : "";
    this.deps.log(`${PREFIX}: tur ${turn}, sonuç ${d.result}${rule}${count}${d.reason ? ` (${d.reason})` : ""}`);
    this.maybeNote(turn, second.assistantKey, d);
    this.last = d.result === "değerlendirilemiyor" ? null : { turn, result: d.result, constraint: c };
  }

  /** Not yalnızca ardışık iki doğrulanmış cevap aynı, açıkça yinelenmiş sınırı aştıysa ve bir kez gösterilir. */
  private maybeNote(turn: number, key: string, d: ConstraintDecision): void {
    if (!this.deps.noteEnabled?.() || !this.deps.showNote) return;
    const prev = this.last;
    const c = d.constraint;
    if (d.result !== "aşıyor" || !c || prev === null || prev.result !== "aşıyor" || !prev.constraint) return;
    if (prev.turn !== turn - 1 || !sameConstraint(prev.constraint, c) || d.constraintTurn === null) return;
    if (this.noted.has(key)) return;
    this.noted.add(key);
    const shown = this.deps.showNote(key, constraintNoteText(d));
    this.deps.log(`${NOTE_PREFIX}: tur ${turn}, ${shown ? "gösterildi" : "gösterilemedi (cevap öğesi bulunamadı)"}`);
  }

  private unresolved(first: ExchangeSnapshot | null, second: ExchangeSnapshot | null, texts: readonly string[]): string | null {
    if (first === null || second === null) return "cevap okunamadı";
    if (this.branchUncertain) return "düzenlemeden sonra görünür dal belirsiz";
    if (first.generating || second.generating) return "tamamlanma doğrulanamadı";
    if (first.assistantKey === null || first.assistantKey !== second.assistantKey || first.assistantText !== second.assistantText) {
      return "tamamlanma doğrulanamadı";
    }
    if (second.assistantText === null || second.assistantText === "") return "cevap okunamadı";
    if (!sameTurn(second)) return "cevap gönderimle eşleşmedi";
    const last = texts[texts.length - 1];
    if (last === undefined || norm(last) !== norm(second.userText)) return "cevap gönderimle eşleşmedi";
    return null;
  }
}
