# Sentetik bağlam etiketleme protokolü (sürüm 0.3)

> **0.3 düzeltmeleri:**
> - §0: "Önceki istek" artık o cevap verilirken geçerli olan birikmiş istektir.
> - §1: Yeniden sorma, takip sorusu ayrımı ve tek başına yeni koşul ya da kapsam genişletme açıklandı.
> - §2 ve §3: `ayni_istek` ile `istek_degisimi` arasında tutarlılık kuralı eklendi. Revizyon ile koşul ayrımı ve mesaj dili tanımı netleşti.
> - §4: Yinelemenin sınırı, koşulu anan ihlal bildirimi ve isteğin özünün örtük koşul sayılması eklendi.
> - §5: Cevaplamama ile olgusal tartışma ayrımı, tartışmasız içerik bilgisi, mesaj dili, çalıştırma kuralının daraltılması ve `gerekli_girdi_eksik` tanımı eklendi.
> - §6: Tekrar ihlal sayımı, tek cevaplı durum, öncelik sırası ve itiraz sözcükleri netleşti. Tıkanma türetme tablosu güncellendi.
> - Kör kontrol sonrası netleştirmeler: §4'te kapsamın anlamı ve yeniden deneme isteği; §1'de onay sözcüğü; §3'te eşit ağırlıklı karışık dil; §5'te hata çıktısı olmayan başarısızlık bildirimi; §6'da ölçümle çürüyen itiraz ve tek cevaplı konuşmada "yine".
>
> 0.2.1 düzeltmeleri geçerlidir: revizyon ile yeni koşul aynı mesajda birlikte bulunabilir; koşulun yeni olması parçaya ya da bütüne uygulanmasına bağlı değildir; `istek_degisimi` bir ya da iki değer alır.

Bu belge paylaşılabilir. Kapalı vaka metinlerini, referans kararları ya da inceleme çıktılarını içermez. Aşağıdaki örneklerin hepsi kurala özel, uydurma mini örneklerdir; prova ya da kıyas vakalarından alınmamıştır.

Örneklerde **K** kullanıcı, **A** asistan mesajıdır.

## 0. Kapsam

Her vakada **son kullanıcı mesajı (YENİ)** değerlendirilir.

- **Önceki cevap:** YENİ mesajdan hemen önceki asistan cevabı.
- **Önceki istek:** O cevap verilirken geçerli olan **birikmiş istektir**: ilk istek ile ondan sonra gelen revizyonlar ve koşullar birlikte. İlk istekteki açık koşullar, kullanıcı açıkça geri almadıkça sonraki revizyonlardan sonra da sürer.
  - Örnek: K: "Kedi üzerine dört satırlık bir şiir yaz, 'ay' kelimesi geçmesin." A: şiir. K: "Son satırı daha neşeli yap." A: yeni şiir. Bu son cevap için önceki istek şudur: kedi şiiri, dört satır, 'ay' geçmesin, son satır neşeli. Son cevapta 'ay' geçiyorsa ilk istekteki koşul ihlal edilmiştir.
- **Daha eski bir isteğin tekrarı:** YENİ mesaj, hemen önceki cevaptan daha eski bir isteği tekrar ediyorsa bütün alanlar yine **hemen önceki cevaba ve onun isteğine** göre doldurulur. Eski istekle eşleşme bu protokolün alanı değildir; ayrı bir ölçümde değerlendirilir.
  - Örnek: K: "Su kaç derecede kaynar?" A: cevap. K: "Buz kaç derecede erir?" A: cevap. K: "Suyun kaynama noktası nedir?" Alanlar buz sorusuna göre doldurulur: `ayni_istek` = `hayir`, `istek_degisimi` = `farkli_soru`.

Yardım gösterilip gösterilmeyeceği ya da uyarı verilip verilmeyeceği bu protokolün konusu değildir.

Aşağıdaki kararlar **birbirinden ayrıdır**; biri ötekinden çıkarılmaz (§2 ve §3 arasındaki tutarlılık kuralı dışında):

