// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { ConstraintNote } from "./constraint-note";

describe("ConstraintNote", () => {
  it("notu cevap öğesinin hemen arkasına ekler ve kaldırır", () => {
    const answer = document.createElement("div");
    document.body.append(answer);
    const note = new ConstraintNote();
    expect(note.show(answer, "deneme")).toBe(true);
    const host = answer.nextElementSibling as HTMLElement;
    expect(host.getAttribute("data-kafiai")).toBe("kisit-notu");
    expect(host.shadowRoot?.querySelector("[role=note]")?.textContent).toBe("deneme");
    expect(host.shadowRoot?.querySelector("button")).toBeNull(); // düğme yok, bir şey göndermez
    note.hideAll();
    expect(document.querySelector("[data-kafiai=kisit-notu]")).toBeNull();
  });

  it("cevap öğesi yoksa ya da sayfada değilse not eklemez", () => {
    const note = new ConstraintNote();
    expect(note.show(null, "x")).toBe(false);
    expect(note.show(document.createElement("div"), "x")).toBe(false);
  });
});
