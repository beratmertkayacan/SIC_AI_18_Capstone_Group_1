import { describe, expect, it } from "vitest";
import { ringLevel, ringText } from "./ring";

const pred = (level: "dusuk" | "oneri" | "yuksek", why = "Son mesajında bir önceki cevabın işe yaramadığını söyledin.") => ({
  level,
  reasons: [{ key: "last_strong_repair", short: "", why, tip: "" }],
});

describe("halka seviyesi", () => {
  it("sinyal yokken sakin", () => {
    expect(ringLevel({ prediction: null, similarCount: 0 })).toBe(0);
    expect(ringLevel({ prediction: pred("dusuk"), similarCount: 0 })).toBe(0);
  });
  it("öneri eşiği ya da bir benzer mesaj: belirgin", () => {
    expect(ringLevel({ prediction: pred("oneri"), similarCount: 0 })).toBe(1);
    expect(ringLevel({ prediction: null, similarCount: 1 })).toBe(1);
  });
  it("yüksek güven ya da iki benzer mesaj: koyu", () => {
    expect(ringLevel({ prediction: pred("yuksek"), similarCount: 0 })).toBe(2);
    expect(ringLevel({ prediction: pred("dusuk"), similarCount: 2 })).toBe(2);
  });
});

describe("halka açıklaması", () => {
  it("ölçülen benzerliği önce söyler, yoksa modelin gerekçesini", () => {
    expect(ringText({ prediction: null, similarCount: 0 })).toBe("Şu an dikkat çeken bir şey yok.");
    expect(ringText({ prediction: null, similarCount: 3 })).toContain("3 tanesi");
    expect(ringText({ prediction: pred("oneri"), similarCount: 1 })).toContain("biri öncekine");
    expect(ringText({ prediction: pred("yuksek"), similarCount: 0 })).toContain("işe yaramadığını");
  });
  it("yargılayıcı söz yok", () => {
    for (const similarCount of [0, 1, 2, 5]) {
      for (const level of ["dusuk", "oneri", "yuksek"] as const) {
        const t = ringText({ prediction: pred(level), similarCount }).toLowerCase();
        for (const bad of ["bağımlı", "risk", "tehlike", "%", "uyarı"]) expect(t).not.toContain(bad);
      }
    }
  });
});
