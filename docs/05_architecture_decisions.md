# Bölüm 5: Mimari Kararlar

Bu belge projede verdiğimiz teknik kararları ve nedenlerini kayıt altına alıyor. Her karar aynı düzende yazıldı: bağlam, karar, neden, bedeli. Yeni bir karar alındığında listenin sonuna eklenir; eski bir karar değişirse silinmez, "değiştirildi" notu düşülür.

| # | Karar | Durum |
|---|---|---|
| K01 | Problem, ilk turlardan erken uyarı olarak tanımlanır | Kabul |
| K02 | Etiket önce kurallarla, sonra hazır ve LLM etiketleri ile insan doğrulamasıyla üretilir | Değiştirildi (K15, K28) |
| K03 | Benzerlik için eğitimsiz karakter n-gram vektörü kullanılır | Kabul |
| K04 | Veri kullanıcı bazlı bölünür | Kabul |
| K05 | İlk model küçük ve açıklanabilirdir, tarayıcıda çalışır | Kabul |
| K06 | Tüm eşikler tek bir ayar dosyasında tutulur | Kabul |
| K07 | Tahmin ile tespit ayrılır; öneriler kesin sinyallerle tetiklenir | Değiştirildi (K17) |
| K08 | Eğitim verisi WildChat 4.8M, hazır etiket kaynağı WildFeedback olur | Kabul |
| K09 | Eklentinin ilk sürümü modelsiz, kural tabanlı çalışır; kesinti yalnızca benzer mesajda olur | Değiştirildi (K17) |
| K10 | Siteler ortak bir adaptör arayüzüyle desteklenir; sayfa yapısı tanınmazsa eklenti sessizce devre dışı kalır | Kabul |
| K11 | Mesaj metni yalnızca bellekte tutulur; eklentide ağ isteği yapan kod yoktur | Kabul (düzeltildi; izinli istisna K51) |
| K12 | Ayarlar araç çubuğu penceresinde, yalnızca Türkçe; saklanan tek veri iki ayar ve günlük sayaçlar | Değiştirildi (K18) |
| K13 | Çıkış kartı eşikleri geçicidir, WildChat ile kalibre edilecek | Değiştirildi (K14) |
| K14 | Eşikler WildChat ile kalibre edildi: şerit 0,8, yumuşak tekrar 0,6, çıkış kartı görev normuna göre | Kabul |
| K15 | Etiketin ikinci sürümü: benzerlik değil güçlü onarım ifadeleri esas alınır | Kabul |
| K16 | Model WildChat 4.8M ile eğitilir; eklenti için 25 öznitelikli Logistic Regression seçilir | Değiştirildi (K17) |
| K17 | Eklentide her mesajda çalışan, kalibre edilmiş tur modeli; kart yalnızca yüksek güven ve kanıt şartıyla | Kabul |
| K18 | Sayaç şeması v2: günlük, seyrek, boyutlu ve yalnızca sayı; ortak JSON şemasıyla doğrulanır | Kabul |
| K19 | Platform kaydı: desteklenen siteler ve yetenekleri tek yapılandırma dosyasında | Kabul |
| K20 | Şerit, yeni içerik kelimesi getiren mesajda çıkmaz | Kabul |
| K21 | Karşılama ekranı: ilk kurulumda bir kez açılır, yalnızca üç şeyi söyler | Kabul |
| K22 | Adaptör testleri gerçek sayfa görüntüleriyle yapılır; görüntüler depoya yalnızca temizlenmiş hâlde girer | Kabul |
| K23 | Kişisel ve duygusal sohbetlerde öneri gösterilmez; tespit kural tabanlıdır | Kabul |
| K24 | Haftalık içgörü ve "Bu sohbet" araç çubuğu penceresinde; sayfaya kalıcı öğe eklenmez | Kabul |
| K25 | Platform başına model kararı veriyle verilir | Kabul |
| K26 | Şerit metni duruma göre değişir; üçüncü denemede yeni sohbet önerilir | Kabul |
| K27 | Sayfa içi kartlar ortak bir görünüm kullanır; tema sayfanın arka planından seçilir | Kabul |
| K28 | Pilot yapılmaz; başarı WildFeedback üzerinde çevrimdışı yeniden oynatmayla ölçülür | Kabul |
| K29 | Halka: mesaj kutusunun yanında üç seviyeli sessiz gösterge | Kabul |
| K30 | Marka kimliği: Kâfi AI adı, slogan, palet, logo ve yazı tipi | Kabul |
| K31 | Sanal liste kullanan sitelerde tur sayısı sayfanın bildirdiği toplamdan okunur | Kabul |
| K32 | Sohbet sinyalleri: özür döngüsü, çıkış, belirsiz istek ve konu kayması | Kabul |
| K33 | Uzun sohbet kartı yalnızca yakın bir döngü işaretiyle açılır | Kabul |
| K34 | Kısa onarım ifadesi gönderim öncesi kısa bir şerit açar | Kabul |
| K35 | Kurallar veriyle inceltilir; yüksek güven eşiğine 0,30 alt sınırı | Kabul |
| K36 | Kurallar Türkçe karaktersiz yazımı da tanır; Türkçe onarım karşılıkları eklenir | Kabul |
| K37 | Benzer mesaj şeridi gönderimi yalnızca birebir tekrarda ve onarım ifadesinde bekletir | Kabul |
| K38 | Gönderim ancak sayfada görülünce sayılır; çift olay tek sayılır; onarım cümlesi satır içine eklenir | Kabul |
| K39 | Bir turda en fazla bir müdahale | Kabul |
| K40 | Soruyla biten cevaba verilen yalın "hayır" onarım sayılmaz | Kabul |
| K41 | Aynı kısa mesajın üçüncü kez gelmesi halkayı değil, niyet soran bir şeridi açar | Kabul |
| K42 | Teklif sorularına üst üste kısa onaylarda "Yön sende" önerisi | Kabul (K49 ile genişletildi) |
| K43 | Yönsüz devam istekleri tek niyet sayılır | Kabul |
| K44 | Düzeltme alınmadı: onarımdan sonra cevap öncekinin neredeyse aynısıysa halka koyulaşır, kart açılabilir | Kabul |
| K45 | Davranışsal çıkış: döngü sinyalinden sonra iki temiz tur gelince sinyaller sakinleşir | Kabul |
| K46 | Döngünün nasıl bittiği yalnızca sayı olarak ölçülür | Kabul |
| K47 | Ters yönlü düzeltme ve kuralın yeniden yazılması ölçüldü; tetikleyici olarak eklenmedi | Kabul |
| K48 | Yeniden hatırlatılan kural kartta not olarak söylenir ve Taze başlat taslağının başına girer | Kabul |
| K49 | "Yön sende" önerisine yönü doğrudan veren ikinci düğme; eşik 3 kalır | Kabul |
| K50 | Kapsam sadeleştirmesi: yapılmayan işler ürün ve belgelerden çıkarılır | Kabul |
| K51 | İzinle çalışan anlam desteği: K11 istisnası, sunucu ve değerlendirici | Kabul |
| K52 | Son tur ölçümü: orta uzunlukta onarım şeridi, anlam onarımı kartı ve model kartı onayı | Kabul |
| K53 | Eşik taraması: kart bekleme süresi 5 turdan 3 tura iner; diğer eşikler kalır | Kabul |

---

## K01. Problem, ilk turlardan erken uyarı olarak tanımlanır

**Bağlam.** Bir sohbetin döngüye girdiğini sohbet bittikten sonra söylemek kolay ama işe yaramaz; kullanıcı zamanı zaten kaybetmiş olur.

**Karar.** İlk sürümde model kullanıcının yalnızca ilk iki mesajını görür ve sohbetin geri kalanında döngü olup olmayacağını tahmin eder (`config.K_TURNS = 2`). Etiket, modelin görmediği kısımdan üretilir.

**Neden.** Eklenti uyarıyı döngü başlamadan önce verebilir. Ayrıca girdi ve etiket farklı turlardan geldiği için etiket bilgisinin modele sızması yapısal olarak engellenir.

**Bedeli.** İlk iki tur az bilgi taşır, bu yüzden başarı tavanı düşüktür. Sonraki aşamada aynı modeli 3. ve 4. turlarda da çalıştırıp uyarıyı güncellemeyi deneyeceğiz.

## K02. Etiket önce kurallarla, sonra hazır ve LLM etiketleri ile insan doğrulamasıyla üretilir

**Bağlam.** Hiçbir açık veri setinde "verimsiz döngü" etiketi yok.

**Karar.** İlk sürümde etiket açık kurallarla üretilir (`labels.py`): ikinci turdan sonra en az 2 tekrar veya en az 2 onarım ifadesi. Sonra İngilizce sohbetler için WildFeedback'teki hazır memnuniyetsizlik etiketleri, Türkçe sohbetler için aynı ölçütle bir dil modeli kullanılır; 300 sohbet (en az 100'ü Türkçe) elle doğrulanır. "Devam et" gibi kısa ve meşru tekrarlar etiketten ayıklanır.

**Neden.** Kurallar hızlı ve denetlenebilir; veri hattını hemen kurmamızı sağlar. LLM, kuralların kaçırdığı anlam düzeyindeki tekrarları yakalar. İnsan doğrulaması iki yöntemin ne kadar güvenilir olduğunu sayıyla gösterir.

**Bedeli.** Kural tabanlı etiketle eğitilen model, kuralları yeniden öğrenmeye eğilimlidir. Bu yüzden nihai değerlendirme yalnızca elle doğrulanmış set üzerinde yapılacak.

