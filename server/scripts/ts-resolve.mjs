// Yalnızca yerel çalıştırma için: "../lib/judge.js" gibi içe aktarmalarda .js dosyası yoksa aynı adlı .ts
// dosyasını kullanır. Kaynaktaki .js yazımı Vercel ve TypeScript'in beklediği standart biçimdir.
import { existsSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL) {
    const ts = new URL(specifier.replace(/\.js$/, ".ts"), context.parentURL);
    const js = new URL(specifier, context.parentURL);
    if (!existsSync(fileURLToPath(js)) && existsSync(fileURLToPath(ts))) return next(ts.href, context);
  }
  return next(specifier, context);
}

if (!globalThis.__kafiTsResolve) {
  globalThis.__kafiTsResolve = true;
  register(import.meta.url);
}
