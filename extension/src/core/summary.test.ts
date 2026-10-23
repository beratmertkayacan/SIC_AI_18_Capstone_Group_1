import { describe, expect, it } from "vitest";
import { recentTotals } from "./summary";

describe("recentTotals", () => {
  const now = new Date(2026, 9, 21, 12);

  it("boş sayaçta hepsi sıfırdır", () => {
    const t = recentTotals({}, now);
    expect(Object.values(t).every((n) => n === 0)).toBe(true);
  });

  it("son 7 günü (bugün dahil) toplar, daha eskiyi saymaz", () => {
    const t = recentTotals(
      {
        "2026-10-21": { stripShown: 2 },
        "2026-10-15": { stripShown: 1, freshStart: 1 }, // 6 gün önce: dahil
        "2026-10-14": { stripShown: 10 }, // 7 gün önce: dahil değil
      },
      now,
    );
    expect(t.stripShown).toBe(3);
    expect(t.freshStart).toBe(1);
  });

  it("gelecekteki günü saymaz", () => {
    expect(recentTotals({ "2026-10-22": { stripShown: 5 } }, now).stripShown).toBe(0);
  });
});
