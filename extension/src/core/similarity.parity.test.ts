import { describe, expect, it } from "vitest";
import rows from "../../../tests/fixtures/similarity_parity.json";
import { similarity } from "./similarity";
import { normalizeText } from "./text";

/**
 * Python ikiziyle (src/kafiai/extension_similarity.py) ortak örnekler.
 * Aynı dosyayı tests/test_extension_parity.py de okur; iki taraf aynı sayıyı vermeli.
 */
const fixture = rows as { a: string; b: string; normalized_a: string; normalized_b: string; similarity: number }[];

describe("Python ikiziyle eşleşme", () => {
  it.each(fixture)("$a / $b", (row) => {
    expect(normalizeText(row.a)).toBe(row.normalized_a);
    expect(normalizeText(row.b)).toBe(row.normalized_b);
    expect(similarity(row.normalized_a, row.normalized_b)).toBeCloseTo(row.similarity, 12);
  });
});
