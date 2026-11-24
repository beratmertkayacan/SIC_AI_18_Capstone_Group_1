import { describe, expect, it } from "vitest";
import fixture from "../../../tests/fixtures/signals_parity.json";
import { apologizes, ConversationSignals, isAffirmation, isExitMessage, isNewTopic, isShortRepair, isVague, restatesRule, SHORT_REPEAT_STREAK } from "./signals";
import { isBareContinue } from "./intents";
import { normalizeText } from "./text";

describe("sohbet sinyalleri: Python ikiziyle aynı karar (parite örnekleri)", () => {
  it("özür, çıkış ve belirsiz istek kuralları", () => {
    for (const [text, expected] of fixture.units.apology as [string, boolean][]) expect([text, apologizes(text)]).toEqual([text, expected]);
    for (const [text, expected] of fixture.units.exit as [string, boolean][]) expect([text, isExitMessage(text)]).toEqual([text, expected]);
    for (const [text, expected] of fixture.units.vague as [string, boolean][]) expect([text, isVague(text)]).toEqual([text, expected]);
    for (const [text, expected] of fixture.units.short_repair as [string, boolean][]) expect([text, isShortRepair(text)]).toEqual([text, expected]);
    for (const [text, expected] of fixture.units.bare_continue as [string, boolean][]) expect([text, isBareContinue(text)]).toEqual([text, expected]);
    for (const c of fixture.units.ignored_repair) {
      const s = new ConversationSignals();
      const got = c.user.map((u, i) => {
        s.noteUser(u, { similar: false });
        s.noteAnswer(c.answers[i] ?? null);
        return s.answerIgnoredRepair;
      });
      expect([c.user, got]).toEqual([c.user, c.expected]);
    }
    for (const [text, expected] of fixture.units.affirmation as [string, boolean][]) expect([text, isAffirmation(text)]).toEqual([text, expected]);
  });

  it("kuralın yeniden hatırlatılması (K48)", () => {
    for (const [text, expected] of fixture.units.restate as [string, boolean][]) expect([text, restatesRule(text)]).toEqual([text, expected]);
    for (const c of fixture.units.restate_turns) {
      const s = new ConversationSignals();
      const got = c.user.map((user) => {
        s.noteUser(user, { similar: false });
        s.noteAnswer("...");
        return s.restatedTurns;
      });
      expect([c.user, got]).toEqual([c.user, c.expected]);
    }
  });

  it("restatedNow yalnızca son mesaj hatırlattıysa doğru", () => {
    const s = new ConversationSignals();
    s.noteUser("Bir metin yaz, emoji kullanma", { similar: false });
    s.noteUser("Söylemiştim, emoji kullanma", { similar: false });
    expect(s.restatedNow).toBe(true);
    s.noteUser("Biraz kısalt", { similar: false });
    expect(s.restatedNow).toBe(false);
  });

  it("sohbet boyunca durum aynı", () => {
    for (const conv of fixture.conversations) {
      const s = new ConversationSignals();
      conv.user.forEach((user, i) => {
        s.noteUser(user, { similar: conv.similar[i] ?? false });
        s.noteAnswer(conv.answers[i] ?? null);
        expect([user, {
          recent_similar: s.recentSimilar,
          apology: s.apologyStreak,
          vague: s.vagueStreak,
          segments: s.segments,
          segment_start: s.segmentStart,
          exited: s.exited,
          short_repeat: s.shortRepeatStreak,
          short_repair: s.shortRepair,
        }]).toEqual([user, conv.expected[i]]);
      });
    }
  });
});

describe("ConversationSignals", () => {
  it("kısa onarım ilk mesajda sayılmaz, sonrasında tekrar denemesi gibi sayılır", () => {
    const s = new ConversationSignals();
    s.noteUser("olmadı", { similar: false });
    expect([s.shortRepair, s.recentSimilar]).toEqual([false, 0]);
    s.noteUser("yanlış", { similar: false });
    expect([s.shortRepair, s.recentSimilar]).toEqual([true, 1]);
  });

  it("aynı kısa mesaj üst üste sayılır, farklı mesaj seriyi bozar", () => {
    const s = new ConversationSignals();
    for (const n of [1, 2, 3]) {
      s.noteUser("devam et", { similar: false });
      expect(s.shortRepeatStreak).toBe(n);
    }
    s.noteUser("başka", { similar: false });
    expect(s.shortRepeatStreak).toBe(1);
  });

  it("üst üste özür sayılır, özürsüz cevap sıfırlar", () => {
    const s = new ConversationSignals();
    s.noteAnswer("I apologize for the confusion.");
    s.noteAnswer("Haklısınız, özür dilerim.");
    expect(s.apologyStreak).toBe(2);
    s.noteAnswer("İşte istediğin kod.");
    expect(s.apologyStreak).toBe(0);
    s.noteAnswer(null);
    expect(s.apologyStreak).toBe(0);
  });

  it("halka için yalnızca son dört mesaja bakılır", () => {
    const s = new ConversationSignals();
    s.noteUser("bu kodu düzelt lütfen hata veriyor", { similar: true });
    for (let i = 0; i < 4; i++) s.noteUser(`farklı bir soru numara ${i} hakkında bilgi ver`, { similar: false });
    expect(s.recentSimilar).toBe(0);
  });

  it("teşekkür döngü sinyallerini sıfırlar, onarım ifadeli teşekkür sıfırlamaz", () => {
    const s = new ConversationSignals();
    s.noteUser("bu kodu düzelt hata veriyor", { similar: true });
    s.noteAnswer("I apologize");
    s.noteUser("teşekkürler ama hala çalışmıyor", { similar: false });
    expect(s.exited).toBe(false);
    expect(s.recentSimilar).toBe(1);
    s.noteUser("teşekkürler, oldu", { similar: false });
    expect(s.exited).toBe(true);
    expect(s.recentSimilar).toBe(0);
    expect(s.apologyStreak).toBe(0);
  });

  it("üst üste belirsiz istekler sayılır, açıklamalı istek sıfırlar", () => {
    const s = new ConversationSignals();
    s.noteUser("daha iyi yap", { similar: false });
    s.noteUser("kısalt", { similar: false });
    expect(s.vagueStreak).toBe(2);
    s.noteUser("ikinci paragrafı çıkar ve sonucu iki cümleye indir", { similar: false });
    expect(s.vagueStreak).toBe(0);
  });

  it("konu değişince yeni bölüm başlar ve döngü sinyalleri sıfırlanır", () => {
    const s = new ConversationSignals();
    s.noteUser("Python'da bir listeyi nasıl sıralarım, kod örneği ver", { similar: false });
    s.noteUser("Python'da bir listeyi nasıl sıralarım, kod örneği ver", { similar: true });
    s.noteUser("Translate this paragraph into English please: Toplantı yarına ertelendi.", { similar: false });
    expect(s.segments).toBe(2);
    expect(s.segmentStart).toBe(2);
    expect(s.recentSimilar).toBe(0);
  });

  it("aynı görev türünde ya da benzer metinde yeni konu sayılmaz", () => {
    const recent = [normalizeText("Python'da bir listeyi nasıl sıralarım, kod örneği ver")];
    expect(isNewTopic("Python'da bir sözlüğü nasıl sıralarım, kod örneği ver", { recent, segmentTask: "kod" })).toBe(false);
    expect(isNewTopic("kısa", { recent, segmentTask: "kod" })).toBe(false);
  });
});

