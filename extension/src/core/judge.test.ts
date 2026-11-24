import { describe, expect, it } from "vitest";
import actionFixture from "../../../tests/fixtures/judge_action_parity.json";
import { buildJudgeTurns, confirmsLoop, JUDGE, judgeAction, needsConfirm, parseVerdict, shouldAsk, type GateState } from "./judge";

const gate = (o: Partial<GateState> = {}): GateState => ({
  consent: true, configured: true, personal: false, turns: 3, lastAskedTurn: -1, ...o,
});
const sonuc = (o: Record<string, unknown> = {}) => ({
  sonuc: {
    ayni_istek: true, onceki_istek_turu: 1, onceki_cevap_karsiladi: "hayir", tikanma: true, ozur_dongusu: false,
    tur: "karsilanmayan_engel", dongu: true, guven: 0.9, gerekce: "Aynı hata üçüncü kez geldi.",
    oneri: "İstersen hata metninin tamamını tek mesajda paylaş.", ...o,
  },
});

describe("shouldAsk", () => {
  it("izin, adres, kişisel olmama ve tur sınırı birlikte gerekir", () => {
    expect(shouldAsk(gate())).toBe(true);
    expect(shouldAsk(gate({ consent: false }))).toBe(false);
    expect(shouldAsk(gate({ configured: false }))).toBe(false);
    expect(shouldAsk(gate({ personal: true }))).toBe(false);
    expect(shouldAsk(gate({ turns: JUDGE.min_turn - 1 }))).toBe(false);
  });
  it("aynı tur için ikinci kez sormaz", () => {
    expect(shouldAsk(gate({ turns: 4, lastAskedTurn: 4 }))).toBe(false);
    expect(shouldAsk(gate({ turns: 5, lastAskedTurn: 4 }))).toBe(true);
  });
});

describe("buildJudgeTurns", () => {
  it("mesaj ve cevapları sırayla dizer, okunamayan cevabı atlar, uzun mesajı keser", () => {
    const t = buildJudgeTurns(["a".repeat(5000), "iki"], ["cevap", null]);
    expect(t.map((x) => x.rol)).toEqual(["k", "a", "k"]);
    expect(t[0]!.metin).toHaveLength(JUDGE.user_chars);
  });
  it("en fazla max_turns tur gönderir, en yenileri tutar", () => {
    const users = Array.from({ length: 20 }, (_, i) => `m${i}`);
    const t = buildJudgeTurns(users, users.map((u) => `c-${u}`));
    expect(t).toHaveLength(JUDGE.max_turns);
    expect(t.at(-1)!.metin).toBe("c-m19");
  });
});

describe("parseVerdict", () => {
  it("bozuk ya da eksik cevabı reddeder", () => {
    expect(parseVerdict(null)).toBeNull();
    expect(parseVerdict({ sonuc: null })).toBeNull();
    expect(parseVerdict({ sonuc: { dongu: "evet", guven: 1 } })).toBeNull();
    expect(parseVerdict(sonuc({ guven: Number.NaN }))).toBeNull();
  });
  it("güveni sınırlar, bilinmeyen türü 'yok' sayar, döngü yoksa metni siler", () => {
    expect(parseVerdict(sonuc({ guven: 7 }))!.guven).toBe(1);
    expect(parseVerdict(sonuc({ tur: "<script>" }))!.tur).toBe("yok");
    const v = parseVerdict(sonuc({ dongu: false }))!;
    expect([v.gerekce, v.oneri]).toEqual(["", ""]);
  });
});

describe("judgeAction", () => {
  it("yüksek güvenli döngü kartı açar ve halkayı koyulaştırır", () => {
    expect(judgeAction(parseVerdict(sonuc()))).toEqual({ card: true, ring: 2, sameRequest: false, repeat: null });
  });
  it("orta güven yalnızca halkayı bir seviye yükseltir", () => {
    const g = (JUDGE.ring_threshold + JUDGE.card_threshold) / 2;
    // Kanıtsız döngü (tıkanma ve özür yok): orta güven kart açmaz.
    expect(judgeAction(parseVerdict(sonuc({ guven: g, tikanma: false })))).toEqual({ card: false, ring: 1, sameRequest: false, repeat: "karsilanmamis" });
  });
  it("metni boş gelen kart gösterilmez", () => {
    expect(judgeAction(parseVerdict(sonuc({ oneri: "  " }))).card).toBe(false);
  });
  it("karşılanmamış isteğin ilk yeniden yazımı benzer mesaj sayılır; döngü kartı değil aynı istek kartı açar", () => {
    const a = judgeAction(parseVerdict(sonuc({ dongu: false, guven: 0.3, tur: "ayni_istek_yeniden" })));
    expect(a).toEqual({ card: false, ring: 0, sameRequest: true, repeat: "karsilanmamis" });
  });
  it("cevaplanmış soruyu yeniden sorma (Yeşilay, tavuk) ikinci soruşta aynı istek kartı açar", () => {
    const a = judgeAction(parseVerdict(sonuc({ dongu: false, guven: 0.6, tikanma: false, onceki_cevap_karsiladi: "evet", tur: "ayni_istek_yeniden" })));
    expect(a.repeat).toBe("cevaplanmis");
    expect(a.card).toBe(false);
  });
  it("aynı istek değilse ya da onay modundaysa aynı istek kartı yok", () => {
    expect(judgeAction(parseVerdict(sonuc({ ayni_istek: false, dongu: false }))).repeat).toBeNull();
    const eski = JUDGE.mode;
    try {
      JUDGE.mode = "onay";
      expect(judgeAction(parseVerdict(sonuc({ dongu: false }))).repeat).toBeNull();
    } finally {
      JUDGE.mode = eski;
    }
  });
  it("karar yoksa hiçbir şey değişmez", () => {
    expect(judgeAction(null)).toEqual({ card: false, ring: 0, sameRequest: false, repeat: null });
  });
});

describe("anlam desteği modları", () => {
  const v = (o: Record<string, unknown> = {}) => parseVerdict(sonuc(o));
  it("onay modunda yeni kart açılmaz ama halka yükselebilir; onay eşiği uygulanır", () => {
    const eski = JUDGE.mode;
    try {
      JUDGE.mode = "onay";
      expect(needsConfirm()).toBe(true);
      expect(judgeAction(v()).card).toBe(false);
      expect(judgeAction(v()).ring).toBe(2);
      expect(confirmsLoop(v({ guven: JUDGE.confirm_threshold }))).toBe(true);
      expect(confirmsLoop(v({ guven: JUDGE.confirm_threshold - 0.01 }))).toBe(false);
      expect(confirmsLoop(v({ dongu: false }))).toBe(false);
      expect(confirmsLoop(null)).toBe(false);
      JUDGE.mode = "ikisi";
      expect(needsConfirm()).toBe(true);
      expect(judgeAction(v()).card).toBe(true);
      JUDGE.mode = "bilinmeyen";
      expect(needsConfirm()).toBe(false);
    } finally {
      JUDGE.mode = eski;
    }
  });
});

describe("kart kuralı Python ikiziyle aynı (tests/fixtures/judge_action_parity.json)", () => {
  it.each(actionFixture.ornekler)("$ad", (o) => {
    const a = judgeAction(parseVerdict({ sonuc: { tur: "yok", ...o.sonuc } }));
    expect({ card: a.card, repeat: a.repeat }).toEqual(o.beklenen);
  });
});
