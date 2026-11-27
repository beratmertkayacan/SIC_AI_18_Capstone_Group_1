# Bölüm 6: Ürün Kapsamı

Bu belge Kâfi AI'nın kullanıcıya nasıl göründüğünü, neyi yapıp neyi yapmadığını ve neyin bilerek kapsam dışında bırakıldığını anlatıyor. Kararların gerekçeleri [Bölüm 5](05_architecture_decisions.md) içinde K numaralarıyla, modelin ayrıntıları [Bölüm 9](09_turn_model.md), dağıtım ve sonuçlar [Bölüm 10](10_deployment.md) içinde.

---

## 1. Tek cümlede Kâfi AI

**Ekran süresi değil, kısır döngü.**

Kâfi AI, ChatGPT, Gemini, Claude, Copilot ve Google AI Modu'nu tarayıcıda kullananların yapay zekayla aynı yerde dönmeye başladığını fark eden, bunu sakin bir göstergeyle görünür kılan ve tek tıkla çıkış yolu sunan bir Chrome eklentisidir. Hiçbir şeyi engellemez; hiçbir mesaj cihazdan çıkmaz. Sloganı: "Fark et. Durakla. Yeniden başla."

## 2. Kimin için?

Ders ve iş için üretken yapay zeka kullanan 18 ile 30 yaş arası üniversite öğrencileri ve genç çalışanlar. Bu grup yapay zekayı çoğunlukla bilgisayarda, tarayıcı üzerinden kullanıyor; eklenti de masaüstü Chrome'u hedefliyor. Arayüz Türkçe; kurallar Türkçe ve İngilizce mesajları, Türkçe karaktersiz yazımı da tanır (K36).

## 3. Kullanıcı ne yaşar?

### 3.1 Kurulum

Kurulumdan hemen sonra bir sekmede karşılama ekranı açılır (K21). Ekran eklentinin neye baktığını (gönderilen mesajlar, cevabın başı ve bitişi), neye bakmadığını (klavye, diğer siteler, kişisel bilgiler) ve verinin cihazdan çıkmadığını söyler; tek düğmesi "Anladım". Araç çubuğu penceresindeki "Kâfi AI nasıl çalışır?" bağlantısı ekranı yeniden açar.

### 3.2 Sohbet sırasında

Eklenti kesinti derecesi giderek artan dört yüzeyle çalışır. Hepsi tek tıkla geçilir; bir turda en fazla biri çıkar (K39).

**Halka (K29).** Mesaj kutusunun köşesinde 18 piksellik bir halka durur. Sohbet verimli giderken neredeyse görünmezdir; döngü sinyalleri arttıkça aynı rengin tonu koyulaşır. Kırmızı alarm, puan ya da "risk" kelimesi yoktur. Üzerine gelince neyi ölçtüğünü tek satırla söyler, örneğin:

> Son mesajlarından 2 tanesi öncekilere çok benziyor.

Halkayı tur modeli ve sohbet sinyalleri besler: benzer mesajlar, özürle başlayan cevaplar, üst üste belirsiz istekler ve "düzeltme alınmadı" (kullanıcı düzeltme istedi ama cevap öncekinin neredeyse aynısı, K44). İki temiz tur gelince sakinleşir (K45).

**Gönderirken şerit.** Mesaj gönderilmeden hemen önce, mesaj kutusunun üstünde ince bir şerit çıkar. Üç durumda:

