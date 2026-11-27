import type { TaskNorm } from "../core/tasks";
import type { Reason } from "../core/turn-model";
import { BRAND_NAME } from "../brand";
import { header, mountCard } from "./theme";
import { CLARIFY_ANSWERED, CLARIFY_LOOP, CLARIFY_UNMET } from "../core/repairs";

/**
 * Çıkış kartı: sohbet uzayıp tekrar denemeleri olduysa, cevap bittikten sonra mesaj kutusunun
 * üstünde görünür. "Taze başlat" kullanıcının isteklerini düzenlenebilir tek taslakta toplar,
 * panoya kopyalar ve yeni sohbet açar. Dil yargılamaz; sayaç, rozet, seri yok.
 */

/**
 * Kartın nasıl kapandığı. kapat: Kapat ya da Escape; ara: "Kısa ara ver"; taze: taze başlat başarıyla
 * kopyalandıktan sonra; yerinde_degil: "Yerinde değildi" (geri bildirimi onNotRelevant sayar, ayrıca
 * "kapat" sayılmasın diye ayrı tür); gosterme: "Bir daha gösterme" onayından sonra kapandı.
 */
export type ExitDismissal = "kapat" | "ara" | "taze" | "yerinde_degil" | "gosterme" | "netlestir";

/** Kartın nereden açıldığına bağlı seçenekler. */
export interface ExitCardOptions {
  /** Kullanıcı kartı kendisi açtı (şeritteki ya da penceredeki "Yeni sohbete geç"). */
  manual?: boolean;
}

export interface ExitCardActions {
  /** Sohbetteki istekleri toplayan taslak metni üretir (tıklanınca çağrılır). */
  getDraft(): string;
  /** Düzenlenmiş taslağı kopyala ve yeni sohbet aç. Kopyalama başarılıysa true döner. */
  onFreshStart(draft: string): Promise<boolean>;
  /** Kart kapandı (kullanıcı kapattı ya da bir seçim yaptı). */
  onDismiss(kind: ExitDismissal): void;
  /** "Bir daha gösterme": kalıcı olarak kapat. Verilirse düğme gösterilir. */
  onNever?(): void;
  /** Model kaynaklı kartta "Yerinde değildi" geri bildirimi. Verilirse düğme gösterilir. */
  onNotRelevant?(): void;
  /** Sohbette konu değiştiyse true: taslağa yalnızca son konunun istekleri girer ve bu söylenir (K32). */
  focusedDraft?(): boolean;
  /** Kullanıcı bu konuda bir kuralı yeniden hatırlattıysa true: kartta not çıkar, taslak kuralı başa koyar (K48). */
  ruleRestated?(): boolean;
  /**
   * "İsteği netleştir" (K51 taslağı): aynı sohbette kalıp isteği netleştirmek için mesaj kutusuna boş bir kalıp
   * eklenir. Verilirse ve kart bir gerekçeyle açıldıysa düğme gösterilir. Kalıp eklendiyse true döner.
   */
  onClarify?(sentence: string): boolean;
}


export class ExitCard {
  private host: HTMLElement | null = null;
  private onKey: ((e: KeyboardEvent) => void) | null = null;
  private settled = false;

  get visible(): boolean {
    return this.host !== null;
  }

  /**
   * Kullanıcı kartta kalıcı bir seçim yaptı ("Bir daha gösterme" ya da başarılı taze başlat) ve kart
   * yalnızca onay ekranını gösteriyor. Bu durumda kartın üstünden mesaj göndermek "kapat" sayılmaz.
   */
  get ended(): boolean {
    return this.host !== null && this.settled;
  }

