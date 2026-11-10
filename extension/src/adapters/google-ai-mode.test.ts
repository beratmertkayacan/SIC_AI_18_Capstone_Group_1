// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bosSohbet from "../../test-snapshots/google_ai_mode/tr_bos_sohbet.html?raw";
import cevapBitince from "../../test-snapshots/google_ai_mode/tr_cevap_bitince.html?raw";
import cevapUretilirken from "../../test-snapshots/google_ai_mode/tr_cevap_uretilirken.html?raw";
import duzenlemeAcik from "../../test-snapshots/google_ai_mode/tr_duzenleme_acik.html?raw";
import ilkCevap from "../../test-snapshots/google_ai_mode/tr_ilk_cevap.html?raw";
import uzunGecmis from "../../test-snapshots/google_ai_mode/tr_uzun_gecmis.html?raw";
import {
  chatKeyFromUrl,
  composerContaining,
  editBoxContaining,
  findComposer,
  findSendButton,
  googleAiModeAdapter,
  isAiMode,
  isGenerating,
  readComposerText,
  readUserMessages,
} from "./google-ai-mode";

/**
 * Testler canlı Google AI Modu sayfasından alınıp kısaltılmış görüntüler üzerinde çalışır
 * (test-snapshots/google_ai_mode). Sınıf adları ve sayfanın iç verileri çıkarıldı; data-xid, role
 * ve aria öznitelikleri olduğu gibi duruyor. Sayfada görünmeyen düğme ve kutular data-gizli ile
 * işaretli: jsdom yerleşim hesaplamadığı için görünürlük bu işaretten okunur.
 */
const PAGES = {
  bos_sohbet: bosSohbet,
  ilk_cevap: ilkCevap,
  cevap_uretilirken: cevapUretilirken,
  cevap_bitince: cevapBitince,
  duzenleme_acik: duzenlemeAcik,
  uzun_gecmis: uzunGecmis,
};
type State = keyof typeof PAGES;

function load(state: State): void {
  document.body.innerHTML = new DOMParser().parseFromString(PAGES[state], "text/html").body.innerHTML;
}

/** Mesaj kutusuna yazı yazılmış gibi yapar: kutu dolar, aynı alandaki gönder düğmesi görünür olur. */
function type(text: string): HTMLTextAreaElement {
  const box = findComposer()!;
  box.value = text;
  const send = box.closest('[data-xid$="input-plate"]')!.querySelector<HTMLButtonElement>('[data-xid="input-plate-send-button"]')!;
  send.removeAttribute("data-gizli");
  send.removeAttribute("disabled");
  return box;
}

function pressEnter(target: Element, opts: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...opts });
  target.dispatchEvent(event);
  return event;
}

const originalRects = Element.prototype.getClientRects;
beforeEach(() => {
  Element.prototype.getClientRects = function (this: Element) {
    return (this.closest("[data-gizli]") ? [] : [{}]) as unknown as DOMRectList;
  };
});
afterEach(() => {
  Element.prototype.getClientRects = originalRects;
});

describe("sayfa görüntüleri: durumlar doğru tanınıyor", () => {
  it("boş sohbet: görünür kutu boş sohbet kutusu, gönder düğmesi gizli, geçmiş yok", () => {
    load("bos_sohbet");
    const box = findComposer()!;
    expect(box.closest("[data-xid]")!.getAttribute("data-xid")).toBe("aim-zero-state-input-plate");
    expect(readComposerText(box)).toBe("");
    expect(findSendButton(box)).toBeNull();
    expect(isGenerating()).toBe(false);
    expect(readUserMessages()).toEqual([]);
  });

  it("ilk cevap: tek kullanıcı mesajı, cevap bitmiş (geri bildirim alanı var)", () => {
    load("ilk_cevap");
    expect(readUserMessages()).toEqual(["Bana fotosentez hakkında 5 soruluk bir test hazırla."]);
    expect(isGenerating()).toBe(false);
    expect(findComposer()!.closest("[data-xid]")!.getAttribute("data-xid")).toBe("aim-mars-input-plate");
  });

  it("cevap yazılırken: son cevapta geri bildirim alanı yok, üretim sürüyor", () => {
    load("cevap_uretilirken");
    expect(isGenerating()).toBe(true);
    expect(readUserMessages()).toHaveLength(2);
  });

  it("cevap bitince: iki mesaj sırayla, üretim yok", () => {
    load("cevap_bitince");
    expect(isGenerating()).toBe(false);
    const texts = readUserMessages();
    expect(texts[0]).toMatch(/fotosentez/);
    expect(texts[1]).toMatch(/iki yolunu/);
  });

  it("düzenleme kutusu mesaj kutusu sayılmaz, düzenleme kutusu olarak tanınır", () => {
    load("duzenleme_acik");
    const boxes = Array.from(document.querySelectorAll<HTMLTextAreaElement>("textarea"));
    const edit = boxes.find((t) => !t.closest('[data-xid$="input-plate"]'))!;
    expect(composerContaining(edit)).toBeNull();
    expect(editBoxContaining(edit)).toBe(edit);
    expect(findComposer()).not.toBe(edit);
    expect(editBoxContaining(findComposer()!)).toBeNull();
    expect(readUserMessages()).toHaveLength(2);
  });

  it("uzun sohbet: altı mesajın hepsi sayfada (sanal liste yok)", () => {
    load("uzun_gecmis");
    expect(readUserMessages()).toHaveLength(6);
    expect(isGenerating()).toBe(false);
    expect(googleAiModeAdapter.historyTotal).toBeUndefined();
  });

  it("görünmeyen durdur düğmesi üretim sayılmaz, görünürse sayılır", () => {
    load("cevap_bitince");
    expect(isGenerating()).toBe(false);
    document.querySelector('[data-xid="ljhwxf"]')!.removeAttribute("data-gizli");
    expect(isGenerating()).toBe(true);
  });
});

