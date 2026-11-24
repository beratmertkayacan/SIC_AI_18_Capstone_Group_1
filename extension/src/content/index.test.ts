// @vitest-environment jsdom
/**
 * İçerik betiğinin uçtan uca senaryoları: sahte adaptörle mesaj gönderilir, cevap biter, düğmelere basılır
 * ve sayaçların her kararı tam bir kez saydığı denetlenir. Haftalık özet ve öneriler bu sayılardan
 * hesaplandığı için çift sayım ya da eksik "tetiklendi" doğrudan yanlış bir özete dönüşür.
 */
import { afterAll, describe, expect, it, vi } from "vitest";
import { bootScenario, teardownScenario, type Scenario } from "./scenario-harness";

const Q = "Bu fonksiyonu Python ile yazar mısın lütfen bana, liste sıralasın";
const PERSONAL = "Sevgilimden ayrıldım ve kendimi çok kötü hissediyorum, ne yapmalıyım bilmiyorum";

/** Soruyla biten cevaplara üç kısa onay ("evet" ×3). */
function affirmChain(s: Scenario, first = Q): void {
  s.send(first);
  s.respond("İşte kod. Test de ekleyeyim mi?");
  s.send("evet");
  s.respond("Ekledim. Belge de yazayım mı?");
  s.send("evet");
  s.respond("Yazdım. Örnek de ekleyeyim mi?");
  s.send("evet");
  s.respond("Ekledim. Grafik de çizeyim mi?");
}

/** Cevaplar üst üste özürle başlar: özür kartı açılır. */
function apologyCard(s: Scenario): void {
  s.send(Q);
  s.respond("Özür dilerim, haklısınız.");
  s.send("Bu sefer sıralamayı tersten yap ve açıklama ekle lütfen");
  s.respond("Özür dilerim, haklısınız. İşte yeni kod.");
}

/** Bir olayın bütün ayrıntılarının toplamı. */
const total = (c: Record<string, number>, event: string) =>
  Object.entries(c).reduce((sum, [k, n]) => (k.startsWith(`${event}|`) ? sum + n : sum), 0);

// Son senaryonun açık kalan şeridi ya da kartı ve zamanlayıcıları çalışmaya devam etmesin.
afterAll(teardownScenario);

describe("içerik betiği: şerit sayımı", () => {
  for (const [label, action] of [
    ["Yine de gönder", "yine_de_gonder"],
    ["Yerinde değildi, gönder", "yerinde_degil"],
    ["Kapat", "duzenle"],
  ] as const) {
    it(`tek benzer gönderim: şerit bir kez tetiklenir ve gösterilir, "${label}" bir kez sayılır`, async () => {
      const s = await bootScenario();
      s.send(Q);
      s.respond("Tamam, işte kod.");
      expect(s.send(Q)).toBe(true);
      expect(s.visible("strip")).toBe(true);
      expect(s.click("strip", label)).toBe(true);
      if (action !== "duzenle") s.sendHeld(Q);
      await s.end();
      const c = s.counts();
      expect(c["strip|tetiklendi"]).toBe(1);
      expect(c["strip|gosterildi"]).toBe(1);
      expect(c[`strip_action|${action}`]).toBe(1);
      expect(total(c, "strip_action")).toBe(1);
      expect(s.calls.submitHeld).toBe(action === "duzenle" ? 0 : 1);
    });
  }

  it("H4: şerit açıkken aynı mesaj için yeniden Enter ikinci kez saymaz, şerit görünür kalır", async () => {
    const s = await bootScenario();
    s.send(Q);
    s.respond("Tamam.");
    expect(s.send(Q)).toBe(true);
    expect(s.send(Q)).toBe(true); // kullanıcı kutuya dönüp yine Enter'a bastı
    expect(s.visible("strip")).toBe(true);
    await s.end();
    const c = s.counts();
    expect(c["strip|tetiklendi"]).toBe(1);
    expect(c["strip|gosterildi"]).toBe(1);
  });

  it("H4: kısa onarım şeridi aynı turda Kapat sonrası yeniden çıkmaz", async () => {
    const s = await bootScenario();
    s.send(Q);
    s.respond("Tamam.");
    expect(s.send("olmadı")).toBe(true);
    expect(s.click("strip", "Kapat")).toBe(true);
    expect(s.send("olmadı")).toBe(false); // aynı tur: şerit yok, mesaj gider
    await s.end();
    const c = s.counts();
    expect(c["strip|tetiklendi_kisa"]).toBe(1);
    expect(c["strip|gosterildi_kisa"]).toBe(1);
    expect(c["send|kisa_onarim"]).toBe(1);
  });

  it("şeritteki 'Yeni sohbete geç' kısa sohbette 'Yeni sohbet' kartını mola önermeden açar (C3)", async () => {
    const s = await bootScenario();
    s.send(Q);
    s.respond("Tamam.");
    s.send(Q);
    s.click("strip", "Yine de gönder");
    s.sendHeld(Q);
    s.respond("Tamam.");
    expect(s.send(Q)).toBe(true);
    expect(s.click("strip", "Yeni sohbete geç")).toBe(true);
    expect(s.visible("exit-card")).toBe(true);
    expect(s.text("exit-card")).toContain("Yeni sohbet");
    expect(s.text("exit-card")).not.toContain("Uzun sohbet");
    expect(s.click("exit-card", "Kısa ara ver")).toBe(false);
    await s.end();
    expect(s.counts()["card|gosterildi_elle"]).toBe(1);
  });
});

