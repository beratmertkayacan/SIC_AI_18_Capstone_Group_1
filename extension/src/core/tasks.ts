import rules from "../data/task-rules.json";
import norms from "../data/task-norms.json";
import { normalizeText } from "./text";

/**
 * Sohbetin ilk mesajından görev türünü tahmin eder. Kurallar src/data/task-rules.json
 * dosyasında; Python tarafı (src/kafiai/tasks.py) aynı dosyayı okur. Normlar
 * src/data/task-norms.json dosyasında; scripts/calibrate_extension.py WildChat'ten üretir.
 */

export type TaskType = "kod" | "ceviri" | "ozet" | "yazma" | "soru" | "diger";

interface Rule {
  markers?: string[];
  words?: string[];
  prefixes?: string[];
  phrases?: string[];
  ends_with_question?: boolean;
}

export interface TaskNorm {
  label: string;
  median_turns: number;
  p75_turns: number;
  p90_turns: number;
}

function matches(rule: Rule, rawLower: string, normalized: string, words: Set<string>): boolean {
  if ((rule.markers ?? []).some((m) => rawLower.includes(m))) return true;
  if ((rule.words ?? []).some((w) => words.has(w))) return true;
  const prefixes = rule.prefixes ?? [];
  for (const w of words) if (prefixes.some((p) => w.startsWith(p))) return true;
  const padded = ` ${normalized} `;
  if ((rule.phrases ?? []).some((p) => padded.includes(` ${p} `))) return true;
  return rule.ends_with_question === true && rawLower.trimEnd().endsWith("?");
}

export function taskType(firstMessage: string): TaskType {
  // Python'daki dilimleme kod noktasına göre; aynısı için Array.from kullanılır.
  const head = Array.from(firstMessage).slice(0, rules.head_chars).join("");
  const rawLower = head.toLowerCase();
  const normalized = normalizeText(head);
  const words = new Set(normalized.split(" ").filter((w) => w !== ""));
  for (const name of rules.order) {
    const rule = (rules.rules as Record<string, Rule>)[name];
    if (rule && matches(rule, rawLower, normalized, words)) return name as TaskType;
  }
  return rules.fallback as TaskType;
}

/** Görev türünün normu; norm dosyasında yoksa "diger" normu döner. */
export function taskNorm(task: TaskType): TaskNorm | null {
  const table = norms.norms as Record<string, TaskNorm>;
  return table[task] ?? table["diger"] ?? null;
}
