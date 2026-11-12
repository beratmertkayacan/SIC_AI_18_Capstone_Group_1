import { BRAND_NAME, logoMark } from "../brand";

/**
 * Sayfa içindeki kartların (şerit, çıkış kartı) ortak görünümü. Kartlar Shadow DOM içinde çizilir;
 * sitenin stilinden etkilenmez. Tema işletim sisteminin ayarından değil, kartın üzerinde duracağı
 * sayfanın gerçek arka planından seçilir: koyu temalı bir sohbet sayfasında açık işletim sistemi
 * ayarı olsa da kart koyu çizilir ve arka planla karışmaz.
 */

export type Theme = "light" | "dark";

/** "rgb(a)" metnini [r, g, b, a] dizisine çevirir; anlaşılmazsa null. */
export function parseColor(value: string): [number, number, number, number] | null {
  const m = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/i);
  if (!m) return null;
  let a = 1;
  if (m[4] !== undefined) a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return [Number(m[1]), Number(m[2]), Number(m[3]), a];
}

/** Göreli parlaklık (WCAG), 0 koyu ile 1 açık arası. */
export function luminance(r: number, g: number, b: number): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Kartın yanında duracağı öğeden yukarı doğru ilk opak arka planı bulur ve temayı seçer. */
export function detectTheme(anchor: Element | null): Theme {
  let node: Element | null = anchor;
  while (node) {
    const color = parseColor(getComputedStyle(node).backgroundColor);
    if (color && color[3] > 0.5) return luminance(color[0], color[1], color[2]) < 0.4 ? "dark" : "light";
    node = node.parentElement;
  }
  const prefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export const CARD_CSS = `
:host { all: initial; }
.card {
  --bg: #fbf7f1; --fg: #2b2015; --muted: #6e5a44; --line: rgba(68, 50, 27, .16); --soft: #f3eadc;
  --accent: #8b6b46; --primary: #44321b; --primary-fg: #f7efe3; --ring: rgba(139, 107, 70, .45);
  --shadow: 0 1px 2px rgba(68, 50, 27, .08), 0 14px 36px -10px rgba(68, 50, 27, .32);
  position: fixed; z-index: 2147483000; box-sizing: border-box;
  font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--fg); background: var(--bg);
  border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow);
  caret-color: var(--accent);
  padding: 12px 16px 14px; overflow: hidden;
  animation: kafiai-in .22s cubic-bezier(.2, .8, .2, 1);
}
.card[data-theme="dark"] {
  --bg: #2a1f14; --fg: #f7efe3; --muted: #c9b79c; --line: rgba(247, 239, 227, .14); --soft: #35281a;
  --accent: #c9a875; --primary: #c9a875; --primary-fg: #2a1f14; --ring: rgba(201, 168, 117, .5);
  --shadow: 0 1px 2px rgba(0, 0, 0, .5), 0 18px 44px -10px rgba(0, 0, 0, .75);
}
@keyframes kafiai-in { from { opacity: 0; transform: translateY(6px) scale(.985); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .card { animation: none; } button { transition: none; } button:active { transform: none; } }
.card ::selection { background: rgba(201, 168, 117, .38); color: var(--fg); }
.head { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; }
.mark { width: 16px; height: 16px; color: var(--accent); flex: none; display: block; }
.brand { font-size: 12.5px; font-weight: 600; letter-spacing: .02em; color: var(--fg); }
.chip { font-size: 11.5px; font-weight: 500; color: var(--muted); background: var(--soft); border-radius: 999px; padding: 1px 8px; }
p { margin: 0 0 8px; }
.title { font-weight: 600; font-size: 14.5px; margin-bottom: 2px; }
.body { color: var(--fg); }
.hint, .note { color: var(--muted); font-size: 13px; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
.spacer { flex: 1 1 auto; }
button {
  font: inherit; font-size: 13.5px; cursor: pointer; border-radius: 999px; padding: 6px 14px;
  border: 1px solid transparent; background: var(--primary); color: var(--primary-fg);
  transition: filter .12s ease-out, background .12s ease-out, border-color .12s ease-out, transform .1s ease-out;
}
button:hover { filter: brightness(1.08); }
button:active { transform: translateY(1px); }
button:disabled { opacity: .6; cursor: default; transform: none; }
button.secondary { background: transparent; color: var(--fg); border-color: var(--line); }
button.secondary:hover { background: var(--soft); border-color: var(--accent); filter: none; }
button.link { background: transparent; color: var(--muted); padding: 6px 6px; }
button.link:hover { color: var(--fg); filter: none; }
button:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
textarea {
  width: 100%; box-sizing: border-box; min-height: 130px; margin: 6px 0 4px; padding: 10px 12px;
  font: inherit; color: inherit; background: var(--soft); border: 1px solid var(--line); border-radius: 12px; resize: vertical;
}
textarea:focus-visible { outline: 2px solid var(--ring); outline-offset: 1px; }
`;

export interface MountedCard {
  host: HTMLElement;
  box: HTMLDivElement;
}

/** Kartı Shadow DOM içinde oluşturur, temasını sayfadan seçer ve mesaj kutusunun üstüne yerleştirir. */
export function mountCard(kind: string, anchor: Element): MountedCard {
  const host = document.createElement("div");
  host.setAttribute("data-kafiai", kind);
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CARD_CSS;
  const box = document.createElement("div");
  box.className = "card strip";
  box.dataset.theme = detectTheme(anchor);
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", BRAND_NAME);
  box.setAttribute("aria-live", "polite"); // ekran okuyucu kartı açıldığında okur
  root.append(style, box);

  const rect = anchor.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width, 300), window.innerWidth - 16);
  box.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
  box.style.width = `${width}px`;
  box.style.bottom = `${Math.max(8, window.innerHeight - rect.top + 10)}px`;
  document.body.appendChild(host);
  return { host, box };
}

/** Kartın üst satırı: logo işareti, marka adı ve isteğe bağlı bağlam etiketi. */
export function header(chip?: string): HTMLDivElement {
  const head = document.createElement("div");
  head.className = "head";
  const mark = logoMark(16);
  mark.classList.add("mark");
  const brand = document.createElement("span");
  brand.className = "brand";
  brand.textContent = BRAND_NAME;
  head.append(mark, brand);
  if (chip) {
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = chip;
    head.append(c);
  }
  return head;
}
