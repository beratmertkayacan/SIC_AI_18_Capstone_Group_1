import { describe, expect, it } from "vitest";
import fixture from "../../../tests/fixtures/signals_parity.json";
import { apologizes, ConversationSignals, isExitMessage, isNewTopic, isVague } from "./signals";
import { normalizeText } from "./text";

describe("sohbet sinyalleri: Python ikiziyle aynı karar (parite örnekleri)", () => {
  it("özür, çıkış ve belirsiz istek kuralları", () => {
    for (const [text, expected] of fixture.units.apology as [string, boolean][]) expect([text, apologizes(text)]).toEqual([text, expected]);
    for (const [text, expected] of fixture.units.exit as [string, boolean][]) expect([text, isExitMessage(text)]).toEqual([text, expected]);
    for (const [text, expected] of fixture.units.vague as [string, boolean][]) expect([text, isVague(text)]).toEqual([text, expected]);
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
        }]).toEqual([user, conv.expected[i]]);
      });
    }
  });
});

describe("ConversationSignals", () => {
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
