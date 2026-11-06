import type { RingLevel } from "../core/ring";
import { BRAND_NAME, logoMark } from "../brand";
import { detectTheme } from "./theme";

/**
 * Halkanın görünümü (K29). Mesaj kutusunun sağ üst köşesinin hemen üstünde duran 18 piksellik marka
 * işareti (logodaki üç yay); seviye arttıkça yaylar belirginleşir. Shadow DOM içinde çizilir, sitenin stilinden etkilenmez; tema sayfanın arka planından seçilir.
 * Seviye değiştiğinde ton yavaşça koyulaşır; yükselişte bir kez hafifçe nabız atar, sürekli hareket yok.
 * Fareyle üzerine gelince ya da klavyeyle odaklanınca tek satır açıklama görünür.
 */

const SIZE = 18;

export const RING_CSS = `
:host { all: initial; }
.wrap {
  --accent: #8b6b46; --fg: #2b2015; --bg: #fbf7f1; --line: rgba(68, 50, 27, .16); --halo: rgba(139, 107, 70, .18);
  --shadow: 0 1px 2px rgba(68, 50, 27, .1), 0 8px 20px -8px rgba(68, 50, 27, .35);
  position: fixed; z-index: 2147482999; font: 13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.wrap[data-theme="dark"] {
  --accent: #c9a875; --fg: #f7efe3; --bg: #2a1f14; --line: rgba(247, 239, 227, .16); --halo: rgba(201, 168, 117, .2);
  --shadow: 0 1px 2px rgba(0, 0, 0, .5), 0 10px 24px -8px rgba(0, 0, 0, .75);
}
button.ring {
  all: unset; box-sizing: border-box; display: grid; place-items: center; width: ${SIZE + 6}px; height: ${SIZE + 6}px;
  border-radius: 50%; cursor: default; color: var(--accent); transition: box-shadow .6s ease, background-color .6s ease;
}
button.ring svg { display: block; }
button.ring path { transition: opacity .6s ease; }
.wrap[data-level="0"] path { opacity: .28; }
.wrap[data-level="1"] path { opacity: .55; }
.wrap[data-level="1"] path[data-arc="0"] { opacity: .95; }
.wrap[data-level="2"] path { opacity: 1; }
.wrap[data-level="2"] button.ring { background: var(--halo); }
button.ring:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.wrap.pulse button.ring { animation: kafiai-pulse 1.2s ease-out 1; }
@keyframes kafiai-pulse {
  0% { box-shadow: 0 0 0 0 var(--halo); }
  40% { box-shadow: 0 0 0 6px var(--halo); }
  100% { box-shadow: 0 0 0 10px transparent; }
}
.tip {
  position: absolute; right: -4px; bottom: calc(100% + 8px); width: max-content; max-width: 260px;
  color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow);
  padding: 6px 10px; opacity: 0; transform: translateY(4px); pointer-events: none;
  transition: opacity .15s ease, transform .15s ease;
}
.wrap:hover .tip, .wrap:focus-within .tip { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  button.ring, button.ring path, .tip { transition: none; }
  .wrap.pulse button.ring { animation: none; }
}
`;

export class Ring {
  private host: HTMLElement | null = null;
  private wrap: HTMLDivElement | null = null;
  private button: HTMLButtonElement | null = null;
  private tip: HTMLDivElement | null = null;
  private level: RingLevel = 0;

  get visible(): boolean {
    return this.host !== null;
  }

  get currentLevel(): RingLevel {
    return this.level;
  }

  /**
   * Halkayı gösterir ya da günceller. Yükseldiyse true döner (sayaç için).
   * onExplain: kullanıcı açıklamayı ilk kez görünce (fare ya da odak) bir kez çağrılır.
   */
  update(anchor: Element, level: RingLevel, text: string, onExplain?: () => void): boolean {
    if (!this.host) this.mount(onExplain);
    const rose = level > this.level;
    this.level = level;
    const wrap = this.wrap!;
    wrap.dataset.level = String(level);
    wrap.dataset.theme = detectTheme(anchor);
    this.tip!.textContent = text;
    this.button!.setAttribute("aria-label", `${BRAND_NAME}: ${text}`);
    if (rose) {
      wrap.classList.remove("pulse");
      void wrap.offsetWidth; // animasyonu yeniden başlat
      wrap.classList.add("pulse");
    }
    this.place(anchor);
    return rose;
  }

  /** Mesaj kutusu yer değiştirdiyse (pencere boyutu, kaydırma) halkayı yeniden yerleştirir. */
  place(anchor: Element): void {
    if (!this.wrap) return;
    const rect = anchor.getBoundingClientRect();
    const box = SIZE + 6;
    const left = Math.min(Math.max(8, rect.right - box - 4), window.innerWidth - box - 8);
    const top = Math.max(8, rect.top - box - 6);
    this.wrap.style.left = `${left}px`;
    this.wrap.style.top = `${top}px`;
  }

  hide(): void {
    this.host?.remove();
    this.host = null;
    this.wrap = null;
    this.button = null;
    this.tip = null;
    this.level = 0;
  }

  private mount(onExplain?: () => void): void {
    const host = document.createElement("div");
    host.setAttribute("data-kafiai", "ring");
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = RING_CSS;
    const wrap = document.createElement("div");
    wrap.className = "wrap";
    wrap.dataset.level = "0";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ring";
    button.append(logoMark(SIZE));
    const tip = document.createElement("div");
    tip.className = "tip";
    tip.setAttribute("role", "tooltip");
    wrap.append(tip, button);
    root.append(style, wrap);
    let explained = false;
    const explain = () => {
      if (explained || this.level === 0) return;
      explained = true;
      onExplain?.();
    };
    wrap.addEventListener("mouseenter", explain);
    button.addEventListener("focus", explain);
    document.body.appendChild(host);
    this.host = host;
    this.wrap = wrap;
    this.button = button;
    this.tip = tip;
  }
}
