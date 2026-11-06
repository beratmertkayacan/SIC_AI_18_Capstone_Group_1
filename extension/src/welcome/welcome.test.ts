// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountWelcome, WELCOME_LEAD, WELCOME_SECTIONS } from "./welcome";

let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  root = document.getElementById("root")!;
});

describe("karşılama ekranı", () => {
  it("başlık, giriş, beş bölüm ve düğmeyi gösterir", () => {
    mountWelcome(root, () => {});
    expect(root.querySelector("h1")?.textContent).toBe("Kâfi'ye hoş geldin");
    expect(root.querySelector(".tagline")?.textContent).toBe("Fark et. Durakla. Yeniden başla.");
    expect(root.querySelector(".lead")?.textContent).toBe(WELCOME_LEAD);
    expect(Array.from(root.querySelectorAll("h2")).map((h) => h.textContent)).toEqual([
      "Neye bakar",
      "Neye bakmaz",
      "Verin nerede durur",
      "Ne göreceksin",
      "İstediğin zaman kapatabilirsin",
    ]);
    expect(root.querySelector("button")?.textContent).toBe("Anladım");
  });

  it("neye baktığını, neye bakmadığını ve verinin cihazdan çıkmadığını söyler", () => {
    mountWelcome(root, () => {});
    const text = root.textContent ?? "";
    expect(text).toContain("Gönder'e bastığın anda");
    expect(text).toContain("Cevabın metnini okumaz");
    expect(text).toContain("Klavyede bastığın tuşlara");
    expect(text).toContain("Hiçbir mesaj bilgisayarından çıkmaz");
    expect(text).toContain("Mesaj metni kaydedilmez");
    expect(text).toContain("90 gün");
  });

  it("Anladım düğmesi close'u çağırır", () => {
    const close = vi.fn();
    mountWelcome(root, close);
    (root.querySelector("button") as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("yargılayıcı ya da doğrulanmamış söz içermez", () => {
    mountWelcome(root, () => {});
    const text = (root.textContent ?? "").toLowerCase();
    for (const bad of ["bağımlı", "risk", "tehlike", "seri", "rozet", "puan"]) expect(text).not.toContain(bad);
  });

  it("HTML eklenmez: etiket gibi görünen metin düz metin kalır", () => {
    mountWelcome(root, () => {});
    expect(root.querySelectorAll("script, a").length).toBe(0);
    const imgs = Array.from(root.querySelectorAll("img"));
    expect(imgs.map((i) => i.getAttribute("src"))).toEqual(["icons/logo256.png"]); // yalnızca eklentinin kendi logosu
    expect(WELCOME_SECTIONS.every((s) => s.lines.every((l) => !/[<>]/.test(l)))).toBe(true);
  });
});
