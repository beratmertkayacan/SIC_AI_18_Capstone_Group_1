import { describe, expect, it } from "vitest";
import { buildFreshStartDraft } from "./fresh-start";

describe("buildFreshStartDraft", () => {
  it("istek yoksa boş metin döner", () => {
    expect(buildFreshStartDraft([])).toBe("");
    expect(buildFreshStartDraft(["", "   "])).toBe("");
  });

  it("istekleri sırayla numaralar", () => {
    const draft = buildFreshStartDraft([
      "İstanbul'da gezilecek iki yer söyle",
      "Almanya'ya vize başvurusu için gereken belgeleri say",
    ]);
    expect(draft).toContain("1. İstanbul'da gezilecek iki yer söyle");
    expect(draft).toContain("2. Almanya'ya vize başvurusu için gereken belgeleri say");
    expect(draft.startsWith("Önceki bir sohbetimde şunları istemiştim:")).toBe(true);
    expect(draft.trimEnd().endsWith("ele alır mısın?")).toBe(true);
  });

  it("benzer yeniden denemeleri tek maddeye indirir, en son hâli bırakır", () => {
    const draft = buildFreshStartDraft([
      "Kısa bir kedi hikayesi yaz, en fazla iki cümle olsun",
      "İstanbul'da gezilecek iki yer söyle",
      "Kısa bir kedi hikayesi yazar mısın, en fazla iki cümle olsun",
    ]);
    expect(draft).not.toContain("yaz, en fazla");
    expect(draft).toContain("1. Kısa bir kedi hikayesi yazar mısın, en fazla iki cümle olsun");
    expect(draft).toContain("2. İstanbul'da gezilecek iki yer söyle");
    expect(draft).not.toContain("3.");
  });

  it("çok satırlı isteği tek satıra indirir", () => {
    const draft = buildFreshStartDraft(["Şunu yap:\n- önce a\n- sonra b"]);
    expect(draft).toContain("1. Şunu yap: - önce a - sonra b");
  });

  it("çok uzun isteği kısaltır", () => {
    const draft = buildFreshStartDraft(["a".repeat(1000)]);
    const line = draft.split("\n").find((l) => l.startsWith("1. "))!;
    expect(line.length).toBeLessThan(420);
    expect(line.endsWith("…")).toBe(true);
  });

  it("kısa mesajlar (devam et) benzerlik nedeniyle birleştirilmez", () => {
    const draft = buildFreshStartDraft(["devam et", "devam et"]);
    expect(draft).toContain("1. devam et");
    expect(draft).toContain("2. devam et");
  });
});
