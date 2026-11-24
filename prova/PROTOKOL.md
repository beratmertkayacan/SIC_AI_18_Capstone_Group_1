# Sentetik bağlam etiketleme protokolü (sürüm 0.2.1)

> **0.2.1 düzeltmesi (yalnızca §3, §4 ve §6):**
> - Revizyon ile yeni koşul aynı mesajda **birlikte** bulunabilir.
> - Bir koşulun yeni olması, parçaya mı bütüne mi uygulandığına bağlı değildir.
> - `istek_degisimi` artık bir veya iki değer alır.

Bu belge paylaşılabilir. Kapalı vaka metinlerini, cevap anahtarını ya da inceleme çıktılarını içermez. Aşağıdaki örneklerin hepsi kurala özel, uydurma mini örneklerdir; prova ya da kıyas vakalarından alınmamıştır.

## 0. Kapsam

Her vakada **son kullanıcı mesajı (YENİ)** değerlendirilir.

- **Önceki cevap:** YENİ mesajdan hemen önceki asistan cevabı.
- **Önceki istek:** O cevabın yanıtladığı kullanıcı mesajı.

Yardım gösterilip gösterilmeyeceği bu protokolün konusu değildir.

Aşağıdaki kararlar **birbirinden ayrıdır**; biri ötekinden çıkarılmaz:

| Karar | Soru |
|---|---|
| `ayni_is` | Aynı çıktı üzerinde mi çalışılıyor? |
| `ayni_istek` | Aynı şey yeniden mi isteniyor? |
| `istek_degisimi` | İstekte ne değişti? |
| `onceki_kosulla_iliski` | YENİ mesaj önceki bir koşulla nasıl ilişkili? |
| `onceki_cevap_karsiladi` | Önceki cevap, verildiği anda geçerli isteği karşıladı mı? |
| `durum` | İlk ihlal mi, doğrulanmış tekrar mı, ilerleyen revizyon mu, yoksa belirsiz mi? |
| `tikanma` | Doğrulanmış bir tıkanma var mı? |

## 1. Aynı iş (`ayni_is`: evet / hayir / belirsiz)

Aynı iş, **aynı çıktının** (metin, kod, tarif, cevap) üretilmeye ya da düzeltilmeye devam etmesidir.

- **Dahil:**
  - Önceki çıktıya itiraz ("Olmadı.", "Hâlâ çöküyor.")
  - Önceki çıktıyı onaylayıp üzerinde değişiklik istemek
  - Aynı çıktı için yeni bir koşul eklemek
- **Hariç:** Aynı kaynak metin ya da konu hakkında **yeni bir çıktı** isteyen soru. Örnek: bir paragraf özetlendikten sonra "Bu paragraftaki 'enflasyon' ne demek?" → `hayir`.
- **belirsiz:** Atıf yapılan önceki çıktı görünmüyorsa.

## 2. Aynı istek (`ayni_istek`: evet / hayir / belirsiz)

YENİ mesaj, önceki isteğin aynısını mı istiyor? Başka dilde, başka kelimelerle ya da bir koşul yinelenerek yazılmış olabilir.

Revizyon, yeni koşul, kapsam genişletme ve farklı soru aynı istek **değildir**.

## 3. İstekteki değişiklik (`istek_degisimi`: bir ya da iki değer)

İki ayrı soru sorulur:
- **(a) Revizyon:** Kullanıcı mevcut çıktının (bir parçasının ya da tamamının) değiştirilmesini ya da ona ekleme yapılmasını istiyor mu?
- **(b) Yeni koşul:** Kullanıcı, daha önce söylenmemiş ve çıktının uyması gereken açık bir koşul getiriyor mu? Koşul türleri: içermeli/içermemeli, sınır, dil, diyet, biçim. Koşul bir parçaya da bütüne de uygulanabilir.

İkisi de evetse değer `[revizyon, yeni_kosul]` olur. Diğer değerler tek başına kullanılır.

| Değer | Tanım | Dahil | Hariç |
|---|---|---|---|
| `yok` | İstek değişmedi (aynen ya da bir koşul yinelenerek yeniden isteniyor) | "Madde madde istemiştim." | — |
| `mesaj_dili` | Yalnızca mesajın dili değişti | Türkçe sorulan sorunun İngilizce yeniden sorulması | Kullanıcı yanıt dilini açıkça istiyorsa → `[revizyon, yeni_kosul]` |
| `revizyon` (yalnız) | Mevcut çıktıda değişiklik ya da ekleme; yeni bir koşul yok | "Tabloya bir sütun ekle.", "Girişi biraz kısalt." | Değişiklik bir koşul da getiriyorsa → `[revizyon, yeni_kosul]` |
| `[revizyon, yeni_kosul]` | Mevcut çıktı değişsin **ve** yeni bir koşula uysun | "Son satırda 'deniz' geçsin." (parça), "Vegan olsun." (tarifin tamamı), "Bunu Almanca yanıtla." (cevabın tamamı) | — |
| `yeni_kosul` (yalnız) | Mevcut çıktı değişmesin; yeni koşul yalnızca ileriki çıktılar için | "Bundan sonraki tariflerin vegan olsun." (koşul daha önce hiç söylenmemiş) | Daha önce söylenmiş koşulun ileriye yayılması → `kapsam_genisletme` |
| `kapsam_genisletme` | Daha önce söylenmiş bir koşulun ileriki cevaplara da uygulanması | "Bundan sonraki cevaplarda da 3 maddeyi geçme." | Koşulun yalnızca yinelenmesi ("3 madde demiştim.") → `yok` |
| `farkli_soru` | Yeni bir çıktı isteyen farklı soru | "Bu cümledeki 'enflasyon' ne demek?" | — |
| `belirsiz` | Mesaj neyin istendiğini göstermiyor | "Olmadı." (dayanaksız) | — |