describe("içerik betiği: onay zinciri önerisi (Yön sende)", () => {
  it("H1: soruyla biten cevaplara 'evet' ×3 kısa tekrar şeridi değil öneri getirir", async () => {
    const s = await bootScenario();
    affirmChain(s);
    expect(s.visible("strip")).toBe(true);
    expect(s.text("strip")).not.toBe("");
    await s.end();
    const c = s.counts();
    expect(c["strip|tetiklendi_tekrar"]).toBeUndefined();
    expect(c["strip|gosterildi_tekrar"]).toBeUndefined();
    expect(c["hint|tetiklendi"]).toBe(1);
    expect(c["hint|gosterildi"]).toBe(1);
    expect(c["send|kisa"]).toBe(3);
  });

  it("B2: öneri gösterildikten sonra yeni onaylar ikinci kez tetiklemez", async () => {
    const s = await bootScenario();
    affirmChain(s);
    s.click("strip", "Kapat");
    s.send("evet");
    s.respond("Tamam. Başka bir şey ekleyeyim mi?");
    await s.end();
    const c = s.counts();
    expect(c["hint|tetiklendi"]).toBe(1);
    expect(c["hint|gosterildi"]).toBe(1);
    expect(c["hint|kapat"]).toBe(1);
  });
});

describe("içerik betiği: öneri gösterilmeyen durumlar", () => {
  it("kişisel sohbet: şerit, kart ve öneri çıkmaz; gizlendi_kisisel sayılır", async () => {
    const s = await bootScenario();
    s.send(PERSONAL);
    s.respond("Özür dilerim, bunu duyduğuma üzüldüm.");
    expect(s.send(PERSONAL)).toBe(false);
    s.respond("Özür dilerim, haklısınız. Konuşmak ister misin?");
    s.send("evet");
    s.respond("Anlatır mısın?");
    s.send("tamam");
    s.respond("Nefes egzersizi yapalım mı?");
    s.send("olur");
    s.respond("Başlayalım mı?");
    expect(s.visible("strip")).toBe(false);
    expect(s.visible("exit-card")).toBe(false);
    await s.end();
    const c = s.counts();
    expect(c["strip|gizlendi_kisisel"]).toBeGreaterThanOrEqual(1);
    expect(c["card|gizlendi_kisisel"]).toBe(1);
    expect(c["hint|tetiklendi"]).toBe(1);
    expect(c["hint|gizlendi_kisisel"]).toBe(1);
    for (const key of Object.keys(c)) expect(key).not.toMatch(/gosterildi/);
  });

  it("yalnızca say: hiçbir şey gösterilmez, her tetiklenme gizlendi_sayim ile eşleşir", async () => {
    const s = await bootScenario({ suggestionsEnabled: false });
    s.send(Q);
    s.respond("Özür dilerim, haklısınız.");
    s.send(Q);
    s.respond("Özür dilerim, haklısınız.");
    affirmChain(s, "Şimdi bunu JavaScript'e çevirir misin, aynı mantıkla olsun");
    expect(s.visible("strip")).toBe(false);
    expect(s.visible("exit-card")).toBe(false);
    await s.end();
    const c = s.counts();
    expect(c["strip|tetiklendi"]).toBe(1);
    expect(c["strip|gizlendi_sayim"]).toBe(1);
    expect(c["card|gizlendi_sayim"]).toBeGreaterThanOrEqual(1);
    expect(c["hint|tetiklendi"]).toBe(1);
    expect(c["hint|gizlendi_sayim"]).toBe(1);
    for (const key of Object.keys(c)) expect(key).not.toMatch(/gosterildi/);
    expect(s.phases()).toEqual(["sayim"]);
  });
});

