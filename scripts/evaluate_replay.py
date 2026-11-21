"""Çevrimdışı değerlendirme (karar K28): eklentiyi gerçek sohbetler üzerinde tur tur yeniden oynatır.

Pilot yerine, WildFeedback'teki gerçek sohbetler eklentinin kurallarından ve tur modelinden sanki
biri o an yazıyormuş gibi geçirilir. Her kullanıcı mesajında şerit çıkar mıydı, halka hangi
seviyede olurdu, çıkış kartı hangi turda gelirdi, bakılır ve bu kararlar kullanıcının gerçekten
memnuniyetsiz olduğu turlarla (DSAT) karşılaştırılır.

İki politika karşılaştırılır:
    once   main dalındaki davranış (varyasyon kuralı ve sohbet sinyalleri yok)
    sonra  varyasyon isteği, son mesajlara bakan halka, döngüden çıkış, özür döngüsü,
           belirsiz istek ve konu kayması (K31, K32); uzun sohbet kartı için iki döngü işareti
           birlikte: yakın zamanda benzer mesaj ve modelin öneri seviyesi; gönderimi bekleten şerit
           yalnızca birebir tekrarda ya da onarım ifadesinde; düzeltme istendiği hâlde cevap öncekinin
           neredeyse aynısıysa halka koyulaşır ve kart açılabilir ("tekrar"); şerit çıkan turda kart beklemez
           bir sonraki tura kalır

Ölçütler (her biri hem "once" hem "sonra" için):
    şerit       100 sohbette kaç kez; isabet = şerit çıkan mesajda kullanıcı memnuniyetsiz mi
    halka       turların yüzde kaçında 1. ve 2. seviye; 2. seviyenin isabeti (o tur ya da sonraki)
                ve çıkış mesajından sonra halkanın yüksek kalma oranı
    kart        100 sohbette kaç kez; isabet = kart turunda ya da bir sonrakinde memnuniyetsizlik;
                memnuniyetsizliği iki ya da daha fazla kez yaşanan sohbetlerin kaçında kart
                ikinci şikayetten önce geldi (yakalama)
    taze başlat konu kayan sohbetlerde taslağa giren istek sayısının azalması

Girdi (önce indirilir, repoya eklenmez):
    data/processed/wildfeedback_conversations.parquet (assistant_msgs kolonu ile)
Çıktı (yalnızca toplam sayılar):
    outputs/replay_eval.json

Çalıştırma:
    python scripts/evaluate_replay.py               # 20.000 sohbetlik örneklem
    python scripts/evaluate_replay.py --max 0       # hepsi (uzun sürer)
"""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai import config  # noqa: E402
from kafiai.extension_similarity import is_comparable, is_variation, new_content, similarity  # noqa: E402
from kafiai.signals import RULES as SIGNAL_RULES, ConversationSignals  # noqa: E402
from kafiai.tasks import task_type  # noqa: E402
from kafiai.text import has_strong_repair  # noqa: E402
from kafiai.turn_features import turn_features  # noqa: E402
from kafiai.turn_model import load_model, load_reasons, predict  # noqa: E402

DATA = ROOT / "data" / "processed" / "wildfeedback_conversations.parquet"
OUT = ROOT / "outputs" / "replay_eval.json"
NORMS = json.loads((ROOT / "extension" / "src" / "data" / "task-norms.json").read_text(encoding="utf-8"))["norms"]
MAX_CHARS = 4000
HOLD_EXACT = json.loads((ROOT / "extension" / "src" / "data" / "repeat-rules.json").read_text(encoding="utf-8"))["hold_exact_similarity"]


def min_turns_for(task):
    norm = NORMS.get(task)
    return int(norm["p90_turns"]) + 1 if norm else config.EXT_EXIT_CARD_MIN_TURNS


def detector_flags(msgs, use_variation):
    """Her mesaj için (benzer, yumuşak tekrar, varyasyon, gönderim bekletilir) kararları; tekrar dedektörüyle aynı kural.

    "Bekletilir": benzer ve ya birebir tekrar (hold_exact_similarity) ya da güçlü onarım ifadesi. Eski
    politikada (use_variation=False) şerit her benzer mesajda çıkıyordu.
    """
    flags = []
    for t, text in enumerate(msgs):
        similar = soft = variation = exact = False
        if t > 0 and is_comparable(text) and len(text) <= MAX_CHARS:
            recent = [m for m in msgs[max(0, t - config.EXT_RECENT_MESSAGES):t] if is_comparable(m) and len(m) <= MAX_CHARS]
            best = 0.0
            for prev in recent:
                s = similarity(text, prev)
                best = max(best, s)
                if s >= config.EXT_SIMILARITY_THRESHOLD and not new_content(text, prev):
                    similar = True
                    exact = exact or s >= HOLD_EXACT
            soft = best >= config.EXT_SOFT_SIMILARITY_THRESHOLD
            if use_variation and (similar or soft) and is_variation(text, best):
                similar = soft = False
                variation = True
        hold = similar and (not use_variation or exact or has_strong_repair(text))
        flags.append((similar, soft, variation, hold))
    return flags