**Durum (Kasım 2026).** 300 sohbetlik elle doğrulama yapılmadı ve döngü etiketi LLM ile değil kurallarla üretiliyor (dil modeli yalnızca K14'teki eşik çiftlerinin ön etiketinde kullanıldı). Etiket, kurallarla üretilip (K15) WildFeedback'in gerçek memnuniyetsizlik işaretleriyle (`outputs/label_validation.json`) ve dış etiketlerle (EmoWOZ, ChatBench; `outputs/external_labels.json`) doğrulandı. Ürünün başarısı ise etiketten bağımsız olarak WildFeedback üzerinde yeniden oynatmayla ölçülüyor (K28).

## K03. Benzerlik için eğitimsiz karakter n-gram vektörü kullanılır

**Bağlam.** Bölüm 2'de hem TF-IDF hem çok dilli embedding denedik. Embedding anlam benzerliğini daha iyi yakalıyor ama tarayıcıda ek bir model gerektiriyor.

**Karar.** Öznitelik ve kural etiketinde `HashingVectorizer` (karakter 3 ile 5 gram) kullanılır. Çok dilli embedding, LLM etiketleme ve ileri model karşılaştırması için ayrı tutulur.

**Neden.** HashingVectorizer eğitim gerektirmez; aynı hesap JavaScript ile birebir yapılabilir. Python'da eğitilen model ile tarayıcıda çalışan model aynı sayıları görür.

**Bedeli.** "Bu kodu düzelt" ile "kodda hata var, tekrar yazar mısın" gibi anlamca aynı ama kelimece farklı mesajları kaçırır. Bu açığı onarım ifadesi özniteliği kısmen kapatıyor.

**Not (eklenti uygulaması).** Eklentinin ilk sürümü yalnızca karakter 3-gram kullanıyor: 1024 boyutlu karma vektör, kosinüs benzerliği, eşik 0,6, en az 12 karakter, son 5 mesajla karşılaştırma (`extension/src/config.ts`). Bu karar metnindeki 3 ile 5 gram aralığı model aşamasında Python ile JavaScript arasında birebir eşleştirilecek; o zamana kadar iki taraftaki değerler ayrı ayrı belgelenmeli.

**Not (Python ikizi).** Eklentinin benzerlik hesabı `src/kafiai/extension_similarity.py` dosyasında Python'a birebir aktarıldı. İki tarafın aynı sonucu verdiği `tests/fixtures/similarity_parity.json` üzerinden hem Python hem eklenti testleriyle denetleniyor; ortak ayar değerlerinin eşitliğini de `tests/test_extension_parity.py` kontrol ediyor. Eşik değeri K14 ile 0,8'e çıkarıldı.

## K04. Veri kullanıcı bazlı bölünür

**Bağlam.** WildChat'te en yoğun %1 kullanıcı sohbetlerin %28'ini oluşturuyor.

**Karar.** Eğitim ve test ayrımı şifrelenmiş IP'ye göre yapılır (`split.user_split`). Aynı kişinin sohbetleri iki tarafta birden bulunmaz.

**Neden.** Rastgele bölmede model yoğun kullanıcıların yazım tarzını ezberler ve test skoru gerçekte olduğundan iyi görünür.

**Bedeli.** Test seti küçülür ve skorlar daha dalgalı olur. Bunu ileride kullanıcı bazlı çapraz doğrulama (GroupKFold) ile dengeleyeceğiz.

## K05. İlk model küçük ve açıklanabilirdir, tarayıcıda çalışır

**Bağlam.** Ürün kullanıcının bilgisayarında çalışacak; mesajlar dışarı gönderilmeyecek. Chrome'un yerleşik modeli Türkçeyi desteklemiyor.

**Karar.** Karşılaştırma sırası: kural, Logistic Regression, XGBoost. Logistic Regression seçilirse katsayılar küçük bir JSON dosyası olarak eklentiye konur; ek bir kütüphane gerekmez. XGBoost seçilirse ONNX formatına çevrilip ONNX Runtime Web ile çalıştırılır. Transformer modeller yalnızca belirgin fark yaratırsa ve 150 ms sınırına sığarsa kullanılır.

**Neden.** Küçük, hızlı ve SHAP ile açıklanabilir. Her uyarının gerekçesini göstermek ürünün temel ilkelerinden biri.

**Bedeli.** Metnin anlamını doğrudan okuyan büyük modellerin doğruluğuna ulaşamayabilir.

## K06. Tüm eşikler tek bir ayar dosyasında tutulur

**Bağlam.** Benzerlik eşiği, etiket kuralı ve şablon tespiti gibi değerler deneyler boyunca değişecek.

**Karar.** Hepsi `src/kafiai/config.py` içinde, yanında gerekçesiyle durur.

**Neden.** Bir değeri değiştirmek için kodun içinde arama yapmak gerekmez; rapordaki sayılar ile koddaki değerler aynı yerden okunur.

**Bedeli.** Yok denecek kadar az.

**Not (eklenti uygulaması).** Aynı ilke eklentide `extension/src/config.ts` ile uygulanıyor. Python ve JavaScript tarafındaki ortak değerler (n-gram boyutu, vektör boyutu, benzerlik eşiği) değiştiğinde iki dosya birlikte güncellenmeli.

## K07. Tahmin ile tespit ayrılır; öneriler kesin sinyallerle tetiklenir

**Bağlam.** Döngüler sohbetlerin yaklaşık %10'unda görülüyor. Bu oranda, döngülerin yarısını yakalayıp normal sohbetlerin %90'ını rahat bırakan iyi bir model bile verdiği her üç uyarıdan yaklaşık ikisinde yanılır. Ayrıca döngü, henüz yazılmamış yapay zeka cevaplarına bağlı olduğu için erken tahminin bir tavanı var.

**Karar.** Model yalnızca mesaj kutusunun kenarındaki halkanın tonunu etkiler. Kullanıcının önüne çıkan öneriler kesin sinyallerle tetiklenir: gerçekleşmiş bir tekrar uyarı şeridini, görev normunu aşan tur sayısı çıkış kartını açar. Haftalık özet yalnızca kesin sayımlardan oluşur.

**Neden.** Yanılma ihtimali olan sinyal kullanıcıyı rahatsız etmez; kullanıcıyı yönlendiren öneriler ise olmuş bir şeye dayanır. Ürünün değeri modelin isabetine bağlı kalmaz.

**Bedeli.** Model kullanıcıyı tek başına yönlendiremediği için bazı döngüler ancak başladıktan sonra yakalanır.

**Değiştirildi (K17).** Tur modeli kalibre edildikten sonra model de kullanıcıya görünen bir öneriyi tetikleyebiliyor: çıkış kartı, görev normuna ek olarak modelin yüksek güven eşiğini geçtiği ve sohbette en az bir güçlü onarım ifadesi bulunduğu turda açılabiliyor. Tahmin ile tespit ayrımı korunuyor: şerit yalnızca gerçekleşmiş tekrarda çıkıyor, model kartı ise bir tahmin olduğunu ve gerekçesini söylüyor.

## K08. Eğitim verisi WildChat 4.8M, hazır etiket kaynağı WildFeedback olur

**Bağlam.** Keşif analizini WildChat 1M ile yaptık. Bu sürüm 2023 ile 2024 arasını ve eski modelleri kapsıyor; Türkçe sohbet sayısı da az.

**Karar.** Model eğitiminde Ağustos 2025'e kadar uzanan, yaklaşık 3,2 milyon sohbetlik WildChat 4.8M kullanılır. İngilizce sohbetlerde ikinci etiket katmanı olarak Microsoft'un WildFeedback veri setindeki tur bazlı memnuniyetsizlik etiketleri kullanılır.

**Neden.** Daha güncel modeller ve kullanım biçimleri, daha fazla Türkçe sohbet. WildFeedback etiketleri, aynı yöntemi kendimiz uygulamanın maliyetini ve süresini ortadan kaldırıyor.

**Bedeli.** WildFeedback etiketleri bir dil modeli tarafından üretildi; insan etiketi gibi değil, ikinci bir görüş gibi kullanılmalı. Veri seti büyük olduğu için tamamı değil, akış halinde örneklem alınarak kullanılacak.

## K09. Eklentinin ilk sürümü modelsiz, kural tabanlı çalışır; kesinti yalnızca benzer mesajda olur

**Bağlam.** K05 küçük bir modelin tarayıcıda çalışmasını öngörüyor, K07 ise önerilerin kesin sinyallerle tetiklenmesini istiyor. Eğitilecek modelin henüz olmaması, ürünün kullanıcıya değer vermeye başlamasını engellememeli.

**Karar.** İlk sürümde eklenti yalnızca kesin sinyallerle çalışır: gönderim anında mesaj son 5 mesajla karşılaştırılır; benzerlik eşiği aşılırsa mesaj bekletilir ve kısa bir şerit gösterilir ("Yine de gönder", düzenle, "Yerinde değildi"). Benzer olmayan mesajlara hiç dokunulmaz. Sohbet yeterince uzayıp tekrar görüldüğünde çıkış kartı önerilir; "Taze başlat" o ana kadarki isteklerden kısa bir özet taslağı çıkarır, panoya kopyalar ve yeni sohbet açar. Model halkası sonraki aşamada yalnızca ipucu olarak eklenecek (K07).

**Neden.** Bekletme yalnızca olmuş bir tekrara dayandığı için yanlış alarm riski düşüktür ve her uyarı gerekçesini taşır. Kullanıcı her an "Yine de gönder" ile devam edebilir; yasak ya da süre sınırı yoktur.

**Bedeli.** Anlamca aynı ama kelimece farklı mesajlar yakalanmaz (K03). Çıkış kartı yalnızca tur sayısı ve tekrar sayısına bakar, görev türünü bilmez.

**Değiştirildi (K17).** Eklenti artık bir tur modeliyle de çalışıyor; model yüksek güvenle döngü tahmin ettiğinde ve sohbette en az bir onarım ifadesi bulunduğunda çıkış kartını açabiliyor. Mesajın bekletilmesi (kesinti) hâlâ yalnızca benzer mesajda oluyor.

## K10. Siteler ortak bir adaptör arayüzüyle desteklenir; sayfa yapısı tanınmazsa eklenti sessizce devre dışı kalır

**Bağlam.** ChatGPT ve Gemini'nin sayfa yapıları farklı ve haber verilmeden değişebilir. Gemini'de `form` yoktur; mesaj kutusu `ql-editor`, gönderme çoğunlukla Enter iledir.

**Karar.** Sayfaya özgü her şey (mesaj kutusu, gönder düğmesi, üretim durumu, sohbet geçmişi, sohbet adresi) tek bir `Adapter` arayüzünün arkasındadır. Çekirdek, arayüz ve sayaçlar sitelerden bağımsızdır. Bir adaptör beklenen yapıyı bulamazsa eklenti hata göstermez, o sayfada kendini devre dışı bırakır. Gemini adaptörü gerçek sayfada ölçülen yapıya göre yazıldı ve canlı olarak sınandı: gönderme, tekrar uyarısı, sohbet geçişi, geçmişi okuma, çıkış kartı ve mesaj düzenleme.

**Neden.** Yeni site eklemek yalnızca yeni bir adaptör yazmak demektir. Sayfa değişirse kullanıcı bozuk bir ekranla değil, eklentisiz normal bir sayfayla karşılaşır.

**Bedeli.** Sayfa yapısı değiştikçe adaptörlerin bakımı gerekir. Henüz desteklenmeyenler: Gemini Gems sayfaları, çok uzun sohbetlerde tembel yüklenen geçmişin eksik sayılması ihtimali, Türkçe ve İngilizce dışındaki arayüz dilleri.

## K11. Mesaj metni yalnızca bellekte tutulur; eklentide ağ isteği yapan kod yoktur

**Bağlam.** Ürünün temel sözü mesajların cihazdan çıkmaması.

**Karar.** Mesaj metni yalnızca sekmenin belleğinde, o sekme açık kaldığı sürece durur. Hiçbir ağ isteği yapılmaz. Manifestteki içerik güvenlik politikası (`connect-src 'none'`) eklenti sayfalarında (araç çubuğu penceresi) ve arka plan çalışanında ağ isteğini tarayıcı düzeyinde engeller. İçerik betiği ise ChatGPT ya da Gemini sayfasının içinde, o sayfanın kurallarıyla çalışır; bu politika onu kapsamaz. İçerik betiği için güvence bir testten gelir: `extension/src/no-network.test.ts`, derlenmiş üç dosyada `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource` ve `importScripts` adlarının hiç geçmediğini her test çalıştırmasında denetler. Konsola metin yazılmaz, yalnızca uzunluk ve benzerlik skoru yazılır. "Taze başlat" taslağı yalnızca kullanıcının tıklamasıyla panoya yazılır.

**Neden.** Gizlilik sözünü denetlenebilir kılmak: eklenti sayfalarında tarayıcının zorladığı bir kural, içerik betiğinde her derlemede çalışan bir test.

**Düzeltme notu.** Bu kararın ilk metni, `connect-src 'none'` kuralının içerik betiğini de kapsadığını söylüyordu; bu yanlıştı. Metin düzeltildi ve içerik betiği için yukarıdaki test eklendi.

**Bedeli.** Sekme kapanınca oturum bilgisi gider; eklenti geçmişi hatırlayamaz. Sohbet geçmişi sayfanın kendisinden okunur. Uzaktan hata raporu ya da kullanım analitiği yapılamaz.

## K12. Ayarlar araç çubuğu penceresinde, yalnızca Türkçe; saklanan tek veri iki ayar ve günlük sayaçlar

**Bağlam.** Kullanıcı eklentiyi kapatabilmeli, çıkış kartını kapatabilmeli ve eklentinin ne yaptığını görebilmeli.

**Karar.** Ayarlar araç çubuğu simgesinin penceresinde durur: "Eklenti açık" ve "Çıkış kartı" anahtarları, son 7 günün sayaçları ve "Tüm verilerimi sil". `chrome.storage.local` içinde yalnızca iki ayar ve günlük sayaçlar saklanır; sayaçlar 90 gün sonra silinir. Çıkış kartında "Bir daha gösterme", şeritte "Yerinde değildi" seçenekleri vardır; ikincisi yalnızca sayaca yansır ve mesaj metni kaydedilmez. Arayüz şimdilik yalnızca Türkçedir.

**Neden.** Kullanıcı eklenti üzerinde tam denetime sahip olur. Sayaçlar, eşiklerin gerçek kullanımda nasıl davrandığını görmemizi sağlar; "Yerinde değildi" sayısı yanlış alarm oranının en doğrudan ölçüsüdür.

**Bedeli.** Türkçe bilmeyen kullanıcılar için arayüz yetersiz. Sayaçlar yalnızca o tarayıcı profilinde durur, cihazlar arası birleştirilmez.

**Değiştirildi (K18).** Sayaçlar artık ayarlardan ayrı, şemalı ve boyutlu tutuluyor (`kafiai.counts.v2`). Saklanan veri yine yalnızca ayarlar ve sayılar; buna "Taze başlat" sonrası yeni sohbeti tanımak için on dakikalık bir işaret (yalnızca platform kimliği ve son geçerlilik zamanı) eklendi.

## K13. Çıkış kartı eşikleri geçicidir, WildChat ile kalibre edilecek

**Bağlam.** Çıkış kartı, tur sayısı ve tekrar sayısına göre açılıyor. Mevcut değerler (`EXIT_CARD_MIN_TURNS = 6`, `EXIT_CARD_MIN_REPEATS = 1`, `EXIT_CARD_COOLDOWN_TURNS = 5`) elle seçildi ve yalnızca birkaç canlı denemeyle sınandı.

**Karar.** Bu değerler geçici kabul edilir. Gerçek sohbet verisi (WildChat) üzerinde, görev türüne göre tur normları çıkarılarak ve çıkış kartının hangi sohbetlerde, hangi turda açılacağı simüle edilerek yeniden ayarlanacak. Kalibrasyon sonucu bu belgeye yeni bir karar olarak eklenecek ve bu karar "değiştirildi" notu alacak.

**Neden.** Elle seçilmiş bir sayıyı gerekçelendirmeden kalıcı kabul etmek, K06'nın "rapordaki sayılar ile koddaki değerler aynı yerden okunur" ilkesine aykırı olur.

**Bedeli.** Kalibrasyona kadar çıkış kartı bazı sohbetlerde erken, bazılarında geç çıkabilir.

**Değiştirildi.** Kalibrasyon yapıldı; yeni değerler ve gerekçeleri K14'te.

## K14. Eşikler WildChat ile kalibre edildi: şerit 0,8, yumuşak tekrar 0,6, çıkış kartı görev normuna göre

**Bağlam.** K13'teki geçici değerler gerçek sohbet verisiyle sınanmamıştı. Eklentinin benzerlik hesabı Python'a birebir aktarıldıktan sonra (`src/kafiai/extension_similarity.py`), eklentinin davranışı WildChat 1M örnekleminde, şablon sohbetler hariç 41.753 sohbet ve 55.483 karşılaştırılan gönderim üzerinde taklit edildi (`scripts/calibrate_extension.py`). Benzerlik aralıklarının her birinden mesaj çiftleri okunup "aynı talebin tekrarı mı" diye ön etiketlendi (80 çift, `outputs/threshold_labels_preliminary.json`).

**Bulgular.**

| Şerit eşiği | Şeridin çıktığı gönderim | Şeridin çıktığı çok turlu sohbet | Tahmini isabet |
|---|---|---|---|
| 0,6 (eski) | %28,1 | %39,9 | %59 |
| 0,7 | %20,5 | %31,8 | %74 |
| 0,8 (yeni) | %14,7 | %24,3 | %83 |
| 0,9 | %8,9 | %15,8 | %88 |

0,6 ile 0,8 arasındaki çiftlerin çoğu aynı talebin tekrarı değil; aynı işin yeni bir metne uygulanması ("şu paragrafı da çevir"), aynı konuda yeni bir soru ya da bir sonraki bölümün istenmesi. Bu aralıkta kullanıcıyı durdurmak, verdiğimiz her iki uyarıdan birinin yersiz olması demek.

Görev türüne göre çok turlu sohbetlerin uzunluğu birbirine yakın: ortanca 3 tur, %75'lik dilim 4 ile 6, %90'lık dilim 8 ile 10 tur. Eski kural (6. tur ve en az bir tekrar) çok turlu sohbetlerin %14,4'ünde kart açıyordu.

**Karar.**

1. Şerit eşiği 0,8: kullanıcı yalnızca neredeyse aynı mesajda durdurulur.
2. Yumuşak eşik 0,6: 0,6 ile 0,8 arasındaki mesajlar kullanıcıyı durdurmaz, yalnızca çıkış kartı için tekrar denemesi sayılır.
3. Çıkış kartı, sohbetin görev türündeki %90'lık dilimi aştığında (en az bir tekrar denemesiyle) açılır. Görev türü ilk mesajdan, Python ve eklentinin ortak okuduğu `extension/src/data/task-rules.json` kurallarıyla belirlenir; normlar `extension/src/data/task-norms.json` dosyasına kalibrasyon scriptiyle yazılır. Tür bilinmiyorsa sınır 9. turdur.
4. Kart metni normu söyler: "Kod yazma ve hata ayıklama sohbetlerinin çoğu 5 turda ya da daha kısa sürede bitiyor; bu sohbet 9. turunda."

Yeni kurallarla kart çok turlu sohbetlerin %6,9'unda, ortanca 9. turda açılıyor.

**Neden.** Durdurmak en pahalı müdahale; yalnızca isabetin yüksek olduğu yerde yapılmalı. Yumuşak eşik, farklı kelimelerle yapılan tekrarları tamamen kaybetmeden daha az müdahaleci olan çıkış kartına aktarır. Normlar, karttaki sayının elle seçilmiş değil, gerçek kullanımdan gelmesini sağlar.

**Bedeli.**

- Ön etiketler 80 çiftle ve bir dil modeliyle yapıldı; isabet tahminleri kaba. Ekip `data/processed/labeling/threshold_pairs.csv` dosyasındaki çiftleri elle etiketleyip scripti yeniden çalıştırmalı.
- Görev türü kuralları basit; çok turlu sohbetlerin yaklaşık %70'i "diğer" türüne düşüyor, bu sohbetlerde kart normsuz cümleyi kullanıyor.
- Normlar 2023 ile 2024 ChatGPT verisinden; WildChat 4.8M ile yeniden hesaplanmalı.

## K15. Etiketin ikinci sürümü: benzerlik değil güçlü onarım ifadeleri esas alınır

**Bağlam.** K02'deki ilk etiket, ilk iki turdan sonra en az 2 benzer mesaj ya da en az 2 onarım ifadesi görülen sohbetleri döngü sayıyordu. WildFeedback'teki memnuniyetsizlik (DSAT) işaretleriyle karşılaştırıldığında bu etiketin işaretlediği sohbetlerde memnuniyetsizlik oranı genel orandan neredeyse farksız çıktı (1,09 kat). Benzer mesajların çoğu "AA için listele, AB için listele" gibi verimli seri işlerdi.

**Karar.** Yeni etikette (`labels.loop_label`) bir sohbet şu durumda döngü sayılır: ilk iki turdan sonra en az 2 güçlü onarım ifadesi, ya da 1 güçlü onarım ifadesi ile birlikte 1 birebir yeniden gönderim (benzerlik 0,97 üstü). Güçlü onarım listesi (`text.STRONG_REPAIR_PATTERNS`) yalnızca WildFeedback'te memnuniyetsizliği en az 2 kat artıran ifadelerden oluşur. İlk etiket karşılaştırma için tablolarda `label_v1` olarak tutulur.

**Neden.** Yeni etiket memnuniyetsizliği 2,87 kat daha sık gösteriyor. Kural, WildFeedback'in yarısına bakılarak seçildi ve hiç bakılmayan öbür yarıda aynı sonucu verdi (`outputs/label_validation.json`, docs/08 Bölüm 5.1).

**Bedeli.** Pozitif oranı %10'dan %7'ye düştü, yani modelin öğreneceği örnek azaldı. Türkçe onarım ifadeleri WildFeedback İngilizce olduğu için henüz doğrulanmadı. Ürün açısından da bir sonucu var: 0,6 ile 0,8 arasındaki yumuşak tekrarlar (K14) tek başına memnuniyetsizlik göstermiyor; çıkış kartının tekrar sayımı ileride onarım ifadeleriyle birleştirilmeli.

## K16. Model WildChat 4.8M ile eğitilir; eklenti için 25 öznitelikli Logistic Regression seçilir

**Bağlam.** İlk denemedeki model 1M örnekleminden çıkan 8.094 sohbetle eğitilmişti ve tek bir eğitim/test bölmesiyle ölçülmüştü. K08, eğitim verisinin WildChat 4.8M olmasını öngörüyordu.

**Karar.** WildChat 4.8M'in 86 dosyasından zamana yayılmış 10'u indirildi; bu dosyalardaki tüm çok turlu sohbetler temizlendikten sonra 28.123 sohbetlik eğitim tablosu oluştu. Öznitelik sayısı 11'den 25'e çıkarıldı (görev türü, eklenti benzerliği, ikinci mesajda güçlü onarım, uzunluklar). Beş yöntem kullanıcı bazlı 5 katlı çapraz doğrulama ve hiperparametre aramasıyla karşılaştırıldı (`scripts/train_models.py`). Eklenti için 25 öznitelikli Logistic Regression seçildi; katsayıları `outputs/logreg_model.json` dosyasında.

**Neden.** 25 öznitelikli model aynı model türünde CV PR-AUC'yi 0,195'ten 0,245'e çıkardı. Karakter n-gram eklenen model ana testte %16 daha iyi, ama Türkçe testte geride kalıyor, 65.536 ağırlık taşıyor ve uyarının gerekçesini açıklamak zorlaşıyor. Seçilen model eğitimde görmediği WildChat 1M'de rastgelenin 4,7, Türkçede 2,4 katı; bizim etiketimizden bağımsız DSAT işaretlerinde de 1,6 katı.

**Bedeli.** Model döngü dediğinde yaklaşık 4 seferden 1'inde haklı; bu yüzden eklentide engel değil, yüksek eşikli yumuşak bir öneri olarak kullanılmalı. Olasılıklar kalibre değil; kullanıcıya yüzde olarak gösterilmemeli.

**Değiştirildi.** Eklentiye giren model K17'deki tur modeli oldu; bu modelin öznitelikleri tarayıcıya taşınabilecek şekilde yeniden seçildi.

## K17. Eklentide her mesajda çalışan, kalibre edilmiş tur modeli; kart yalnızca yüksek güven ve kanıt şartıyla

**Bağlam.** K16'daki model yalnızca ilk iki mesajı görüyordu, olasılıkları kalibre değildi ve bazı öznitelikleri (sklearn'ün karakter n-gram benzerliği) tarayıcıya taşınamıyordu. Oysa döngünün en güçlü işareti olan onarım ifadeleri çoğunlukla 3. mesajdan sonra geliyor.

