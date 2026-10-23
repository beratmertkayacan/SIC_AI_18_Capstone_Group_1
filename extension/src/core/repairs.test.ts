import { describe, expect, it } from "vitest";
import { REPAIRS } from "./repairs";

describe("REPAIRS", () => {
  it("kimlikler benzersiz, cümleler dolu", () => {
    expect(new Set(REPAIRS.map((r) => r.id)).size).toBe(REPAIRS.length);
    for (const r of REPAIRS) {
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.sentence.trim().length).toBeGreaterThan(10);
    }
  });

  it("yargılayıcı söz içermez", () => {
    const all = REPAIRS.map((r) => `${r.label} ${r.sentence}`).join(" ").toLowerCase();
    for (const bad of ["bağımlı", "risk", "tehlike"]) expect(all).not.toContain(bad);
  });
});