describe("adres, sohbet anahtarı ve yeni sohbet", () => {
  it("yalnızca AI Modu sayfası eşleşir", () => {
    expect(isAiMode(new URL("https://www.google.com/search?udm=50&hl=tr"))).toBe(true);
    expect(isAiMode(new URL("https://www.google.com/search?q=hava+durumu"))).toBe(false);
    expect(isAiMode(new URL("https://www.google.com/search?udm=2&q=kedi"))).toBe(false);
    expect(isAiMode(new URL("https://www.google.com/"))).toBe(false);
    expect(isAiMode(new URL("https://gemini.google.com/app"))).toBe(false);
  });

  it("ilk sorudan özet anahtar üretir; metnin kendisi anahtarda yok", () => {
    const a = chatKeyFromUrl(new URL("https://www.google.com/search?udm=50&q=Bana+fotosentez+testi"));
    const b = chatKeyFromUrl(new URL("https://www.google.com/search?hl=tr&q=Bana+fotosentez+testi&mstk=abc&csuir=1&udm=50"));
    const c = chatKeyFromUrl(new URL("https://www.google.com/search?udm=50&q=Python+liste"));
    expect(a).not.toBeNull();
    expect(a).toBe(b); // takip soruları adresteki ek parametreleri değiştirir ama sohbet aynı
    expect(a).not.toBe(c);
    expect(a).not.toMatch(/fotosentez/i);
  });

  it("boş sohbette ve AI Modu dışında anahtar yok", () => {
    expect(chatKeyFromUrl(new URL("https://www.google.com/search?udm=50&hl=tr"))).toBeNull();
    expect(chatKeyFromUrl(new URL("https://www.google.com/search?q=kedi"))).toBeNull();
  });

  it("yeni sohbet adresi AI Modu boş sayfası", () => {
    expect(googleAiModeAdapter.newChatUrl()).toBe(`${location.origin}/search?udm=50`);
  });
});

