// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CounterStore, dayOf, type CountsV2, type Dims, type EventName } from "../core/counters";
import { SettingsStore, type KeyValueStorage } from "../core/settings";
import { weekReport } from "../core/week-report";
import { mountWeekly, WEEKS_BACK } from "./weekly";
import { lengthLine, numberOf, numberWas, platformLine, slotLine, weekLabel } from "./weekly-text";

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

async function record(event: EventName, detail: string, when: Date, dims: Dims, n = 1, phase: "oneri" | "sayim" = "oneri") {
  const c = new CounterStore(storage, { flushDelayMs: 0, now: () => when });
  for (let i = 0; i < n; i++) c.record(event, dims, detail, phase);
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
    expect(text()).toContain("3 sohbet bitti.");
    expect(text()).toContain("Bir şey önermek için en az 5 sohbet gerekiyor.");
    expect(text()).not.toMatch(/%\d/);
    expect(text()).not.toContain("İstersen");
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
    await record("loop_end", "toparlandi", day(16), { platform: "chatgpt", task: "kod", len: "1-3" });
    await open();

    // Genel görünüm: yüzde kutusu ve yüzdeli başlık yok; penceredeki satırlarla aynı cümleler.
    const ov = root.querySelector(".habits")!;
    expect(root.querySelector(".stat-num")).toBeNull();
    expect(ov.textContent).not.toContain("%");
    expect(ov.textContent).toContain("6 sohbet bitti.");
    expect(ov.textContent).toContain("1 sohbet aynı yerde dönmeye başladı.");
    expect(ov.textContent).toContain("1 kez eksik olanı bir cümleyle ekledin, 1 kez Taze başlat'ı kullandın.");
    expect(ov.textContent).toContain("Kâfi AI 4 kez araya girdi.");
    expect(ov.textContent).toContain("Geçen hafta 5 sohbet bitmişti.");
    // Görev satırı da aynı döngü tanımını (loop_end) kullanır.
    expect(text()).not.toMatch(/takılıp|takıldın/i); // eski "takılıp kalınan" tanımı ekranda yok
    expect(text()).toContain("Şeritler bu hafta 4 kez çıktı (3 benzer mesaj, 1 kısa düzeltme)");
    expect(text()).toContain("3 benzer mesajın 3'ü akşam (18.00–24.00) geldi.");
    // Dağılımlarda yüzde yok, ana bilgi sayı; başlıklar cümle düzeninde, "uyarı" sözcüğü yok.
    expect(text()).not.toContain("%");
    expect(text()).toContain("2 sohbet1'i aynı yerde döndü");
    expect(text()).not.toMatch(/döndün|başladın\b/);
    expect(Array.from(root.querySelectorAll("h1, h2")).map((h) => h.textContent)).toEqual(expect.arrayContaining([
      "Haftalık özet", "Genel görünüm", "Ne tür işler", "Önerilere ne yaptın", "Ne zaman", "Taze başlattan sonra", "Sohbetlerin ne kadar sürdü", "Hangi araçlarda", "Haftanın gidişi",
    ]));
    expect(text().toLocaleLowerCase("tr")).not.toContain("uyarı");
    expect(text()).toContain("Yeni açtığın sohbetlerin 1'i 3 mesaj içinde bitti.");
    expect(text()).toContain("En çok Gemini'yi kullandın.");
    expect(text()).not.toContain("Kod sohbetinde hata çıktısını ekledin");
    // ısı haritası: Çarşamba akşam hücresi en koyu ton
    const cell = root.querySelector('.heat tbody tr:nth-child(4) td:nth-child(4) .cell');
    expect(cell?.className).toBe("cell l3");
    // Renk tek başına anlam taşımaz: sıfırdan büyük hücrede sayı görünür, sıfırda görünmez.
    expect(cell?.querySelector(".cell-num")?.textContent).toBe("3");
    expect(root.querySelector('.heat tbody tr:nth-child(1) td:nth-child(2) .cell .cell-num')).toBeNull();
    // Haftanın gidişinde döngü diliminin sayısı da görünür (Pazartesi: 1 loop_end).
    expect(root.querySelector(".cols li:nth-child(1) .col-loop-num")?.textContent).toBe("1");
    expect(text()).toContain("Şeritten yeni sohbete geçtin");
    // Öneri: benzer mesaj şeridi en çok kod sohbetinde çıktı (3 kez) → kod ipucu, tek öneri.
    expect(ov.querySelector(".hab-tip-text")?.textContent).toBe("İstersen ilk mesaja hata çıktısını, kullandığın dili ve beklediğin sonucu birlikte yaz.");
    expect(root.querySelectorAll(".hab-tip").length).toBe(1);
  });

  it("dağılımların toplamı ana sayıya eşit (rapor düzeyinde)", async () => {
    await conv(day(16), "kod", "1-3", "dongu", "claude", 3);
    await conv(day(21), "yazma", "11+", "normal", "copilot", 4);
    const counts = (await new CounterStore(storage, { flushDelayMs: 0 }).load()) as CountsV2;
    const r = weekReport(counts, "2026-11-16");
    expect(r.tasks.reduce((s, t) => s + t.conversations, 0)).toBe(r.conversations);
    expect(r.lengths.reduce((s, t) => s + t.conversations, 0)).toBe(r.conversations);
    expect(r.platforms.reduce((s, t) => s + t.conversations, 0)).toBe(r.conversations);
    expect(lengthLine(r)).toBe("4 sohbet 11 ya da daha fazla mesaj sürdü.");
    expect(platformLine(r)).toBe("En çok Copilot'u kullandın.");
    expect(slotLine(r, ["00-06", "06-12", "12-18", "18-24"])).toBe("Bu hafta öncekine çok benzeyen bir mesaj göndermedin.");
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
    expect(text()).toContain("Öneriler kapalı.");
    expect(text().toLocaleLowerCase("tr")).not.toContain("uyarı");
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
    btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("bilgi kutusu fareyle basınca açık kalır; üzerinde durulurken Esc ile kapanır", async () => {
    await conv(day(17), "kod", "1-3", "normal", "chatgpt", 6);
    await open();
    const btn = root.querySelector<HTMLButtonElement>(".info-btn")!;
    // Tarayıcıdaki sıra: pointerdown, odak, tıklama. Odak kutuyu açıp tıklama kapatmamalı.
    btn.dispatchEvent(new Event("pointerdown"));
    btn.focus();
    btn.click();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    btn.blur();
    const wrap = btn.parentElement!;
    wrap.dispatchEvent(new Event("mouseenter"));
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("fare üzerindeyken tıklamak kutuyu kapatmaz, sabitler; fare çekilince açık kalır", async () => {
    await conv(day(17), "kod", "1-3", "normal", "chatgpt", 6);
    await open();
    const btn = root.querySelector<HTMLButtonElement>(".info-btn")!;
    const wrap = btn.parentElement!;
    wrap.dispatchEvent(new Event("mouseenter"));
    btn.dispatchEvent(new Event("pointerdown"));
    btn.focus();
    btn.click();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    btn.blur();
    btn.focus();
    btn.click(); // klavyeyle Enter: sabitler
    wrap.dispatchEvent(new Event("mouseleave"));
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    btn.click(); // ikinci basış kapatır
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("hafta düğmeleri sayfayı yeniden çizse de odak kaybolmaz; yeni hafta canlı bölgede okunur", async () => {
    await open();
    const prev = () => root.querySelector<HTMLButtonElement>(".icon-btn.prev")!;
    prev().click();
    await flush();
    await flush();
    expect(document.activeElement).toBe(prev());
    const live = document.querySelector('[aria-live="polite"]')!;
    expect(root.contains(live)).toBe(false);
    expect(live.textContent).toBe("9–15 Kasım 2026");
  });

  it("en eski haftada geçen haftayla karşılaştırma yapılmaz", async () => {
    for (let i = 0; i < 6; i++) await conv(new Date(2026, 8, 1, 12), "kod", "1-3", "dongu"); // en eski hafta: 31 Ağustos
    await open();
    for (let i = 0; i < WEEKS_BACK; i++) {
      root.querySelector<HTMLButtonElement>(".icon-btn.prev")!.click();
      await flush();
      await flush();
    }
    expect(root.querySelector<HTMLButtonElement>(".icon-btn.prev")!.disabled).toBe(true);
    expect(document.activeElement).toBe(root.querySelector(".icon-btn.next"));
    expect(text()).toContain("6 sohbet bitti.");
    expect(text()).not.toContain("Geçen hafta");
  });

  it("öneri: Yerinde değildi 4 hafta susturur, sayılır, aynı hafta yerine başka öneri gelmez", async () => {
    await conv(day(17), "kod", "1-3", "normal", "chatgpt", 6);
    await record("strip", "gosterildi_kisa", day(17), { platform: "chatgpt", task: "kod" }, 3);
    await record("strip", "gosterildi", day(17), { platform: "chatgpt", task: "kod" }, 3);
    await open();
    expect(root.querySelector(".hab-tip-text")?.textContent).toContain("neyin olmadığını");
    Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "Yerinde değildi")!.click();
    await flush();
    await flush();
    expect(root.querySelector(".hab-tip")).toBeNull(); // kod ipucu da koşulu tutsa bile bu hafta gelmez
    expect(text()).toContain("Bu öneri 4 hafta gösterilmeyecek.");
    expect(document.activeElement).toBe(root.querySelector("#ov-title"));
    expect((await settings.load()).mutedTips).toEqual({ kisa_duzeltme: { since: "2026-11-16", weeks: 4 } });
    const json = JSON.parse(await new CounterStore(storage, { flushDelayMs: 0 }).exportJson());
    expect(json.days[dayOf(NOW)].c["insight|na|oneri_yerinde_degil"]).toBe(1);
  });

  it("geçmiş haftada öneri gösterilmez", async () => {
    await conv(day(10), "kod", "1-3", "normal", "chatgpt", 6);
    await record("strip", "gosterildi_kisa", day(10), { platform: "chatgpt", task: "kod" }, 3);
    await conv(day(17), "kod", "1-3", "normal", "chatgpt", 6);
    await record("strip", "gosterildi_kisa", day(17), { platform: "chatgpt", task: "kod" }, 3);
    await open();
    expect(root.querySelector(".hab-tip")).not.toBeNull();
    root.querySelector<HTMLButtonElement>(".icon-btn.prev")!.click();
    await flush();
    await flush();
    expect(root.querySelector(".week-label")?.textContent).toBe("9–15 Kasım 2026");
    expect(text()).toContain("6 sohbet bitti.");
    expect(root.querySelector(".hab-tip")).toBeNull();
  });

  it("yalnızca say günleri: haftalık sayfada sade bir not; hiç yoksa not yok", async () => {
    await conv(day(17), "kod", "1-3", "normal", "chatgpt", 6);
    await open();
    expect(root.querySelector(".count-only")).toBeNull();
    await record("conversation", "normal", day(18), { platform: "chatgpt", task: "kod", len: "1-3", first_len: "orta" }, 1, "sayim");
    await record("conversation", "normal", day(19), { platform: "chatgpt", task: "kod", len: "1-3", first_len: "orta" }, 1, "sayim");
    await open();
    expect(root.querySelector(".count-only")?.textContent).toBe("Bu haftanın 2 günü yalnızca sayıldı; o günlerde öneri gösterilmedi.");
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
    for (const bad of ["bağımlı", "risk", "tehlike", "rozet", "puan", "seri", "ödül", "sıralama", "%", "uyarı", "ne işe yaradı"]) expect(t).not.toContain(bad);
    expect(root.querySelectorAll("script").length).toBe(0);
    vi.restoreAllMocks();
  });
});
