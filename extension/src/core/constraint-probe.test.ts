import { describe, expect, it } from "vitest";
import type { ExchangeSnapshot } from "../adapters/types";
import { ConstraintProbe } from "./constraint-probe";

const U1 = "Yapay zekanın eğitime etkisini açıkla. Yanıt en fazla 30 kelime olsun.";
const U2 = "En fazla 30 kelime demiştim.";
const words = (n: number) => Array.from({ length: n }, (_, i) => `kelime${i}`).join(" ");

const snap = (over: Partial<ExchangeSnapshot> = {}): ExchangeSnapshot => ({
  userKey: "fallback-turn-1:0:user",
  userText: U2,
  assistantKey: "fallback-turn-1:1:assistant",
  assistantText: words(35),
  assistantAfterUser: true,
  generating: false,
  ...over,
});

/** Sahte bağımlılıklar: okumalar sırayla verilir, zamanlanan iş elle çalıştırılır. */
function setup(reads: (ExchangeSnapshot | null)[], opts: { enabled?: boolean; texts?: string[] } = {}) {
  const logs: string[] = [];
  const queue: (() => void)[] = [];
  let readCount = 0;
  const probe = new ConstraintProbe({
    enabled: () => opts.enabled ?? true,
    read: () => reads[Math.min(readCount++, reads.length - 1)] ?? null,
    userTexts: () => ({ texts: opts.texts ?? [U1, U2], hidden: 0 }),
    log: (line) => logs.push(line),
    schedule: (fn) => queue.push(fn),
  }, 0);
  const complete = () => {
    probe.onResponseComplete();
    while (queue.length) queue.shift()!();
  };
  return { probe, logs, complete, reads: () => readCount };
}

describe("ConstraintProbe", () => {
  it("bayrak kapalıyken hiçbir şey okumaz ve yazmaz", () => {
    const t = setup([snap()], { enabled: false });
    t.complete();
    t.probe.onEdit();
    expect(t.reads()).toBe(0);
    expect(t.logs).toEqual([]);
  });

  it("iki okuma tutarlıysa kararı yazar; etkin kısıt turu ikinci mesaj", () => {
    const t = setup([snap(), snap()]);
    t.complete();
    expect(t.logs).toHaveLength(1);
    expect(t.logs[0]).toContain("tur 2, sonuç aşıyor, kural <= 30 kelime, kısıt turu [2], sayım 35 kelime");
  });

  it("günlüğe mesaj ya da cevap metni yazmaz", () => {
    const t = setup([snap(), snap()]);
    t.complete();
    expect(t.logs[0]).not.toContain("demiştim");
    expect(t.logs[0]).not.toContain("kelime0");
  });

  it("ikinci okumada metin değiştiyse ya da üretim sürüyorsa ihlal yazmaz", () => {
    const changed = setup([snap({ assistantText: words(20) }), snap()]);
    changed.complete();
    expect(changed.logs[0]).toContain("değerlendirilemiyor (tamamlanma doğrulanamadı)");
    const busy = setup([snap(), snap({ generating: true })]);
    busy.complete();
    expect(busy.logs[0]).toContain("değerlendirilemiyor (tamamlanma doğrulanamadı)");
  });

  it("yeni cevap beklenirken sayfada kalan eski cevap gönderimle eşleşmez", () => {
    const old = snap({ assistantKey: "fallback-turn-0:1:assistant", assistantAfterUser: false });
    const t = setup([old, old]);
    t.complete();
    expect(t.logs[0]).toContain("değerlendirilemiyor (cevap gönderimle eşleşmedi)");
    expect(t.logs[0]).not.toContain("aşıyor");
  });

  it("son kullanıcı öğesinin metni son gönderimle tutmuyorsa ihlal yazmaz", () => {
    const t = setup([snap({ userText: "başka bir mesaj" }), snap({ userText: "başka bir mesaj" })]);
    t.complete();
    expect(t.logs[0]).toContain("cevap gönderimle eşleşmedi");
  });

  it("aynı cevap için ikinci kayıt üretmez; sıfırlamadan sonra yeniden değerlendirir", () => {
    const t = setup([snap()]);
    t.complete();
    t.complete();
    expect(t.logs).toHaveLength(2);
    expect(t.logs[1]).toContain("aynı cevap, yeni kayıt yok");
    t.probe.reset();
    t.complete();
    expect(t.logs[2]).toContain("sonuç aşıyor");
  });

  it("mesaj düzenlendikten sonra görünür dal belirsiz: ihlal yazmaz", () => {
    const t = setup([snap()]);
    t.probe.onEdit();
    t.complete();
    expect(t.logs[0]).toContain("değerlendirilemiyor (düzenlemeden sonra görünür dal belirsiz)");
  });

  it("ikinci mesaj sınırı yinelemiyorsa önceki sınırı uygulamaz", () => {
    const next = "Şimdi de bana yapay zekanın sağlıktaki kullanım alanlarını anlat.";
    const t = setup([snap({ userText: next }), snap({ userText: next })], { texts: [U1, next] });
    t.complete();
    expect(t.logs[0]).toContain("sonuç değerlendirilemiyor (önceki kısıtın geçerliliği doğrulanamadı)");
  });

  it("adaptör okuma desteklemiyorsa ihlal yazmaz", () => {
    const t = setup([null]);
    t.complete();
    expect(t.logs[0]).toContain("değerlendirilemiyor (cevap okunamadı)");
  });
});
