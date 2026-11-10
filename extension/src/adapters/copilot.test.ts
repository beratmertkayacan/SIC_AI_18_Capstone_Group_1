// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bosSohbet from "../../test-snapshots/copilot/tr_bos_sohbet.html?raw";
import cevapBitince from "../../test-snapshots/copilot/tr_cevap_bitince.html?raw";
import cevapUretilirken from "../../test-snapshots/copilot/tr_cevap_uretilirken.html?raw";
import duzenlemeAcik from "../../test-snapshots/copilot/tr_duzenleme_acik.html?raw";
import ilkCevap from "../../test-snapshots/copilot/tr_ilk_cevap.html?raw";
import uzunGecmis from "../../test-snapshots/copilot/tr_uzun_gecmis.html?raw";
import yenidenUretildi from "../../test-snapshots/copilot/tr_yeniden_uretildi.html?raw";
import { historySeed } from "../core/history-watcher";
import {
  chatKeyFromPath,
  composerContaining,
  copilotAdapter,
  findComposer,
  findSendButton,
  isGenerating,
  readComposerText,
  readUserMessages,
} from "./copilot";
import { reportedUserTurns } from "./virtual-list";

/**
 * Testler kişisel hesapla alınıp temizlenmiş Copilot sayfa görüntüleri üzerinde çalışır
 * (test-snapshots/copilot). Mesajlar deneme amaçlı örnek istekler; hesap bilgisi yok.
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

const cache = new Map<State, Document>();
function snapshot(state: State): Document {
  let doc = cache.get(state);
  if (!doc) {
    doc = new DOMParser().parseFromString(PAGES[state], "text/html");
    cache.set(state, doc);
  }
  return doc;
}

function load(state: State): void {
  document.body.innerHTML = snapshot(state).body.innerHTML;
}

/** Kutuya yazı yazılmış gibi yapar; Copilot'ta gönder düğmesi o zaman görünür. */
function type(text: string): HTMLButtonElement {
  const box = findComposer()!;
  box.innerHTML = `<p><span data-lexical-text="true">${text}</span></p>`;
  const frame = box.closest(".fai-BebopLiteChatInput")!;
  let send = frame.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!send) {
    send = document.createElement("button");
    send.type = "submit";
    send.className = "fai-SendButton";
    frame.append(send);
  }
  send.setAttribute("aria-label", "Gönder");
  send.removeAttribute("disabled");
  return send;
}

function pressEnter(opts: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...opts });
  (findComposer()!.querySelector("span, p") ?? findComposer()!).dispatchEvent(event);
  return event;
}

