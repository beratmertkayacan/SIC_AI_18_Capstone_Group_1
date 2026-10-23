"""Model keşfi: beş yöntemi kullanıcı bazlı çapraz doğrulamayla karşılaştırır.

Soru aynı: kullanıcının ilk iki mesajına bakarak sohbetin sonradan döngüye girip girmeyeceğini
tahmin edebiliyor muyuz? Bu script ilk denemeye (train_baseline.py) göre dört şey ekliyor:

    1. Daha büyük ve güncel veri: WildChat 4.8M'deki çok turlu sohbetler.
    2. Hiperparametre araması: her model için küçük bir ızgara, 5 katlı GroupKFold ile.
       Katlar kullanıcıya göre ayrılır; aynı kişi hem eğitimde hem doğrulamada olmaz.
    3. Karar eşiği test verisine bakmadan seçilir: eğitim verisindeki katlar dışı
       (out-of-fold) tahminlerde F1'i en yüksek yapan eşik.
    4. Dış testler: Türkçe sohbetler, WildChat 1M ve WildFeedback. Türkçe sohbeti olan
       kullanıcılar eğitimden tamamen çıkarılır; diğer tablolarda eğitimde görülen kullanıcılar
       ve sohbetler dış testten çıkarılır. WildFeedback'te model, kendi etiketimizin yanında
       insan benzeri memnuniyetsizlik (DSAT) etiketine karşı da ölçülür.

Karşılaştırılan yöntemler:
    kural          eklentinin bugünkü mantığı: ikinci mesaj birinciye 0,8 üstü benziyorsa ya da
                   ikinci mesajda güçlü onarım ifadesi varsa "risk"
    logreg_base    ilk denemedeki 11 öznitelikle Logistic Regression
    logreg         genişletilmiş 25 öznitelikle Logistic Regression
    logreg_text    25 öznitelik ve ilk iki mesajın karakter n-gramları ile Logistic Regression
    xgboost        25 öznitelikle XGBoost (karar ağacı topluluğu), SHAP ile açıklanır

Çalıştırma (önce build_dataset.py ile tablolar hazırlanır):
    python scripts/train_models.py
Çıktılar:
    outputs/model_metrics.json, outputs/logreg_model.json
    figures/20_cv_scores.png ... figures/24_external_validation.png
"""

import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.compose import ColumnTransformer  # noqa: E402
from sklearn.feature_extraction.text import HashingVectorizer  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import (average_precision_score, brier_score_loss, confusion_matrix, f1_score,  # noqa: E402
                             precision_recall_curve, precision_score, recall_score, roc_auc_score,
                             roc_curve)
from sklearn.model_selection import GridSearchCV, GroupKFold, cross_val_predict  # noqa: E402
from sklearn.pipeline import Pipeline  # noqa: E402
from sklearn.preprocessing import StandardScaler  # noqa: E402
from xgboost import XGBClassifier  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai.config import CV_FOLDS, EXT_SIMILARITY_THRESHOLD, SEED, TEST_SIZE  # noqa: E402
from kafiai.data import PROCESSED  # noqa: E402
from kafiai.features import BASE_FEATURES, FEATURE_COLUMNS  # noqa: E402
from kafiai.split import user_split  # noqa: E402

FIG = ROOT / "figures"
OUT = ROOT / "outputs"
COLORS = {"kural": "#9AA5A8", "logreg_base": "#7FB3BC", "logreg": "#1F5F6B",
          "logreg_text": "#C4562A", "xgboost": "#D9A441"}
NAMES = {"kural": "Kural", "logreg_base": f"LogReg ({len(BASE_FEATURES)} öznitelik)",
         "logreg": f"LogReg ({len(FEATURE_COLUMNS)} öznitelik)",
         "logreg_text": "LogReg + metin", "xgboost": "XGBoost"}
plt.rcParams.update({"figure.dpi": 130, "axes.spines.top": False, "axes.spines.right": False,
                     "font.size": 9.5})


# ---------------------------------------------------------------------------
# Modeller ve hiperparametre ızgaraları
# ---------------------------------------------------------------------------

