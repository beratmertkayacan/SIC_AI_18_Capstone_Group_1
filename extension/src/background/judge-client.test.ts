import { afterEach, describe, expect, it, vi } from "vitest";
import { JUDGE } from "../core/judge";
import { handleJudge, JUDGE_MESSAGE, type JudgeDeps } from "./judge-client";

const req = { type: JUDGE_MESSAGE, turlar: [{ rol: "k" as const, metin: "merhaba" }] };
const deps = (o: Partial<JudgeDeps> = {}): JudgeDeps => ({
  readSettings: async () => ({ semanticEnabled: true }),
  post: async () => ({ status: 200, json: async () => ({ sonuc: { dongu: false, guven: 0.1 } }) }),
  now: () => 0,
  ...o,
});

afterEach(() => {
  JUDGE.endpoint = "";
  vi.useRealTimers();
});

describe("handleJudge", () => {
  it("adres yapılandırılmadıysa hiç istek göndermez", async () => {
    const post = vi.fn();
    expect(await handleJudge(req, deps({ post }))).toMatchObject({ ok: false, hata: "adres_yok" });
    expect(post).not.toHaveBeenCalled();
  });
  it("izin kapalıyken hiç istek göndermez", async () => {
    JUDGE.endpoint = "https://ornek.invalid/api/judge";
    const post = vi.fn();
    expect(await handleJudge(req, deps({ post, readSettings: async () => ({}) }))).toMatchObject({ hata: "izin_yok" });
    expect(post).not.toHaveBeenCalled();
  });
  it("izin açıkken yalnızca turları gönderir ve cevabı döner", async () => {
    JUDGE.endpoint = "https://ornek.invalid/api/judge";
    const post = vi.fn(deps().post);
    const r = await handleJudge(req, deps({ post }));
    expect(r.ok).toBe(true);
    expect(JSON.parse(post.mock.calls[0]![1])).toEqual({ turlar: req.turlar });
  });
  it("hata durumunu ve zaman aşımını ayırır", async () => {
    JUDGE.endpoint = "https://ornek.invalid/api/judge";
    expect(await handleJudge(req, deps({ post: async () => ({ status: 429, json: async () => ({}) }) }))).toMatchObject({ hata: "durum_429" });
    vi.useFakeTimers();
    const hang: JudgeDeps["post"] = (_u, _b, _h, signal) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("abort"))));
    const p = handleJudge(req, deps({ post: hang }));
    await vi.advanceTimersByTimeAsync(JUDGE.timeout_ms + 1);
    expect(await p).toMatchObject({ ok: false, hata: "zaman_asimi" });
  });
});
