import { describe, expect, it } from "vitest";
import fixture from "../../../tests/fixtures/week_report_parity.json";
import type { CountsV2 } from "./counters";
import { percent, shiftWeek, weekDays, weekReport, weekStart } from "./week-report";

const at = (day: string) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
};

describe("haftalık özet hesabı", () => {
  it("Python ile aynı sonucu verir", () => {
    for (const c of fixture) {
      expect(weekReport({ v: 2, days: c.days } as unknown as CountsV2, c.start)).toEqual(c.expected);
    }
  });

  it("hafta Pazartesi başlar, Pazar biter; ay, yıl ve yaz saati geçişinde de", () => {
    expect(weekStart(at("2026-11-18"))).toBe("2026-11-16");
    expect(weekStart(at("2026-11-22"))).toBe("2026-11-16");
    expect(weekStart(at("2026-11-23"))).toBe("2026-11-23");
    expect(weekDays("2026-12-28")).toEqual([
      "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
    ]);
    expect(weekDays("2026-03-23")[6]).toBe("2026-03-29");
    expect(shiftWeek("2026-11-16", 12)).toBe("2026-08-24");
  });

  it("çıktıda metin yok: yalnızca sayılar, tarih ve şemadaki sabit sözcükler", () => {
    const r = weekReport({ v: 2, days: fixture[2]!.days } as unknown as CountsV2, fixture[2]!.start);
    const words = JSON.stringify(r).match(/"[^"]*"/g) ?? [];
    for (const w of words) expect(w).toMatch(/^"([a-z_0-9-]+|\d{4}-\d{2}-\d{2}|\d+-\d+|11\+)"$/);
  });

  it("yüzde: toplam sıfırsa sıfır, değilse yuvarlanır", () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(5, 34)).toBe(15);
    expect(percent(23, 34)).toBe(68);
  });
});
