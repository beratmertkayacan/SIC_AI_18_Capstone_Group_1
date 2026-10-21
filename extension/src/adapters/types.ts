/** Kullanıcının gönderdiği mesaj. Metin yalnızca bellekte tutulur, hiçbir yere yazılmaz. */
export interface SendInfo {
  text: string;
}

/** Mesaj gönderilmeden hemen önce: bekletilip bekletilmeyeceğine karar vermek için. */
export interface BeforeSendInfo {
  text: string;
  /** Mesaj kutusunun bulunduğu öğe; arayüzü bunun yakınına yerleştirmek için. */
  anchor: Element;
}

export interface AdapterHandlers {
  /**
   * Gönderme girişimi yakalandı, henüz gönderilmedi. true dönerse gönderim bekletilir
   * (adapter olayı durdurur); sonra submitHeld() ile gönderilebilir. Yoksa mesaj normal gider.
   */
  onBeforeSend?(info: BeforeSendInfo): boolean;
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
  /** Bekletilen mesajı olduğu gibi gönderir. Bekleyen yoksa false döner. */
  submitHeld(): boolean;
  /** Metni mesaj kutusunun sonuna, yeni bir satır olarak ekler. Başarılıysa true. */
  insertText(text: string): boolean;
  /** Sayfada görünen önceki kullanıcı mesajlarının metinleri (eskiden yeniye). Yalnızca bellekte kullanılır. */
  readHistory(): string[];
  /** Yeni (boş) bir sohbetin adresi. */
  newChatUrl(): string;
  /** Mesaj kutusu: arayüzü yerleştirmek için çapa ve kutunun boş olup olmadığı. Kutu yoksa null. */
  composer(): { anchor: Element; empty: boolean } | null;
  /** Mesaj kutusuna odaklanır. */
  focusComposer(): void;
}
