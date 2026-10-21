import type { KeyValueStorage } from "./settings";

/** chrome.storage.local'ı SettingsStore'un beklediği arayüze bağlar. */
export const chromeStorage: KeyValueStorage = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (items) => chrome.storage.local.set(items),
  remove: (keys) => chrome.storage.local.remove(keys),
};
