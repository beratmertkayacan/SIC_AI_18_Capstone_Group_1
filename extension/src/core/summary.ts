import { COUNTER_NAMES, dayKey, type CounterName, type DailyCounts } from "./settings";

/** Bugün dahil son `days` günün sayaç toplamları. */
export function recentTotals(counts: DailyCounts, now: Date, days = 7): Record<CounterName, number> {
  const totals = Object.fromEntries(COUNTER_NAMES.map((n) => [n, 0])) as Record<CounterName, number>;
  const wanted = new Set<string>();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    wanted.add(dayKey(d));
  }
  for (const [day, row] of Object.entries(counts)) {
    if (!wanted.has(day)) continue;
    for (const name of COUNTER_NAMES) totals[name] += row[name] ?? 0;
  }
  return totals;
}