def make_models(pos_weight):
    """Her model için (pipeline, ızgara, kullandığı kolonlar) döner."""
    logreg = LogisticRegression(max_iter=2000, class_weight="balanced")
    text_features = ColumnTransformer([
        ("sayisal", StandardScaler(), FEATURE_COLUMNS),
        # Eğitim gerektirmeyen karakter n-gram özeti; eklentideki benzerlik hesabıyla aynı fikir.
        ("metin", HashingVectorizer(analyzer="char_wb", ngram_range=(3, 5), n_features=2**16,
                                    alternate_sign=False, norm="l2"), "text"),
    ])
    return {
        "logreg_base": (Pipeline([("olcek", StandardScaler()), ("model", logreg)]),
                        {"model__C": [0.01, 0.1, 1, 10]}, BASE_FEATURES),
        "logreg": (Pipeline([("olcek", StandardScaler()), ("model", logreg)]),
                   {"model__C": [0.01, 0.1, 1, 10]}, FEATURE_COLUMNS),
        "logreg_text": (Pipeline([("oznitelik", text_features), ("model", logreg)]),
                        {"model__C": [0.03, 0.1, 0.3, 1]}, FEATURE_COLUMNS + ["text"]),
        "xgboost": (XGBClassifier(scale_pos_weight=pos_weight, subsample=0.8, colsample_bytree=0.8,
                                  random_state=SEED, eval_metric="aucpr", n_jobs=2),
                    {"max_depth": [3, 5], "n_estimators": [200, 400], "learning_rate": [0.03, 0.1],
                     "min_child_weight": [1, 5]}, FEATURE_COLUMNS),
    }


def rule_scores(X):
    """Öğrenmeyen kural (eklentinin bugünkü şeridi): benzer mesaj ya da güçlü onarım ifadesi."""
    return ((X["ext_sim"] >= EXT_SIMILARITY_THRESHOLD) | (X["second_strong_repair"] > 0)).astype(float).to_numpy()


def best_f1_threshold(y, prob):
    """F1'i en yüksek yapan eşik. Yalnızca eğitim verisinin katlar dışı tahminleriyle çağrılır."""
    precision, recall, thresholds = precision_recall_curve(y, prob)
    f1 = 2 * precision * recall / np.clip(precision + recall, 1e-9, None)
    return float(thresholds[int(np.argmax(f1[:-1]))])


def scores(y, prob, threshold):
    pred = (prob >= threshold).astype(int)
    return {
        "pr_auc": round(float(average_precision_score(y, prob)), 4),
        "roc_auc": round(float(roc_auc_score(y, prob)), 4),
        "precision": round(float(precision_score(y, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y, pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y, pred, zero_division=0)), 4),
        "brier": round(float(brier_score_loss(y, np.clip(prob, 0, 1))), 4),
        "threshold": round(float(threshold), 4),
        "confusion_matrix": confusion_matrix(y, pred).tolist(),
    }


# ---------------------------------------------------------------------------
# Ana akış
# ---------------------------------------------------------------------------

def load_table(source):
    path = PROCESSED / f"train_table_{source}.parquet"
    if not path.exists():
        sys.exit(f"{path.name} yok. Önce 'python scripts/build_dataset.py --source {source}' çalıştırın.")
    return pd.read_parquet(path)


