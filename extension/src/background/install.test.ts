import { describe, expect, it, vi } from "vitest";
import { openWelcomeOnInstall } from "./install";

describe("openWelcomeOnInstall", () => {
  it("ilk kurulumda açar", () => {
    const open = vi.fn();
    expect(openWelcomeOnInstall({ reason: "install" }, open)).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
  });
  it("güncellemede ve diğer nedenlerde açmaz", () => {
    const open = vi.fn();
    for (const reason of ["update", "chrome_update", "shared_module_update"]) {
      expect(openWelcomeOnInstall({ reason }, open)).toBe(false);
    }
    expect(open).not.toHaveBeenCalled();
  });
});