**Karar.** Model her sohbetten k = 2 ile 6 arası turlar için örnek alınarak yeniden eğitildi; 22 öznitelik eklentide birebir aynı hesaplanıyor (`turn_features.py`, `turn-features.ts`). Güçlü onarım kuralları ortak bir JSON dosyasına taşındı. Olasılıklar Platt ölçekleme ile kalibre edildi. Çıkış kartı, görev normuna ek olarak modelin yüksek güven eşiğini (kesinlik en az %40 olacak şekilde eğitim verisinden seçildi) geçtiği ve sohbette en az bir güçlü onarım ifadesi bulunduğu turda açılabiliyor. Kart, en çok katkı yapan özniteliğe göre bir gerekçe ve somut bir öneri gösteriyor; "Yerinde değildi" geri bildirimi yalnızca sayı olarak tutuluyor. Ayrıntılar: docs/09.

**Neden.** Aynı test kullanıcılarında 2. turda PR-AUC 0,199'dan 0,213'e çıktı, 6. turda 0,364'e (rastgelenin 4,7 katı) ulaştı. Kalibrasyon hatası (ECE) 0,337'den 0,013'e indi. Kanıt şartı kartın isabetini %33'ten %38'e çıkardı, yakalanan döngü oranını yalnızca 1,6 puan düşürdü.

**Bedeli.** Kart açıldığında yaklaşık 8 seferden 5'inde sohbet döngüye girmiyor; bu yüzden kart engellemiyor, kapatılabiliyor ve bekleme süresine uyuyor. Model asistanın cevaplarını görmüyor. Türkçe onarım ifadeleri henüz elle doğrulanmadı.

## K18. Sayaç şeması v2: günlük, seyrek, boyutlu ve yalnızca sayı; ortak JSON şemasıyla doğrulanır

**Bağlam.** İlk sayaçlar (K12) günde 19 sabit sayıdan oluşuyordu. Haftalık içgörü (P3), çok platformlu pilot (P7) ve mikro randomize deney için şunları ayırabilmek gerekiyor: hangi platformda, günün hangi diliminde, hangi işte, sohbetin kaçıncı turunda; bir önerinin tetiklendiği ama gösterilmediği durumlar ve nedeni; sohbetlerin sonucu. Bunu yaparken gizlilik sözü (K11) değişmemeli.