def main():
    table = load_table("48m")
    # Türkçe sohbetler ayrı test seti olacağı için bu kullanıcıların hiçbir sohbeti eğitime girmez.
    turkish_path = PROCESSED / "train_table_48m_turkish.parquet"
    if turkish_path.exists():
        turkish_users = set(pd.read_parquet(turkish_path)["hashed_ip"])
        table = table[~table["hashed_ip"].isin(turkish_users)].reset_index(drop=True)
    train_idx, test_idx = user_split(table, test_size=TEST_SIZE)
    train, test = table.loc[train_idx].reset_index(drop=True), table.loc[test_idx].reset_index(drop=True)
    y_train, y_test, groups = train["label"], test["label"], train["hashed_ip"]
    print(f"Eğitim {len(train):,} / test {len(test):,} sohbet; pozitif oranı %{y_test.mean()*100:.1f}")

    # Dış test tabloları: eğitimde görülen kullanıcılar ve sohbetler çıkarılır.
    seen_users, seen_convs = set(train["hashed_ip"]), set(train["conversation_hash"])
    external = {}
    seen_texts = set(train["text"].str.replace(" \n ", " ").str.strip().str.lower())
    for name in ["48m_turkish", "1m", "wildfeedback"]:
        path = PROCESSED / f"train_table_{name}.parquet"
        if path.exists():
            ext = pd.read_parquet(path)
            ext = ext[~ext["hashed_ip"].isin(seen_users) & ~ext["conversation_hash"].isin(seen_convs)]
            if "text_key" in ext.columns:  # WildFeedback de WildChat'ten geliyor; aynı sohbetler çıkarılır
                ext = ext[~ext["text_key"].isin(seen_texts)]
            external[name] = ext.reset_index(drop=True)
            print(f"Dış test {name}: {len(ext):,} sohbet, pozitif %{ext['label'].mean()*100:.1f}")

    cv = GroupKFold(n_splits=CV_FOLDS, shuffle=True, random_state=SEED)
    pos_weight = float((y_train == 0).sum() / max((y_train == 1).sum(), 1))
    results = {
        "train_source": "48m", "n_train": len(train), "n_test": len(test),
        "n_train_users": int(groups.nunique()), "positive_rate_test": round(float(y_test.mean()), 4),
        "random_pr_auc": round(float(y_test.mean()), 4), "cv_folds": CV_FOLDS, "models": {},
    }
    test_probs, cv_fold_scores, fitted = {}, {}, {}

    # 1. Kural: öğrenme yok, yalnızca test ve dış testlerde ölçülür.
    rule_prob = rule_scores(test)
    results["models"]["kural"] = {"test": scores(y_test, rule_prob, 0.5)}
    test_probs["kural"] = rule_prob
    for name, ext in external.items():
        results["models"]["kural"][name] = scores(ext["label"], rule_scores(ext), 0.5)
        if "label_dsat" in ext.columns:
            results["models"]["kural"][name + "_dsat"] = scores(ext["label_dsat"], rule_scores(ext), 0.5)

    # 2. Öğrenen modeller: ızgara araması, eşik seçimi, test.
    for name, (estimator, grid, columns) in make_models(pos_weight).items():
        print(f"\n{NAMES[name]}: {np.prod([len(v) for v in grid.values()])} ayar x {CV_FOLDS} kat")
        search = GridSearchCV(estimator, grid, scoring="average_precision", cv=cv, n_jobs=1, refit=True)
        search.fit(train[columns], y_train, groups=groups)
        best = search.best_index_
        folds = [search.cv_results_[f"split{i}_test_score"][best] for i in range(CV_FOLDS)]
        cv_fold_scores[name] = folds

        oof = cross_val_predict(search.best_estimator_, train[columns], y_train, groups=groups, cv=cv,
                                method="predict_proba")[:, 1]
        threshold = best_f1_threshold(y_train, oof)
        prob = search.predict_proba(test[columns])[:, 1]
        test_probs[name], fitted[name] = prob, search.best_estimator_

        entry = {
            "best_params": {k: (float(v) if isinstance(v, float) else v) for k, v in search.best_params_.items()},
            "cv_pr_auc_mean": round(float(np.mean(folds)), 4),
            "cv_pr_auc_std": round(float(np.std(folds)), 4),
            "test": scores(y_test, prob, threshold),
        }
        for ext_name, ext in external.items():
            ext_prob = search.predict_proba(ext[columns])[:, 1]
            entry[ext_name] = scores(ext["label"], ext_prob, threshold)
            if "label_dsat" in ext.columns:
                entry[ext_name + "_dsat"] = scores(ext["label_dsat"], ext_prob, threshold)
        results["models"][name] = entry
        print(f"  en iyi {search.best_params_}, CV PR-AUC {entry['cv_pr_auc_mean']:.3f} "
              f"± {entry['cv_pr_auc_std']:.3f}, test PR-AUC {entry['test']['pr_auc']:.3f}")

    for name, ext in external.items():
        results[f"{name}_positive_rate"] = round(float(ext["label"].mean()), 4)
        results[f"{name}_n"] = int(len(ext))
        if "label_dsat" in ext.columns:
            results[f"{name}_dsat_positive_rate"] = round(float(ext["label_dsat"].mean()), 4)
            results[f"{name}_dsat_n"] = int(len(ext))

    # 3. Açıklanabilirlik: LogReg katsayıları ve XGBoost SHAP değerleri.
    lr = fitted["logreg"]
    coefs = pd.Series(lr.named_steps["model"].coef_[0], index=FEATURE_COLUMNS)
    results["logreg_coefficients"] = coefs.round(4).sort_values(key=abs, ascending=False).to_dict()
    import shap
    sample = test[FEATURE_COLUMNS].sample(min(3000, len(test)), random_state=SEED)
    shap_values = shap.TreeExplainer(fitted["xgboost"]).shap_values(sample)
    shap_importance = pd.Series(np.abs(shap_values).mean(axis=0), index=FEATURE_COLUMNS)
    results["xgboost_mean_abs_shap"] = shap_importance.round(4).sort_values(ascending=False).to_dict()

    # Eklentiye taşınabilecek model: ölçekleme ve katsayılar tek JSON'da.
    scaler = lr.named_steps["olcek"]
    export = {"features": FEATURE_COLUMNS, "mean": scaler.mean_.round(6).tolist(),
              "scale": scaler.scale_.round(6).tolist(), "coef": coefs.round(6).tolist(),
              "intercept": round(float(lr.named_steps["model"].intercept_[0]), 6),
              "threshold": results["models"]["logreg"]["test"]["threshold"]}
    (OUT / "logreg_model.json").write_text(json.dumps(export, indent=2), encoding="utf-8")

    (OUT / "model_metrics.json").write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    draw_figures(results, y_test, test_probs, cv_fold_scores, coefs, shap_importance, external)
    print("\nYazıldı: outputs/model_metrics.json, outputs/logreg_model.json, figures/20-24")