describe("start(): gönderme, bekletme, düzenleme ve cevap bitişi", () => {
  let stop: () => void;
  const handlers = {
    onBeforeSend: vi.fn(),
    onSend: vi.fn(),
    onResponseComplete: vi.fn(),
    onNoSignal: vi.fn(),
    onEdit: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(handlers).forEach((h) => h.mockReset());
    handlers.onBeforeSend.mockReturnValue(false);
  });
  afterEach(() => {
    stop?.();
    vi.useRealTimers();
  });

  it("Enter ile gönderilen mesajı yakalar; Shift+Enter ve boş kutu sayılmaz", () => {
    load("bos_sohbet");
    stop = googleAiModeAdapter.start(handlers);
    pressEnter(findComposer()!);
    expect(handlers.onSend).not.toHaveBeenCalled();
    const box = type("merhaba");
    pressEnter(box, { shiftKey: true });
    expect(handlers.onSend).not.toHaveBeenCalled();
    pressEnter(box);
    expect(handlers.onSend).toHaveBeenCalledWith({ text: "merhaba" });
  });

  it("Gönder düğmesine tıklamayı yakalar; mikrofon düğmesini saymaz", () => {
    load("cevap_bitince");
    stop = googleAiModeAdapter.start(handlers);
    const box = type("bir soru daha sor");
    document.querySelector<HTMLButtonElement>('[data-xid="h4gG8"]')!.click();
    expect(handlers.onSend).not.toHaveBeenCalled();
    findSendButton(box)!.click();
    expect(handlers.onSend).toHaveBeenCalledWith({ text: "bir soru daha sor" });
  });

  it("üretim sürerken Enter mesaj sayılmaz", () => {
    load("cevap_uretilirken");
    stop = googleAiModeAdapter.start(handlers);
    pressEnter(type("merhaba"));
    expect(handlers.onSend).not.toHaveBeenCalled();
  });

  it("onBeforeSend true dönerse gönderim durur ve submitHeld bir kez gönderir", () => {
    handlers.onBeforeSend.mockReturnValueOnce(true).mockReturnValue(false);
    load("cevap_bitince");
    stop = googleAiModeAdapter.start(handlers);
    const box = type("merhaba");
    const pageClick = vi.fn();
    findSendButton(box)!.addEventListener("click", pageClick);
    const event = pressEnter(box);
    expect(event.defaultPrevented).toBe(true);
    expect(handlers.onSend).not.toHaveBeenCalled();
    expect(handlers.onBeforeSend.mock.calls[0]![0].anchor.getAttribute("data-xid")).toBe("aim-mars-input-plate");
    expect(googleAiModeAdapter.submitHeld()).toBe(true);
    expect(pageClick).toHaveBeenCalledTimes(1);
    expect(handlers.onSend).toHaveBeenCalledWith({ text: "merhaba" });
    expect(googleAiModeAdapter.submitHeld()).toBe(false);
  });

  it("düzenleme kutusundaki Gönder düzenleme sayılır, İptal sayılmaz; mesaj gönderimi sayılmaz", () => {
    load("duzenleme_acik");
    stop = googleAiModeAdapter.start(handlers);
    const turn = document.querySelector('[data-xid="aim-mars-turn-root"]')!;
    const buttons = Array.from(turn.querySelectorAll<HTMLButtonElement>("button")).filter((b) => !b.closest("[data-gizli]"));
    const cancel = buttons.find((b) => b.textContent?.trim() === "İptal")!;
    const save = buttons.find((b) => b.textContent?.trim() === "Gönder")!;
    cancel.click();
    expect(handlers.onEdit).not.toHaveBeenCalled();
    save.removeAttribute("disabled");
    save.click();
    expect(handlers.onEdit).toHaveBeenCalledTimes(1);
    expect(handlers.onSend).not.toHaveBeenCalled();
  });

  it("düzenleme kutusunda Enter düzenleme sayılır", () => {
    load("duzenleme_acik");
    stop = googleAiModeAdapter.start(handlers);
    const edit = Array.from(document.querySelectorAll<HTMLTextAreaElement>("textarea")).find((t) => !t.closest('[data-xid$="input-plate"]'))!;
    pressEnter(edit);
    expect(handlers.onEdit).toHaveBeenCalledTimes(1);
    expect(handlers.onSend).not.toHaveBeenCalled();
  });

  it("üretim görüntüsünden bitiş görüntüsüne geçince onResponseComplete çağrılır", () => {
    load("ilk_cevap");
    stop = googleAiModeAdapter.start(handlers);
    pressEnter(type("Şimdi bana Python'da bir listeyi ters çevirmenin iki yolunu göster."));
    load("cevap_uretilirken");
    vi.advanceTimersByTime(600);
    expect(handlers.onResponseComplete).not.toHaveBeenCalled();
    load("cevap_bitince");
    vi.advanceTimersByTime(2000);
    expect(handlers.onResponseComplete).toHaveBeenCalledTimes(1);
  });
});

describe("composer ve insertText", () => {
  it("çapa mesaj kutusunun alanı; kutu boş mu doğru söyler", () => {
    load("cevap_bitince");
    expect(googleAiModeAdapter.composer()!.anchor.getAttribute("data-xid")).toBe("aim-mars-input-plate");
    expect(googleAiModeAdapter.composer()!.empty).toBe(true);
    type("merhaba");
    expect(googleAiModeAdapter.composer()!.empty).toBe(false);
  });

  it("onarım cümlesini kutunun sonuna yeni satırda ekler", () => {
    load("cevap_bitince");
    const box = type("Bu kodu düzelt");
    (document as unknown as { execCommand?: unknown }).execCommand = undefined;
    expect(googleAiModeAdapter.insertText("Hata mesajı şu:")).toBe(true);
    expect(box.value).toBe("Bu kodu düzelt\nHata mesajı şu:");
  });

  it("sayfa yapısı değişmişse çökmez", () => {
    document.body.innerHTML = "<div>başka bir sayfa</div>";
    expect(googleAiModeAdapter.composer()).toBeNull();
    expect(googleAiModeAdapter.readHistory()).toEqual([]);
    expect(isGenerating()).toBe(false);
    expect(googleAiModeAdapter.submitHeld()).toBe(false);
  });
});

describe("lastResponse", () => {
  it("son cevabın başını okur; başlığı ve geri bildirim alanını almaz", () => {
    load("cevap_bitince");
    const text = googleAiModeAdapter.lastResponse!()!;
    expect(text).toMatch(/dilimleme/);
    expect(text).not.toMatch(/AI Modu yanıtı|hata olabilir/);
    load("bos_sohbet");
    expect(googleAiModeAdapter.lastResponse!()).toBeNull();
  });
});
