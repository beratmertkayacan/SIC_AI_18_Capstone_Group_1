import Anthropic from "@anthropic-ai/sdk";
import { kararDuzelt, sohbetMetni, SPEC, turlariAl, type Karar } from "../lib/judge.js";

/**
 * Kâfi anlam desteği: eklentinin arka plan çalışanı sohbetin son turlarını buraya gönderir, biz de
 * Claude Haiku'ya sorup yapılandırılmış bir karar döneriz.
 *
 * Gizlilik: sohbet metni hiçbir yere yazılmaz, günlüğe yalnızca süre ve durum düşer. API anahtarı
 * yalnızca bu sunucunun ortam değişkenindedir (ANTHROPIC_API_KEY), eklentiye hiç gitmez.
 * KAFI_TOKEN eklentinin gönderdiği paylaşılan belirteçtir; gizli değildir (eklenti paketinde durur),
 * yalnızca rastgele taramaları ve kazara kullanımı eler. Asıl koruma oran sınırı ve boyut sınırıdır.
 */

const client = new Anthropic();
const MAX_BODY = 24_000; // bayt; 12 tur × en fazla 1.000 karakter ve biraz pay

// Sunucusuz ortamda bellek örnekler arasında paylaşılmaz; bu sınır en iyi çaba, kaba kötüye kullanıma karşı.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { start: number; n: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.start > WINDOW_MS) {
    hits.set(ip, { start: now, n: 1 });
    return false;
  }
  h.n += 1;
  return h.n > MAX_PER_WINDOW;
}

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export async function POST(request: Request): Promise<Response> {
  const t0 = Date.now();
  const done = (status: number, data: unknown) => {
    console.log(`judge ${status} ${Date.now() - t0}ms`); // metin yok, yalnızca durum ve süre
    return json(status, data);
  };

  const token = process.env.KAFI_TOKEN;
  if (token && request.headers.get("x-kafi-token") !== token) return done(401, { hata: "belirtec" });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (limited(ip)) return done(429, { hata: "oran" });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return done(413, { hata: "boyut" });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return done(400, { hata: "json" });
  }
  const turlar = turlariAl(body);
  if (!turlar) return done(400, { hata: "gecersiz" });

  try {
    const response = await client.messages.create({
      model: SPEC.model,
      max_tokens: SPEC.max_tokens,
      // Düşünme açıkken düşünme tokenları da çıktı sınırından düşer; ayar judge-spec.json'da ölçülerek seçilir.
      ...(SPEC.dusunme === "kapali" ? { thinking: { type: "disabled" as const } } : {}),
      output_config: { effort: SPEC.effort as "low", format: { type: "json_schema", schema: SPEC.sema } },
      // Sistem istemi her istekte aynı; önbellekten okunursa giriş maliyeti ve gecikme düşer.
      system: [{ type: "text", text: SPEC.sistem, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: sohbetMetni(turlar) }],
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      return done(200, { sonuc: null, neden: response.stop_reason, surum: SPEC.surum });
    }
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return done(502, { hata: "bos" });
    const karar = kararDuzelt(JSON.parse(text.text) as Karar);
    return done(200, { sonuc: karar, surum: SPEC.surum, ms: Date.now() - t0 });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return done(429, { hata: "model_oran" });
    if (error instanceof Anthropic.APIError) return done(502, { hata: `model_${error.status ?? "?"}` });
    if (error instanceof SyntaxError) return done(502, { hata: "model_json" });
    return done(500, { hata: "sunucu" });
  }
}
