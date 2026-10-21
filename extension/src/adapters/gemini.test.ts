// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chatKeyFromPath,
  composerContaining,
  findComposer,
  findComposers,
  findSendButton,
  geminiAdapter,
  isGenerating,
  readComposerText,
} from "./gemini";

/** Canlı sayfada ölçtüğümüz yapıyı taklit eden sahte sayfa (Ekim 2026). */
function renderPage(
  opts: {
    text?: string;
    stop?: boolean;
    sendLabel?: string;
    stopLabel?: string;
    pending?: boolean;
    thinking?: boolean;
    withSend?: boolean;
    editBox?: boolean;
  } = {},
) {
  const { text = "", stop = false, sendLabel = "Mesaj gönder", stopLabel = "Yanıtı durdur", pending = false, thinking = false, editBox = false } = opts;
  const withSend = opts.withSend ?? text !== "";
  document.body.innerHTML = `
    <chat-window>
      ${pending ? "<pending-request></pending-request>" : ""}
      ${thinking ? "<thinking-dots-animation></thinking-dots-animation>" : ""}
      ${editBox ? `<user-query><div class="ql-editor" role="textbox" contenteditable="true" id="edit"><p>eski mesaj</p></div></user-query>` : ""}
    </chat-window>
    <input-area-v2>
      <div class="text-input-field">
        <rich-textarea>
          <div class="ql-editor" role="textbox" contenteditable="true" aria-label="Gemini için bir istem girin" id="real"><p>${text}</p></div>
          <div class="ql-clipboard" contenteditable="true" id="decoy"></div>
        </rich-textarea>
        <button aria-label="Yükleme ve araçlar"></button>
        <button aria-label="Dikte et (⌘⇧D)"></button>
        ${stop ? `<button aria-label="${stopLabel}"></button>` : withSend ? `<button aria-label="${sendLabel}"></button>` : ""}
      </div>
    </input-area-v2>`;
}

function pressEnter(opts: KeyboardEventInit = {}) {
  document
    .getElementById("real")!
    .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...opts }));
}

// jsdom yerleşim hesaplamaz: işaretsiz her öğe görünür, data-gizli olanlar görünmez sayılır.
const originalRects = HTMLElement.prototype.getClientRects;
beforeEach(() => {
  HTMLElement.prototype.getClientRects = function (this: HTMLElement) {
    return (this.closest("[data-gizli]") ? [] : [{}]) as unknown as DOMRectList;
  };
});
afterEach(() => {
  HTMLElement.prototype.getClientRects = originalRects;
});

describe("sayfa yapısı", () => {
  it("yalnızca asıl kutuyu bulur: gizli ql-clipboard ve düzenleme kutusu dışarıda", () => {
    renderPage({ editBox: true });
    const boxes = findComposers();
    expect(boxes.map((b) => b.id)).toEqual(["real"]);
    expect(findComposer()!.id).toBe("real");
  });

  it("input-area-v2 dışındaki kutu mesaj kutusu sayılmaz", () => {
    document.body.innerHTML = `<div class="ql-editor" role="textbox" contenteditable="true"></div>`;
    expect(findComposer()).toBeNull();
  });

  it("composerContaining yalnızca asıl kutudan gelen olayı tanır", () => {
    renderPage({ editBox: true });
    expect(composerContaining(document.getElementById("real"))!.id).toBe("real");
    expect(composerContaining(document.getElementById("edit"))).toBeNull();
    expect(composerContaining(document.getElementById("decoy"))).toBeNull();
  });

  it("kutudaki metni okur", () => {
    renderPage({ text: "merhaba" });
    expect(readComposerText(findComposer()!)).toBe("merhaba");
  });

  it("boş kutuda boş metin döner", () => {
    renderPage();
    expect(readComposerText(findComposer()!)).toBe("");
  });
});