| Karar | Soru |
|---|---|
| `ayni_is` | Aynı çıktı üzerinde mi çalışılıyor? |
| `ayni_istek` | Aynı şey yeniden mi isteniyor? |
| `istek_degisimi` | İstekte ne değişti? |
| `onceki_kosulla_iliski` | YENİ mesaj önceki bir koşulla nasıl ilişkili? |
| `onceki_cevap_karsiladi` | Önceki cevap, verildiği anda geçerli isteği karşıladı mı? |
| `gerekli_girdi_eksik` | Karar için gereken bir girdi konuşmada eksik mi? |
| `durum` | İlk ihlal mi, doğrulanmış tekrar mı, ilerleyen revizyon mu, yoksa belirsiz mi? |
| `tikanma` | Doğrulanmış bir tıkanma var mı? |

## 1. Aynı iş (`ayni_is`: evet / hayir / belirsiz)

Aynı iş, **aynı çıktının** (metin, kod, tarif, cevap) üretilmeye ya da düzeltilmeye devam etmesidir.

- **Dahil:**
  - Önceki çıktıya itiraz ("Olmadı.", "Hala hata veriyor.")
  - Önceki çıktıyı onaylayıp üzerinde değişiklik istemek
  - Mevcut çıktının yeni bir koşula göre değişmesini istemek (`[revizyon, yeni_kosul]`)
  - Aynı isteğin, hangi dilde olursa olsun, yeniden sorulması. Örnek: K: "Su kaç derecede kaynar?" A: cevap. K: "At what temperature does water boil?" → `evet`.
  - Cevabı önceki çıktının yerine geçen ya da onu genişleten takip sorusu. Örnek: bir kavram açıklandıktan sonra "Bunu biraz aç." → `evet`.
- **Hariç:**
  - Konusu önceki çıktı ya da kaynak olan ama **ayrı bir cevap** isteyen soru. Örnek: bir paragraf özetlendikten sonra "Bu paragraftaki 'enflasyon' ne demek?" → `hayir`. Bir tarif verildikten sonra "Bu tarif kaç kalori?" → `hayir`.
  - Tek başına `yeni_kosul` ya da `kapsam_genisletme`: mevcut çıktı değişmiyor, yalnızca ileriki çıktılar etkileniyor. Örnek: bir çeviri verildikten sonra "Bundan sonraki çevirilerde resmi dil kullan." → `hayir`.
- **belirsiz:** Atıf yapılan önceki çıktı görünmüyorsa.
- Onay sözcüğü ("Tamam.", "Güzel.") tek başına mevcut çıktıyı değiştirmez. Onaydan sonra gelen istek kendi değerine göre sınıflanır: "Güzel. İleride yazacakların da kısa olsun." tek başına kapsam genişletmedir → `hayir`.

## 2. Aynı istek (`ayni_istek`: evet / hayir / belirsiz)

YENİ mesaj, önceki isteğin aynısını mı istiyor? Başka dilde, aynı dilde başka kelimelerle ya da bir koşul yinelenerek yazılmış olabilir.

Revizyon, yeni koşul, kapsam genişletme ve farklı soru aynı istek **değildir**.

**Tutarlılık kuralı (§3 ile):**

| `istek_degisimi` | `ayni_istek` |
|---|---|
| `yok` ya da `mesaj_dili` | `evet` |
| `belirsiz` | `belirsiz` |
| Diğer bütün değerler | `hayir` |

Dayanaksız itiraz: K: "Bir haftalık spor planı yaz." A: plan. K: "Olmadı." Burada `ayni_is` = `evet` olabilir (önceki çıktıya itiraz), ama mesaj neyin istendiğini göstermediği için `ayni_istek` = `belirsiz` ve `istek_degisimi` = `belirsiz` olur.

## 3. İstekteki değişiklik (`istek_degisimi`: bir ya da iki değer)

İki ayrı soru sorulur:
- **(a) Revizyon:** Kullanıcı mevcut çıktının (bir parçasının ya da tamamının) değiştirilmesini ya da ona ekleme yapılmasını istiyor mu?
- **(b) Yeni koşul:** Kullanıcı, daha önce söylenmemiş ve çıktının uyması gereken açık bir koşul getiriyor mu? Koşul türleri: içermeli/içermemeli, sınır, dil, diyet, biçim. Koşul bir parçaya da bütüne de uygulanabilir.

