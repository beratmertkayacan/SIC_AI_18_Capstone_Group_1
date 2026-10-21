import { chatgptAdapter } from "../adapters/chatgpt";
import type { Adapter } from "../adapters/types";
import { NAV_POLL_MS } from "../config";
import { Session } from "../core/session";

const ADAPTERS: Adapter[] = [chatgptAdapter];

function main(): void {
  const url = new URL(location.href);
  const adapter = ADAPTERS.find((a) => a.matches(url));
  if (!adapter) return; // tanımadığımız sitede sessizce devre dışı

  const session = new Session(adapter.conversationKey(url));

  // Mesaj metni hiçbir zaman günlüğe yazılmaz; yalnızca uzunluğu.
  const stop = adapter.start({
    onSend: ({ text }) => {
      const n = session.recordSend();
      console.log(`[KafiAI] mesaj gönderildi: ${text.length} karakter, oturumda ${n}. mesaj`);
    },
    onResponseComplete: () => {
      console.log("[KafiAI] cevap bitti");
    },
    onNoSignal: () => {
      console.log("[KafiAI] cevap sinyali görülmedi (sayfa yapısı değişmiş olabilir)");
    },
  });

  // Tek sayfalık uygulama: adres değişince sohbetin değişip değişmediğine bak.
  // Günlükte kimlikler maskelenir (ilk 4 karakter): "/c/68f8…"
  const mask = (href: string) =>
    new URL(href).pathname.replace(/[A-Za-z0-9-]{8,}/g, (m) => m.slice(0, 4) + "…");

  let lastHref = location.href;
  const navTimer = window.setInterval(() => {
    if (location.href === lastHref) return;
    const previous = lastHref;
    lastHref = location.href;
    const result = session.onNavigate(adapter.conversationKey(new URL(location.href)));
    console.log(`[KafiAI] sohbet adresi değişti: ${result} (${mask(previous)} → ${mask(location.href)})`);
  }, NAV_POLL_MS);

  window.addEventListener("pagehide", () => {
    stop();
    window.clearInterval(navTimer);
  });

  console.log(`[KafiAI] ${adapter.name} adaptörü hazır`);
}

main();
