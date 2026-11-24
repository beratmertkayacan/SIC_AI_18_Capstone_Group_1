import spec from "../judge-spec.json" with { type: "json" };

/**
 * Değerlendiricinin saf parçaları: gelen turları doğrulayıp kesmek, sohbet metnini kurmak ve modelin
 * cevabını kullanıcıya gösterilebilir hale getirmek. Ağ ve API anahtarı burada yok; böylece testler
 * çevrimdışı çalışır ve Python ikizi (src/kafiai/judge.py) aynı kuralları birebir uygular.
 */

export type Rol = "k" | "a";
export interface Tur {
  rol: Rol;
  metin: string;
}

export interface Karar {
  ayni_istek: boolean;
  onceki_istek_turu: number;
  onceki_cevap_karsiladi: "evet" | "hayir" | "belirsiz";
  tikanma: boolean;
  ozur_dongusu: boolean;
  tur: "ayni_istek_yeniden" | "karsilanmayan_engel" | "ozur_dongusu" | "konu_kaymasi" | "yok";
  dongu: boolean;
  guven: number;
  gerekce: string;
  oneri: string;
}

export const SPEC = spec;

/** Gövdeyi doğrular; geçersizse null. Fazla turlar baştan atılır, uzun metinler kesilir. */
export function turlariAl(body: unknown): Tur[] | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = (body as { turlar?: unknown }).turlar;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const turlar: Tur[] = [];
  for (const t of raw) {
    if (typeof t !== "object" || t === null) return null;
    const { rol, metin } = t as { rol?: unknown; metin?: unknown };
    if ((rol !== "k" && rol !== "a") || typeof metin !== "string") return null;
    const sinir = rol === "k" ? spec.sinirlar.kullanici_mesaji_karakter : spec.sinirlar.asistan_cevabi_karakter;
    turlar.push({ rol, metin: metin.slice(0, sinir) });
  }
  const son = turlar.slice(-spec.sinirlar.en_fazla_tur);
  return son.some((t) => t.rol === "k") ? son : null;
}

/** Modele giden kullanıcı içeriği. Tur numaraları 1'den başlar; son kullanıcı mesajı işaretlenir. */
export function sohbetMetni(turlar: Tur[]): string {
  let sonK = -1;
  turlar.forEach((t, i) => {
    if (t.rol === "k") sonK = i;
  });
  const satirlar = turlar.map((t, i) => {
    const kim = t.rol === "k" ? (i === sonK ? "SON kullanıcı mesajı" : "Kullanıcı") : "Asistan";
    return `[Tur ${i + 1}] ${kim}:\n${t.metin}`;
  });
  return `<sohbet>\n${satirlar.join("\n\n")}\n</sohbet>`;
}

/** Modelin cevabını sınırlar: güven 0 ile 1 arasında, metinler kısaltılmış, döngü yoksa metin yok. */
export function kararDuzelt(k: Karar): Karar {
  const guven = Number.isFinite(k.guven) ? Math.min(1, Math.max(0, k.guven)) : 0;
  const dongu = k.dongu === true;
  return {
    ...k,
    guven,
    dongu,
    gerekce: dongu ? k.gerekce.trim().slice(0, spec.sinirlar.gerekce_karakter) : "",
    oneri: dongu ? k.oneri.trim().slice(0, spec.sinirlar.oneri_karakter) : "",
  };
}
