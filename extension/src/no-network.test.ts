import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import buildEntries from "../build-entries.json";
import platforms from "./data/platforms.json";
import manifest from "../public/manifest.json";
import judge from "./data/judge.json";

/**
 * Gizlilik sözünün denetimi: derlenmiş eklentide ağ isteği yapabilen hiçbir API geçmez.
 *
 * Manifestteki `connect-src 'none'` yalnızca eklenti sayfalarını (araç çubuğu penceresi) ve
 * arka plan çalışanını kapsar; içerik betiği ChatGPT ya da Gemini sayfasının içinde, o sayfanın
 * kurallarıyla çalışır. Bu yüzden içerik betiği için güvence tarayıcıdan değil, bu testten gelir:
 * build.mjs ile aynı ayarlarla derlenen dosyalarda (giriş listesi build-entries.json) aşağıdaki
 * adlardan hiçbiri bulunmamalı. Ayrıca derlenmiş kodda platform kaydındaki adresler dışında
 * hiçbir web adresi geçmemeli (uzaktan kod ya da veri yüklenmesine karşı).
 *
 * Tek istisna anlam desteği (K51 taslağı): kullanıcı izin verirse arka plan çalışanı sohbetin son
 * turlarını yalnızca src/data/judge.json'daki sunucu adresine gönderir. Bu yüzden arka plan derlemesinde
 * tam olarak bir fetch çağrısı olabilir; içerik betiği, pencere ve diğer sayfalarda hiçbiri olamaz.
 */
const FORBIDDEN = ["fetch", "XMLHttpRequest", "WebSocket", "sendBeacon", "EventSource", "importScripts"];

const ENTRIES = buildEntries.entries as Record<string, string>;
// SVG ad alanı bir web adresine benzer ama ağ isteği değildir: logo DOM API ile çizilirken gerekir.
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const JUDGE_URLS = judge.endpoint ? [judge.endpoint] : [];
const ALLOWED_URLS = new Set([...Object.values(platforms.platforms).flatMap((p) => p.matches), SVG_NAMESPACE, ...JUDGE_URLS]);

async function bundle(entry: string): Promise<string> {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    target: "chrome120",
    write: false,
    minify: false,
    logLevel: "silent",
  });
  return result.outputFiles.map((f) => f.text).join("\n");
}

describe("ağ isteği yok", () => {
  it.each(Object.entries(ENTRIES))("%s derlemesinde ağ API'si geçmiyor (arka planda yalnızca tek fetch)", async (name, entry) => {
    const code = await bundle(entry);
    for (const word of FORBIDDEN) {
      const count = (code.match(new RegExp(`\\b${word}\\b`, "g")) ?? []).length;
      const allowed = name === "background" && word === "fetch" ? 1 : 0;
      expect(count, `${entry}: ${word}`).toBe(allowed);
    }
  });

  it.each(Object.entries(ENTRIES))("%s derlemesinde izinli platform adresleri dışında web adresi yok", async (_name, entry) => {
    const code = await bundle(entry);
    const urls = code.match(/https?:\/\/[^\s"'`)]+/g) ?? [];
    for (const u of urls) expect(ALLOWED_URLS.has(u), `${entry}: ${u}`).toBe(true);
    expect(/\beval\s*\(|new Function\s*\(/.test(code), `${entry}: eval`).toBe(false);
  });

  it("giriş listesi boş değil ve üç temel giriş yerinde", () => {
    expect(Object.keys(ENTRIES)).toEqual(expect.arrayContaining(["content", "background", "popup"]));
  });

  it("connect-src yalnızca anlam desteği sunucusuna izin veriyor (adres yoksa 'none')", () => {
    const csp = manifest.content_security_policy.extension_pages;
    if (!judge.endpoint) {
      expect(csp).toContain("connect-src 'none'");
    } else {
      const origin = new URL(judge.endpoint).origin;
      expect(csp).toContain(`connect-src ${origin};`);
      expect(manifest.host_permissions).toContain(`${origin}/*`);
    }
  });

  it("manifest yalnızca depolama ve pano izni istiyor", () => {
    expect([...manifest.permissions].sort()).toEqual(["clipboardWrite", "storage"]);
  });
});
