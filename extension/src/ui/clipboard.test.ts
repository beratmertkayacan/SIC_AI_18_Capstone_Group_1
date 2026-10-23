// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "./clipboard";

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

describe("copyToClipboard", () => {
  afterEach(() => {
    setClipboard(undefined);
    delete (document as unknown as { execCommand?: unknown }).execCommand;
  });

  it("modern API ile kopyalar", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    expect(await copyToClipboard("merhaba")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("merhaba");
  });

  it("modern API reddedilirse yedek yöntemi dener", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("izin yok")) });
    const exec = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof exec }).execCommand = exec;
    expect(await copyToClipboard("merhaba")).toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull(); // geçici alan temizlendi
  });

  it("ikisi de olmazsa false döner", async () => {
    setClipboard(undefined);
    expect(await copyToClipboard("merhaba")).toBe(false);
  });
});
