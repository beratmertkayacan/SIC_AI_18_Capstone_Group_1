"""Tur modelinin tahmin hesabı; eklentideki src/core/turn-model.ts ile birebir aynı.

Model dosyası (extension/src/data/turn-model.json) scripts/train_turn_model.py ile üretilir.
Bu modül hem testlerde hem de parite örneklerini üretirken kullanılır: Python'da 0,31 çıkan
olasılık tarayıcıda da 0,31 çıkmalı.
"""

import json
import math
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "extension" / "src" / "data"
MODEL_FILE = DATA / "turn-model.json"
REASONS_FILE = DATA / "model-reasons.json"


def load_model():
    return json.loads(MODEL_FILE.read_text(encoding="utf-8"))


def load_reasons():
    return json.loads(REASONS_FILE.read_text(encoding="utf-8"))["reasons"]


def _sigmoid(z):
    return 1 / (1 + math.exp(-z))


def _logit(p):
    q = min(max(p, 1e-6), 1 - 1e-6)
    return math.log(q / (1 - q))


def predict(features, model=None, reasons=None, max_reasons=2):
    """Öznitelik sözlüğünden {olasılık, seviye, gerekçe anahtarları} döner."""
    model = model or load_model()
    reasons = reasons or load_reasons()
    values = dict(features, turn=min(features.get("turn", 0), model["max_turn"]))
    contrib = [c * (values.get(name, 0) - m) / s
               for name, c, m, s in zip(model["features"], model["coef"], model["mean"], model["scale"])]
    raw = _sigmoid(model["intercept"] + sum(contrib))
    probability = _sigmoid(model["platt"]["a"] * _logit(raw) + model["platt"]["b"])
    cuts = model["thresholds"]
    # Kanıt şartı: yüksek güven için sohbette en az bir güçlü onarım ifadesi görülmüş olmalı.
    evidence = features.get(model.get("high_requires", ""), 1) >= 1
    if probability >= cuts["yuksek_guven"] and evidence:
        level = "yuksek"
    elif probability >= cuts["oneri"]:
        level = "oneri"
    else:
        level = "dusuk"
    ranked = sorted(((v, n) for n, v in zip(model["features"], contrib) if v > 0 and n in reasons), reverse=True)
    keys = [n for _, n in ranked[:max_reasons]] or ["genel"]
    return {"probability": probability, "level": level, "reasons": keys}
