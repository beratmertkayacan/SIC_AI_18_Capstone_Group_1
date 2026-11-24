import { BRAND_NAME, BRAND_TAGLINE, logoMark, sitesList } from "../brand";
import { el, logo } from "../ui/page-kit";

/**
 * Karşılama ekranı: eklenti ilk kurulduğunda bir kez açılır; araç çubuğu penceresinden de açılabilir.
 * Sırası Figma'daki tasarımı izler: ne göreceksin, gizliliğin, haftalık özet, başlamadan önce.
 * Tüm metinler textContent ile yazılır (HTML eklenmez). Dil yargılamaz. Buradaki her cümle kodda
 * gerçekten böyle olan bir şeyi anlatmalı; bir kural değişince bu metin de değişir.
 */

export interface WelcomeSection {
  title: string;
  lines: string[];
}

export const WELCOME_TITLE = `${BRAND_NAME}'a hoş geldin`;

export const WELCOME_LEAD =
  `${BRAND_NAME}, yapay zeka sohbetlerinde aynı yerde dönmeye başladığında bunu fark etmene yardım eder ve oradan çıkmanın kolay bir yolunu sunar. ` +
  `Harcadığın süreye değil, yapay zekayı nasıl kullandığına bakar. Şu an ${sitesList()} üzerinde çalışır.`;

export const SEE_INTRO =
  "Çoğu zaman hiçbir şey. Aynı isteği yeniden gönderirken küçük bir şerit, ya da sohbet uzayıp aynı yerde dönerken küçük bir kart çıkar.";
export const SEE_OUTRO = "Hiçbiri seni engellemez. Her birinde “Yine de gönder” ya da “Kapat” gibi bir çıkış vardır.";

/** Gizlilik satırları. Cevabın başı ve sonu özür, düzeltme alınmadı ve teklif sorusu kuralları için okunur (K32, K40, K44). */
export const PRIVACY: WelcomeSection[] = [
  {
    title: "Neye bakar",
    lines: [
      "Sohbette gönderdiğin mesajlara. Gönder'e bastığın anda, mesajın daha önce yazdıklarına çok benzeyip benzemediğine bakar.",
      "Yapay zekanın cevabının ne zaman bittiğine. Cevabın tamamını okumaz; yalnızca başına ve sonuna bakar: özür dileyip dilemediğini, soruyla bitip bitmediğini ve bir önceki cevabın aynısı olup olmadığını anlamak için. Bunu kaydetmez, sekme kapanınca silinir.",
    ],
  },
  {
    title: "Neye bakmaz",
    lines: [
      "Yazdığın tuşları kaydetmez; desteklenen sohbet siteleri dışında çalışmaz.",
      "Kişisel ya da duygusal görünen konuşmalarda öneri göstermez.",
    ],
  },
  {
    title: "Verin nerede durur",
    lines: [
      "Hiçbir mesaj cihazından çıkmaz. Eklentide internete istek gönderen kod yoktur.",
      "Mesaj metni kaydedilmez; yalnızca sekme açıkken bellekte durur ve sekme kapanınca silinir.",
      `Kalıcı olarak yalnızca ayarların ve günlük sayılar (kaç kez şerit ya da kart gösterildi gibi) tutulur. Sayılar 90 gün sonra silinir; istersen ${BRAND_NAME} penceresinden hemen silebilirsin.`,
    ],
  },
];

export const STEPS: WelcomeSection[] = [
  {
    title: `${BRAND_NAME} simgesini sabitle`,
    lines: ["Chrome'un sağ üstündeki yapboz simgesine bas, eklentinin yanındaki iğneye tıkla. Simgesi araç çubuğunda hep görünür kalır."],
  },
  {
    title: "Sekmeni yenile",
    lines: ["Açık olan ChatGPT, Gemini ya da diğer yapay zeka sekmelerini bir kez yenile. Eklenti ancak sayfa yenilenince çalışmaya başlar."],
  },
  {
    title: "İstediğin zaman kapatabilirsin",
    lines: [
      `Chrome'un araç çubuğundaki ${BRAND_NAME} simgesine bas. Oradan eklentiyi ya da yalnızca önerileri kapatabilir, verilerini silebilirsin.`,
    ],
  },
];

/* Kartlardaki küçük çizimler: gerçek arayüzün sade birer kopyası. Süs; ekran okuyucudan gizlenir. */

function ringArt(): HTMLElement {
  const art = el("div", "art");
  const box = el("div", "mini-composer");
  // Halka gerçekte logodaki üç yaylı işarettir (LOGO_PATHS); burada orta seviyede çizilir.
  const ring = el("span", "mini-ring");
  ring.append(logoMark(18));
  box.append(el("span", "mini-text", "Bunu daha kısa yaz"), ring, el("span", "mini-send"));
  // İpucu, gerçek halkanın yazdığı cümlenin biçiminde (core/ring.ts ringText).
  art.append(box, el("div", "mini-hint", "Son mesajlarından 2 tanesi öncekilere çok benziyor."));
  return art;
}

