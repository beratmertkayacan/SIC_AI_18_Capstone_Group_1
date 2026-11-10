"""Cevap tarafı sinyali: kullanıcı aynı isteği tekrarladığında yapay zekanın cevabı değişiyor mu?

Eklenti bugün yalnızca kullanıcı mesajlarına bakıyor. Oysa aynı istek iki türlü tekrarlanır:
    seri üretim   "sonraki soruyu sor", "bir motivasyon sözü daha": cevap her seferinde değişir,
                  kullanıcı memnundur.
    döngü         "bu kodu düzelt": model aynı ya da çok benzer cevabı verir, kullanıcı ilerleyemez.

Bu betik iki soruyu ölçer:
  1. Tekrarlanan bir isteğe gelen cevap bir öncekine çok benziyorsa (cevap da tekrar ediyorsa),
     kullanıcının bir sonraki mesajında memnuniyetsizlik (WildFeedback DSAT) daha mı sık?
  2. Art arda gelen özür cevapları ("I apologize", "haklısınız, özür dilerim") memnuniyetsizlikle
     ilişkili mi? Modelin takıldığını gösteren bilinen bir örüntü.

Girdi (önce indirilir, repoya eklenmez):
    data/processed/wildfeedback_conversations.parquet  (assistant_msgs kolonu ile;
        python scripts/fetch_wildfeedback.py)
    data/processed/wildchat48_multiturn.parquet ve wildchat48_turkish.parquet (varsa; yalnızca oranlar)

Çıktı (yalnızca toplam sayılar):
    outputs/response_signal.json

Çalıştırma:
    python scripts/evaluate_response_signal.py
"""

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai.extension_similarity import is_comparable, is_variation, new_content, similarity  # noqa: E402
from kafiai.text import has_strong_repair  # noqa: E402

DATA = ROOT / "data" / "processed"
OUT = ROOT / "outputs" / "response_signal.json"

USER_REPEAT = 0.80          # şerit eşiği (config.EXT_SIMILARITY_THRESHOLD)
SAME_ANSWER = 0.80          # bu ve üstü: cevap da tekrar ediyor
DIFFERENT_ANSWER = 0.50     # bunun altı: cevap belirgin biçimde farklı
MAX_CHARS = 4000            # çok uzun mesajlar (yapıştırılmış belgeler) karşılaştırılmaz

APOLOGY = ["i apologize", "apologies for", "my apologies", "sorry for the confusion", "sorry for any confusion",
           "you are right", "you re right", "you are correct", "my mistake", "i made a mistake",
           "özür dilerim", "haklısınız", "haklısın", "kusura bakmayın", "hata yaptım"]


def _norm(text):
    from kafiai.extension_similarity import normalize_text
    return " " + normalize_text(text or "") + " "


def apologizes(answer):
    """Cevabın başında özür ya da "haklısınız" var mı? İngilizce "I" için ikinci deneme (I -> i)."""
    raw = (answer or "")[:300]
    heads = (_norm(raw), _norm(raw.replace("I", "i")))
    return any(f" {p} " in head for head in heads for p in APOLOGY)


def bucket(answer_sim):
    if answer_sim >= SAME_ANSWER:
        return "ayni_cevap"
    if answer_sim < DIFFERENT_ANSWER:
        return "farkli_cevap"
    return "kismen"


def repeat_rows(users, answers, dsat=(), sat=()):
    """Kullanıcı tekrarı olan her tur için bir satır: cevap benzerliği ve sonraki turun durumu."""
    dsat, sat = set(dsat), set(sat)
    n = len(users)
    for t in range(1, n):
        a, b = users[t - 1], users[t]
        if not is_comparable(b) or len(a) > MAX_CHARS or len(b) > MAX_CHARS:
            continue
        if similarity(a, b) < USER_REPEAT or new_content(b, a):
            continue
        prev_answer, answer = answers[t - 1], answers[t]
        if not prev_answer or not answer:
            continue
        nxt = t + 1
        yield {
            "cevap_benzerligi": similarity(prev_answer, answer),
            "varyasyon": is_variation(b),
            "onarim": has_strong_repair(b),
            "sonraki_var": nxt < n,
            "sonraki_dsat": nxt in dsat,
            "sonraki_sat": nxt in sat,
            "sonraki_tekrar": nxt < n and similarity(b, users[nxt]) >= USER_REPEAT and not new_content(users[nxt], b),
            "sonraki_onarim": nxt < n and has_strong_repair(users[nxt]),
        }