**Revizyon ile koşulun ayrımı:**
- Somut bir öğeyi **ekleme, çıkarma ya da değiştirme** eylemi yalnız revizyondur. Örnekler: "İmza satırı ekle.", "İkinci maddeyi sil.", "Saati 15.00 yap."
- **Koşul**, sonraki sürümlerin de koruması gereken ve evet/hayır ile denetlenebilen bir özelliktir. Genellikle "olsun / olmasın / en fazla / geçsin" gibi söylenir. Örnekler: "Hiç sayı olmasın.", "En fazla 4 satır olsun.", "Başlıkta 'yaz' geçsin."
- Sınama: "Bundan sonraki her sürümde buna uyulmuş mu?" diye sorulabiliyorsa koşul vardır. "İmza satırı ekle" için bu soru anlamsızdır; eylem bir kez yapılır.

**Mesaj dili:** Mesajın baskın dilidir. Araya birkaç yabancı kelime girmesi baskın dili değiştirmez. Baskın dil değişmediyse `mesaj_dili` verilmez. Örnek: K: "Dünya'dan Ay'a uzaklık ne kadar?" A: cevap. K: "Dünya'dan Ay'a distance ne kadar?" Baskın dil Türkçe kaldı; değer `mesaj_dili` değil, `yok` olur. İki dil aşağı yukarı eşit ağırlıktaysa baskın dil değişmemiş sayılır.

İki soru da evetse değer `[revizyon, yeni_kosul]` olur. Diğer değerler tek başına kullanılır.

| Değer | Tanım | Dahil | Hariç |
|---|---|---|---|
| `yok` | İstek değişmedi (aynen, başka kelimelerle ya da bir koşul yinelenerek yeniden isteniyor) | "Madde madde istemiştim." | |
| `mesaj_dili` | Yalnızca mesajın baskın dili değişti | Türkçe sorulan sorunun İngilizce yeniden sorulması | Kullanıcı yanıt dilini açıkça istiyorsa → `[revizyon, yeni_kosul]` |
| `revizyon` (yalnız) | Mevcut çıktıda somut bir ekleme, çıkarma ya da değişiklik; yeni bir koşul yok | "Tabloya bir sütun ekle.", "Girişi biraz kısalt." | Değişiklik bir koşul da getiriyorsa → `[revizyon, yeni_kosul]` |
| `[revizyon, yeni_kosul]` | Mevcut çıktı değişsin **ve** yeni bir koşula uysun | "Son satırda 'deniz' geçsin." (parça), "Vegan olsun." (tarifin tamamı), "Bunu Almanca yanıtla." (cevabın tamamı) | |
| `yeni_kosul` (yalnız) | Mevcut çıktı değişmesin; yeni koşul yalnızca ileriki çıktılar için | "Bundan sonraki tariflerin vegan olsun." (koşul daha önce hiç söylenmemiş) | Daha önce söylenmiş koşulun ileriye yayılması → `kapsam_genisletme` |
| `kapsam_genisletme` | Daha önce söylenmiş bir koşulun ileriki cevaplara da uygulanması | "Bundan sonraki cevaplarda da 3 maddeyi geçme." | Koşulun yalnızca yinelenmesi ("3 madde demiştim.") → `yok` |
| `farkli_soru` | Yeni bir çıktı isteyen farklı soru | "Bu cümledeki 'enflasyon' ne demek?" | |
| `belirsiz` | Mesaj neyin istendiğini göstermiyor | "Olmadı." (dayanaksız) | |

## 4. Önceki koşulla ilişki (`onceki_kosulla_iliski`)

Bu alan istekteki değişiklikten ayrıdır. Koşulun karşılanıp karşılanmadığı burada **yazılmaz**; o, `onceki_cevap_karsiladi` alanının işidir.