| Şerit | Ne zaman | Ne der | Düğmeler |
|---|---|---|---|
| Benzer mesaj (K37, K26) | Mesaj son mesajlardan biriyle birebir aynı ya da öncekine çok benziyor ve "olmadı" gibi bir onarım ifadesi taşıyor | "Bunu az önce de sormuştun." İkinci denemede "Aynı isteğe ikinci kez dönüyorsun."; üçüncüde "Birkaç denemedir aynı yerdesin." | "Neyin eksik olduğunu söyle" (hazır cümleler: "Biçim yanlış", "Bilgi yanlış", "Fazla uzun", "Fazla kısa"), "Yine de gönder"; üçüncü denemede önce "Yeni sohbete geç" |
| Kısa düzeltme (K34, K40, K52) | 20 karakterden kısa bir onarım ifadesi ("olmadı", "yanlış", "olmadi tekrar yap"); ilk mesajda ve soruyla biten bir teklife verilen yalın "hayır"da çıkmaz | "Neyin olmadığını bir cümleyle eklersen cevap daha isabetli olur." | "Hata mesajını ekle" ya da "Neyin yanlış olduğunu yaz", "Beklediğimi yaz", "Olduğu gibi gönder" |
| Kısa devam (K41, K43) | Üst üste üçüncü yönsüz devam isteği ("devam", "devam et", "continue") | "Üst üste üçüncü kez kısa bir mesajla devam ediyorsun." | "Neyle devam etsin, yaz", "Nasıl devam etsin, yaz", "Olduğu gibi gönder" |

Hazır cümle seçilince mesaj kutusuna eklenir; kullanıcı tamamlayıp kendisi gönderir. Bilerek yapılan seri istekler ("başka bir slogan öner", "sonraki soruyu sor") ve yeni içerik getiren mesajlar ("1. soruyu çöz" / "2. soruyu çöz") şerit açmaz (K20). Her şeritte "Yerinde değildi" ve "Kapat" vardır.

**Çıkış kartı.** Döngü sürerse, yapay zekanın cevabı bittikten sonra ve kullanıcı yazmaya başlamadan önce küçük bir kart görünür. Nedenini ve somut bir öneriyi söyler. Dört yoldan, anlam desteği açıksa iki yoldan daha açılır:

| Kaynak | Ne zaman | Kartın etiketi |
|---|---|---|
| Tur modeli (K17, K35) | Yüksek güven (olasılık en az 0,30) ve sohbette en az bir "olmadı" ifadesi | "Modelin önerisi"; gerekçe ve öneri modelin en çok etkilenen özniteliğinden |
| Özür döngüsü (K32) | Yapay zekanın cevapları üst üste iki kez özürle başladı | "Aynı yerde dönüyor" |
| Düzeltme alınmadı (K44) | Kullanıcı düzeltme istedi, cevap öncekinin neredeyse aynısı | "Düzeltme alınmadı" |
| Uzun sohbet (K14, K33) | Sohbet görev türünün normunu aştı, son mesajlarda benzer mesaj var ve model en az öneri seviyesinde | "Uzun sohbet" |
| Anlam onarımı (K51, K52; yalnızca anlam desteği açıksa) | Kullanıcı uzun bir mesajla düzeltme istedi ve değerlendirici önceki cevabın karşılamadığını söyledi | "Anlam desteği" |
| Aynı istek (K51; yalnızca anlam desteği açıksa) | Aynı istek ya da aynı bilgi, başka sözcüklerle ya da araya başka sorular girdikten sonra ikinci kez soruldu | "Aynı istek"; önceki cevap karşıladıysa ne farklı arandığını, karşılamadıysa neyin eksik kaldığını sorar |

Anlam desteği açıkken tur modelinden gelen kart, değerlendirici bir sorun belirtisi (döngü, tıkanma ya da "karşılamadı") görmezse çıkmaz (K52).

Kullanıcı sohbette bir kuralı yeniden hatırlatmak zorunda kaldıysa ("söylemiştim, emoji kullanma"), kart ayrıca şunu söyler: "Bu sohbette bir kuralı yeniden hatırlatman gerekti. Taze başlat taslağı bu kuralı en başa koyar; yeni sohbette baştan geçerli olur." (K48)

Kartın düğmeleri: **Taze başlat**, **Kısa ara ver**, **Kapat**; model kaynaklı kartta **Yerinde değildi**; ayrıca **Bir daha gösterme**. Kart kapanınca 3 tur bekleme süresi başlar (K53).