  /**
   * reason verilirse kart tur modelinden gelir: metin modelin gerekçesini ve somut bir öneriyi söyler.
   * Verilmezse görev normuna dayalı metin gösterilir.
   */
  show(
    anchor: Element,
    turns: number,
    norm: TaskNorm | null,
    actions: ExitCardActions,
    reason: Reason | null = null,
    options: ExitCardOptions = {},
  ): void {
    this.hide();
    const { host, box } = mountCard("exit-card", anchor);
    const apology = reason?.key === APOLOGY_REASON;
    const ignored = reason?.key === IGNORED_REPAIR_REASON;
    const repeat = reason?.key === JUDGE_REPEAT_ANSWERED || reason?.key === JUDGE_REPEAT_UNMET;
    const judged = reason?.key === JUDGE_REASON || repeat;
    // Aynı istek kartında henüz döngü yok: ana eylem isteği netleştirmek, kalıp önceki cevaba göre değişir.
    const clarify = reason?.key === JUDGE_REPEAT_ANSWERED ? CLARIFY_ANSWERED : reason?.key === JUDGE_REPEAT_UNMET ? CLARIFY_UNMET : CLARIFY_LOOP;
    // Elle açılan kısa sohbette "uzun sohbet" demek yanlış olur: tur sayısı normun altındaysa ya da norm
    // bilinmiyorsa kart yalnızca yeni sohbetin neden hızlı olduğunu söyler; mola önerisi de anlamsızdır.
    const manualShort = reason === null && options.manual === true && (norm === null || turns <= norm.p75_turns);
    const chip = reason
      ? apology
        ? "Aynı yerde dönüyor"
        : ignored
          ? "Düzeltme alınmadı"
          : repeat
            ? JUDGE_REPEAT_CHIP
            : judged
              ? JUDGE_CHIP
              : MODEL_CHIP
      : manualShort
        ? "Yeni sohbet"
        : "Uzun sohbet";

    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] => {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (cls) node.className = cls;
      return node;
    };
    const button = (text: string, cls: string, onClick: () => void): HTMLButtonElement => {
      const b = el("button", text, cls);
      b.type = "button";
      b.addEventListener("click", onClick);
      return b;
    };
    const row = (...children: HTMLElement[]): HTMLDivElement => {
      const r = el("div", undefined, "row");
      r.append(...children);
      return r;
    };
    const spacer = () => el("span", undefined, "spacer");
    // Escape'in hangi kapanış sayılacağı: kalıcı bir seçimden sonra (taze başlat, bir daha gösterme)
    // ek bir "kapat" sayılmasın diye o seçimin türüne döner.
    let escapeKind: ExitDismissal = "kapat";
    this.settled = false;
    const dismiss = (kind: ExitDismissal) => {
      this.hide();
      actions.onDismiss(kind);
    };

    const showMain = () => {
      const clarifyButton =
        reason && actions.onClarify
          ? button(clarify.label, repeat ? "" : "secondary", () => {
              if (actions.onClarify?.(clarify.sentence)) dismiss("netlestir");
            })
          : null;
      const fresh = button("Taze başlat", repeat && clarifyButton ? "secondary" : "", showDraft);
      const notRelevant =
        reason && actions.onNotRelevant
          ? [button("Yerinde değildi", "link", () => {
              actions.onNotRelevant?.();
              dismiss("yerinde_degil");
            })]
          : [];
      box.replaceChildren(
        header(chip),
        el("p", reason ? modelCardMessage(reason) : manualShort ? MANUAL_SHORT_MESSAGE : exitCardMessage(turns, norm), "body"),
        ...(actions.ruleRestated?.() ? [el("p", RULE_RESTATED_NOTE, "body")] : []),
        ...(reason ? [el("p", apology ? APOLOGY_NOTE : ignored ? IGNORED_REPAIR_NOTE : judged ? JUDGE_NOTE : MODEL_NOTE, "note")] : []),
        row(
          // Yön değiştirmek için Taze başlat; aynı sohbette kalıp düzeltmek için isteği netleştirme kalıbı.
          // Aynı istek kartında netleştirme önde, mola önerisi yok (henüz döngü değil).
          ...(repeat && clarifyButton ? [clarifyButton, fresh] : [fresh, ...(clarifyButton ? [clarifyButton] : [])]),
          ...(manualShort || repeat ? [] : [button("Kısa ara ver", "secondary", showBreak)]),
          spacer(),
          ...notRelevant,
          ...(actions.onNever ? [button("Bir daha gösterme", "link", showNever)] : []),
          button("Kapat", "link", () => dismiss("kapat")),
        ),
      );
      (repeat && clarifyButton ? clarifyButton : fresh).focus();
    };

    const showNever = () => {
      escapeKind = "gosterme";
      this.settled = true;
      actions.onNever?.();
      // Kapanınca odak mesaj kutusuna dönsün diye onDismiss yolundan geçer ("gosterme" sayılmaz).
      const close = button("Kapat", "", () => dismiss("gosterme"));
      box.replaceChildren(
        header(chip),
        el("p", NEVER_MESSAGE, "body"),
        row(close),
      );
      close.focus();
    };

    const showBreak = () => {
      const close = button("Kapat", "", () => dismiss("ara"));
      box.replaceChildren(header(chip), el("p", "Tamam. Sohbet burada duruyor; hazır olduğunda kaldığın yerden devam edebilirsin.", "body"), row(close));
      close.focus();
    };

