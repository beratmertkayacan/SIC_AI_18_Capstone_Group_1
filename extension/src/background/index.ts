import { openWelcomeOnInstall } from "./install";

chrome.runtime.onInstalled.addListener((details) => {
  console.log("[KafiAI] kuruldu");
  openWelcomeOnInstall(details, () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  });
});
