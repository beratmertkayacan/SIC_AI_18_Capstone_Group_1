// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { Ring, RING_CSS } from "./ring";

const hostOf = () => document.querySelector<HTMLElement>('[data-kafiai="ring"]');
const wrapOf = () => hostOf()!.shadowRoot!.querySelector<HTMLElement>(".wrap")!;

describe("halka görünümü", () => {
  const ring = new Ring();
  const anchor = document.createElement("div");
  document.body.append(anchor);
  afterEach(() => ring.hide());

  it("seviyeyi, metni ve erişilebilir adı yazar; yükselince true döner", () => {
    expect(ring.update(anchor, 0, "Şu an dikkat çeken bir şey yok.")).toBe(false);
    expect(wrapOf().dataset.level).toBe("0");
    expect(ring.update(anchor, 2, "Son mesajlarından 2 tanesi öncekilere çok benziyor.")).toBe(true);
    expect(wrapOf().dataset.level).toBe("2");
    expect(wrapOf().querySelector(".tip")!.textContent).toContain("2 tanesi");
    expect(wrapOf().querySelector("button")!.getAttribute("aria-label")).toContain("Kâfi AI:");
    expect(ring.update(anchor, 1, "x")).toBe(false);
  });

  it("açıklama, halka sakin değilken ve ilk üzerine gelişte bir kez bildirilir", () => {
    const onExplain = vi.fn();
    ring.update(anchor, 0, "sakin", onExplain);
    wrapOf().dispatchEvent(new Event("mouseenter"));
    expect(onExplain).not.toHaveBeenCalled();
    ring.update(anchor, 1, "belirgin", onExplain);
    wrapOf().dispatchEvent(new Event("mouseenter"));
    wrapOf().dispatchEvent(new Event("mouseenter"));
    expect(onExplain).toHaveBeenCalledOnce();
  });

  it("ipucu açıkken Esc ile kapanır; fare çıkınca yeniden açılabilir, kapalıyken Esc bir şey yapmaz", () => {
    ring.update(anchor, 1, "belirgin");
    const esc = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    esc();
    expect(wrapOf().classList.contains("tip-off")).toBe(false);
    wrapOf().dispatchEvent(new Event("mouseenter"));
    esc();
    expect(wrapOf().classList.contains("tip-off")).toBe(true);
    wrapOf().dispatchEvent(new Event("mouseleave"));
    expect(wrapOf().classList.contains("tip-off")).toBe(false);
    const button = wrapOf().querySelector("button")!;
    button.dispatchEvent(new Event("focus"));
    esc();
    expect(wrapOf().classList.contains("tip-off")).toBe(true);
    button.dispatchEvent(new Event("blur"));
    expect(wrapOf().classList.contains("tip-off")).toBe(false);
    expect(RING_CSS).toContain(".wrap.tip-off .tip { opacity: 0;");
  });

  it("seviyeler belirginlik sırasını korur ve seviye 0 bile seçilebilir kalır", () => {
    const op = (level: number) => Number(RING_CSS.match(new RegExp(`\\.wrap\\[data-level="${level}"\\] path \\{ opacity: ([.\\d]+); \\}`))![1]);
    expect(op(0)).toBeGreaterThanOrEqual(0.6);
    expect(op(0)).toBeLessThan(op(1));
    expect(op(1)).toBeLessThan(op(2));
    expect(RING_CSS).toContain('.wrap[data-level="2"] button.ring { background: var(--halo); }');
  });

  it("gizlenince sayfadan kalkar ve seviye sıfırlanır", () => {
    ring.update(anchor, 2, "x");
    ring.hide();
    expect(hostOf()).toBeNull();
    expect(ring.currentLevel).toBe(0);
  });
});
