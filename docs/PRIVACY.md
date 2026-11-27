# Kâfi AI Gizlilik Politikası

Bu politika Kâfi AI Chrome eklentisinin hangi verileri işlediğini, nerede tuttuğunu ve ne zaman cihazınızdan çıkardığını anlatır. Kâfi AI, Samsung Innovation Campus kapsamında geliştirilmiş bir öğrenci projesidir.

## 1. Kısaca

1. Kâfi AI, desteklenen yapay zeka sohbet sitelerinde (ChatGPT, Gemini, Claude, Copilot ve Google AI Modu) yazdığınız mesajları ve gelen cevapların başını ve sonunu yalnızca o sekmenin belleğinde okur.
2. Varsayılan ayarlarla hiçbir mesaj cihazınızdan çıkmaz, hiçbir yere kaydedilmez ve hiçbir sunucuya gönderilmez.
3. "Anlam desteği" adlı isteğe bağlı özelliği siz açarsanız, bir cevap bittiğinde sohbetin son turlarının kısa bir bölümü değerlendirilmek üzere Kâfi sunucusuna gönderilir. Bu özellik varsayılan olarak kapalıdır.
4. Kâfi AI reklam göstermez, veri satmaz, kullanıcı profili çıkarmaz ve hesap istemez.

## 2. Cihazınızda işlenen veriler

| Veri | Ne için | Nerede | Ne kadar süre |
|---|---|---|---|
| Yazdığınız mesajlar | Aynı isteğin tekrarını, kısa düzeltmeleri ve konu kaymasını fark etmek | Yalnızca sekmenin belleği | Sekme kapanınca ya da sohbet değişince silinir |
| Cevabın ilk 600 ve son 200 karakteri | Özür döngüsünü ve düzeltmenin alınıp alınmadığını fark etmek | Yalnızca sekmenin belleği | Aynı şekilde silinir |
| Ayarlarınız | Hangi özelliklerin açık olduğunu hatırlamak | `chrome.storage.local` | Siz silene kadar |
| Günlük sayılar (ör. kaç kez öneri gösterildi) | Pencerede ve haftalık özette size göstermek | `chrome.storage.local` | 90 gün |

Sayılar yalnızca platform adı, saat dilimi, görev türü ve tur aralığı gibi kısa etiketlerle tutulur. Mesaj metni, sohbet kimliği ya da sayfa adresi saklanmaz. Pencerede "Tüm verilerimi sil" düğmesiyle her şeyi silebilirsiniz.

## 3. Anlam desteği açıksa gönderilen veriler

Anlam desteği, kelime kurallarının kaçırabildiği durumları (aynı isteğin başka sözcüklerle yeniden sorulması, uzun bir düzeltme mesajı) anlamak için bir dil modelinden yardım alır.

1. **Ne gönderilir:** Sohbetin son en fazla 16 turu. Her kullanıcı mesajından en fazla 1.000 karakter, her cevaptan yalnızca baştan 600 ve sondan 200 karakter.
2. **Ne zaman:** Yalnızca siz ayarlardan açtıysanız ve bir cevap bittiğinde, her kullanıcı mesajı için en fazla bir kez. Kişisel ya da duygusal görünen sohbetlerde hiç gönderilmez.
3. **Nereye:** Kâfi sunucusuna (Vercel üzerinde çalışan bir fonksiyon). Sunucu bu metni değerlendirmesi için Anthropic'in Claude API'sine iletir ve yalnızca yapılandırılmış bir karar (ör. "aynı istek mi", "önceki cevap karşıladı mı") geri alır.
4. **Saklama:** Kâfi sunucusu metni diske ya da günlüğe yazmaz; günlüğe yalnızca isteğin durumu ve süresi düşer. Anthropic API'ye giden veriler Anthropic'in ticari kullanım koşullarına ve veri saklama politikasına tabidir; Anthropic API verilerini varsayılan olarak model eğitiminde kullanmaz.
5. **Kimlik:** İstek çerez ya da hesap bilgisi taşımaz. Sunucu kötüye kullanımı sınırlamak için IP adresini yalnızca kısa süreli bir sayaçta, bellekte tutar.

Anlam desteğini istediğiniz an pencereden kapatabilirsiniz. Kapalıyken hiçbir istek gönderilmez.

## 4. İzinler

| İzin | Neden |
|---|---|
| `storage` | Ayarları ve günlük sayıları cihazınızda tutmak |
| `clipboardWrite` | "Taze başlat" taslağını tek tıkla panoya kopyalamak |
| Site erişimi (5 sohbet sitesi) | Mesaj kutusunun yanında halka, şerit ve kart gösterebilmek |
| Kâfi sunucusu (yalnızca anlam desteği olan sürümde) | Anlam desteği açıksa değerlendirme isteğini göndermek |

## 5. Çocuklar

Kâfi AI 18 yaş ve üstü kullanıcılar için tasarlanmıştır.

## 6. Değişiklikler ve iletişim

Bu politika değişirse güncel hali bu sayfada yayımlanır. Sorularınız için proje deposundaki "Issues" bölümünü kullanabilirsiniz: github.com/beratmertkayacan/SIC_AI_18_Capstone_Group_1
