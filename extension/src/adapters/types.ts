/** Kullanıcının gönderdiği mesaj. Metin yalnızca bellekte tutulur, hiçbir yere yazılmaz. */
export interface SendInfo {
  text: string;
}

export interface AdapterHandlers {
  /** Kullanıcı bir mesaj gönderdi. */
  onSend(info: SendInfo): void;
  /** Yapay zekanın cevabı bitti. */
  onResponseComplete(): void;
  /** Mesaj gönderildi ama "üretiliyor" sinyali hiç görülmedi (sayfa yapısı değişmiş olabilir). */
  onNoSignal(): void;
}

/** Her yapay zeka sitesi için sayfa yapısını bilen küçük bir katman. */
export interface Adapter {
  readonly name: string;
  matches(url: URL): boolean;
  /** Sayfadaki sohbeti anahtarlayan kimlik. Yeni (henüz kaydedilmemiş) sohbette null. */
  conversationKey(url: URL): string | null;
  /** İzlemeyi başlatır; durdurmak için dönen fonksiyonu çağır. */
  start(handlers: AdapterHandlers): () => void;
}
