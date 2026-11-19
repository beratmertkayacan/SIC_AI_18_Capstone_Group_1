import { BRAND_NAME } from "../brand";
import schema from "../data/counter-schema.json";
import config from "../data/insights-config.json";
import { CONTINUE_REPAIRS, REPAIRS, shortRepairs } from "../core/repairs";
import { CounterStore } from "../core/counters";
import { SettingsStore } from "../core/settings";
import { percent, shiftWeek, weekReport, weekStart, type WeekReport } from "../core/week-report";
import { copyToClipboard } from "../ui/clipboard";
import { brandLockup, el, hbar, infoTip, privacyChip } from "../ui/page-kit";
import {
  DAY_LONG,
  DAY_SHORT,
  followupLine,
  freshFootLine,
  headline,
  LEN_NAMES,
  lengthLine,
  loopShare,
  nextTimeTip,
  numberOf,
  PLATFORM_NAMES,
  platformLine,
  previousLoopLine,
  slotLine,
  SLOT_NAMES,
  TASK_ROWS,
  taskMeta,
  taskName,
  weekLabel,
} from "./weekly-text";

/**
 * Haftalık özet sayfası (weekly.html). Araç çubuğu penceresindeki "Haftalık özeti aç" ile yeni
 * sekmede açılır. Yalnızca bu cihazdaki sayaçlardan çizilir; hiçbir şey ağa gitmez.
 * Üç hal: boş hafta (sohbet yok), az veri (yüzde söylemek için yetersiz), dolu hafta.
 */

const SLOTS: string[] = schema.dimensions.slot;
const SHORT_BUCKET = config.short_followup_bucket;
export const WEEKS_BACK = config.weeks_back;

/** Kart: başlık, alt satır, bilgi düğmesi ve gövde. */
function block(title: string, sub: string | null, info: string | null, ...body: Node[]): HTMLElement {
  const card = el("section", "card block");
  const head = el("div", "card-head");
  const titles = el("div");
  titles.append(el("h2", "card-title", title));
  if (sub) titles.append(el("p", "card-sub", sub));
  head.append(titles);
  if (info) head.append(infoTip(title, info));
  card.append(head, ...body);
  return card;
}

function stat(title: string, value: string, unit: string | null, desc: string | null, foot: string | null, info: string | null) {
  const card = el("section", "card stat");
  const head = el("div", "card-head");
  head.append(el("h3", "stat-title", title));
  if (info) head.append(infoTip(title, info));
  const num = el("p", "num stat-num", value);
  if (unit) num.append(el("small", undefined, unit));
  card.append(head, num);
  if (desc) card.append(el("p", "stat-desc", desc));
  if (foot) card.append(el("p", "stat-foot", foot));
  return card;
}

/** Ad, alt satır, çubuk ve sağda sayı: tüm dağılımlar aynı satır düzenini kullanır. */
function barRow(name: string, sub: string | null, ratio: number, value: string, meta: string | null): HTMLElement {
  const row = el("li", "brow");
  const label = el("div", "brow-label");
  label.append(el("span", "brow-name", name));
  if (sub) label.append(el("span", "brow-sub", sub));
  const right = el("div", "brow-value");
  right.append(el("span", "brow-num", value));
  if (meta) right.append(el("span", "brow-meta", meta));
  row.append(label, hbar(ratio), right);
  return row;
}

function tasksBlock(r: WeekReport): HTMLElement {
  const list = el("ul", "brows");
  const byTask = new Map(r.tasks.map((t) => [t.task, t]));
  for (const { task, examples } of TASK_ROWS) {
    const t = byTask.get(task) ?? { conversations: 0, loops: 0 };
    list.append(barRow(taskName(task), examples, r.conversations ? t.conversations / r.conversations : 0,
      `%${percent(t.conversations, r.conversations)}`, taskMeta(t.conversations, t.loops)));
  }
  return block("Ne Tür İşler", "Sohbetlerinin konusuna göre dağılımı",
    "Sohbetin türü ilk mesajındaki sözcüklerden tahmin edilir. Emin olunamayan sohbetler “Diğer” sayılır. “Takıldın”, o sohbetin takılıp kaldığın sohbetlerden biri olduğunu söyler.",
    list);
}

