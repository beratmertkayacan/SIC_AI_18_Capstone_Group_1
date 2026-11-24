import { build, context } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const watch = process.argv.includes("--watch");

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("public", "dist", { recursive: true });
// Montserrat (SIL OFL 1.1) yalnızca eklenti sayfaları için; ağdan değil pakete gömülü olarak gelir.
const FONT_DIR = "node_modules/@fontsource/montserrat/files";
mkdirSync("dist/fonts", { recursive: true });
for (const subset of ["latin", "latin-ext"]) {
  for (const weight of [400, 500, 600]) {
    const name = `montserrat-${subset}-${weight}-normal.woff2`;
    cpSync(`${FONT_DIR}/${name}`, `dist/fonts/${name}`);
  }
}
cpSync("node_modules/@fontsource/montserrat/LICENSE", "dist/fonts/OFL.txt");

// Anlam desteği sunucusu (K51 taslağı). Depodaki src/data/judge.json'da adres boştur; böylece normal derleme
// hiçbir istek göndermez ve ağ testi değişmez. KAFI_JUDGE_URL verilirse adres yalnızca bu derlemeye yazılır:
// paketlenmiş judge.json'a ve dist/manifest.json'daki connect-src ile host_permissions'a.
// Örnek (yerel deneme): KAFI_JUDGE_URL=http://localhost:8787/api/judge npm run build
const judgeUrl = process.env.KAFI_JUDGE_URL ?? "";
const plugins = [];
if (judgeUrl) {
  const origin = new URL(judgeUrl).origin;
  plugins.push({
    name: "kafi-judge-url",
    setup(b) {
      b.onLoad({ filter: /src[\\/]data[\\/]judge\.json$/ }, (args) => {
        const cfg = JSON.parse(readFileSync(args.path, "utf8"));
        return { contents: JSON.stringify({ ...cfg, endpoint: judgeUrl }), loader: "json" };
      });
    },
  });
  const manifest = JSON.parse(readFileSync("dist/manifest.json", "utf8"));
  manifest.content_security_policy.extension_pages = manifest.content_security_policy.extension_pages.replace(
    "connect-src 'none'",
    `connect-src ${origin}`,
  );
  manifest.host_permissions = [...manifest.host_permissions, `${origin}/*`];
  writeFileSync("dist/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Anlam desteği sunucusu bu derlemeye yazıldı: ${judgeUrl}`);
}

const options = {
  plugins,
  // Giriş listesi build-entries.json içinde; ağ testi de aynı listeyi okur.
  entryPoints: JSON.parse(readFileSync("build-entries.json", "utf8")).entries,
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome120",
  sourcemap: true,
  logLevel: "info",
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("İzleniyor... (Ctrl+C ile çık)");
} else {
  await build(options);
}