**Taze başlat.** Kullanıcının o sohbette yazdığı istekleri tek bir taslakta toplar: birbirine çok benzeyen denemeler tek maddeye iner, konu değiştiyse yalnızca son konunun istekleri girer (K32), yeniden hatırlatılan kurallar en başa konur (K48). Taslağın sonunda kullanıcının dolduracağı iki satır vardır: "Beklediğim sonuç:" ve "Önceki denemelerde olmayan kısım:". Gerekçe: yeni sohbet tek başına döngüyü çözmüyor, isteğin netleşmesi gerekiyor. Bu işlem cihazda, basit metin birleştirmeyle yapılır; hiçbir model ya da ağ kullanılmaz. Kullanıcı taslağı düzenler; taslak panoya kopyalanır ve yeni bir sohbet açılır.

**Yön sende (K42, K49).** Kullanıcı modelin teklif sorularına ("… ekleyeyim mi?") üst üste üç kez yalnızca "evet", "aynen", "tamam" gibi kısa onaylarla karşılık verirse cevabın altında bir öneri çıkar: "İstersen devam etmeden önce modelin şu ana kadar ne anladığını özetlemesini iste ya da bir sonraki adımı kendin yaz." Düğmeler: **Özetlet** (modelden üç maddelik özet ve seçenek isteyen cümle) ve **Adımı ben yazayım** ("Teklif sorma, bir sonraki adımı ben belirliyorum: "). Gönderimi bekletmez, odağı almaz, sohbet başına bir kez çıkar.

### 3.3 Araç çubuğu penceresi

| Bölüm | İçerik |
|---|---|
| Bu sohbet | Açık sohbetin o anki durumu: son mesajlardaki benzerlik, özür serisi, belirsiz istekler, konu değişimi; kullanıcı "oldu" dediyse "şimdilik bir şey önermiyorum". İstenirse çıkış kartı buradan açılır (K24) |
| Son 7 gün | Sayaçlardan hesaplanan içgörüler: görev türüne göre sohbet ve tekrar sayısı, görev normu, uzun sohbetler, saat dilimi, platform dağılımı, Taze başlat'tan sonra yeni sohbetlerin kaç turda bittiği, önceki haftayla sayı karşılaştırması ve "İstersen…" tonunda tek öneri. En az 5 sohbet gerekir |
| Eklentinin yaptıkları | Son 7 günün sayıları: benzer mesaj uyarısı, "Yine de gönder", eklenen eksik cümlesi, çıkış kartı (ve bunlardan modelin önerdiği), Taze başlat |
| Ayarlar | Eklenti açık, Öneriler (kapalıyken "yalnızca say"), Halka, Çıkış kartı; "Sayaçlarımı kopyala", "Tüm verilerimi sil", "Kâfi AI nasıl çalışır?" |

Bu ekranda yargılayan bir dil kullanılmaz; kimseyle kıyaslama, sıralama, puan ya da seri yoktur.

### 3.4 Destek ve sınırlar

Kâfi AI bir verimlilik ve farkındalık aracıdır; profesyonel desteğin yerini almaz ve kimseyi bir destek kanalına yönlendirmez. Kişisel ve duygusal sohbetlerde hiçbir öneri göstermez (K23).

## 4. Özellikler ve durum

