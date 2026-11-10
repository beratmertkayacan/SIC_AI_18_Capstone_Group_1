import { describe, expect, it } from "vitest";
import { EXIT_CARD_COOLDOWN_TURNS, EXIT_CARD_MIN_TURNS } from "../config";
import { ExitCardPolicy } from "./exit-card-policy";
import { taskNorm } from "./tasks";

describe("ExitCardPolicy", () => {
  it("tekrar denemesi olmadan, sohbet ne kadar uzun olursa olsun göstermez", () => {
    const p = new ExitCardPolicy();
    expect(p.shouldShow(EXIT_CARD_MIN_TURNS + 20)).toBe(false);
  });

  it("tekrar denemesi var ama sohbet kısaysa göstermez", () => {
    const p = new ExitCardPolicy();
    p.noteRepeat();
    expect(p.shouldShow(EXIT_CARD_MIN_TURNS - 1)).toBe(false);
  });

  it("tur sınırına ulaşıp tekrar denemesi olduysa gösterir", () => {
    const p = new ExitCardPolicy();
    p.noteRepeat();
    expect(p.shouldShow(EXIT_CARD_MIN_TURNS)).toBe(true);
  });

  it("kapatılınca bekleme süresi boyunca göstermez, sonra yine gösterir", () => {
    const p = new ExitCardPolicy();
    p.noteRepeat();
    p.dismissed(EXIT_CARD_MIN_TURNS);
    expect(p.shouldShow(EXIT_CARD_MIN_TURNS + 1)).toBe(false);
    expect(p.shouldShow(EXIT_CARD_MIN_TURNS + EXIT_CARD_COOLDOWN_TURNS - 1)).toBe(false);
    expect(p.shouldShow(EXIT_CARD_MIN_TURNS + EXIT_CARD_COOLDOWN_TURNS)).toBe(true);
  });

  it("reset() her şeyi sıfırlar", () => {
    const p = new ExitCardPolicy();
    p.noteRepeat();
    p.dismissed(EXIT_CARD_MIN_TURNS);
    p.reset();
    expect(p.shouldShow(EXIT_CARD_MIN_TURNS)).toBe(false); // tekrar denemesi de silindi
    p.noteRepeat();
    expect(p.shouldShow(EXIT_CARD_MIN_TURNS)).toBe(true);
  });
});

describe("ExitCardPolicy görev normları", () => {
  it("görev türü bilinince tur sınırı o türün normundan gelir", () => {
    const p = new ExitCardPolicy();
    p.setTask("ceviri");
    const norm = taskNorm("ceviri")!;
    expect(p.minTurns).toBe(Math.floor(norm.p90_turns) + 1);
    p.noteRepeat();
    expect(p.shouldShow(p.minTurns - 1)).toBe(false);
    expect(p.shouldShow(p.minTurns)).toBe(true);
  });

  it("görev türü yalnızca ilk kez ayarlanır", () => {
    const p = new ExitCardPolicy();
    p.setTask("kod");
    const first = p.norm;
    p.setTask("ceviri");
    expect(p.norm).toBe(first);
  });

  it("reset() görev türünü de siler", () => {
    const p = new ExitCardPolicy();
    p.setTask("ceviri");
    p.reset();
    expect(p.norm).toBeNull();
    expect(p.minTurns).toBe(EXIT_CARD_MIN_TURNS);
  });
});

describe("ExitCardPolicy tur modeli", () => {
  it("model yüksek risk dediğinde kart tur sınırını beklemeden o turda açılabilir", () => {
    const p = new ExitCardPolicy();
    p.setTask("kod");
    expect(p.shouldShow(3)).toBe(false);
    p.noteRisk("yuksek", 3);
    expect(p.shouldShow(3)).toBe(true);
    expect(p.modelTriggered(3)).toBe(true);
    expect(p.shouldShow(4)).toBe(false); // yalnızca tahminin yapıldığı tur
  });

  it("'oneri' ve 'dusuk' seviyeleri kartı açmaz", () => {
    const p = new ExitCardPolicy();
    p.noteRisk("oneri", 3);
    p.noteRisk("dusuk", 4);
    expect(p.shouldShow(3)).toBe(false);
    expect(p.shouldShow(4)).toBe(false);
  });

  it("bekleme süresi model kaynaklı kart için de geçerli", () => {
    const p = new ExitCardPolicy();
    p.noteRisk("yuksek", 3);
    p.dismissed(3);
    p.noteRisk("yuksek", 5);
    expect(p.shouldShow(5)).toBe(false);
    expect(p.modelTriggered(5)).toBe(false);
  });

  it("reset() model tahminini de siler", () => {
    const p = new ExitCardPolicy();
    p.noteRisk("yuksek", 3);
    p.reset();
    expect(p.shouldShow(3)).toBe(false);
  });
});

describe("ExitCardPolicy tetiklenme kaynağı", () => {
  it("model yolu norm yolundan önce gelir; bekleme süresi kaynağı değiştirmez", () => {
    const p = new ExitCardPolicy();
    expect(p.triggerSource(3)).toBeNull();
    p.noteRepeat();
    expect(p.triggerSource(p.minTurns)).toBe("norm");
    p.noteRisk("yuksek", p.minTurns);
    expect(p.triggerSource(p.minTurns)).toBe("model");
    p.dismissed(p.minTurns);
    expect(p.inCooldown(p.minTurns + 1)).toBe(true);
    expect(p.triggerSource(p.minTurns + 1)).toBe("norm");
    expect(p.shouldShow(p.minTurns + 1)).toBe(false);
  });
});

describe("ExitCardPolicy: sohbet sinyalleri (K32)", () => {
  it("üst üste iki özür kartı tur sınırını beklemeden açar", () => {
    const p = new ExitCardPolicy();
    p.noteApologies(1, 2);
    expect(p.triggerSource(2)).toBeNull();
    p.noteApologies(2, 3);
    expect(p.triggerSource(3)).toBe("ozur");
    expect(p.shouldShow(3)).toBe(true);
    p.dismissed(3);
    expect(p.shouldShow(4)).toBe(false);
  });

  it("döngüden çıkış ya da konu değişimi eski tekrarların kartı açmasını engeller", () => {
    const p = new ExitCardPolicy();
    p.noteRepeat();
    expect(p.triggerSource(p.minTurns)).toBe("norm");
    p.clearRepeats();
    expect(p.triggerSource(p.minTurns)).toBeNull();
  });
});

describe("ExitCardPolicy: uzun sohbette döngü işareti (K33)", () => {
  it("tur sınırı tek başına yetmez; modelin öneri seviyesi ya da yakın benzer mesaj gerekir", () => {
    const p = new ExitCardPolicy();
    expect(p.triggerSource(p.minTurns)).toBeNull();
    p.noteRisk("oneri", p.minTurns);
    expect(p.triggerSource(p.minTurns)).toBe("norm");
    expect(p.triggerSource(p.minTurns + 1)).toBeNull(); // öneri yalnızca o turda geçerli
    p.setRepeats(1);
    expect(p.triggerSource(p.minTurns + 1)).toBe("norm");
    p.setRepeats(0);
    expect(p.triggerSource(p.minTurns + 1)).toBeNull();
  });

  it("öneri seviyesi tur sınırından önce kart açmaz", () => {
    const p = new ExitCardPolicy();
    p.noteRisk("oneri", 2);
    expect(p.triggerSource(2)).toBeNull();
  });
});