    const showDraft = () => {
      const area = el("textarea");
      area.value = actions.getDraft();
      area.setAttribute("aria-label", "Yeni sohbet taslağı");
      const note = el("p", "", "note");
      const go = button("Kopyala ve yeni sohbet aç", "", () => {
        go.disabled = true;
        void actions.onFreshStart(area.value).then((ok) => {
          if (ok) {
            // Taze başlat zaten sayıldı; bu ekrandan Escape ya da gönderim ek bir "kapat" sayılmaz.
            escapeKind = "taze";
            this.settled = true;
            box.replaceChildren(
              header(chip),
              el("p", "Panoya kopyalandı. Yeni sohbette Ctrl+V (Mac'te ⌘+V) ile yapıştırabilirsin.", "body"),
              row(button("Kapat", "", () => dismiss("taze"))),
            );
          } else {
            go.disabled = false;
            note.textContent = "Kopyalanamadı. Metni seçip kendin kopyalayabilirsin.";
          }
        });
      });
      const title = actions.focusedDraft?.()
        ? "Sohbette konu birkaç kez değişti; taslağa yalnızca son konudaki isteklerini aldım. İstersen düzenle:"
        : "İsteklerini tek taslakta topladım. İstersen düzenle:";
      box.replaceChildren(header(chip), el("p", title, "title"), area, note, row(go, spacer(), button("Geri", "link", showMain)));
      area.focus();
    };

    showMain();
    this.host = host;

    this.onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      dismiss(escapeKind);
    };
    document.addEventListener("keydown", this.onKey, true);
  }

  hide(): void {
    if (this.onKey) document.removeEventListener("keydown", this.onKey, true);
    this.onKey = null;
    this.host?.remove();
    this.host = null;
    this.settled = false;
  }
}

/**
 * Kartın ana cümlesi. Görev türü biliniyorsa WildChat'teki normu söyler
 * (o türdeki çok turlu sohbetlerin %75'i kaç turda bitiyor); bilinmiyorsa yalnızca tur sayısını.
 * Kullanıcıya "tur" yerine "mesaj" denir: bir tur, kullanıcının bir mesajı ve ona gelen cevaptır.
 */
export function exitCardMessage(turns: number, norm: TaskNorm | null): string {
  const tail =
    "Uzun sohbetlerde yapay zeka modelleri yolunu kaybedebiliyor; " +
    "isteklerini tek mesajda toplayıp yeni bir sohbet açmak genelde daha hızlı olur.";
  if (norm === null || norm.label === "Diğer") return `Bu sohbet ${turns}. mesajında. ${tail}`;
  const p75 = Math.round(norm.p75_turns);
  return `${norm.label} sohbetlerinin çoğu ${p75} mesajda ya da daha kısa sürede bitiyor; bu sohbet ${turns}. mesajında. ${tail}`;
}

/**
 * Kural yeniden hatırlatıldıysa kartın ikinci cümlesi (K48). WildFeedback'te bu anlarda memnuniyetsizlik
 * yüksek; ama yeni sohbet tek başına çözmüyor, kuralın baştan verilmesi gerekiyor.
 */
export const RULE_RESTATED_NOTE =
  "Bu sohbette bir kuralı yeniden hatırlatman gerekti. Taze başlat taslağı bu kuralı en başa koyar; yeni sohbette baştan geçerli olur.";

/**
 * Model kaynaklı kartın etiketi ve notu. Kartlarda "model" sözcüğü yalnızca sohbet yapay zekası anlamında
 * kalsın diye bizim tahmin aracımıza "tahmin" denir.
 */
export const MODEL_CHIP = `${BRAND_NAME}'ın tahmini`;
export const MODEL_NOTE =
  "Bu öneri, mesajlarına bakan ve cihazında çalışan küçük bir tahmin aracından geliyor; mesajların cihazından çıkmaz.";

/** Elle açılan ve tur sayısı normu aşmayan kartın ana cümlesi. */
export const MANUAL_SHORT_MESSAGE =
  "İsteklerini tek mesajda toplayıp yeni bir sohbet açmak, aynı yerde dönen bir sohbeti toparlamaktan genelde daha hızlı olur.";

/** "Bir daha gösterme" onayı; kullanıcıya görünen özellik adı her yerde "yeni sohbet önerisi". */
export const NEVER_MESSAGE = `Tamam, yeni sohbet önerisi bir daha gösterilmeyecek. İstersen ${BRAND_NAME} penceresindeki Ayarlar'dan yeniden açabilirsin.`;

/** Anlam desteği kartının gerekçe anahtarı (K51 taslağı); metin değerlendiriciden gelir. */
export const JUDGE_REASON = "anlam";
export const JUDGE_CHIP = "Anlam desteği";
/**
 * Aynı istek kartı (K51 taslağı): değerlendirici son mesajı daha önce sorulmuş bir isteğin yeniden sorulması
 * saydı ama henüz döngü yok. İkinci soruşta, cevaptan sonra; sohbet başına bir kez.
 */
