"""İlk karşılaştırma: kural, Logistic Regression ve XGBoost.

Soru: Kullanıcının ilk iki mesajına bakarak sohbetin sonradan döngüye
gireceğini tahmin edebiliyor muyuz?

Üç yöntem aynı test kullanıcıları üzerinde karşılaştırılır:
    kural      ikinci mesaj birinciye çok benziyorsa veya onarım ifadesi içeriyorsa "risk"
    logreg     Logistic Regression, en basit öğrenen model
    xgboost    karar ağacı topluluğu, SHAP ile açıklanır

Veri dengesiz olduğu için ana metrik PR-AUC'dir. Rastgele tahminin PR-AUC değeri
pozitif sınıf oranına eşittir; bir modelin işe yaraması için bunun belirgin şekilde üstünde olması gerekir.

Çalıştırma:
    python scripts/build_dataset.py
    python scripts/train_baseline.py
"""

import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import average_precision_score, f1_score, precision_score, recall_score, roc_auc_score  # noqa: E402
from sklearn.pipeline import make_pipeline  # noqa: E402
from sklearn.preprocessing import StandardScaler  # noqa: E402
from xgboost import XGBClassifier  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai.config import REPEAT_SIM_THRESHOLD, SEED  # noqa: E402
from kafiai.features import FEATURE_COLUMNS  # noqa: E402
from kafiai.split import user_split  # noqa: E402

TABLE = ROOT / "data" / "processed" / "train_table.parquet"
METRICS = ROOT / "outputs" / "baseline_metrics.json"
FIG = ROOT / "figures" / "13_feature_importance.png"


def scores(y_true, prob, threshold):
    pred = (prob >= threshold).astype(int)
    return {
        "pr_auc": round(float(average_precision_score(y_true, prob)), 4),
        "roc_auc": round(float(roc_auc_score(y_true, prob)), 4),
        "precision": round(float(precision_score(y_true, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, pred, zero_division=0)), 4),
        "threshold": round(float(threshold), 4),
    }


def best_threshold(y_true, prob):
    """Eğitim verisinde F1'i en yüksek yapan eşik. Test verisine bakılmaz."""
    candidates = np.unique(np.quantile(prob, np.linspace(0.5, 0.995, 100)))
    f1s = [f1_score(y_true, (prob >= t).astype(int), zero_division=0) for t in candidates]
    return float(candidates[int(np.argmax(f1s))])


def main():
    if not TABLE.exists():
        sys.exit("Önce 'python scripts/build_dataset.py' çalıştırın.")

    table = pd.read_parquet(TABLE)
    train_idx, test_idx = user_split(table)
    train, test = table.loc[train_idx], table.loc[test_idx]
    X_train, y_train = train[FEATURE_COLUMNS], train["label"]
    X_test, y_test = test[FEATURE_COLUMNS], test["label"]
    print(f"Eğitim {len(train):,} sohbet / test {len(test):,} sohbet, kullanıcılar ayrık")
    print(f"Pozitif oranı: eğitim %{y_train.mean()*100:.1f}, test %{y_test.mean()*100:.1f}")

    results = {"n_train": int(len(train)), "n_test": int(len(test)),
               "positive_rate_test": round(float(y_test.mean()), 4),
               "random_pr_auc": round(float(y_test.mean()), 4), "models": {}}

    # 1. Kural (öğrenme yok)
    rule_prob = ((X_test["sim_max"] >= REPEAT_SIM_THRESHOLD) | (X_test["n_repairs"] > 0)).astype(float)
    results["models"]["kural"] = scores(y_test, rule_prob.values, 0.5)

    # 2. Logistic Regression
    logreg = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000, class_weight="balanced"))
    logreg.fit(X_train, y_train)
    t = best_threshold(y_train, logreg.predict_proba(X_train)[:, 1])
    results["models"]["logreg"] = scores(y_test, logreg.predict_proba(X_test)[:, 1], t)

    # 3. XGBoost
    ratio = (y_train == 0).sum() / max((y_train == 1).sum(), 1)
    xgb = XGBClassifier(n_estimators=300, max_depth=4, learning_rate=0.05, subsample=0.8,
                        colsample_bytree=0.8, scale_pos_weight=ratio, random_state=SEED,
                        eval_metric="aucpr")
    xgb.fit(X_train, y_train)
    t = best_threshold(y_train, xgb.predict_proba(X_train)[:, 1])
    results["models"]["xgboost"] = scores(y_test, xgb.predict_proba(X_test)[:, 1], t)

    # Hangi öznitelik ne kadar etkili? (SHAP)
    try:
        import shap
        sample = X_test.sample(min(2000, len(X_test)), random_state=SEED)
        shap_values = shap.TreeExplainer(xgb).shap_values(sample)
        importance = pd.Series(np.abs(shap_values).mean(axis=0), index=FEATURE_COLUMNS).sort_values()
        results["xgboost_mean_abs_shap"] = importance.round(4)[::-1].to_dict()

        fig, ax = plt.subplots(figsize=(7, 4.5))
        ax.barh(importance.index, importance.values, color="#1F5F6B")
        ax.set_xlabel("Ortalama |SHAP| değeri")
        ax.set_title("Döngü tahmininde özniteliklerin etkisi (XGBoost)")
        ax.spines[["top", "right"]].set_visible(False)
        fig.tight_layout()
        fig.savefig(FIG, dpi=150)
        print(f"Grafik yazıldı: {FIG.relative_to(ROOT)}")
    except ImportError:
        print("shap kurulu değil, öznitelik önemi atlandı (pip install shap)")

    METRICS.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(results["models"], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