const ACTION_ROWS: [keyof WeekReport["strip_actions"] | "repairs", string][] = [
  ["yine_de_gonder", "Yine de gönderdin"],
  ["duzenle", "Mesajını düzenledin"],
  ["repairs", "Bir düzeltme cümlesi ekledin"],
  ["yeni_sohbet", "Yeni sohbete geçtin"],
  ["yerinde_degil", "“Yerinde değildi” dedin"],
];

/** Onarım düğmelerinin ekrandaki adı ve kısa açıklaması; ilk dördü her zaman, diğerleri seçildiyse görünür. */
const REPAIR_SUBS: Record<string, string> = {
  format: "İçerik doğruydu, düzeni istediğin gibi değildi",
  info: "Cevaptaki bilgi hatalıydı",
  shorter: "Cevap gereğinden uzundu",
  longer: "Cevap yeterince ayrıntılı değildi",
  error: "Kod sohbetinde hata çıktısını ekledin",
  expected: "Beklediğin sonucu yazdın",
  wrong_part: "Yanlış olan kısmı yazdın",
  continue_what: "Neyle devam edileceğini yazdın",
  continue_how: "Nasıl devam edileceğini yazdın",
};
/** Düğme adları şeritteki gerçek düğmelerden alınır; bir ad değişirse burası da kendiliğinden değişir. */
const REPAIR_LABELS: Record<string, string> = Object.fromEntries(
  [...REPAIRS, ...shortRepairs("kod"), ...shortRepairs(null), ...CONTINUE_REPAIRS].map((x) => [x.id, x.label]),
);
const ALWAYS_SHOWN = ["format", "info", "shorter", "longer"];

function actionsBlock(r: WeekReport): HTMLElement {
  const s = r.strips;
  const shown = s.benzer + s.kisa + s.tekrar;
  const kinds = [
    [s.benzer, "benzer mesaj"],
    [s.kisa, "kısa düzeltme"],
    [s.tekrar, "kısa devam"],
  ].filter(([n]) => (n as number) > 0).map(([n, name]) => `${n} ${name}`);
  const sub = shown === 0 ? "Bu hafta şerit çıkmadı" : `Şeritler bu hafta ${shown} kez çıktı (${kinds.join(", ")}). Sonrasında:`;
  const info =
    "Şerit, mesajın gönderilmeden önce çıkan küçük uyarıdır. Tepkiler sayaçta şeridin türüne göre ayrılmaz; üç türün toplamıdır. Bir şeritte birden çok düğme seçilebildiği için tepkilerin toplamı şerit sayısını tutmayabilir.";
  if (shown === 0) return block("Uyarılara Ne Yaptın", sub, info);
  const repairTotal = Object.values(r.repairs).reduce((a, b) => a + b, 0);
  const values = ACTION_ROWS.map(([k]) => (k === "repairs" ? repairTotal : r.strip_actions[k]));
  const max = Math.max(1, ...values);
  const list = el("ul", "brows compact");
  ACTION_ROWS.forEach(([, name], i) => list.append(barRow(name, null, values[i]! / max, `${values[i]} kez`, null)));

  const repairs = el("ul", "plain-list");
  for (const id of Object.keys(r.repairs)) {
    const n = r.repairs[id] ?? 0;
    if (id === "na" || (!ALWAYS_SHOWN.includes(id) && n === 0)) continue;
    const li = el("li", n === 0 ? "dim" : undefined);
    const text = el("span");
    text.append(el("span", "pl-name", `“${REPAIR_LABELS[id] ?? id}”`), el("span", "pl-sub", REPAIR_SUBS[id] ?? ""));
    li.append(text, el("span", "pl-num", `${n} kez`));
    repairs.append(li);
  }
  const sec = el("div", "divided");
  sec.append(el("h3", "minor-title", "Seçtiğin düzeltme düğmeleri"), repairs);
  return block("Uyarılara Ne Yaptın", sub, info, list, sec);
}

