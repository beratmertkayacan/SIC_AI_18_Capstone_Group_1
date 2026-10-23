import { HASH_DIM, NGRAM_SIZE } from "../config";

/** FNV-1a 32 bit: Python ikizinde birebir aynı yazılabilsin diye basit tutuldu. */
function fnv1a(chars: string[]): number {
  let hash = 0x811c9dc5;
  for (const ch of chars.join("")) {
    const cp = ch.codePointAt(0)!;
    hash ^= cp;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Normalize edilmiş metni karakter n-gram sayım vektörüne (seyrek) çevirir. */
export function ngramVector(normalized: string, n: number = NGRAM_SIZE, dim: number = HASH_DIM): Map<number, number> {
  const chars = Array.from(` ${normalized} `);
  const vec = new Map<number, number>();
  for (let i = 0; i + n <= chars.length; i++) {
    const bucket = fnv1a(chars.slice(i, i + n)) % dim;
    vec.set(bucket, (vec.get(bucket) ?? 0) + 1);
  }
  return vec;
}

export function cosine(a: Map<number, number>, b: Map<number, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [k, v] of a) {
    na += v * v;
    const w = b.get(k);
    if (w !== undefined) dot += v * w;
  }
  for (const v of b.values()) nb += v * v;
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

/** İki normalize edilmiş metnin benzerliği, 0 ile 1 arası. */
export function similarity(a: string, b: string): number {
  return cosine(ngramVector(a), ngramVector(b));
}
