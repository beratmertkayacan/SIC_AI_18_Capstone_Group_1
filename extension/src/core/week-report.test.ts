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
    for (const c of fixture as { start: string; from?: string; days: unknown; expected: unknown }[]) {
      expect(weekReport({ v: 2, days: c.days } as unknown as CountsV2, c.start, c.from ?? null)).toEqual(c.expected);
    }
  });

  it("fikstür yeni olayları da içerir: loop_end, kart, Yön sende, kartta yerinde değildi ve başlangıç günü", () => {
    const all = fixture.map((c) => c.expected as Record<string, unknown> & { loop_ends: Record<string, number>; hints: Record<string, number>; not_helpful: Record<string, number>; cards_shown: number });
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    expect(all.some((e) => sum(e.loop_ends) > 0)).toBe(true);
    expect(all.some((e) => e.cards_shown > 0)).toBe(true);
    expect(all.some((e) => sum(e.hints) > 0)).toBe(true);
    expect(all.some((e) => e.not_helpful.card! > 0)).toBe(true);
    expect(fixture.some((c) => "from" in c)).toBe(true);
  });

  it("başlangıç günü verilirse ondan önceki günler bu haftaya da geçen haftaya da girmez", () => {
    const days = {
      "2026-11-10": { phase: "oneri", c: { "conversation|chatgpt|kod|1-3|kisa|normal": 6 } },
      "2026-11-17": { phase: "oneri", c: { "conversation|chatgpt|kod|1-3|kisa|normal": 2, "loop_end|chatgpt|kod|1-3|birakildi": 1 } },
      "2026-11-19": { phase: "oneri", c: { "conversation|chatgpt|kod|1-3|kisa|normal": 3, "loop_end|chatgpt|kod|1-3|toparlandi": 2 } },
    };
    const counts = { v: 2, days } as unknown as CountsV2;
    const all = weekReport(counts, "2026-11-16");
    expect(all.conversations).toBe(5);
    expect(all.previous.conversations).toBe(6);
    expect(all.loop_ends).toEqual({ toparlandi: 2, yeni_sohbet: 0, birakildi: 1 });
    const fresh = weekReport(counts, "2026-11-16", "2026-11-18");
    expect(fresh.conversations).toBe(3);
    expect(fresh.previous.conversations).toBe(0);
    expect(fresh.loop_ends).toEqual({ toparlandi: 2, yeni_sohbet: 0, birakildi: 0 });
    expect(fresh.tasks.find((t) => t.task === "kod")?.loop_ends).toBe(2);
    expect(fresh.days[3]!.loop_ends).toBe(2);
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
