"""Tur modeli: eklentinin her mesajda yeniden çalıştıracağı model.

Task 3'teki model sohbet başına bir kez, ilk iki mesajdan sonra karar veriyordu. Bu script
dört iyileştirme yapar:

    1. Her turda tahmin: model k = 2 ile 6 arasındaki her turdan örneklerle eğitilir
       (build_turn_dataset.py). Kullanıcı yeni bir mesaj yazdıkça tahmin güncellenir.
    2. Olasılık kalibrasyonu: sınıf ağırlıkları dengelendiği için ham olasılıklar şişkin.
       Katlar dışı tahminlerle Platt ölçekleme (sigmoid) öğrenilir; "%30 risk" gerçekten
       sohbetlerin yaklaşık %30'unda döngü demek olsun.
    3. İki karar eşiği: "öneri" (F1'i en yüksek yapan) ve "yüksek güven" (eğitim verisinde
       kesinliği en az HIGH_PRECISION olan en düşük eşik). Eklenti yalnızca yüksek güven
       eşiğinde kendiliğinden öneri gösterir ve bunun için sohbette en az bir güçlü onarım
       ifadesi ("olmadı", "still wrong") görülmüş olmalıdır (kanıt şartı). İlk eğitimde bu şart
       olmadan işaretlenen sohbetlerde isabet yalnızca %12,5 çıktı; gerekçesi de "mesajın uzun"
       gibi kullanıcıya yararı az bir cümleydi.
    4. Gerekçe: her tahminde en çok katkı yapan öznitelikler bulunur ve kullanıcıya o
       gerekçeye uygun bir öneri gösterilir (extension/src/data/model-reasons.json).

Çalıştırma:
    python scripts/train_turn_model.py
Çıktılar:
    extension/src/data/turn-model.json   eklentinin okuyacağı model (katsayılar, kalibrasyon, eşikler)
    outputs/turn_model_metrics.json      tüm sonuçlar
    figures/26_turn_model_by_k.png, 27_calibration.png, 28_reasons.png
"""

import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.calibration import calibration_curve  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import (average_precision_score, brier_score_loss, confusion_matrix,  # noqa: E402
                             f1_score, precision_recall_curve, precision_score, recall_score,
                             roc_auc_score)
from sklearn.model_selection import GridSearchCV, GroupKFold, cross_val_predict  # noqa: E402
from sklearn.pipeline import Pipeline  # noqa: E402
from sklearn.preprocessing import StandardScaler  # noqa: E402
from xgboost import XGBClassifier  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai.config import CV_FOLDS, SEED, TEST_SIZE  # noqa: E402
from kafiai.data import PROCESSED  # noqa: E402
from kafiai.split import user_split  # noqa: E402
from kafiai.turn_features import TURN_FEATURES  # noqa: E402

FIG, OUT = ROOT / "figures", ROOT / "outputs"
MODEL_FILE = ROOT / "extension" / "src" / "data" / "turn-model.json"
REASONS_FILE = ROOT / "extension" / "src" / "data" / "model-reasons.json"
HIGH_PRECISION = 0.40  # yüksek güven eşiği: model "döngü" dediğinde en az 10'da 4 haklı olsun
EVIDENCE = "n_strong_repairs"  # yüksek güven için kanıt: en az bir güçlü onarım ifadesi
TEAL, ORANGE, GREY, GOLD = "#1F5F6B", "#C4562A", "#9AA5A8", "#D9A441"
plt.rcParams.update({"figure.dpi": 130, "axes.spines.top": False, "axes.spines.right": False,
                     "font.size": 9.5, "axes.grid": True, "grid.alpha": 0.25})


# ---------------------------------------------------------------------------
# Yardımcılar
# ---------------------------------------------------------------------------

def logit(p):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


def platt(raw_prob, a, b):
    """Kalibre olasılık: sigmoid(a * logit(ham olasılık) + b)."""
    return 1 / (1 + np.exp(-(a * logit(raw_prob) + b)))


def fit_platt(raw_prob, y):
    lr = LogisticRegression(C=1e6, max_iter=1000).fit(logit(raw_prob).reshape(-1, 1), y)
    return float(lr.coef_[0][0]), float(lr.intercept_[0])


def expected_calibration_error(y, prob, bins=10):
    """Olasılığı 10 kutuya bölüp her kutuda söylenen ile gerçekleşen oran farkının ağırlıklı ortalaması."""
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(prob, edges) - 1, 0, bins - 1)
    total = 0.0
    for b in range(bins):
        mask = idx == b
        if mask.any():
            total += mask.mean() * abs(prob[mask].mean() - y[mask].mean())
    return float(total)


