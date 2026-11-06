import { build, context } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";

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

const options = {
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