function stripArt(): HTMLElement {
  const art = el("div", "art");
  const card = el("div", "mini-card");
  // Şeridin ilk ekranı: ana düğme, "Yine de gönder" ve "Kapat". Onarım cümleleri ancak ana düğmeye basınca açılır.
  const row = el("div", "mini-chips");
  row.append(el("span", "chip dark", "Neyin eksik olduğunu söyle"), el("span", "chip", "Yine de gönder"), el("span", "chip link", "Kapat"));
  card.append(el("p", "mini-title", "Bunu az önce de sormuştun."), row);
  art.append(card);
  return art;
}

function cardArt(): HTMLElement {
  const art = el("div", "art");
  const card = el("div", "mini-card");
  const row = el("div", "mini-chips");
  row.append(el("span", "chip dark", "Taze başlat"), el("span", "chip", "Kapat"));
  // Kod sohbetlerinin %75'i 5 mesajda ya da daha kısa sürede bitiyor (task-norms.json); kart bu cümleyi kurar.
  card.append(
    el("p", "mini-title", "Kod sohbetlerinin çoğu 5 mesajda bitiyor; bu sohbet 9. mesajında."),
    el("p", "mini-body", "İsteklerini tek mesajda toplayıp yeni bir sohbet açmak genelde daha hızlı olur."),
    row,
  );
  art.append(card);
  return art;
}

/** Özellik kartı: başlık özelliğin adıdır; sloganın ilgili adımı üstte küçük bir satır olarak durur. */
function feature(step: string, name: string, art: HTMLElement, body: string): HTMLElement {
  const card = el("article", "card feature");
  art.setAttribute("aria-hidden", "true");
  card.append(el("p", "feature-step", step), el("h3", "feature-name", name), art, el("p", "feature-body", body));
  return card;
}

function section(title: string, ...body: Node[]): HTMLElement {
  const s = el("section", "block");
  s.append(el("h2", "block-title", title), ...body);
  return s;
}

/** Ekranı kurar. `close` düğmeye basılınca çağrılır (gerçekte sekmeyi kapatır). */
export function mountWelcome(root: HTMLElement, close: () => void): void {
  const hero = el("header", "hero");
  const titles = el("div");
  titles.append(el("h1", undefined, WELCOME_TITLE), el("p", "tagline", BRAND_TAGLINE));
  hero.append(logo(72), titles);

  const features = el("div", "features");
  features.append(
    feature("Fark et.", "Halka", ringArt(), "Mesaj kutusunun kenarında küçük bir halka durur. Sohbet aynı yerde dönmeye başlayınca tonu yavaşça koyulaşır."),
    feature("Durakla.", "Benzer mesaj şeridi", stripArt(), "Mesajın öncekine çok benziyorsa, gönderilmeden önce ince bir şerit çıkar. Neyin eksik olduğunu hazır bir cümleyle ekleyebilirsin."),
    feature("Yeniden başla.", "Yeni sohbet önerisi", cardArt(), "Sohbet uzayınca küçük bir kart çıkar. Taze başlat, isteklerini tek mesajda toplayıp yeni bir sohbet açar."),
  );
  const see = section("Ne göreceksin", el("p", "block-intro", SEE_INTRO), features, el("p", "block-outro", SEE_OUTRO));

  const rows = el("dl", "privacy-rows");
  for (const p of PRIVACY) {
    const row = el("div", "privacy-row");
    const dd = el("dd");
    for (const line of p.lines) dd.append(el("p", undefined, line));
    row.append(el("dt", undefined, p.title), dd);
    rows.append(row);
  }
  const privacy = section("Gizliliğin", rows);

  const teaser = el("aside", "teaser");
  const icon = el("span", "teaser-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.append(el("i"), el("i"), el("i"));
  const tText = el("div", "teaser-text");
  tText.append(
    el("p", "teaser-title", "Her hafta kısa bir özet"),
    el("p", "teaser-body", `Haftalık özetin araç çubuğundaki ${BRAND_NAME} simgesinden açılır; birkaç sohbetten sonra dolmaya başlar.`),
  );
  // Haftalık özetin gerçek "Bu hafta" satırlarından kısa bir örnek: yüzde ya da çubuk yok, yalnızca sayı ve cümle.
  const preview = el("div", "teaser-preview");
  preview.setAttribute("aria-hidden", "true");
  preview.append(
    el("p", "tp-total", "14 sohbet bitti."),
    el("p", "tp-line", "4 sohbet aynı yerde dönmeye başladı."),
    el("p", "tp-line tp-quiet", `${BRAND_NAME} 9 kez araya girdi.`),
  );
  teaser.append(icon, tText, preview);

  const steps = el("ol", "steps");
  for (const s of STEPS) {
    const li = el("li");
    li.append(el("h3", "step-title", s.title), ...s.lines.map((l) => el("p", "step-body", l)));
    steps.append(li);
  }
  const before = section("Başlamadan önce", steps);

  const done = el("button", "primary", "Anladım");
  done.addEventListener("click", close);

  root.replaceChildren(hero, el("p", "lead", WELCOME_LEAD), see, privacy, teaser, before, done);
}

/** Ekrandaki tüm düz metinler (kartlardaki çizimler hariç); marka ve yazım testleri bunu okur. */
export const WELCOME_TEXTS: string[] = [
  WELCOME_LEAD,
  SEE_INTRO,
  SEE_OUTRO,
  ...PRIVACY.flatMap((s) => [s.title, ...s.lines]),
  ...STEPS.flatMap((s) => [s.title, ...s.lines]),
];
