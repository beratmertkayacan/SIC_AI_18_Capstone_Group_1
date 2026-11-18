// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CounterStore, type CountsV2, type Dims, type EventName } from "../core/counters";
import { SettingsStore, type KeyValueStorage } from "../core/settings";
import { weekReport } from "../core/week-report";
import { mountWeekly, WEEKS_BACK } from "./weekly";
import { headline, lengthLine, numberOf, numberWas, platformLine, slotLine, weekLabel } from "./weekly-text";

function memoryStorage(): KeyValueStorage & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
    set: async (items) => void Object.assign(data, items),
    remove: async (keys) => void keys.forEach((k) => delete data[k]),
  };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const NOW = new Date(2026, 10, 22, 15); // Pazar 22 Kasım; hafta 16 Kasım
const day = (d: number) => new Date(2026, 10, d, 12);

let root: HTMLElement;
let storage: ReturnType<typeof memoryStorage>;
let settings: SettingsStore;

async function record(event: EventName, detail: string, when: Date, dims: Dims, n = 1) {
  const c = new CounterStore(storage, { flushDelayMs: 0, now: () => when });
  for (let i = 0; i < n; i++) c.record(event, dims, detail, "oneri");
  await c.flush();
}
const conv = (when: Date, task: string, len: string, outcome = "normal", platform = "chatgpt", n = 1) =>
  record("conversation", outcome, when, { platform, task, len, first_len: "orta" }, n);

async function open() {
  mountWeekly(root, { settings, counters: new CounterStore(storage, { flushDelayMs: 0, now: () => NOW }), now: () => NOW, copy: async () => true });
  await flush();
  await flush();
}
const text = () => root.textContent ?? "";

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  root = document.getElementById("root")!;
  storage = memoryStorage();
  settings = new SettingsStore(storage);
});

describe("haftalık özet metinleri", () => {
  it("Türkçe ekler sayının okunuşuna göre", () => {
    expect([24, 20, 30, 15, 0, 100, 6, 9, 40].map(numberWas)).toEqual(["24'tü", "20'ydi", "30'du", "15'ti", "0'dı", "100'dü", "6'ydı", "9'du", "40'tı"]);
    expect([5, 2, 3, 6, 10, 41].map(numberOf)).toEqual(["5'i", "2'si", "3'ü", "6'sı", "10'u", "41'i"]);
  });

  it("hafta etiketi: aynı ay, ay geçişi, yıl geçişi", () => {
    expect(weekLabel("2026-11-16", "2026-11-22")).toBe("16–22 Kasım 2026");
    expect(weekLabel("2026-10-26", "2026-11-01")).toBe("26 Ekim – 1 Kasım 2026");
    expect(weekLabel("2026-12-28", "2027-01-03")).toBe("28 Aralık 2026 – 3 Ocak 2027");
  });
});

