// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { historySeed } from "../core/history-watcher";
import {
  chatKeyFromPath,
  claudeAdapter,
  composerContaining,
  findComposer,
  findSendButton,
  isGenerating,
  readComposerText,
  readUserMessages,
  reportedUserTurns,
} from "./claude";
import bosSohbet from "../../test-snapshots/claude/tr_bos_sohbet.html?raw";
import cevapBitince from "../../test-snapshots/claude/tr_cevap_bitince.html?raw";
import cevapUretilirken from "../../test-snapshots/claude/tr_cevap_uretilirken.html?raw";
import duzenlemeAcik from "../../test-snapshots/claude/tr_duzenleme_acik.html?raw";
import ilkCevap from "../../test-snapshots/claude/tr_ilk_cevap.html?raw";
import uzunGecmis from "../../test-snapshots/claude/tr_uzun_gecmis.html?raw";
import yenidenUretildi from "../../test-snapshots/claude/tr_yeniden_uretildi.html?raw";

/**
 * Testler canlı Claude sayfasından alınıp temizlenmiş görüntüler üzerinde çalışır
 * (test-snapshots/claude, scripts/sanitize_snapshot.py). Görüntülerde mesaj metni yalnızca
 * deneme amaçlı yazılmış örnek istekler; hesap bilgisi yok.
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

/** Görüntüyü canlı belgeye yükler (olay dinleyicileri için). */
function load(state: State): void {
  document.body.innerHTML = snapshot(state).body.innerHTML;
}

/** Mesaj kutusuna yazı yazılmış gibi yapar; gönder düğmesi etkinleşir. */
function type(text: string): void {
  const box = findComposer()!;
  box.innerHTML = `<p>${text}</p>`;
  findSendButton()?.removeAttribute("disabled");
}

function pressEnter(opts: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...opts });
  findComposer()!.querySelector("p")!.dispatchEvent(event);
  return event;
}

