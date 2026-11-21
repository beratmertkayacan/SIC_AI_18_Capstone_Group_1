import type { ExchangeSnapshot } from "../adapters/types";
import { CONSTRAINT_CONFIRM_MS } from "../config";
import { decideConstraint } from "./constraint-check";

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
 */
export interface ConstraintProbeDeps {
  enabled(): boolean;
  read(): ExchangeSnapshot | null;
  userTexts(): { texts: readonly string[]; hidden: number };
  log(line: string): void;
  schedule(fn: () => void, ms: number): void;
}

const PREFIX = "[KafiAI] kısıt kontrolü (deney)";
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
  private branchUncertain = false;

  constructor(private readonly deps: ConstraintProbeDeps, private readonly confirmMs = CONSTRAINT_CONFIRM_MS) {}

  /** Sohbet değişti ya da eklenti yeniden açıldı: bellekteki her şey silinir. */
  reset(): void {
    this.decided.clear();
    this.branchUncertain = false;
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
    if (why !== null || second === null || second.assistantText === null) {
      this.deps.log(`${PREFIX}: tur ${turn}, sonuç değerlendirilemiyor (${why ?? "cevap okunamadı"})`);
      return;
    }
    const d = decideConstraint(texts, texts.length, second.assistantText, hidden > 0);
    const c = d.constraint;
    const rule = c ? `, kural ${c.kind} ${c.n} ${c.unit}, kısıt turu [${(d.constraintTurn ?? 0) + hidden}]` : "";
    const count = c?.unit === "karakter" ? `, sayım boşluklu ${d.chars} / boşluksuz ${d.charsNoSpace}` : c ? `, sayım ${d.words} kelime` : "";
    this.deps.log(`${PREFIX}: tur ${turn}, sonuç ${d.result}${rule}${count}${d.reason ? ` (${d.reason})` : ""}`);
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
