// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import manifest from "../public/manifest.json";
import { BRAND_NAME, BRAND_TAGLINE, LOGO_PATHS, logoMark, sitesList, SUPPORTED_SITES } from "./brand";
import platforms from "./data/platforms.json";
import { WELCOME_LEAD, WELCOME_SECTIONS } from "./welcome/welcome";

describe("marka", () => {
  it("manifestteki ad ve açıklama markayla aynı", () => {
    expect(manifest.name).toBe(BRAND_NAME);
    expect(manifest.action.default_title).toBe(BRAND_NAME);
    expect(manifest.description.startsWith(BRAND_TAGLINE)).toBe(true);
  });

  it("desteklenen siteler platform kaydından gelir ve metinlerde aynen geçer", () => {
    expect(SUPPORTED_SITES).toEqual(Object.values(platforms.platforms).map((p) => p.label));
    const text = [WELCOME_LEAD, ...WELCOME_SECTIONS.flatMap((s) => s.lines)].join(" ");
    for (const site of SUPPORTED_SITES) expect(text).toContain(site);
    expect(sitesList()).toBe(SUPPORTED_SITES.length === 2 ? `${SUPPORTED_SITES[0]} ve ${SUPPORTED_SITES[1]}` : sitesList());
  });

  it("logo işareti üç yaydan oluşur, rengini currentColor'dan alır", () => {
    const svg = logoMark(20);
    const paths = svg.querySelectorAll("path");
    expect(paths.length).toBe(LOGO_PATHS.length);
    expect(LOGO_PATHS.length).toBe(3);
    for (const p of Array.from(paths)) expect(p.getAttribute("fill")).toBe("currentColor");
  });

  it("şapka yalnızca marka adında; slogan ve diğer metinler şapkasız", () => {
    expect(/[âîû]/i.test(BRAND_TAGLINE)).toBe(false);
    const text = [WELCOME_LEAD, ...WELCOME_SECTIONS.flatMap((s) => s.lines)].join(" ").split(BRAND_NAME).join("");
    expect(/[âîûÂÎÛ]/.test(text)).toBe(false);
  });
});