def ring_level(prediction, similar_signal, apology, vague, short_repeat=0, ignored_repair=False):
    """Halka seviyesi (ring.ts). Aynı kısa mesajın tekrarı halkayı yükseltmez; onun yerine şerit çıkar.
    Düzeltme istendiği hâlde cevap öncekinin neredeyse aynısıysa halka koyulaşır."""
    if (prediction and prediction["level"] == "yuksek") or similar_signal >= 2 or apology >= 2 or ignored_repair:
        return 2
    if (prediction and prediction["level"] == "oneri") or similar_signal == 1 or apology == 1 or vague >= 2:
        return 1
    return 0


def replay(msgs, answers, model, reasons, policy, predictions=None, extra=None):
    """Bir sohbeti oynatır; her tur için kararları döner. "sonra" eklentideki sırayı birebir izler
    (src/content/index.ts): mesaj gönderilir, tekrar ve sinyaller işlenir, model tahmin yapar,
    cevap gelir, özür sinyali işlenir, halka güncellenir, kart koşuluna bakılır.

    extra: aday kural denemesi için (scripts/evaluate_stage3.py). {"ring": {tur: seviye}, "card": {tur: gerekçe}};
    kart soğuma süresine ve bir turda tek müdahale kuralına uyar, öncelikte "tekrar"dan sonra gelir."""
    extra_ring = (extra or {}).get("ring", {})
    extra_card = (extra or {}).get("card", {})
    after = policy == "sonra"
    flags = detector_flags(msgs, use_variation=after)
    signals = ConversationSignals()
    min_turns = min_turns_for(task_type(msgs[0]))
    repeats = 0          # ExitCardPolicy.repeats (önce: sohbet boyu yumuşak tekrar; sonra: son dört mesajda benzer)
    similar_total = 0    # eski halkanın kullandığı sohbet boyu sayı
    quiet_until = 0
    short_repeat_offered = hint_shown = False
    prev_short_strip = False  # kısa onarım şeridi art arda iki turda çıkmaz; kartın sırası gelir
    turns = []
    for t, text in enumerate(msgs):
        n = t + 1
        similar, soft, variation, hold = flags[t]
        if soft and not after:
            repeats += 1  # eski kural: sohbet boyu yumuşak tekrar
        if similar:
            similar_total += 1
        if after:
            signals.note_user(text, similar)
            repeats = signals.recent_similar  # ExitCardPolicy.setRepeats: son dört mesaj, çıkışta sıfır
        if predictions is not None:
            prediction = predictions[t]
        else:
            prediction = predict(turn_features(msgs[:n], n), model, reasons) if n >= model["min_turn"] else None
        quiet_model = after and signals.exited
        high = bool(prediction) and prediction["level"] == "yuksek" and not quiet_model
        suggest = bool(prediction) and prediction["level"] in ("oneri", "yuksek") and not quiet_model
        # Aynı kısa mesaj üçüncü kez: gönderim öncesi şerit (sohbet başına bir kez).
        short_repeat_strip = (after and not short_repeat_offered and not hold and not signals.last_short_repair
                              and signals.short_repeat_streak == SIGNAL_RULES["short"]["repeat_streak"])
        short_repeat_offered = short_repeat_offered or short_repeat_strip
        if after:
            signals.note_answer(answers[t] if t < len(answers) else "")
            level = ring_level(None if signals.exited else prediction, signals.recent_similar,
                               signals.apology_streak, signals.vague_streak, signals.short_repeat_streak,
                               signals.answer_ignored_repair)
        else:
            level = ring_level(prediction, similar_total, 0, 0)
        if t in extra_ring:
            level = max(level, extra_ring[t])
        card = None
        # Bir turda tek müdahale: bu mesajda şerit çıktıysa kart en erken sonraki turda gelir.
        short_strip = after and signals.last_short_repair and not prev_short_strip
        prev_short_strip = short_strip
        stripped = after and (hold or short_strip or short_repeat_strip)
        if n >= quiet_until and not stripped:
            if high:
                card = "model"
            elif after and signals.apology_streak >= config.EXT_APOLOGY_CARD_STREAK:
                card = "ozur"
            elif after and signals.answer_ignored_repair:
                card = "tekrar"
            elif t in extra_card:
                card = extra_card[t]
            elif n >= min_turns and repeats >= config.EXT_EXIT_CARD_MIN_REPEATS and (suggest or not after):
                card = "norm"
        if card:
            quiet_until = n + config.EXT_EXIT_CARD_COOLDOWN_TURNS
        # Onay zinciri önerisi: cevabın altında, sohbet başına bir kez, kart ya da şerit yoksa.
        hint = (after and not hint_shown and not card and not stripped
                and signals.affirm_streak >= SIGNAL_RULES["affirm"]["streak"])
        hint_shown = hint_shown or hint
        turns.append({"looping": after and (signals.looping or signals.last_short_repair),
                      "looping_end": after and signals.looping,
                      "strip": hold, "short_strip": short_strip,
                      "short_repeat_strip": short_repeat_strip, "hint": hint, "variation": variation, "ring": level, "card": card,
                      "exit": after and signals.exited, "segments": signals.segments, "segment_start": signals.segment_start,
                      "restated": after and bool(signals.restated_turns)})
    return turns