describe("sayfa görüntüleri: durumlar doğru tanınıyor", () => {
  it("boş sohbet: kutu var ve boş, gönder düğmesi yok, üretim yok, geçmiş yok", () => {
    const doc = snapshot("bos_sohbet");
    const box = findComposer(doc)!;
    expect(box.id).toBe("m365-chat-editor-target-element");
    expect(readComposerText(box)).toBe("");
    expect(findSendButton(doc)).toBeNull();
    expect(isGenerating(doc)).toBe(false);
    expect(readUserMessages(doc)).toEqual([]);
    expect(reportedUserTurns(doc)).toBeNull();
  });

  it("ilk cevap: tek kullanıcı mesajı; ekran okuyucu başlığı alınmaz; cevap bitmiş", () => {
    const doc = snapshot("ilk_cevap");
    const texts = readUserMessages(doc);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toMatch(/ters çeviririm/);
    expect(texts[0]).not.toMatch(/You said/);
    expect(isGenerating(doc)).toBe(false);
    expect(reportedUserTurns(doc)).toBe(1);
  });

  it("cevap yazılırken: durdur düğmesi var, son cevap işareti yok, gönder düğmesi sayılmaz", () => {
    const doc = snapshot("cevap_uretilirken");
    expect(isGenerating(doc)).toBe(true);
    expect(doc.querySelector('[data-testid="lastChatMessage"]')).toBeNull();
    expect(findSendButton(doc)).toBeNull();
  });

  it("durdur etiketi tanınmasa da son cevap işareti yoksa üretim sürüyor sayılır", () => {
    load("cevap_uretilirken");
    document.querySelector('button[type="submit"]')!.setAttribute("aria-label", "Arrêter");
    expect(isGenerating()).toBe(true);
  });

  it("cevap bitince üretim yok, mesajlar sırayla", () => {
    const doc = snapshot("cevap_bitince");
    expect(isGenerating(doc)).toBe(false);
    const texts = readUserMessages(doc);
    expect(texts.length).toBeGreaterThanOrEqual(2);
    expect(texts[0]).toMatch(/ters çeviririm/);
    expect(reportedUserTurns(doc)).toBe(4);
  });

  it("düzenleme: Copilot metni mesaj kutusuna kopyalar, gönder düğmesi görünür olur", () => {
    const doc = snapshot("duzenleme_acik");
    expect(readComposerText(findComposer(doc)!)).toMatch(/iki yolunu/);
    expect(findSendButton(doc)!.getAttribute("aria-label")).toBe("Gönder");
    expect(doc.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
    expect(isGenerating(doc)).toBe(false);
  });

  it("yeniden üretilmiş cevapta üretim yok", () => {
    expect(isGenerating(snapshot("yeniden_uretildi"))).toBe(false);
  });

  it("uzun sohbet: sanal liste, sayfada birkaç tur var ama toplam 12", () => {
    const doc = snapshot("uzun_gecmis");
    const texts = readUserMessages(doc);
    const total = reportedUserTurns(doc)!;
    expect(total).toBe(12);
    expect(texts.length).toBeLessThan(total);
    expect(historySeed(texts, total).partial).toBe(true);
  });

  it("hiçbir görüntüde e-posta adresi kalmamış", () => {
    for (const state of Object.keys(PAGES) as State[]) {
      expect(snapshot(state).body.innerHTML).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    }
  });
});

describe("adres, sohbet anahtarı ve yeni sohbet", () => {
  it("sohbet kimliğini adresten çıkarır", () => {
    expect(chatKeyFromPath("/chats/pV5ZCVnSTvR8iTTvQe7yX")).toBe("pV5ZCVnSTvR8iTTvQe7yX");
    expect(chatKeyFromPath("/chats/pV5ZCVnSTvR8iTTvQe7yX/")).toBe("pV5ZCVnSTvR8iTTvQe7yX");
  });

  it("yeni sohbet ve diğer sayfalar null", () => {
    expect(chatKeyFromPath("/")).toBeNull();
    expect(chatKeyFromPath("/discover")).toBeNull();
    expect(chatKeyFromPath("/chats/kisa")).toBeNull();
  });

  it("yalnızca copilot.microsoft.com eşleşir (iş hesabı arayüzü değil)", () => {
    expect(copilotAdapter.matches(new URL("https://copilot.microsoft.com/"))).toBe(true);
    expect(copilotAdapter.matches(new URL("https://copilot.cloud.microsoft/"))).toBe(false);
    expect(copilotAdapter.matches(new URL("https://www.bing.com/chat"))).toBe(false);
  });

  it("yeni sohbet adresi ana sayfa", () => {
    expect(copilotAdapter.newChatUrl()).toBe(`${location.origin}/`);
  });
});

describe("start(): gönderme, bekletme, yeniden üretme ve cevap bitişi", () => {
  let stop: () => void;
  const handlers = {
    onBeforeSend: vi.fn(),
    onSend: vi.fn(),
    onResponseComplete: vi.fn(),
    onNoSignal: vi.fn(),
    onRegenerate: vi.fn(),
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
    stop = copilotAdapter.start(handlers);
    pressEnter();
    expect(handlers.onSend).not.toHaveBeenCalled();
    type("merhaba");
    pressEnter({ shiftKey: true });
    expect(handlers.onSend).not.toHaveBeenCalled();
    pressEnter();
    expect(handlers.onSend).toHaveBeenCalledWith({ text: "merhaba" });
  });

  it("Gönder düğmesine tıklamayı yakalar; başka düğmeyi saymaz", () => {
    load("cevap_bitince");
    stop = copilotAdapter.start(handlers);
    const send = type("bir soru daha sor");
    document.querySelector<HTMLButtonElement>('[data-testid="PlusMenuButton"]')!.click();
    expect(handlers.onSend).not.toHaveBeenCalled();
    send.click();
    expect(handlers.onSend).toHaveBeenCalledWith({ text: "bir soru daha sor" });
  });

  it("üretim sürerken Enter mesaj sayılmaz", () => {
    load("cevap_uretilirken");
    stop = copilotAdapter.start(handlers);
    findComposer()!.innerHTML = "<p><span>merhaba</span></p>";
    pressEnter();
    expect(handlers.onSend).not.toHaveBeenCalled();
  });

  it("onBeforeSend true dönerse gönderim durur; submitHeld bir kez gönderir", () => {
    handlers.onBeforeSend.mockReturnValueOnce(true).mockReturnValue(false);
    load("cevap_bitince");
    stop = copilotAdapter.start(handlers);
    const send = type("merhaba");
    const pageClick = vi.fn();
    send.addEventListener("click", pageClick);
    const event = pressEnter();
    expect(event.defaultPrevented).toBe(true);
    expect(handlers.onSend).not.toHaveBeenCalled();
    expect(handlers.onBeforeSend.mock.calls[0]![0].anchor.classList.contains("fai-BebopLiteChatInput")).toBe(true);
    expect(copilotAdapter.submitHeld()).toBe(true);
    expect(pageClick).toHaveBeenCalledTimes(1);
    expect(handlers.onSend).toHaveBeenCalledWith({ text: "merhaba" });
    expect(copilotAdapter.submitHeld()).toBe(false);
  });

  it("Yeniden Dene düğmesi yeniden üretme olarak sayılır, mesaj sayılmaz", () => {
    load("cevap_bitince");
    stop = copilotAdapter.start(handlers);
    const retry = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
      (b.getAttribute("aria-label") ?? "").startsWith("Yeniden Dene"),
    )!;
    retry.click();
    expect(handlers.onRegenerate).toHaveBeenCalledTimes(1);
    expect(handlers.onSend).not.toHaveBeenCalled();
  });

  it("üretim görüntüsünden bitiş görüntüsüne geçince onResponseComplete çağrılır", () => {
    load("ilk_cevap");
    stop = copilotAdapter.start(handlers);
    type("1'den 300'e kadar say");
    pressEnter();
    load("cevap_uretilirken");
    vi.advanceTimersByTime(600);
    expect(handlers.onResponseComplete).not.toHaveBeenCalled();
    load("cevap_bitince");
    vi.advanceTimersByTime(2000);
    expect(handlers.onResponseComplete).toHaveBeenCalledTimes(1);
  });
});