**Karar.**
- Sayaçlar `chrome.storage.local` içinde `kafiai.counts.v2` anahtarında, günlük ve 90 gün saklanır. Her gün bir faz (sayım, öneri ya da karışık) ve yalnızca sıfır olmayan hücrelerden oluşur.
- Hücre anahtarı `olay|boyut1|...|ayrıntı`. Boyutlar: platform, saat dilimi (00–06, 06–12, 12–18, 18–24), görev türü, tur kovası (1–3, 4–6, 7–10, 11+), ilk mesaj uzunluğu kovası (80 ve 400 karakter sınırları). Olaylar: gönderim, şerit, şerit eylemleri, onarım düğmesi (türüyle), çıkış kartı (norm ya da model kaynaklı; tetiklendi, gösterildi, gizlendi ve nedeni), kart eylemleri, "Taze başlat" sonrası yeni sohbetin tur kovası, yeniden üretme, düzenleme ve sohbet sonucu (döngü ya da normal).
- Şema tek bir JSON dosyasında (`extension/src/data/counter-schema.json`). Eklenti (`src/core/counters.ts`) ve Python (`src/kafiai/counters.py`) aynı dosyayla doğrular; şemaya uymayan her hücre okunurken atılır.
- Yazmalar birikir ve iki saniyede bir, sekme arka plana geçince ya da kapanırken tek seferde yazılır.
- Sürüm 1 sayaçları ilk okumada bir kez v2'ye taşınır (boyutlar "na") ve eski anahtar silinir.
- "Sayaçlarımı kopyala" çıktısı sürüm numaralıdır: `{"schema": "kafiai.counts", "version": 2, "exported": "YYYY-MM-DD", "days": {...}}`.
- "Taze başlat"a basılınca yeni sohbeti tanımak için `kafiai.pending_fresh` anahtarına yalnızca platform kimliği ve on dakikalık son geçerlilik zamanı yazılır; yeni sohbet açılınca okunur ve hemen silinir.

**Neden.** Boyutlar, P3'teki "döngüler ne zaman, hangi işte, hangi platformda" sorularını ve P7'deki iki fazlı karşılaştırmayı mümkün kılıyor. Gizlilik yapısal olarak korunuyor: boyut değerleri şemadaki kısa ve sabit sözcük listelerinden geliyor, başka bir değer kabul edilmiyor; mesaj metni, sohbet kimliği ya da adres anahtara girecek bir yol bulamıyor. Bunu bir test sınıyor: rastgele mesajlarla kullanım benzetiminden sonra depoda hiçbir mesaj kelimesi, adres ya da kimlik bulunmuyor ve tüm anahtarlar izinli listeden geliyor (`counters.test.ts`).

**Boyut.** Günde 300 olayla 90 günlük yoğun kullanım benzetiminde depolanan veri 1,5 MB'ın altında kalıyor (test). `chrome.storage.local` sınırı 10 MB.

**Bedeli.** Hücre sayısı boyutların çarpımıyla büyüyebilir; seyrek saklama ve 90 günlük süre bunu sınırlıyor. Sohbet sonucu yalnızca kullanıcının o ziyarette en az bir mesaj gönderdiği sohbetler için ve sohbetten ayrılırken bir kez sayılıyor; aynı sohbete başka bir gün dönülürse ikinci kez sayılabilir. Sürüm 1'den taşınan sayıların boyutları bilinmiyor.

**Durum (Kasım 2026).** Pilot ve iki fazlı karşılaştırma yapılmadı (K28). Boyutlar haftalık içgörüde ve kullanıcının "Sayaçlarımı kopyala" ile aldığı dökümde kullanılıyor; şemaya sonradan eklenen olaylar (`signal`, `hint`, `loop_end`) sürüm 2 içinde ve geriye uyumlu.

## K19. Platform kaydı: desteklenen siteler ve yetenekleri tek yapılandırma dosyasında

**Bağlam.** Sırada Claude, Copilot ve Google AI Modu var (P5). Her platform aynı yeteneklere sahip değil (yeniden üretme ve düzenlemeyi yakalayabilmek gibi) ve P4'ün sonucuna göre bir platformda modelin kapatılması ya da yalnızca sayım yapılması gerekebilir.

**Karar.** Desteklenen siteler `extension/src/data/platforms.json` dosyasında tek listede durur: her platformun içerik betiğinin çalıştığı adresler ve yetenekleri (`regenerate`, `edit`, `model: on | off`, `interventions: full | count_only`). Adaptör arayüzü platform kimliği ve isteğe bağlı `onRegenerate`, `onEdit` olaylarıyla genişledi. İçerik betiği adaptörü bu kayıttan seçer; model kapalıysa tahmin yapılmaz, `count_only` ise şerit ve kart gösterilmez, yalnızca "gizlendi_platform" olarak sayılır. Manifestteki içerik betiği adresleri ve site izinleri kayıtla birebir aynı olmak zorunda; `registry.test.ts` bunu denetler.

**Neden.** Yeni bir platformu eklemek ya da bir platformda modeli kapatmak kod değil yapılandırma değişikliği olur ve tek yerden izlenir. Manifest ile kaydın ayrışması (yeni bir sitede betiğin çalışıp adaptörün bulunamaması ya da tersi) test aşamasında yakalanır.

**Bedeli.** Platform başına yalnızca açma, kapama ve sayım ayarı var; tüm platformlar aynı modeli kullanıyor; platforma özel model yok.

## K20. Şerit, yeni içerik kelimesi getiren mesajda çıkmaz

**Bağlam.** Karakter 3-gram benzerliği "1. soruyu çöz" ile "2. soruyu çöz" ya da "Türkiye'nin başkenti neresi" ile "Amerika'nın başkenti neresi" gibi mesajları neredeyse aynı sayıyor ve şerit "Bunu az önce de sormuştun" diyordu. Oysa bunlar tekrar değil, seri ya da yeni bir istek. Gerçek kullanımda görülen bu hata, şeridin güvenini en çok zedeleyen şeydi.

**Karar.** Benzerlik 0,8'i geçse bile yeni mesaj öncekinde olmayan bir içerik kelimesi getiriyorsa şerit çıkmaz. Dolgu kelimeleri ("lütfen", "yine", "tekrar" gibi) içerik sayılmaz; aynı kökten gelen kelimeler (ilk 4 harf) aynı sayılır; rakam içeren kelimeler tam karşılaştırılır. Kurallar `extension/src/data/repeat-rules.json` dosyasında durur; eklenti (`repeat-detector.ts`) ve Python (`extension_similarity.py`) aynı dosyayı okur.

**Neden.** Yanlış uyarı vermek, uyarıyı kaçırmaktan daha zararlı: kullanıcı bir kez haksız yere uyarılırsa şeridi görmezden gelmeye başlar. Kuralın dosyada durması ayarlamayı kod değişikliği olmadan mümkün kılar.

**Bedeli.** Mesaja bir kelime eklemek ("... lütfen" dışında) şeridi susturur; gerçekten tekrar olan ama yeni bir kelimeyle sunulan istekler artık yakalanmaz. Bu seçim bilerek yapıldı.

## K21. Karşılama ekranı: ilk kurulumda bir kez açılır, yalnızca üç şeyi söyler

**Bağlam.** Eklenti kullanıcının sohbetlerine bakıyor. Neye baktığını ve neye bakmadığını kullanıcıya baştan söylememek, eklentinin kendi gizlilik ilkesiyle çelişir (Bölüm 6, 3.1).

**Karar.** Eklenti ilk kurulduğunda (`onInstalled` nedeni `install`) `welcome.html` yeni bir sekmede açılır; güncellemede ve yeniden yüklemede açılmaz. Sayfa neye baktığını, neye bakmadığını, verinin nerede durduğunu, ne göreceğini ve nasıl kapatılacağını anlatır; tek düğmesi "Anladım"dır. Araç çubuğu penceresinde "Kâfi AI nasıl çalışır?" bağlantısı sayfayı yeniden açar. Metinler `textContent` ile yazılır ve kodda gerçekten olan şeyleri anlatır; "bağımlı", "risk", "seri", "rozet" gibi sözler testle yasaklanmıştır.

**Neden.** Gizlilik sözü kullanıcıya eklentiyle birlikte gelmeli. Sayfa ağ isteği yapmaz ve yeni izin istemez.

**Bedeli.** Ekran yalnızca bilgilendirir; kullanım amacı ve gece sınırı gibi tercihler sorulmaz (K50 ile kapsam dışı).

## K22. Adaptör testleri gerçek sayfa görüntüleriyle yapılır; görüntüler depoya yalnızca temizlenmiş hâlde girer

**Bağlam.** Adaptörler sitelerin sayfa yapısına bağlı ve siteler bu yapıyı sık değiştiriyor. Elle yazılmış küçük HTML örnekleri gerçek sayfadaki ayrıntıları (sanal liste, gizli etiketler, düğme sırası) kaçırıyordu. Gerçek sayfa kaydı ise hesap adı, e-posta, sohbet başlığı ve belirteç gibi kişisel veriler taşıyor.

**Karar.** Her site için birkaç durumda (boş sohbet, cevap üretilirken, cevap bitince, uzun geçmiş, düzenleme açık, yeniden üretildi) sayfa kaydedilir. Ham kayıtlar `snapshots_raw/` altında ve git dışında durur. `scripts/sanitize_snapshot.py` betikleri, stilleri, yorumları, e-postaları, verilen hesap adlarını, resim adreslerini, sohbet bağlantılarını, başlığı ve belirteç benzeri dizgileri çıkarır, neyi kaç kez çıkardığını raporlar ve temizlikten sonra kalan bir şey bulursa dosyayı yazmaz. Temizlenmiş görüntüler `extension/test-snapshots/` altına girer; her test çalıştırmasında yeniden denetlenir.

**Neden.** Adaptör testleri sitenin gerçek yapısını sınar ve depoya kişisel veri girmez.

**Bedeli.** Mesaj metinleri temizlenmez; kayıt için uydurma mesajlarla sohbet açılması gerekir. Belirteç tespiti sezgiseldir.

## K23. Kişisel ve duygusal sohbetlerde öneri gösterilmez; tespit kural tabanlıdır

**Bağlam.** Kâfi AI verimlilik önerisi yapıyor. Bir kullanıcının ayrılık, yas ya da kendine zarar düşünceleri hakkında yazdığı bir sohbette "isteklerini toplayıp yeni sohbet aç" demek hem yersiz hem zararlı olur.

**Karar.** Türkçe ve İngilizce kelime gruplarından oluşan bir kural (`extension/src/data/personal-rules.json`, Python ikizi `src/kafiai/personal.py`) sohbetin kişisel olup olmadığına bakar. Bir mesaj eşleşirse o sohbette şerit, kart, halka ve "Bu sohbet" önerisi gösterilmez; yalnızca "gizlendi_kisisel" olarak sayılır. Kurgu isteklerinde ("şiir yaz", "write a story") yalnızca kendine zarar ifadeleri sayılır. Türkçe karaktersiz yazım da tanınır.

**Neden.** Yanlış pozitifin bedeli yalnızca gösterilmeyen bir öneri; yanlış negatifin bedeli kırılgan bir anda yargılayıcı görünen bir müdahale. Ölçüm: ilk mesajlarda tetiklenme WildChat 1M'de %0,34, 4.8M'de %0,20, 4.8M Türkçe alt kümesinde %0,75, WildFeedback'te %0,44. Örneklemde yanlış pozitifler çoğunlukla yine kişisel hayata dokunan metinlerdi (vize mektubunda "my wife"); "mental health", "my ex" ve "ayrıldık" bu yüzden listeden çıkarıldı.

**Bedeli.** Kural anlam değil kelime arıyor; dolaylı anlatımları kaçırabilir.

## K24. Haftalık içgörü ve "Bu sohbet" araç çubuğu penceresinde; sayfaya kalıcı öğe eklenmez

**Bağlam.** Kullanıcının kendi örüntüsünü görmesi ürünün ikinci ayağı (Bölüm 6). Bu bilgiyi sohbet sayfasına kalıcı bir panel olarak koymak dikkat dağıtır.