def thresholds(y, prob):
    """F1 eşiği ve kesinliği en az HIGH_PRECISION olan en düşük eşik."""
    precision, recall, cut = precision_recall_curve(y, prob)
    f1 = 2 * precision * recall / np.clip(precision + recall, 1e-9, None)
    f1_cut = float(cut[int(np.argmax(f1[:-1]))])
    ok = np.where(precision[:-1] >= HIGH_PRECISION)[0]
    high_cut = float(cut[ok[0]]) if len(ok) else float(cut[-1])
    return f1_cut, high_cut


def evidence(df):
    return df[EVIDENCE].to_numpy() >= 1


def scores(y, prob, cuts, gate):
    """gate: kanıt şartı (yalnızca yüksek güven seviyesine uygulanır)."""
    out = {"n": int(len(y)), "positive_rate": round(float(np.mean(y)), 4),
           "pr_auc": round(float(average_precision_score(y, prob)), 4),
           "roc_auc": round(float(roc_auc_score(y, prob)), 4) if len(set(y)) > 1 else None,
           "brier": round(float(brier_score_loss(y, prob)), 4),
           "ece": round(expected_calibration_error(np.asarray(y), np.asarray(prob)), 4)}
    for name, cut in cuts.items():
        pred = ((prob >= cut) & (gate if name == "yuksek_guven" else True)).astype(int)
        out[name] = {"threshold": round(cut, 4),
                     "flagged_pct": round(float(pred.mean() * 100), 2),
                     "precision": round(float(precision_score(y, pred, zero_division=0)), 4),
                     "recall": round(float(recall_score(y, pred, zero_division=0)), 4),
                     "f1": round(float(f1_score(y, pred, zero_division=0)), 4),
                     "confusion_matrix": confusion_matrix(y, pred, labels=[0, 1]).tolist()}
    return out


def contributions(row_scaled, coef):
    """Her özniteliğin tahmine katkısı: katsayı x ölçeklenmiş değer."""
    return row_scaled * coef


# ---------------------------------------------------------------------------
# Ana akış
# ---------------------------------------------------------------------------