describe("sayfa görüntüleri: durumlar doğru tanınıyor", () => {
  it("boş sohbet: kutu var ve boş, üretim yok, geçmiş yok", () => {
    const doc = snapshot("bos_sohbet");
    const box = findComposer(doc)!;
    expect(box).not.toBeNull();
    expect(readComposerText(box)).toBe("");
    expect(isGenerating(doc)).toBe(false);
    expect(readUserMessages(doc)).toEqual([]);
    expect(reportedUserTurns(doc)).toBeNull();
    expect(findSendButton(doc)!.disabled).toBe(true);
  });

  it("ilk cevap: tek kullanıcı mesajı okunur, ekran okuyucu başlığı alınmaz", () => {
    const doc = snapshot("ilk_cevap");
    const texts = readUserMessages(doc);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toMatch(/listeyi nasıl ters çeviririm/);
    expect(texts[0]).not.toMatch(/You said/);
    expect(reportedUserTurns(doc)).toBe(1);
    expect(isGenerating(doc)).toBe(false);
  });

  it("cevap yazılırken üretim sürüyor sayılır", () => {
    const doc = snapshot("cevap_uretilirken");
    expect(isGenerating(doc)).toBe(true);
    expect(doc.querySelector('[data-testid="chat-input-stop"]')).not.toBeNull();
    expect(readUserMessages(doc)).toHaveLength(1);
  });

  it("cevap bitince üretim yok, iki mesaj sırayla okunur", () => {
    const doc = snapshot("cevap_bitince");
    expect(isGenerating(doc)).toBe(false);
    const texts = readUserMessages(doc);
    expect(texts).toHaveLength(2);
    expect(texts[0]).toMatch(/300/);
    expect(texts[1]).toMatch(/iki yolunu/);
    expect(reportedUserTurns(doc)).toBe(2);
  });

  it("yeniden üretilmiş cevapta da üretim yok ve mesaj sayısı değişmez", () => {
    const doc = snapshot("yeniden_uretildi");
    expect(isGenerating(doc)).toBe(false);
    expect(readUserMessages(doc)).toHaveLength(2);
    expect(reportedUserTurns(doc)).toBe(2);
  });

  it("düzenleme kutusu mesaj kutusu sayılmaz", () => {
    const doc = snapshot("duzenleme_acik");
    const edit = doc.querySelector("textarea")!;
    expect(edit).not.toBeNull();
    expect(composerContaining(edit)).toBeNull();
    expect(findComposer(doc)!.getAttribute("data-testid")).toBe("chat-input");
    expect(doc.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
    // Düzenlenen mesaj sayfada kutuya dönüşür; toplam yine sayfadan doğru okunur.
    expect(readUserMessages(doc)).toHaveLength(1);
    expect(reportedUserTurns(doc)).toBe(2);
  });

  it("uzun sohbet: sayfa yalnızca ekrandaki mesajları çizer, toplam yine bilinir", () => {
    const doc = snapshot("uzun_gecmis");
    const texts = readUserMessages(doc);
    const total = reportedUserTurns(doc)!;
    expect(total).toBe(9);
    expect(texts.length).toBeLessThan(total);
    expect(doc.querySelectorAll('[data-testid="transcript-row"]').length).toBeLessThan(18);
    const seed = historySeed(texts, total);
    expect(seed).toEqual({ turns: 9, hidden: 9 - texts.length, partial: true });
  });

  it("hiçbir görüntüde e-posta adresi kalmamış", () => {
    for (const state of Object.keys(PAGES) as State[]) {
      expect(snapshot(state).documentElement.outerHTML).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    }
  });
});

describe("conversationKey, matches ve newChatUrl", () => {
  it("adresten sohbet kimliğini çıkarır", () => {
    expect(chatKeyFromPath("/chat/3f2a9c1e-0b7d-4e55-9a1c-2b3c4d5e6f70")).toBe("3f2a9c1e-0b7d-4e55-9a1c-2b3c4d5e6f70");
    expect(chatKeyFromPath("/chat/3f2a9c1e-0b7d-4e55-9a1c-2b3c4d5e6f70/")).toBe("3f2a9c1e-0b7d-4e55-9a1c-2b3c4d5e6f70");
  });

  it("yeni sohbet, proje ve diğer sayfalar null", () => {
    expect(chatKeyFromPath("/new")).toBeNull();
    expect(chatKeyFromPath("/")).toBeNull();
    expect(chatKeyFromPath("/project/3f2a9c1e-0b7d")).toBeNull();
    expect(chatKeyFromPath("/recents")).toBeNull();
    expect(chatKeyFromPath("/chat/kisa")).toBeNull();
  });

  it("yalnızca claude.ai eşleşir", () => {
    expect(claudeAdapter.matches(new URL("https://claude.ai/new"))).toBe(true);
    expect(claudeAdapter.matches(new URL("https://www.anthropic.com/"))).toBe(false);
    expect(claudeAdapter.matches(new URL("https://chatgpt.com/"))).toBe(false);
  });

  it("yeni sohbet adresi /new", () => {
    expect(claudeAdapter.newChatUrl()).toBe(`${location.origin}/new`);
  });
});

describe("start(): gerçek sayfa yapısında gönderme, bekletme ve cevap bitişi", () => {
  let stop: () => void;
  const handlers = {
    onBeforeSend: vi.fn(),
    onSend: vi.fn(),
    onResponseComplete: vi.fn(),
    onNoSignal: vi.fn(),
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
    stop = claudeAdapter.start(handlers);
    pressEnter();
    expect(handlers.onSend).not.toHaveBeenCalled();
    type("merhaba");
    pressEnter({ shiftKey: true });
    expect(handlers.onSend).not.toHaveBeenCalled();
    pressEnter();
    expect(handlers.onSend).toHaveBeenCalledWith({ text: "merhaba" });
  });

  it("Gönder düğmesine tıklamayı yakalar; başka düğmeyi saymaz", () => {
    load("bos_sohbet");
    stop = claudeAdapter.start(handlers);
    type("merhaba");
    document.querySelector<HTMLButtonElement>('[data-testid="chat-input-attach"]')!.click();
    expect(handlers.onSend).not.toHaveBeenCalled();
    findSendButton()!.click();
    expect(handlers.onSend).toHaveBeenCalledWith({ text: "merhaba" });
  });

  it("üretim sürerken Enter mesaj sayılmaz", () => {
    load("cevap_uretilirken");
    stop = claudeAdapter.start(handlers);
    findComposer()!.innerHTML = "<p>merhaba</p>";
    pressEnter();
    expect(handlers.onSend).not.toHaveBeenCalled();
  });

  it("onBeforeSend true dönerse gönderim durur; çapa mesaj kutusunun çerçevesi", () => {
    handlers.onBeforeSend.mockReturnValue(true);
    load("cevap_bitince");
    stop = claudeAdapter.start(handlers);
    type("merhaba");
    const pageListener = vi.fn();
    findComposer()!.addEventListener("keydown", pageListener);
    const event = pressEnter();
    expect(event.defaultPrevented).toBe(true);
    expect(pageListener).not.toHaveBeenCalled();
    expect(handlers.onSend).not.toHaveBeenCalled();
    expect(handlers.onBeforeSend.mock.calls[0]![0].anchor.tagName).toBe("FIELDSET");
  });

  it("submitHeld bekleyen mesajı bir kez gönderir", () => {
    handlers.onBeforeSend.mockReturnValueOnce(true).mockReturnValue(false);
    load("cevap_bitince");
    stop = claudeAdapter.start(handlers);
    type("merhaba");
    const pageClick = vi.fn();
    findSendButton()!.addEventListener("click", pageClick);
    pressEnter();
    expect(handlers.onSend).not.toHaveBeenCalled();
    expect(claudeAdapter.submitHeld()).toBe(true);
    expect(pageClick).toHaveBeenCalledTimes(1);
    expect(handlers.onSend).toHaveBeenCalledWith({ text: "merhaba" });
    expect(claudeAdapter.submitHeld()).toBe(false);
  });

  it("üretim görüntüsünden bitiş görüntüsüne geçince onResponseComplete çağrılır", () => {
    load("ilk_cevap");
    stop = claudeAdapter.start(handlers);
    type("1'den 300'e kadar say");
    pressEnter();
    load("cevap_uretilirken");
    vi.advanceTimersByTime(600);
    expect(handlers.onResponseComplete).not.toHaveBeenCalled();
    load("cevap_bitince");
    vi.advanceTimersByTime(2000);
    expect(handlers.onResponseComplete).toHaveBeenCalledTimes(1);
    expect(handlers.onNoSignal).not.toHaveBeenCalled();
  });

  it("hiç üretim sinyali gelmezse onNoSignal çağrılır", () => {
    load("bos_sohbet");
    stop = claudeAdapter.start(handlers);
    type("merhaba");
    pressEnter();
    vi.advanceTimersByTime(16_000);
    expect(handlers.onNoSignal).toHaveBeenCalledTimes(1);
  });
});

