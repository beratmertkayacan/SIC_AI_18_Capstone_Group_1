// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { Ring } from "./ring";

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
    expect(wrapOf().querySelector("button")!.getAttribute("aria-label")).toContain("Kâfi:");
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

  it("gizlenince sayfadan kalkar ve seviye sıfırlanır", () => {
    ring.update(anchor, 2, "x");
    ring.hide();
    expect(hostOf()).toBeNull();
    expect(ring.currentLevel).toBe(0);
  });
});
