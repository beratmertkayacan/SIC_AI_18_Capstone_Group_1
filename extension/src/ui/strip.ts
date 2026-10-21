/**
 * Gönderirken şerit: benzer bir mesaj gönderilmek üzereyken mesaj kutusunun üstünde görünen
 * küçük, kapatılabilir kutu. Sayfanın stilinden etkilenmemesi için Shadow DOM içinde çizilir.
 * Dil: yargılamaz, "istersen" der; "bağımlı", "risk" gibi sözler kullanılmaz.
 */

export interface StripActions {
  onSendAnyway(): void;
  onEdit(): void;
}

const CSS = `
:host { all: initial; }
.strip {
  position: fixed; z-index: 2147483000; box-sizing: border-box;
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
  background: #fff; color: #1f2328; border: 1px solid #d0d7de; border-radius: 14px;
  box-shadow: 0 6px 24px rgba(0,0,0,.14); padding: 12px 14px;
}
@media (prefers-color-scheme: dark) {
  .strip { background: #2b2b2e; color: #ececf1; border-color: #4a4a50; box-shadow: 0 6px 24px rgba(0,0,0,.5); }
  button.secondary { color: #ececf1; border-color: #5a5a60; }
}
p { margin: 0 0 10px; }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
button {
  font: inherit; cursor: pointer; border-radius: 999px; padding: 6px 14px;
  border: 1px solid transparent; background: #0f6e56; color: #fff;
}
button.secondary { background: transparent; color: #1f2328; border-color: #b6bcc4; }
button:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
`;

export class Strip {
  private host: HTMLElement | null = null;
  private onKey: ((e: KeyboardEvent) => void) | null = null;

  get visible(): boolean {
    return this.host !== null;
  }

  show(anchor: Element, actions: StripActions): void {
    this.hide();
    const host = document.createElement("div");
    host.setAttribute("data-kafiai", "strip");
    const root = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = CSS;

    const box = document.createElement("div");
    box.className = "strip";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "KafiAI");

    const message = document.createElement("p");
    message.textContent = "Bu mesaj, biraz önce yazdığına çok benziyor. İstersen önce düzenleyebilirsin.";

    const row = document.createElement("div");
    row.className = "row";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Düzenle";
    edit.addEventListener("click", () => {
      this.hide();
      actions.onEdit();
    });

    const anyway = document.createElement("button");
    anyway.type = "button";
    anyway.className = "secondary";
    anyway.textContent = "Yine de gönder";
    anyway.addEventListener("click", () => {
      this.hide();
      actions.onSendAnyway();
    });

    row.append(edit, anyway);
    box.append(message, row);
    root.append(style, box);

    const rect = anchor.getBoundingClientRect();
    const width = Math.max(rect.width, 280);
    box.style.left = `${Math.max(8, rect.left)}px`;
    box.style.width = `${width}px`;
    box.style.bottom = `${Math.max(8, window.innerHeight - rect.top + 8)}px`;

    document.body.appendChild(host);
    this.host = host;

    this.onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.hide();
        actions.onEdit();
      }
    };
    document.addEventListener("keydown", this.onKey, true);
    edit.focus();
  }

  hide(): void {
    if (this.onKey) document.removeEventListener("keydown", this.onKey, true);
    this.onKey = null;
    this.host?.remove();
    this.host = null;
  }
}