# ---------------------------------------------------------------------------
# Grafikler
# ---------------------------------------------------------------------------

def save(fig, name):
    fig.tight_layout()
    fig.savefig(FIG / name, bbox_inches="tight")
    plt.close(fig)


def draw_figures(results, y_test, test_probs, cv_fold_scores, coefs, shap_importance, external):
    learned = list(cv_fold_scores)
    random_line = results["random_pr_auc"]

    # 20: çapraz doğrulama skorları
    fig, ax = plt.subplots(figsize=(7, 3.6))
    for i, name in enumerate(learned):
        vals = cv_fold_scores[name]
        ax.scatter([i] * len(vals), vals, color=COLORS[name], s=28, zorder=3)
        ax.plot([i - 0.25, i + 0.25], [np.mean(vals)] * 2, color=COLORS[name], lw=2.5)
    ax.axhline(random_line, ls="--", color="#888", lw=1)
    ax.text(len(learned) - 0.5, random_line, " rastgele", va="bottom", ha="right", color="#666", fontsize=8.5)
    ax.set_xticks(range(len(learned)), [NAMES[n] for n in learned])
    ax.set_ylabel("PR-AUC (her nokta bir kat)")
    ax.set_title(f"Kullanıcı bazlı {CV_FOLDS} katlı çapraz doğrulama, en iyi ayarlarla")
    save(fig, "20_cv_scores.png")

    # 21: karışıklık matrisleri
    names = list(results["models"])
    fig, axes = plt.subplots(1, len(names), figsize=(2.6 * len(names), 2.8))
    for ax, name in zip(axes, names):
        cm = np.array(results["models"][name]["test"]["confusion_matrix"])
        ax.imshow(cm, cmap="Blues")
        for (i, j), v in np.ndenumerate(cm):
            ax.text(j, i, f"{v:,}", ha="center", va="center", color="white" if v > cm.max() / 2 else "black")
        ax.set_xticks([0, 1], ["normal", "döngü"])
        ax.set_yticks([0, 1], ["normal", "döngü"])
        ax.set_xlabel("tahmin")
        ax.set_title(NAMES[name], fontsize=9)
    axes[0].set_ylabel("gerçek (zayıf etiket)")
    fig.suptitle("Test kullanıcılarında karışıklık matrisleri", y=1.02)
    save(fig, "21_confusion_matrices.png")

    # 22: PR ve ROC eğrileri
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4))
    for name, prob in test_probs.items():
        if name == "kural":
            continue
        p, r, _ = precision_recall_curve(y_test, prob)
        ax1.plot(r, p, color=COLORS[name], lw=1.6,
                 label=f"{NAMES[name]} ({results['models'][name]['test']['pr_auc']:.3f})")
        fpr, tpr, _ = roc_curve(y_test, prob)
        ax2.plot(fpr, tpr, color=COLORS[name], lw=1.6,
                 label=f"{NAMES[name]} ({results['models'][name]['test']['roc_auc']:.3f})")
    rule = results["models"]["kural"]["test"]
    ax1.scatter(rule["recall"], rule["precision"], color=COLORS["kural"], zorder=3, label="Kural (tek nokta)")
    ax1.axhline(random_line, ls="--", color="#888", lw=1, label=f"Rastgele ({random_line:.3f})")
    ax1.set(xlabel="Duyarlılık (recall)", ylabel="Kesinlik (precision)", title="Precision-Recall eğrisi")
    ax2.plot([0, 1], [0, 1], ls="--", color="#888", lw=1)
    ax2.set(xlabel="Yanlış pozitif oranı", ylabel="Doğru pozitif oranı", title="ROC eğrisi")
    ax1.legend(fontsize=7.5)
    ax2.legend(fontsize=7.5, loc="lower right")
    save(fig, "22_pr_roc_curves.png")

    # 23: öznitelik etkileri
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 5))
    top = coefs.reindex(coefs.abs().sort_values().index).tail(14)
    ax1.barh(top.index, top.values, color=["#C4562A" if v > 0 else "#1F5F6B" for v in top.values])
    ax1.axvline(0, color="#444", lw=0.8)
    ax1.set(title="LogReg katsayıları (ölçeklenmiş)", xlabel="sağa: döngü riskini artırır")
    imp = shap_importance.sort_values().tail(14)
    ax2.barh(imp.index, imp.values, color="#D9A441")
    ax2.set(title="XGBoost, ortalama |SHAP|", xlabel="tahmine ortalama katkı")
    save(fig, "23_feature_effects.png")

    # 24: dış testler (PR-AUC'nin rastgeleye oranı, her veri setinin pozitif oranı farklı)
    sets = [("test", "4.8M test", random_line)]
    labels = {"48m_turkish": "Türkçe (4.8M)", "1m": "WildChat 1M", "wildfeedback": "WildFeedback",
              "wildfeedback_dsat": "WildFeedback\nDSAT etiketi"}
    for name in external:
        sets.append((name, labels[name], results[f"{name}_positive_rate"]))
        if f"{name}_dsat_positive_rate" in results:
            sets.append((name + "_dsat", labels[name + "_dsat"], results[f"{name}_dsat_positive_rate"]))
    fig, ax = plt.subplots(figsize=(9.5, 3.8))
    width = 0.8 / len(learned)
    for i, model in enumerate(learned):
        vals = [results["models"][model][key]["pr_auc"] / base for key, _, base in sets]
        ax.bar(np.arange(len(sets)) + i * width, vals, width, color=COLORS[model], label=NAMES[model])
    ax.axhline(1, ls="--", color="#888", lw=1)
    ax.set_xticks(np.arange(len(sets)) + width * (len(learned) - 1) / 2,
                  [f"{lab}\nn={results.get(f'{k}_n', results['n_test']):,}" for k, lab, _ in sets])
    ax.set_ylabel("PR-AUC / rastgele")
    ax.set_title("Model eğitimde görmediği verilerde: rastgeleden kaç kat iyi?")
    ax.legend(fontsize=7.5, ncol=2)
    save(fig, "24_external_validation.png")


if __name__ == "__main__":
    main()
