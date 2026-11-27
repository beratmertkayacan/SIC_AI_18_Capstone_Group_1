// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CounterStore, dayOf, validateExport, type Dims, type EventName } from "../core/counters";
import { DEFAULT_SETTINGS, SettingsStore, type KeyValueStorage } from "../core/settings";
import { mountWeekly } from "../weekly/weekly";
import type { ConversationSnapshot } from "../core/messages";
import { dataNote, mountPopup, type TabBridge } from "./popup";

function memoryStorage(): KeyValueStorage & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
    set: async (items) => void Object.assign(data, items),
    remove: async (keys) => void keys.forEach((k) => delete data[k]),
  };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const NOW = new Date(2026, 9, 21, 12); // Çarşamba; hafta 19 Ekim Pazartesi başlar

let root: HTMLElement;
let storage: ReturnType<typeof memoryStorage>;
let store: SettingsStore;
let counters: CounterStore;

/** Belirli bir günde bir olay say ve hemen depoya yaz. */
async function record(event: EventName, detail: string, when: Date = NOW, dims: Dims = { platform: "chatgpt" }) {
  const c = new CounterStore(storage, { flushDelayMs: 0, now: () => when });
  c.record(event, dims, detail, "oneri");
  await c.flush();
}

function checkbox(label: string): HTMLInputElement {
  const row = Array.from(root.querySelectorAll("label")).find((l) => l.textContent?.includes(label))!;
  return row.querySelector("input")!;
}
function button(text: string): HTMLButtonElement {
  return Array.from(root.querySelectorAll("button")).find((b) => b.textContent === text)!;
}
let opened: string[] = [];
async function open(tab?: TabBridge, copy?: (t: string) => Promise<boolean>) {
  opened = [];
  mountPopup(root, store, counters, () => NOW, copy, tab, (p) => opened.push(p));
  await flush();
  await flush();
}
const snap = (over: Partial<ConversationSnapshot> = {}): ConversationSnapshot => ({
  platform: "chatgpt", active: true, suggesting: true, intervening: true, personal: false, turns: 7, task: "kod",
  similar: 2, recent_similar: 2, apology_streak: 0, vague_streak: 0, segments: 1, exited: false,
  norm: { median: 3, p75: 5 }, card_available: true, ...over,
});
function fakeTab(s: ConversationSnapshot | null, openOk = true) {
  const calls = { open: 0 };
  const tab: TabBridge = { snapshot: async () => s, openCard: async () => (calls.open++, openOk) };
  return { tab, calls };
}
async function conversations(task: string, n: number, outcome = "normal", len = "4-6") {
  for (let i = 0; i < n; i++) await record("conversation", outcome, NOW, { platform: "chatgpt", task, len, first_len: "orta" });
}

beforeEach(() => {
  vi.spyOn(window, "close").mockImplementation(() => {}); // jsdom'da pencereyi gerçekten kapatmasın
  document.body.innerHTML = '<div id="root"></div>';
  root = document.getElementById("root")!;
  storage = memoryStorage();
  store = new SettingsStore(storage);
  counters = new CounterStore(storage, { flushDelayMs: 0, now: () => NOW });
});

const settingsButton = () => Array.from(root.querySelectorAll<HTMLButtonElement>("button.nav-row"))[0]!;
const week = () => root.querySelector("section.week")?.textContent ?? "";
const tipText = () => root.querySelector(".hab-tip-text")?.textContent ?? null;
async function rerender() {
  await flush();
  await flush();
}

