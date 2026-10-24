import { describe, expect, it } from "vitest";
import fixture from "../../../tests/fixtures/turn_model_parity.json";
import { hasStrongRepair } from "./strong-repair";
import { turnFeatures } from "./turn-features";
import { predict } from "./turn-model";

/**
 * Python ikiziyle ortak örnekler (scripts/make_turn_parity_fixture.py üretir,
 * tests/test_turn_model.py de okur). Öznitelikler, olasılık, seviye ve gerekçeler aynı olmalı.
 */
type Row = {
  messages: string[];
  features: Record<string, number>;
  probability: number;
  level: string;
  reasons: string[];
};

const rows = fixture.conversations as Row[];

describe("güçlü onarım ifadesi, Python ile aynı", () => {
  it.each(fixture.repairs)("$text", (row) => {
    expect(hasStrongRepair(row.text)).toBe(row.strong_repair);
  });
});

describe("tur modeli, Python ile aynı", () => {
  it.each(rows.map((r) => ({ ...r, name: r.messages.map((m) => m.slice(0, 20)).join(" | ") })))("$name", (row) => {
    const features = turnFeatures(row.messages);
    for (const [name, value] of Object.entries(row.features)) {
      expect(features[name], name).toBeCloseTo(value, 9);
    }
    const result = predict(features);
    expect(result.probability).toBeCloseTo(row.probability, 9);
    expect(result.level).toBe(row.level);
    expect(result.reasons.map((r) => r.key)).toEqual(row.reasons);
  });
});
