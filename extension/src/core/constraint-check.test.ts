// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import rows from "../../../tests/fixtures/constraint_parity.json";
import { responseText } from "../adapters/response-text";
import { countWords, decideConstraint } from "./constraint-check";

/**
 * Python ikiziyle (src/kafiai/constraint_check.py) ortak örnekler; aynı dosyayı tests/test_constraint_check.py
 * de okur. İki taraf aynı sonucu, aynı etkin kısıt turunu ve aynı sayımları vermeli.
 */
type Row = {
  name: string;
  user_texts: string[];
  turn: number;
  answer: string;
  earlier_unknown: boolean;
  result: string;
  constraint_turn: number | null;
  rule: { n: number; unit: string; kind: string } | null;
  words: number;
  chars: number;
  chars_no_space: number;
  reason: string;
};

describe("Python ikiziyle eşleşme (kısıt kontrolü)", () => {
  it.each(rows as Row[])("$name", (row) => {
    const d = decideConstraint(row.user_texts, row.turn, row.answer, row.earlier_unknown);
    expect(d.result).toBe(row.result);
    expect(d.constraintTurn).toBe(row.constraint_turn);
    expect(d.constraint ? { n: d.constraint.n, unit: d.constraint.unit, kind: d.constraint.kind } : null).toEqual(row.rule);
    expect([d.words, d.chars, d.charsNoSpace]).toEqual([row.words, row.chars, row.chars_no_space]);
    expect(d.reason).toBe(row.reason);
  });
});

describe("kısıt kontrolü", () => {
  it("cevap özetiyle değil tam metinle sayar: özet uzun cevabı eksik sayar", () => {
    const long = (rows as Row[]).find((r) => r.name === "özet uzunluğunu aşan tam cevap")!;
    const el = document.createElement("div");
    el.textContent = long.answer;
    const summary = responseText(el) ?? "";
    expect(countWords(long.answer)).toBe(170);
    expect(countWords(summary)).toBeLessThan(150); // özetle sayılsaydı "uyuyor" çıkardı
    expect(decideConstraint(long.user_texts, 1, long.answer).result).toBe("aşıyor");
  });
});