| Özellik | Durum | Not |
|---|---|---|
| Beş sitede sohbetleri okuma | Hazır | ChatGPT, Gemini, Claude, Copilot, Google AI Modu. Gönderim doğrulaması, çift olay koruması ve satır içi ekleme beşinde ortak (K38). ChatGPT'de canlı sitede elle doğrulandı; diğer dört site temizlenmiş sayfa görüntüleriyle test ediliyor |
| Benzer mesaj şeridi ve onarım cümleleri | Hazır | Karakter 3-gram benzerliği, son 5 mesaj; gönderim yalnızca birebir tekrarda ve onarım ifadesinde bekletilir (K37) |
| Kısa düzeltme ve kısa devam şeritleri | Hazır | K34, K40, K41, K43 |
| Halka | Hazır | Üç seviye; ayardan kapatılabilir (K29) |
| Tur modeli | Hazır | 22 öznitelikli lojistik regresyon, kalibre, beş sitede açık (K17, K25) |
| Sohbet sinyalleri | Hazır | Özür döngüsü, çıkış, belirsiz istek, konu kayması, düzeltme alınmadı, davranışsal çıkış, kuralın yeniden hatırlatılması (K32, K44, K45, K48) |
| Çıkış kartı ve Taze başlat | Hazır | Dört kaynak; taslakta netleştirme satırları ve hatırlatılan kurallar |
| Yön sende önerisi | Hazır | İki düğme (K49) |
| Araç çubuğu penceresi ve haftalık içgörü | Hazır | K24 |
| Karşılama ekranı | Hazır | K21 |
| Kişisel sohbette öneri yok | Hazır | Kural tabanlı (K23) |
| Yalnızca say modu | Hazır | Öneriler kapalıyken hiçbir şey gösterilmez, yalnızca sayılır |
| Anlam desteği | Hazır, varsayılanı kapalı | İzinle; son turların kısa bir bölümü Kâfi sunucusunda Claude ile değerlendirilir, saklanmaz; kişisel sohbette gönderilmez (K51, K52, `docs/PRIVACY.md`) |
| Varsayılan olarak ağ isteği yok | Hazır | Anlam desteği adresi boşken `connect-src 'none'`; derlenmiş kodu denetleyen test yalnızca arka plandaki tek değerlendirici isteğine izin verir (K11, K51) |
| Chrome Web Store yayını | Planlandı | Bölüm 10 |

## 5. Ürünün yapmayacakları

- Mesaj metnini saklamaz. Anlam desteği kapalıyken (varsayılan) hiçbir mesajı hiçbir sunucuya göndermez; açıkken yalnızca son turların kısa bir bölümü değerlendirilir ve saklanmaz (K51).
- Klavye tuşlarını izlemez, diğer sitelere bakmaz.
- Hiçbir şeyi engellemez, süre sınırı koymaz. Bekletilen bir mesaj tek tıkla olduğu gibi gönderilir.
- "Bağımlısın" demez, puan vermez; seri, rozet ya da oyunlaştırma kullanmaz.
- Ebeveyn ya da işveren modu yoktur; eklenti yalnızca kullanıcının kendisine konuşur.
- Kişisel ve duygusal sohbetlerde verimlilik önerisi göstermez.
- Sohbeti kendisi özetlemez ya da yeniden yazmaz; bunu sohbetteki yapay zeka yapar, Kâfi AI yalnızca hazır cümleyi kutuya koyar.
- Sayfa yapısı değişip emin olamadığında sessizce devre dışı kalır.

## 6. Arka planda neler çalışıyor?

Eklentinin içinde iki tür karar mekanizması var; anlam desteği açıksa üçüncüsü eklenir:

| Mekanizma | Neye dayanır | Neyi tetikler | Yanılırsa ne olur |
|---|---|---|---|
| Ölçülmüş kurallar | Mesaj benzerliği, onarım ifadeleri, kısa mesajlar, cevabın başı ve sonu, görev normları | Şeritler; halkanın çoğu seviyesi; özür, düzeltme alınmadı ve uzun sohbet kartları; Yön sende önerisi | Olmuş bir şeyi ölçtükleri için isabetleri yüksek; en isabetlileri kısa düzeltme şeridi (%58,4) ve düzeltme alınmadı kartı (%50,0) |
| Tur modeli | Kullanıcının o ana kadarki mesajlarından 22 öznitelik; kalibre edilmiş olasılık | Halkanın öneri seviyesi; yalnızca yüksek güvende ve sohbette en az bir "olmadı" ifadesi varsa gerekçeli çıkış kartı | Kart kapatılabilir ve "Yerinde değildi" ile işaretlenebilir; model kartlarının isabeti %27,5 |
| Anlam desteği (isteğe bağlı) | Sohbetin son turlarını okuyan bir dil modeli (Claude); yapılandırılmış karar | Aynı istek ve anlam onarımı kartları; model kartının onayı | Kart kapatılabilir; karar gelmezse eklenti kurallarla devam eder. WildFeedback'te anlam onarımı kartlarının isabeti %58 (K52) |

