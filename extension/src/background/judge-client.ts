import { JUDGE, JUDGE_MESSAGE, type JudgeReply, type JudgeRequest } from "../core/judge";

export { JUDGE_MESSAGE, type JudgeReply, type JudgeRequest };
import { parseSettings, SETTINGS_KEY } from "../core/settings";

/**
 * Anlam desteğinin tek ağ noktası (K51 taslağı). İçerik betiği sohbetin son turlarını mesajla buraya
 * yollar; biz Kâfi sunucusuna (src/data/judge.json, endpoint) gönderip cevabı geri veririz.
 *
 * Neden arka planda: içerik betiği sohbet sitesinin sayfasında, o sitenin kurallarıyla çalışır; ağ
 * isteğini orada yapmak siteye görünür olurdu ve ağ testi içerik betiğinde fetch geçmemesini şart koşar.
 * İzin burada da kontrol edilir: içerik betiğinde bir hata olsa bile izin kapalıyken istek gitmez.
 * Hiçbir metin saklanmaz ya da günlüğe yazılmaz.
 */

export interface JudgeDeps {
  readSettings(): Promise<unknown>;
  post(url: string, body: string, headers: Record<string, string>, signal: AbortSignal): Promise<{ status: number; json(): Promise<unknown> }>;
  now(): number;
}

export async function handleJudge(req: JudgeRequest, deps: JudgeDeps): Promise<JudgeReply> {
  const t0 = deps.now();
  const reply = (r: { ok: true; data: unknown } | { ok: false; hata: string }): JudgeReply => ({ ...r, ms: deps.now() - t0 });
  if (!JUDGE.endpoint) return reply({ ok: false, hata: "adres_yok" });
  if (!parseSettings(await deps.readSettings()).semanticEnabled) return reply({ ok: false, hata: "izin_yok" });
  if (!Array.isArray(req.turlar) || req.turlar.length === 0) return reply({ ok: false, hata: "bos" });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JUDGE.timeout_ms);
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (JUDGE.token) headers["x-kafi-token"] = JUDGE.token;
    const res = await deps.post(JUDGE.endpoint, JSON.stringify({ turlar: req.turlar }), headers, controller.signal);
    if (res.status !== 200) return reply({ ok: false, hata: `durum_${res.status}` });
    return reply({ ok: true, data: await res.json() });
  } catch {
    return reply({ ok: false, hata: controller.signal.aborted ? "zaman_asimi" : "ag" });
  } finally {
    clearTimeout(timer);
  }
}

/** Gerçek bağımlılıklar: chrome.storage ve fetch. Testler handleJudge'ı sahteleriyle çağırır. */
export const chromeJudgeDeps: JudgeDeps = {
  readSettings: async () => (await chrome.storage.local.get([SETTINGS_KEY]))[SETTINGS_KEY],
  post: (url, body, headers, signal) => fetch(url, { method: "POST", body, headers, signal, credentials: "omit" }),
  now: () => Date.now(),
};
