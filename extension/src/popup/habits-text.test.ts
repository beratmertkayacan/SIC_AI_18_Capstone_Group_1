import { describe, expect, it } from "vitest";
import type { CountsV2 } from "../core/counters";
import { DEFAULT_SETTINGS, type Settings } from "../core/settings";
import { weekReport, type WeekReport } from "../core/week-report";
import { habitSummary, muteTip, pickTip, TIP_MIN } from "./habits-text";

const WEEK = "2026-11-16";
const DAY = "2026-11-18";

/** Tek günlük sayaçlardan haftanın raporu. Anahtar biçimi counter-schema.json'daki gibi. */
function report(cells: Record<string, number>, phase = "oneri"): WeekReport {
  return weekReport({ v: 2, days: { [DAY]: { phase, c: cells } } } as unknown as CountsV2, WEEK);
}
/** 5 sohbet: öneri için gereken en az sayı. */
const FIVE = { "conversation|chatgpt|kod|4-6|orta|normal": 5 };
const S = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

describe("pickTip: öncelik sırası (her satır için bir vaka)", () => {
  it("1. kart_kapat: kartta iki kez “yerinde değildi”", () => {
    const r = report({ ...FIVE, "card_action|chatgpt|yerinde_degil": TIP_MIN.kart_kapat });
    expect(pickTip(r, S(), WEEK)).toEqual({ id: "kart_kapat", text: "İstersen yeni sohbet önerisini Ayarlar'dan kapatabilirsin; sayılar yine tutulur.", settingsLink: true });
  });

  it("1. kart_kapat kart ayarı zaten kapalıysa önerilmez", () => {
    const r = report({ ...FIVE, "card_action|chatgpt|yerinde_degil": 2 });
    expect(pickTip(r, S({ exitCardEnabled: false }), WEEK)).toBeNull();
  });

  it("2. taze_baslat: kart iki kez çıktı, Taze başlat hiç kullanılmadı", () => {
    const r = report({ ...FIVE, "card|chatgpt|kod|7-10|gosterildi_norm": 1, "card|chatgpt|kod|7-10|gosterildi_model": 1 });
    expect(pickTip(r, S(), WEEK)?.id).toBe("taze_baslat");
    expect(pickTip(r, S(), WEEK)?.text).toBe("İstersen kart bir dahaki sefere çıktığında Taze başlat'ı dene; isteklerini tek bir taslakta toplar, hatırlattığın kuralları en başa koyar.");
    // Taze başlat bir kez bile kullanıldıysa önerilmez.
    const used = report({ ...FIVE, "card|chatgpt|kod|7-10|gosterildi_norm": 2, "card_action|chatgpt|taze_baslat": 1 });
    expect(pickTip(used, S(), WEEK)).toBeNull();
  });

  it("3. kisa_duzeltme: kısa düzeltme şeridi üç kez", () => {
    const r = report({ ...FIVE, "strip|chatgpt|kod|gosterildi_kisa": 3 });
    expect(pickTip(r, S(), WEEK)?.text).toBe("İstersen “olmadı” yazarken neyin olmadığını da bir cümleyle ekle; model neyi düzelteceğini daha kolay anlar.");
  });

  it("4. yon_sende: Yön sende iki kez çıktı, iki düğme de kullanılmadı", () => {
    const r = report({ ...FIVE, "hint|chatgpt|kod|gosterildi": 2 });
    expect(pickTip(r, S(), WEEK)?.text).toBe("İstersen modelin teklif sorusuna “evet” demek yerine bir sonraki adımı kendin yaz.");
    expect(pickTip(report({ ...FIVE, "hint|chatgpt|kod|gosterildi": 2, "hint|chatgpt|kod|adim_yaz": 1 }), S(), WEEK)).toBeNull();
  });

  it("5. gorev_<tür>: benzer mesaj şeridinin en çok çıktığı görev, en az 3", () => {
    const r = report({ ...FIVE, "strip|chatgpt|yazma|gosterildi": 3, "strip|gemini|kod|gosterildi": 2 });
    expect(pickTip(r, S(), WEEK)?.id).toBe("gorev_yazma");
    expect(pickTip(r, S(), WEEK)?.text).toMatch(/^İstersen tonu/);
    expect(pickTip(report({ ...FIVE, "strip|chatgpt|yazma|gosterildi": 2 }), S(), WEEK)).toBeNull();
    // Eşitlikte bilinen tür "Diğer"in önüne geçer.
    expect(pickTip(report({ ...FIVE, "strip|chatgpt|diger|gosterildi": 3, "strip|chatgpt|ozet|gosterildi": 3 }), S(), WEEK)?.id).toBe("gorev_ozet");
  });

  it("birden çok koşul tutsa da en fazla bir öneri: en yüksek öncelikli olan", () => {
    const r = report({
      ...FIVE,
      "card_action|chatgpt|yerinde_degil": 2,
      "card|chatgpt|kod|7-10|gosterildi_norm": 3,
      "strip|chatgpt|kod|gosterildi_kisa": 4,
      "hint|chatgpt|kod|gosterildi": 3,
      "strip|chatgpt|kod|gosterildi": 5,
    });
    const tip = pickTip(r, S(), WEEK);
    expect(tip?.id).toBe("kart_kapat");
    expect(Array.isArray(tip)).toBe(false);
  });
});

