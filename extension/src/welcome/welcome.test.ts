// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountWelcome, PRIVACY, WELCOME_LEAD, WELCOME_TEXTS, WELCOME_TITLE } from "./welcome";

let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  root = document.getElementById("root")!;
});

describe("karşılama ekranı", () => {
  it("Figma'daki sırayla başlık, giriş, dört bölüm ve düğmeyi gösterir", () => {
    mountWelcome(root, () => {});
    expect(root.querySelector("h1")?.textContent).toBe(WELCOME_TITLE);
    expect(root.querySelector(".tagline")?.textContent).toBe("Fark et. Durakla. Yeniden başla.");
    expect(root.querySelector(".lead")?.textContent).toBe(WELCOME_LEAD);
    expect(Array.from(root.querySelectorAll("h2")).map((h) => h.textContent)).toEqual(["Ne Göreceksin", "Gizliliğin", "Başlamadan Önce"]);
    expect(Array.from(root.querySelectorAll(".feature-kicker")).map((h) => h.textContent)).toEqual(["Fark et.", "Durakla.", "Yeniden başla."]);
    expect(Array.from(root.querySelectorAll(".privacy-row dt")).map((h) => h.textContent)).toEqual(PRIVACY.map((p) => p.title));
    expect(root.querySelectorAll(".steps li").length).toBe(3);
    expect(root.querySelector("button")?.textContent).toBe("Anladım");
  });

  it("cevabı nasıl okuduğunu doğru söyler: yalnızca başı ve sonu, kaydetmeden", () => {
    mountWelcome(root, () => {});
    const text = root.textContent ?? "";
    expect(text).toContain("Gönder'e bastığın anda");
    expect(text).toContain("Cevabın tamamını okumaz; yalnızca başına ve sonuna bakar");
    expect(text).toContain("Yazdığın tuşları kaydetmez");
    expect(text).not.toContain("Cevabın metnini okumaz");
    expect(text).toContain("Hiçbir mesaj cihazından çıkmaz");
    expect(text).toContain("Mesaj metni kaydedilmez");
    expect(text).toContain("90 gün");
  });

  it("çizimler ekran okuyucudan gizlidir", () => {
    mountWelcome(root, () => {});
    const arts = Array.from(root.querySelectorAll(".art"));
    expect(arts.length).toBe(3);
    for (const a of arts) expect(a.getAttribute("aria-hidden")).toBe("true");
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

  it("HTML eklenmez: yalnızca eklentinin kendi logosu, betik ya da bağlantı yok", () => {
    mountWelcome(root, () => {});
    expect(root.querySelectorAll("script, a").length).toBe(0);
    expect(Array.from(root.querySelectorAll("img")).map((i) => i.getAttribute("src"))).toEqual(["icons/logo256.png"]);
    expect(WELCOME_TEXTS.every((l) => !/[<>]/.test(l))).toBe(true);
  });
});
