import { chatgptAdapter } from "../adapters/chatgpt";
import { geminiAdapter } from "../adapters/gemini";
import type { Adapter } from "../adapters/types";
import { NAV_POLL_MS, POLL_MS } from "../config";
import { chromeStorage } from "../core/chrome-storage";
import { ExitCardPolicy } from "../core/exit-card-policy";
import { buildFreshStartDraft } from "../core/fresh-start";
import { HistoryWatcher } from "../core/history-watcher";
import { RepeatDetector } from "../core/repeat-detector";
import { sendCounters } from "../core/send-stats";
import { Session } from "../core/session";
import { taskType } from "../core/tasks";
import { turnFeatures } from "../core/turn-features";
import { MODEL_MIN_TURN, predict, type Prediction } from "../core/turn-model";
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

const ADAPTERS: Adapter[] = [chatgptAdapter, geminiAdapter];

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
  // Bu sohbetteki kullanıcı mesajları: yalnızca bellekte, tur modelinin öznitelikleri için.
  // Sohbet değişince ya da sayfa kapanınca silinir; hiçbir yere yazılmaz.
  let userTexts: string[] = [];
  let lastPrediction: Prediction | null = null;

  // Ayarlar yüklenene kadar (null) eklenti hiçbir şey yapmaz.
  let settings: Settings | null = null;
  const active = () => settings?.enabled === true;
  /** Öneri gösterme açık mı? Kapalıyken ("yalnızca say") hiçbir şey bekletilmez ya da gösterilmez. */
  const suggesting = () => active() && settings?.suggestionsEnabled === true;
  const count = (name: Parameters<SettingsStore["increment"]>[0]) => {
    void store.increment(name); // yalnızca sayı; hata verirse sessizce geçer
  };

  /** Cevap bitti: uzayan bir döngü varsa, kullanıcı yazmaya başlamadan çıkış kartını göster. */
  const maybeShowExitCard = () => {
    if (!settings?.exitCardEnabled) return;
    if (strip.visible || exitCard.visible || !policy.shouldShow(session.turns)) return;
    const composer = adapter.composer();
    if (!composer || !composer.empty) return; // kullanıcı zaten yazmaya başladı
    // Kart modelin yüksek risk tahmininden geliyorsa gerekçesi ve önerisi gösterilir.
    const reason = policy.modelTriggered(session.turns) ? (lastPrediction?.reasons[0] ?? null) : null;
    if (!suggesting()) {
      // Yalnızca say: kart gösterilecekti. Aynı bekleme kuralı işlesin diye kapatılmış gibi say.
      console.log(`[KafiAI] çıkış kartı gösterilecekti, sayıldı (tur ${session.turns}${reason ? ", model" : ""})`);
      count("exitCardWouldShow");
      if (reason) count("modelCardWouldShow");
      policy.dismissed(session.turns);
      return;
    }
    console.log(`[KafiAI] çıkış kartı gösterildi (tur ${session.turns}${reason ? `, model: ${reason.key}` : ""})`);
    count("exitCardShown");
    if (reason) count("modelCardShown");
    exitCard.show(composer.anchor, session.turns, policy.norm, {
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
      onNever: () => {
        console.log("[KafiAI] kullanıcı 'Bir daha gösterme' dedi");
        count("exitCardNever");
        void store.update({ exitCardEnabled: false });
      },
      onDismiss: (kind) => {
        policy.dismissed(session.turns);
        count(kind === "ara" ? "shortBreak" : kind === "kapat" ? "exitCardClosed" : "freshStart");
        console.log(`[KafiAI] çıkış kartı kapandı (${kind})`);
      },
      onNotRelevant: () => {
        console.log("[KafiAI] kullanıcı model önerisi için 'Yerinde değildi' dedi");
        count("modelNotRelevant");
      },
    }, reason);
  };

  /** Tur modeli: kullanıcının o ana kadarki mesajlarından döngü riski. Metin günlüğe yazılmaz. */
  const updatePrediction = (turns: number) => {
    if (userTexts.length < MODEL_MIN_TURN) return;
    lastPrediction = predict(turnFeatures(userTexts));
    policy.noteRisk(lastPrediction.level, turns);
    console.log(
      `[KafiAI] model: risk %${Math.round(lastPrediction.probability * 100)}, ${lastPrediction.level}, ` +
        `gerekçe ${lastPrediction.reasons.map((r) => r.key).join(", ")}`,
    );
  };
  const history = new HistoryWatcher(
    () => adapter.readHistory(),
    (texts) => {
      if (!active()) return;
      // Kullanıcı bu arada kendisi mesaj gönderdiyse karışmayalım.
      if (!session.seedTurns(texts.length)) return;
      // Geçmişteki mesajlar da canlı gönderim gibi işlenir: görev türü ilk mesajdan,
      // tekrar denemeleri sırayla karşılaştırarak (kalibrasyondaki simülasyonla aynı kural).
      if (texts[0] !== undefined) policy.setTask(taskType(texts[0]));
      for (const text of texts) {
        if (detector.check(text).soft) policy.noteRepeat();
        detector.remember(text);
      }
      userTexts = [...texts];
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
    if (first) console.log(`[KafiAI] öneriler: ${next.suggestionsEnabled ? "açık" : "kapalı (yalnızca say)"}`);
    if (!next.enabled || !next.suggestionsEnabled) {
      strip.hide();
      exitCard.hide();
    }
    if (!next.enabled) {
      history.cancel();
      skipNextCheck = false;
      if (wasActive) console.log("[KafiAI] eklenti kapatıldı");
      return;
    }
    if (!wasActive) {
      // Yeni açıldı (ya da sayfa yeni yüklendi): kapalıyken sayım yapılmadı, baştan başla.
      session.restart();
      detector.reset();
      policy.reset();
      userTexts = [];
      lastPrediction = null;
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
      if (!suggesting()) return false; // yalnızca say: mesaja dokunma
      const check = detector.check(text);
      if (!check.similar) return false;
      console.log(`[KafiAI] benzer mesaj, gönderim bekletildi (skor ${check.score.toFixed(2)})`);
      count("stripShown");
      exitCard.hide();
      strip.show(anchor, {
        onSendAnyway: () => {
          console.log("[KafiAI] kullanıcı 'Yine de gönder' dedi");
          count("stripSendAnyway");
          adapter.submitHeld();
        },
        onNotRelevant: () => {
          console.log("[KafiAI] kullanıcı 'Yerinde değildi' dedi");
          count("notRelevant");
          adapter.submitHeld();
        },
        onClose: () => {
          console.log("[KafiAI] kullanıcı düzenlemeye döndü");
          count("stripEdit");
          adapter.focusComposer();
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
      if (n === 1) policy.setTask(taskType(text));
      if (exitCard.visible) {
        exitCard.hide(); // kartı yok sayıp yazmaya devam etti
        policy.dismissed(n);
        count("exitCardClosed");
      }
      const check = detector.check(text);
      detector.remember(text);
      void store.incrementMany(sendCounters(check, suggesting()));
      // Çıkış kartı için tekrar denemesi: farklı kelimelerle yapılanlar da sayılır (yumuşak eşik).
      // Öneriler açık da kapalı da olsa aynı kural işler; böylece iki mod karşılaştırılabilir.
      if (check.soft) policy.noteRepeat();
      userTexts.push(text);
      updatePrediction(n);

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
      userTexts = [];
      lastPrediction = null;
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
