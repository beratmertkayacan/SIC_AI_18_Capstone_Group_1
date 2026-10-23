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
