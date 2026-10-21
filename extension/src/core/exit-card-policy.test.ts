import { describe, expect, it } from "vitest";
import { EXIT_CARD_COOLDOWN_TURNS, EXIT_CARD_MIN_TURNS } from "../config";
import { ExitCardPolicy } from "./exit-card-policy";

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
