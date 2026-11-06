// @ts-expect-error: test Node üzerinde çalışır; Node tip tanımları eklenti derlemesine bilerek dahil değil
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../public/manifest.json";

/** PNG başlığından genişlik ve yükseklik (IHDR). */
function pngSize(path: string): [number, number] {
  const b: Uint8Array = readFileSync(new URL(`../public/${path}`, import.meta.url));
  expect(Array.from(b.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

describe("eklenti simgesi", () => {
  it("manifestteki her simge var, PNG ve doğru boyutta (scripts/make_brand_assets.py üretir)", () => {
    const icons = (manifest as { icons: Record<string, string> }).icons;
    for (const [size, path] of Object.entries(icons)) expect(pngSize(path)).toEqual([Number(size), Number(size)]);
  });

  it("araç çubuğu simgeleri de aynı dosyalar", () => {
    const m = manifest as { icons: Record<string, string>; action: { default_icon: Record<string, string> } };
    for (const [size, path] of Object.entries(m.action.default_icon)) expect(m.icons[size]).toBe(path);
  });

  it("pencere ve karşılama ekranı için büyük logo da var", () => {
    expect(pngSize("icons/logo256.png")).toEqual([256, 256]);
  });
});
