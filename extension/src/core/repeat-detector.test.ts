import { describe, expect, it } from "vitest";
import { RepeatDetector } from "./repeat-detector";
import { similarity } from "./similarity";
import { normalizeText } from "./text";

describe("normalizeText", () => {
  it("Türkçe büyük harfleri doğru küçültür", () => {
    expect(normalizeText("İSTANBUL ILIK")).toBe("istanbul ılık");
  });
  it("noktalamayı atar, boşlukları teke indirir", () => {
    expect(normalizeText("  Merhaba,   dünya!!  ")).toBe("merhaba dünya");
  });
});

describe("similarity", () => {
  it("aynı metin 1", () => {
    expect(similarity("bu metni kısalt", "bu metni kısalt")).toBeCloseTo(1, 5);
  });
  it("küçük düzeltmeli aynı istek yüksek", () => {
    const a = normalizeText("Bu e-postayı daha resmi bir dille yeniden yaz");
    const b = normalizeText("Bu e-postayı daha resmi bir dille tekrar yazar mısın");
    expect(similarity(a, b)).toBeGreaterThan(0.6);
  });
  it("farklı konular düşük", () => {
    const a = normalizeText("Bu e-postayı daha resmi bir dille yeniden yaz");
    const b = normalizeText("İstanbul'da hafta sonu için gezilecek yerler öner");
    expect(similarity(a, b)).toBeLessThan(0.3);
  });
});

describe("RepeatDetector", () => {
  it("ilk mesaj benzer sayılmaz", () => {
    const d = new RepeatDetector();
    expect(d.check("Bu e-postayı daha resmi bir dille yeniden yaz").similar).toBe(false);
  });

  it("neredeyse aynı isteği tekrar gönderince şerit için yakalar", () => {
    const d = new RepeatDetector();
    d.remember("Bu e-postayı daha resmi bir dille yeniden yaz");
    const r = d.check("Bu e-postayı daha resmi bir dille yeniden yaz lütfen");
    expect(r.similar).toBe(true);
    expect(r.soft).toBe(true);
  });

  it("deneme sayısı yalnızca bu mesajın kendi tekrarlarını sayar", () => {
    const d = new RepeatDetector();
    d.remember("bu kodu düzelt");
    d.remember("olmadı"); // kısa mesaj saklanmaz, deneme sayısına girmez
    const uzun = "python üzerinde liste ters çevirmenin algoritma analizi ile bağlantısını anlat";
    expect(d.check(uzun).matches).toBe(0);
    d.remember(uzun);
    expect(d.check(uzun).matches).toBe(1);
    d.remember(uzun);
    expect(d.check(uzun).matches).toBe(2);
  });

  it("birebir olmayan yeniden yazımda gönderimi bekletmez, birebir tekrarda ve onarımda bekletir", () => {
    const d = new RepeatDetector();
    d.remember("Bu e-postayı daha resmi bir dille yeniden yaz");
    expect(d.check("Bu e-postayı daha resmi bir dille yeniden yaz lütfen").hold).toBe(false);
    expect(d.check("Bu e-postayı daha resmi bir dille yeniden yaz").hold).toBe(true);
    d.remember("hala hata veriyor şu kodu düzelt");
    expect(d.check("hala hata veriyor, şu kodu düzelt lütfen").hold).toBe(true);
  });

  it("farklı kelimelerle tekrarı durdurmaz, yalnızca yumuşak tekrar sayar", () => {
    const d = new RepeatDetector();
    d.remember("Bu e-postayı daha resmi bir dille yeniden yaz");
    const r = d.check("Bu e-postayı daha resmi bir dille tekrar yazar mısın");
    expect(r.similar).toBe(false);
    expect(r.soft).toBe(true);
    expect(r.score).toBeGreaterThan(0.6);
  });

  it("farklı bir konuya geçince yakalamaz", () => {
    const d = new RepeatDetector();
    d.remember("Bu e-postayı daha resmi bir dille yeniden yaz");
    expect(d.check("İstanbul'da hafta sonu için gezilecek yerler öner").similar).toBe(false);
  });

  it("kısa meşru mesajlara (devam et, evet) dokunmaz", () => {
    const d = new RepeatDetector();
    d.remember("devam et");
    const r = d.check("devam et");
    expect(r.tooShort).toBe(true);
    expect(r.similar).toBe(false);
  });

  it("yalnızca son 5 mesajı hatırlar", () => {
    const d = new RepeatDetector();
    d.remember("Python ile dosyadan satır satır veri okuma örneği göster");
    for (const t of [
      "İstanbul'da hafta sonu için gezilecek yerler öner",
      "Kırmızı mercimek çorbası tarifi ve malzeme listesi ver",
      "Almanya'ya vize başvurusu için gereken belgeleri say",
      "Gitar çalmaya yeni başlayanlar için çalışma planı hazırla",
      "Uzun yürüyüşler için rahat ayakkabı seçimi nasıl yapılır",
    ]) {
      d.remember(t);
    }
    expect(d.check("Python ile dosyadan satır satır veri okuma örneği göster").similar).toBe(false);
  });

  it("reset() geçmişi siler", () => {
    const d = new RepeatDetector();
    d.remember("Bu e-postayı daha resmi bir dille yeniden yaz");
    d.reset();
    expect(d.check("Bu e-postayı daha resmi bir dille yeniden yaz").similar).toBe(false);
  });
});

