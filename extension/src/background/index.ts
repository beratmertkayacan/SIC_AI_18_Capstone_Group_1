import { chromeJudgeDeps, handleJudge, JUDGE_MESSAGE, type JudgeRequest } from "./judge-client";
import { openWelcomeOnInstall } from "./install";

chrome.runtime.onInstalled.addListener((details) => {
  console.log("[KafiAI] kuruldu");
  openWelcomeOnInstall(details, () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  });
});

// Anlam desteği: yalnızca kendi içerik betiğimizden gelen istekler kabul edilir (src/background/judge-client.ts).
chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || (msg as { type?: unknown } | null)?.type !== JUDGE_MESSAGE) return false;
  void handleJudge(msg as JudgeRequest, chromeJudgeDeps).then(sendResponse);
  return true; // cevap eşzamansız gelecek
});