**Karar.** Araç çubuğu penceresinde iki bölüm var. "Bu sohbet": sekmedeki içerik betiğinden tarayıcı içi mesajla yalnızca sayılar ve sabit sözcükler istenir (`src/core/messages.ts`); cevapta mesaj metni yoktur. "Son 7 gün": sayaçlardan hesaplanan içgörüler (`src/core/insights.ts`, Python ikizi `src/kafiai/insights.py`, parite testiyle). Eşikler `insights-config.json` dosyasında: en az 5 sohbet, görev başına en az 3 sohbet. Görevler açılır kapanır satırlar; "İstersen…" tonunda tek öneri. "Yalnızca say" modunda içgörü gösterilmez.

**Neden.** Örüntü kullanıcı istediğinde görünür; sohbet sayfasında yalnızca halka, şerit ve kart vardır.

**Bedeli.** Pencereyi açmayan kullanıcı içgörüyü hiç görmez.

## K25. Platform başına model kararı veriyle verilir

**Bağlam.** Tur modeli WildChat'teki GPT sohbetleriyle eğitildi. Gemini, Claude ve Copilot sohbetlerinde de işe yarayıp yaramadığı bilinmiyordu.

**Karar.** `scripts/evaluate_platforms.py` modeli eğitime girmemiş gruplarda ölçer: WildChat 4.8M test kullanıcıları ve model aileleri, WildChat 1M, WildFeedback, ShareChat platformları ve LMSYS model aileleri. Model bir platformda üç koşulla açık kalır: en az 300 etiketlenebilir sohbet, PR-AUC en az döngü oranının 1,5 katı ve kart kesinliği referanstan en fazla 10 puan düşük. Copilot ve Google AI Modu için doğrudan veri yok; altta yatan model ailesi vekil kullanılır. ShareChat ve LMSYS yalnızca değerlendirmede kullanılır, ham verileri depoya girmez (`outputs/platform_eval.json`).

**Neden.** Sonuç: beş platformun hepsinde model açık. ChatGPT ve Copilot için ShareChat/ChatGPT (PR-AUC katı 1,99, kart kesinliği %46), Gemini ve Google AI Modu için ShareChat/Gemini (1,99, %47), Claude için LMSYS/Claude (3,54, %47). WildFeedback'in gerçek memnuniyetsizlik etiketine karşı PR-AUC katı 1,64.

