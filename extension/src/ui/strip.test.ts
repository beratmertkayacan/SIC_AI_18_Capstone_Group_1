// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { Strip } from "./strip";

function shadowOf(): ShadowRoot {
  return document.querySelector<HTMLElement>('[data-kafiai="strip"]')!.shadowRoot!;
}
function buttonByText(text: string): HTMLButtonElement {
  return Array.from(shadowOf().querySelectorAll("button")).find((b) => b.textContent === text)!;
}

describe("Strip", () => {
  const strip = new Strip();
  afterEach(() => strip.hide());

  it("gösterilince sayfaya eklenir, gizlenince kaldırılır", () => {
    strip.show(document.body, { onSendAnyway: vi.fn(), onEdit: vi.fn() });
    expect(document.querySelector('[data-kafiai="strip"]')).not.toBeNull();
    expect(strip.visible).toBe(true);
    strip.hide();
    expect(document.querySelector('[data-kafiai="strip"]')).toBeNull();
    expect(strip.visible).toBe(false);
  });

  it("'Yine de gönder' ilgili işlevi çağırır ve şeridi kapatır", () => {
    const onSendAnyway = vi.fn();
    const onEdit = vi.fn();
    strip.show(document.body, { onSendAnyway, onEdit });
    buttonByText("Yine de gönder").click();
    expect(onSendAnyway).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
    expect(strip.visible).toBe(false);
  });

  it("'Düzenle' ve Escape düzenlemeye döndürür", () => {
    const onEdit = vi.fn();
    strip.show(document.body, { onSendAnyway: vi.fn(), onEdit });
    buttonByText("Düzenle").click();
    expect(onEdit).toHaveBeenCalledTimes(1);

    strip.show(document.body, { onSendAnyway: vi.fn(), onEdit });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onEdit).toHaveBeenCalledTimes(2);
    expect(strip.visible).toBe(false);
  });

  it("art arda show() tek şerit bırakır", () => {
    strip.show(document.body, { onSendAnyway: vi.fn(), onEdit: vi.fn() });
    strip.show(document.body, { onSendAnyway: vi.fn(), onEdit: vi.fn() });
    expect(document.querySelectorAll('[data-kafiai="strip"]').length).toBe(1);
  });

  it("yargılayıcı söz içermez", () => {
    strip.show(document.body, { onSendAnyway: vi.fn(), onEdit: vi.fn() });
    const text = shadowOf().textContent!.toLowerCase();
    for (const bad of ["bağımlı", "risk", "tehlike", "uyarı"]) expect(text).not.toContain(bad);
  });
});