describe("pickTip: ön koşullar", () => {
  const busy = { "strip|chatgpt|kod|gosterildi_kisa": 3 };

  it("5'ten az sohbette öneri yok", () => {
    expect(pickTip(report({ "conversation|chatgpt|kod|4-6|orta|normal": 4, ...busy }), S(), WEEK)).toBeNull();
  });

  it("öneriler kapalı (yalnızca say), eklenti kapalı ya da haftalık özet kapalıysa öneri yok", () => {
    const r = report({ ...FIVE, ...busy });
    expect(pickTip(r, S({ suggestionsEnabled: false }), WEEK)).toBeNull();
    expect(pickTip(r, S({ enabled: false }), WEEK)).toBeNull();
    expect(pickTip(r, S({ habitsEnabled: false }), WEEK)).toBeNull();
  });

  it("yalnızca say modunda yazılan günler (phase: sayim) şerit üretmez; öneri de çıkmaz", () => {
    // Sayım modunda şerit gösterilmez, yalnızca gizlendi_sayim yazılır.
    const r = report({ ...FIVE, "strip|chatgpt|kod|tetiklendi": 4, "strip|chatgpt|kod|gizlendi_sayim": 4 }, "sayim");
    expect(pickTip(r, S({ suggestionsEnabled: false }), WEEK)).toBeNull();
    expect(pickTip(r, S(), WEEK)).toBeNull();
  });

  it("KİŞİSEL SOHBET: yalnızca conversation dongu, loop_end ve signal dolu bir hafta öneri üretmez", () => {
    // Kişisel sohbette şerit, kart ve Yön sende gösterilmez (gizlendi_kisisel); ama bu üç sayaç yazılır.
    const r = report({
      "conversation|chatgpt|diger|11+|uzun|dongu": 12,
      "loop_end|chatgpt|diger|11+|birakildi": 9,
      "loop_end|chatgpt|diger|11+|toparlandi": 3,
      "signal|chatgpt|diger|kural_hatirlatildi": 6,
      "signal|chatgpt|diger|duzeltme_alinmadi": 6,
      "signal|chatgpt|diger|ozur_dongusu": 6,
      "strip|chatgpt|diger|gizlendi_kisisel": 8,
      "card|chatgpt|diger|11+|gizlendi_kisisel": 8,
    });
    expect(r.enough).toBe(true);
    expect(pickTip(r, S(), WEEK)).toBeNull();
  });
});

describe("susturma", () => {
  const r = report({ ...FIVE, "strip|chatgpt|kod|gosterildi_kisa": 3, "strip|chatgpt|kod|gosterildi": 3 });

  it("Yerinde değildi: 4 hafta gösterilmez; o hafta yerine başka öneri gelmez", () => {
    const muted = muteTip({}, "kisa_duzeltme", WEEK, "yerinde_degil");
    expect(muted).toEqual({ kisa_duzeltme: { since: WEEK, weeks: 4 } });
    // Aynı hafta: kod ipucu da koşulu tutuyor ama gelmez.
    expect(pickTip(r, S({ mutedTips: muted }), WEEK)).toBeNull();
    // Sonraki üç hafta: kisa_duzeltme susuyor, sıradaki (kod ipucu) gelebilir.
    for (const w of ["2026-11-23", "2026-11-30", "2026-12-07"]) expect(pickTip(r, S({ mutedTips: muted }), w)?.id).toBe("gorev_kod");
    // Beşinci hafta: yeniden gösterilebilir.
    expect(pickTip(r, S({ mutedTips: muted }), "2026-12-14")?.id).toBe("kisa_duzeltme");
  });

  it("Kapat: yalnızca bu hafta; gelecek hafta aynı öneri dönebilir", () => {
    const muted = muteTip({}, "kisa_duzeltme", WEEK, "kapat");
    expect(muted).toEqual({ kisa_duzeltme: { since: WEEK, weeks: 1 } });
    expect(pickTip(r, S({ mutedTips: muted }), WEEK)).toBeNull();
    expect(pickTip(r, S({ mutedTips: muted }), "2026-11-23")?.id).toBe("kisa_duzeltme");
  });

  it("süresi geçmiş kayıtlar yeni susturmada atılır", () => {
    const old = { taze_baslat: { since: "2026-09-07", weeks: 4 }, yon_sende: { since: "2026-11-09", weeks: 4 } };
    expect(muteTip(old, "gorev_kod", WEEK, "kapat")).toEqual({ yon_sende: { since: "2026-11-09", weeks: 4 }, gorev_kod: { since: WEEK, weeks: 1 } });
  });
});

