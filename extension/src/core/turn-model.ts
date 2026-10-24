import model from "../data/turn-model.json";
import reasonTable from "../data/model-reasons.json";

/**
 * Tur modeli: kullanıcının o ana kadarki mesajlarından sohbetin döngüye girme olasılığını tahmin eder.
 * Katsayılar, ölçekleme, kalibrasyon ve eşikler src/data/turn-model.json dosyasında;
 * scripts/train_turn_model.py WildChat 4.8M üzerinde eğitip yazar. Hesap kütüphanesiz:
 *
 *   ham    = sigmoid(sabit + Σ katsayı × (değer − ortalama) / ölçek)
 *   olasılık = sigmoid(a × logit(ham) + b)          (Platt kalibrasyonu)
 *
 * Gerekçe, olasılığı en çok artıran özniteliktir; kullanıcıya src/data/model-reasons.json
 * içindeki karşılığı gösterilir.
 */

export type RiskLevel = "dusuk" | "oneri" | "yuksek";

export interface Reason {
  key: string;
  short: string;
  why: string;
  tip: string;
}

export interface Prediction {
  probability: number;
  level: RiskLevel;
  reasons: Reason[];
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const logit = (p: number) => {
  const q = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
  return Math.log(q / (1 - q));
};

const reasons = reasonTable.reasons as unknown as Record<string, Omit<Reason, "key">>;

export const MODEL_FEATURES: string[] = model.features;
export const MODEL_MIN_TURN: number = model.min_turn;

/** Ölçeklenmiş değer × katsayı: her özniteliğin tahmine katkısı (logit cinsinden). */
export function contributions(features: Record<string, number>): number[] {
  return model.features.map((name, i) => {
    const value = features[name] ?? 0;
    return ((model.coef[i] ?? 0) * (value - (model.mean[i] ?? 0))) / (model.scale[i] ?? 1);
  });
}

export function predict(features: Record<string, number>, maxReasons = 2): Prediction {
  // Model en çok max_turn turla eğitildi; daha uzun sohbetlerde tur sayısı orada sabitlenir.
  const clipped = { ...features, turn: Math.min(features.turn ?? 0, model.max_turn) };
  const contrib = contributions(clipped);
  const raw = sigmoid(model.intercept + contrib.reduce((a, b) => a + b, 0));
  const probability = sigmoid(model.platt.a * logit(raw) + model.platt.b);

  // Kanıt şartı: yüksek güven için sohbette en az bir güçlü onarım ifadesi görülmüş olmalı.
  const evidence = (features[model.high_requires] ?? 0) >= 1;
  const level: RiskLevel =
    probability >= model.thresholds.yuksek_guven && evidence
      ? "yuksek"
      : probability >= model.thresholds.oneri
        ? "oneri"
        : "dusuk";

  const picked = model.features
    .map((name, i) => ({ name, value: contrib[i] ?? 0 }))
    .filter((c) => c.value > 0 && c.name in reasons)
    .sort((a, b) => b.value - a.value)
    .slice(0, maxReasons)
    .map((c): Reason => ({ key: c.name, ...(reasons[c.name] as Omit<Reason, "key">) }));
  if (picked.length === 0) picked.push({ key: "genel", ...(reasons["genel"] as Omit<Reason, "key">) });

  return { probability, level, reasons: picked };
}
