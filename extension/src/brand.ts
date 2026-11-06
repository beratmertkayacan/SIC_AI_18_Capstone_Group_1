import platforms from "./data/platforms.json";

/**
 * Marka: ad, slogan, renkler, logo işareti ve desteklenen sitelerin adları. Arayüzdeki her yüzey
 * (kartlar, halka, pencere, karşılama ekranı) buradan beslenir; ad ya da renk tek yerden değişir.
 *
 * Görünen ad "Kâfi". Kodun içindeki teknik adlar (kafiai.* depolama anahtarları, klasörler) kullanıcı
 * verisi kaybolmasın diye değişmez. Şapka yalnızca marka adında kullanılır; diğer metinler şapkasızdır.
 */

export const BRAND_NAME = "Kâfi";
export const BRAND_TAGLINE = "Fark et. Durakla. Yeniden başla.";

/** Marka paleti (tasarım panosundaki değerler). */
export const PALETTE = {
  brown: "#44321B", // kahverengi: koyu zemin ve ana düğme
  beige: "#D2B48C", // bej
  cream: "#F7EFE3", // krem: açık zemin
  earth: "#8B6B46", // toprak: açık temada vurgu
  amber: "#C9A875", // amber: koyu temada vurgu
} as const;

/**
 * Logo işaretinin üç yayı, 100x100 kutuda. Uygulama simgesindeki krem yayların kenar çizgisinden
 * birebir çıkarıldı (brand/logo-kaynak.png); el çizimi bir benzeri değildir. Renkli simgenin kendisi
 * scripts/make_brand_assets.py ile üretilen extension/public/icons/ dosyalarındadır.
 */
export const LOGO_PATHS: readonly string[] = [
  "M50.6 94.5 L46.9 94.5 L41.5 94.1 L37.4 93.3 L33.8 92.3 L29.4 90.6 L25.5 88.6 L21.2 85.9 L20.2 85.0 L20.1 84.5 L20.5 84.0 L21.1 83.9 L26.8 86.6 L30.2 87.8 L35.0 89.0 L39.2 89.6 L42.0 89.7 L46.3 89.6 L50.1 89.1 L54.4 88.2 L58.4 86.9 L62.5 85.2 L66.3 83.3 L69.5 81.2 L73.3 78.3 L76.2 75.6 L78.9 72.4 L81.4 68.9 L83.2 65.6 L84.7 62.4 L86.0 58.6 L86.8 55.5 L87.4 52.0 L87.7 47.4 L87.2 41.4 L86.2 36.3 L84.9 32.2 L82.3 26.8 L80.3 23.7 L77.7 20.3 L74.1 16.7 L71.0 14.2 L67.4 11.8 L67.6 10.7 L70.4 6.5 L71.1 5.6 L71.6 5.5 L75.1 7.4 L78.3 9.6 L81.7 12.3 L84.5 15.1 L86.7 17.9 L89.2 21.5 L92.0 26.9 L94.5 34.4 L95.3 37.9 L95.8 42.4 L96.0 45.3 L95.8 50.6 L95.4 54.5 L94.5 59.0 L93.5 62.7 L91.7 67.5 L89.9 71.2 L87.9 74.6 L83.4 80.4 L79.2 84.3 L76.2 86.5 L72.4 88.7 L69.5 90.2 L66.0 91.6 L58.3 93.6 L54.4 94.2 L50.6 94.5Z",
  "M74.1 70.3 L73.3 70.0 L73.2 69.4 L75.4 65.3 L76.7 62.2 L77.9 58.6 L78.8 53.8 L78.9 48.7 L78.5 45.0 L77.7 41.7 L76.3 37.6 L74.4 33.9 L70.6 28.5 L65.9 24.1 L60.8 20.8 L58.0 19.5 L54.8 18.3 L49.7 17.1 L47.1 16.8 L41.4 16.8 L37.6 17.3 L33.5 18.2 L29.1 19.6 L25.0 21.5 L22.3 23.1 L16.9 27.2 L13.4 30.7 L10.2 34.7 L9.4 34.5 L4.2 31.3 L4.0 30.9 L4.2 30.4 L7.0 26.3 L9.4 23.7 L14.4 19.3 L18.8 16.4 L23.9 13.8 L30.9 11.3 L35.5 10.3 L38.9 9.8 L44.2 9.5 L47.4 9.7 L51.9 10.3 L55.2 11.0 L59.6 12.5 L63.7 14.4 L67.5 16.7 L71.0 19.4 L73.5 21.8 L76.5 25.4 L78.6 28.5 L80.5 32.2 L82.2 37.0 L83.1 40.9 L83.6 44.7 L83.6 47.9 L83.1 51.9 L82.1 56.2 L80.8 59.9 L79.2 63.2 L76.5 67.5 L74.9 69.6 L74.1 70.3Z",
  "M44.7 86.2 L38.8 86.1 L32.0 84.7 L26.1 82.4 L23.8 81.0 L20.2 78.5 L15.7 73.9 L14.1 71.9 L11.5 67.8 L9.7 63.8 L8.8 61.2 L7.8 56.0 L7.6 53.5 L7.8 50.6 L8.8 45.3 L11.1 39.8 L14.8 34.2 L18.6 30.1 L20.6 28.4 L24.0 26.0 L29.7 23.3 L32.9 22.2 L36.0 21.6 L36.4 21.7 L36.7 22.1 L36.7 22.6 L36.4 22.8 L32.8 24.1 L30.1 25.5 L25.5 28.6 L22.4 31.5 L19.2 35.6 L16.6 40.5 L15.3 44.6 L14.5 49.1 L14.6 53.9 L15.9 59.6 L18.5 65.1 L20.1 67.6 L22.0 70.0 L24.3 72.3 L26.6 74.2 L31.8 77.2 L37.2 79.1 L42.3 79.8 L45.6 79.8 L50.0 79.2 L50.4 79.3 L51.8 84.2 L51.7 84.8 L48.2 85.8 L44.7 86.2Z"
];

/** Logo işaretini tek renkli SVG olarak üretir (DOM API ile; HTML eklenmez). Renk currentColor'dan gelir. */
export function logoMark(size: number): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  LOGO_PATHS.forEach((d, i) => {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "currentColor");
    path.dataset.arc = String(i);
    svg.append(path);
  });
  return svg;
}

/** Desteklenen sitelerin adları, platform kaydındaki sırayla (K19). Yeni bir site eklenince metinler de güncellenir. */
export const SUPPORTED_SITES: readonly string[] = Object.values(platforms.platforms).map((p) => p.label);

/** "ChatGPT ve Gemini", "ChatGPT, Gemini ve Claude" gibi. */
export function sitesList(joiner = "ve"): string {
  const s = SUPPORTED_SITES;
  if (s.length <= 1) return s.join("");
  return `${s.slice(0, -1).join(", ")} ${joiner} ${s[s.length - 1]}`;
}
