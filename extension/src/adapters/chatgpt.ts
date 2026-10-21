import { POLL_MS } from "../config";
import { ResponseWatcher } from "../core/response-watcher";
import type { Adapter, AdapterHandlers } from "./types";

/**
 * ChatGPT sayfa yapısı (Ekim 2026'da canlı sayfada ölçüldü):
 *  - Mesaj kutusu: <form> içinde contenteditable="true" role="textbox" bir div.
 *  - Gönder düğmesi: formda button[type="submit"]; yalnızca kutuda yazı varken var.
 *  - Cevap üretilirken: gönder yerine "Durdur" düğmesi gelir (type="button") ve
 *    yeni turun data-talvt-turn-state değeri "in_progress" olur.
 *
 * aria-label metinleri kullanıcının diline göre değiştiği için düğmeleri etiketle değil
 * yapıyla buluyoruz. Durdur etiketi yalnızca yedek sinyal olarak, çok dilli listeyle aranır.
 */

const COMPOSER_SELECTOR = '[contenteditable="true"][role="textbox"]';

const STOP_LABEL = /^(durdur|stop|arrêter|detener|parar|stoppen|stopp|fermare|остановить)/i;

const HOSTS = new Set(["chatgpt.com", "chat.openai.com"]);

const CONVERSATION_PATH = /\/c\/([A-Za-z0-9-]{8,})/;

/**
 * Sayfada birden fazla mesaj kutusu olabilir (canlı sayfada ikisi var: biri gizli bir kopya).
 * Bu yüzden "ilk kutu" değil, her zaman olayın geldiği kutu kullanılır.
 */
export function findComposers(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(COMPOSER_SELECTOR)).filter((box) => box.closest("form"));
}

/** Verilen düğüm bir mesaj kutusunun içindeyse o kutuyu döndürür. */
export function composerContaining(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  const box = node.closest<HTMLElement>(COMPOSER_SELECTOR);
  return box && box.closest("form") ? box : null;
}

/** Genel amaçlı: odaktaki kutu, yoksa görünen ilk kutu, yoksa ilk kutu. */
export function findComposer(root: ParentNode = document): HTMLElement | null {
  const boxes = findComposers(root);
  const focused = boxes.find((box) => box.contains(document.activeElement));
  if (focused) return focused;
  return boxes.find((box) => box.getClientRects().length > 0) ?? boxes[0] ?? null;
}

export function readComposerText(box: HTMLElement): string {
  return (box.innerText || box.textContent || "").trim();
}

function hasStopButton(form: HTMLFormElement): boolean {
  if (form.querySelector('button[data-testid="stop-button"]')) return true;
  const buttons = Array.from(form.querySelectorAll<HTMLButtonElement>("button"));
  return buttons.some((b) => STOP_LABEL.test(b.getAttribute("aria-label") ?? ""));
}

/** Yapay zeka şu an cevap üretiyor mu? */
export function isGenerating(root: ParentNode = document): boolean {
  if (root.querySelector('[data-talvt-turn-state="in_progress"]')) return true;
  return findComposers(root).some((box) => {
    const form = box.closest("form");
    return form ? hasStopButton(form) : false;
  });
}

export const chatgptAdapter: Adapter = {
  name: "chatgpt",

  matches(url) {
    return HOSTS.has(url.hostname);
  },

  conversationKey(url) {
    const match = CONVERSATION_PATH.exec(url.pathname);
    return match ? (match[1] ?? null) : null;
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

    const handleSend = (text: string) => {
      if (!text) return;
      handlers.onSend({ text });
      watcher.begin(Date.now());
      startPolling();
    };

    // Yakalama (capture) aşamasında dinliyoruz: sayfanın kendi kodu mesaj kutusunu
    // temizlemeden önce metni okuyabilmek için.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey || event.altKey || event.isComposing) return;
      const composer = composerContaining(event.target);
      if (!composer) return;
      if (isGenerating(document)) return; // üretim sürerken Enter mesaj göndermez
      handleSend(readComposerText(composer));
    };

    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest('button[type="submit"]');
      const composer = button?.closest("form")?.querySelector<HTMLElement>(COMPOSER_SELECTOR);
      if (!composer) return;
      handleSend(readComposerText(composer));
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("click", onClick, true);
      watcher.cancel();
      if (timer !== undefined) window.clearInterval(timer);
    };
  },
};