**Bedeli.** ShareChat'te sohbetler uzun ve döngü oranı yüksek; model burada olasılığı düşük tahmin ediyor ve kart eşiğinde yakalama %7 ile %9'a iniyor (WildChat'te %21). Platforma özel eşik yok.

## K26. Şerit metni duruma göre değişir; üçüncü denemede yeni sohbet önerilir

**Bağlam.** Tek bir şerit metni ("Bunu az önce de sormuştun") birebir tekrarda da, aynı isteğin yeniden ifadesinde de, üçüncü denemede de aynı şeyi söylüyordu.

**Karar.** Dört metin: birebir tekrar, yeniden ifade, ikinci deneme, üçüncü ve sonrası. İlk iki durumda görev türüne göre kısa bir ipucu çıkar. Üçüncü denemede ana düğme "Yeni sohbete geç" olur ve çıkış kartını açar.

**Neden.** Aynı yerde üçüncü kez dönen biri için onarım cümlesi yetmiyor; çıkış yolunu öne almak daha yararlı. Yargılayıcı ifadeler bilerek kullanılmadı; metin "sorun çoğu zaman sende değil, sohbette" fikrini taşıyor.

**Bedeli.** Daha fazla metin, daha fazla test.

## K27. Sayfa içi kartlar ortak bir görünüm kullanır; tema sayfanın arka planından seçilir

**Bağlam.** Şerit ve kart ayrı ayrı çizildiği için farklı görünüyordu; koyu sohbet sayfasında açık işletim sistemi temasıyla açık renkli kart beliriyordu.

**Karar.** Şerit, kart ve onay önerisi ortak bir yüzey kullanır (`src/ui/theme.ts`): marka işareti ve adı, bağlam etiketi, sol kenarda vurgu çizgisi, yuvarlatılmış düğmeler. Tema işletim sisteminden değil sayfanın gerçek arka plan renginden seçilir. Kart ekran genişliğine sığar, hareketi azaltma tercihine uyar ve ekran okuyucuya duyurulur.

**Neden.** Kâfi AI'nın her yüzeyi aynı ürün gibi görünür ve sohbet sayfasıyla karışmaz.

**Bedeli.** Sitelerin stil kuralları kartı bozmasın diye kartlar gölge DOM içinde çizilir ve sistem yazı tipini kullanır; sitenin kendi yazı tipi kartlara yansımaz.

## K28. Pilot yapılmaz; başarı WildFeedback üzerinde çevrimdışı yeniden oynatmayla ölçülür

**Bağlam.** İlk planda 10 kişilik bir haftalık pilot vardı (Bölüm 6). Bu sayıyla isabet hakkında güvenilir bir şey söylenemezdi; rıza, kurulum ve anket hazırlığı da proje süresinin önemli bir kısmını alacaktı.

**Karar.** Eklentinin karar zinciri Python'da birebir yeniden yazıldı (`scripts/evaluate_replay.py`) ve WildFeedback'teki gerçek sohbetlerde tur tur oynatılır. Her müdahale, veri setindeki gerçek memnuniyetsizlik işaretiyle karşılaştırılır. Rapor örneklemi en az iki turlu sohbetlerden tohum 42 ile seçilen 20.000 sohbettir. Kural seçimi bundan ayrık bir seçim örnekleminde (kalan sohbetlerden tohum 7 ile 20.000) yapılır, rapor örnekleminde doğrulanır. Ürünün davranışı ayrıca ChatGPT'de elle doğrulanır.

**Neden.** 20.000 gerçek sohbet, 10 kişilik bir pilottan çok daha güvenilir bir isabet ölçüsü verir; ayrık seçim örneklemi sayıların iyimser çıkmasını engeller.

**Bedeli.** WildFeedback'in memnuniyetsizlik etiketi bir dil modeliyle üretildi ve çoğunlukla İngilizce. Yeniden oynatma, kullanıcının bir öneriyi görünce davranışını değiştirip değiştirmediğini ölçmez. Türkçe kullanım için etiketli veri yok.

## K29. Halka: mesaj kutusunun yanında üç seviyeli sessiz gösterge

**Bağlam.** Tur modelinin ve sinyallerin erken uyarısı, kesinti yapmadan görünür olmalıydı.

**Karar.** Mesaj kutusunun köşesinde 18 piksellik bir halka. Üç seviye: sakin (neredeyse görünmez), belirgin (modelin öneri eşiği, bir benzer mesaj, bir özür ya da üst üste iki belirsiz istek) ve koyu (yüksek güven, iki benzer mesaj, üst üste iki özür ya da düzeltme alınmadı). Kırmızı yok; aynı rengin tonu koyulaşır, yükselişte bir kez hafif nabız atar. Üzerine gelince ya da klavyeyle odaklanınca neyi ölçtüğünü tek satırla söyler. Şerit ya da kart açıkken gizlenir; "Halka" ayarıyla kapatılabilir; "Yalnızca say" modunda görünmez.

**Neden.** Model yanılsa bile kullanıcının önüne bir şey çıkmaz; yalnızca ton değişir.

**Bedeli.** Fark edilmeyebilir; halkanın gerçekten görülüp görülmediği ölçülmüyor (yalnızca seviye değişimleri ve açıklamanın açılması sayılıyor).

## K30. Marka kimliği: Kâfi AI adı, slogan, palet, logo ve yazı tipi

**Bağlam.** Proje "KafiAI" adıyla başladı; eklentinin kullanıcıya görünen bir kimliği yoktu.

**Karar.** Ürünün adı **Kâfi AI**. Şapka yalnızca marka adında kullanılır; diğer metinler şapkasızdır. Slogan "Fark et. Durakla. Yeniden başla." Palet: kahverengi #44321B, bej #D2B48C, krem #F7EFE3, toprak #8B6B46, amber #C9A875. Logo ekibin kendi çizimi (`brand/logo-kaynak.png`); simgeler bu dosyadan üretilir. Pencere ve karşılama ekranında Montserrat yazı tipi pakete gömülü gelir. Ad ve renkler tek bir sabitten okunur (`extension/src/brand.ts`). Teknik adlar (konsol öneki `[KafiAI]`, Python paketi `kafiai`, depolama anahtarları) kullanıcı verisi kaybolmasın diye değişmedi.

**Neden.** Kâfi, "yeterli" demek: yapay zekayla çalışırken "bu kadarı yeter, başka yoldan deneyelim" diyebilmek ürünün fikri.

**Bedeli.** Kodda iki ad birlikte yaşıyor; README bunu açıklıyor.

## K31. Sanal liste kullanan sitelerde tur sayısı sayfanın bildirdiği toplamdan okunur

**Bağlam.** Claude ve Copilot sayfaları yalnızca ekrandaki mesajları çiziyor. 9 mesajlık bir Claude sohbetinde sayfada tek kullanıcı mesajı vardı.

**Karar.** Toplam mesaj sayısı mesajların `aria-setsize` özniteliğinden okunur (`extension/src/adapters/virtual-list.ts`). Eski mesajların metni okunamıyorsa görev türü bilinmiyor sayılır ve tur modeli o sohbette çalışmaz. Canlı gönderilen mesajlar bu sınırdan etkilenmez: adaptör gönderimi anında yakalayıp bellekte tutar; Taze başlat taslağı da bellekteki listeyi kullanır. Sayfanın ağ isteklerini dinleyerek geçmişi almak ilkeye aykırı olduğu için reddedildi.

**Neden.** Tur sayısı ve kart kuralları doğru çalışır; ilkeden taviz verilmez.

**Bedeli.** Eklenti kurulmadan önce başlamış uzun bir sohbette model çalışmaz.

## K32. Sohbet sinyalleri: özür döngüsü, çıkış, belirsiz istek ve konu kayması

**Bağlam.** WildFeedback'te cevap tarafı ölçüldü (`outputs/response_signal.json`). Cevapların %5,45'i özürle ya da "haklısınız" ile başlıyor ve sonrasında memnuniyetsizlik %29,7 (özürsüz %4,8); üst üste iki özürden sonra %43,8. Teşekkür ve "oldu, çalıştı" mesajlarında memnuniyet 12 kat yüksek. Benzer mesajdan sonraki memnuniyetsizlik dört tur içinde tabana iniyor.

**Karar.** Dört kural (`extension/src/core/signals.ts`, Python ikizi `src/kafiai/signals.py`, kurallar `signal-rules.json`, parite örnekleri `tests/fixtures/signals_parity.json`). Özür döngüsü: adaptör son cevabın başını yalnızca bellekte okur; tek özür halkayı 1'e, üst üste iki özür 2'ye çıkarır ve kartı açabilir. Çıkış: teşekkür ya da "oldu" döngü sinyallerini sıfırlar. Belirsiz istek ("daha iyi yap", "kısalt"): üst üste ikincisinde halka 1. Konu kayması: yeni konu yeni bölüm başlatır; Taze başlat taslağına yalnızca son konunun istekleri girer. Halka sohbetin tamamına değil son dört mesaja bakar.

**Neden.** Bu sinyaller tek başına modelden daha isabetli: özür kartının isabeti modelin kartından yüksek.

**Bedeli.** Cevabın başı okunuyor; yalnızca bellekte tutulsa da eklentinin cevap metnine baktığı açıkça söylenmeli (karşılama ekranında yazıyor).

## K33. Uzun sohbet kartı yalnızca yakın bir döngü işaretiyle açılır

**Bağlam.** Uzun sohbet kartının eski koşulu (görev normunu aşmak ve sohbette bir kez yumuşak tekrar) memnuniyetsizliği ayırmıyordu: %6,3, taban %6,6.

**Karar.** Görev normu aşıldığında kart yalnızca son dört mesajda benzer mesaj varsa ve model o turda en az öneri seviyesindeyse açılır.

**Neden.** Uzun ama verimli sohbetlerde yanlış alarm azalır.

**Bedeli.** Uzun sohbet kartı seyrekleşti; isabeti hâlâ diğer kaynaklardan düşük.

## K34. Kısa onarım ifadesi gönderim öncesi kısa bir şerit açar

**Bağlam.** 12 karakterden kısa mesajlar benzerlik karşılaştırmasına girmiyordu. Oysa kısa onarım ("olmadı", "yanlış", "hala hata") yapılan turlarda memnuniyetsizlik %45,8 (uzun mesajlarda %5,8). Aynı kısa mesajın tekrarı ("devam") ise memnuniyetsizlik göstermiyor (%4,9).

**Karar.** İlk mesaj dışında kısa ve güçlü onarım ifadesi taşıyan mesajda gönderim öncesi "Kısa düzeltme" şeridi çıkar: "Neyin olmadığını bir cümleyle eklersen cevap daha isabetli olur." Düğmeler: kod isteğinde "Hata mesajını ekle", diğerlerinde "Neyin yanlış olduğunu yaz"; "Beklediğimi yaz"; "Olduğu gibi gönder". Halka ve kart için tekrar denemesi gibi sayılır.

**Neden.** Kısa düzeltmeye bir cümle eklemek modelin neyi düzelteceğini anlamasını sağlar; yüksek isabetli bir an.

**Bedeli.** Kullanıcı kısa yazmak istiyorsa bir tık fazladan.

## K35. Kurallar veriyle inceltilir; yüksek güven eşiğine 0,30 alt sınırı

**Bağlam.** Onarım kuralının bazı parçaları uzun mesajlarda hiç ayırt etmiyordu; bazı güçlü ifadeler de listede yoktu.

**Karar.** Her parça WildFeedback'te ayrı ölçüldü ve her değişiklik verinin bir yarısında seçilip öbür yarısında doğrulandı. "still", "again", "hala", "yine" yalnızca 60 kelimeden kısa mesajda onarım sayılır. İki yarıda da en az 3 kat ayırt eden ifadeler eklendi (hata adları, "is not", "does not", "are you sure"). Tur modeli yeniden eğitildi; kartın yüksek güven eşiğine seçim örnekleminde seçilen 0,30 alt sınırı kondu. Ayrıntılar Bölüm 9'da.

**Neden.** Kart 100 sohbette 21,6'dan 18,9'a indi, isabeti %24,2'den %31,3'e çıktı; tekrarlayan memnuniyetsizlikte yakalama %20,9'dan %28,7'ye çıktı.

**Bedeli.** Etiket genişlediği için döngü oranı önceki sürümden yüksek çıkıyor (%6,7'den %9,0'a); eski sayılarla doğrudan karşılaştırılmamalı.

## K36. Kurallar Türkçe karaktersiz yazımı da tanır; Türkçe onarım karşılıkları eklenir

**Bağlam.** WildChat 4.8M'deki 2.403 Türkçe sohbette "başka" kelimesinin yaklaşık beşte biri "baska" diye yazılmıştı ve kurallar bunları tanımıyordu. Aynısı "yanlis", "olmadi", "calismiyor", "tesekkurler" için de geçerliydi.

**Karar.** Onarım, varyasyon, dolgu, çıkış, belirsiz istek ve kişisel sohbet listeleri Türkçe karaktersiz biçimi de kapsar (`text.ts` ve `extension_similarity.py` içindeki katlama). Katlanınca İngilizce bir kelimeyle çakışan "süper" (super) dışarıda bırakıldı. Doğrulanmış İngilizce ifadelerin Türkçe karşılıkları eklendi: "ama" ile başlama, "emin misin", "çalışmadı", "düzelmedi".

**Neden.** Hedef kitle Türkçe yazıyor ve klavyede Türkçe karakter kullanmamak yaygın.

**Bedeli.** Türkçe veride memnuniyetsizlik etiketi olmadığı için Türkçe ifadelerin isabeti ölçülemedi; elle doğrulamaya kaldı.

## K37. Benzer mesaj şeridi gönderimi yalnızca birebir tekrarda ve onarım ifadesinde bekletir

**Bağlam.** Şeridi açan 5.967 mesajın hata analizinde birebir tekrarda (benzerlik 0,99 ve üstü) memnuniyetsizlik %20, onarım ifadeli yakın tekrarda %24 ile %32, onarım ifadesi olmayan yakın tekrarda %6 ile %7,5 çıktı (taban %5). Şeritlerin yaklaşık dörtte biri bu son gruptaydı.

**Karar.** Gönderimi bekleten şerit için benzerliğin yanında birebir tekrar (0,99) ya da güçlü onarım ifadesi gerekir. Birebir olmayan yeniden yazım gönderimi bekletmez ama halka ve kart için benzer sayılmaya devam eder. Eşik seçim örnekleminde seçildi.

**Neden.** Yeniden oynatmada şerit 100 sohbette 14,7'den 10,1'e indi, isabeti %17,0'dan %21,5'e çıktı; yakalanan memnuniyetsiz turların %87'si korundu.

**Bedeli.** Bir kelimesi değiştirilmiş tekrarlar artık gönderilmeden önce durdurulmuyor; yalnızca halkayı koyulaştırıyor.

## K38. Gönderim ancak sayfada görülünce sayılır; çift olay tek sayılır; onarım cümlesi satır içine eklenir

**Bağlam.** ChatGPT'de elle doğrulamada üç hata görüldü. Yeni sekmede ChatGPT Enter'ı işlemedi ama mesaj sayıldı; kullanıcı yeniden gönderince yanlış bir benzer mesaj şeridi çıktı. ChatGPT Enter'dan sonra kendi Gönder düğmesine de tıklıyordu; ikinci olay benzer mesaj sanılıp bekletiliyor ve asıl gönderim durduruluyordu. Şerit düğmesi cümleyi yeni satıra eklemek için "yeni paragraf" komutu veriyordu; düzenleyici bunu Enter sayıp mesajı cümlesiz gönderdi.

**Karar.** Üç koruma ortak bir yardımcıda (`extension/src/adapters/send-confirmer.ts`) toplandı ve beş sitenin hepsinde kullanılıyor. Mesaj ancak sayfada gönderildiği görülünce sayılır: kutu boşaldı, yeni kullanıcı mesajı belirdi ya da üretim başladı (100 ms aralıkla en fazla 4 sn); görülmezse sayılmaz. Doğrulanmayı bekleyen aynı metnin ikinci olayı yeni bir girişim sayılmaz. Onarım cümlesi kutuya satır sonu olmadan, aynı satıra bir boşlukla eklenir (`appendInline`); Google AI Modu'nun düz metin kutusunda yeni satıra eklenir, çünkü orada tuş olayı oluşmaz.

**Neden.** Sayılmayan bir gönderim yanlış bir uyarıdan daha az zararlı. Her site için temizlenmiş sayfa görüntüleriyle iki test var: sayfa göndermezse sayılmaz, Enter ile tıklama tek sayılır.

**Bedeli.** Gönderim 100 ms ile 4 sn arasında gecikmeli sayılır. Gemini, Claude, Copilot ve Google AI Modu'nda bu korumalar sayfa görüntüleriyle sınandı, canlı sitede elle denenmedi.

## K39. Bir turda en fazla bir müdahale

**Bağlam.** Elle doğrulamada 3. turda kısa düzeltme şeridinden hemen sonra aynı turun cevabında çıkış kartı geldi; erken ve fazla bulundu.

**Karar.** Bir turda şerit çıktıysa kart en erken bir sonraki tura kalır; bekleme süresi başlamaz (`ExitCardPolicy.noteStrip`). Sayaçta "gizlendi_serit" olarak sayılır.

**Neden.** Yeniden oynatmada kart 18,9'dan 18,4'e, isabet %31,3'ten %30,4'e, yakalama %28,7'den %28,5'e değişti. Alternatif (model kartı en erken 4. tur) yakalamayı %12,6'ya düşürüyordu.

**Bedeli.** Az sayıda kart bir tur gecikiyor.

## K40. Soruyla biten cevaba verilen yalın "hayır" onarım sayılmaz

**Bağlam.** Model "… ekleyeyim mi?" diye sorduğunda kullanıcının "hayır" demesi bir şikayet değil, teklifi geri çevirmek. WildFeedback'te önceki cevap soruyla bittiyse "hayır" sonrası memnuniyetsizlik %4,9, bitmediyse %57,9.

**Karar.** Adaptörler cevabın ilk 600 karakterine ek olarak son 200 karakterini de yalnızca bellekte okur (`response-text.ts`). Cevap soruyla bittiyse yalın "hayır", "no", "gerek yok" kısa onarım sayılmaz.

**Neden.** Kısa onarım şeridi 100 sohbette 1,09'dan 0,91'e indi, isabeti %48,6'dan %57,7'ye çıktı.

**Bedeli.** Tur modelinin öznitelikleri değişmedi; model "hayır"ı hâlâ onarım ifadesi olarak görüyor.

## K41. Aynı kısa mesajın üçüncü kez gelmesi halkayı değil, niyet soran bir şeridi açar

**Bağlam.** Aynı kısa mesajın ("devam") üçüncü kez gelmesi halkayı yükseltiyordu; oysa o turlarda memnuniyetsizlik taban düzeyinde (%6). Bu bir döngü değil; model neyle ve nasıl devam edeceğini tahmin ediyor.

**Karar.** Halka yükselmez. Gönderim öncesi bir şerit çıkar: "Üst üste üçüncü kez kısa bir mesajla devam ediyorsun. Model neyle ve nasıl devam edeceğini tahmin ediyor." Düğmeler mesaj kutusuna bir başlangıç koyar: "Şununla devam et: " ya da "Bundan sonra şu şekilde devam et: "; ya da "Olduğu gibi gönder". Sohbet başına bir kez.

**Neden.** Yönü kullanıcıya veren bir öneri; uyarı değil.

**Bedeli.** Yeniden oynatmada 100 sohbette 0,5 kez çıkıyor; işe yarayıp yaramadığı memnuniyetsizlik etiketiyle ölçülemiyor.

## K42. Teklif sorularına üst üste kısa onaylarda "Yön sende" önerisi

**Bağlam.** Güncel sohbet asistanları cevaplarını sık sık bir teklif sorusuyla bitiriyor ("… ister misin?"). Kullanıcı üst üste yalnızca "evet", "aynen", "tamam" diye karşılık verince sohbetin yönü modelde kalıyor.

**Karar.** Soruyla biten cevaplara üst üste üç kısa onay ya da ret verilince cevabın altında "Yön sende" önerisi çıkar. Gönderimi bekletmez, odağı almaz, sohbet başına bir kez çıkar; aynı turda kart ya da şerit varsa çıkmaz. "Özetlet" düğmesi mesaj kutusuna modelden şu ana kadar anladığını üç maddede özetlemesini ve seçenek sunmasını isteyen bir cümle koyar. "devam" sayılmaz. Kâfi AI metni anlamaz; özetlemeyi sohbetteki yapay zeka yapar.

**Neden.** Kısa onay zincirleri memnuniyetsizlik göstermiyor (%2,5, taban %5,85); bu bir döngü uyarısı değil, kullanıcının yönü eline almasını kolaylaştıran bir öneri.

**Bedeli.** Eski veride seyrek (WildFeedback'te 13 sohbet); gerçek kullanımda ne sıklıkta çıkacağı sayaçla izleniyor.

## K43. Yönsüz devam istekleri tek niyet sayılır

**Bağlam.** "devam", "devam et", "tamam devam", "kaldığın yerden devam", "continue" farklı yazıldığı için kısa tekrar serisi bunları ayrı mesajlar sayıyordu. WildFeedback'te devam ailesi 579 farklı biçimde yazılmış; ardışık devam çiftlerinin %16'sı farklı biçimde.

**Karar.** Yönsüz devam istekleri tek bir niyet sayılır (`extension/src/core/intents.ts`, Python `is_bare_continue`). Kısa tekrar serisi bu niyete göre sayılır; bu mesajlar benzerlik karşılaştırmasına girmez. Yönlü devam ("devam et ama tablo olarak") bu sınıfa girmez ve öneri almaz.

**Neden.** Kullanıcı aynı şeyi farklı yazınca da aynı niyeti taşıyor.

**Bedeli.** Türkçe etkisi yeniden oynatmada görünmüyor (İngilizce veride biçim çeşitliliği az); elle doğrulamada görüldü.

## K44. Düzeltme alınmadı: onarımdan sonra cevap öncekinin neredeyse aynısıysa halka koyulaşır, kart açılabilir

**Bağlam.** Cevabın başı (600 karakter) bir öncekine 0,85 ve üstü benzediğinde sonraki turda memnuniyetsizlik %10 ile %14 (taban %5). Bunu genel olarak halkaya ya da karta eklemek isabeti düşürdü. Dar biçimi ise güçlü: kullanıcı onarım ifadesi kullandı ve cevap öncekinin neredeyse aynısı; sonraki turda memnuniyetsizlik %28,6 ve %29,4 (iki ayrık örneklem).

**Karar.** Yalnızca dar biçim kullanılır. Halka 2'ye çıkar: "Düzeltme istedin ama son cevap öncekinin neredeyse aynısı; model düzeltmeyi almamış olabilir." Kart "Düzeltme alınmadı" gerekçesiyle açılabilir (öncelik: model, özür, düzeltme alınmadı, uzun sohbet).

**Neden.** Rapor örnekleminde kart 18,47'den 19,18'e, isabet %30,35'ten %31,0'a, yakalama %28,75'ten %32,3'e çıktı; yeni kaynağın isabeti %51,4. Seçim örnekleminde de aynı yön.

**Bedeli.** Cevap metninin başı yalnızca bellekte, yalnızca bir önceki cevapla karşılaştırmak için okunuyor.

## K45. Davranışsal çıkış: döngü sinyalinden sonra iki temiz tur gelince sinyaller sakinleşir

**Bağlam.** Döngü sinyalleri yalnızca kullanıcı teşekkür edince ya da konu değişince sıfırlanıyordu; teşekkür etmeden toparlanan kullanıcıda halka koyu kalıyordu.

**Karar.** Döngü sinyali varken iki temiz tur gelirse sinyaller sakinleşir. Temiz tur: kullanıcının mesajında onarım ifadesi, tekrar ya da belirsiz istek yok; cevapta özür ya da düzeltme alınmadı yok.

**Neden.** Rapor örnekleminde halka 1 ve üstü turlar %22,36'dan %21,40'a indi, halka 2 isabeti %29,63'ten %29,87'ye çıktı; kart değişmedi. İlk sürümde belirsiz istekler de temiz tur sayılıyordu; senaryo testi yakaladı.

**Bedeli.** İki turluk eşik veriyle değil, sadelikle seçildi.

## K46. Döngünün nasıl bittiği yalnızca sayı olarak ölçülür

**Bağlam.** WildFeedback'te döngü dönemlerinin %62'si kullanıcının sohbeti bırakmasıyla, %38'i aynı sohbette toparlanarak bitiyor. Ürünün etkisini anlamak için gerçek kullanımda da bunun sayılması gerekiyordu.

**Karar.** Döngü görülen sohbet bittiğinde sayaç: `loop_end` toparlandi, birakildi (döngü sürerken çıkıldı) ya da yeni_sohbet (Taze başlat kullanıldı). Döngü sırasında şikayet bir öncekinin yarısından kısaysa `signal mesaj_kisaldi`; davranışla sakinleşince `signal toparlandi`. Metin saklanmaz.

**Neden.** Yeniden oynatmada sohbetlerin %23,8'inde döngü görülüyor ve bunların %51,4'ü döngü sürerken bitiyor. Doğrulama: "bırakıldı" sayılan sohbetlerin son iki turunda memnuniyetsizlik %32,9, "toparlandı" sayılanlarda %17,1.

**Bedeli.** Kullanıcı sekmeyi kapatmadan başka sohbete geçerse "bırakıldı" ile "ara verdi" ayrılamaz.

## K47. Ters yönlü düzeltme ve kuralın yeniden yazılması ölçüldü; tetikleyici olarak eklenmedi

**Bağlam.** İki örüntünün memnuniyetsizlikle ilişkili olduğu düşünülüyordu: ters yönlü düzeltmeler ("kısalt", sonra "uzat", sonra yine "kısalt") ve kullanıcının daha önce koyduğu bir kuralı yeniden yazması ("söylemiştim, tablo kullanma").

**Karar.** Önce yalnızca seçim örnekleminde ölçüldü (`scripts/evaluate_stage3.py`, sözlük `src/kafiai/correction_patterns.py`, İngilizce ve Türkçe). Sonuçlar:

| Örüntü | Görüldüğü sohbet | O tur ya da sonrakinde memnuniyetsizlik | Mevcut bir sinyal zaten var |
|---|---|---|---|
| Ters yönlü düzeltme | %0,22 | %13,1 | %13 |
| Geri dönüş isteği ("eski haline getir") | %0,21 | %12,0 | %42 |
| Kuralın yeniden hatırlatılması, güçlü işaret ("söylemiştim", "I told you") | %0,39 | %42,5 | %79 |
| Kısıt cümlesinin benzer biçimde yeniden yazılması | %5,44 | %11,2 | %44 |

Hiçbiri yeni bir tetikleyici olarak eklenmedi. Aday kurallar (olay halkayı yükseltir ya da kart açar) yeniden oynatmada net bir iyileşme vermedi; kısıt cümlesi adayı halka 2 isabetini %28,67'den %25,54'e düşürdü. Elle kontrolde ters yön olaylarının çoğu gidip gelme değil, özgeçmiş maddelerini tek tek işlemek gibi iş akışlarıydı; kısıt cümlelerinin çoğu her soruya eklenen şablon talimattı. Türkçe WildChat'te sözlük öğeleri geçiyor ama olay sayısı çok küçük.

Rapor örnekleminde (`outputs/stage3_rapor.json`) aynı yön görüldü: güçlü işaret sohbetlerin %0,45'inde, memnuniyetsizlik %34,7, olayların %78'inde mevcut bir sinyal var; kısıt cümlesi adayı halka 2 isabetini %29,87'den %26,42'ye, kart isabetini %31,03'ten %26,09'a düşürüyor.

**Neden.** Kuralı yeniden hatırlatan kullanıcının memnuniyetsizliği yüksek, ama Kâfi AI'nın mevcut sinyalleri bu anların çoğunu zaten görüyor. Yeni bir uyarı eklemek isabeti düşürüyor.

**Bedeli.** Bu örüntüler sayılmıyor; yalnızca K48'deki biçimde kullanılıyor.

## K48. Yeniden hatırlatılan kural kartta not olarak söylenir ve Taze başlat taslağının başına girer

**Bağlam.** K47'ye göre kuralı yeniden hatırlatmak bir tetikleyici olarak işe yaramıyor, ama bu anlar memnuniyetsizliğin yüksek olduğu anlar. Yeni sohbet tek başına döngüyü çözmüyor (WildChat'te döngülü sohbetten sonra açılan yeni sohbetin %42'si yine döngülü); kuralın yeni sohbette baştan verilmesi gerekiyor.

**Karar.** Güçlü işaretler (elle kontrolde yanlış çıkan biçimler ayıklandı) `signal-rules.json` "restate" altında; algılama `signals.ts restatesRule` ve Python `restates_rule`. Sinyal yalnızca hatırlatılan mesajların sırasını tutar, metin tutmaz; ilk mesajda sayılmaz, konu değişince sıfırlanır. Tetikleyici değildir: halka ve kart kararlarını değiştirmez. Kart başka bir nedenle açıldığında bir not ekler: "Bu sohbette bir kuralı yeniden hatırlatman gerekti. Taze başlat taslağı bu kuralı en başa koyar; yeni sohbette baştan geçerli olur." Taze başlat taslağının başına "Bu sohbette baştan uymanı istediğim kurallar" bölümü girer (en fazla üç, en yenileri, benzerleri tekilleşir). Sayaç: `signal kural_hatirlatildi`.

**Neden.** Kullanıcının zaten yaşadığı bir sorunu, var olan çıkış yoluna (Taze başlat) somut bir iyileştirme olarak bağlıyor; yeni bir uyarı eklemiyor.

**Bedeli.** Taslağa giren kural cümlesi kullanıcının kendi mesajı ("söylemiştim, emoji kullanma"); kullanıcı yapıştırmadan önce düzenleyebilir. Notun yararı yeniden oynatmada ölçülemez. Ölçülebilen: rapor örnekleminde kartların %1,25'inde not çıkıyor ve bu kartların isabeti %39,6 (tüm kartlarda %31,0); not, memnuniyetsizliğin yüksek olduğu anlarda çıkıyor.

## K49. "Yön sende" önerisine yönü doğrudan veren ikinci düğme; eşik 3 kalır

**Bağlam.** K42'deki öneri "bir sonraki adımı sen seç" diyor ama tek düğmesi modelden özet istiyordu; yönü kullanıcıya veren kısa bir yol yoktu. Eşiğin düşürülüp düşürülmeyeceği de soruldu. WildFeedback'te cevapların yalnızca %3,29'u soruyla bitiyor; üç onaylık seri sohbetlerin %0,015'inde görülüyor ve seriden sonraki turlarda memnuniyetsizlik tabanın altında (%0 ile %4,2, taban %4,86). WildChat'in Türkçe sohbetlerinde yalın onay neredeyse hiç yok. Bu veriler o dönemin modellerinden; güncel asistanlar cevaplarını çok daha sık bir teklifle bitiriyor.

**Karar.** Eşik 3 kalır. Öneriye ikinci bir düğme eklenir: "Adımı ben yazayım", mesaj kutusuna "Teklif sorma, bir sonraki adımı ben belirliyorum: " başlangıcını koyar; kullanıcı tamamlayıp kendisi gönderir (K41'deki kalıpla aynı). Metin: "İstersen devam etmeden önce modelin şu ana kadar ne anladığını özetlemesini iste ya da bir sonraki adımı kendin yaz." Sayaç: `hint adim_yaz`.

**Neden.** Öneri bir döngü uyarısı değil; değeri yönü kullanıcıya vermek. Eşiği düşürmek, yararlı ilerleyen sohbetlerde gereksiz öneri demek ve veriyle desteklenmiyor. İkinci düğme önerinin söylediğini yapmanın en kısa yolu.

**Bedeli.** Etkisi yeniden oynatmada ölçülemez; hangi düğmenin seçildiği sayaçla izlenir.

## K50. Kapsam sadeleştirmesi: yapılmayan işler ürün ve belgelerden çıkarılır

**Bağlam.** Proje boyunca bazı işler "ikinci dalga" ya da "yapılacak" diye not edilmişti ama yapılmadı. Teslime doğru ekip, yeni karmaşıklık eklemek yerine var olan özelliklerin kullanıcı için daha iyi çalışmasına odaklanmaya karar verdi.

**Karar.** Şunlar kapsam dışı ve belgelerde plan olarak yer almaz:

| İş | Neden çıkarıldı |
|---|---|
| Hassasiyet ayarı | Eşikler veriyle seçildi; kullanıcıya eşik seçtirmek yeni bir ayar, açıklama ve test yükü getiriyor |
| Tur modelini 10. tura uzatmak ve WildFeedback etiketiyle yeniden eğitmek (tur modeli 2) | Model değişirse bütün değerlendirme ve belgeler yeniden üretilmeli; teslime az kala risk. Sonraki çalışma olarak kalır |
| ChatGPT'de yeni davranış sinyalleri (durdur düğmesinin tekrarı, menüdeki yeniden üretme, cevap sürümü göstergesi) | Bu olaylar eğitim ve değerlendirme verisinde yok; modele ya da karar zincirine katkısı ölçülemez |
| Öğrenme sorusu, gece sınırı, kurulumda kullanım amacı tercihi, kademeli destek yolu ve YEDAM bağlantısı | İlk ürün kapsamındaki ikinci dalga işleri; yapılmadı ve ölçülemiyor |
| Pilot çalışma | K28 ile çevrimdışı değerlendirmeye geçildi |

Planda kalan tek dağıtım adımı Chrome Web Store yayını (Bölüm 10).

**Neden.** Belgeler yalnızca gerçekten yapılmış ve ölçülmüş şeyleri anlatır; okuyucu hangi özelliğin var olduğunu tek bakışta görür.

**Bedeli.** Bazı özgün fikirler (öğrenme sorusu, destek yolu) bu dönemde ürüne girmedi. Bunlar Bölüm 4'te özgün önerinin parçası olarak anılır.

## K51. İzinle çalışan anlam desteği: K11 istisnası, sunucu ve değerlendirici

**Bağlam.** Karakter 3-gram benzerliği aynı isteğin başka sözcüklerle, başka dilde ya da araya başka sorular girdikten sonra sorulmasını göremiyor; uzun bir düzeltme mesajının gerçekten şikayet olup olmadığını da kelime listesi tek başına ayıramıyor. Açık provada (prova/) cihazda çalışan çok dilli bir anlam modeli (MiniLM) de denendi: dil değişimindeki tekrarı buluyor ama aynı konudaki farklı soruya gerçek tekrardan yüksek puan veriyor ve ilk kez söylenen koşulu hatırlatılan koşuldan ayıramıyor. Bu ayrımlar önceki cevabı okumayı gerektiriyor.

**Karar.**
1. Varsayılanı kapalı bir "Anlam desteği" anahtarı eklenir. Açıkken, bir cevap bittiğinde sohbetin son en fazla 16 turu (kullanıcı mesajı en fazla 1.000 karakter, cevabın ilk 600 ve son 200 karakteri) arka plan çalışanı üzerinden Kâfi sunucusuna gider. Kişisel sohbetlerde hiç gönderilmez. Bu, K11'in tek ve izinli istisnasıdır.
2. Sunucu (`server/api/judge.ts`, Vercel) metni Claude'a sorar ve yapılandırılmış bir karar döner: aynı istek mi, önceki cevap karşıladı mı, tıkanma, özür döngüsü, aynı bilgiye dönüş, son cevap yeni bilgi verdi mi, döngü ve güven. İstem, şema ve model tek dosyada: `server/judge-spec.json`. Metin diske ya da günlüğe yazılmaz; API anahtarı yalnızca sunucuda durur.
3. Eklentide ağ isteği yalnızca `background/judge-client.ts` içinde, çerezsiz yapılır. Depodaki ayarda adres boştur; adres boşken hiçbir istek gönderilmez ve manifestte `connect-src 'none'` kalır. Ağ testi (`no-network.test.ts`) arka planda tam bir `fetch` dışında hiçbir ağ API'sine izin vermez.
4. Değerlendiricinin kararı ürüne üç yoldan girer: aynı istek kartı (ikinci soruşta "Bunu az önce de sormuştun"), 3-gram'ın kaçırdığı yeniden yazımın benzer mesaj sayılması ve kart kuralı (K52).
5. Model seçimi Türkçe davranış setinde yapıldı (129 uydurma vaka, ayar ve test yarıları). Test yarısında Sonnet 5.5 kart kararında 60/62, Haiku 5.5 59/62 doğru; ilerleyen ve kişisel sohbetlerde yersiz kart ikisinde de 0/27. Sonnet seçildi; ret durumunda sunucu tarafı yedek model açık.

**Neden.** Anlam düzeyindeki ayrımlar kullanıcıya en çok yarayacak yerde (aynı isteği farklı biçimde sormak, uzun düzeltmeler) kelime kurallarının kör noktası. İzinli ve dar kapsamlı bir istisna, gizlilik sözünü varsayılan kullanıcı için değiştirmeden bu boşluğu kapatıyor.

**Bedeli.** Özellik açıkken metin üçüncü bir tarafa (Anthropic) gider; bu `docs/PRIVACY.md` ve pencere metinlerinde açıkça söylenir. Sunucu maliyeti ve kötüye kullanım riski doğar; oran sınırı ve boyut sınırı var, kalıcı oran sınırı Vercel tarafında kurulmalı. Davranış seti küçük ve kuralları yazanlarca hazırlandı; genel doğruluk değildir.

## K52. Son tur ölçümü: orta uzunlukta onarım şeridi, anlam onarımı kartı ve model kartı onayı

**Bağlam.** Son turda hedef, yersiz müdahaleyi artırmadan isabeti ve yakalamayı yükseltmekti. Ölçüt olarak "isabetsiz kart" (100 sohbette, memnuniyetsizliğe denk gelmeyen kart) eklendi. Adaylar WildFeedback'in seçim örnekleminde (tohum 7, 20.000 sohbet) seçildi, rapor örnekleminde (tohum 42) doğrulandı. Değerlendirici adayları önbellekteki kararlarla (istem v0.3, Haiku 5.5; her örneklemde ilk 2.000 sohbet, istenen turların yaklaşık üçte ikisi) API çağrısı yapmadan oynatıldı. Bu kararlar sırasında ayrıca bir kural zorlama denemesi (37 sentetik sohbet) yapıldı.

**Karar.**
1. **Orta uzunlukta onarım şeridi.** Kısa onarım şeridinin sınırı 12'den 20 karaktere çıkar (`signal-rules.json` `short.repair_max_chars`); karşılaştırma için kullanılan genel kısa mesaj sınırı 12 kalır. "olmadi tekrar yap", "still not working" gibi mesajlar artık şerit alır. Seçim örnekleminde 12, 20, 25, 30, 40 denendi; 25 ve üstünde isabet düştü. Sınır genişleyince soruyla biten bir cevaba verilen üç kelimelik ret ("hayır gerek yok") şerit almaya başladı; bu yüzden teklif reddinin kelime sınırı 2'den 3'e çıktı (`decline_max_words`). Tablo bu düzeltmeyle birlikte resmi yeniden oynatmadan (`outputs/replay_eval.json`).

   | Rapor örneklemi (20.000) | Önce | Sonra |
   |---|---|---|
   | Kısa onarım şeridi, 100 sohbette | 0,81 | 1,88 |
   | Kısa onarım şeridi isabeti | %58,3 | %58,4 |
   | Kart isabeti / yakalama | %31,1 / %32,3 | %30,8 / %31,9 |
   | İsabetsiz kart, 100 sohbette | 13,19 | 13,20 |

2. **Anlam onarımı kartı.** Kullanıcının mesajı onarım kelimesi taşıyor ama şeride girmeyecek kadar uzunsa ve değerlendirici "önceki cevap karşılamadı" derse kart açılır ve mesaj tekrar denemesi sayılır. Önbellekteki kararlarda onarım kelimeli uzun mesajlarda (40 karakter üstü) kelimenin tek başına isabeti %25 ile %27, değerlendiricinin "karşılamadı" dediği turlarda %45 ile %58; bu turlardaki memnuniyetsizliğin %60 ile %79'u yakalanıyor.
3. **Model kartı onayı.** Değerlendirici açıkken yalnızca tur modelinden gelen kart onay bekler; onay için döngü, tıkanma ya da "karşılamadı" belirtilerinden biri yeterli (`confirm_sources`, `confirm_rule`). Özür, düzeltme alınmadı ve uzun sohbet kartları beklemez.
4. **Değerlendiricinin kendi döngü kartı kapalı** (`loop_card: false`). WildFeedback'te bu kartın isabeti 0,85 güven eşiğinde %19 ile %28; tıkanma kanıtıyla 0,6 eşiğinde %17 ve isabetsiz kartı ikiye katlıyor.

   | Rapor örneklemi (2.000, anlam desteği açık, iki tarafta da 20 karakter sınırı) | Bugünkü hibrit | Yeni kural |
   |---|---|---|
   | Kart, 100 sohbette | 17,05 | 17,20 |
   | Kart isabeti | %31,4 | %35,8 |
   | Yakalama | %24,4 | %31,1 |
   | İsabetsiz kart, 100 sohbette | 11,7 | 11,05 |

   Seçim örnekleminde de aynı yönde: isabet %29,1 → %31,1, yakalama %18,5 → %22,3, isabetsiz kart 10,95 → 10,95.

**Denenip alınmayanlar.**
1. İlk hata raporunda model kartını kapatan kapı (önceki turlarda benzer mesaj, onarım ya da özür yoksa model kartı yok): rapor örnekleminde isabetsiz kart 13,2 → 11,5 ama yakalama %32,3 → %25,7. Yakalama kaybı büyük olduğu için alınmadı; anlam desteği açıkken model kartı onayı aynı yanlış alarmı daha az kayıpla eliyor.
2. Değerlendiricinin aynı istek kuralında "son cevap yeni bilgi verdiyse karşılanmamış kart açma": davranış setinin ayar yarısında 66/67 → 63/67; alınmadı.
3. Kural hatırlatma listesine yalın "dedim": Türkçe veride (1.921 tur) hiç geçmiyor, ölçülemedi; alınmadı.

**Neden.** Üç değişiklik birlikte, değerlendirici açıkken bugünkü hibritten daha az isabetsiz kartla 6,7 puan daha fazla memnuniyetsizliği yakalıyor; değerlendirici kapalıyken kısa onarım şeridi aynı isabetle iki kattan fazla yardım ediyor.

**Bedeli.** Türkçe davranış setinde döngü vakalarının çoğu artık döngü kartı yerine "aynı istek, karşılanmamış" kartını alıyor: kart türüne göre doğru karar ayar yarısında 66/67 → 59/67, test yarısında 60/62 → 56/62; kart var ya da yok ayrımında yalnızca bir döngü vakası kartsız kalıyor ve yersiz kart değişmiyor. WildFeedback ölçümü eski istem ve Haiku ile; üründeki Sonnet ve v0.7 istemle yeniden oynatma yapılınca döngü kartı anahtarı yeniden değerlendirilmeli. Rapor örneklemindeki 2.000 sohbette tekrarlayan memnuniyetsizlik yaşanan sohbet sayısı 135; yakalama farkları birkaç sohbete dayanıyor.

## K53. Eşik taraması: kart bekleme süresi 5 turdan 3 tura iner; diğer eşikler kalır

**Bağlam.** Kartın daha hassas olması istendi: daha çok kart, ama yersiz kartın orantısız artmaması. Kartı belirleyen eşikler tek tek tarandı (`scripts/evaluate_thresholds.py`; seçim örnekleminde 12 aday, rapor örnekleminde en iyi üçü). Ölçüt olarak ortalama isabetin yanında "eklenen kartların isabeti" kullanıldı: eşik değişince gelen yeni kartların yüzde kaçı memnuniyetsizliğe denk geliyor (taban %5).

**Sonuçlar (rapor örneklemi, 20.000 sohbet).**

| Aday | Kart, 100 sohbette | İsabet | Yakalama | İsabetsiz kart | Eklenen kartların isabeti |
|---|---|---|---|---|---|
| Önceki (bekleme 5, model eşiği 0,30) | 19,06 | %30,8 | %31,9 | 13,2 | |
| **Bekleme 3** | 23,77 | %30,2 | %31,9 | 16,6 | %28 |
| Model eşiği 0,25 | 21,96 | %28,0 | %35,6 | 15,8 | %10 |
| İkisi birden | 27,55 | %27,5 | %35,6 | 20,0 | %20 |

Seçim örnekleminde ayrıca: model eşiği 0,20 (kart 26,6, isabet %25,6, yakalama %41,9), 0,35 (17,5, %32,5, %29,4), kanıt şartını kaldırmak (eklenen kartların isabeti %3, tabanın altında), benzerlik eşiği 0,75 ya da 0,70 ve öneri eşiği 0,14 (etkisiz). Sayılar `outputs/thresholds_secim.json` ve `outputs/thresholds_rapor.json`.

**Karar.** Kart kapandıktan ya da yok sayıldıktan sonraki bekleme süresi 5 turdan 3 tura iner (`EXIT_CARD_COOLDOWN_TURNS`, Python `EXT_EXIT_CARD_COOLDOWN_TURNS`). Tur modelinin 0,30 eşiği, kanıt şartı, benzerlik eşiği ve öneri eşiği değişmez.

**Neden.** Bekleme süresini kısaltmak döngü süren sohbette kartın daha erken yeniden gelmesini sağlıyor; eklenen kartlar ortalama kart kadar isabetli. Model eşiğini düşürmek daha çok farklı döngü yakalıyor ama eklenen kartların isabeti tabanın yalnızca iki katı.

**Bedeli.** İsabetsiz kart 100 sohbette 13,2'den 16,6'ya çıkıyor ve aynı sohbette kart daha sık görünüyor; kullanıcı "Bir daha gösterme" ile kapatabilir. Yakalama değişmiyor: ilk kartın zamanı aynı kalıyor, yalnızca sonraki kartlar erkene geliyor. Aynı istek kartının kendi bekleme süresi (`repeat_cooldown_turns`, 2) değişmedi.