describe("isGenerating", () => {
  it("boştayken false", () => {
    renderPage({ text: "" });
    expect(isGenerating()).toBe(false);
  });

  it("'Yanıtı durdur' düğmesi varken true", () => {
    renderPage({ stop: true });
    expect(isGenerating()).toBe(true);
  });

  it("İngilizce durdur etiketini de tanır", () => {
    renderPage({ stop: true, stopLabel: "Stop response" });
    expect(isGenerating()).toBe(true);
  });

  it("bekleyen istek ya da düşünme animasyonu varken true (dilden bağımsız)", () => {
    renderPage({ pending: true });
    expect(isGenerating()).toBe(true);
    renderPage({ thinking: true });
    expect(isGenerating()).toBe(true);
  });

  it("gönder düğmesi varken false", () => {
    renderPage({ text: "merhaba" });
    expect(isGenerating()).toBe(false);
  });
});

describe("findSendButton", () => {
  it("etiketle bulur", () => {
    renderPage({ text: "merhaba" });
    expect(findSendButton(findComposer()!)!.getAttribute("aria-label")).toBe("Mesaj gönder");
  });

  it("İngilizce etiketi tanır", () => {
    renderPage({ text: "merhaba", sendLabel: "Send message" });
    expect(findSendButton(findComposer()!)).not.toBeNull();
  });

  it("bilinmeyen dilde, yazı varken alandaki son düğmeyi seçer", () => {
    renderPage({ text: "merhaba", sendLabel: "Envoyer le message" });
    expect(findSendButton(findComposer()!)!.getAttribute("aria-label")).toBe("Envoyer le message");
  });

  it("kutu boşken (gönder düğmesi yokken) bulamaz", () => {
    renderPage();
    expect(findSendButton(findComposer()!)).toBeNull();
  });

  it("üretim sürerken (bekleyen istek) bilinmeyen dilde son düğmeyi gönder diye seçmez", () => {
    renderPage({ text: "merhaba", stop: true, stopLabel: "Arrêter", pending: true });
    expect(findSendButton(findComposer()!)).toBeNull();
  });
});

describe("conversationKey, matches ve newChatUrl", () => {
  it("adresten sohbet kimliğini çıkarır", () => {
    expect(chatKeyFromPath("/u/1/app/95ad1c2f3b4e5d6a")).toBe("95ad1c2f3b4e5d6a");
    expect(chatKeyFromPath("/app/95ad1c2f3b4e5d6a")).toBe("95ad1c2f3b4e5d6a");
    expect(chatKeyFromPath("/app/95ad1c2f3b4e5d6a/")).toBe("95ad1c2f3b4e5d6a");
  });

  it("yeni sohbet ve bilinmeyen adresler null", () => {
    expect(chatKeyFromPath("/u/1/app")).toBeNull();
    expect(chatKeyFromPath("/app")).toBeNull();
    expect(chatKeyFromPath("/gems/view")).toBeNull();
    expect(chatKeyFromPath("/app/kisa")).toBeNull();
  });

  it("yalnızca gemini.google.com eşleşir", () => {
    expect(geminiAdapter.matches(new URL("https://gemini.google.com/app"))).toBe(true);
    expect(geminiAdapter.matches(new URL("https://chatgpt.com/"))).toBe(false);
    expect(geminiAdapter.matches(new URL("https://google.com/"))).toBe(false);
  });

  it("yeni sohbet adresi hesap dizinini korur", () => {
    window.history.pushState({}, "", "/u/1/app/95ad1c2f3b4e5d6a");
    expect(geminiAdapter.newChatUrl()).toBe(`${location.origin}/u/1/app`);
    window.history.pushState({}, "", "/app/95ad1c2f3b4e5d6a");
    expect(geminiAdapter.newChatUrl()).toBe(`${location.origin}/app`);
    window.history.pushState({}, "", "/baska");
    expect(geminiAdapter.newChatUrl()).toBe(`${location.origin}/app`);
  });
});

