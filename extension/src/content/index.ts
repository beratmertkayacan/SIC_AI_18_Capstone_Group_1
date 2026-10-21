import { chatgptAdapter, findComposer, readComposerText } from "../adapters/chatgpt";
import type { Adapter } from "../adapters/types";
import { NAV_POLL_MS, POLL_MS } from "../config";
import { chromeStorage } from "../core/chrome-storage";
import { ExitCardPolicy } from "../core/exit-card-policy";
import { buildFreshStartDraft } from "../core/fresh-start";
import { HistoryWatcher } from "../core/history-watcher";
import { RepeatDetector } from "../core/repeat-detector";
import { Session } from "../core/session";
import {
  DEFAULT_SETTINGS,
  parseSettings,
  SETTINGS_KEY,
  SettingsStore,
  type Settings,
} from "../core/settings";
import { copyToClipboard } from "../ui/clipboard";
import { ExitCard } from "../ui/exit-card";
import { Strip } from "../ui/strip";

const ADAPTERS: Adapter[] = [chatgptAdapter];

function main(): void {
  const url = new URL(location.href);
  const adapter = ADAPTERS.find((a) => a.matches(url));
  if (!adapter) return; // tanımadığımız sitede sessizce devre dışı

  const session = new Session(adapter.conversationKey(url));
  const detector = new RepeatDetector(); // yalnızca bellekte; sohbet değişince silinir
  const strip = new Strip();
  const exitCard = new ExitCard();
  const policy = new ExitCardPolicy();
  const store = new SettingsStore(chromeStorage);

  // Ayarlar yüklenene kadar (null) eklenti hiçbir şey yapmaz.
  let settings: Settings | null = null;
  const active = () => settings?.enabled === true;
  const count = (name: Parameters<SettingsStore["increment"]>[0]) => {
    void store.increment(name); // yalnızca sayı; hata verirse sessizce geçer
  };

  /** Cevap bitti: uzayan bir döngü varsa, kullanıcı yazmaya başlamadan çıkış kartını göster. */
  const maybeShowExitCard = () => {
    if (!settings?.exitCardEnabled) return;
    if (strip.visible || exitCard.visible || !policy.shouldShow(session.turns)) return;
    const composer = findComposer();
    if (!composer || readComposerText(composer) !== "") return; // kullanıcı zaten yazmaya başladı
    console.log(`[KafiAI] çıkış kartı gösterildi (tur ${session.turns})`);
    count("exitCardShown");
    exitCard.show(composer.closest("form") ?? composer, session.turns, {
      getDraft: () => buildFreshStartDraft(adapter.readHistory()),
      onFreshStart: async (draft) => {
        const copied = await copyToClipboard(draft);
        if (copied) {
          window.open(adapter.newChatUrl(), "_blank", "noopener");
          count("freshStart");
        }
        console.log(`[KafiAI] taze başlat: ${copied ? "panoya kopyalandı, yeni sohbet açıldı" : "kopyalanamadı"}`);
        return copied;
      },
      onDismiss: (kind) => {
        policy.dismissed(session.turns);
        count(kind === "ara" ? "shortBreak" : kind === "kapat" ? "exitCardClosed" : "freshStart");
        console.log(`[KafiAI] çıkış kartı kapandı (${kind})`);
      },
    });
  };
  const history = new HistoryWatcher(
    () => adapter.readHistory(),
    (texts) => {
      if (!active()) return;
      // Kullanıcı bu arada kendisi mesaj gönderdiyse karışmayalım.
      if (!session.seedTurns(texts.length)) return;
      for (const text of texts) detector.remember(text);
      console.log(`[KafiAI] sohbet geçmişi okundu: ${texts.length} kullanıcı mesajı`);
    },
  );
  const historyTimer = window.setInterval(() => history.tick(Date.now()), POLL_MS);
  let skipNextCheck = false; // onarım cümlesi eklendiyse, bir sonraki gönderimde tekrar sorma

  /** Ayarlar ilk kez yüklendi ya da değişti. */
  const applySettings = (next: Settings) => {
    const wasActive = active();
    const first = settings === null;
    settings = next;
    if (first) console.log(`[KafiAI] ayarlar: ${next.enabled ? "açık" : "kapalı"}, çıkış kartı ${next.exitCardEnabled ? "açık" : "kapalı"}`);
    if (!next.enabled) {
      strip.hide();
      exitCard.hide();
      history.cancel();
      skipNextCheck = false;
      if (wasActive) console.log("[KafiAI] eklenti kapatıldı");
      return;
    }
    if (!next.exitCardEnabled) exitCard.hide();
    if (!wasActive) {
      // Yeni açıldı (ya da sayfa yeni yüklendi): kapalıyken sayım yapılmadı, baştan başla.
      session.restart();
      detector.reset();
      policy.reset();
      if (session.key !== null) history.begin(Date.now());
      if (!first) console.log("[KafiAI] eklenti açıldı");
    }
  };
  store
    .load()
    .then(applySettings)
    .catch(() => applySettings(DEFAULT_SETTINGS));
  chrome.storage.onChanged.addListener((changes, area) => {
    const change = changes[SETTINGS_KEY];
    if (area === "local" && change) applySettings(parseSettings(change.newValue));
  });

  // Mesaj metni hiçbir zaman günlüğe yazılmaz; yalnızca uzunluğu.
  const stop = adapter.start({
    onBeforeSend: ({ text, anchor }) => {
      if (!active()) return false;
      if (skipNextCheck) {
        skipNextCheck = false;
        return false;
      }
      const check = detector.check(text);
      if (!check.similar) return false;
      console.log(`[KafiAI] benzer mesaj, gönderim bekletildi (skor ${check.score.toFixed(2)})`);
      count("stripShown");
      policy.noteRepeat();
      exitCard.hide();
      strip.show(anchor, {
        onSendAnyway: () => {
          console.log("[KafiAI] kullanıcı 'Yine de gönder' dedi");
          count("stripSendAnyway");
          adapter.submitHeld();
        },
        onClose: () => {
          console.log("[KafiAI] kullanıcı düzenlemeye döndü");
          count("stripEdit");
          findComposer()?.focus();
        },
        onRepair: (sentence) => {
          const ok = adapter.insertText(sentence);
          skipNextCheck = ok;
          if (ok) count("stripRepair");
          console.log(`[KafiAI] onarım cümlesi eklendi: ${ok ? "evet" : "HAYIR (eklenemedi)"}`);
        },
      });
      return true;
    },
    onSend: ({ text }) => {
      if (!active()) return;
      history.cancel();
      strip.hide();
      const n = session.recordSend();
      if (exitCard.visible) {
        exitCard.hide(); // kartı yok sayıp yazmaya devam etti
        policy.dismissed(n);
        count("exitCardClosed");
      }
      const check = detector.check(text);
      detector.remember(text);
      const verdict = check.tooShort ? "kısa, bakılmadı" : check.similar ? "BENZER" : "farklı";
      console.log(
        `[KafiAI] mesaj gönderildi: ${text.length} karakter, oturumda ${n}. mesaj, ${verdict} (skor ${check.score.toFixed(2)})`,
      );
    },
    onResponseComplete: () => {
      if (!active()) return;
      console.log("[KafiAI] cevap bitti");
      maybeShowExitCard();
    },
    onNoSignal: () => {
      if (!active()) return;
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
      exitCard.hide();
      policy.reset();
      history.cancel();
      if (active() && session.key !== null) history.begin(Date.now()); // başka bir var olan sohbet açıldı
    }
    if (active()) {
      console.log(`[KafiAI] sohbet adresi değişti: ${result} (${mask(previous)} → ${mask(location.href)})`);
    }
  }, NAV_POLL_MS);

  window.addEventListener("pagehide", () => {
    stop();
    window.clearInterval(navTimer);
    window.clearInterval(historyTimer);
  });

  console.log(`[KafiAI] ${adapter.name} adaptörü hazır`);
}

main();
