import { POLL_MS } from "../config";
import { ResponseWatcher } from "../core/response-watcher";
import { appendToTextarea } from "./insert";
import type { Adapter, AdapterHandlers } from "./types";
import { lastOf, responseText } from "./response-text";

/** Bekletilen gönderim (varsa) ve "bir sonraki girişimi engelleme" bayrağı. */
let heldComposer: HTMLTextAreaElement | null = null;
let bypassNext = false;

/**
 * Google AI Modu sayfa yapısı (Kasım 2026'da canlı sayfada ölçüldü, test-snapshots/google_ai_mode):
 *  - Adres: google.com/search?udm=50. Sohbet kimliği adreste yok; ilk soru q parametresinde durur ve
 *    takip soruları gönderildiğinde değişmez. Yeni sohbet q'yu siler. Sınıf adları anlamsız ve
 *    değişken, bu yüzden yalnızca data-xid, role ve aria öznitelikleri kullanılır.
 *  - Mesaj kutusu: [data-xid$="input-plate"] içindeki <textarea>. İki kutu var: boş sohbette
 *    "aim-zero-state-input-plate", sohbet başlayınca "aim-mars-input-plate"; görünür olan kullanılır.
 *    Bir mesajı düzenlerken açılan kutu bu alanların dışında, mesaj kutusu sayılmaz.
 *  - Gönder düğmesi: aynı alandaki [data-xid="input-plate-send-button"]; kutu boşken gizli.
 *  - Kullanıcı mesajları: [data-xid="aim-mars-turn-root"] içindeki span[role="heading"].
 *  - Cevaplar: [data-scope-id="turn"]. Cevap bitince içine geri bildirim alanı eklenir
 *    ([data-xid="Gd7Hsc"]: "hata olabilir" notu, beğen ve kopyala düğmeleri). Ölçümde metin akışı
 *    bittikten birkaç saniye sonra geldi. Son cevapta bu alan yoksa cevap üretiliyor sayılır.
 *    Durdur düğmesi ([data-xid="ljhwxf"]) ölçümlerde hiç görünür olmadı; yalnızca yedek sinyal.
 *  - Mesaj düzenleme: kullanıcı mesajının "Düzenleyin" düğmesi aynı yerde bir kutu ve "Gönder"
 *    düğmesi açar. Bu düğmeye basılması ya da kutuda Enter düzenleme olarak sayılır.
 */

const HOSTS = new Set(["www.google.com", "google.com"]);
const PLATE = '[data-xid$="input-plate"]';
const SEND = '[data-xid="input-plate-send-button"]';
const STOP = '[data-xid="ljhwxf"]';
const TURN_ROOT = '[data-xid="aim-mars-turn-root"]';
const ANSWER = '[data-scope-id="turn"]';
const ANSWER_DONE = '[data-xid="Gd7Hsc"]';

const visible = (el: Element) => el.getClientRects().length > 0;

/** Yalnızca AI Modu sayfası: /search ve udm=50. Normal Google aramasında eklenti hiçbir şey yapmaz. */
export function isAiMode(url: URL): boolean {
  return HOSTS.has(url.hostname) && url.pathname === "/search" && url.searchParams.get("udm") === "50";
}

/** 32 bitlik FNV-1a; ilk sorunun kendisi yerine kısa bir özet tutulur. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Sohbeti anahtarlayan değer: ilk sorunun özeti (metnin kendisi tutulmaz). Yeni ve boş sohbette null.
 * Takip soruları adresi değiştirmez; başka bir sohbete geçmek ilk soruyu değiştirir.
 */
export function chatKeyFromUrl(url: URL): string | null {
  if (!isAiMode(url)) return null;
  const q = (url.searchParams.get("q") ?? "").trim();
  return q === "" ? null : `q${fnv1a(q)}`;
}

/** Görünür mesaj kutusu; yoksa ilk kutu (testlerde ve sayfa açılırken). */
export function findComposer(root: ParentNode = document): HTMLTextAreaElement | null {
  const boxes = Array.from(root.querySelectorAll<HTMLTextAreaElement>(`${PLATE} textarea`));
  return boxes.find(visible) ?? null;
}

export function composerContaining(node: EventTarget | null): HTMLTextAreaElement | null {
  if (!(node instanceof HTMLTextAreaElement)) return null;
  return node.closest(PLATE) ? node : null;
}

export function readComposerText(box: HTMLTextAreaElement): string {
  return (box.value || "").trim();
}

