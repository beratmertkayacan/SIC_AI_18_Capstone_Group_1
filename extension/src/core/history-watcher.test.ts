import { describe, expect, it, vi } from "vitest";
import { HistoryWatcher, historySeed, historySignature } from "./history-watcher";

function setup(stableNeeded = 2, timeoutMs = 8000) {
  let texts: string[] = [];
  const onReady = vi.fn();
  const watcher = new HistoryWatcher(() => texts, onReady, stableNeeded, timeoutMs);
  return {
    watcher,
    onReady,
    set: (t: string[]) => {
      texts = t;
    },
  };
}

describe("HistoryWatcher", () => {
  it("begin() çağrılmadan hiçbir şey yapmaz", () => {
    const t = setup();
    t.set(["a", "b"]);
    t.watcher.tick(0);
    t.watcher.tick(250);
    t.watcher.tick(500);
    expect(t.onReady).not.toHaveBeenCalled();
  });

  it("mesaj sayısı iki ölçüm aynı kalınca okur", () => {
    const t = setup();
    t.watcher.begin(0);
    t.set(["a", "b"]);
    t.watcher.tick(250); // ilk görüş
    t.watcher.tick(500); // 1. kararlı
    expect(t.onReady).not.toHaveBeenCalled();
    t.watcher.tick(750); // 2. kararlı
    expect(t.onReady).toHaveBeenCalledWith(["a", "b"]);
    expect(t.watcher.active).toBe(false);
  });

  it("sayfa mesajları kademeli çiziyorsa sayı oturana kadar bekler", () => {
    const t = setup();
    t.watcher.begin(0);
    t.set(["a"]);
    t.watcher.tick(250);
    t.set(["a", "b"]);
    t.watcher.tick(500); // sayı değişti, sayaç sıfırlanır
    t.set(["a", "b", "c"]);
    t.watcher.tick(750);
    t.watcher.tick(1000);
    expect(t.onReady).not.toHaveBeenCalled();
    t.watcher.tick(1250);
    expect(t.onReady).toHaveBeenCalledTimes(1);
    expect(t.onReady).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it("hiç mesaj görünmezse zaman aşımında vazgeçer", () => {
    const t = setup();
    t.watcher.begin(0);
    t.watcher.tick(250);
    t.watcher.tick(8001);
    expect(t.watcher.active).toBe(false);
    expect(t.onReady).not.toHaveBeenCalled();
  });

  it("cancel() izlemeyi bırakır", () => {
    const t = setup();
    t.watcher.begin(0);
    t.set(["a"]);
    t.watcher.cancel();
    t.watcher.tick(250);
    t.watcher.tick(500);
    t.watcher.tick(750);
    expect(t.onReady).not.toHaveBeenCalled();
  });
});

describe("historySeed", () => {
  it("toplam bildirilmezse okunan sayı esas alınır", () => {
    expect(historySeed(["a", "b"], null)).toEqual({ turns: 2, hidden: 0, partial: false });
    expect(historySeed(["a", "b"], undefined)).toEqual({ turns: 2, hidden: 0, partial: false });
  });

  it("sanal listede okunamayan mesajlar gizli sayılır", () => {
    expect(historySeed(["son"], 9)).toEqual({ turns: 9, hidden: 8, partial: true });
  });

  it("bildirilen toplam okunandan azsa okunan sayı esas alınır", () => {
    expect(historySeed(["a", "b", "c"], 2)).toEqual({ turns: 3, hidden: 0, partial: false });
  });
});

describe("historySignature", () => {
  it("boş liste imzasızdır; aynı uç mesajlı aynı uzunlukta liste aynı imzayı verir", () => {
    expect(historySignature([])).toBeNull();
    expect(historySignature(["a", "b", "c"])).toBe(historySignature(["a", "x", "c"]));
    expect(historySignature(["a", "b"])).not.toBe(historySignature(["a", "b", "c"]));
  });
});