**Yinelemenin sınırı:**
- Aynı koşulun başka dilde ya da başka kelimelerle söylenmesi, **sayı, birim ve kapsam değişmediği sürece** yinelemedir. Aynı değerin başka birimle söylenmesi değeri değiştirmez: "1 saati geçmesin" ile "60 dakikayı aşmasın" aynı değerdir.
- Değer ya da kapsam değişirse yineleme değildir: "en fazla 3 öneri" ile "en fazla 5 öneri" farklı koşullardır. Değeri değiştiren mesaj yeni bir koşul getirir (`ilk_kez`).
- Buradaki **kapsam**, koşulun çıktının hangi parçasına uygulandığıdır ("ilk paragraf" yerine "bütün metin"). Aynı koşulun ileriki cevaplara da uygulanması (`kapsam_genisletme`) koşulun değerini ya da kapsamını değiştirmez; ilişki `yineleme` olur.
- İçeriği yinelemeden **yeniden deneme isteği** ("Bir daha yap.", "Do it once more.") aynı istektir (`ayni_istek` = `evet`, `istek_degisimi` = `yok`), ama ne bir koşul ne de isteğin özü anıldığı için ilişki `yok` olur.
- Koşulun değeri ya da içeriği anılarak yapılan **ihlal bildirimi** yinelemedir. Örnekler: önceden "en fazla 3 öneri" istenmişse "Hala 3'ten fazla öneri var."; önceden "vegan olsun" denmişse "İçinde bal var."
- Koşul anılmadan yapılan itiraz ("Yine olmadı.") yineleme değildir.
- **İsteğin özü örtük bir koşuldur:** sorulan şeye cevap verilmesi gerekir. Aynı isteğin yeniden sorulması bu örtük koşulun yinelemesi sayılır. Örnek: K: "Ekvator'un uzunluğu ne kadar?" A: cevap. K: "Ekvator kaç kilometre?" → `yineleme`.

| Değer | Tanım | Dahil | Hariç |
|---|---|---|---|
| `yineleme` | YENİ mesaj daha önce söylenmiş açık bir koşulu (ya da isteğin özünü) aynı değerle yineliyor; tek başına, ihlal bildirimi olarak ya da isteğin tekrarı içinde olabilir | "3 madde demiştim.", "Bundan sonrakiler de 3 maddeyi geçmesin.", "Hala 3'ten fazla." | İlk kez söylenen koşul; değeri değişen koşul |
| `ilk_kez` | YENİ mesaj ilk kez bir koşul getiriyor ya da önceki bir koşulun değerini değiştiriyor; koşul parçaya ya da bütüne uygulanabilir | "Vegan olsun.", "Son satırda 'deniz' geçsin.", önceden 3 iken "En fazla 5 olsun." | Koşul getirmeyen değişiklik ("Tabloya bir sütun ekle.") → `yok` |
| `yok` | YENİ mesajda bir koşul söz konusu değil | "Tabloya bir sütun ekle.", "Olmadı." | |
| `belirsiz` | Önceki bağlam görünmüyor | Yalnızca "Yine olmadı." var | |

## 5. Önceki cevap karşıladı mı? (`onceki_cevap_karsiladi`: evet / hayir / belirsiz)

- Yalnızca **o cevap verilmeden önce geçerli olan** birikmiş isteğe ve açık koşullara göre değerlendirilir (§0).
- Sonradan eklenen koşul eski cevabı başarısız yapmaz.
- **Cevaplamama ile olgusal tartışma ayrı şeylerdir:**
  - Cevap sorulan şeyi hiç cevaplamıyorsa `hayir`. Örnek: K: "Mars'ın kaç uydusu var?" A: "Mars kırmızı renkli bir gezegendir." → `hayir`.
  - Cevap sorulan şeyi cevaplıyor ama olgusal doğruluğu tartışılıyorsa doğruluk tartılmaz; karar yalnızca soruya cevap verilip verilmediğine ve açık koşullara göre verilir. Örnek: aynı soruya "Mars'ın üç uydusu var." cevabı sorulan şeye cevap verir; sayının doğruluğu etiketleyicinin kendi bilgisiyle tartılmaz.
- **Koşul uyumu için içerik bilgisi:** Tartışmasız içerik bilgisi kullanılabilir. Örnek: "vegan olsun" koşulunda bal ya da tereyağı geçiyorsa koşul görünür biçimde karşılanmamıştır. Tartışmalı içerik bilgisi kullanılmaz; o noktada karar `belirsiz` kalır. Örnek: "laktozsuz olsun" koşulunda keçi sütü geçiyorsa (kişiye göre değişir) → `belirsiz`.
- **Mesaj dili cevap dili koşulu değildir.** Kullanıcının mesaj dilini değiştirmesi, cevabın o dilde olmasını istediği anlamına gelmez. Cevap dili açıkça istenmemişse başka dildeki cevap karşılamış sayılabilir. Örnek: K: "Kaç gram şeker?" A (İngilizce): "About 80 grams." → dil yüzünden `hayir` olmaz.
- Örtük tür kuralları (hece ölçüsü, kafiye, belirli bir yazım düzeni) açıkça istenmedikçe aranmaz.
- **Kod ve çalıştırma:** Sonuç **yalnızca çalıştırarak** doğrulanabiliyorsa `belirsiz`. Hata metnin kendisinde görünüyorsa görünür ihlaldir. Örnek: K: "İki sayıyı toplayan bir işlev yaz." A: `def topla(a, b): return a * b` → işlem metinde açıkça yanlış, `hayir`. Uzun bir ayrıştırma işlevinin her girdide doğru çalışıp çalışmadığı ise yalnızca çalıştırarak anlaşılır → `belirsiz`.
- Kullanıcı hata çıktısı vermeden başarısızlık bildiriyorsa ("çalışmıyor", "yine hata veriyor") ve hata metinde görünmüyorsa, kod okununca doğru görünse bile sonuç `belirsiz`, `gerekli_girdi_eksik` = `evet` olur. Bu bilinçli bir tercihtir: etiketleyici kodu kafasında çalıştırmaz, kullanıcının ortamını da göremez.
- Önceki cevap yoksa ya da gerekli girdi eksikse sonuç `belirsiz` olur.

