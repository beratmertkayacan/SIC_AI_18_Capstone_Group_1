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

describe("ConstraintProbe kısıt notu", () => {
  const U3new = "Şimdi de bana yapay zekanın sağlıktaki kullanım alanlarını anlat.";
  const RAISE = "30 kelime sınırını 50'ye çıkarıyorum, biraz daha ayrıntılı yaz.";
  const turn = (i: number, user: string, n: number, extra: Partial<ExchangeSnapshot> = {}) =>
    snap({ userKey: `fallback-turn-${i}:0:user`, assistantKey: `fallback-turn-${i}:1:assistant`, userText: user, assistantText: words(n), ...extra });

  /** Turları sırayla oynatır: her tur için kullanıcı mesajları ve okunacak cevap. */
  function play(steps: { texts: string[]; read: ExchangeSnapshot }[], opts: { note?: boolean; edit?: number } = {}) {
    const logs: string[] = [];
    const notes: { key: string; text: string }[] = [];
    let current = steps[0]!;
    const probe = new ConstraintProbe({
      enabled: () => true,
      read: () => current.read,
      userTexts: () => ({ texts: current.texts, hidden: 0 }),
      log: (l) => logs.push(l),
      schedule: (fn) => fn(),
      noteEnabled: () => opts.note ?? true,
      showNote: (key, text) => (notes.push({ key, text }), true),
    }, 0);
    steps.forEach((s, i) => {
      current = s;
      if (opts.edit === i) probe.onEdit();
      probe.onResponseComplete();
    });
    return { logs, notes, probe, again: () => probe.onResponseComplete() };
  }
  const main = [
    { texts: [U1], read: turn(0, U1, 53) },
    { texts: [U1, U2], read: turn(1, U2, 35) },
  ];

  it("ana akış: ikinci cevabın altında bir kez not; metin sınırı ve sayımı anar", () => {
    const t = play(main);
    expect(t.notes).toHaveLength(1);
    expect(t.notes[0]!.key).toBe("fallback-turn-1:1:assistant");
    expect(t.notes[0]!.text).toContain("30 kelime sınırını aşıyor (35 kelime)");
    t.again(); // aynı cevap yeniden okunursa ikinci not yok
    expect(t.notes).toHaveLength(1);
  });

  it("not bayrağı kapalıyken not yok (karar yine yazılır)", () => {
    const t = play(main, { note: false });
    expect(t.notes).toHaveLength(0);
    expect(t.logs.some((l) => l.includes("tur 2, sonuç aşıyor"))).toBe(true);
  });

  it("ikinci cevap sınıra uyuyorsa not yok", () => {
    expect(play([main[0]!, { texts: [U1, U2], read: turn(1, U2, 30) }]).notes).toHaveLength(0);
  });

  it("sınır değiştiyse (30'dan 50'ye) not yok", () => {
    expect(play([main[0]!, { texts: [U1, RAISE], read: turn(1, RAISE, 60) }]).notes).toHaveLength(0);
  });

  it("ikinci mesaj sınırı yinelemiyorsa not yok", () => {
    expect(play([main[0]!, { texts: [U1, U3new], read: turn(1, U3new, 35) }]).notes).toHaveLength(0);
  });

  it("eşleşme belirsizse (eski cevap, düzenleme) not yok", () => {
    const stale = play([main[0]!, { texts: [U1, U2], read: turn(1, U2, 35, { assistantKey: "fallback-turn-0:1:assistant" }) }]);
    expect(stale.notes).toHaveLength(0);
    expect(play(main, { edit: 1 }).notes).toHaveLength(0);
  });

  it("ilk cevap belirsiz kaldıysa ardışık ihlal zinciri kurulmaz", () => {
    const t = play([{ texts: [U1], read: turn(0, U1, 53, { generating: true }) }, main[1]!]);
    expect(t.notes).toHaveLength(0);
  });
});
