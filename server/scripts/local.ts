// Elle deneme için yerel sunucu: Vercel fonksiyonunu (api/judge.ts) http://localhost:8787/api/judge adresinde çalıştırır.
// ANTHROPIC_API_KEY ortam değişkeninden okunur. Sohbet metni günlüğe yazılmaz, yalnızca durum ve süre.
// Çalıştırma: npm run local
import { createServer } from "node:http";
import { POST } from "../api/judge.ts";

const PORT = Number(process.env.PORT ?? 8787);

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/api/judge") {
    res.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const response = await POST(new Request(`http://localhost${req.url}`, { method: "POST", headers, body: Buffer.concat(chunks) }));
  res.writeHead(response.status, { "content-type": "application/json" }).end(await response.text());
}).listen(PORT, "127.0.0.1", () => {
  const key = process.env.ANTHROPIC_API_KEY ? "var" : "YOK (istekler başarısız olur)";
  console.log(`Kâfi yerel değerlendirici: http://localhost:${PORT}/api/judge  (API anahtarı: ${key})`);
});
