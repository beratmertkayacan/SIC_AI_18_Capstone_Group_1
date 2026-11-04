/**
 * Karşılama ekranı: eklenti ilk kurulduğunda bir kez açılır; araç çubuğu penceresinden de açılabilir.
 * Üç şeyi söyler: neye baktığı, neye bakmadığı, verinin nerede durduğu.
 * Tüm metinler textContent ile yazılır (HTML eklenmez). Dil: yargılamaz; "bağımlı", "risk" gibi
 * sözler kullanılmaz. Buradaki her cümle kodda gerçekten böyle olan bir şeyi anlatmalı.
 */

export interface WelcomeSection {
  title: string;
  lines: string[];
}

export const WELCOME_LEAD =
  "KafiAI, ChatGPT ya da Gemini'de aynı yerde dönmeye başladığını fark eder ve oradan çıkmanın kolay bir yolunu sunar. " +
  "Harcadığın süreye değil, yapay zekayı nasıl kullandığına bakar.";

export const WELCOME_SECTIONS: WelcomeSection[] = [
  {
    title: "Neye bakar",
    lines: [
      "Sohbette gönderdiğin mesajlara. Gönder'e bastığın anda, mesajın daha önce yazdıklarına çok benzeyip benzemediğine bakar.",
      "Yapay zekanın cevabının ne zaman bittiğine. Cevabın metnini okumaz.",
    ],
  },
  {
    title: "Neye bakmaz",
    lines: [
      "Klavyede bastığın tuşlara, ChatGPT ve Gemini dışındaki sitelere ve kişisel bilgilerine bakmaz.",
      "Kişisel ve duygusal konuşmalarda hiçbir öneri göstermez.",
    ],
  },
  {
    title: "Verin nerede durur",
    lines: [
      "Hiçbir mesaj bilgisayarından çıkmaz. Eklentide internete istek gönderen kod yoktur.",
      "Mesaj metni kaydedilmez; yalnızca sekme açıkken bellekte durur ve sekme kapanınca silinir.",
      "Kalıcı olarak yalnızca ayarların ve günlük sayılar (kaç kez uyarı gösterildi gibi) tutulur. Sayılar 90 gün sonra silinir; istersen KafiAI penceresinden hemen silebilirsin.",
    ],
  },
  {
    title: "Ne göreceksin",
    lines: [
      "Çoğu zaman hiçbir şey. Aynı isteği yeniden gönderirken küçük bir şerit, ya da sohbet uzayıp aynı yerde dönerken küçük bir kart çıkar.",
      "Hiçbiri seni engellemez. Her birinde \"Yine de gönder\" ya da \"Kapat\" gibi bir çıkış vardır.",
    ],
  },
  {
    title: "İstediğin zaman kapatabilirsin",
    lines: [
      "Chrome'un araç çubuğundaki KafiAI simgesine bas. Oradan eklentiyi ya da yalnızca önerileri kapatabilir, verilerini silebilirsin.",
    ],
  },
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Ekranı kurar. `close` düğmeye basılınca çağrılır (gerçekte sekmeyi kapatır). */
export function mountWelcome(root: HTMLElement, close: () => void): void {
  const sections = WELCOME_SECTIONS.map((s) => {
    const box = el("section");
    box.append(el("h2", undefined, s.title));
    for (const line of s.lines) box.append(el("p", undefined, line));
    return box;
  });
  const done = el("button", "primary", "Anladım");
  done.addEventListener("click", close);
  root.replaceChildren(el("h1", undefined, "KafiAI'ye hoş geldin"), el("p", "lead", WELCOME_LEAD), ...sections, done);
}
