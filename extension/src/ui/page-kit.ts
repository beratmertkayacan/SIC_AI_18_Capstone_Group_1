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

/** Gizlilik rozeti. Anlam desteği açıkken "cihazında kalır" demek yanlış olur; o zaman ne gittiğini söyler. */
export function privacyChip(semantic = false): HTMLElement {
  return el("span", "privacy-chip", semantic ? "Anlam desteği açık" : "Veriler cihazında kalır");
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
 * Bilgi düğmesi ve açıklama kutusu. Kutu üzerine gelince, klavyeyle odaklanınca ya da basınca açılır;
 * fare kutunun üzerine geçerken kapanmaz. Esc (odak nerede olursa olsun), odağın ayrılması ya da
 * farenin çıkmasıyla kapanır (WCAG 1.4.13). Ekran okuyucu düğmeyi kutunun metniyle birlikte okur.
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
  let open = false;
  // Tıklamayla sabitlenen kutu fare çekilince kapanmaz; ikinci tıklama, Esc ya da odağın ayrılması kapatır.
  let pinned = false;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      pinned = false;
      set(false);
    }
  };
  const set = (value: boolean) => {
    if (value === open) return;
    open = value;
    wrap.classList.toggle("open", value);
    btn.setAttribute("aria-expanded", String(value));
    // Esc yalnızca kutu açıkken dinlenir; sayfa yeniden çizilince dinleyici kalmaz.
    if (value) document.addEventListener("keydown", onKey);
    else document.removeEventListener("keydown", onKey);
  };
  // Fareyle basınca tarayıcı önce odak verir: odak açmasın, yoksa hemen ardından gelen tıklama kutuyu kapatır.
  let pointer = false;
  btn.addEventListener("pointerdown", () => { pointer = true; });
  btn.addEventListener("focus", () => {
    if (!pointer) set(true);
    pointer = false;
  });
  // Fare üzerine gelince kutu zaten açılmış olur; tıklama onu kapatmaz, sabitler (ikinci tıklama kapatır).
  btn.addEventListener("click", () => {
    pinned = !pinned;
    set(pinned);
  });
  btn.addEventListener("blur", () => {
    pinned = false;
    set(false);
  });
  wrap.addEventListener("mouseenter", () => set(true));
  wrap.addEventListener("mouseleave", () => {
    if (!pinned && document.activeElement !== btn) set(false);
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