export function findSendButton(composer: HTMLTextAreaElement): HTMLButtonElement | null {
  const plate = composer.closest(PLATE);
  if (!plate) return null;
  return Array.from(plate.querySelectorAll<HTMLButtonElement>(SEND)).find(visible) ?? null;
}

/** Yapay zeka şu an cevap üretiyor mu? */
export function isGenerating(root: ParentNode = document): boolean {
  if (Array.from(root.querySelectorAll(STOP)).some(visible)) return true;
  const answers = root.querySelectorAll(ANSWER);
  const last = answers[answers.length - 1];
  return last !== undefined && last.querySelector(ANSWER_DONE) === null;
}

/** Sayfadaki kullanıcı mesajları (eskiden yeniye). */
export function readUserMessages(root: ParentNode = document): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`${TURN_ROOT} span[role="heading"]`))
    .map((el) => (el.innerText || el.textContent || "").trim())
    .filter((text) => text.length > 0);
}

/** Bir mesajın düzenleme kutusu: sohbet içinde, mesaj kutusu alanlarının dışında görünen <textarea>. */
export function editBoxContaining(node: EventTarget | null): HTMLTextAreaElement | null {
  if (!(node instanceof Element)) return null;
  const turn = node.closest(TURN_ROOT);
  if (!turn || node.closest(ANSWER)) return null;
  if (node instanceof HTMLTextAreaElement) return node;
  // Düzenleme kutusunun yanındaki düğme: yakın bir atada görünür bir düzenleme kutusu var mı?
  let el: Element | null = node;
  for (let i = 0; i < 6 && el && el !== turn; i++) {
    const box = Array.from(el.querySelectorAll<HTMLTextAreaElement>("textarea")).find(
      (t) => visible(t) && !t.closest(ANSWER),
    );
    if (box) return box;
    el = el.parentElement;
  }
  return null;
}

function anchorOf(box: HTMLTextAreaElement): Element {
  return box.closest(PLATE) ?? box;
}

export const googleAiModeAdapter: Adapter = {
  name: "google_ai_mode",
  platform: "google_ai_mode",

  matches(url) {
    return isAiMode(url);
  },

  conversationKey(url) {
    return chatKeyFromUrl(url);
  },

  submitHeld() {
    const composer = heldComposer;
    heldComposer = null;
    if (!composer || !composer.isConnected) return false;
    const button = findSendButton(composer);
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
    return `${location.origin}/search?udm=50`;
  },

  lastResponse() {
    const last = lastOf(ANSWER);
    return responseText(last?.querySelector('[data-xid="VpUvz"]') ?? last, `h3, ${ANSWER_DONE}`);
  },

  readHistory() {
    return readUserMessages();
  },

  composer() {
    const box = findComposer();
    return box ? { anchor: anchorOf(box), empty: readComposerText(box) === "" } : null;
  },

  focusComposer() {
    findComposer()?.focus();
  },

  insertText(text) {
    const composer = heldComposer ?? findComposer();
    heldComposer = null;
    if (!composer) return false;
    return appendToTextarea(composer, text);
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

    const intercept = (event: Event, composer: HTMLTextAreaElement, text: string): boolean => {
      if (bypassNext) {
        bypassNext = false;
        return false;
      }
      if (!handlers.onBeforeSend?.({ text, anchor: anchorOf(composer) })) return false;
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
      const edit = editBoxContaining(event.target);
      if (edit && edit.value.trim() !== "") {
        handlers.onEdit?.();
        return;
      }
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
      if (clicked.matches(SEND)) {
        const plate = clicked.closest(PLATE);
        const composer = plate?.querySelector<HTMLTextAreaElement>("textarea");
        if (!composer) return;
        const text = readComposerText(composer);
        if (!text) return;
        if (intercept(event, composer, text)) return;
        handleSend(text);
        return;
      }
      // Düzenleme kutusunun yanındaki etkin düğme (İptal hariç: o düğmede kutuya yazılmış metin
      // değişmeden kalır ve sayfa kutuyu kapatır; iki düğmeyi yalnızca sıralarından ayırıyoruz).
      const edit = editBoxContaining(clicked);
      if (edit && !clicked.closest(PLATE)) {
        const buttons = Array.from(edit.closest(TURN_ROOT)?.querySelectorAll<HTMLButtonElement>("button") ?? []).filter(
          (b) => visible(b) && editBoxContaining(b) === edit,
        );
        if (buttons.length >= 2 && buttons[buttons.length - 1] === clicked) handlers.onEdit?.();
      }
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
