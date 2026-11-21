import { detectTheme } from "./theme";

/**
 * Kısıt notu (deney, varsayılanı kapalı; src/config.ts experimentOn("kisitNotu")). Aynı açık sınır üst üste iki
 * cevapta aşıldığında, ikinci cevabın hemen altında sayfa akışı içinde küçük bir not. Düğmesi yoktur; gönderimi
 * bekletmez, odağı almaz, mesaj göndermez. Metni src/core/constraint-probe.ts kurar (deney metni, ürün metni değil).
 */
const NOTE_CSS = `
:host { all: initial; display: block; margin: 8px 0 4px; }
.note {
  --bg: #fbf7f1; --fg: #2b2015; --line: rgba(68, 50, 27, .16);
  box-sizing: border-box; max-width: 640px; padding: 8px 12px;
  font: 13.5px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
}
.note[data-theme="dark"] { --bg: #2a1f14; --fg: #f7efe3; --line: rgba(247, 239, 227, .14); }
`;

export class ConstraintNote {
  private hosts: HTMLElement[] = [];

  /** Notu verilen cevap öğesinin hemen arkasına ekler. Öğe yoksa ya da sayfada değilse false döner. */
  show(after: Element | null, text: string): boolean {
    if (!after || !after.isConnected) return false;
    const host = document.createElement("div");
    host.setAttribute("data-kafiai", "kisit-notu");
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = NOTE_CSS;
    const p = document.createElement("p");
    p.className = "note";
    p.dataset.theme = detectTheme(after);
    p.setAttribute("role", "note");
    p.textContent = text;
    root.append(style, p);
    after.insertAdjacentElement("afterend", host);
    this.hosts.push(host);
    return true;
  }

  /** Sohbet değişince eklenen notlar kaldırılır. */
  hideAll(): void {
    for (const host of this.hosts) host.remove();
    this.hosts = [];
  }
}
