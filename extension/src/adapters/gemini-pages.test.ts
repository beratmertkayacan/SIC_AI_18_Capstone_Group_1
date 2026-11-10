// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { composerContaining, editBoxContaining, findComposer, findComposers, geminiAdapter, isGenerating, readComposerText } from "./gemini";
import type { AdapterHandlers } from "./types";
import bosSohbet from "../../test-snapshots/gemini/tr_bos_sohbet.html?raw";
import cevapBitince from "../../test-snapshots/gemini/tr_cevap_bitince.html?raw";
import cevapUretilirken from "../../test-snapshots/gemini/tr_cevap_uretilirken.html?raw";
import duzenlemeAcik from "../../test-snapshots/gemini/tr_duzenleme_acik.html?raw";
import ilkCevap from "../../test-snapshots/gemini/tr_ilk_cevap.html?raw";
import uzunGecmis from "../../test-snapshots/gemini/tr_uzun_gecmis.html?raw";
import yenidenUretildi from "../../test-snapshots/gemini/tr_yeniden_uretildi.html?raw";

/**
 * Canlı Gemini sayfasından (Kasım 2026) alınıp temizlenmiş görüntüler (test-snapshots/gemini).
 * Angular derleme öznitelikleri (_ngcontent…) duruyor, izleme öznitelikleri (data-gtm-…) çıkarıldı.
 */
const PAGES = {
  bos_sohbet: bosSohbet,
  ilk_cevap: ilkCevap,
  cevap_uretilirken: cevapUretilirken,
  cevap_bitince: cevapBitince,
  duzenleme_acik: duzenlemeAcik,
  yeniden_uretildi: yenidenUretildi,
  uzun_gecmis: uzunGecmis,
};
type State = keyof typeof PAGES;

beforeAll(() => {
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
    return (this.closest("[data-gizli]") ? [] : [{}]) as unknown as DOMRectList;
  });
});

function load(state: State): void {
  document.body.innerHTML = new DOMParser().parseFromString(PAGES[state], "text/html").body.innerHTML;
}

describe("Gemini sayfa görüntüleri", () => {
  it("boş sohbet: tek mesaj kutusu, boş, geçmiş ve cevap yok", () => {
    load("bos_sohbet");
    expect(findComposers()).toHaveLength(1);
    expect(readComposerText(findComposer()!)).toBe("");
    expect(isGenerating()).toBe(false);
    expect(geminiAdapter.readHistory()).toEqual([]);
    expect(geminiAdapter.lastResponse!()).toBeNull();
  });

  it("ilk cevap: tek istek ve cevabın ilk 600 karakteri", () => {
    load("ilk_cevap");
    expect(geminiAdapter.readHistory()).toHaveLength(1);
    const answer = geminiAdapter.lastResponse!()!;
    expect(answer).toMatch(/ters çevir/);
    expect(answer.length).toBeLessThanOrEqual(600);
  });

  it("cevap yazılırken üretim sürüyor sayılır", () => {
    load("cevap_uretilirken");
    expect(isGenerating()).toBe(true);
    expect(geminiAdapter.readHistory()).toHaveLength(2);
  });

  it("cevap bitince ve yeniden üretilince üç istek okunur", () => {
    for (const state of ["cevap_bitince", "yeniden_uretildi"] as const) {
      load(state);
      expect(isGenerating()).toBe(false);
      const texts = geminiAdapter.readHistory();
      expect(texts).toHaveLength(3);
      expect(texts[1]).toMatch(/300/);
    }
  });

  it("uzun sohbet: dokuz isteğin hepsi sayfada, kısa istekler de okunur", () => {
    load("uzun_gecmis");
    const texts = geminiAdapter.readHistory();
    expect(texts).toHaveLength(9);
    expect(texts.filter((t) => t.length < 12).length).toBeGreaterThanOrEqual(2);
  });

  it("düzenleme kutusu mesaj kutusu sayılmaz, düzenleme olarak tanınır", () => {
    load("duzenleme_acik");
    const edit = document.querySelector<HTMLElement>('user-query rich-textarea [contenteditable="true"]')!;
    expect(edit).not.toBeNull();
    expect(composerContaining(edit)).toBeNull();
    expect(editBoxContaining(edit)).toBe(edit);
    expect(findComposers()).toHaveLength(1);
    // düzenlenen istek kutuya dönüştüğü için geçmişte görünmez
    expect(geminiAdapter.readHistory()).toHaveLength(2);
  });

  it("hiçbir görüntüde e-posta adresi kalmamış", () => {
    for (const state of Object.keys(PAGES) as State[]) {
      expect(PAGES[state]).not.toMatch(/[\w.+-]+@(?!example\.com)[\w-]+\.[\w.]+/);
    }
  });
});

describe("Gemini düzenleme ve yeniden üretme yakalama (P6)", () => {
  let stop: (() => void) | undefined;
  afterEach(() => stop?.());

  function handlers() {
    return { onSend: vi.fn(), onResponseComplete: vi.fn(), onNoSignal: vi.fn(), onEdit: vi.fn(), onRegenerate: vi.fn() };
  }

  it("Güncelle düğmesi düzenleme sayılır, İptal sayılmaz", () => {
    load("duzenleme_acik");
    const h = handlers();
    stop = geminiAdapter.start(h as unknown as AdapterHandlers);
    const query = document.querySelector<HTMLElement>('user-query rich-textarea [contenteditable="true"]')!.closest("user-query")!;
    const [cancel, update] = Array.from(query.querySelectorAll<HTMLButtonElement>("button")).filter((b) => editBoxContaining(b));
    cancel!.click();
    expect(h.onEdit).not.toHaveBeenCalled();
    // Görüntüde metin değişmediği için Güncelle devre dışı; devre dışıyken tıklama sayılmaz.
    update!.click();
    expect(h.onEdit).not.toHaveBeenCalled();
    update!.removeAttribute("disabled");
    update!.click();
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(h.onSend).not.toHaveBeenCalled();
  });

  it("düzenleme kutusunda Enter düzenleme sayılır", () => {
    load("duzenleme_acik");
    const h = handlers();
    stop = geminiAdapter.start(h as unknown as AdapterHandlers);
    const edit = document.querySelector<HTMLElement>('user-query rich-textarea [contenteditable="true"]')!;
    edit.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(h.onEdit).toHaveBeenCalledTimes(1);
  });

  it("cevabın altındaki Yeniden yap düğmesi yeniden üretme sayılır", () => {
    load("cevap_bitince");
    const h = handlers();
    stop = geminiAdapter.start(h as unknown as AdapterHandlers);
    const redo = document.querySelector<HTMLButtonElement>('model-response button[aria-label="Yeniden yap"]')!;
    expect(redo).not.toBeNull();
    redo.click();
    expect(h.onRegenerate).toHaveBeenCalledTimes(1);
  });
});