describe("composer ve historyTotal", () => {
  it("çapa mesaj kutusunun çerçevesi; boş mu doğru söyler", () => {
    load("bos_sohbet");
    expect(copilotAdapter.composer()!.anchor.classList.contains("fai-BebopLiteChatInput")).toBe(true);
    expect(copilotAdapter.composer()!.empty).toBe(true);
    type("merhaba");
    expect(copilotAdapter.composer()!.empty).toBe(false);
    expect(composerContaining(findComposer()!.querySelector("span"))).toBe(findComposer());
  });

  it("canlı belgede uzun sohbetin toplamı okunur", () => {
    load("uzun_gecmis");
    expect(copilotAdapter.historyTotal!()).toBe(12);
  });

  it("sayfa yapısı değişmişse çökmez", () => {
    document.body.innerHTML = "<div>başka bir sayfa</div>";
    expect(copilotAdapter.composer()).toBeNull();
    expect(copilotAdapter.readHistory()).toEqual([]);
    expect(isGenerating()).toBe(false);
    expect(copilotAdapter.submitHeld()).toBe(false);
  });
});

describe("lastResponse", () => {
  it("son cevabın başını okur; boş sohbette null", () => {
    load("ilk_cevap");
    expect(copilotAdapter.lastResponse!()).toMatch(/ters çevirmek/);
    load("bos_sohbet");
    expect(copilotAdapter.lastResponse!()).toBeNull();
  });
});
