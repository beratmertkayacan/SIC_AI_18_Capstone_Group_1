import { BRAND_NAME } from "../brand";
import config from "../data/insights-config.json";
import { CounterStore } from "../core/counters";
import type { ConversationSnapshot } from "../core/messages";
import { SettingsStore, type Settings } from "../core/settings";
import { percent, weekReport, weekStart } from "../core/week-report";
import { copyToClipboard } from "../ui/clipboard";
import { brandLockup, el, privacyChip, switchRow } from "../ui/page-kit";
import { numberWas, weekLabel } from "../weekly/weekly-text";
import { conversationLines, taskLabel } from "./insight-text";

/** Açık sekmedeki sohbetle konuşmak için (testte sahtesi verilir). */
export interface TabBridge {
  /** Sekmedeki sohbetin özeti; desteklenmeyen sekmede null. */
  snapshot(): Promise<ConversationSnapshot | null>;
  /** Sekmede "yeni sohbete geç" kartını açar. */
  openCard(): Promise<boolean>;
}

export const NO_TAB: TabBridge = { snapshot: async () => null, openCard: async () => false };

/** Eklentinin kendi sayfasını yeni sekmede açar (haftalık özet, karşılama ekranı). */
export type OpenPage = (path: string) => void;

/** Ayarlar satırının alt yazısında açık olanların kısa adları (cümle içinde, küçük harfle). */
const SUMMARY_NAMES: [keyof Settings, string][] = [
  ["suggestionsEnabled", "öneriler"],
  ["ringEnabled", "halka"],
  ["exitCardEnabled", "yeni sohbet önerisi"],
];

/** Ayarlar satırının alt yazısı: "Açık: öneriler, halka, yeni sohbet önerisi". */
export function settingsSummary(s: Settings): string {
  if (!s.enabled) return `${BRAND_NAME} kapalı`;
  if (!s.suggestionsEnabled) return "Açık; uyarılar ve öneriler kapalı";
  return `Açık: ${SUMMARY_NAMES.filter(([k]) => s[k] === true).map(([, n]) => n).join(", ")}`;
}

/** "Bu Sohbet" ilerleme çubuğu: genelde biten tur sayısı ve şu anki tur. */
function progress(turns: number, median: number): HTMLElement {
  const max = Math.max(turns, median) * 1.25;
  const wrap = el("div", "progress");
  const track = el("div", "progress-track");
  track.setAttribute("aria-hidden", "true");
  const usual = el("span", "progress-usual");
  usual.style.width = `${(Math.min(turns, median) / max) * 100}%`;
  track.append(usual);
  if (turns > median) {
    const over = el("span", "progress-over");
    over.style.left = `${(median / max) * 100}%`;
    over.style.width = `${((turns - median) / max) * 100}%`;
    track.append(over);
  }
  const tick = el("span", "progress-tick");
  tick.style.left = `${(median / max) * 100}%`;
  track.append(tick);
  const labels = el("div", "progress-labels");
  const a = el("span", "progress-label", `genelde ${median}`);
  a.style.left = `${(median / max) * 100}%`;
  const b = el("span", "progress-label now", `şu an ${turns}`);
  b.style.left = `${(turns / max) * 100}%`;
  labels.append(a);
  if (turns !== median) labels.append(b);
  wrap.append(track, labels, el("span", "sr-only", `Bu tür sohbetler genelde ${median} mesajda bitiyor; bu sohbet ${turns}. mesajda.`));
  return wrap;
}

function tile(value: string, label: string): HTMLElement {
  const t = el("div", "tile");
  t.append(el("span", "num tile-num", value), el("span", "tile-label", label));
  return t;
}

