import { SIMILARITY_THRESHOLD } from "../config";
import { similarity } from "./similarity";
import { hasStrongRepair } from "./strong-repair";
import { taskType, type TaskType } from "./tasks";
import { normalizeText } from "./text";

/**
 * Tur modeli öznitelikleri: sohbetin o ana kadarki kullanıcı mesajlarından hesaplanır.
 * Python karşılığı src/kafiai/turn_features.py; sıra ve tanımlar birebir aynı olmalı.
 * İki tarafın aynı sayıları verdiğini tests/fixtures/turn_features_parity.json kontrol eder.
 */

export const TASK_ORDER: TaskType[] = ["kod", "ceviri", "ozet", "yazma", "soru", "diger"];
/** Python'daki EXACT_REPEAT_THRESHOLD ile aynı: birebir yeniden gönderim. */
export const EXACT_REPEAT_THRESHOLD = 0.97;
const MAX_LINES = 50;

const chars = (s: string) => Array.from(s);
const wordsLog = (s: string) => Math.log1p(s.split(/\s+/).filter((w) => w !== "").length);
const lines = (s: string) => Math.min(s.split("\n").length, MAX_LINES);
const hasCode = (s: string) => s.includes("```") || s.includes("def ") || s.includes("{");
const sim = (a: string, b: string) => similarity(normalizeText(a), normalizeText(b));

export function turnFeatures(userMessages: string[]): Record<string, number> {
  const msgs = userMessages.map((m) => m ?? "");
  const first = msgs[0] ?? "";
  const last = msgs[msgs.length - 1] ?? "";
  const sims: number[] = [];
  for (let i = 1; i < msgs.length; i++) sims.push(sim(msgs[i - 1] ?? "", msgs[i] ?? ""));
  const joined = chars(first + last);
  const task = taskType(first);

  const row: Record<string, number> = {
    turn: msgs.length,
    first_words_log: wordsLog(first),
    last_words_log: wordsLog(last),
    first_lines: lines(first),
    last_lines: lines(last),
    first_question: first.trimEnd().endsWith("?") ? 1 : 0,
    last_question: last.trimEnd().endsWith("?") ? 1 : 0,
    last_short: chars(last.trim()).length < 30 ? 1 : 0,
    digit_ratio: joined.filter((c) => /\p{Nd}/u.test(c)).length / Math.max(joined.length, 1),
    has_code: msgs.some(hasCode) ? 1 : 0,
    last_sim: sims.at(-1) ?? 0,
    max_sim: sims.length ? Math.max(...sims) : 0,
    n_similar: sims.filter((s) => s >= SIMILARITY_THRESHOLD).length,
    n_exact: sims.filter((s) => s >= EXACT_REPEAT_THRESHOLD).length,
    last_strong_repair: msgs.length > 1 && hasStrongRepair(last) ? 1 : 0,
    n_strong_repairs: msgs.slice(1).filter(hasStrongRepair).length,
  };
  for (const t of TASK_ORDER) row[`task_${t}`] = task === t ? 1 : 0;
  return row;
}