describe("start(): gönderme, bekletme ve cevap bitişi", () => {
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

  it("Enter ile gönderilen mesajı yakalar", () => {
    renderPage({ text: "merhaba" });
    stop = geminiAdapter.start(handlers);
    pressEnter();
    expect(handlers.onBeforeSend).toHaveBeenCalledTimes(1);
    expect(handlers.onSend).toHaveBeenCalledWith({ text: "merhaba" });
  });

  it("Shift+Enter, IME ve boş kutu mesaj sayılmaz", () => {
    renderPage({ text: "merhaba" });
    stop = geminiAdapter.start(handlers);
    pressEnter({ shiftKey: true });
    pressEnter({ isComposing: true });
    renderPage();
    pressEnter();
    expect(handlers.onSend).not.toHaveBeenCalled();
  });

  it("üretim sürerken Enter mesaj sayılmaz", () => {
    renderPage({ text: "merhaba", pending: true });
    stop = geminiAdapter.start(handlers);
    pressEnter();
    expect(handlers.onSend).not.toHaveBeenCalled();
  });

  it("Gönder düğmesine tıklamayı yakalar; başka düğmeyi saymaz", () => {
    renderPage({ text: "merhaba" });
    stop = geminiAdapter.start(handlers);
    document.querySelector<HTMLButtonElement>('button[aria-label="Dikte et (⌘⇧D)"]')!.click();
    expect(handlers.onSend).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>('button[aria-label="Mesaj gönder"]')!.click();
    expect(handlers.onSend).toHaveBeenCalledWith({ text: "merhaba" });
  });

  it("onBeforeSend true dönerse Enter ve tıklama durdurulur, bağlam anchor olarak verilir", () => {
    handlers.onBeforeSend.mockReturnValue(true);
    renderPage({ text: "merhaba" });
    stop = geminiAdapter.start(handlers);
    const box = document.getElementById("real")!;
    const pageListener = vi.fn();
    box.addEventListener("keydown", pageListener);
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    box.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(pageListener).not.toHaveBeenCalled();
    expect(handlers.onSend).not.toHaveBeenCalled();
    expect(handlers.onBeforeSend.mock.calls[0]![0].anchor.className).toContain("text-input-field");

    const pageClick = vi.fn();
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Mesaj gönder"]')!;
    button.addEventListener("click", pageClick);
    button.click();
    expect(pageClick).not.toHaveBeenCalled();
    expect(handlers.onSend).not.toHaveBeenCalled();
  });

  it("submitHeld bekleyen mesajı bir kez gönderir ve onSend çağrılır", () => {
    handlers.onBeforeSend.mockReturnValueOnce(true).mockReturnValue(false);
    renderPage({ text: "merhaba" });
    stop = geminiAdapter.start(handlers);
    const pageClick = vi.fn();
    document.querySelector<HTMLButtonElement>('button[aria-label="Mesaj gönder"]')!.addEventListener("click", pageClick);
    pressEnter();
    expect(handlers.onSend).not.toHaveBeenCalled();
    expect(geminiAdapter.submitHeld()).toBe(true);
    expect(pageClick).toHaveBeenCalledTimes(1);
    expect(handlers.onSend).toHaveBeenCalledWith({ text: "merhaba" });
    expect(geminiAdapter.submitHeld()).toBe(false); // bekleyen kalmadı
  });

  it("gönderdikten sonra üretim başlar ve biterse onResponseComplete çağrılır", () => {
    renderPage({ text: "merhaba" });
    stop = geminiAdapter.start(handlers);
    pressEnter();
    renderPage({ stop: true, pending: true });
    vi.advanceTimersByTime(300);
    renderPage({ stop: true });
    vi.advanceTimersByTime(300);
    expect(handlers.onResponseComplete).not.toHaveBeenCalled();
    renderPage();
    vi.advanceTimersByTime(2000);
    expect(handlers.onResponseComplete).toHaveBeenCalledTimes(1);
    expect(handlers.onNoSignal).not.toHaveBeenCalled();
  });

  it("hiç üretim sinyali gelmezse onNoSignal çağrılır", () => {
    renderPage({ text: "merhaba" });
    stop = geminiAdapter.start(handlers);
    pressEnter();
    renderPage();
    vi.advanceTimersByTime(16_000);
    expect(handlers.onNoSignal).toHaveBeenCalledTimes(1);
    expect(handlers.onResponseComplete).not.toHaveBeenCalled();
  });
});