def predictions_for(msgs, model, reasons):
    """Tur modelinin her turdaki tahmini; iki politika için aynı olduğundan bir kez hesaplanır."""
    return [predict(turn_features(msgs[:t + 1], t + 1), model, reasons) if t + 1 >= model["min_turn"] else None
            for t in range(len(msgs))]


class Tally:
    """Bir politikanın kararlarını toplar."""

    def __init__(self):
        self.n = self.user_turns = 0
        self.strips = self.strip_hits = 0
        self.short_strips = self.short_strip_hits = 0
        self.short_repeat_strips = self.short_repeat_hits = 0
        self.hints = self.hint_hits = 0
        self.loop_convs = self.loop_left = self.loop_left_dsat = self.loop_rec = self.loop_rec_dsat = 0
        self.ring1 = self.ring2 = self.ring2_hits = 0
        self.exits = self.exit_high = 0
        self.cards = self.card_hits = 0
        self.rule_cards = self.rule_card_hits = 0
        self.card_by = {}
        self.multi = self.multi_caught = 0
        self.drifted = self.draft_all = self.draft_seg = 0

    def add(self, turns, ds, n_msgs):
        self.n += 1
        self.user_turns += len(turns)
        second = sorted(ds)[1] if len(ds) >= 2 else None
        caught = False
        for t, d in enumerate(turns):
            if d["strip"]:
                self.strips += 1
                self.strip_hits += t in ds
            if d.get("short_strip"):
                self.short_strips += 1
                self.short_strip_hits += t in ds
            if d.get("short_repeat_strip"):
                self.short_repeat_strips += 1
                self.short_repeat_hits += t in ds
            if d.get("hint"):
                self.hints += 1
                self.hint_hits += (t in ds) or ((t + 1) in ds)
            if d["ring"] >= 1:
                self.ring1 += 1
            if d["ring"] == 2:
                self.ring2 += 1
                self.ring2_hits += (t in ds) or ((t + 1) in ds)
            if t > 0 and turns[t - 1]["exit"]:
                self.exits += 1
                self.exit_high += d["ring"] >= 1
            if d["card"]:
                hit = (t in ds) or ((t + 1) in ds)
                self.cards += 1
                self.card_hits += hit
                if d.get("restated"):
                    self.rule_cards += 1
                    self.rule_card_hits += hit
                by = self.card_by.setdefault(d["card"], [0, 0])
                by[0] += 1
                by[1] += hit
                if second is not None and t < second:
                    caught = True
        if second is not None:
            self.multi += 1
            self.multi_caught += caught
        last = turns[-1]
        # Döngü sonucu (sohbet sonu ölçümü): döngü sürerken bitti mi (bırakıldı), sakinleşmiş miydi (toparlandı)?
        if any(d.get("looping") for d in turns):
            self.loop_convs += 1
            n = len(turns)
            ended_unhappy = bool({n - 1, n - 2} & ds)
            if last.get("looping_end"):
                self.loop_left += 1
                self.loop_left_dsat += ended_unhappy
            else:
                self.loop_rec += 1
                self.loop_rec_dsat += ended_unhappy
        if last["segments"] > 1:
            self.drifted += 1
            self.draft_all += n_msgs
            self.draft_seg += n_msgs - last["segment_start"]

    def result(self):
        pct = lambda a, b: round(100 * a / b, 2) if b else None  # noqa: E731
        n = self.n
        return {
            "sohbet": n,
            "kullanici_turu": self.user_turns,
            "serit": {"100_sohbette": round(100 * self.strips / n, 2), "isabet_yuzde": pct(self.strip_hits, self.strips)},
            "kisa_onarim_seridi": {"100_sohbette": round(100 * self.short_strips / n, 2),
                                   "isabet_yuzde": pct(self.short_strip_hits, self.short_strips)},
            "dongu_sonu": {"donguli_sohbet_yuzde": pct(self.loop_convs, n),
                           "birakildi_yuzde": pct(self.loop_left, self.loop_convs),
                           "birakildi_son_turlarda_memnuniyetsizlik_yuzde": pct(self.loop_left_dsat, self.loop_left),
                           "toparlandi_son_turlarda_memnuniyetsizlik_yuzde": pct(self.loop_rec_dsat, self.loop_rec)},
            "kisa_tekrar_seridi": {"100_sohbette": round(100 * self.short_repeat_strips / n, 2),
                                   "isabet_yuzde": pct(self.short_repeat_hits, self.short_repeat_strips)},
            "onay_zinciri_onerisi": {"100_sohbette": round(100 * self.hints / n, 3),
                                     "sonraki_tur_memnuniyetsizlik_yuzde": pct(self.hint_hits, self.hints)},
            "halka": {"seviye1_ve_ustu_tur_yuzde": pct(self.ring1, self.user_turns),
                      "seviye2_tur_yuzde": pct(self.ring2, self.user_turns),
                      "seviye2_isabet_yuzde": pct(self.ring2_hits, self.ring2),
                      "cikistan_sonra_yuksek_kalan_yuzde": pct(self.exit_high, self.exits), "cikis_mesaji": self.exits},
            "kart": {"100_sohbette": round(100 * self.cards / n, 2), "isabet_yuzde": pct(self.card_hits, self.cards),
                     "kaynaga_gore": {k: {"sayi": v[0], "isabet_yuzde": pct(v[1], v[0])} for k, v in self.card_by.items()},
                     "tekrarlayan_memnuniyetsizlikte_yakalama_yuzde": pct(self.multi_caught, self.multi),
                     "tekrarlayan_memnuniyetsizlik_sohbeti": self.multi,
                     "kural_notlu_kart_yuzde": pct(self.rule_cards, self.cards),
                     "kural_notlu_kart_isabet_yuzde": pct(self.rule_card_hits, self.rule_cards)},
            "taze_baslat": {"konu_kayan_sohbet_yuzde": pct(self.drifted, n),
                            "taslaktaki_istek_ortalama_once": round(self.draft_all / self.drifted, 2) if self.drifted else None,
                            "taslaktaki_istek_ortalama_sonra": round(self.draft_seg / self.drifted, 2) if self.drifted else None},
        }