describe("composer, readHistory ve historyTotal", () => {
  it("composer çapası fieldset; kutu boş mu doğru söyler", () => {
    load("bos_sohbet");
    expect(claudeAdapter.composer()!.anchor.tagName).toBe("FIELDSET");
    expect(claudeAdapter.composer()!.empty).toBe(true);
    type("merhaba");
    expect(claudeAdapter.composer()!.empty).toBe(false);
  });

  it("canlı belgede geçmiş ve toplam okunur", () => {
    load("uzun_gecmis");
    expect(claudeAdapter.historyTotal!()).toBe(9);
    expect(claudeAdapter.readHistory().length).toBeLessThan(9);
  });

  it("çok satırlı ve listeli mesajı satır satır, iç içe blokları bir kez okur", () => {
    document.body.innerHTML = `<div data-testid="user-message"><div>
      <p>Şunu yap:</p><ul><li><p>önce a</p></li><li>sonra b</li></ul></div></div>`;
    expect(readUserMessages()).toEqual(["Şunu yap:\nönce a\nsonra b"]);
  });

  it("sayfa yapısı değişmişse boş döner, çökmez", () => {
    document.body.innerHTML = "<div>başka bir sayfa</div>";
    expect(claudeAdapter.readHistory()).toEqual([]);
    expect(claudeAdapter.historyTotal!()).toBeNull();
    expect(claudeAdapter.composer()).toBeNull();
    expect(claudeAdapter.submitHeld()).toBe(false);
  });
});

describe("lastResponse: son cevabın başı (yalnızca özür kuralı için)", () => {
  it("son cevabı okur, ekran okuyucu başlığını almaz", () => {
    load("ilk_cevap");
    const text = claudeAdapter.lastResponse!()!;
    expect(text).toMatch(/ters çevirmenin/);
    expect(text).not.toMatch(/Claude responded/);
    expect(text.length).toBeLessThanOrEqual(600);
  });

  it("boş sohbette null", () => {
    load("bos_sohbet");
    expect(claudeAdapter.lastResponse!()).toBeNull();
  });
});