describe("haftalık özet sayfası", () => {
  it("boş hafta: sohbet yoksa bunu söyler, yüzde ve blok göstermez", async () => {
    await open();
    expect(text()).toContain("Bu hafta yapay zeka sohbeti yok.");
    expect(root.querySelector(".blocks")).toBeNull();
    expect(root.querySelector(".week-label")?.textContent).toBe("16–22 Kasım 2026");
  });

  it("az veri: 5 sohbetten azsa yalnızca sayılar, yüzde yok", async () => {
    await conv(day(17), "kod", "1-3", "dongu");
    await conv(day(18), "soru", "4-6", "normal", "chatgpt", 2);
    await open();
    expect(text()).toContain("Bu hafta 3 yapay zeka sohbetin var.");
    expect(text()).not.toMatch(/%\d/);
    expect(root.querySelector(".blocks")).toBeNull();
  });

  it("dolu hafta: ekrandaki sayılar sayaçlarla birebir tutar", async () => {
    // 6 sohbet: 2 kod (biri döngü), 4 diğer; geçen hafta 5 sohbet, 2 döngü
    await conv(day(16), "kod", "1-3", "dongu");
    await conv(day(18), "kod", "4-6");
    await conv(day(20), "diger", "1-3", "normal", "gemini", 4);
    for (let i = 0; i < 5; i++) await conv(day(10), "kod", "1-3", i < 2 ? "dongu" : "normal");
    await record("strip", "gosterildi", day(18), { platform: "chatgpt", task: "kod" }, 3);
    await record("strip", "gosterildi_kisa", day(18), { platform: "chatgpt", task: "kod" });
    await record("strip_action", "yine_de_gonder", day(18), { platform: "chatgpt" }, 2);
    await record("repair_button", "format", day(18), { platform: "chatgpt", task: "kod" });
    await record("send", "benzer", new Date(2026, 10, 18, 20), { platform: "chatgpt", slot: "18-24", task: "kod", len: "4-6" }, 3);
    await record("card_action", "taze_baslat", day(19), { platform: "chatgpt" });
    await record("fresh_followup", "1-3", day(19), { platform: "chatgpt" });
    await open();

    const stats = Array.from(root.querySelectorAll(".stat-num")).map((e) => e.textContent);
    expect(stats).toEqual(["6", "%17", "3kez", "1kez"]);
    expect(text()).toContain("(6 sohbetin 1'i)");
    expect(text()).toContain("Geçen hafta %40'tı");
    expect(text()).toContain("Bu hafta sohbetlerinin %17'sinde takılıp kaldın; geçen hafta bu oran %40'tı.");
    expect(text()).toContain("Şeritler bu hafta 4 kez çıktı (3 benzer mesaj, 1 kısa düzeltme)");
    expect(text()).toContain("Benzer mesajlarının %100'ü akşam (18.00–24.00) geldi.");
    expect(text()).toContain("Yeni açtığın sohbetlerin 1'i 3 mesaj içinde bitti.");
    expect(text()).toContain("En çok Gemini'yi kullandın.");
    expect(text()).not.toContain("Kod sohbetinde hata çıktısını ekledin");
    // ısı haritası: Çarşamba akşam hücresi en koyu ton
    const cell = root.querySelector('.heat tbody tr:nth-child(4) td:nth-child(4) .cell');
    expect(cell?.className).toBe("cell l3");
    // ipucu: takılınan tek tür kod
    expect(text()).toContain("Bu hafta takılıp kaldığın sohbetlerin 1'i kod yazarken oldu.");
  });

  it("dağılımların toplamı ana sayıya eşit (rapor düzeyinde)", async () => {
    await conv(day(16), "kod", "1-3", "dongu", "claude", 3);
    await conv(day(21), "yazma", "11+", "normal", "copilot", 4);
    const counts = (await new CounterStore(storage, { flushDelayMs: 0 }).load()) as CountsV2;
    const r = weekReport(counts, "2026-11-16");
    expect(r.tasks.reduce((s, t) => s + t.conversations, 0)).toBe(r.conversations);
    expect(r.lengths.reduce((s, t) => s + t.conversations, 0)).toBe(r.conversations);
    expect(r.platforms.reduce((s, t) => s + t.conversations, 0)).toBe(r.conversations);
    expect(lengthLine(r)).toBe("Sohbetlerinin %57'si 11 ya da daha fazla mesaj sürdü.");
    expect(platformLine(r)).toBe("En çok Copilot'u kullandın.");
    expect(slotLine(r, ["00-06", "06-12", "12-18", "18-24"])).toBe("Bu hafta öncekine çok benzeyen bir mesaj göndermedin.");
    expect(headline(r)).toBe("Bu hafta sohbetlerinin %43'ünde takılıp kaldın.");
  });

  it("hafta gezinmesi: ileri bu haftada kapalı, geri en fazla 11 hafta", async () => {
    await open();
    const prev = root.querySelector<HTMLButtonElement>(".icon-btn.prev")!;
    expect(root.querySelector<HTMLButtonElement>(".icon-btn.next")!.disabled).toBe(true);
    for (let i = 0; i < WEEKS_BACK; i++) {
      root.querySelector<HTMLButtonElement>(".icon-btn.prev")!.click();
      await flush();
      await flush();
    }
    expect(root.querySelector<HTMLButtonElement>(".icon-btn.prev")!.disabled).toBe(true);
    expect(root.querySelector(".week-label")?.textContent).toBe("31 Ağustos – 6 Eylül 2026");
    expect(prev.isConnected).toBe(false);
  });

  it("öneriler kapalıyken (yalnızca say) özet gösterilmez", async () => {
    await conv(day(17), "kod", "1-3", "normal", "chatgpt", 6);
    await settings.update({ suggestionsEnabled: false });
    await open();
    expect(text()).toContain("Uyarılar ve öneriler kapalı.");
    expect(root.querySelector(".stats")).toBeNull();
  });

  it("bilgi kutusu klavyeyle açılır ve Esc ile kapanır", async () => {
    await conv(day(17), "kod", "1-3", "normal", "chatgpt", 6);
    await open();
    const btn = root.querySelector<HTMLButtonElement>(".info-btn")!;
    const tipId = btn.getAttribute("aria-describedby")!;
    expect(document.getElementById(tipId)?.getAttribute("role")).toBe("tooltip");
    btn.focus();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("silme satır içinde onay ister; onaylanınca her şey silinir", async () => {
    await conv(day(17), "kod", "1-3", "normal", "chatgpt", 6);
    await open();
    Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "Tüm verilerimi sil")!.click();
    await flush();
    await flush();
    expect(text()).toContain("Emin misin?");
    Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "Evet, sil")!.click();
    await flush();
    await flush();
    expect(storage.data).toEqual({});
  });

  it("yargılayıcı söz yok, HTML eklenmez", async () => {
    await conv(day(17), "kod", "1-3", "dongu", "chatgpt", 6);
    await open();
    const t = text().toLowerCase();
    for (const bad of ["bağımlı", "risk", "tehlike", "rozet", "puan"]) expect(t).not.toContain(bad);
    expect(root.querySelectorAll("script").length).toBe(0);
    vi.restoreAllMocks();
  });
});