**`gerekli_girdi_eksik` (evet / hayir):** Etiketleyicinin `onceki_cevap_karsiladi` kararı için gereken ama konuşmada olmayan bir girdi (hata çıktısı, kaynak metin, ek dosya gibi) varsa `evet`. Örnekler:
- K: "Kodum çalışmıyor, düzelt." Kod var ama hata çıktısı verilmemiş ve hata metinde görünmüyor → `evet`.
- K: "Ekteki raporu özetle." Rapor konuşmada yok → `evet`.
- Gereken her şey konuşmada görünüyorsa → `hayir`.

## 6. Durum (`durum`) ve tıkanma (`tikanma`)

| `durum` | Tanım |
|---|---|
| `tekrar_ihlal_dogrulanmis` | Aynı geçerli koşulu (isteğin özü dahil) art arda en az iki asistan cevabı denetlenebilir biçimde karşılamıyor (görünür metin ya da kural ölçümü) ve değerlendirilen önceki cevap da bunlardan biri |
| `ilk_ihlal` | Önceki cevap geçerli isteği ya da açık bir koşulu görünür biçimde karşılamıyor; aynı koşul için daha önce doğrulanmış başarısız cevap yok |
| `belirsiz` | Kullanıcı itiraz ediyor ama itirazın dayandığı koşul görünmüyor, ya da karşılama belirsiz, ya da gerekli girdi eksik |
| `ilerleyen_revizyon` | Önceki cevap geçerli isteği karşıladı **ve** `revizyon` değerlerden biri. Yeni koşulla birlikte de olabilir. Yalnızca `yeni_kosul` ya da `kapsam_genisletme` bu değeri almaz |
| `yok` | Olumlu kanıt var: önceki cevap görünür koşulları karşılıyor, revizyon istenmiyor, YENİ mesajda dayanağı görünmeyen bir itiraz yok ve gerekli girdi eksik değil |

**Öncelik sırası:** Birden fazla durum uyuyorsa sıradaki ilk uyan seçilir:

`tekrar_ihlal_dogrulanmis` > `ilk_ihlal` > `belirsiz` > `ilerleyen_revizyon` > `yok`

Durum, **YENİ mesajın ihlali anıp anmamasından bağımsız** değerlendirilir. Örnek: önceki cevap "en fazla 4 satır" koşulunu görünür biçimde aşıyor, kullanıcı ise yalnızca "Bir başlık ekle." diyor. Revizyon istenmesi ihlali ortadan kaldırmaz; sıra gereği durum `ilk_ihlal` olur.

**Tekrar ihlal sayımı:**
- Sayılan her cevap için koşul **o cevaptan önce** söylenmiş olmalıdır. Koşul söylenmeden önce verilmiş bir cevap sayılmaz.
- Örnek: A: 120 kelimelik metin. K: "En fazla 50 kelime olsun." A: 90 kelimelik metin. K: "Olmadı." Koşuldan önce verilen ilk cevap sayılmaz; koşul altında yalnızca bir başarısız cevap vardır → `ilk_ihlal`, tekrar değil.