describe("habitSummary", () => {
  it("veri yok", () => {
    const h = habitSummary(report({}));
    expect(h.state).toBe("bos");
    expect(h.total).toBe("Henüz biten bir sohbet yok.");
    expect(h.note).toBe("Bir sohbeti bitirdiğinde ya da sekmeyi kapattığında burada görünür.");
    expect(habitSummary(report({}), { restartedToday: true }).total).toBe("Özet bugün yeniden başladı.");
  });

  it("az veri: yalnızca satır 1 ve 4", () => {
    const h = habitSummary(report({ "conversation|chatgpt|kod|4-6|orta|normal": 3, "loop_end|chatgpt|kod|4-6|toparlandi": 3, "repair_button|chatgpt|kod|format": 2 }));
    expect(h).toMatchObject({ state: "az", total: "3 sohbet bitti.", loops: null, moves: null, previous: null, kafi: "Kâfi AI araya girmedi." });
    expect(h.note).toBe("Bir şey önermek için en az 5 sohbet gerekiyor.");
  });

  it("dolu hafta: takılınca nasıl bitti (nötr satır en sonda), hamleler, şeffaflık", () => {
    const h = habitSummary(report({
      "conversation|chatgpt|kod|4-6|orta|normal": 14,
      "loop_end|chatgpt|kod|4-6|birakildi": 1,
      "loop_end|chatgpt|kod|4-6|toparlandi": 2,
      "loop_end|chatgpt|kod|4-6|yeni_sohbet": 1,
      "repair_button|chatgpt|kod|format": 3,
      "repair_button|chatgpt|kod|info": 2,
      "hint|chatgpt|kod|adim_yaz": 1,
      "hint|chatgpt|kod|gosterildi": 1,
      "card_action|chatgpt|taze_baslat": 2,
      "strip|chatgpt|kod|gosterildi": 6,
      "card|chatgpt|kod|7-10|gosterildi_norm": 2,
      "strip_action|chatgpt|yerinde_degil": 1,
      "card_action|chatgpt|yerinde_degil": 1,
    }));
    expect(h.loops).toEqual({
      intro: "4 sohbet aynı yerde dönmeye başladı.",
      rows: [
        { label: "Aynı sohbette yolunu buldun", n: 2, quiet: false },
        { label: "Yeni sohbete geçtin", n: 1, quiet: false },
        { label: "Sohbetten çıktın", n: 1, quiet: true },
      ],
    });
    expect(h.moves).toBe("5 kez eksik olanı bir cümleyle ekledin, 1 kez bir sonraki adımı kendin yazdın, 2 kez Taze başlat'ı kullandın.");
    expect(h.kafi).toBe("Kâfi AI 9 kez araya girdi; 2'sinde “yerinde değildi” dedin.");
  });

  it("3'ten az döngüde yalnızca tek cümle; sıfır olan hamle yazılmaz", () => {
    const h = habitSummary(report({ ...FIVE, "loop_end|chatgpt|kod|4-6|birakildi": 2, "strip_action|chatgpt|duzenle": 1 }));
    expect(h.loops).toEqual({ intro: "2 sohbet aynı yerde dönmeye başladı.", rows: [] });
    expect(h.moves).toBe("1 kez mesajını düzenledin.");
    expect(habitSummary(report(FIVE)).moves).toBeNull();
    expect(habitSummary(report(FIVE)).loops).toBeNull();
  });

  it("geçen hafta: yalnızca 5 ve üstüyse düz sayı; en eski haftada hiç", () => {
    const days = {
      "2026-11-10": { phase: "oneri", c: { "conversation|chatgpt|kod|4-6|orta|normal": 11 } },
      [DAY]: { phase: "oneri", c: FIVE },
    };
    const r = weekReport({ v: 2, days } as unknown as CountsV2, WEEK);
    expect(habitSummary(r).previous).toBe("Geçen hafta 11 sohbet bitmişti.");
    expect(habitSummary(r, { comparable: false }).previous).toBeNull();
    expect(habitSummary(report(FIVE)).previous).toBeNull();
  });

  it("hiçbir cümlede yüzde, yön ya da puan sözcüğü yok", () => {
    const h = habitSummary(report({ ...FIVE, "loop_end|chatgpt|kod|4-6|toparlandi": 5, "strip|chatgpt|kod|gosterildi": 3 }));
    const all = JSON.stringify(h).toLowerCase();
    for (const bad of ["%", "puan", "seri", "rozet", "ödül", "sıralama", "daha az", "daha çok", "risk", "bağımlı", "uyarı", "dönmeye başladın"]) expect(all).not.toContain(bad);
  });
});
