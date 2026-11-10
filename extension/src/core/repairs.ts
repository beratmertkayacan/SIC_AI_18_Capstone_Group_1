/**
 * Onarım düğmeleri: kullanıcının "neyin eksik olduğunu" söylemesinin hazır yolları.
 * Seçilen cümle mesaj kutusuna eklenir; kullanıcı tamamlayıp kendisi gönderir.
 * Cümleler iki türlüdür: iki nokta ile bitenler kullanıcının devam etmesini bekler.
 */
export interface Repair {
  id: "format" | "info" | "shorter" | "longer" | "error" | "expected" | "wrong_part";
  label: string;
  sentence: string;
}

export const REPAIRS: readonly Repair[] = [
  {
    id: "format",
    label: "Biçim yanlış",
    sentence: "Cevabın içeriği doğru ama biçimi istediğim gibi değil. Şu biçimde yaz: ",
  },
  {
    id: "info",
    label: "Bilgi yanlış",
    sentence: "Önceki cevabın yanlış olan kısmını düzelt, gerisine dokunma. Yanlış olan kısım: ",
  },
  { id: "shorter", label: "Fazla uzun", sentence: "Aynı cevabı daha kısa yaz." },
  { id: "longer", label: "Fazla kısa", sentence: "Aynı cevabı daha ayrıntılı yaz." },
];

/**
 * Kısa onarım şeridi ("olmadı", "yanlış"): mesajın kendisi zaten memnuniyetsizliği söylüyor,
 * eksik olan neyin olmadığı. Kod isteklerinde hata mesajı, diğerlerinde yanlış olan kısım istenir.
 */
export function shortRepairs(task: string | null): readonly Repair[] {
  const first: Repair =
    task === "kod"
      ? { id: "error", label: "Hata mesajını ekle", sentence: "Aldığım hata mesajı: " }
      : { id: "wrong_part", label: "Neyin yanlış olduğunu yaz", sentence: "Yanlış olan kısım: " };
  return [first, { id: "expected", label: "Beklediğimi yaz", sentence: "Beklediğim sonuç: " }];
}
