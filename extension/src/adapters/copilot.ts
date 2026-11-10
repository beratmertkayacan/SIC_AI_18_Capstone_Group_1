import { POLL_MS } from "../config";
import { ResponseWatcher } from "../core/response-watcher";
import { appendAsNewLine } from "./insert";
import type { Adapter, AdapterHandlers } from "./types";
import { reportedUserTurns } from "./virtual-list";
import { lastOf, responseText } from "./response-text";

/** Bekletilen gönderim (varsa) ve "bir sonraki girişimi engelleme" bayrağı. */
let heldComposer: HTMLElement | null = null;
let bypassNext = false;

/**
 * Microsoft Copilot sayfa yapısı (Kasım 2026'da kişisel hesapla alınan görüntülerle ölçüldü,
 * test-snapshots/copilot):
 *  - Mesaj kutusu: <form> yok. span#m365-chat-editor-target-element[contenteditable="true"]
 *    [role="textbox"] (Lexical düzenleyicisi), .fai-BebopLiteChatInput çerçevesi içinde.
 *  - Gönder düğmesi: aynı çerçevede button[type="submit"].fai-SendButton; kutu boşken yok.
 *    Cevap üretilirken aynı düğme durdur düğmesine döner (etiketi "Oluşturmayı durdur").
 *  - Kullanıcı mesajları: [data-testid="chatQuestion"] içindeki [data-testid="chatOutput"].
 *    Ekran okuyucuya özel "You said:" başlığı bu öğenin dışında; okunmaz.
 *  - Cevap bitince son cevaba [data-testid="lastChatMessage"] eklenir; üretim sürerken yok.
 *    Durdur etiketi yalnızca yedek sinyal (dile bağlı).
 *  - Sanal liste: Claude gibi yalnızca ekrandaki mesajlar çiziliyor (12 turluk sohbette 3 tur
 *    sayfadaydı); toplam aria-setsize'dan okunur.
 *  - Mesajı düzenlemek ayrı bir kutu açmıyor, metni mesaj kutusuna kopyalıyor; sonrası normal gönderim.
 *  - Yeniden üretme: son cevabın altındaki "Yeniden Dene" düğmesi (sınıfı ya da test kimliği yok,
 *    yalnızca etiketle tanınıyor; tanınmazsa yalnızca sayaç eksik kalır).
 */

const HOSTS = new Set(["copilot.microsoft.com"]);
const COMPOSER = '[contenteditable="true"][role="textbox"]#m365-chat-editor-target-element, [data-lexical-editor="true"][contenteditable="true"][role="textbox"]';
const FRAME = ".fai-BebopLiteChatInput";
const SUBMIT = 'button[type="submit"]';
const QUESTION_TEXT = '[data-testid="chatQuestion"] [data-testid="chatOutput"]';
const QUESTION = '[data-testid="chatQuestion"]';
const DONE = '[data-testid="lastChatMessage"]';
const MESSAGES = '[data-testid="MessageListContainer"]';

const STOP_LABEL = /^(oluşturmayı durdur|durdur|stop generating|stop responding|stop)/i;
const REGENERATE_LABEL = /^(yeniden dene|yeniden oluştur|regenerate|try again|retry)/i;

const CONVERSATION_PATH = /^\/(?:chats?|c)\/([A-Za-z0-9_-]{8,})(?:[/?#]|$)/;

/** Sohbet kimliği adresten. Yeni sohbet ("/") ve diğer sayfalar: null. */
export function chatKeyFromPath(pathname: string): string | null {
  return CONVERSATION_PATH.exec(pathname)?.[1] ?? null;
}

export function findComposer(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(COMPOSER);
}

export function composerContaining(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  return node.closest<HTMLElement>(COMPOSER);
}

export function readComposerText(box: HTMLElement): string {
  return (box.innerText || box.textContent || "").trim();
}

function frameOf(box: Element): Element {
  return box.closest(FRAME) ?? box.parentElement ?? box;
}

/** Mesaj kutusunun çerçevesindeki gönder (ya da durdur) düğmesi. */
function submitButton(root: ParentNode = document): HTMLButtonElement | null {
  const box = findComposer(root);
  if (!box) return null;
  return frameOf(box).querySelector<HTMLButtonElement>(SUBMIT);
}

/** Gönder düğmesi: çerçevedeki submit düğmesi, durdur düğmesi değilse. */
export function findSendButton(root: ParentNode = document): HTMLButtonElement | null {
  const b = submitButton(root);
  if (!b || STOP_LABEL.test(b.getAttribute("aria-label") ?? "")) return null;
  return b;
}

/** Yapay zeka şu an cevap üretiyor mu? */
export function isGenerating(root: ParentNode = document): boolean {
  const b = submitButton(root);
  if (b && STOP_LABEL.test(b.getAttribute("aria-label") ?? "")) return true;
  return root.querySelector(QUESTION) !== null && root.querySelector(DONE) === null;
}

export function readUserMessages(root: ParentNode = document): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>(QUESTION_TEXT))
    .map((el) => (el.innerText || el.textContent || "").trim())
    .filter((text) => text.length > 0);
}