/** Araç çubuğu penceresini kurar. Tüm metinler textContent ile yazılır (HTML eklenmez). */
export function mountPopup(
  root: HTMLElement,
  store: SettingsStore,
  counters: CounterStore,
  now: () => Date = () => new Date(),
  copy: (text: string) => Promise<boolean> = copyToClipboard,
  tab: TabBridge = NO_TAB,
  openPage: OpenPage = () => {},
): void {
  let view: "main" | "settings" = "main";
  let confirming = false;
  let notice = "";
  let cardNotice = "";
  let insightSeen = false;
  let focusAfter: string | null = null;

  /** Ayar değişince sayfa yeniden çizilir; odak basılan anahtara geri verilir. */
  const update = async (patch: Partial<Settings>, focus: string | null = null) => {
    notice = "";
    focusAfter = focus;
    await store.update(patch);
    await render();
  };

  const header = () => {
    const top = el("header", "top");
    top.append(brandLockup(30, true, true), privacyChip());
    return top;
  };

  const conversationCard = (snap: ConversationSnapshot): HTMLElement => {
    const sec = el("section", "card lifted");
    sec.setAttribute("aria-labelledby", "conv-title");
    const h = el("h2", "sec-title", "Bu Sohbet");
    h.id = "conv-title";
    sec.append(h);
    const lines = conversationLines(snap);
    const showDetail = !snap.personal && snap.intervening && snap.turns > 0;
    if (showDetail) {
      sec.append(el("p", "sec-sub", `${taskLabel(snap.task)} · ${snap.turns}. mesaj`));
      if (snap.norm) sec.append(progress(snap.turns, Math.round(snap.norm.median)));
      for (const line of lines.slice(1)) sec.append(el("p", "line", line));
    } else {
      for (const line of lines) sec.append(el("p", "line", line));
    }
    if (showDetail && snap.card_available) {
      const go = el("button", "primary wide", "Yeni sohbete geç");
      go.addEventListener("click", async () => {
        const ok = await tab.openCard();
        if (ok) window.close();
        else {
          cardNotice = "Şu an açılamadı; sohbet sayfasına dönüp tekrar deneyebilirsin.";
          await render();
        }
      });
      sec.append(go);
    }
    if (cardNotice) sec.append(el("p", "muted", cardNotice));
    return sec;
  };

  const weekSection = (counts: Awaited<ReturnType<CounterStore["load"]>>): HTMLElement => {
    const r = weekReport(counts, weekStart(now()));
    const sec = el("section", "week");
    sec.setAttribute("aria-labelledby", "week-title");
    const head = el("div", "sec-head");
    const h = el("h2", "sec-title", "Bu Hafta");
    h.id = "week-title";
    head.append(h, el("span", "sec-meta", weekLabel(r.start, r.end).replace(/ \d{4}$/, "")));
    const tiles = el("div", "tiles");
    tiles.append(
      tile(String(r.conversations), "Sohbet"),
      tile(r.enough ? `%${percent(r.loops, r.conversations)}` : String(r.loops), "Takılıp kalınan"),
      tile(String(r.strips.benzer), "Benzer mesaj"),
    );
    let line: string;
    if (r.conversations === 0) line = "Bu hafta henüz biten bir sohbet yok.";
    else if (!r.enough) line = `Yüzde söylemek için en az ${config.min_conversations} sohbet gerekiyor; şimdilik yalnızca sayılar.`;
    else if (r.previous.conversations >= config.min_conversations)
      line = `Takılıp kalma oranı geçen hafta %${numberWas(percent(r.previous.loops, r.previous.conversations))}.`;
    else line = "Geçen hafta karşılaştırma için az sohbet vardı.";
    const openWeekly = el("button", "wide", "Haftalık özeti aç");
    openWeekly.addEventListener("click", () => openPage("weekly.html"));
    sec.append(head, tiles, el("p", "line muted", line), openWeekly);
    if (!insightSeen && r.conversations > 0) {
      insightSeen = true;
      counters.record("insight", {}, "pencere", "oneri");
      void counters.flush();
    }
    return sec;
  };

  const footer = (settings: Settings): HTMLElement[] => {
    const row = el("button", "nav-row");
    row.type = "button";
    row.dataset.focus = "settings";
    const text = el("span", "nav-text");
    text.append(el("span", "nav-title", "Ayarlar"), el("span", "nav-sub", settingsSummary(settings)));
    row.append(text, el("span", "chev"));
    row.addEventListener("click", async () => {
      view = "settings";
      focusAfter = "back";
      await render();
    });
    const help = el("p", "help");
    const link = el("a", undefined, `${BRAND_NAME} nasıl çalışır?`);
    link.href = "welcome.html";
    link.target = "_blank";
    link.rel = "noopener";
    help.append(link);
    return [el("hr"), row, el("hr"), help];
  };

  const mainView = async (settings: Settings) => {
    const [counts, snap] = await Promise.all([counters.load(), tab.snapshot().catch(() => null)]);
    const parts: HTMLElement[] = [header(), el("hr")];
    if (!settings.enabled) {
      const off = el("section", "card lifted");
      const on = el("button", "primary wide", `${BRAND_NAME}'ı aç`);
      on.addEventListener("click", () => update({ enabled: true }, "settings"));
      off.append(el("h2", "sec-title", `${BRAND_NAME} şu an kapalı.`), el("p", "line muted", "Kapalıyken hiçbir şey yapmaz."), on);
      parts.push(off);
    } else {
      const suggesting = settings.suggestionsEnabled;
      if (suggesting && snap !== null && snap.active) parts.push(conversationCard(snap));
      if (suggesting) parts.push(weekSection(counts));
      else {
        const sec = el("section", "week");
        sec.append(
          el("h2", "sec-title", "Bu Hafta"),
          el("p", "line muted", "Uyarılar ve öneriler kapalı; şu an yalnızca günlük sayılar tutuluyor. Özet, öneriler açılınca burada görünür."),
        );
        parts.push(sec);
      }
    }
    parts.push(...footer(settings));
    return parts;
  };

  const settingsView = (settings: Settings) => {
    const head = el("header", "sub-top");
    const back = el("button", "back", "Ayarlar");
    const h1 = el("h1", "sr-only", "Ayarlar");
    back.type = "button";
    back.dataset.focus = "back";
    back.setAttribute("aria-label", "Geri, Ayarlar");
    back.addEventListener("click", async () => {
      view = "main";
      confirming = false;
      notice = "";
      focusAfter = "settings";
      await render();
    });
    head.append(h1, back);
    const list = el("div", "settings");
    const sub = !settings.enabled || !settings.suggestionsEnabled;
    type Toggle = "enabled" | "suggestionsEnabled" | "ringEnabled" | "exitCardEnabled";
    const toggle = (key: Toggle) => (v: boolean) => update({ [key]: v } as Partial<Settings>, key);
    const rows = [
      switchRow(`${BRAND_NAME} açık`, "Kapalıyken hiçbir şey yapmaz.", settings.enabled, false, toggle("enabled")),
      switchRow("Uyarılar ve öneriler", "Kapalıyken hiçbir şey gösterilmez ve mesajlar bekletilmez; yalnızca günlük sayılar tutulur.",
        settings.suggestionsEnabled, !settings.enabled, toggle("suggestionsEnabled")),
      switchRow("Halka", "Mesaj kutusunun kenarında sohbetin gidişini sakin bir tonla gösterir.", settings.ringEnabled, sub, toggle("ringEnabled")),
      switchRow("Yeni sohbet önerisi", "Uzayan sohbette yeni sohbet önerir.", settings.exitCardEnabled, sub, toggle("exitCardEnabled")),
    ];
    (["enabled", "suggestionsEnabled", "ringEnabled", "exitCardEnabled"] as const).forEach((key, i) => {
      const input = rows[i]!.querySelector("input");
      if (input) input.dataset.focus = key;
    });
    list.append(...rows);
    const data = el("section", "data");
    data.append(
      el("h2", "sec-title", "Verilerin"),
      el("p", "line muted", "Hiçbir mesaj cihazından çıkmaz ve saklanmaz. Yalnızca ayarların ve günlük sayılar tutulur; sayılar 90 gün sonra silinir."),
    );
    if (confirming) {
      const box = el("div", "confirm");
      box.setAttribute("role", "alertdialog");
      box.setAttribute("aria-label", "Verileri silme onayı");
      const yes = el("button", "danger-solid", "Evet, sil");
      yes.addEventListener("click", async () => {
        await store.clearAll();
        confirming = false;
        notice = "Silindi. Eklenti varsayılan ayara döndü.";
        focusAfter = "delete";
        await render();
      });
      const no = el("button", undefined, "Vazgeç");
      no.dataset.focus = "cancel";
      no.addEventListener("click", async () => {
        confirming = false;
        focusAfter = "delete";
        await render();
      });
      const actions = el("div", "actions");
      actions.append(yes, no);
      box.append(el("p", "confirm-text", "Ayarların ve sayaçların silinecek. Emin misin?"), actions);
      data.append(box);
    } else {
      const exp = el("button", undefined, "Sayaçlarımı kopyala");
      exp.dataset.focus = "copy";
      exp.addEventListener("click", async () => {
        // Yalnızca günlük sayılar kopyalanır (sürüm numaralı; mesaj metni ya da sohbet bilgisi yok).
        const ok = await copy(await counters.exportJson());
        notice = ok ? "Sayaçlar panoya kopyalandı." : "Kopyalanamadı.";
        focusAfter = "copy";
        await render();
      });
      const del = el("button", undefined, "Tüm verilerimi sil");
      del.dataset.focus = "delete";
      del.addEventListener("click", async () => {
        confirming = true;
        notice = "";
        focusAfter = "cancel";
        await render();
      });
      const actions = el("div", "actions");
      actions.append(exp, del);
      data.append(actions);
    }
    if (notice) {
      const n = el("p", "notice", notice);
      n.setAttribute("role", "status");
      data.append(n);
    }
    return [head, el("hr"), list, el("hr"), data];
  };

  const render = async (): Promise<void> => {
    const settings = await store.load();
    const parts = view === "main" ? await mainView(settings) : settingsView(settings);
    root.replaceChildren(...parts);
    if (focusAfter) {
      root.querySelector<HTMLElement>(`[data-focus="${focusAfter}"]`)?.focus();
      focusAfter = null;
    }
  };

  void render();
}