import repeatFixture from "../../../tests/fixtures/repeat_parity.json";
import { isVariation, newContent, rememberForTest } from "./repeat-detector";

describe("şerit kuralı: yeni içerik getiren mesaj tekrar sayılmaz", () => {
  it("Python ile aynı kararı verir", () => {
    for (const row of repeatFixture) {
      // Benzerliği tam eşikte olan satırlar (ör. 0,80) yalnızca new_content için tutulur; kayan nokta
      // farkı şerit kararını çevirebileceği için repeat/hold alanı taşımazlar.
      if ("repeat" in row && "hold" in row) {
        const d = new RepeatDetector();
        d.remember(row.previous);
        const r = d.check(row.new);
        expect([row.new, r.similar]).toEqual([row.new, row.repeat]);
        expect([row.new, r.hold]).toEqual([row.new, row.hold]);
      }
      expect([row.new, isVariation(row.new)]).toEqual([row.new, row.variation]);
      expect([row.new, newContent(row.new, rememberForTest(row.previous))]).toEqual([row.new, row.new_content]);
    }
  });

  it("seri işlerde şerit çıkmaz ama yumuşak tekrar sayılır", () => {
    const d = new RepeatDetector();
    d.remember("1. soruyu adım adım çöz");
    const r = d.check("2. soruyu adım adım çöz");
    expect(r.similar).toBe(false);
    expect(r.newContent).toBe(true);
    expect(r.soft).toBe(true);
  });
});

describe("varyasyon isteği: bilerek yapılan seri üretim döngü sayılmaz", () => {
  it("'sonraki soruyu sor' tekrarında şerit çıkmaz, kart için tekrar sayılmaz", () => {
    const d = new RepeatDetector();
    d.remember("sonraki soruyu sor");
    const r = d.check("sonraki soruyu sor");
    expect(r.similar).toBe(false);
    expect(r.soft).toBe(false);
    expect(r.variation).toBe(true);
  });

  it("varyasyon işareti olsa da onarım ifadesi varsa tekrar sayılır", () => {
    const d = new RepeatDetector();
    d.remember("başka bir yol göster hala çalışmıyor");
    const r = d.check("başka bir yol göster hala çalışmıyor");
    expect(r.similar).toBe(true);
    expect(r.variation).toBe(false);
  });

  it("işaretsiz birebir tekrar hâlâ benzer sayılır", () => {
    const d = new RepeatDetector();
    d.remember("bana motivasyon sözü yaz");
    expect(d.check("bana motivasyon sözü yaz").similar).toBe(true);
  });

  it("farklı bir mesajda varyasyon işaretlenmez", () => {
    const d = new RepeatDetector();
    d.remember("Python'da liste nasıl sıralanır");
    expect(d.check("başka bir şehir öner bana tatil için").variation).toBe(false);
  });

  it("İngilizce ve Türkçe işaretleri tanır", () => {
    for (const t of ["give me more ideas", "next question please", "bir tane daha yaz", "diğerlerini de listele", "farklı sorular hazırla", "devam et lütfen"]) {
      expect([t, isVariation(t)]).toEqual([t, true]);
    }
    for (const t of ["bu kodu düzelt", "aynı hata yine geldi, başka yol dene", "translate this paragraph"]) {
      expect([t, isVariation(t)]).toEqual([t, false]);
    }
  });
});

