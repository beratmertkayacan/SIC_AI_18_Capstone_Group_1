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

/** Bir sadeleştirilmiş biçim: metnin kendisi ve kelime kümesi. */
interface Form {
  normalized: string;
  words: Set<string>;
}

function matches(rule: Rule, rawLower: string, forms: Form[]): boolean {
  if ((rule.markers ?? []).some((m) => rawLower.includes(m))) return true;
  const prefixes = rule.prefixes ?? [];
  for (const { normalized, words } of forms) {
    if ((rule.words ?? []).some((w) => words.has(w))) return true;
    for (const w of words) if (prefixes.some((p) => w.startsWith(p))) return true;
    const padded = ` ${normalized} `;
    if ((rule.phrases ?? []).some((p) => padded.includes(` ${p} `))) return true;
  }
  return rule.ends_with_question === true && rawLower.trimEnd().endsWith("?");
}

export function taskType(firstMessage: string): TaskType {
  // Python'daki dilimleme kod noktasına göre; aynısı için Array.from kullanılır.
  const head = Array.from(firstMessage).slice(0, rules.head_chars).join("");
  const rawLower = head.toLowerCase();
  // Türkçe kural "I"yı "ı" yapar ("API" -> "apı"); İngilizce kısaltmalar için ikinci biçim (strong-repair.ts ile aynı).
  const variants = new Set([normalizeText(head), normalizeText(head.replace(/I/g, "i"))]);
  const forms: Form[] = [...variants].map((normalized) => ({
    normalized,
    words: new Set(normalized.split(" ").filter((w) => w !== "")),
  }));
  for (const name of rules.order) {
    const rule = (rules.rules as Record<string, Rule>)[name];
    if (rule && matches(rule, rawLower, forms)) return name as TaskType;
  }
  return rules.fallback as TaskType;
}

/** Görev türünün normu; norm dosyasında yoksa "diger" normu döner. */
export function taskNorm(task: TaskType): TaskNorm | null {
  const table = norms.norms as Record<string, TaskNorm>;
  return table[task] ?? table["diger"] ?? null;
}