## 4. Önceki koşulla ilişki (`onceki_kosulla_iliski`)

Bu alan istekteki değişiklikten ayrıdır. Koşulun karşılanıp karşılanmadığı burada **yazılmaz**; o, `onceki_cevap_karsiladi` alanının işidir.

| Değer | Tanım | Dahil | Hariç |
|---|---|---|---|
| `yineleme` | YENİ mesaj daha önce söylenmiş açık bir koşulu yineliyor; tek başına ya da isteğin tekrarı içinde olabilir | "3 madde demiştim.", "Bundan sonrakiler de 3 maddeyi geçmesin." | İlk kez söylenen koşul |
| `ilk_kez` | YENİ mesaj ilk kez bir koşul getiriyor (`yeni_kosul` değerlerden biri); koşul parçaya ya da bütüne uygulanabilir | "Vegan olsun.", "Son satırda 'deniz' geçsin." | Koşul getirmeyen değişiklik ("Tabloya bir sütun ekle.") → `yok` |
| `yok` | YENİ mesajda bir koşul söz konusu değil | "Tabloya bir sütun ekle.", "Olmadı." | — |
| `belirsiz` | Önceki bağlam görünmüyor | Yalnızca "Yine olmadı." var | — |

## 5. Önceki cevap karşıladı mı? (`onceki_cevap_karsiladi`: evet / hayir / belirsiz)

- Yalnızca **o cevap verilmeden önce geçerli olan** isteğe ve açık koşullara göre değerlendirilir.
- Sonradan eklenen koşul eski cevabı başarısız yapmaz.
- Olgusal doğruluk etiketleyicinin kendi bilgisiyle tartılmaz.
- Örtük tür kuralları (hece ölçüsü, kafiye, belirli bir yazım düzeni) açıkça istenmedikçe aranmaz.
- Önceki cevap yoksa, gerekli girdi eksikse ya da doğrulamak çalıştırma gerektiriyorsa sonuç `belirsiz` olur.
- `gerekli_girdi_eksik` (evet / hayir) ayrı bir alanda işaretlenir.

## 6. Durum (`durum`) ve tıkanma (`tikanma`)

| `durum` | Tanım |
|---|---|
| `ilk_ihlal` | Önceki cevap geçerli isteği ya da açık bir koşulu görünür biçimde karşılamıyor; aynı koşul için daha önce doğrulanmış başarısız cevap yok |
| `tekrar_ihlal_dogrulanmis` | Aynı geçerli koşulu art arda en az iki asistan cevabı denetlenebilir biçimde karşılamıyor (görünür metin ya da kural ölçümü), değerlendirilen cevap da bunlardan biri ve kullanıcı koşulu yineliyor |
| `ilerleyen_revizyon` | Önceki cevap geçerli isteği karşıladı **ve** `revizyon` değerlerden biri. Yeni koşulla birlikte de olabilir. Yalnızca `yeni_kosul` ya da `kapsam_genisletme` bu değeri almaz |
| `yok` | Olumlu kanıt var: önceki cevap görünür koşulları karşılıyor, revizyon istenmiyor, YENİ mesajda dayanağı görünmeyen bir itiraz yok ve gerekli girdi eksik değil |
| `belirsiz` | Kullanıcı itiraz ediyor ama itirazın dayandığı koşul görünmüyor, ya da karşılama belirsiz, ya da gerekli girdi eksik |

**"Yok" ile "belirsiz" arasındaki sınır:**
- `yok` için olumlu kanıt gerekir.
- "Olmadı", "That's not it again" gibi dayanaksız bir itiraz varsa ve cevap görünür koşulları karşılıyorsa sonuç `belirsiz` olur, `yok` değil.
- Bu ifadeler tek başına ihlal kanıtı da değildir.

**Tıkanma** (`tikanma`: evet / hayir / belirsiz) bu turdaki durumdan türetilir:
- `tekrar_ihlal_dogrulanmis` → evet
- `belirsiz` → belirsiz
- Diğer bütün durumlar → hayir

**İlk ihlal tıkanma değildir.**

## 7. Kanıt: konuşma alıntısı ve kural ölçümü ayrı

- **`konusma_alintisi`:** Yalnızca konuşmanın kendisinden, kelimesi kelimesine alıntı. Kitapçıktaki ölçüm satırları ya da notlar alıntılanmaz.
- **`kural_olcumune_dayandi`** (evet / hayir): Karar kural ölçümüne dayanıyorsa evet. Ölçümleri (kelime sayısı, dolu satır sayısı) kural yapar; kitapçıkta konuşmadan ayrı bir blokta verilir. Etiketleyici elle saymaz.
- Sentetik bir ölçümün geçmesi, ürünün aynı ifadeyi tanıdığına kanıt değildir.

## 8. Setler

| Set | Ne için | Kimin elinde |
|---|---|---|
| **Açık prova** | Etiketleyicilerin kuralları öğrenmesi ve uyumu görmesi | Bu klasör; kitapçık ve boş formlar |
| **Denetlenmiş sentetik kıyas seti** (kapalı) | Yaklaşımları aynı vakalarda kıyaslamak | Repo dışında tutulur |

Kıyas seti, kuralları ve beklenen kararları bir bağımsız gözden geçirme ve kural denetiminden geçmiş **sentetik** bir settir. **Nihai bağımsız test değildir.** Gerçek kullanımı temsil ettiği iddia edilmez.