describe("şık harfleri", () => {
  it("kısa mesajda farklı şık farklı mesajdır", () => {
    const d = new RepeatDetector();
    d.remember("cevabım B şıkkı");
    expect(d.check("cevabım C şıkkı").similar).toBe(false);
    expect(d.check("cevabım B şıkkı").similar).toBe(true);
  });

  it("uzun mesajda tek harf içerik sayılmaz", () => {
    const prev = rememberForTest("give me a short summary of this article about the economy");
    expect(newContent("give me short summary of this article about the economy a", prev)).toEqual([]);
  });
});

describe("onarım sözcükleri ve klavyesiz yazım", () => {
  const nc = (yeni: string, onceki: string) => newContent(yeni, rememberForTest(onceki));

  it("'soruyorum' ve 'sordum' her yerde dolgudur", () => {
    expect(nc("Tekrar soruyorum: Fransa'nın başkenti neresi?", "Fransa'nın başkenti neresi?")).toEqual([]);
    // "sordum" ve "ama" dolgu olduğu için "olmadı" hâlâ baştaki dolgu dizisinde.
    expect(nc("Sordum ama olmadı, bu kodu düzelt", "bu kodu düzelt")).toEqual([]);
    expect(nc("Hocama proje konusunu sordum, ne cevap vereyim?", "Hocama proje konusunu sordu, ne cevap vereyim?")).toEqual([]);
  });

  it("'olmadı' yalnızca mesajın başındaki dolgu dizisinde dolgudur", () => {
    expect(nc("Olmadı, bu kodu düzelt", "bu kodu düzelt")).toEqual([]);
    expect(nc("Yine olmadi, bu kodu düzelt", "bu kodu düzelt")).toEqual([]);
    expect(nc("Deney neden başarılı olmadı, açıkla", "Deney neden başarılı oldu, açıkla")).toEqual(["olmadı"]);
    expect(nc("Olmadı, şimdi 2. soruyu çöz", "1. soruyu çöz")).toEqual(["şimdi", "2"]);
  });

  it("klavyesiz kelime Türkçe harfli karşılığıyla eşleşir, özgün yazım döner", () => {
    expect(nc("Avustralya'nin baskenti neresidir?", "Avustralya'nın başkenti neresidir?")).toEqual([]);
    expect(nc("Osmanli Imparatorlugu ne zaman kuruldu?", "Osmanlı İmparatorluğu ne zaman kuruldu?")).toEqual([]);
    expect(nc("Müşteriler tablosundan yasayan musterileri getir", "Müşteriler tablosundan yaşayan müşterileri getir")).toEqual([]);
  });

  it("iki kelime de Türkçe harfliyse düz harfte eşleşmez", () => {
    expect(nc("Kaslarımı nasıl şekillendiririm?", "Kaşlarımı nasıl şekillendiririm?")).toEqual(["kaslarımı"]);
    expect(nc("Dış kaplama fiyatları ne kadar?", "Diş kaplama fiyatları ne kadar?")).toEqual(["dış"]);
  });
});
