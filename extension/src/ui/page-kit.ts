import { BRAND_NAME, BRAND_TAGLINE } from "../brand";

/**
 * Eklenti sayfalarının (araç çubuğu penceresi, karşılama ekranı, haftalık özet) ortak parçaları.
 * Tüm metinler textContent ile yazılır; HTML eklenmez. Görünüm public/brand.css içindeki
 * bileşen sınıflarından gelir.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Eklentinin kendi logosu (pakette gelen simge; ağdan yüklenmez). */
export function logo(size: number, src = size > 48 ? "icons/logo256.png" : "icons/icon48.png"): HTMLImageElement {
  const img = el("img", "mark-logo");
  img.src = src;
  img.alt = "";
  img.width = size;
  img.height = size;
  return img;
}

export function privacyChip(): HTMLElement {
  return el("span", "privacy-chip", "Veriler cihazında kalır");
}

/** Logo, marka adı ve istenirse slogan. */
export function brandLockup(size: number, withTagline: boolean, asHeading = false): HTMLElement {
  const head = el("div", "brand-head");
  const text = el("div", "brand-text");
  text.append(el(asHeading ? "h1" : "span", "brand-name", BRAND_NAME));
  if (withTagline) text.append(el("span", "brand-tagline", BRAND_TAGLINE));
  head.append(logo(size), text);
  return head;
}

let tipSeq = 0;

/**
 * Bilgi düğmesi ve açıklama kutusu. Kutu üzerine gelince, düğmeye odaklanınca ya da basınca açılır;
 * Esc ya da odağın ayrılmasıyla kapanır. Ekran okuyucu düğmeyi kutunun metniyle birlikte okur.
 */
export function infoTip(label: string, text: string): HTMLElement {
  const id = `tip-${++tipSeq}`;
  const wrap = el("span", "info");
  const btn = el("button", "info-btn", "i");
  btn.type = "button";
  btn.setAttribute("aria-label", `${label} hakkında`);
  btn.setAttribute("aria-describedby", id);
  btn.setAttribute("aria-expanded", "false");
  const tip = el("span", "tip", text);
  tip.id = id;
  tip.setAttribute("role", "tooltip");
  const set = (open: boolean) => {
    wrap.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
  };
  btn.addEventListener("click", () => set(!wrap.classList.contains("open")));
  btn.addEventListener("focus", () => set(true));
  btn.addEventListener("blur", () => set(false));
  btn.addEventListener("keydown", (e) => {
    if (e.key === "Escape") set(false);
  });
  wrap.append(btn, tip);
  return wrap;
}

/** Tek serilik yatay çubuk; oran 0 ile 1 arasında. Ekran okuyucu için değer yanında metin olarak yazar. */
export function hbar(ratio: number, tone: "dark" | "mid" = "dark"): HTMLElement {
  const bar = el("span", tone === "mid" ? "hbar mid" : "hbar");
  bar.setAttribute("aria-hidden", "true");
  const fill = el("span");
  fill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  // Sıfır olmayan ama çok küçük değerler de görünsün diye en az 4px (bir yuvarlak uç).
  if (ratio > 0) fill.style.minWidth = "4px";
  bar.append(fill);
  return bar;
}

/** Anahtar görünümlü onay kutusu ve metni. */
export function switchRow(
  label: string,
  hint: string,
  checked: boolean,
  disabled: boolean,
  onChange: (value: boolean) => void,
): HTMLElement {
  const row = el("label", "setting");
  const text = el("span", "setting-text");
  text.append(el("span", "setting-label", label), el("span", "setting-hint", hint));
  const input = el("input", "switch");
  input.type = "checkbox";
  input.checked = checked;
  input.disabled = disabled;
  input.addEventListener("change", () => onChange(input.checked));
  row.append(text, input);
  return row;
}