def main():
    table = pd.read_parquet(PROCESSED / "turns_48m.parquet")
    turkish = pd.read_parquet(PROCESSED / "turns_48m_turkish.parquet")
    table = table[~table["hashed_ip"].isin(set(turkish["hashed_ip"]))].reset_index(drop=True)
    train_idx, test_idx = user_split(table, test_size=TEST_SIZE)
    train, test = table.loc[train_idx].reset_index(drop=True), table.loc[test_idx].reset_index(drop=True)
    X, y, groups = train[TURN_FEATURES], train["label"].to_numpy(), train["hashed_ip"]
    print(f"Eğitim {len(train):,} satır ({train['conversation_hash'].nunique():,} sohbet), "
          f"test {len(test):,} satır; pozitif oranı %{y.mean()*100:.1f}")

    cv = GroupKFold(n_splits=CV_FOLDS, shuffle=True, random_state=SEED)
    results = {"n_train_rows": len(train), "n_test_rows": len(test), "features": TURN_FEATURES,
               "high_precision_target": HIGH_PRECISION, "models": {}}

    # 1. Logistic Regression (eklentiye girecek model)
    lr_search = GridSearchCV(
        Pipeline([("olcek", StandardScaler()),
                  ("model", LogisticRegression(max_iter=3000, class_weight="balanced"))]),
        {"model__C": [0.003, 0.01, 0.03, 0.1, 1]}, scoring="average_precision", cv=cv)
    lr_search.fit(X, y, groups=groups)
    lr = lr_search.best_estimator_
    print(f"LogReg en iyi {lr_search.best_params_}, CV PR-AUC {lr_search.best_score_:.3f}")

    # 2. XGBoost (karşılaştırma için)
    pos_weight = float((y == 0).sum() / max((y == 1).sum(), 1))
    xgb_search = GridSearchCV(
        XGBClassifier(scale_pos_weight=pos_weight, subsample=0.8, colsample_bytree=0.8,
                      random_state=SEED, eval_metric="aucpr", n_jobs=2),
        {"max_depth": [3, 5], "n_estimators": [300, 600], "learning_rate": [0.03], "min_child_weight": [5]},
        scoring="average_precision", cv=cv)
    xgb_search.fit(X, y, groups=groups)
    print(f"XGBoost en iyi {xgb_search.best_params_}, CV PR-AUC {xgb_search.best_score_:.3f}")

    # 3. Kalibrasyon ve eşikler: katlar dışı tahminlerden, test verisine bakmadan.
    calibrated = {}
    for name, search in [("logreg", lr_search), ("xgboost", xgb_search)]:
        oof_raw = cross_val_predict(search.best_estimator_, X, y, groups=groups, cv=cv,
                                    method="predict_proba")[:, 1]
        a, b = fit_platt(oof_raw, y)
        oof = platt(oof_raw, a, b)
        f1_cut, high_cut = thresholds(y, oof)
        test_raw = search.predict_proba(test[TURN_FEATURES])[:, 1]
        test_prob = platt(test_raw, a, b)
        cuts = {"oneri": f1_cut, "yuksek_guven": high_cut}
        calibrated[name] = (search, a, b, cuts, test_raw, test_prob)
        entry = {
            "best_params": {k: (float(v) if isinstance(v, float) else v) for k, v in search.best_params_.items()},
            "cv_pr_auc": round(float(search.best_score_), 4),
            "platt": {"a": round(a, 6), "b": round(b, 6)},
            "test_raw": {"brier": round(float(brier_score_loss(test["label"], test_raw)), 4),
                         "ece": round(expected_calibration_error(test["label"].to_numpy(), test_raw), 4)},
            "test": scores(test["label"].to_numpy(), test_prob, cuts, evidence(test)),
            "test_without_evidence_rule": scores(test["label"].to_numpy(), test_prob, cuts,
                                                 np.ones(len(test), dtype=bool))["yuksek_guven"],
            "test_by_k": {},
        }
        for k, part in test.groupby("k"):
            mask = (test["k"] == k).to_numpy()
            entry["test_by_k"][int(k)] = scores(part["label"].to_numpy(), test_prob[mask], cuts, evidence(part))
        # Dış testler: Türkçe, 1M (eğitimde görülen kullanıcı ve sohbetler çıkarılır), WildFeedback.
        seen_users, seen_keys = set(train["hashed_ip"]), set(train["text_key"])
        for ext_name in ["48m_turkish", "1m", "wildfeedback"]:
            ext = pd.read_parquet(PROCESSED / f"turns_{ext_name}.parquet")
            ext = ext[~ext["hashed_ip"].isin(seen_users) & ~ext["text_key"].isin(seen_keys)]
            prob = platt(search.predict_proba(ext[TURN_FEATURES])[:, 1], a, b)
            entry[ext_name] = scores(ext["label"].to_numpy(), prob, cuts, evidence(ext))
            if "label_dsat" in ext.columns:
                entry[ext_name + "_dsat"] = scores(ext["label_dsat"].to_numpy(), prob, cuts, evidence(ext))
        results["models"][name] = entry
        t = entry["test"]
        print(f"  {name}: test PR-AUC {t['pr_auc']:.3f} (rastgele {t['positive_rate']:.3f}), "
              f"Brier {entry['test_raw']['brier']:.3f} -> {t['brier']:.3f}, "
              f"yüksek güven: kesinlik {t['yuksek_guven']['precision']:.2f}, "
              f"yakalanan {t['yuksek_guven']['recall']:.2f}, işaretlenen %{t['yuksek_guven']['flagged_pct']:.1f}")

    # 4. Eklentiye girecek model dosyası
    search, a, b, cuts, test_raw, test_prob = calibrated["logreg"]
    scaler, model = lr.named_steps["olcek"], lr.named_steps["model"]
    coef = model.coef_[0]
    export = {
        "version": 1,
        "note": "KafiAI tur modeli. scripts/train_turn_model.py üretir; elle değiştirilmez.",
        "features": TURN_FEATURES,
        "mean": [round(float(v), 6) for v in scaler.mean_],
        "scale": [round(float(v), 6) for v in scaler.scale_],
        "coef": [round(float(v), 6) for v in coef],
        "intercept": round(float(model.intercept_[0]), 6),
        "platt": {"a": round(a, 6), "b": round(b, 6)},
        "thresholds": {k: round(v, 4) for k, v in cuts.items()},
        "high_requires": EVIDENCE,
        "min_turn": 2,
        "max_turn": int(table["k"].max()),
    }
    MODEL_FILE.write_text(json.dumps(export, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    results["logreg_coefficients"] = dict(sorted(zip(TURN_FEATURES, [round(float(c), 4) for c in coef]),
                                                 key=lambda kv: -abs(kv[1])))

    # 5. Gerekçeler: yüksek güvenle işaretlenen test satırlarında en büyük katkıyı yapan öznitelik
    reasons = json.loads(REASONS_FILE.read_text(encoding="utf-8"))
    scaled = scaler.transform(test[TURN_FEATURES])
    flagged = np.where((test_prob >= cuts["yuksek_guven"]) & evidence(test))[0]
    top = []
    for i in flagged:
        contrib = contributions(scaled[i], coef)
        order = np.argsort(-contrib)
        reason = next((TURN_FEATURES[j] for j in order if contrib[j] > 0 and TURN_FEATURES[j] in reasons["reasons"]),
                      "genel")
        top.append(reason)
    share = pd.Series(top).value_counts(normalize=True) if top else pd.Series(dtype=float)
    results["top_reason_share_high_conf"] = share.round(4).to_dict()
    hit = pd.Series(test["label"].to_numpy()[flagged]).groupby(pd.Series(top)).mean() if top else pd.Series(dtype=float)
    results["precision_by_reason_high_conf"] = hit.round(4).to_dict()

    (OUT / "turn_model_metrics.json").write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    draw(results, test, calibrated, share, reasons)
    print(f"Yazıldı: {MODEL_FILE.relative_to(ROOT)}, outputs/turn_model_metrics.json, figures/26-28")


# ---------------------------------------------------------------------------
# Grafikler
# ---------------------------------------------------------------------------

def save(fig, name):
    fig.tight_layout()
    fig.savefig(FIG / name, bbox_inches="tight")
    plt.close(fig)


def draw(results, test, calibrated, share, reasons):
    # 26: tura göre başarı ve yüksek güven eşiğinde kesinlik / yakalama
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4))
    ks = sorted(results["models"]["logreg"]["test_by_k"])
    for name, color, label in [("logreg", TEAL, "LogReg"), ("xgboost", GOLD, "XGBoost")]:
        by_k = results["models"][name]["test_by_k"]
        ax1.plot(ks, [by_k[k]["pr_auc"] / by_k[k]["positive_rate"] for k in ks], marker="o", color=color, label=label)
    ax1.axhline(1, ls="--", color="#888", lw=1)
    ax1.set(xlabel="modelin gördüğü mesaj sayısı (k)", ylabel="PR-AUC / rastgele",
            title="Her turda tahmin: rastgeleden kaç kat iyi?")
    ax1.set_xticks(ks)
    ax1.legend()
    by_k = results["models"]["logreg"]["test_by_k"]
    ax2.plot(ks, [by_k[k]["yuksek_guven"]["precision"] * 100 for k in ks], marker="o", color=ORANGE, label="kesinlik")
    ax2.plot(ks, [by_k[k]["yuksek_guven"]["recall"] * 100 for k in ks], marker="o", color=TEAL, label="yakalanan döngü")
    ax2.plot(ks, [by_k[k]["positive_rate"] * 100 for k in ks], ls="--", color=GREY, label="döngü oranı")
    ax2.set(xlabel="modelin gördüğü mesaj sayısı (k)", ylabel="%", ylim=(0, None),
            title="Yüksek güven ve kanıt şartıyla LogReg (test)")
    ax2.set_xticks(ks)
    ax2.legend()
    save(fig, "26_turn_model_by_k.png")

    # 27: kalibrasyon
    _, _, _, _, raw, prob = calibrated["logreg"]
    y = test["label"].to_numpy()
    fig, ax = plt.subplots(figsize=(5.5, 4.5))
    for p, color, label in [(raw, GREY, "ham olasılık"), (prob, TEAL, "kalibre olasılık")]:
        frac, mean = calibration_curve(y, p, n_bins=10, strategy="quantile")
        ax.plot(mean, frac, marker="o", color=color,
                label=f"{label} (ECE {expected_calibration_error(y, p):.3f})")
    ax.plot([0, 1], [0, 1], ls="--", color="#888", lw=1)
    ax.set(xlabel="modelin söylediği döngü olasılığı", ylabel="gerçekleşen döngü oranı",
           title="Olasılık kalibrasyonu (LogReg, test)", xlim=(0, 1), ylim=(0, 1))
    ax.legend(fontsize=8)
    save(fig, "27_calibration.png")

    # 28: yüksek güvenle işaretlenen sohbetlerde gerekçe dağılımı
    if len(share):
        labels = [reasons["reasons"].get(k, {}).get("short", k) for k in share.index]
        prec = results["precision_by_reason_high_conf"]
        fig, ax = plt.subplots(figsize=(8, 0.5 * len(share) + 1.5))
        ax.barh(labels[::-1], (share.values * 100)[::-1], color=TEAL)
        for i, k in enumerate(list(share.index)[::-1]):
            ax.text(share[k] * 100 + 0.5, i, f"%{share[k]*100:.0f}  (bu gerekçede isabet %{prec.get(k, 0)*100:.0f})",
                    va="center", fontsize=8)
        ax.set(xlabel="yüksek güvenle işaretlenen test örneklerinin %",
               title="Model öneri gösterirken hangi gerekçeyi söyleyecek?", xlim=(0, share.max() * 135))
        save(fig, "28_reasons.png")


if __name__ == "__main__":
    main()