export const copilotAdapter: Adapter = {
  name: "copilot",
  platform: "copilot",

  matches(url) {
    return HOSTS.has(url.hostname);
  },

  conversationKey(url) {
    return chatKeyFromPath(url.pathname);
  },

  submitHeld() {
    const composer = heldComposer;
    heldComposer = null;
    if (!composer || !composer.isConnected) return false;
    const button = findSendButton();
    if (!button || button.disabled) return false;
    bypassNext = true;
    try {
      button.click();
    } finally {
      bypassNext = false;
    }
    return true;
  },

  newChatUrl() {
    return `${location.origin}/`;
  },

  lastResponse() {
    return responseText(lastOf('[data-testid="markdown-reply"]'));
  },

  readHistory() {
    return readUserMessages();
  },

  historyTotal() {
    return reportedUserTurns();
  },

  composer() {
    const box = findComposer();
    return box ? { anchor: frameOf(box), empty: readComposerText(box) === "" } : null;
  },

  focusComposer() {
    findComposer()?.focus();
  },

  insertText(text) {
    const composer = heldComposer ?? findComposer();
    heldComposer = null;
    if (!composer) return false;
    return appendAsNewLine(composer, text);
  },

  start(handlers: AdapterHandlers) {
    const watcher = new ResponseWatcher(() => isGenerating(document), {
      onComplete: () => handlers.onResponseComplete(),
      onNoSignal: () => handlers.onNoSignal(),
    });

    let timer: number | undefined;
    const startPolling = () => {
      if (timer !== undefined) return;
      timer = window.setInterval(() => {
        watcher.tick(Date.now());
        if (!watcher.active && timer !== undefined) {
          window.clearInterval(timer);
          timer = undefined;
        }
      }, POLL_MS);
    };

    const intercept = (event: Event, composer: HTMLElement, text: string): boolean => {
      if (bypassNext) {
        bypassNext = false;
        return false;
      }
      if (!handlers.onBeforeSend?.({ text, anchor: frameOf(composer) })) return false;
      event.preventDefault();
      event.stopImmediatePropagation();
      heldComposer = composer;
      return true;
    };

    const handleSend = (text: string) => {
      if (!text) return;
      heldComposer = null;
      handlers.onSend({ text });
      watcher.begin(Date.now());
      startPolling();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey || event.altKey || event.isComposing) return;
      const composer = composerContaining(event.target);
      if (!composer) return;
      if (isGenerating(document)) return;
      const text = readComposerText(composer);
      if (!text) return;
      if (intercept(event, composer, text)) return;
      handleSend(text);
    };

    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const clicked = event.target.closest<HTMLButtonElement>("button");
      if (!clicked || clicked.disabled) return;
      if (clicked.closest(MESSAGES) && REGENERATE_LABEL.test(clicked.getAttribute("aria-label") ?? "")) {
        handlers.onRegenerate?.();
        watcher.begin(Date.now());
        startPolling();
        return;
      }
      if (clicked !== findSendButton()) return;
      const composer = findComposer();
      if (!composer) return;
      const text = readComposerText(composer);
      if (!text) return;
      if (intercept(event, composer, text)) return;
      handleSend(text);
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("click", onClick, true);
      watcher.cancel();
      heldComposer = null;
      if (timer !== undefined) window.clearInterval(timer);
    };
  },
};
