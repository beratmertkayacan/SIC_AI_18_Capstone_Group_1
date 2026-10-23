import { describe, expect, it, vi } from "vitest";
import { ResponseWatcher } from "./response-watcher";

function setup(quietMs = 600, startTimeoutMs = 15000) {
  let generating = false;
  const onComplete = vi.fn();
  const onNoSignal = vi.fn();
  const watcher = new ResponseWatcher(() => generating, { onComplete, onNoSignal }, quietMs, startTimeoutMs);
  return {
    watcher,
    onComplete,
    onNoSignal,
    setGenerating: (v: boolean) => {
      generating = v;
    },
  };
}

describe("ResponseWatcher", () => {
  it("begin() çağrılmadan hiçbir şey yapmaz", () => {
    const t = setup();
    t.setGenerating(true);
    t.watcher.tick(0);
    t.setGenerating(false);
    t.watcher.tick(5000);
    expect(t.onComplete).not.toHaveBeenCalled();
    expect(t.watcher.active).toBe(false);
  });

  it("üretim başlayıp bittikten ve sessizlik dolduktan sonra onComplete çağırır", () => {
    const t = setup();
    t.watcher.begin(0);
    t.setGenerating(true);
    t.watcher.tick(250);
    t.watcher.tick(500);
    t.setGenerating(false);
    t.watcher.tick(750);
    t.watcher.tick(1000);
    expect(t.onComplete).not.toHaveBeenCalled();
    t.watcher.tick(1400);
    expect(t.onComplete).toHaveBeenCalledTimes(1);
    expect(t.watcher.active).toBe(false);
  });

  it("kısa bir kesinti (sinyal geri gelirse) cevabı bitmiş saymaz", () => {
    const t = setup();
    t.watcher.begin(0);
    t.setGenerating(true);
    t.watcher.tick(250);
    t.setGenerating(false);
    t.watcher.tick(500);
    t.setGenerating(true);
    t.watcher.tick(700);
    t.setGenerating(false);
    t.watcher.tick(900);
    t.watcher.tick(1300);
    expect(t.onComplete).not.toHaveBeenCalled();
    t.watcher.tick(1600);
    expect(t.onComplete).toHaveBeenCalledTimes(1);
  });

  it("hiç üretim sinyali gelmezse zaman aşımında onNoSignal çağırır", () => {
    const t = setup();
    t.watcher.begin(0);
    t.watcher.tick(10000);
    expect(t.onNoSignal).not.toHaveBeenCalled();
    t.watcher.tick(15001);
    expect(t.onNoSignal).toHaveBeenCalledTimes(1);
    expect(t.onComplete).not.toHaveBeenCalled();
    expect(t.watcher.active).toBe(false);
  });

  it("cancel() izlemeyi bırakır", () => {
    const t = setup();
    t.watcher.begin(0);
    t.watcher.cancel();
    expect(t.watcher.active).toBe(false);
  });
});