**İtiraz sözcükleri:**
- İtiraz sözcüğü içermeyen yeniden soru tek başına itiraz sayılmaz. Örnek: K: "Su kaç derecede kaynar?" A: "100 °C'de." K: "Su kaçta kaynıyordu?" Bu bir yeniden sorudur; "dayanaksız itiraz" gibi işlenmez.
- "Yine olmadı" aynı işe işaret edebilir (`ayni_is`), ama tek başına aynı isteği, ihlali ya da tıkanmayı kanıtlamaz.
- "Yine", "again" gibi sözcükler konuşmada görünen cevap sayısını değiştirmez. Tek cevaplı konuşmada bu sözcükler sayıma katılmaz.

**Ölçümle çürüyen itiraz:** Kullanıcı bir koşulu anarak ihlal bildiriyor ama kural ölçümü cevabın koşulu karşıladığını gösteriyor. Örnek: "en fazla 5 satır" istenmiş, cevap 4 dolu satır, kullanıcı "5 satırdan uzun olmuş" diyor.
- `onceki_kosulla_iliski` = `yineleme` (koşul anılıyor), `onceki_cevap_karsiladi` ölçüme göre `evet`.
- Mesajda açık bir eylem varsa ("5 satırdan uzun olmuş, son satırı çıkar.") bu eylem revizyondur: `istek_degisimi` = `revizyon`, `durum` = `ilerleyen_revizyon`.
- Eylem yoksa ("5 satırdan uzun olmuş.") `istek_degisimi` = `yok`, `durum` = `yok`; itirazın dayanağı görünür olduğu için `belirsiz` verilmez.

**"Yok" ile "belirsiz" arasındaki sınır:**
- `yok` için olumlu kanıt gerekir.
- "Olmadı", "That's not it again" gibi dayanaksız bir itiraz varsa ve cevap görünür koşulları karşılıyorsa sonuç `belirsiz` olur, `yok` değil.
- Bu ifadeler tek başına ihlal kanıtı da değildir.

**Tıkanma** (`tikanma`: evet / hayir / belirsiz) bu turdaki durumdan türetilir. Kurallar yukarıdan aşağı uygulanır, ilk uyan kural kararı verir:

| Sıra | Koşul | `tikanma` |
|---|---|---|
| 1 | Değerlendirilen ihlalin ya da itirazın ilgili olduğu istek ya da koşul için konuşmada yalnızca **bir** asistan cevabı var (durum `belirsiz` olsa bile). Koşul için sayılan cevaplar, koşul söylendikten sonra verilenlerdir | `hayir` |
| 2 | `durum` = `tekrar_ihlal_dogrulanmis` | `evet` |
| 3 | `durum` = `belirsiz` | `belirsiz` |
| 4 | Diğer bütün durumlar (`ilk_ihlal` dahil) | `hayir` |

Birinci kural, ikinci kuralla çelişmez: tekrar ihlal en az iki cevap gerektirdiği için tek cevaplı bir konuşmada zaten doğrulanamaz.

**İlk ihlal tıkanma değildir** ve tek başına uyarı gerekçesi de değildir. Uyarı verilip verilmeyeceği bu protokolün konusu değildir.

## 7. Kanıt: konuşma alıntısı ve kural ölçümü ayrı

- **`konusma_alintisi`:** Yalnızca konuşmanın kendisinden, kelimesi kelimesine alıntı. Kitapçıktaki ölçüm satırları ya da notlar alıntılanmaz.
- **`kural_olcumune_dayandi`** (evet / hayir): Karar kural ölçümüne dayanıyorsa evet. Ölçümleri (kelime sayısı, dolu satır sayısı) kural yapar; kitapçıkta konuşmadan ayrı bir blokta verilir. Etiketleyici elle saymaz.
- Sentetik bir ölçümün geçmesi, ürünün aynı ifadeyi tanıdığına kanıt değildir.

## 8. Setler

| Set | Ne için | Kimin elinde |
|---|---|---|
| **Açık prova** | Etiketleyicilerin kuralları öğrenmesi ve uyumu görmesi | Bu klasör; kitapçık ve boş formlar. Kitapçıkta vaka kimliği yerine opak kod vardır; kod ile vaka eşlemesi repo dışında tutulur |
| **Denetlenmiş sentetik kıyas seti** (kapalı) | Yaklaşımları aynı vakalarda kıyaslamak | Repo dışında tutulur |

Kıyas seti, kuralları ve referans kararları bir bağımsız gözden geçirme ve kural denetiminden geçmiş **sentetik** bir settir. **Nihai bağımsız test değildir.** Gerçek kullanımı temsil ettiği iddia edilmez.
