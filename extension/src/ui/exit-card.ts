import { CSS as BASE_CSS } from "./strip";

/**
 * Çıkış kartı: sohbet uzayıp tekrar denemeleri olduysa, cevap bittikten sonra mesaj kutusunun
 * üstünde görünür. "Taze başlat" kullanıcının isteklerini düzenlenebilir tek taslakta toplar,
 * panoya kopyalar ve yeni sohbet açar. Dil yargılamaz; sayaç, rozet, seri yok.
 */

export type ExitDismissal = "kapat" | "ara" | "taze";

export interface ExitCardActions {
  /** Sohbetteki istekleri toplayan taslak metni üretir (tıklanınca çağrılır). */
  getDraft(): string;
  /** Düzenlenmiş taslağı kopyala ve yeni sohbet aç. Kopyalama başarılıysa true döner. */
  onFreshStart(draft: string): Promise<boolean>;
  /** Kart kapandı (kullanıcı kapattı ya da bir seçim yaptı). */
  onDismiss(kind: ExitDismissal): void;
}

const EXTRA_CSS = `
textarea {
  width: 100%; box-sizing: border-box; min-height: 130px; margin: 0 0 10px; padding: 8px 10px;
  font: inherit; color: inherit; background: transparent; border: 1px solid #b6bcc4; border-radius: 10px; resize: vertical;
}
.note { color: #57606a; font-size: 13px; margin: 0 0 10px; }
@media (prefers-color-scheme: dark) { .note { color: #b0b0b8; } textarea { border-color: #5a5a60; } }
`;

export class ExitCard {
  private host: HTMLElement | null = null;
  private onKey: ((e: KeyboardEvent) => void) | null = null;

  get visible(): boolean {
    return this.host !== null;
  }

  show(anchor: Element, turns: number, actions: ExitCardActions): void {
    this.hide();
    const host = document.createElement("div");
    host.setAttribute("data-kafiai", "exit-card");
    const root = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = BASE_CSS + EXTRA_CSS;
    const box = document.createElement("div");
    box.className = "strip";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "KafiAI");
    root.append(style, box);

    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] => {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (cls) node.className = cls;
      return node;
    };
    const button = (text: string, cls: string, onClick: () => void): HTMLButtonElement => {
      const b = el("button", text, cls);
      b.type = "button";
      b.addEventListener("click", onClick);
      return b;
    };
    const row = (...children: HTMLElement[]): HTMLDivElement => {
      const r = el("div", undefined, "row");
      r.append(...children);
      return r;
    };
    const dismiss = (kind: ExitDismissal) => {
      this.hide();
      actions.onDismiss(kind);
    };

    const showMain = () => {
      const fresh = button("Taze başlat", "", showDraft);
      box.replaceChildren(
        el(
          "p",
          `Bu sohbet ${turns}. turunda. Uzun sohbetlerde yapay zeka modelleri yolunu kaybedebiliyor; ` +
            "isteklerini tek mesajda toplayıp yeni bir sohbet açmak genelde daha hızlı olur.",
        ),
        row(fresh, button("Kısa ara ver", "secondary", showBreak), button("Kapat", "link", () => dismiss("kapat"))),
      );
      fresh.focus();
    };

    const showBreak = () => {
      const close = button("Kapat", "", () => dismiss("ara"));
      box.replaceChildren(el("p", "Tamam. Sohbet burada duruyor; hazır olduğunda kaldığın yerden devam edebilirsin."), row(close));
      close.focus();
    };

    const showDraft = () => {
      const area = el("textarea");
      area.value = actions.getDraft();
      area.setAttribute("aria-label", "Yeni sohbet taslağı");
      const note = el("p", "", "note");
      const go = button("Kopyala ve yeni sohbet aç", "", () => {
        go.disabled = true;
        void actions.onFreshStart(area.value).then((ok) => {
          if (ok) {
            box.replaceChildren(
              el("p", "Panoya kopyalandı. Yeni sohbette Ctrl+V (Mac'te ⌘+V) ile yapıştırabilirsin."),
              row(button("Kapat", "", () => dismiss("taze"))),
            );
          } else {
            go.disabled = false;
            note.textContent = "Kopyalanamadı. Metni seçip kendin kopyalayabilirsin.";
          }
        });
      });
      box.replaceChildren(el("p", "İsteklerini tek taslakta topladım. İstersen düzenle:"), area, note, row(go, button("Geri", "link", showMain)));
      area.focus();
    };

    showMain();

    const rect = anchor.getBoundingClientRect();
    box.style.left = `${Math.max(8, rect.left)}px`;
    box.style.width = `${Math.max(rect.width, 280)}px`;
    box.style.bottom = `${Math.max(8, window.innerHeight - rect.top + 8)}px`;

    document.body.appendChild(host);
    this.host = host;

    this.onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss("kapat");
    };
    document.addEventListener("keydown", this.onKey, true);
  }

  hide(): void {
    if (this.onKey) document.removeEventListener("keydown", this.onKey, true);
    this.onKey = null;
    this.host?.remove();
    this.host = null;
  }
}
