// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { chatgptAdapter, composerContaining, editBoxContaining, findComposer, findComposers, isGenerating, readComposerText } from "./chatgpt";
import type { AdapterHandlers } from "./types";
import bosSohbet from "../../test-snapshots/chatgpt/tr_bos_sohbet.html?raw";
import cevapBitince from "../../test-snapshots/chatgpt/tr_cevap_bitince.html?raw";
import cevapUretilirken from "../../test-snapshots/chatgpt/tr_cevap_uretilirken.html?raw";
import duzenlemeAcik from "../../test-snapshots/chatgpt/tr_duzenleme_acik.html?raw";
import ilkCevap from "../../test-snapshots/chatgpt/tr_ilk_cevap.html?raw";
import uzunGecmis from "../../test-snapshots/chatgpt/tr_uzun_gecmis.html?raw";
import yenidenUretildi from "../../test-snapshots/chatgpt/tr_yeniden_uretildi.html?raw";

/**
 * Canlı ChatGPT sayfasından (Kasım 2026, oturum açık) alınıp temizlenmiş görüntüler
 * (test-snapshots/chatgpt, scripts/sanitize_snapshot.py). Mesajlar deneme amaçlı örnek istekler.
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
  // jsdom yerleşim hesaplamaz: işaretsiz her öğe görünür, data-gizli olanlar görünmez sayılır.
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
    return (this.closest("[data-gizli]") ? [] : [{}]) as unknown as DOMRectList;
  });
});

function load(state: State): void {
  const doc = new DOMParser().parseFromString(PAGES[state], "text/html");
  document.body.innerHTML = doc.body.innerHTML;
}

describe("ChatGPT sayfa görüntüleri", () => {
  it("boş sohbet: tek mesaj kutusu, boş, üretim ve geçmiş yok", () => {
    load("bos_sohbet");
    expect(findComposers()).toHaveLength(1);
    expect(readComposerText(findComposer()!)).toBe("");
    expect(isGenerating()).toBe(false);
    expect(chatgptAdapter.readHistory()).toEqual([]);
    expect(chatgptAdapter.lastResponse!()).toBeNull();
  });

  it("ilk cevap: tek kullanıcı mesajı ve cevabın başı okunur", () => {
    load("ilk_cevap");
    const texts = chatgptAdapter.readHistory();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toMatch(/listeyi/);
    const answer = chatgptAdapter.lastResponse!()!;
    expect(answer.length).toBeGreaterThan(50);
    expect(answer.length).toBeLessThanOrEqual(600);
    expect(isGenerating()).toBe(false);
  });

  it("cevap yazılırken üretim sürüyor sayılır (Durdur düğmesi ve tur durumu)", () => {
    load("cevap_uretilirken");
    expect(isGenerating()).toBe(true);
    expect(chatgptAdapter.readHistory()).toHaveLength(2);
  });

  it("cevap bitince üç mesaj sırayla okunur, son cevap son turdan gelir", () => {
    load("cevap_bitince");
    expect(isGenerating()).toBe(false);
    const texts = chatgptAdapter.readHistory();
    expect(texts).toHaveLength(3);
    expect(texts[1]).toMatch(/300/);
    expect(chatgptAdapter.lastResponse!()).toMatch(/ters çevir/);
  });

  it("yeniden üretilmiş cevapta mesaj sayısı değişmez", () => {
    load("yeniden_uretildi");
    expect(isGenerating()).toBe(false);
    expect(chatgptAdapter.readHistory()).toHaveLength(3);
  });

  it("düzenleme kutusu mesaj kutusu sayılmaz ama düzenleme olarak tanınır", () => {
    load("duzenleme_acik");
    const edit = document.querySelector<HTMLElement>('[data-turn-key] form [contenteditable="true"]')!;
    expect(edit).not.toBeNull();
    expect(composerContaining(edit)).toBeNull();
    expect(editBoxContaining(edit)).toBe(edit);
    expect(findComposers()).toHaveLength(1);
    expect(editBoxContaining(findComposer())).toBeNull();
  });

  it("uzun sohbet: sayfa eski turları çizmeyebilir; okunanlar sırayla gelir", () => {
    load("uzun_gecmis");
    const texts = chatgptAdapter.readHistory();
    expect(texts.length).toBeGreaterThanOrEqual(4);
    expect(texts.at(-1)).toMatch(/devam/);
  });

  it("hiçbir görüntüde e-posta adresi kalmamış", () => {
    for (const state of Object.keys(PAGES) as State[]) {
      expect(PAGES[state]).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    }
  });
});

describe("ChatGPT düzenleme yakalama (P6)", () => {
  let stop: (() => void) | undefined;
  afterEach(() => stop?.());

  function handlers(): AdapterHandlers & { onEdit: ReturnType<typeof vi.fn>; onSend: ReturnType<typeof vi.fn> } {
    return {
      onSend: vi.fn(),
      onResponseComplete: vi.fn(),
      onNoSignal: vi.fn(),
      onEdit: vi.fn(),
    } as never;
  }

  it("düzenleme formundaki Gönder tıklaması düzenleme sayılır, yeni mesaj sayılmaz", () => {
    load("duzenleme_acik");
    const h = handlers();
    stop = chatgptAdapter.start(h);
    const submit = document.querySelector<HTMLButtonElement>('[data-turn-key] form button[type="submit"]')!;
    submit.addEventListener("click", (e) => e.preventDefault()); // jsdom formu gerçekten göndermesin
    submit.click();
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(h.onSend).not.toHaveBeenCalled();
  });

  it("düzenleme kutusunda Enter düzenleme sayılır", () => {
    load("duzenleme_acik");
    const h = handlers();
    stop = chatgptAdapter.start(h);
    const edit = document.querySelector<HTMLElement>('[data-turn-key] form [contenteditable="true"]')!;
    edit.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(h.onSend).not.toHaveBeenCalled();
  });

  it("İptal düğmesi düzenleme sayılmaz", () => {
    load("duzenleme_acik");
    const h = handlers();
    stop = chatgptAdapter.start(h);
    const cancel = document.querySelector<HTMLButtonElement>('[data-turn-key] form button[type="button"]')!;
    cancel.click();
    expect(h.onEdit).not.toHaveBeenCalled();
  });
});