def apology_rows(users, answers, dsat=()):
    dsat = set(dsat)
    for t in range(1, len(users) - 1):
        if not answers[t] or not answers[t - 1]:
            continue
        yield {"ozur": apologizes(answers[t]), "ust_uste_ozur": apologizes(answers[t]) and apologizes(answers[t - 1]),
               "sonraki_dsat": (t + 1) in dsat}


def summarize(df, by):
    out = {}
    for key, g in df.groupby(by):
        has_next = g[g["sonraki_var"]] if "sonraki_var" in g else g
        out[str(key)] = {
            "n": int(len(g)),
            "sonraki_dsat": round(float(has_next["sonraki_dsat"].mean()), 4) if len(has_next) else None,
            **({"sonraki_sat": round(float(has_next["sonraki_sat"].mean()), 4)} if "sonraki_sat" in g else {}),
            **({"sonraki_tekrar": round(float(has_next["sonraki_tekrar"].mean()), 4)} if "sonraki_tekrar" in g else {}),
            **({"sonraki_onarim": round(float(has_next["sonraki_onarim"].mean()), 4)} if "sonraki_onarim" in g else {}),
        }
    return out


def main():
    path = DATA / "wildfeedback_conversations.parquet"
    wf = pd.read_parquet(path)
    if "assistant_msgs" not in wf.columns:
        sys.exit("assistant_msgs kolonu yok. Önce: python scripts/fetch_wildfeedback.py")

    reps, apol = [], []
    for users, answers, dsat, sat in zip(wf.user_msgs, wf.assistant_msgs, wf.dsat_turns, wf.sat_turns):
        users, answers = list(users), list(answers)
        dsat, sat = [int(x) for x in dsat], [int(x) for x in sat]
        reps.extend(repeat_rows(users, answers, dsat, sat))
        apol.extend(apology_rows(users, answers, dsat))
    reps, apol = pd.DataFrame(reps), pd.DataFrame(apol)
    reps["cevap"] = reps["cevap_benzerligi"].map(bucket)
    base_turns = sum(max(0, n - 1) for n in wf.n_user_msgs)
    base_dsat = sum(sum(1 for x in d if x >= 1) for d in wf.dsat_turns) / max(base_turns, 1)

    plain = reps[~reps["varyasyon"] & ~reps["onarim"]]
    result = {
        "kaynak": "WildFeedback (sat_dsat_annotation)",
        "esikler": {"kullanici_tekrari": USER_REPEAT, "ayni_cevap": SAME_ANSWER, "farkli_cevap": DIFFERENT_ANSWER},
        "tum_turlarda_dsat": round(base_dsat, 4),
        "kullanici_tekrari": int(len(reps)),
        "cevaba_gore": summarize(reps, "cevap"),
        "isaretsiz_tekrarlarda_cevaba_gore": summarize(plain, "cevap"),
        "varyasyon_isaretlilerde_cevaba_gore": summarize(reps[reps["varyasyon"]], "cevap"),
        "ozur": {
            "cevap_sayisi": int(len(apol)),
            "ozur_payi": round(float(apol["ozur"].mean()), 4),
            "ozurden_sonra_dsat": round(float(apol.loc[apol["ozur"], "sonraki_dsat"].mean()), 4),
            "ozur_yokken_dsat": round(float(apol.loc[~apol["ozur"], "sonraki_dsat"].mean()), 4),
            "ust_uste_ozur_payi": round(float(apol["ust_uste_ozur"].mean()), 4),
            "ust_uste_ozurden_sonra_dsat": round(float(apol.loc[apol["ust_uste_ozur"], "sonraki_dsat"].mean()), 4)
            if apol["ust_uste_ozur"].any() else None,
        },
    }

    # WildChat: etiket yok, yalnızca kullanıcı tekrarlarında cevabın ne sıklıkla tekrar ettiği.
    for name in ["wildchat48_multiturn", "wildchat48_turkish"]:
        p = DATA / f"{name}.parquet"
        if not p.exists():
            continue
        wc = pd.read_parquet(p)
        if "assistant_msgs" not in wc.columns:
            result[name] = "assistant_msgs kolonu yok (python scripts/fetch_wildchat48.py ile yeniden indirilmeli)"
            continue
        rows = [r for u, a in zip(wc.user_msgs, wc.assistant_msgs) for r in repeat_rows(list(u), list(a))]
        df = pd.DataFrame(rows)
        if df.empty:
            continue
        df["cevap"] = df["cevap_benzerligi"].map(bucket)
        result[name] = {
            "kullanici_tekrari": int(len(df)),
            "cevap_paylari": {k: round(float(v), 4) for k, v in df["cevap"].value_counts(normalize=True).items()},
            "sonraki_tekrar": summarize(df, "cevap"),
        }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"\nYazıldı: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