describe("kısa onay zinciri ve kısa tekrar önizlemesi", () => {
  it("soruyla biten cevaplara verilen onaylar sayılır, devam sayılmaz", () => {
    const s = new ConversationSignals();
    s.noteUser("Bitirme projem için bir zaman planı çıkar", { similar: false });
    s.noteAnswer("Önerim şu. Haftalara bölelim mi?");
    s.noteUser("evet", { similar: false });
    s.noteAnswer("Haftalık plan hazır. Görev dağılımı da ekleyeyim mi?");
    s.noteUser("aynen", { similar: false });
    s.noteAnswer("Görevler hazır. Risk bölümü de ister misin?");
    s.noteUser("hayır gerek yok", { similar: false });
    expect(s.affirmStreak).toBe(3);
    s.noteAnswer("Tamam, böyle bırakıyorum.");
    s.noteUser("tamam", { similar: false }); // önceki cevap soruyla bitmedi
    expect(s.affirmStreak).toBe(0);
  });

  it("devam onay sayılmaz; çıkış mesajı onay sayılmaz", () => {
    expect(isAffirmation("devam")).toBe(false);
    expect(isAffirmation("evet harika")).toBe(false);
    expect(isAffirmation("tamam")).toBe(true);
    expect(isAffirmation("evet lutfen")).toBe(true);
  });

  it("aynı kısa mesajın kaçıncı kez geleceğini durumu değiştirmeden söyler", () => {
    const s = new ConversationSignals();
    s.noteUser("React ile not alma uygulamasının tüm bileşenlerini yaz", { similar: false });
    s.noteAnswer("İlk bölüm");
    expect(s.previewShortRepeat("devam")).toBe(1);
    s.noteUser("devam", { similar: false });
    s.noteAnswer("İkinci bölüm");
    s.noteUser("devam", { similar: false });
    s.noteAnswer("Üçüncü bölüm");
    expect(s.previewShortRepeat("devam")).toBe(SHORT_REPEAT_STREAK);
    expect(s.previewShortRepeat("devam")).toBe(SHORT_REPEAT_STREAK); // değişmedi
    expect(s.previewShortRepeat("olmadı")).toBe(0); // kısa onarım kendi şeridini alır
  });

  it("soruyla biten cevaba verilen aynı kısa onay kısa tekrar sayılmaz, onay zinciri sayılır (H1)", () => {
    const s = new ConversationSignals();
    s.noteUser("Bu fonksiyonu Python ile yazar mısın, liste sıralasın", { similar: false });
    s.noteAnswer("İşte kod. Test de ekleyeyim mi?");
    s.noteUser("evet", { similar: false });
    s.noteAnswer("Ekledim. Belge de yazayım mı?");
    s.noteUser("evet", { similar: false });
    s.noteAnswer("Yazdım. Örnek de ekleyeyim mi?");
    expect(s.previewShortRepeat("evet")).toBe(0); // şerit yok
    s.noteUser("evet", { similar: false });
    expect(s.affirmStreak).toBe(3); // "Yön sende" önerisi bu zincirden çıkar
    // Cevap soruyla bitmediyse aynı kısa mesaj yine kısa tekrar sayılır.
    const t = new ConversationSignals();
    t.noteUser("Bu fonksiyonu Python ile yazar mısın, liste sıralasın", { similar: false });
    t.noteAnswer("İşte kod.");
    t.noteUser("tamam", { similar: false });
    t.noteAnswer("Peki.");
    t.noteUser("tamam", { similar: false });
    t.noteAnswer("Peki.");
    expect(t.previewShortRepeat("tamam")).toBe(SHORT_REPEAT_STREAK);
  });
});