describe("içerik betiği: çıkış kartı sayımı", () => {
  it("H2: 'Yerinde değildi' yalnızca yerinde_degil yazar, ek kapat yazmaz", async () => {
    const s = await bootScenario();
    apologyCard(s);
    expect(s.visible("exit-card")).toBe(true);
    expect(s.click("exit-card", "Yerinde değildi")).toBe(true);
    expect(s.visible("exit-card")).toBe(false);
    expect(s.calls.focusComposer).toBe(1);
    await s.end();
    const c = s.counts();
    expect(c["card_action|yerinde_degil"]).toBe(1);
    expect(total(c, "card_action")).toBe(1);
  });

  it("H3: taze başlat kopyalandıktan sonra Escape ek kapat saymaz", async () => {
    const s = await bootScenario();
    apologyCard(s);
    s.click("exit-card", "Taze başlat");
    s.click("exit-card", "Kopyala ve yeni sohbet aç");
    await new Promise((r) => setTimeout(r, 10));
    expect(s.text("exit-card")).toContain("Panoya kopyalandı");
    s.escape();
    expect(s.visible("exit-card")).toBe(false);
    await s.end();
    const c = s.counts();
    expect(c["card_action|taze_baslat"]).toBe(1);
    expect(total(c, "card_action")).toBe(1);
    expect(c["loop_end|yeni_sohbet"]).toBe(1);
  });

  it("H3: taze başlat kopyalandıktan sonra eski sohbette gönderim ek kapat saymaz", async () => {
    const s = await bootScenario();
    apologyCard(s);
    s.click("exit-card", "Taze başlat");
    s.click("exit-card", "Kopyala ve yeni sohbet aç");
    await new Promise((r) => setTimeout(r, 10));
    s.send("Peki o zaman sadece açıklamayı kısalt, kodu bırak");
    expect(s.visible("exit-card")).toBe(false);
    await s.end();
    const c = s.counts();
    expect(c["card_action|taze_baslat"]).toBe(1);
    expect(total(c, "card_action")).toBe(1);
  });

  it("kart yok sayılıp mesaj gönderilirse bir kez kapat sayılır", async () => {
    const s = await bootScenario();
    apologyCard(s);
    s.send("Peki o zaman sadece açıklamayı kısalt, kodu bırak");
    await s.end();
    expect(s.counts()["card_action|kapat"]).toBe(1);
  });

  it("C7: 'Bir daha gösterme' sonrası Kapat odağı mesaj kutusuna verir, ek kapat saymaz", async () => {
    const s = await bootScenario();
    apologyCard(s);
    expect(s.click("exit-card", "Bir daha gösterme")).toBe(true);
    expect(s.text("exit-card")).toContain("yeni sohbet önerisi bir daha gösterilmeyecek");
    expect(s.click("exit-card", "Kapat")).toBe(true);
    expect(s.calls.focusComposer).toBe(1);
    await s.end();
    const c = s.counts();
    expect(c["card_action|bir_daha_gosterme"]).toBe(1);
    expect(total(c, "card_action")).toBe(1);
    expect((s.store.get("kafiai.settings") as { exitCardEnabled: boolean }).exitCardEnabled).toBe(false);
  });
});

describe("içerik betiği: sohbet sonu", () => {
  it("loop_end gezinme ve iki kez sayfa kapanışında yalnızca bir kez sayılır", async () => {
    const s = await bootScenario();
    s.send(Q);
    s.respond("Tamam.");
    s.send(Q);
    s.click("strip", "Yine de gönder");
    s.sendHeld(Q);
    s.respond("Tamam.");
    await s.navigate("/c/zzzzzzzz9999");
    await s.end();
    await s.end();
    const c = s.counts();
    expect(total(c, "loop_end")).toBe(1);
    expect(total(c, "conversation")).toBe(1);
  }, 10000);
});

