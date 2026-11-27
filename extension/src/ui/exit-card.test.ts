// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import reasonTable from "../data/model-reasons.json";
import {
  ExitCard,
  exitCardMessage,
  FRESH_START_REASONS,
  FRESH_START_TIP,
  MANUAL_SHORT_MESSAGE,
  MODEL_CHIP,
  MODEL_NOTE,
  modelCardMessage,
  NEVER_MESSAGE,
} from "./exit-card";

function shadowOf(): ShadowRoot {
  return document.querySelector<HTMLElement>('[data-kafiai="exit-card"]')!.shadowRoot!;
}
/** Kartın görünen metni (stil öğesinin içindeki CSS hariç). */
function visibleText(): string {
  return shadowOf().querySelector(".strip")!.textContent ?? "";
}
function buttonByText(text: string): HTMLButtonElement {
  return Array.from(shadowOf().querySelectorAll("button")).find((b) => b.textContent === text)!;
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function actions(copied = true) {
  return {
    getDraft: vi.fn(() => "1. ilk istek\n2. ikinci istek"),
    onFreshStart: vi.fn().mockResolvedValue(copied),
    onDismiss: vi.fn(),
  };
}

describe("ExitCard", () => {
  const card = new ExitCard();
  afterEach(() => card.hide());

  it("tur sayısını söyler ve üç düğme sunar", () => {
    card.show(document.body, 7, null, actions());
    expect(visibleText()).toContain("Bu sohbet 7. mesajında.");
    for (const label of ["Taze başlat", "Kısa ara ver", "Kapat"]) expect(buttonByText(label)).toBeTruthy();
  });

  it("doğrulanmamış istatistik veya yargılayıcı söz içermez", () => {
    card.show(document.body, 7, null, actions());
    const text = visibleText().toLowerCase();
    for (const bad of ["bağımlı", "risk", "tehlike", "çoğu", "%"]) expect(text).not.toContain(bad);
  });

  it("'Kapat' kartı kapatır ve bildirir", () => {
    const a = actions();
    card.show(document.body, 7, null, a);
    buttonByText("Kapat").click();
    expect(a.onDismiss).toHaveBeenCalledWith("kapat");
    expect(card.visible).toBe(false);
  });

  it("Escape kartı kapatır", () => {
    const a = actions();
    card.show(document.body, 7, null, a);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(a.onDismiss).toHaveBeenCalledWith("kapat");
    expect(card.visible).toBe(false);
  });

  it("'Kısa ara ver' sakin bir cümle gösterir, baskı yapmaz", () => {
    const a = actions();
    card.show(document.body, 7, null, a);
    buttonByText("Kısa ara ver").click();
    expect(visibleText()).toContain("Sohbet burada duruyor");
    expect(card.visible).toBe(true);
    buttonByText("Kapat").click();
    expect(a.onDismiss).toHaveBeenCalledWith("ara");
  });

  it("'Taze başlat' düzenlenebilir taslağı gösterir", () => {
    const a = actions();
    card.show(document.body, 7, null, a);
    buttonByText("Taze başlat").click();
    const area = shadowOf().querySelector("textarea")!;
    expect(area.value).toBe("1. ilk istek\n2. ikinci istek");
    expect(a.getDraft).toHaveBeenCalledTimes(1);
  });

  it("kullanıcının düzenlediği metin kopyalanmak üzere iletilir", async () => {
    const a = actions();
    card.show(document.body, 7, null, a);
    buttonByText("Taze başlat").click();
    shadowOf().querySelector("textarea")!.value = "düzenlenmiş taslak";
    buttonByText("Kopyala ve yeni sohbet aç").click();
    await flush();
    expect(a.onFreshStart).toHaveBeenCalledWith("düzenlenmiş taslak");
    expect(visibleText()).toContain("Panoya kopyalandı");
    buttonByText("Kapat").click();
    expect(a.onDismiss).toHaveBeenCalledWith("taze");
  });

  it("taze başlat başarılıyken Escape ek bir kapatma saymaz (H3)", async () => {
    const a = actions();
    card.show(document.body, 7, null, a);
    expect(card.ended).toBe(false);
    buttonByText("Taze başlat").click();
    buttonByText("Kopyala ve yeni sohbet aç").click();
    await flush();
    expect(card.ended).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(card.visible).toBe(false);
    expect(a.onDismiss.mock.calls).toEqual([["taze"]]);
  });

  it("kopyalama başarısız olursa kart açık kalır ve açıklar", async () => {
    const a = actions(false);
    card.show(document.body, 7, null, a);
    buttonByText("Taze başlat").click();
    buttonByText("Kopyala ve yeni sohbet aç").click();
    await flush();
    expect(card.visible).toBe(true);
    expect(visibleText()).toContain("Kopyalanamadı");
    expect(buttonByText("Kopyala ve yeni sohbet aç").disabled).toBe(false);
    expect(a.onDismiss).not.toHaveBeenCalled();
  });

  it("'Geri' ana görünüme döner", () => {
    card.show(document.body, 7, null, actions());
    buttonByText("Taze başlat").click();
    buttonByText("Geri").click();
    expect(buttonByText("Taze başlat")).toBeTruthy();
  });

  it("art arda show() tek kart bırakır", () => {
    card.show(document.body, 7, null, actions());
    card.show(document.body, 8, null, actions());
    expect(document.querySelectorAll('[data-kafiai="exit-card"]').length).toBe(1);
  });
});

describe("ExitCard: Bir daha gösterme", () => {
  const card = new ExitCard();
  afterEach(() => card.hide());

  it("işlev verilmezse düğme gösterilmez", () => {
    card.show(document.body, 7, null, actions());
    expect(Array.from(shadowOf().querySelectorAll("button")).some((b) => b.textContent === "Bir daha gösterme")).toBe(false);
  });

  it("tıklanınca hemen kaydedilir, nasıl geri açılacağı söylenir", () => {
    const onNever = vi.fn();
    const a = { ...actions(), onNever };
    card.show(document.body, 7, null, a);
    buttonByText("Bir daha gösterme").click();
    expect(onNever).toHaveBeenCalledTimes(1);
    expect(visibleText()).toContain(NEVER_MESSAGE);
    expect(visibleText()).toContain("yeni sohbet önerisi bir daha gösterilmeyecek");
    expect(visibleText()).toContain("Ayarlar'dan yeniden açabilirsin");
    expect(card.visible).toBe(true);
  });

  it("onay görünümünde Kapat ve Escape ek bir kapatma sayılmaz ama odağı geri verir (C7)", () => {
    const a = { ...actions(), onNever: vi.fn() };
    card.show(document.body, 7, null, a);
    buttonByText("Bir daha gösterme").click();
    expect(card.ended).toBe(true); // üstünden gönderim de "kapat" sayılmaz
    buttonByText("Kapat").click();
    expect(card.visible).toBe(false);

    card.show(document.body, 7, null, a);
    expect(card.ended).toBe(false); // yeni kart temiz başlar
    buttonByText("Bir daha gösterme").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(card.visible).toBe(false);
    // "gosterme" sayılmaz; index.ts bu yolda yalnızca odağı mesaj kutusuna döndürür.
    expect(a.onDismiss.mock.calls).toEqual([["gosterme"], ["gosterme"]]);
  });
});

describe("exitCardMessage", () => {
  it("görev türü biliniyorsa normu söyler", () => {
    const text = exitCardMessage(9, { label: "Kod yazma ve hata ayıklama", median_turns: 3, p75_turns: 5, p90_turns: 8 });
    expect(text).toContain("Kod yazma ve hata ayıklama sohbetlerinin çoğu 5 mesajda ya da daha kısa sürede bitiyor");
    expect(text).toContain("bu sohbet 9. mesajında");
  });

  it("görev türü bilinmiyorsa ya da 'Diğer' ise yalnızca tur sayısını söyler", () => {
    expect(exitCardMessage(7, null)).toMatch(/^Bu sohbet 7\. mesajında\./);
    expect(exitCardMessage(7, { label: "Diğer", median_turns: 3, p75_turns: 5, p90_turns: 8 })).toMatch(/^Bu sohbet 7\. mesajında\./);
  });
});

describe("ExitCard model gerekçesiyle", () => {
  const card = new ExitCard();
  afterEach(() => card.hide());
  const reason = { key: "last_strong_repair", short: "kısa", why: "Son mesajında olmadı dedin.", tip: "Ne beklediğini yaz." };

  it("gerekçeyi, yeni sohbete uyan öneriyi ve tahminin cihazda çalıştığını söyler", () => {
    card.show(document.body, 3, null, actions(), reason);
    expect(visibleText()).toContain(modelCardMessage(reason));
    expect(visibleText()).toContain(MODEL_NOTE);
    expect(visibleText()).not.toContain("Bu sohbet 3. mesajında.");
  });

  it("çip ve not 'model' sözcüğünü bizim tahmin aracımız için kullanmaz (C4)", () => {
    card.show(document.body, 3, null, actions(), reason);
    expect(visibleText()).toContain("Kâfi AI'ın tahmini");
    expect(MODEL_CHIP).toBe("Kâfi AI'ın tahmini");
    expect(MODEL_NOTE).toBe(
      "Bu öneri, mesajlarına bakan ve cihazında çalışan küçük bir tahmin aracından geliyor; mesajların cihazından çıkmaz.",
    );
    expect(visibleText().toLowerCase()).not.toContain("model");
  });

  it("yeni sohbeti desteklemeyen gerekçede tip yerine sabit cümle gösterilir (C5)", () => {
    card.show(document.body, 3, null, actions(), reason);
    expect(visibleText()).toContain(`${reason.why} ${FRESH_START_TIP}`);
    expect(visibleText()).not.toContain(reason.tip);
  });

  it("'Yerinde değildi' geri bildirimi verir ve kartı kapatır", () => {
    const a = { ...actions(), onNotRelevant: vi.fn() };
    card.show(document.body, 3, null, a, reason);
    buttonByText("Yerinde değildi").click();
    expect(a.onNotRelevant).toHaveBeenCalledOnce();
    // Ek bir "kapat" sayılmasın diye kendi türüyle kapanır (H2).
    expect(a.onDismiss.mock.calls).toEqual([["yerinde_degil"]]);
    expect(card.visible).toBe(false);
  });

  it("gerekçe yoksa 'Yerinde değildi' düğmesi çıkmaz", () => {
    card.show(document.body, 7, null, { ...actions(), onNotRelevant: vi.fn() });
    expect(buttonByText("Yerinde değildi")).toBeUndefined();
  });

  it("'İsteği netleştir' boş bir kalıp ekler ve kartı kendi türüyle kapatır (K51 taslağı)", () => {
    const a = { ...actions(), onClarify: vi.fn(() => true) };
    card.show(document.body, 3, null, a, reason);
    buttonByText("İsteği netleştir").click();
    expect(a.onClarify).toHaveBeenCalledWith(expect.stringMatching(/: $/));
    expect(a.onDismiss.mock.calls).toEqual([["netlestir"]]);
    expect(card.visible).toBe(false);
  });

  it("kalıp eklenemezse kart açık kalır; gerekçesiz kartta düğme çıkmaz", () => {
    const a = { ...actions(), onClarify: vi.fn(() => false) };
    card.show(document.body, 3, null, a, reason);
    buttonByText("İsteği netleştir").click();
    expect(card.visible).toBe(true);
    card.hide();
    card.show(document.body, 7, null, { ...actions(), onClarify: vi.fn(() => true) });
    expect(buttonByText("İsteği netleştir")).toBeUndefined();
  });
});

describe("ExitCard: sohbet sinyalleri (K32)", () => {
  const card = new ExitCard();
  afterEach(() => card.hide());

  it("özür döngüsü kartı kendi etiketini ve notunu gösterir, model notunu göstermez", () => {
    const reason = { key: "ozur", short: "Cevaplar üst üste özürle başladı", why: "Son cevaplar özürle başladı.", tip: "Yeni sohbette dene." };
    card.show(document.body, 3, null, { ...actions(), onNotRelevant: vi.fn() }, reason);
    expect(visibleText()).toContain("Aynı yerde dönüyor");
    expect(visibleText()).toContain("Son cevaplar özürle başladı. Yeni sohbette dene.");
    expect(visibleText()).not.toContain(MODEL_NOTE);
    expect(buttonByText("Yerinde değildi")).toBeTruthy();
  });

  it("konu kaydıysa taslak başlığı yalnızca son konunun alındığını söyler", () => {
    card.show(document.body, 12, null, { ...actions(), focusedDraft: () => true });
    buttonByText("Taze başlat").click();
    expect(visibleText()).toContain("yalnızca son konudaki isteklerini aldım");
  });
});

describe("modelCardMessage: hangi gerekçenin önerisi kartta kalır (C5)", () => {
  const all = Object.keys((reasonTable as { reasons: Record<string, unknown> }).reasons);
  const make = (key: string) => ({ key, short: "k", why: "Durum.", tip: "Gerekçenin kendi önerisi." });

  it("yeni sohbeti destekleyen gerekçe listesi sabittir", () => {
    expect([...FRESH_START_REASONS].sort()).toEqual(["genel", "n_strong_repairs", "ozur", "tekrar", "turn"]);
    for (const key of FRESH_START_REASONS) expect(all).toContain(key);
  });

  it("listedeki gerekçeler kendi önerisini, öbürleri sabit cümleyi gösterir", () => {
    const others = [
      "first_words_log",
      "last_words_log",
      "first_lines",
      "last_lines",
      "has_code",
      "task_kod",
      "n_exact",
      "last_sim",
      "last_short",
      "last_strong_repair",
    ];
    // model-reasons.json'daki her gerekçe iki listeden birinde: yeni bir gerekçe eklenirse test hatırlatır.
    expect([...all].sort()).toEqual([...FRESH_START_REASONS, ...others].sort());
    for (const key of FRESH_START_REASONS) expect(modelCardMessage(make(key))).toBe("Durum. Gerekçenin kendi önerisi.");
    for (const key of others) expect(modelCardMessage(make(key))).toBe(`Durum. ${FRESH_START_TIP}`);
  });
});

describe("ExitCard: elle açılış (C3)", () => {
  const card = new ExitCard();
  afterEach(() => card.hide());
  const norm = { label: "Kod yazma ve hata ayıklama", median_turns: 3, p75_turns: 5, p90_turns: 8 };

  it("tur sayısı normun altında ya da eşitken 'Yeni sohbet' der ve mola önermez", () => {
    for (const turns of [2, 5]) {
      card.show(document.body, turns, norm, actions(), null, { manual: true });
      expect(visibleText()).toContain("Yeni sohbet");
      expect(visibleText()).toContain(MANUAL_SHORT_MESSAGE);
      expect(visibleText()).not.toContain("Uzun sohbet");
      expect(buttonByText("Kısa ara ver")).toBeUndefined();
      expect(buttonByText("Taze başlat")).toBeTruthy();
    }
  });

  it("norm aşıldıysa uzun sohbet metni ve mola düğmesi kalır", () => {
    card.show(document.body, 9, norm, actions(), null, { manual: true });
    expect(visibleText()).toContain("Uzun sohbet");
    expect(visibleText()).toContain(exitCardMessage(9, norm));
    expect(buttonByText("Kısa ara ver")).toBeTruthy();
  });

  it("kendiliğinden açılan kart elle seçeneği olmadan eskisi gibi davranır", () => {
    card.show(document.body, 2, norm, actions());
    expect(visibleText()).toContain("Uzun sohbet");
    expect(buttonByText("Kısa ara ver")).toBeTruthy();
  });
});
