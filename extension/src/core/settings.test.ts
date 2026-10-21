import { describe, expect, it } from "vitest";
import { COUNT_RETENTION_DAYS } from "../config";
import {
  DEFAULT_SETTINGS,
  dayKey,
  parseCounts,
  parseSettings,
  pruneCounts,
  SettingsStore,
  type KeyValueStorage,
} from "./settings";

function memoryStorage(initial: Record<string, unknown> = {}): KeyValueStorage & { data: Record<string, unknown> } {
  const data = { ...initial };
  return {
    data,
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
    set: async (items) => void Object.assign(data, items),
    remove: async (keys) => void keys.forEach((k) => delete data[k]),
  };
}

describe("parseSettings", () => {
  it("boş ya da bozuk veride varsayılanı verir", () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("abc")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ enabled: "evet" })).toEqual(DEFAULT_SETTINGS);
  });
  it("bilinmeyen alanları atar", () => {
    expect(parseSettings({ enabled: false, mesaj: "gizli" })).toEqual({ enabled: false, exitCardEnabled: true });
  });
});

describe("parseCounts", () => {
  it("yalnızca bilinen sayaçları ve geçerli günleri tutar", () => {
    const counts = parseCounts({
      "2026-10-21": { stripShown: 2, bilinmeyen: 5, freshStart: -1, shortBreak: 1.5 },
      "bozuk-gün": { stripShown: 1 },
      "2026-10-22": { stripShown: 0 },
    });
    expect(counts).toEqual({ "2026-10-21": { stripShown: 2 } });
  });
});

describe("pruneCounts", () => {
  it("saklama süresinden eski günleri siler", () => {
    const now = new Date(2026, 9, 21);
    const old = new Date(now);
    old.setDate(old.getDate() - COUNT_RETENTION_DAYS - 1);
    const edge = new Date(now);
    edge.setDate(edge.getDate() - COUNT_RETENTION_DAYS);
    const out = pruneCounts(
      { [dayKey(old)]: { stripShown: 1 }, [dayKey(edge)]: { stripShown: 2 }, [dayKey(now)]: { stripShown: 3 } },
      now,
    );
    expect(Object.keys(out)).toEqual([dayKey(edge), dayKey(now)].sort());
  });
});

describe("SettingsStore", () => {
  it("boş depoda varsayılan ayarı verir", async () => {
    expect(await new SettingsStore(memoryStorage()).load()).toEqual(DEFAULT_SETTINGS);
  });

  it("update yalnızca verilen alanı değiştirir ve kalıcı yazar", async () => {
    const storage = memoryStorage();
    const store = new SettingsStore(storage);
    await store.update({ exitCardEnabled: false });
    expect(await new SettingsStore(storage).load()).toEqual({ enabled: true, exitCardEnabled: false });
    await store.update({ enabled: false });
    expect(await store.load()).toEqual({ enabled: false, exitCardEnabled: false });
  });

  it("increment aynı günün sayacını artırır, başka güne ayrı yazar", async () => {
    const store = new SettingsStore(memoryStorage());
    const d1 = new Date(2026, 9, 21, 10);
    const d2 = new Date(2026, 9, 22, 10);
    await store.increment("stripShown", d1);
    await store.increment("stripShown", d1);
    await store.increment("freshStart", d1);
    await store.increment("stripShown", d2);
    expect(await store.loadCounts()).toEqual({
      "2026-10-21": { stripShown: 2, freshStart: 1 },
      "2026-10-22": { stripShown: 1 },
    });
  });

  it("saklanan veride yalnızca ayar anahtarları ve sayılar bulunur", async () => {
    const storage = memoryStorage();
    const store = new SettingsStore(storage);
    await store.update({ enabled: false });
    await store.increment("stripShown", new Date(2026, 9, 21));
    const dump = JSON.stringify(storage.data);
    expect(Object.keys(storage.data).sort()).toEqual(["kafiai.counts", "kafiai.settings"]);
    expect(dump).toBe('{"kafiai.settings":{"enabled":false,"exitCardEnabled":true},"kafiai.counts":{"2026-10-21":{"stripShown":1}}}');
  });

  it("clearAll her şeyi siler ve varsayılana döner", async () => {
    const storage = memoryStorage();
    const store = new SettingsStore(storage);
    await store.update({ enabled: false });
    await store.increment("stripShown");
    await store.clearAll();
    expect(storage.data).toEqual({});
    expect(await store.load()).toEqual(DEFAULT_SETTINGS);
    expect(await store.loadCounts()).toEqual({});
  });

  it("depolama hata verirse increment sessizce geçer", async () => {
    const broken: KeyValueStorage = {
      get: async () => {
        throw new Error("depo yok");
      },
      set: async () => {},
      remove: async () => {},
    };
    await expect(new SettingsStore(broken).increment("stripShown")).resolves.toBeUndefined();
  });
});