function timeBlock(r: WeekReport): HTMLElement {
  const max = Math.max(0, ...r.similar_grid.flat());
  const table = el("table", "heat");
  const caption = el("caption", "sr-only", "Benzer mesajların gün ve saat dilimine göre sayısı");
  const thead = el("thead");
  const hr = el("tr");
  hr.append(el("td"));
  DAY_SHORT.forEach((d, i) => {
    const th = el("th", undefined, d);
    th.scope = "col";
    th.title = DAY_LONG[i]!;
    hr.append(th);
  });
  thead.append(hr);
  const tbody = el("tbody");
  SLOTS.forEach((slot, si) => {
    const tr = el("tr");
    const th = el("th");
    th.scope = "row";
    th.append(el("span", "slot-name", SLOT_NAMES[slot]?.name ?? slot), el("span", "slot-hours", SLOT_NAMES[slot]?.hours ?? ""));
    tr.append(th);
    (r.similar_grid[si] ?? []).forEach((n, di) => {
      // Dört ton: yok, az, orta, çok (en yüksek hücreye göre).
      const level = n === 0 || max === 0 ? 0 : n / max <= 1 / 3 ? 1 : n / max <= 2 / 3 ? 2 : 3;
      const td = el("td");
      const cell = el("span", `cell l${level}`);
      cell.title = `${DAY_LONG[di]}, ${(SLOT_NAMES[slot]?.name ?? slot).toLocaleLowerCase("tr")}: ${n} mesaj`;
      cell.append(el("span", "sr-only", `${n}`));
      td.append(cell);
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(caption, thead, tbody);
  const foot = el("div", "heat-foot");
  const legend = el("span", "heat-legend");
  legend.setAttribute("aria-hidden", "true");
  legend.append(el("span", undefined, "Yok"), el("span", "cell l0"), el("span", "cell l1"), el("span", "cell l2"), el("span", "cell l3"), el("span", undefined, "Çok"));
  foot.append(el("p", "block-line", slotLine(r, SLOTS)), legend);
  return block("Ne Zaman", "Benzer mesajlarının gün ve saate dağılımı",
    "Öncekine çok benzeyen her gönderilmiş mesaj sayılır; şerit çıksın ya da çıkmasın. Gün ve saat, mesajı gönderdiğin ana göre.",
    table, foot);
}

function freshBlock(r: WeekReport): HTMLElement {
  const sub = r.fresh_starts > 0 ? `Taze başlat'ı ${r.fresh_starts} kez kullandın` : "Bu hafta Taze başlat'ı kullanmadın";
  const info = "Taze başlat ile açtığın ve biten her yeni sohbet bir daireyle gösterilir. Dolu daireler 3 mesaj içinde biten sohbetler, kesik çizgili olanlar daha uzun sürenler. İçindeki sayı kaç mesaj sürdüğünü gösterir.";
  const body: Node[] = [];
  const buckets = Object.entries(r.fresh_followups).flatMap(([b, n]) => Array.from({ length: n }, () => b));
  if (buckets.length > 0) {
    const row = el("ul", "rings");
    const visible = buckets.slice(0, 8);
    for (const b of visible) {
      const li = el("li", b === SHORT_BUCKET ? "ring-dot full" : "ring-dot");
      li.append(el("span", "ring-num", b.replace("-", "–")), el("span", "ring-unit", "mesaj"));
      row.append(li);
    }
    if (buckets.length > visible.length) row.append(el("li", "ring-more", `+${buckets.length - visible.length}`));
    body.push(row);
  }
  const line = followupLine(r);
  if (line) body.push(el("p", "block-strong", line));
  body.push(el("p", "block-note divided",
    "Taze başlat, sohbette istediklerini tek bir taslakta toplar ve yeni bir sohbet açar. Taslağın sonundaki “Beklediğim sonuç” satırını doldurmak yeni sohbete baştan yön verir."));
  return block("Ne İşe Yaradı", sub, info, ...body);
}

function lengthBlock(r: WeekReport): HTMLElement {
  const list = el("ul", "brows compact");
  for (const l of r.lengths) {
    list.append(barRow(LEN_NAMES[l.len] ?? l.len, null, r.conversations ? l.conversations / r.conversations : 0,
      `%${percent(l.conversations, r.conversations)}`, `${l.conversations} sohbet`));
  }
  return block("Sohbetlerin Ne Kadar Sürdü", "Bir sohbette kaç mesaj gönderdiğin",
    "Bir sohbette senin gönderdiğin mesajlar sayılır; yapay zekanın cevapları sayılmaz.",
    list, el("p", "block-line", lengthLine(r)));
}

function platformBlock(r: WeekReport): HTMLElement {
  const list = el("ul", "brows compact");
  for (const p of r.platforms.filter((x) => x.conversations > 0)) {
    list.append(barRow(PLATFORM_NAMES[p.platform] ?? p.platform, null, p.conversations / Math.max(1, r.conversations),
      `%${percent(p.conversations, r.conversations)}`, `${p.conversations} sohbet`));
  }
  return block("Hangi Araçlarda", "Sohbetlerinin araçlara göre dağılımı", null, list, el("p", "block-line", platformLine(r)));
}

function trendBlock(r: WeekReport): HTMLElement {
  const max = Math.max(1, ...r.days.map((d) => d.conversations));
  const chart = el("ol", "cols");
  r.days.forEach((d, i) => {
    const li = el("li", "col");
    // Ekran okuyucu her sütunu tek cümle olarak okur; görsel parçalar ondan gizlenir.
    li.append(el("span", "sr-only", `${DAY_LONG[i]}: ${d.conversations} sohbet, ${d.loops} takılıp kalınan`));
    const plot = el("div", "col-plot");
    plot.setAttribute("aria-hidden", "true");
    const all = el("span", "col-all");
    all.style.height = `${(d.conversations / max) * 100}%`;
    const loops = el("span", "col-loop");
    loops.style.height = d.conversations ? `${(d.loops / d.conversations) * 100}%` : "0";
    all.append(loops);
    if (d.conversations > 0) all.append(el("span", "col-num", String(d.conversations)));
    plot.append(all);
    const day = el("span", "col-day", DAY_SHORT[i]!);
    day.setAttribute("aria-hidden", "true");
    li.append(plot, day);
    chart.append(li);
  });
  const legend = el("div", "legend");
  legend.setAttribute("aria-hidden", "true");
  legend.append(el("span", "lg all", "Tüm sohbetler"), el("span", "lg loop", "Takılıp kaldıkların"));
  const card = block("Haftanın Gidişi", "Günlere göre biten sohbet sayısı", null, chart);
  card.querySelector(".card-head")?.append(legend);
  card.classList.add("wide");
  return card;
}

function tipBlock(r: WeekReport): HTMLElement | null {
  const t = nextTimeTip(r);
  if (!t) return null;
  const box = el("section", "nexttime");
  box.append(el("h2", "card-title", "İstersen Bir Dahaki Sefere"), el("p", "nexttime-tip", t.tip.replace(/^İstersen /, "").replace(/^./, (c) => c.toLocaleUpperCase("tr"))));
  if (t.because) box.append(el("p", "nexttime-because", t.because));
  return box;
}

/** comparable: bir önceki hafta saklama süresinin içinde mi (en eski haftada değil). */
function overview(r: WeekReport, comparable: boolean): HTMLElement {
  const grid = el("div", "stats");
  const followTotal = Object.values(r.fresh_followups).reduce((a, b) => a + b, 0);
  grid.append(
    stat("Yapay zeka sohbetlerin", String(r.conversations), null,
      "ChatGPT, Gemini ve benzeri araçlarda bu hafta biten sohbetler",
      comparable ? `Geçen hafta ${r.previous.conversations} sohbet` : null,
      "Bir sohbet, başka bir sohbete geçtiğinde ya da sekmeyi kapattığında biter ve o günün sayısına yazılır. Hala açık olan sohbet henüz sayılmaz."),
    stat("Takılıp kaldığın sohbetler", `%${loopShare(r)}`, null,
      `Cevap işe yaramadı deyip aynı şeyi tekrar istediğin sohbetler (${r.conversations} sohbetin ${r.loops > 0 ? numberOf(r.loops) : "hiçbiri"})`,
      comparable ? previousLoopLine(r) : null,
      "İkinci mesajından sonra en az iki kez “olmadı”, “yanlış” gibi bir düzeltme yazdığın ya da bir düzeltmeyle birlikte aynı mesajı yeniden gönderdiğin sohbetler bu sayıya girer."),
    stat("Benzer mesaj uyarısı", String(r.strips.benzer), "kez",
      `Mesajın öncekine çok benzediğinde ${BRAND_NAME}'ın gönderimi durdurduğu anlar`,
      comparable ? `Geçen hafta ${r.previous.strips_benzer} kez` : null,
      "Gönder'e bastığında mesajın son 5 mesajınla karşılaştırılır. Neredeyse aynıysa, gönderilmeden önce küçük bir uyarı çıkar. “1. soruyu çöz”, “2. soruyu çöz” gibi bilerek yaptığın seri istekler sayılmaz."),
    stat("Taze başlat", String(r.fresh_starts), "kez",
      "Sohbette istediklerini tek mesajda toplayıp yeni sohbet açan düğme",
      followTotal > 0 || r.fresh_starts > 0 ? freshFootLine(r) : "Bu hafta kullanılmadı",
      "Çıkış kartındaki Taze başlat, sohbetteki isteklerini tek bir taslakta toplar ve yeni bir sohbet açar. Yeni sohbet bitince kaç mesaj sürdüğü sayılır."),
  );
  const sec = el("section", "overview");
  sec.setAttribute("aria-labelledby", "ov-title");
  const h = el("h2", "section-title", "Genel Görünüm");
  h.id = "ov-title";
  sec.append(h, grid, el("p", "headline", headline(r, comparable)));
  return sec;
}

function fewState(r: WeekReport): HTMLElement[] {
  const card = el("section", "card state few");
  const icon = el("span", "state-ring");
  icon.setAttribute("aria-hidden", "true");
  const text = el("div");
  text.append(
    el("h2", "state-title", `Bu hafta ${r.conversations} yapay zeka sohbetin var.`),
    el("p", "state-body", `Bir örüntüden söz etmek için en az ${config.min_conversations} sohbet gerekiyor. Az sohbette yüzdeler yanıltıcı olabilir; bu yüzden şimdilik yalnızca sayıları gösteriyoruz.`),
  );
  card.append(icon, text);
  const grid = el("div", "stats three");
  grid.append(
    stat("Yapay zeka sohbetlerin", String(r.conversations), null, null, null, null),
    stat("Benzer mesaj uyarısı", String(r.strips.benzer), "kez", null, null, null),
    stat("Taze başlat", String(r.fresh_starts), "kez", null, null, null),
  );
  return [card, grid];
}

function emptyState(): HTMLElement {
  const card = el("section", "card state empty");
  const icon = el("span", "state-ring");
  icon.setAttribute("aria-hidden", "true");
  card.append(
    icon,
    el("h2", "state-title", "Bu hafta yapay zeka sohbeti yok."),
    el("p", "state-body", "ChatGPT, Gemini, Claude, Copilot ya da Google AI Modu'nda sohbet ettiğinde özetin burada belirecek. Önceki haftalara bakabilirsin."),
  );
  return card;
}

function pausedState(enabled: boolean): HTMLElement {
  const card = el("section", "card state empty");
  const icon = el("span", "state-ring");
  icon.setAttribute("aria-hidden", "true");
  card.append(
    icon,
    el("h2", "state-title", enabled ? "Uyarılar ve öneriler kapalı." : `${BRAND_NAME} şu an kapalı.`),
    el("p", "state-body", enabled
      ? "Bu sırada yalnızca günlük sayılar tutulur. Özet, araç çubuğu penceresindeki Ayarlar'dan uyarılar ve öneriler açılınca burada görünür."
      : "Kapalıyken hiçbir şey yapmaz. Araç çubuğu penceresinden yeniden açabilirsin."),
  );
  return card;
}

export interface WeeklyDeps {
  settings: SettingsStore;
  counters: CounterStore;
  now?: () => Date;
  copy?: (text: string) => Promise<boolean>;
}

export function mountWeekly(root: HTMLElement, deps: WeeklyDeps): void {
  const now = deps.now ?? (() => new Date());
  const copy = deps.copy ?? copyToClipboard;
  let back = 0;
  let confirming = false;
  let notice = "";
  let seen = false;
  let focusAfter: string | null = null;
  let lastLabel = "";
  // Hafta değişince okunacak canlı bölge sayfanın dışında durur; her çizimde yeniden kurulmadığı için ekran okuyucu değişikliği kaçırmaz.
  const announcer = el("p", "sr-only");
  announcer.setAttribute("aria-live", "polite");
  (root.parentElement ?? document.body).append(announcer);

  const render = async () => {
    const [settings, counts] = await Promise.all([deps.settings.load(), deps.counters.load()]);
    const current = weekStart(now());
    const start = shiftWeek(current, back);
    const r = weekReport(counts, start);
    const suggesting = settings.enabled && settings.suggestionsEnabled;

    const top = el("header", "page-top");
    top.append(brandLockup(40, false), privacyChip());

    const title = el("div", "page-title");
    const h1 = el("h1", undefined, "Haftalık Özet");
    const nav = el("div", "week-nav");
    const prev = el("button", "icon-btn prev");
    prev.type = "button";
    prev.setAttribute("aria-label", "Önceki hafta");
    prev.dataset.focus = "prev";
    prev.disabled = back >= WEEKS_BACK;
    prev.addEventListener("click", () => {
      back += 1;
      // En eski haftaya varınca düğme kapanır; odak öbür düğmeye geçer.
      focusAfter = back >= WEEKS_BACK ? "next" : "prev";
      void render();
    });
    const next = el("button", "icon-btn next");
    next.type = "button";
    next.setAttribute("aria-label", "Sonraki hafta");
    next.dataset.focus = "next";
    next.disabled = back === 0;
    next.addEventListener("click", () => {
      back -= 1;
      focusAfter = back === 0 ? "prev" : "next";
      void render();
    });
    const label = el("span", "week-label", weekLabel(r.start, r.end));
    nav.append(prev, label, next, el("span", "week-hint", `Son ${WEEKS_BACK + 1} haftaya kadar geriye bakabilirsin.`));
    title.append(h1, nav);

    const main = el("main", "page-main");
    main.append(title);
    if (!suggesting) main.append(pausedState(settings.enabled));
    else if (r.conversations === 0) main.append(emptyState());
    else if (!r.enough) main.append(...fewState(r));
    else {
      const grid = el("div", "blocks");
      grid.append(tasksBlock(r), actionsBlock(r), timeBlock(r), freshBlock(r), lengthBlock(r), platformBlock(r), trendBlock(r));
      main.append(overview(r, back < WEEKS_BACK), grid);
      const tip = tipBlock(r);
      if (tip) main.append(tip);
      if (!seen) {
        seen = true;
        deps.counters.record("insight", {}, "ayrinti", "oneri");
        void deps.counters.flush();
      }
    }

    const foot = el("footer", "page-foot");
    foot.append(el("p", "foot-note", "Bu sayfa yalnızca bu bilgisayarda tutulan sayılardan hazırlanır. Mesajlarının içeriği hiçbir yere kaydedilmez."));
    const actions = el("div", "foot-actions");
    if (confirming) {
      const box = el("div", "confirm");
      box.setAttribute("role", "alertdialog");
      box.setAttribute("aria-label", "Verileri silme onayı");
      const yes = el("button", "danger-solid", "Evet, sil");
      yes.addEventListener("click", async () => {
        await deps.settings.clearAll();
        confirming = false;
        notice = "Silindi. Eklenti varsayılan ayara döndü.";
        focusAfter = "delete";
        await render();
      });
      const no = el("button", undefined, "Vazgeç");
      no.dataset.focus = "cancel";
      no.addEventListener("click", async () => { confirming = false; focusAfter = "delete"; await render(); });
      const btns = el("div", "confirm-actions");
      btns.append(yes, no);
      box.append(el("p", undefined, "Ayarların ve sayaçların silinecek. Emin misin?"), btns);
      actions.append(box);
    } else {
      const exp = el("button", undefined, "Sayaçlarımı kopyala");
      exp.dataset.focus = "copy";
      exp.addEventListener("click", async () => {
        const ok = await copy(await deps.counters.exportJson());
        notice = ok ? "Sayaçlar panoya kopyalandı." : "Kopyalanamadı.";
        focusAfter = "copy";
        await render();
      });
      const del = el("button", undefined, "Tüm verilerimi sil");
      del.dataset.focus = "delete";
      del.addEventListener("click", async () => { confirming = true; notice = ""; focusAfter = "cancel"; await render(); });
      actions.append(exp, del);
    }
    foot.append(actions);
    if (notice) {
      const n = el("p", "foot-notice", notice);
      n.setAttribute("role", "status");
      foot.append(n);
    }

    root.replaceChildren(top, main, foot);
    // Sayfa her düğmede yeniden çizilir; odak basılan düğmeye (ya da onun yerini alana) geri verilir.
    if (focusAfter) {
      root.querySelector<HTMLElement>(`[data-focus="${focusAfter}"]`)?.focus();
      focusAfter = null;
    }
    const shown = weekLabel(r.start, r.end);
    if (lastLabel && shown !== lastLabel) announcer.textContent = shown;
    lastLabel = shown;
  };

  void render();
}