export const JUDGE_REPEAT_ANSWERED = "anlam_tekrar_cevaplanmis";
export const JUDGE_REPEAT_UNMET = "anlam_tekrar_karsilanmamis";
export const JUDGE_REPEAT_CHIP = "Aynı istek";
/** Aynı istek kartının metni: durum ve bir soru; cevabı kullanıcı Netleştir kalıbıyla yazar. */
export const JUDGE_REPEAT_TEXT = {
  [JUDGE_REPEAT_ANSWERED]: {
    why: "Bunu az önce de sormuştun; önceki mesajınla aynı istek ve cevabı yukarıda duruyor.",
    tip: "Önceki cevaptan farklı olarak ne arıyorsun? Bunu yazmak daha hızlı sonuç verir.",
  },
  [JUDGE_REPEAT_UNMET]: {
    why: "Bunu az önce de sormuştun; önceki mesajınla aynı istek ve önceki cevap işini görmemiş olabilir.",
    tip: "Tam olarak ne eksik kaldı? Bunu yazmak aynı cevabın yeniden gelmesini önler.",
  },
} as const;
/**
 * Anlam onarımı kartının metni: kullanıcı uzun bir mesajla düzeltme istedi ve değerlendirici önceki cevabın
 * işini görmediğini söyledi. Değerlendirici kendi gerekçesini yazdıysa o kullanılır; yazmadıysa bu metin.
 */
export const JUDGE_REPAIR_TEXT = {
  why: "Son cevap istediğini karşılamamış görünüyor; aynı yerde düzeltmeye devam etmek çoğu zaman benzer bir cevap getirir.",
  tip: "İstersen tam olarak neyin eksik kaldığını tek cümleyle yaz ya da isteklerini toplayıp yeni bir sohbette dene.",
} as const;

/** Anlam desteği kartında, önerinin nereden geldiğini dürüstçe söyleyen not. */
export const JUDGE_NOTE =
  `Bu öneri, açtığın anlam desteğinden geliyor: son mesajlarının kısa bir bölümü değerlendirilmek için ${BRAND_NAME} sunucusuna gönderildi ve saklanmadı. Pencereden kapatabilirsin.`;

/** Özür döngüsü kartının gerekçe anahtarı (src/data/model-reasons.json, K32). */
export const APOLOGY_REASON = "ozur";

/** "Düzeltme alınmadı" kartının gerekçe anahtarı (src/data/model-reasons.json). */
export const IGNORED_REPAIR_REASON = "tekrar";

/** "Düzeltme alınmadı" kartında, önerinin nereden geldiğini söyleyen kısa not. */
export const IGNORED_REPAIR_NOTE =
  "Bu öneri, son iki cevabın başını karşılaştıran basit bir kuraldan geliyor; cevaplar cihazından çıkmıyor.";

/** Özür döngüsü kartında, önerinin nereden geldiğini söyleyen kısa not. */
export const APOLOGY_NOTE =
  "Bu öneri, yapay zekanın son cevaplarının nasıl başladığına bakan basit bir kuraldan geliyor; cevaplar cihazından çıkmıyor.";

/**
 * Gerekçenin kendi önerisi (tip) yeni sohbeti destekleyen gerekçeler. Kartın tek ana eylemi "Taze başlat"
 * olduğu için öbür gerekçelerin tip'i (aynı sohbette düzeltmeyi öneren cümleler) kartta çelişki yaratır;
 * onlarda tip yerine FRESH_START_TIP gösterilir. Liste yalnızca burada tutulur ve testle sabitlenir.
 */
export const FRESH_START_REASONS: readonly string[] = ["n_strong_repairs", "turn", "genel", APOLOGY_REASON, IGNORED_REPAIR_REASON];

/** Yeni sohbeti desteklemeyen gerekçelerde tip yerine gösterilen sabit cümle. */
export const FRESH_START_TIP = "İstersen isteklerini tek taslakta toplayıp yeni bir sohbette dene.";

/** Model kaynaklı kartın ana cümlesi: durum ve yeni sohbete uyan somut öneri. */
export function modelCardMessage(reason: Reason): string {
  // Anlam desteğinin önerisi bu sohbete özgü ve en değerli kısmı; sabit cümleyle değiştirilmez.
  if (reason.key === JUDGE_REASON || reason.key === JUDGE_REPEAT_ANSWERED || reason.key === JUDGE_REPEAT_UNMET) {
    return `${reason.why} ${reason.tip}`;
  }
  const tip = FRESH_START_REASONS.includes(reason.key) ? reason.tip : FRESH_START_TIP;
  return `${reason.why} ${tip}`;
}
