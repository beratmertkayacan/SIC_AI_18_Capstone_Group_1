/**
 * İçerik betiği (index.ts) için senaryo düzeneği: betiği sahte bir adaptör ve bellekte duran sahte
 * chrome.storage ile çalıştırır; testler mesaj gönderir, cevap bitirir, düğmelere basar ve sayaçlara
 * bakar. Yalnızca testlerde kullanılır (build-entries.json'da yok). Sayaç sayımlarındaki hataları
 * (çift sayım, eksik "tetiklendi") birim testleri göremediği için uçtan uca bu yol gerekiyor.
 */
import { vi } from "vitest";

/** Bu dosyaya göre mutlak yol: vi.doMock, index.ts'in içe aktardığı modülle aynı kimliği görsün. */
const here = (rel: string) => decodeURIComponent(new URL(rel, import.meta.url).pathname);

const SETTINGS = {
  enabled: true,
  exitCardEnabled: true,
  suggestionsEnabled: true,
  ringEnabled: true,
  habitsEnabled: true,
  mutedTips: {},
  habitsFrom: null,
};

type Handlers = {
  onBeforeSend(e: { text: string; anchor: Element }): boolean;
  onSend(e: { text: string }): void;
  onResponseComplete(): void;
};

export interface Scenario {
  store: Map<string, unknown>;
  /** Adaptörün kaç kez çağrıldığı: bekletilen mesajı gönderme ve odağı mesaj kutusuna verme. */
  calls: { submitHeld: number; focusComposer: number };
  /** Kullanıcı mesajı yazıp Enter'a bastı; true: gönderim bekletildi (şerit). */
  send(text: string): boolean;
  /** Bekletilen mesaj sayfada gönderildi (gerçek adaptörde submitHeld → onSend). */
  sendHeld(text: string): void;
  /** Yapay zekanın cevabı bitti. */
  respond(text: string | null): void;
  /** Şerit ("strip") ya da kartta ("exit-card") düğmeye basar; düğme yoksa false. */
  click(kind: "strip" | "exit-card", label: string): boolean;
  visible(kind: "strip" | "exit-card"): boolean;
  text(kind: "strip" | "exit-card"): string;
  escape(): void;
  /** Sekme kapandı: sohbet sonucu sayılır ve sayaçlar yazılır. */
  end(): Promise<void>;
  navigate(path: string): Promise<void>;
  /** Sayaçlar olay|ayrıntı biçiminde (boyutlar atılır). */
  counts(): Record<string, number>;
  phases(): string[];
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Bir önceki senaryonun betiğini susturur: açık şerit/kart kapanır, zamanlayıcılar durur, sayaçlar eski depoya yazılır. */
let teardownPrevious: (() => Promise<void>) | null = null;

/** Son senaryonun betiğini susturur (dosyanın sonunda çağrılır). */
export async function teardownScenario(): Promise<void> {
  if (teardownPrevious) await teardownPrevious();
  teardownPrevious = null;
}

/**
 * Sahte değerlendirici (anlam desteği, K51 taslağı): verilirse sunucu adresi dolu sayılır ve arka plan
 * çalışanına giden her istek bu işleve gider; dönen değer sunucunun JSON cevabıdır. Ağ yok.
 */
export type FakeJudge = (turlar: { rol: "k" | "a"; metin: string }[]) => unknown;

export async function bootScenario(
  settings: Partial<typeof SETTINGS> & { semanticEnabled?: boolean } = {},
  path = "/c/abcdef123456",
  judge?: FakeJudge,
): Promise<Scenario> {
  await teardownScenario();
  vi.resetModules();
  document.body.innerHTML = "";
  history.replaceState(null, "", path);

  const store = new Map<string, unknown>([["kafiai.settings", { ...SETTINGS, ...settings }]]);
  const changed: ((changes: Record<string, unknown>, area: string) => void)[] = [];
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: async (keys: string[]) =>
          Object.fromEntries(keys.filter((k) => store.has(k)).map((k) => [k, structuredClone(store.get(k))])),
        set: async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) {
            const oldValue = store.get(k);
            store.set(k, structuredClone(v));
            changed.forEach((f) => f({ [k]: { oldValue, newValue: v } }, "local"));
          }
        },
        remove: async (keys: string[]) => keys.forEach((k) => store.delete(k)),
      },
      onChanged: { addListener: (f: (changes: Record<string, unknown>, area: string) => void) => changed.push(f) },
    },
    // runtime.id gerçek eklentide her zaman dolu; boşalması eklentinin yeniden yüklendiği anlamına gelir (extension-context.ts).
    runtime: {
      id: "kafi-test",
      onMessage: { addListener: () => {}, removeListener: () => {} },
      sendMessage: async (msg: { turlar: { rol: "k" | "a"; metin: string }[] }) =>
        judge ? { ok: true, data: judge(msg.turlar), ms: 5 } : { ok: false, hata: "adres_yok", ms: 0 },
    },
  };
  if (judge) {
    const real = (await import("../data/judge.json")).default;
    vi.doMock(here("../data/judge.json"), () => ({ default: { ...real, endpoint: "https://degerlendirici.invalid/api/judge" } }));
  }

  const state = { response: null as string | null };
  const calls = { submitHeld: 0, focusComposer: 0 };
  const anchor = document.createElement("form");
  document.body.append(anchor);
  let handlers: Handlers | null = null;
  const adapter = {
    name: "sahte",
    platform: "chatgpt",
    matches: () => true,
    conversationKey: (u: URL) => (u.pathname.startsWith("/c/") ? u.pathname : null),
    start(h: Handlers) {
      handlers = h;
      return () => {};
    },
    submitHeld() {
      calls.submitHeld += 1;
      return true;
    },
    newChatUrl: () => "/",
    composer: () => ({ anchor, empty: true }),
    focusComposer() {
      calls.focusComposer += 1;
    },
    lastResponse: () => state.response,
    readHistory: () => [] as string[],
    insertText: () => true,
  };
  vi.doMock(here("../adapters/registry.ts"), () => ({
    platformFor: () => ({
      platform: "chatgpt",
      label: "ChatGPT",
      matches: [],
      capabilities: { regenerate: true, edit: true, model: "on", interventions: "full" },
      adapter,
    }),
  }));
  vi.doMock(here("../ui/clipboard.ts"), () => ({ copyToClipboard: async () => true }));
  window.open = () => null;
  await import("./index");
  await wait(20); // ayarlar yüklensin

  const h = (): Handlers => {
    if (!handlers) throw new Error("adaptör başlatılmadı");
    return handlers;
  };
  const host = (kind: string) => document.querySelector<HTMLElement>(`[data-kafiai="${kind}"]`);
  const end = async () => {
    window.dispatchEvent(new Event("pagehide"));
    await wait(30);
  };
  teardownPrevious = async () => {
    // Açık şerit ya da kart kapanır (dinleyicileri sonraki senaryoya sızmasın), sonra sayaçlar eski depoya yazılır.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await end();
  };

  const scenario: Scenario = {
    store,
    calls,
    send(text) {
      const held = h().onBeforeSend({ text, anchor });
      if (!held) h().onSend({ text });
      return held;
    },
    sendHeld(text) {
      h().onSend({ text });
    },
    respond(text) {
      state.response = text;
      h().onResponseComplete();
    },
    click(kind, label) {
      const button = Array.from(host(kind)?.shadowRoot?.querySelectorAll("button") ?? []).find((b) => b.textContent === label);
      if (!button) return false;
      button.click();
      return true;
    },
    visible: (kind) => host(kind) !== null,
    text: (kind) => host(kind)?.shadowRoot?.querySelector(".strip")?.textContent ?? "",
    escape() {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    },
    end,
    async navigate(next) {
      history.pushState(null, "", next);
      await wait(1100); // NAV_POLL_MS bir kez dolsun
    },
    counts() {
      const stored = store.get("kafiai.counts.v2") as { days?: Record<string, { c: Record<string, number> }> } | undefined;
      const out: Record<string, number> = {};
      for (const day of Object.values(stored?.days ?? {})) {
        for (const [key, n] of Object.entries(day.c)) {
          const parts = key.split("|");
          const short = `${parts[0]}|${parts[parts.length - 1]}`;
          out[short] = (out[short] ?? 0) + n;
        }
      }
      return out;
    },
    phases() {
      const stored = store.get("kafiai.counts.v2") as { days?: Record<string, { phase: string }> } | undefined;
      return Object.values(stored?.days ?? {}).map((d) => d.phase);
    },
  };
  return scenario;
}
