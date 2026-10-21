import { chatgptAdapter, findComposer } from "../adapters/chatgpt";
import type { Adapter } from "../adapters/types";
import { NAV_POLL_MS, POLL_MS } from "../config";
import { HistoryWatcher } from "../core/history-watcher";
import { RepeatDetector } from "../core/repeat-detector";
import { Session } from "../core/session";
import { Strip } from "../ui/strip";

const ADAPTERS: Adapter[] = [chatgptAdapter];

function main(): void {
  const url = new URL(location.href);
  const adapter = ADAPTERS.find((a) => a.matches(url));
  if (!adapter) return; // tanımadığımız sitede sessizce devre dışı

  const session = new Session(adapter.conversationKey(url));
  const detector = new RepeatDetector(); // yalnızca bellekte; sohbet değişince silinir
  const strip = new Strip();
  const history = new HistoryWatcher(
    () => adapter.readHistory(),
    (texts) => {
      // Kullanıcı bu arada kendisi mesaj gönderdiyse karışmayalım.
      if (!session.seedTurns(texts.length)) return;
      for (const text of texts) detector.remember(text);
      console.log(`[KafiAI] sohbet geçmişi okundu: ${texts.length} kullanıcı mesajı`);
    },
  );
  if (session.key !== null) history.begin(Date.now()); // sayfa var olan bir sohbette açıldı
  const historyTimer = window.setInterval(() => history.tick(Date.now()), POLL_MS);
  let skipNextCheck = false; // onarım cümlesi eklendiyse, bir sonraki gönderimde tekrar sorma

  // Mesaj metni hiçbir zaman günlüğe yazılmaz; yalnızca uzunluğu.
  const stop = adapter.start({
    onBeforeSend: ({ text, anchor }) => {
      if (skipNextCheck) {
        skipNextCheck = false;
        return false;
      }
      const check = detector.check(text);
      if (!check.similar) return false;
      console.log(`[KafiAI] benzer mesaj, gönderim bekletildi (skor ${check.score.toFixed(2)})`);
      strip.show(anchor, {
        onSendAnyway: () => {
          console.log("[KafiAI] kullanıcı 'Yine de gönder' dedi");
          adapter.submitHeld();
        },
        onClose: () => {
          console.log("[KafiAI] kullanıcı düzenlemeye döndü");
          findComposer()?.focus();
        },
        onRepair: (sentence) => {
          const ok = adapter.insertText(sentence);
          skipNextCheck = ok;
          console.log(`[KafiAI] onarım cümlesi eklendi: ${ok ? "evet" : "HAYIR (eklenemedi)"}`);
        },
      });
      return true;
    },
    onSend: ({ text }) => {
      history.cancel();
      strip.hide();
      const n = session.recordSend();
      const check = detector.check(text);
      detector.remember(text);
      const verdict = check.tooShort ? "kısa, bakılmadı" : check.similar ? "BENZER" : "farklı";
      console.log(
        `[KafiAI] mesaj gönderildi: ${text.length} karakter, oturumda ${n}. mesaj, ${verdict} (skor ${check.score.toFixed(2)})`,
      );
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
    if (result === "reset") {
      detector.reset();
      strip.hide();
      history.cancel();
      if (session.key !== null) history.begin(Date.now()); // başka bir var olan sohbet açıldı
    }
    console.log(`[KafiAI] sohbet adresi değişti: ${result} (${mask(previous)} → ${mask(location.href)})`);
  }, NAV_POLL_MS);

  window.addEventListener("pagehide", () => {
    stop();
    window.clearInterval(navTimer);
    window.clearInterval(historyTimer);
  });

  console.log(`[KafiAI] ${adapter.name} adaptörü hazır`);
}

main();