describe("readHistory", () => {
  const query = (lines: string[], extra = "") =>
    `<user-query ${extra}><span class="user-query-container"><div class="query-text">
       <h5 class="cdk-visually-hidden screen-reader-user-query-label"><span>Siz şunu dediniz:</span> ${lines.join(" ")}</h5>
       ${lines.map((l) => `<p class="query-text-line">${l}</p>`).join("")}
     </div></span></user-query>`;

  it("yalnızca mesaj satırlarını okur; ekran okuyucu etiketini almaz", () => {
    document.body.innerHTML = query(["ilk istek"]) + query([" ikinci istek "]);
    expect(geminiAdapter.readHistory()).toEqual(["ilk istek", "ikinci istek"]);
  });

  it("çok satırlı mesajı satır sonuyla birleştirir", () => {
    document.body.innerHTML = query(["birinci satır", "ikinci satır"]);
    expect(geminiAdapter.readHistory()).toEqual(["birinci satır\nikinci satır"]);
  });

  it("görünmez (yersiz) mesajı ve boş mesajı atlar", () => {
    document.body.innerHTML = query(["eski sohbetten kalan"], "data-gizli") + query(["   "]) + query(["bu sohbetin mesajı"]);
    expect(geminiAdapter.readHistory()).toEqual(["bu sohbetin mesajı"]);
  });

  it("sayfa yapısı değişmişse (satır öğesi yok) boş döner, çökmez", () => {
    document.body.innerHTML = "<user-query><div>metin</div></user-query>";
    expect(geminiAdapter.readHistory()).toEqual([]);
  });
});

describe("insertText, composer ve focusComposer", () => {
  const exec = vi.fn();
  beforeEach(() => {
    exec.mockReset().mockReturnValue(true);
    (document as unknown as { execCommand: typeof exec }).execCommand = exec;
  });
  afterEach(() => {
    delete (document as unknown as { execCommand?: unknown }).execCommand;
  });

  it("dolu kutuda önce yeni paragraf, sonra metni ekler", () => {
    renderPage({ text: "merhaba" });
    exec.mockImplementation((cmd: string) => {
      if (cmd === "insertParagraph") document.getElementById("real")!.textContent = "merhaba\n";
      return true;
    });
    expect(geminiAdapter.insertText("Daha kısa yaz.")).toBe(true);
    expect(exec.mock.calls.map((c) => c[0])).toEqual(["insertParagraph", "insertText"]);
  });

  it("boş kutuda satır sonu eklemez", () => {
    renderPage();
    geminiAdapter.insertText("Daha kısa yaz.");
    expect(exec.mock.calls.map((c) => c[0])).toEqual(["insertText"]);
  });

  it("kutu yoksa false döner", () => {
    document.body.innerHTML = "";
    expect(geminiAdapter.insertText("x")).toBe(false);
  });

  it("composer() çapayı ve boş olup olmadığını verir", () => {
    renderPage();
    const empty = geminiAdapter.composer()!;
    expect(empty.empty).toBe(true);
    expect(empty.anchor.className).toContain("text-input-field");
    renderPage({ text: "yazıyorum" });
    expect(geminiAdapter.composer()!.empty).toBe(false);
    document.body.innerHTML = "";
    expect(geminiAdapter.composer()).toBeNull();
  });

  it("focusComposer kutuya odaklanır", () => {
    renderPage();
    geminiAdapter.focusComposer();
    expect(document.activeElement?.id).toBe("real");
  });
});