def evaluate(df, model, reasons, policies=("once", "sonra")):
    tallies = {p: Tally() for p in policies}
    for i, (msgs, answers, dsat) in enumerate(zip(df.user_msgs, df.assistant_msgs, df.dsat_turns)):
        msgs, answers = [str(m or "") for m in msgs], [str(a or "") for a in answers]
        ds = {int(x) for x in dsat}
        preds = predictions_for(msgs, model, reasons)
        for p in policies:
            tallies[p].add(replay(msgs, answers, model, reasons, p, preds), ds, len(msgs))
        if (i + 1) % 5000 == 0:
            print(f"  {i + 1:,} sohbet", flush=True)
    return {p: t.result() for p, t in tallies.items()}


def main():
    ap = argparse.ArgumentParser(description="Eklentiyi gerçek sohbetler üzerinde yeniden oynat")
    ap.add_argument("--max", type=int, default=20000, help="örneklem büyüklüğü (0 = hepsi)")
    args = ap.parse_args()
    df = pd.read_parquet(DATA)
    if "assistant_msgs" not in df.columns:
        sys.exit("assistant_msgs kolonu yok. Önce: python scripts/fetch_wildfeedback.py")
    df = df[df.n_user_msgs >= 2]
    if args.max and len(df) > args.max:
        df = df.sample(args.max, random_state=config.SEED)
    model, reasons = load_model(), load_reasons()
    base_dsat = sum(len(d) for d in df.dsat_turns) / max(1, sum(df.n_user_msgs))
    result = {"kaynak": "WildFeedback (sat_dsat_annotation)", "tum_turlarda_dsat_yuzde": round(100 * base_dsat, 2)}
    print(f"{len(df):,} sohbet oynatılıyor...", flush=True)
    result.update(evaluate(df, model, reasons))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"\nYazıldı: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
