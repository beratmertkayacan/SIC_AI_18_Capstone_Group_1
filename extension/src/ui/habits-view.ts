import { BRAND_NAME } from "../brand";
import type { HabitRow, HabitSummary, Tip } from "../popup/habits-text";
import { el } from "./page-kit";

/**
 * "Bu hafta" özetinin satırları (pencere ve haftalık sayfa aynı yapıyı çizer). Kutu yok: her grup
 * bir öncekinden 1px çizgiyle ayrılır; sayılar yalnızca "takılınca nasıl bitti" satırlarında sağda durur.
 */
export function habitRows(h: HabitSummary, opts: { compact?: boolean } = {}): HTMLElement[] {
  const out: HTMLElement[] = [el("p", "hab-total", h.total)];
  if (h.note) out.push(el("p", "hab-note", h.note));
  // Dar pencerede (360x600) yer kazanmak için: hamleler ve şeffaflık satırı etiketsiz tek blokta.
  if (opts.compact) {
    if (h.loops) {
      const g = el("div", "hab-group");
      // Döngü cümlesi bir başlık değil, bir cümle: görünüşü aynı kalır, anlamı paragraf.
      const lead = el("p", "hab-label");
      lead.append(el("strong", undefined, h.loops.intro));
      g.append(lead);
      if (h.loops.rows.length > 0) g.append(loopList(h.loops.rows));
      out.push(g);
    }
    const lines = [h.moves, h.kafi].filter((x): x is string => x !== null);
    if (lines.length > 0) {
      const g = el("div", "hab-group");
      for (const line of lines) g.append(el("p", "hab-line", line));
      out.push(g);
    }
    if (h.previous) out.push(el("p", "hab-group hab-line hab-quiet", h.previous));
    return out;
  }
  if (h.loops) {
    const g = el("div", "hab-group");
    g.append(el("h3", "hab-label", "Takılınca nasıl bitti"), el("p", "hab-line", h.loops.intro));
    if (h.loops.rows.length > 0) g.append(loopList(h.loops.rows));
    out.push(g);
  }
  if (h.moves) {
    const g = el("div", "hab-group");
    g.append(el("h3", "hab-label", "Senin hamlelerin"), el("p", "hab-line", h.moves));
    out.push(g);
  }
  if (h.kafi) {
    const g = el("div", "hab-group");
    g.append(el("h3", "hab-label", `${BRAND_NAME} ne yaptı`), el("p", "hab-line", h.kafi));
    out.push(g);
  }
  if (h.previous) {
    const g = el("div", "hab-group");
    g.append(el("p", "hab-line hab-quiet", h.previous));
    out.push(g);
  }
  return out;
}

/** "Takılınca nasıl bitti" satırları: solda ne oldu, sağda sayı; nötr satır soluk. */
function loopList(rows: HabitRow[]): HTMLElement {
  const list = el("ul", "hab-rows");
  for (const row of rows) {
    const li = el("li", row.quiet ? "quiet" : undefined);
    li.append(el("span", "hab-row-label", row.label), el("span", "hab-row-num", String(row.n)));
    list.append(li);
  }
  return list;
}

/** Öneri satırının düğmeleri; pencere ve haftalık sayfa aynı düğmeleri ve aynı sayaçları kullanır. */
export interface TipHandlers {
  /** Yalnızca pencerede: "Ayarlar'a git" (kart_kapat önerisi). */
  openSettings?: () => void;
  notHelpful: () => void;
  close: () => void;
}

export function tipRow(tip: Tip, handlers: TipHandlers): HTMLElement {
  const box = el("div", "hab-group hab-tip");
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", "Haftanın önerisi");
  box.append(el("p", "hab-tip-text", tip.text));
  const actions = el("div", "hab-tip-actions");
  if (tip.settingsLink && handlers.openSettings) {
    const go = el("button", "link strong", "Ayarlar'a git");
    go.type = "button";
    go.addEventListener("click", handlers.openSettings);
    actions.append(go);
  }
  const no = el("button", "link", "Yerinde değildi");
  no.type = "button";
  no.setAttribute("aria-label", "Yerinde değildi: bu öneriyi 4 hafta gösterme");
  no.addEventListener("click", handlers.notHelpful);
  const close = el("button", "link", "Kapat");
  close.type = "button";
  close.setAttribute("aria-label", "Öneriyi bu hafta için kapat");
  close.addEventListener("click", handlers.close);
  actions.append(no, close);
  box.append(actions);
  return box;
}
