import { describe, expect, it } from "vitest";
import rows from "../../../tests/fixtures/task_types.json";
import { taskNorm, taskType, type TaskType } from "./tasks";

/** Python tarafıyla ortak örnekler (tests/fixtures/task_types.json; tests/test_tasks.py de okur). */
const fixture = rows as { text: string; task: TaskType }[];

describe("taskType", () => {
  it.each(fixture)("$text", (row) => {
    expect(taskType(row.text)).toBe(row.task);
  });
});

describe("taskNorm", () => {
  it("her tür için bir norm döner, bilinmeyen tür 'diger' normuna düşer", () => {
    for (const t of ["kod", "ceviri", "ozet", "yazma", "soru", "diger"] as TaskType[]) {
      const n = taskNorm(t);
      expect(n).not.toBeNull();
      expect(n!.p75_turns).toBeLessThanOrEqual(n!.p90_turns);
    }
  });
});
