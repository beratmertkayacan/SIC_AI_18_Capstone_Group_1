// Tüm eşikler ve zamanlamalar burada durur (karar K06).

/** Cevap izleme döngüsünün aralığı (ms). Yalnızca bir mesaj gönderildikten sonra çalışır. */
export const POLL_MS = 250;

/** "Üretiliyor" sinyali bu kadar süre görünmezse cevap bitmiş sayılır (ms). */
export const QUIET_MS = 600;

/** Gönderdikten sonra bu kadar sürede hiç "üretiliyor" sinyali gelmezse vazgeçilir (ms). */
export const START_TIMEOUT_MS = 15_000;

/** Sayfa adresinin değişip değişmediğini kontrol etme aralığı (ms). */
export const NAV_POLL_MS = 1000;

/** Benzerlik kuralları: tüm eşikler burada (karar K06). */
export const SIMILARITY_THRESHOLD = 0.6; // bu değer ve üstü "benzer mesaj" sayılır
export const MIN_NORMALIZED_CHARS = 12; // bundan kısa mesajlar ("devam et", "evet") hiç karşılaştırılmaz
export const RECENT_MESSAGES = 5; // yalnızca son N kullanıcı mesajıyla karşılaştırılır (bellekte, kalıcı değil)
export const NGRAM_SIZE = 3; // karakter n-gram uzunluğu
export const HASH_DIM = 1024; // n-gram özet vektörünün boyutu
