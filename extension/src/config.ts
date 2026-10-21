// Tüm eşikler ve zamanlamalar burada durur (karar K06).

/** Cevap izleme döngüsünün aralığı (ms). Yalnızca bir mesaj gönderildikten sonra çalışır. */
export const POLL_MS = 250;

/** "Üretiliyor" sinyali bu kadar süre görünmezse cevap bitmiş sayılır (ms). */
export const QUIET_MS = 600;

/** Gönderdikten sonra bu kadar sürede hiç "üretiliyor" sinyali gelmezse vazgeçilir (ms). */
export const START_TIMEOUT_MS = 15_000;

/** Sayfa adresinin değişip değişmediğini kontrol etme aralığı (ms). */
export const NAV_POLL_MS = 1000;
