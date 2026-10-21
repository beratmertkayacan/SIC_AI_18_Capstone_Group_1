/**
 * Onarım düğmeleri: kullanıcının "neyin eksik olduğunu" söylemesinin hazır yolları.
 * Seçilen cümle mesaj kutusuna eklenir; kullanıcı tamamlayıp kendisi gönderir.
 * Cümleler iki türlüdür: iki nokta ile bitenler kullanıcının devam etmesini bekler.
 */
export interface Repair {
  id: "format" | "info" | "shorter" | "longer";
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
