import { afterEach, describe, expect, it, vi } from "vitest";
import { chromeStorage } from "./chrome-storage";
import { extensionAlive } from "./extension-context";

afterEach(() => vi.unstubAllGlobals());

describe("eklenti bağlamı koptuğunda", () => {
  it("chrome yoksa ya da runtime.id boşsa bağ kopmuş sayılır", () => {
    vi.stubGlobal("chrome", undefined);
    expect(extensionAlive()).toBe(false);
    vi.stubGlobal("chrome", { runtime: {} });
    expect(extensionAlive()).toBe(false);
    vi.stubGlobal("chrome", { runtime: { id: "abc" } });
    expect(extensionAlive()).toBe(true);
  });

  it("depolama hata fırlatmaz: okuma boş, yazma etkisiz", async () => {
    const set = vi.fn(() => {
      throw new Error("Extension context invalidated.");
    });
    vi.stubGlobal("chrome", { runtime: {}, storage: { local: { get: set, set, remove: set } } });
    await expect(chromeStorage.get(["x"])).resolves.toEqual({});
    await expect(chromeStorage.set({ x: 1 })).resolves.toBeUndefined();
    await expect(chromeStorage.remove(["x"])).resolves.toBeUndefined();
    expect(set).not.toHaveBeenCalled();
  });
});
