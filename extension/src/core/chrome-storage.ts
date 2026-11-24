import { extensionAlive } from "./extension-context";
import type { KeyValueStorage } from "./settings";

/**
 * chrome.storage.local'ı SettingsStore'un beklediği arayüze bağlar. Eklentiyle bağ koptuysa (eklenti
 * yeniden yüklendi, sekme yenilenmedi) hata fırlatmaz: okuma boş döner, yazma ve silme hiçbir şey yapmaz.
 */
export const chromeStorage: KeyValueStorage = {
  get: async (keys) => (extensionAlive() ? chrome.storage.local.get(keys) : {}),
  set: async (items) => {
    if (extensionAlive()) await chrome.storage.local.set(items);
  },
  remove: async (keys) => {
    if (extensionAlive()) await chrome.storage.local.remove(keys);
  },
};