describe("içerik betiği: eklenti yeniden yüklendi, sekme yenilenmedi", () => {
  it("çökmez: açık öneri kapanır, bir kez 'sekmeyi yenile' der, sonra hiçbir şey bekletmez", async () => {
    const s = await bootScenario();
    s.send(Q);
    s.respond("Tamam, işte kod.");
    expect(s.send(Q)).toBe(true);
    expect(s.visible("strip")).toBe(true);
    const log = vi.spyOn(console, "log");
    // Eklenti yeniden yüklenince eski sekmede chrome.runtime.id boşalır.
    delete (globalThis as unknown as { chrome: { runtime: { id?: string } } }).chrome.runtime.id;
    expect(() => s.send("Bu sefer sıralamayı tersten yap ve açıklama ekle lütfen")).not.toThrow();
    expect(s.visible("strip")).toBe(false);
    expect(s.send(Q)).toBe(false);
    expect(() => s.respond("Tamam.")).not.toThrow();
    const lines = log.mock.calls.map((c) => String(c[0])).filter((l) => l.includes("Sekmeyi yenilediğinde"));
    expect(lines).toHaveLength(1);
    log.mockRestore();
  });
});

describe("içerik betiği: aynı istek kartı (anlam desteği, K51 taslağı)", () => {
  const verdict = (ayni: boolean, karsiladi: "evet" | "hayir") => ({
    sonuc: {
      ayni_istek: ayni, onceki_istek_turu: ayni ? 1 : -1, onceki_cevap_karsiladi: karsiladi, tikanma: false, ozur_dongusu: false,
      tur: ayni ? "ayni_istek_yeniden" : "yok", dongu: false, guven: 0.6, gerekce: "", oneri: "",
    },
  });
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("ikinci soruşta, cevaptan sonra 'Bunu az önce de sormuştun' kartı çıkar; Netleştir kalıbı ekler; sohbette bir kez", async () => {
    const s = await bootScenario({ semanticEnabled: true }, "/c/abcdef123456", (turlar) =>
      verdict(turlar.filter((t) => t.rol === "k").length >= 2, "evet"),
    );
    s.send("yeşilayın kuruluş yılı nedir");
    s.respond("Yeşilay, 5 Mart 1920 tarihinde İstanbul'da kurulmuştur.");
    await flush();
    expect(s.visible("exit-card")).toBe(false);
    s.send("yeşilay ne zaman kuruldu");
    s.respond("Yeşilay, 5 Mart 1920 tarihinde kurulmuştur.");
    await flush();
    expect(s.visible("exit-card")).toBe(true);
    expect(s.text("exit-card")).toContain("Bunu az önce de sormuştun");
    expect(s.text("exit-card")).toContain("Önceki cevaptan farklı olarak ne arıyorsun?");
    expect(s.click("exit-card", "Netleştir")).toBe(true);
    expect(s.visible("exit-card")).toBe(false);
    // Üçüncü soruşta ikinci kez çıkmaz (sohbet başına bir kez).
    s.send("yeşilayın ilk günü ne zaman");
    s.respond("Yeşilay'ın kuruluş günü 5 Mart 1920'dir.");
    await flush();
    expect(s.visible("exit-card")).toBe(false);
    await s.end();
    expect(s.counts()["card|gosterildi_anlam"]).toBe(1);
    expect(s.counts()["card_action|netlestir"]).toBe(1);
  });

  it("anlam desteği kapalıyken değerlendiriciye sorulmaz ve kart çıkmaz", async () => {
    let asked = 0;
    const s = await bootScenario({ semanticEnabled: false }, "/c/abcdef123456", () => {
      asked += 1;
      return verdict(true, "evet");
    });
    s.send("tavuk kaç bacaklıdır");
    s.respond("Tavuk 2 bacaklıdır.");
    s.send("tavuğun bacak sayısı?");
    s.respond("Tavuğun 2 bacağı vardır.");
    await flush();
    expect(asked).toBe(0);
    expect(s.visible("exit-card")).toBe(false);
  });
});