İsabet sayıları WildFeedback'teki 20.000 gerçek sohbette yeniden oynatmadan (Bölüm 10, 6.3). Hiçbir uyarı her seferinde haklı değil; bu yüzden hiçbiri bir şeyi engellemiyor.

## 7. Değerlendirme

Pilot yapılmadı (K28). Ürünün başarısı iki yoldan ölçüldü:

| Yol | Ne ölçülüyor | Nerede |
|---|---|---|
| Çevrimdışı yeniden oynatma | Eklentinin karar zinciri WildFeedback'teki 20.000 gerçek sohbette tur tur oynatılıyor; her müdahalenin gerçek memnuniyetsizlikle ne kadar örtüştüğü. Kural seçimi ayrık bir seçim örnekleminde, doğrulama rapor örnekleminde | `scripts/evaluate_replay.py`, `outputs/replay_eval.json` |
| Gerçek kullanım senaryoları | 22 Türkçe senaryoda beklenen davranış (şerit, halka, kart, konu değişimi, kişisel sohbet) | `tests/fixtures/scenarios_tr.json`, `tests/test_scenarios.py` |
| Elle doğrulama | ChatGPT'de gerçek kullanımda davranışın ve konsol günlüklerinin kontrolü | Bölüm 5, K38 ve K39 |

Gerçek kullanımda önerilerin ne sıklıkta çıktığı ve hangi düğmenin seçildiği, kullanıcının kopyalayabildiği sayaç dökümüyle izlenebilir (Bölüm 10, 6.1).

## 8. Başarıyı nasıl anlıyoruz?

| Soru | Ölçüt | Bugünkü değer |
|---|---|---|
| Uyarılar doğru anda mı çıkıyor? | Uyarı turunda ya da sonrakinde kullanıcının memnuniyetsiz olma oranı, tüm turlardaki orana göre (%5,04) | Kart %30,2, halka koyu seviye %29,9, benzer mesaj şeridi %21,5, kısa düzeltme şeridi %58,4 |
| Döngüyü kaçırıyor muyuz? | Kullanıcının iki kez şikayet ettiği sohbetlerde kartın ikinci şikayetten önce gelme oranı | %31,9 (anlam desteği açıkken 2.000 sohbetlik alt kümede %31,1, isabet %35,8; K52) |
| Rahatsız ediyor mu? | 100 sohbette kaç uyarı | Kart 19,1, şerit 10,1 |
| Gizlilik vaadi tutuyor mu? | Derlenmiş kodda ağ isteği, `eval` ve izinsiz adres olmadığının her test çalıştırmasında gösterilmesi | Test geçiyor |

## 9. Kapsam dışı

İlk ürün tasarımında olan ama bu dönem yapılmayan işler (K50): öğrenme sorusu ("Bunu öğrenmek mi, bitirmek mi istiyorsun?"), kendi koyduğun gece sınırı, kurulumda kullanım amacı tercihi, kademeli destek yolu ve YEDAM bağlantısı, hassasiyet ayarı, kişiye göre ayarlanan eşik, veri bağışı ve telefon uygulaması. Tur modelinin daha uzun sohbetlere uzatılması ve WildFeedback etiketiyle yeniden eğitilmesi sonraki çalışma olarak duruyor. ChatGPT'de durdur düğmesi, menüdeki yeniden üretme ve cevap sürümü gibi yeni davranış sinyalleri, eğitim ve değerlendirme verisinde bulunmadıkları için eklenmedi.
