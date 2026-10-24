// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExitCard, exitCardMessage, MODEL_NOTE, modelCardMessage } from "./exit-card";

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
    card.show(document.body, 7, null, actions());
    expect(visibleText()).toContain("Bu sohbet 7. turunda.");
    for (const label of ["Taze başlat", "Kısa ara ver", "Kapat"]) expect(buttonByText(label)).toBeTruthy();
  });

  it("doğrulanmamış istatistik veya yargılayıcı söz içermez", () => {
    card.show(document.body, 7, null, actions());
    const text = visibleText().toLowerCase();
    for (const bad of ["bağımlı", "risk", "tehlike", "çoğu", "%"]) expect(text).not.toContain(bad);
  });

  it("'Kapat' kartı kapatır ve bildirir", () => {
    const a = actions();
    card.show(document.body, 7, null, a);
    buttonByText("Kapat").click();
    expect(a.onDismiss).toHaveBeenCalledWith("kapat");
    expect(card.visible).toBe(false);
  });

  it("Escape kartı kapatır", () => {
    const a = actions();
    card.show(document.body, 7, null, a);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(a.onDismiss).toHaveBeenCalledWith("kapat");
    expect(card.visible).toBe(false);
  });

  it("'Kısa ara ver' sakin bir cümle gösterir, baskı yapmaz", () => {
    const a = actions();
    card.show(document.body, 7, null, a);
    buttonByText("Kısa ara ver").click();
    expect(visibleText()).toContain("Sohbet burada duruyor");
    expect(card.visible).toBe(true);
    buttonByText("Kapat").click();
    expect(a.onDismiss).toHaveBeenCalledWith("ara");
  });

  it("'Taze başlat' düzenlenebilir taslağı gösterir", () => {
    const a = actions();
    card.show(document.body, 7, null, a);
    buttonByText("Taze başlat").click();
    const area = shadowOf().querySelector("textarea")!;
    expect(area.value).toBe("1. ilk istek\n2. ikinci istek");
    expect(a.getDraft).toHaveBeenCalledTimes(1);
  });

  it("kullanıcının düzenlediği metin kopyalanmak üzere iletilir", async () => {
    const a = actions();
    card.show(document.body, 7, null, a);
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
    card.show(document.body, 7, null, a);
    buttonByText("Taze başlat").click();
    buttonByText("Kopyala ve yeni sohbet aç").click();
    await flush();
    expect(card.visible).toBe(true);
    expect(visibleText()).toContain("Kopyalanamadı");
    expect(buttonByText("Kopyala ve yeni sohbet aç").disabled).toBe(false);
    expect(a.onDismiss).not.toHaveBeenCalled();
  });

  it("'Geri' ana görünüme döner", () => {
    card.show(document.body, 7, null, actions());
    buttonByText("Taze başlat").click();
    buttonByText("Geri").click();
    expect(buttonByText("Taze başlat")).toBeTruthy();
  });

  it("art arda show() tek kart bırakır", () => {
    card.show(document.body, 7, null, actions());
    card.show(document.body, 8, null, actions());
    expect(document.querySelectorAll('[data-kafiai="exit-card"]').length).toBe(1);
  });
});

describe("ExitCard: Bir daha gösterme", () => {
  const card = new ExitCard();
  afterEach(() => card.hide());

  it("işlev verilmezse düğme gösterilmez", () => {
    card.show(document.body, 7, null, actions());
    expect(Array.from(shadowOf().querySelectorAll("button")).some((b) => b.textContent === "Bir daha gösterme")).toBe(false);
  });

  it("tıklanınca hemen kaydedilir, nasıl geri açılacağı söylenir", () => {
    const onNever = vi.fn();
    const a = { ...actions(), onNever };
    card.show(document.body, 7, null, a);
    buttonByText("Bir daha gösterme").click();
    expect(onNever).toHaveBeenCalledTimes(1);
    expect(visibleText()).toContain("KafiAI penceresinden yeniden açabilirsin");
    expect(card.visible).toBe(true);
  });

  it("onay görünümünde Kapat ve Escape ek bir kapatma olarak sayılmaz", () => {
    const a = { ...actions(), onNever: vi.fn() };
    card.show(document.body, 7, null, a);
    buttonByText("Bir daha gösterme").click();
    buttonByText("Kapat").click();
    expect(card.visible).toBe(false);

    card.show(document.body, 7, null, a);
    buttonByText("Bir daha gösterme").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(card.visible).toBe(false);
    expect(a.onDismiss).not.toHaveBeenCalled();
  });
});

describe("exitCardMessage", () => {
  it("görev türü biliniyorsa normu söyler", () => {
    const text = exitCardMessage(9, { label: "Kod yazma ve hata ayıklama", median_turns: 3, p75_turns: 5, p90_turns: 8 });
    expect(text).toContain("Kod yazma ve hata ayıklama sohbetlerinin çoğu 5 turda ya da daha kısa sürede bitiyor");
    expect(text).toContain("bu sohbet 9. turunda");
  });

  it("görev türü bilinmiyorsa ya da 'Diğer' ise yalnızca tur sayısını söyler", () => {
    expect(exitCardMessage(7, null)).toMatch(/^Bu sohbet 7\. turunda\./);
    expect(exitCardMessage(7, { label: "Diğer", median_turns: 3, p75_turns: 5, p90_turns: 8 })).toMatch(/^Bu sohbet 7\. turunda\./);
  });
});

describe("ExitCard model gerekçesiyle", () => {
  const card = new ExitCard();
  afterEach(() => card.hide());
  const reason = { key: "last_strong_repair", short: "kısa", why: "Son mesajında olmadı dedin.", tip: "Ne beklediğini yaz." };

  it("gerekçeyi, öneriyi ve modelin cihazda çalıştığını söyler", () => {
    card.show(document.body, 3, null, actions(), reason);
    expect(visibleText()).toContain(modelCardMessage(reason));
    expect(visibleText()).toContain(MODEL_NOTE);
    expect(visibleText()).not.toContain("Bu sohbet 3. turunda.");
  });

  it("'Yerinde değildi' geri bildirimi verir ve kartı kapatır", () => {
    const a = { ...actions(), onNotRelevant: vi.fn() };
    card.show(document.body, 3, null, a, reason);
    buttonByText("Yerinde değildi").click();
    expect(a.onNotRelevant).toHaveBeenCalledOnce();
    expect(a.onDismiss).toHaveBeenCalledWith("kapat");
    expect(card.visible).toBe(false);
  });

  it("gerekçe yoksa 'Yerinde değildi' düğmesi çıkmaz", () => {
    card.show(document.body, 7, null, { ...actions(), onNotRelevant: vi.fn() });
    expect(buttonByText("Yerinde değildi")).toBeUndefined();
  });
});