describe("popup", () => {
  it("ana görünüm: başlık, Bu hafta, Ayarlar satırı ve yardım bağlantısı", async () => {
    await open();
    expect(root.querySelector(".brand-name")?.textContent).toBe("Kâfi AI");
    expect(root.querySelector(".privacy-chip")?.textContent).toBe("Veriler cihazında kalır");
    expect(root.querySelector("#week-title")?.textContent).toBe("Bu hafta");
    expect(settingsButton().textContent).toContain("Açık: öneriler, halka, yeni sohbet önerisi, haftalık özet");
    const link = root.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("welcome.html");
    expect(link.getAttribute("target")).toBe("_blank");
    // Haftalık özetle aynı yol: openPage ile açılır.
    link.click();
    expect(opened).toEqual(["welcome.html"]);
  });

  it("Bu hafta takvim haftasını sayar: Pazartesiden önceki günler girmez; kutu ve yüzde yok", async () => {
    await conversations("kod", 4, "normal");
    await conversations("kod", 1, "dongu");
    await record("strip", "gosterildi");
    await record("conversation", "dongu", new Date(2026, 9, 18, 12), { platform: "chatgpt", task: "kod", len: "4-6", first_len: "orta" }); // önceki Pazar
    await open();
    expect(root.querySelector(".hab-total")?.textContent).toBe("5 sohbet bitti.");
    expect(root.querySelector(".sec-meta")?.textContent).toBe("19–25 Ekim");
    expect(root.querySelector(".tile")).toBeNull();
    expect(week()).not.toContain("%");
    expect(week()).toContain("Kâfi AI 1 kez araya girdi.");
    // Geçen hafta 5'ten az sohbet: geçen hafta satırı hiç yok.
    expect(week()).not.toContain("Geçen hafta");
    // conversation dongu kullanıcıya gösterilmez: loop_end olmadan "takılınca" satırı yok.
    expect(week()).not.toContain("Takılınca nasıl bitti");
  });

  it("veri yok: sohbet yoksa yalnızca açıklama", async () => {
    await open();
    expect(week()).toContain("Henüz biten bir sohbet yok.");
    expect(week()).toContain("Bir sohbeti bitirdiğinde ya da sekmeyi kapattığında burada görünür.");
    expect(root.querySelector(".hab-group")).toBeNull();
  });

  it("az veri: yalnızca sohbet sayısı ve araya girme satırı; öneri yok", async () => {
    await conversations("kod", 2, "dongu");
    await record("loop_end", "toparlandi", NOW, { platform: "chatgpt", task: "kod", len: "4-6" });
    await record("strip", "gosterildi_kisa", NOW, { platform: "chatgpt", task: "kod" });
    await record("strip", "gosterildi_kisa", NOW, { platform: "chatgpt", task: "kod" });
    await record("strip", "gosterildi_kisa", NOW, { platform: "chatgpt", task: "kod" });
    await open();
    expect(week()).toContain("2 sohbet bitti.");
    expect(week()).toContain("Bir şey önermek için en az 5 sohbet gerekiyor.");
    expect(week()).toContain("Kâfi AI 3 kez araya girdi.");
    expect(week()).not.toContain("Takılınca");
    expect(tipText()).toBeNull();
  });

  it("dolu hafta: takılınca nasıl bitti, hamleler ve şeffaflık satırı; sıfır olan parça yok", async () => {
    await conversations("kod", 6);
    await record("loop_end", "toparlandi", NOW, { platform: "chatgpt", task: "kod", len: "4-6" });
    await record("loop_end", "toparlandi", NOW, { platform: "chatgpt", task: "kod", len: "4-6" });
    await record("loop_end", "birakildi", NOW, { platform: "chatgpt", task: "kod", len: "4-6" });
    await record("repair_button", "format", NOW, { platform: "chatgpt", task: "kod" });
    await record("strip", "gosterildi", NOW, { platform: "chatgpt", task: "kod" });
    await record("strip_action", "yerinde_degil");
    await open();
    expect(week()).toContain("3 sohbet aynı yerde dönmeye başladı.");
    expect(week()).not.toContain("başladın");
    // Döngü cümlesi bir başlık değil: pencerede "Bu hafta"nın altında h3 yok.
    expect(root.querySelector("section.week h3")).toBeNull();
    const rows = Array.from(root.querySelectorAll(".hab-rows li")).map((li) => [li.querySelector(".hab-row-label")?.textContent, li.querySelector(".hab-row-num")?.textContent, li.className]);
    expect(rows).toEqual([["Aynı sohbette yolunu buldun", "2", ""], ["Sohbetten çıktın", "1", "quiet"]]);
    expect(week()).toContain("1 kez eksik olanı bir cümleyle ekledin.");
    expect(week()).not.toContain("Taze başlat'ı kullandın");
    expect(week()).toContain("Kâfi AI 1 kez araya girdi; 1'inde “yerinde değildi” dedin.");
  });

  it("geçen hafta pencerede yok (yalnızca haftalık sayfada); yön ya da kıyas sözcüğü de yok", async () => {
    for (let i = 0; i < 5; i++) {
      await record("conversation", i < 2 ? "dongu" : "normal", new Date(2026, 9, 14, 12), { platform: "chatgpt", task: "kod", len: "1-3", first_len: "orta" });
    }
    await conversations("kod", 5);
    await open();
    expect(week()).not.toContain("Geçen hafta");
    // Satırlar başlıktaki "Bu hafta"yı tekrar etmez.
    expect(root.querySelector(".hab-total")?.textContent).toBe("5 sohbet bitti.");
    for (const word of ["daha az", "daha çok", "arttı", "azaldı", "%"]) expect(week()).not.toContain(word);
  });

  it("Haftalık özeti aç düğmesi haftalık sayfayı açar", async () => {
    await open();
    button("Haftalık özeti aç").click();
    expect(opened).toEqual(["weekly.html"]);
  });

  it("Ayarlar alt sayfası: varsayılanda beş anahtar da açık, geri düğmesi ana görünüme döner", async () => {
    await open();
    settingsButton().click();
    await flush();
    await flush();
    for (const l of ["Kâfi AI açık", "Öneriler", "Halka", "Yeni sohbet önerisi", "Haftalık özet"]) expect(checkbox(l).checked).toBe(true);
    expect(document.activeElement?.textContent).toBe("Ayarlar");
    (root.querySelector("button.back") as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(root.querySelector("#week-title")).not.toBeNull();
    // Geri dönünce odak Ayarlar satırına verilir.
    expect(document.activeElement).toBe(settingsButton());
  });

  it("ayarlar özeti duruma göre kısa ve küçük harfli", async () => {
    const { settingsSummary } = await import("./popup");
    const base = { ...DEFAULT_SETTINGS };
    expect(settingsSummary({ ...base, ringEnabled: false })).toBe("Açık: öneriler, yeni sohbet önerisi, haftalık özet");
    expect(settingsSummary({ ...base, habitsEnabled: false })).toBe("Açık: öneriler, halka, yeni sohbet önerisi");
    expect(settingsSummary({ ...base, suggestionsEnabled: false })).toBe("Açık; öneriler kapalı");
    expect(settingsSummary({ ...base, enabled: false })).toBe("Kâfi AI kapalı");
  });

  it("anahtar değişince sayfa yeniden çizilse de odak aynı anahtarda kalır", async () => {
    await open();
    settingsButton().click();
    await flush();
    await flush();
    checkbox("Halka").click();
    await flush();
    await flush();
    expect(checkbox("Halka").checked).toBe(false);
    expect(document.activeElement).toBe(checkbox("Halka"));
  });

  it("silme onayında Vazgeç odağı silme düğmesine geri verir", async () => {
    await open();
    settingsButton().click();
    await flush();
    await flush();
    button("Tüm verilerimi sil").click();
    await flush();
    await flush();
    expect(document.activeElement).toBe(button("Vazgeç"));
    button("Vazgeç").click();
    await flush();
    await flush();
    expect(document.activeElement).toBe(button("Tüm verilerimi sil"));
  });

  it("eklentiyi kapatınca kaydeder, diğer anahtarlar devre dışı kalır; ana görünümde aç düğmesi çıkar", async () => {
    await open();
    settingsButton().click();
    await flush();
    checkbox("Kâfi AI açık").click();
    await flush();
    await flush();
    expect(await store.load()).toEqual({ ...DEFAULT_SETTINGS, enabled: false });
    expect(checkbox("Öneriler").disabled).toBe(true);
    expect(checkbox("Yeni sohbet önerisi").disabled).toBe(true);
    (root.querySelector("button.back") as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(root.textContent).toContain("Kâfi AI şu an kapalı.");
    button("Kâfi AI'ı aç").click();
    await flush();
    await flush();
    expect((await store.load()).enabled).toBe(true);
  });

  it("öneriler kapatılınca yalnızca say: halka ve yeni sohbet önerisi devre dışı, özet ve Bu Sohbet gösterilmez", async () => {
    await open(fakeTab(snap()).tab);
    settingsButton().click();
    await flush();
    checkbox("Öneriler").click();
    await flush();
    await flush();
    expect((await store.load()).suggestionsEnabled).toBe(false);
    expect(checkbox("Halka").disabled).toBe(true);
    expect(checkbox("Yeni sohbet önerisi").disabled).toBe(true);
    (root.querySelector("button.back") as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(root.querySelector("#conv-title")).toBeNull();
    expect(root.querySelector(".hab-total")).toBeNull();
    expect(tipText()).toBeNull();
    expect(root.textContent).toContain("yalnızca günlük sayılar tutuluyor");
  });

  it("yeni sohbet önerisini tek başına kapatabilir", async () => {
    await open();
    settingsButton().click();
    await flush();
    checkbox("Yeni sohbet önerisi").click();
    await flush();
    expect((await store.load()).exitCardEnabled).toBe(false);
    expect((await store.load()).enabled).toBe(true);
  });

  it("sayaçları sürüm numaralı v2 biçiminde, yalnızca sayı olarak panoya kopyalar", async () => {
    await record("strip", "gosterildi");
    await record("send", "farkli", NOW, { platform: "chatgpt" });
    let copied = "";
    await open(undefined, async (t) => ((copied = t), true));
    settingsButton().click();
    await flush();
    button("Sayaçlarımı kopyala").click();
    await flush();
    await flush();
    const exported = JSON.parse(copied);
    expect(exported.schema).toBe("kafiai.counts");
    expect(exported.version).toBe(2);
    expect(validateExport(exported)).toEqual([]);
    expect(exported.days[dayOf(NOW)].c).toEqual({ "strip|chatgpt|na|gosterildi": 1, "send|chatgpt|na|na|na|farkli": 1 });
    expect(root.textContent).toContain("Sayaçlar panoya kopyalandı.");
  });

  it("kopyalama başarısız olursa bunu söyler", async () => {
    await open(undefined, async () => false);
    settingsButton().click();
    await flush();
    button("Sayaçlarımı kopyala").click();
    await flush();
    await flush();
    expect(root.textContent).toContain("Kopyalanamadı.");
  });

  it("silme önce satır içinde onay ister, odak Vazgeç'e gider; Vazgeç hiçbir şeyi silmez", async () => {
    await record("strip", "gosterildi");
    await open();
    settingsButton().click();
    await flush();
    button("Tüm verilerimi sil").click();
    await flush();
    await flush();
    expect(root.textContent).toContain("Emin misin?");
    expect(document.activeElement?.textContent).toBe("Vazgeç");
    button("Vazgeç").click();
    await flush();
    await flush();
    expect(Object.keys(storage.data)).toContain("kafiai.counts.v2");
  });

  it("onaylanınca her şey silinir ve varsayılana döner", async () => {
    await record("strip", "gosterildi");
    await store.update({ enabled: false });
    await open();
    settingsButton().click();
    await flush();
    button("Tüm verilerimi sil").click();
    await flush();
    button("Evet, sil").click();
    await flush();
    await flush();
    expect(storage.data).toEqual({});
    expect(root.textContent).toContain("Silindi.");
    expect(checkbox("Kâfi AI açık").checked).toBe(true);
  });

  it("içgörü penceresi bir kez sayılır", async () => {
    await conversations("kod", 2);
    await open();
    await flush();
    const json = JSON.parse(await counters.exportJson());
    expect(json.days[dayOf(NOW)].c["insight|na|pencere"]).toBe(1);
    expect(validateExport(json)).toEqual([]);
  });

  it("'Bu sohbet' bölümü tür, mesaj sırası ve ilerlemeyi gösterir; kartı sekmede açar", async () => {
    const { tab, calls } = fakeTab(snap({ turns: 5 }));
    await open(tab);
    expect(root.querySelector("#conv-title")?.textContent).toBe("Bu sohbet");
    expect(root.querySelector(".sec-sub")?.textContent).toBe("Kod yazma ve hata ayıklama · 5. mesaj");
    expect(root.querySelector(".progress")?.textContent).toContain("genelde 3");
    expect(root.querySelector(".progress")?.textContent).toContain("şu an 5");
    expect(root.textContent).toContain("Son mesajlarından 2 tanesi öncekine çok benziyordu.");
    button("Yeni sohbete geç").click();
    await flush();
    expect(calls.open).toBe(1);
  });

  it("kişisel sohbette öneri ve düğme yok", async () => {
    await open(fakeTab(snap({ personal: true })).tab);
    expect(root.textContent).toContain("Bu sohbette öneri göstermiyorum.");
    expect(button("Yeni sohbete geç")).toBeUndefined();
    expect(root.querySelector(".progress")).toBeNull();
  });

  it("desteklenmeyen sekmede 'Bu sohbet' bölümü çıkmaz", async () => {
    await open(fakeTab(null).tab);
    expect(root.querySelector("#conv-title")).toBeNull();
  });

  it("kart açılamazsa bunu söyler", async () => {
    await open(fakeTab(snap(), false).tab);
    button("Yeni sohbete geç").click();
    await flush();
    await flush();
    expect(root.textContent).toContain("Şu an açılamadı");
  });

  it("yargılayıcı söz içermez: puan, seri, ödül, sıralama ya da yüzde yok", async () => {
    await conversations("kod", 6, "dongu");
    for (const d of ["toparlandi", "yeni_sohbet", "birakildi"]) await record("loop_end", d, NOW, { platform: "chatgpt", task: "kod", len: "4-6" });
    for (let i = 0; i < 3; i++) await record("strip", "gosterildi_kisa", NOW, { platform: "chatgpt", task: "kod" });
    await open(fakeTab(snap()).tab);
    expect(tipText()).not.toBeNull();
    const text = (root.textContent ?? "").toLowerCase();
    for (const bad of ["bağımlı", "risk", "tehlike", "rozet", "puan", "seri", "ödül", "sıralama", "%", "uyarı"]) expect(text).not.toContain(bad);
  });

  it("Haftalık özet kapatılınca bölüm çizilmez ama sayılar tutulmaya devam eder", async () => {
    await conversations("kod", 6);
    await store.update({ habitsEnabled: false });
    await open();
    expect(root.querySelector("#week-title")).toBeNull();
    expect(button("Haftalık özeti aç")).toBeUndefined();
    await record("strip", "gosterildi");
    const json = JSON.parse(await counters.exportJson());
    expect(json.days[dayOf(NOW)].c["strip|chatgpt|na|gosterildi"]).toBe(1);
  });

  it("Özeti bugünden başlat: sayaçlar silinmez, özet bugünden okur ve onay metnini söyler", async () => {
    await record("conversation", "normal", new Date(2026, 9, 20, 12), { platform: "chatgpt", task: "kod", len: "4-6", first_len: "orta" }); // dün
    await open();
    settingsButton().click();
    await rerender();
    button("Özeti bugünden başlat").click();
    await rerender();
    expect((await store.load()).habitsFrom).toBe("2026-10-21");
    expect(root.textContent).toContain("Özet bugünden başlayacak. Sayılar silinmez; silmek için “Tüm verilerimi sil”.");
    expect(document.activeElement).toBe(button("Özeti bugünden başlat"));
    expect(Object.keys(JSON.parse(await counters.exportJson()).days)).toContain("2026-10-20");
    (root.querySelector("button.back") as HTMLButtonElement).click();
    await rerender();
    expect(week()).toContain("Özet bugün yeniden başladı.");
  });

  it("öneri: Ayarlar'a git yeni sohbet önerisi anahtarına götürür", async () => {
    await conversations("kod", 5);
    await record("card_action", "yerinde_degil");
    await record("card_action", "yerinde_degil");
    await open();
    expect(tipText()).toBe("İstersen yeni sohbet önerisini Ayarlar'dan kapatabilirsin; sayılar yine tutulur.");
    button("Ayarlar'a git").click();
    await rerender();
    expect(document.activeElement).toBe(checkbox("Yeni sohbet önerisi"));
  });

  it("öneri: Kapat yalnızca bu hafta gizler, sayılır ve yerine başka öneri gelmez", async () => {
    await conversations("kod", 5);
    for (let i = 0; i < 3; i++) await record("strip", "gosterildi_kisa", NOW, { platform: "chatgpt", task: "kod" });
    for (let i = 0; i < 3; i++) await record("strip", "gosterildi", NOW, { platform: "chatgpt", task: "kod" });
    await open();
    expect(root.querySelectorAll(".hab-tip").length).toBe(1);
    button("Kapat").click();
    await rerender();
    expect(tipText()).toBeNull();
    expect(root.textContent).toContain("Öneri bu hafta için kapatıldı.");
    expect(document.activeElement).toBe(button("Haftalık özeti aç"));
    expect((await store.load()).mutedTips).toEqual({ kisa_duzeltme: { since: "2026-10-19", weeks: 1 } });
    const json = JSON.parse(await counters.exportJson());
    expect(json.days[dayOf(NOW)].c["insight|na|oneri_kapat"]).toBe(1);
    expect(validateExport(json)).toEqual([]);
    // Pencere yeniden açılınca da bu hafta öneri yok.
    await open();
    expect(tipText()).toBeNull();
  });

  it("pencere ve haftalık sayfa aynı haftada aynı öneriyi gösterir", async () => {
    await conversations("kod", 5);
    await record("card", "gosterildi_norm", NOW, { platform: "chatgpt", task: "kod", len: "4-6" });
    await record("card", "gosterildi_model", NOW, { platform: "chatgpt", task: "kod", len: "4-6" });
    await open();
    const inPopup = tipText();
    expect(inPopup).toContain("Taze başlat'ı dene");
    document.body.innerHTML = '<div id="root"></div>';
    root = document.getElementById("root")!;
    mountWeekly(root, { settings: store, counters, now: () => NOW, copy: async () => true });
    await rerender();
    expect(tipText()).toBe(inPopup);
  });
});

describe("anlam desteği ayarı (K51 taslağı)", () => {
  it("veri notu ayar açıkken neyin gittiğini, kapalıyken hiçbir şeyin çıkmadığını söyler", () => {
    expect(dataNote({ ...DEFAULT_SETTINGS })).toContain("Hiçbir mesaj cihazından çıkmaz");
    const on = dataNote({ ...DEFAULT_SETTINGS, semanticEnabled: true });
    expect(on).toContain("Anlam desteği açık");
    expect(on).not.toContain("Hiçbir mesaj cihazından çıkmaz");
  });
  it("varsayılanı kapalı", () => {
    expect(DEFAULT_SETTINGS.semanticEnabled).toBe(false);
  });
});
