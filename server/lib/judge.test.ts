import { describe, expect, it } from "vitest";
import { kararDuzelt, sohbetMetni, SPEC, turlariAl, type Karar } from "./judge.js";

const karar = (o: Partial<Karar> = {}): Karar => ({
  ayni_istek: false, onceki_istek_turu: -1, onceki_cevap_karsiladi: "belirsiz", tikanma: false,
  ozur_dongusu: false, tur: "yok", dongu: false, guven: 0.2, gerekce: "", oneri: "", ...o,
});

describe("turlariAl", () => {
  it("geçersiz gövdeyi reddeder", () => {
    expect(turlariAl(null)).toBeNull();
    expect(turlariAl({ turlar: [] })).toBeNull();
    expect(turlariAl({ turlar: [{ rol: "x", metin: "a" }] })).toBeNull();
    expect(turlariAl({ turlar: [{ rol: "a", metin: "yalnız asistan" }] })).toBeNull();
  });
  it("uzun metni keser, fazla turu baştan atar", () => {
    const uzun = "a".repeat(5000);
    const turlar = Array.from({ length: 20 }, (_, i) => ({ rol: i % 2 ? "a" : "k", metin: uzun }));
    const out = turlariAl({ turlar })!;
    expect(out).toHaveLength(SPEC.sinirlar.en_fazla_tur);
    expect(out.find((t) => t.rol === "k")!.metin).toHaveLength(SPEC.sinirlar.kullanici_mesaji_karakter);
    expect(out.find((t) => t.rol === "a")!.metin).toHaveLength(SPEC.sinirlar.asistan_cevabi_karakter);
  });
});

describe("sohbetMetni", () => {
  it("son kullanıcı mesajını işaretler ve etiketle sarar", () => {
    const m = sohbetMetni([{ rol: "k", metin: "bir" }, { rol: "a", metin: "iki" }, { rol: "k", metin: "üç" }, { rol: "a", metin: "dört" }]);
    expect(m.startsWith("<sohbet>\n[Tur 1] Kullanıcı:\nbir")).toBe(true);
    expect(m).toContain("[Tur 3] SON kullanıcı mesajı:\nüç");
    expect(m.endsWith("[Tur 4] Asistan:\ndört\n</sohbet>")).toBe(true);
  });
});

describe("kararDuzelt", () => {
  it("güveni sınırlar, döngü yoksa metni siler", () => {
    expect(kararDuzelt(karar({ guven: 3 })).guven).toBe(1);
    expect(kararDuzelt(karar({ guven: Number.NaN })).guven).toBe(0);
    expect(kararDuzelt(karar({ gerekce: "x", oneri: "y" })).gerekce).toBe("");
  });
  it("döngüde metni kısaltır", () => {
    const k = kararDuzelt(karar({ dongu: true, gerekce: "g".repeat(500), oneri: " İstersen " + "o".repeat(500) }));
    expect(k.gerekce).toHaveLength(SPEC.sinirlar.gerekce_karakter);
    expect(k.oneri.startsWith("İstersen")).toBe(true);
    expect(k.oneri).toHaveLength(SPEC.sinirlar.oneri_karakter);
  });
});
