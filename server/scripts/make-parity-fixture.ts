// Parite fikstürü: girdiler burada elle yazılır, beklenen çıktılar sunucu kodundan üretilir.
// Python ikizi (src/kafiai/judge.py) aynı dosyayla sınanır. Çalıştırma: npm run parity-fixture
import { writeFileSync } from "node:fs";
import { kararDuzelt, sohbetMetni, turlariAl, type Karar } from "../lib/judge.ts";

const uzun = "Kod çalışmıyor 🙃 ".repeat(70); // 1.000 ve 803 sınırını aşar, emoji UTF-16 sayımını sınar
const govdeler: unknown[] = [
  { turlar: [{ rol: "k", metin: "Türkiye'nin başkenti neresi?" }] },
  { turlar: [{ rol: "k", metin: "bir" }, { rol: "a", metin: "iki" }, { rol: "k", metin: "üç" }, { rol: "a", metin: "dört" }] },
  { turlar: [{ rol: "k", metin: uzun }, { rol: "a", metin: uzun }] },
  { turlar: Array.from({ length: 18 }, (_, i) => ({ rol: i % 2 ? "a" : "k", metin: `${i}. mesaj` })) },
  { turlar: [{ rol: "a", metin: "yalnız asistan" }] },
  { turlar: [{ rol: "k", metin: 5 }] },
  { yok: true },
];
const taban: Karar = {
  ayni_istek: true, onceki_istek_turu: 1, onceki_cevap_karsiladi: "hayir", tikanma: true, ozur_dongusu: false,
  tur: "karsilanmayan_engel", dongu: true, guven: 0.8, gerekce: "", oneri: "",
};
const kararlar: Karar[] = [
  { ...taban, gerekce: "  Aynı hata üçüncü kez geldi.  ", oneri: "İstersen hata metninin tamamını tek mesajda paylaş." },
  { ...taban, guven: 1.7, gerekce: "ç".repeat(300), oneri: "İstersen " + "ğ🙂".repeat(200) },
  { ...taban, dongu: false, guven: -0.2, gerekce: "silinmeli", oneri: "silinmeli" },
];

const fixture = {
  not: "server/scripts/make-parity-fixture.ts üretir; elle değiştirilmez.",
  govde: govdeler.map((g) => {
    const t = turlariAl(g);
    return { girdi: g, turlar: t, metin: t ? sohbetMetni(t) : null };
  }),
  karar: kararlar.map((k) => ({ girdi: k, cikti: kararDuzelt(k) })),
};
writeFileSync(new URL("../../tests/fixtures/judge_parity.json", import.meta.url), JSON.stringify(fixture, null, 1) + "\n");
console.log("tests/fixtures/judge_parity.json yazıldı");
