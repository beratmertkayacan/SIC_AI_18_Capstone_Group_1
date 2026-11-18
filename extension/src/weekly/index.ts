import { chromeStorage } from "../core/chrome-storage";
import { CounterStore } from "../core/counters";
import { SettingsStore } from "../core/settings";
import { mountWeekly } from "./weekly";

const root = document.getElementById("root");
if (root) mountWeekly(root, { settings: new SettingsStore(chromeStorage), counters: new CounterStore(chromeStorage, { flushDelayMs: 0 }) });
