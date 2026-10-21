// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { dayKey, SettingsStore, type KeyValueStorage } from "../core/settings";
import { mountPopup } from "./popup";

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
const NOW = new Date(2026, 9, 21, 12);

let root: HTMLElement;
let storage: ReturnType<typeof memoryStorage>;
let store: SettingsStore;

function checkbox(label: string): HTMLInputElement {
  const row = Array.from(root.querySelectorAll("label")).find((l) => l.textContent?.includes(label))!;
  return row.querySelector("input")!;
}
function button(text: string): HTMLButtonElement {
  return Array.from(root.querySelectorAll("button")).find((b) => b.textContent === text)!;
}
async function open() {
  mountPopup(root, store, () => NOW);
  await flush();
}

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  root = document.getElementById("root")!;
  storage = memoryStorage();
  store = new SettingsStore(storage);
});

describe("popup", () => {
  it("varsayılanda iki anahtar da açık gelir", async () => {
    await open();
    expect(checkbox("Eklenti açık").checked).toBe(true);
    expect(checkbox("Çıkış kartı").checked).toBe(true);
  });

  it("eklentiyi kapatınca kaydeder ve çıkış kartı anahtarını devre dışı bırakır", async () => {
    await open();
    checkbox("Eklenti açık").click();
    await flush();
    expect(await store.load()).toEqual({ enabled: false, exitCardEnabled: true });
    expect(checkbox("Eklenti açık").checked).toBe(false);
    expect(checkbox("Çıkış kartı").disabled).toBe(true);
  });

  it("çıkış kartını tek başına kapatabilir", async () => {
    await open();
    checkbox("Çıkış kartı").click();
    await flush();
    expect(await store.load()).toEqual({ enabled: true, exitCardEnabled: false });
  });

  it("kayıt yoksa bunu söyler", async () => {
    await open();
    expect(root.textContent).toContain("Henüz kaydedilen bir şey yok.");
  });

  it("son 7 günün sayılarını gösterir, sıfır olanları ve eski günleri göstermez", async () => {
    await store.increment("stripShown", NOW);
    await store.increment("stripShown", NOW);
    await store.increment("freshStart", NOW);
    const old = new Date(NOW);
    old.setDate(old.getDate() - 10);
    await store.increment("stripSendAnyway", old);
    await open();
    const items = Array.from(root.querySelectorAll("li")).map((li) => li.textContent);
    expect(items).toEqual(["Benzer mesaj uyarısı gösterildi2", "Taze başlattığın1"]);
    expect(dayKey(old)).not.toBe(dayKey(NOW));
  });

  it("silme önce onay ister; Vazgeç hiçbir şeyi silmez", async () => {
    await store.update({ enabled: false });
    await open();
    button("Tüm verilerimi sil").click();
    await flush();
    expect(root.textContent).toContain("Emin misin?");
    expect(Object.keys(storage.data).length).toBeGreaterThan(0);
    button("Vazgeç").click();
    await flush();
    expect((await store.load()).enabled).toBe(false);
    expect(button("Tüm verilerimi sil")).toBeTruthy();
  });

  it("onaylanınca her şey silinir ve varsayılana döner", async () => {
    await store.update({ enabled: false });
    await store.increment("stripShown", NOW);
    await open();
    button("Tüm verilerimi sil").click();
    await flush();
    button("Evet, sil").click();
    await flush();
    expect(storage.data).toEqual({});
    expect(root.textContent).toContain("Silindi.");
    expect(checkbox("Eklenti açık").checked).toBe(true);
  });

  it("yargılayıcı ya da doğrulanmamış söz içermez", async () => {
    await store.increment("stripShown", NOW);
    await open();
    const text = (root.textContent ?? "").toLowerCase();
    for (const bad of ["bağımlı", "risk", "tehlike", "seri", "rozet", "%"]) expect(text).not.toContain(bad);
  });
});
