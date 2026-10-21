import { describe, expect, it } from "vitest";
import { sendCounters } from "./send-stats";

describe("sendCounters", () => {
  it("kısa mesaj hiçbir sayaca girmez", () => {
    expect(sendCounters({ similar: false, tooShort: true }, true)).toEqual([]);
    expect(sendCounters({ similar: false, tooShort: true }, false)).toEqual([]);
  });
  it("öneriler açıkken farklı mesaj yalnızca karşılaştırılan sayısını artırır", () => {
    expect(sendCounters({ similar: false, tooShort: false }, true)).toEqual(["checkedSendsOn"]);
  });
  it("öneriler açıkken benzer mesaj benzer sayısını da artırır, 'gösterilecekti' saymaz", () => {
    expect(sendCounters({ similar: true, tooShort: false }, true)).toEqual(["checkedSendsOn", "similarSendsOn"]);
  });
  it("yalnızca say modunda farklı mesaj kapalı sayacını artırır", () => {
    expect(sendCounters({ similar: false, tooShort: false }, false)).toEqual(["checkedSendsOff"]);
  });
  it("yalnızca say modunda benzer mesaj ayrıca 'şerit gösterilecekti' sayılır", () => {
    expect(sendCounters({ similar: true, tooShort: false }, false)).toEqual([
      "checkedSendsOff",
      "similarSendsOff",
      "stripWouldShow",
    ]);
  });
});
