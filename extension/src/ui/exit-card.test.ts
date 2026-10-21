// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExitCard } from "./exit-card";

function shadowOf(): ShadowRoot {
  return document.querySelector<HTMLElement>('[data-kafiai="exit-card"]')!.shadowRoot!;
}
/** Kartın görünen metni (stil öğesinin içindeki CSS hariç). */
function visibleText(): string {
  return shadowOf().querySelector(".strip")!.textContent ?? "";
}
function buttonByText(text: string): HTMLButtonElement {
  return Array.from(shadowOf().querySelectorAll("button")).find((b) => b.textContent === text)!;
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function actions(copied = true) {
  return {
    getDraft: vi.fn(() => "1. ilk istek\n2. ikinci istek"),
    onFreshStart: vi.fn().mockResolvedValue(copied),
    onDismiss: vi.fn(),
  };
}

describe("ExitCard", () => {
  const card = new ExitCard();
  afterEach(() => card.hide());

  it("tur sayısını söyler ve üç düğme sunar", () => {
    card.show(document.body, 7, actions());
    expect(visibleText()).toContain("Bu sohbet 7. turunda.");
    for (const label of ["Taze başlat", "Kısa ara ver", "Kapat"]) expect(buttonByText(label)).toBeTruthy();
  });

  it("doğrulanmamış istatistik veya yargılayıcı söz içermez", () => {
    card.show(document.body, 7, actions());
    const text = visibleText().toLowerCase();
    for (const bad of ["bağımlı", "risk", "tehlike", "çoğu", "%"]) expect(text).not.toContain(bad);
  });

  it("'Kapat' kartı kapatır ve bildirir", () => {
    const a = actions();
    card.show(document.body, 7, a);
    buttonByText("Kapat").click();
    expect(a.onDismiss).toHaveBeenCalledWith("kapat");
    expect(card.visible).toBe(false);
  });

  it("Escape kartı kapatır", () => {
    const a = actions();
    card.show(document.body, 7, a);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(a.onDismiss).toHaveBeenCalledWith("kapat");
    expect(card.visible).toBe(false);
  });

  it("'Kısa ara ver' sakin bir cümle gösterir, baskı yapmaz", () => {
    const a = actions();
    card.show(document.body, 7, a);
    buttonByText("Kısa ara ver").click();
    expect(visibleText()).toContain("Sohbet burada duruyor");
    expect(card.visible).toBe(true);
    buttonByText("Kapat").click();
    expect(a.onDismiss).toHaveBeenCalledWith("ara");
  });

  it("'Taze başlat' düzenlenebilir taslağı gösterir", () => {
    const a = actions();
    card.show(document.body, 7, a);
    buttonByText("Taze başlat").click();
    const area = shadowOf().querySelector("textarea")!;
    expect(area.value).toBe("1. ilk istek\n2. ikinci istek");
    expect(a.getDraft).toHaveBeenCalledTimes(1);
  });

  it("kullanıcının düzenlediği metin kopyalanmak üzere iletilir", async () => {
    const a = actions();
    card.show(document.body, 7, a);
    buttonByText("Taze başlat").click();
    shadowOf().querySelector("textarea")!.value = "düzenlenmiş taslak";
    buttonByText("Kopyala ve yeni sohbet aç").click();
    await flush();
    expect(a.onFreshStart).toHaveBeenCalledWith("düzenlenmiş taslak");
    expect(visibleText()).toContain("Panoya kopyalandı");
    buttonByText("Kapat").click();
    expect(a.onDismiss).toHaveBeenCalledWith("taze");
  });

  it("kopyalama başarısız olursa kart açık kalır ve açıklar", async () => {
    const a = actions(false);
    card.show(document.body, 7, a);
    buttonByText("Taze başlat").click();
    buttonByText("Kopyala ve yeni sohbet aç").click();
    await flush();
    expect(card.visible).toBe(true);
    expect(visibleText()).toContain("Kopyalanamadı");
    expect(buttonByText("Kopyala ve yeni sohbet aç").disabled).toBe(false);
    expect(a.onDismiss).not.toHaveBeenCalled();
  });

  it("'Geri' ana görünüme döner", () => {
    card.show(document.body, 7, actions());
    buttonByText("Taze başlat").click();
    buttonByText("Geri").click();
    expect(buttonByText("Taze başlat")).toBeTruthy();
  });

  it("art arda show() tek kart bırakır", () => {
    card.show(document.body, 7, actions());
    card.show(document.body, 8, actions());
    expect(document.querySelectorAll('[data-kafiai="exit-card"]').length).toBe(1);
  });
});
