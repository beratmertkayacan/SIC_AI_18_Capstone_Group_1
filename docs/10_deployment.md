# Bölüm 10: Deployment

**Proje:** Kâfi AI, üretken yapay zeka sohbetlerinde verimsiz döngüleri fark eden ve çıkış yolu sunan tarayıcı eklentisi\
**Grup:** SIC AI 18 Capstone, Grup 1\
**İlgili kod:** [`scripts/train_turn_model.py`](../scripts/train_turn_model.py) · [`extension/src/core/turn-model.ts`](../extension/src/core/turn-model.ts) · [`extension/public/manifest.json`](../extension/public/manifest.json) · [`extension/build.mjs`](../extension/build.mjs) · [`scripts/evaluate_replay.py`](../scripts/evaluate_replay.py)

---

## 1. Overview

Kâfi AI'da model bir sunucuya kurulmuyor. Eğitilen model, kuralları ve eşikleriyle birlikte eklentinin içine gömülüyor ve kullanıcının tarayıcısında, sohbetin yapıldığı sayfanın yanında çalışıyor. Bu kararın iki nedeni var. Birincisi gizlilik: Kâfi AI insanların yapay zekayla yaptığı en özel konuşmaları okuyor ve bu metnin cihazdan hiç çıkmaması projenin baştan verdiği söz ([Bölüm 5, K11](05_architecture_decisions.md)). İkincisi gecikme: şerit mesaj gönderilmeden önce karar verdiği için tahminin milisaniyeler içinde bitmesi gerekiyor; ağa gidip gelen bir istek bu süreye sığmazdı.

Bu yüzden bizim projede "deployment", modeli eğitim ortamından alıp eklenti paketine taşımak ve paketi tarayıcıya kurmak demek. Akış beş adımdan oluşuyor:

| Adım | Ne yapılıyor | Nerede |
|---|---|---|
| 1. Eğitim | Tur modeli WildChat 4.8M üzerinde eğitiliyor, kalibre ediliyor ve eşikleri seçiliyor | `scripts/train_turn_model.py` |
| 2. Aktarma | Katsayılar, ölçekleme, kalibrasyon ve eşikler tek bir JSON dosyasına yazılıyor | `extension/src/data/turn-model.json` |
| 3. Doğrulama | Python ve TypeScript aynı girdide aynı olasılığı ve aynı kural kararını veriyor mu; karar zinciri gerçek sohbetlerde ne kadar isabetli; derlenmiş kodda ağ isteği var mı | `tests/`, `extension/src/**/*.test.ts`, `scripts/evaluate_replay.py`, GitHub Actions |
| 4. Derleme | TypeScript kodu, JSON dosyaları ve yazı tipi tek bir paket hâlinde derleniyor | `extension/build.mjs` → `extension/dist/` |
| 5. Kurulum | Paket Chrome'a yükleniyor ve beş sitede çalışıyor | Chrome, `chrome://extensions` |

Bugünkü dağıtım durumu: eklenti henüz bir mağazada yayımlanmadı. Geliştirme ve elle doğrulama sürecinde `extension/dist` klasörü Chrome'a "Paketlenmemiş öğe yükle" ile kuruluyor. Chrome Web Store yayını planlanan son dağıtım adımı (Bölüm 3.4).

---

## 2. Model Serialization

### 2.1 Neden JSON?

Tur modeli bir lojistik regresyon. Tahmin için gereken her şey birkaç sayı listesinden ibaret: her özniteliğin ortalaması ve ölçeği, katsayısı, sabit terim, kalibrasyon parametreleri ve iki karar eşiği. Bu yüzden modeli pickle, joblib ya da ONNX gibi bir biçimde paketlemek yerine düz bir JSON dosyasına yazdık. Karşılaştırma:

| Biçim | Artısı | Bizim için sorunu |
|---|---|---|
| pickle / joblib | scikit-learn'den tek satırla kaydedilir | Yalnızca Python okur; tarayıcıda çalışmaz. Güvenilmeyen dosyadan yüklemek kod çalıştırma riski taşır |
| ONNX | Birçok çalışma ortamında açılır | Tarayıcıda çalıştırmak için ayrı bir çalışma zamanı kütüphanesi gerekir; paket boyutu megabaytlarla ölçülür |
| **JSON (seçilen)** | İnsan okuyabilir, git farkında satır satır görünür, iki dil de kütüphanesiz okur | Yalnızca doğrusal modeller için pratik; ağaç tabanlı bir modele geçilirse yeniden düşünülmeli |

Eğitim betiğinde XGBoost da denendi ([Bölüm 9](09_turn_model.md)); lojistik regresyon benzer başarıyı daha açıklanabilir ve çok daha küçük bir dosyayla verdiği için seçildi. Bu seçim serileştirme kararını da sadeleştirdi.

### 2.2 Dosyanın içeriği

`extension/src/data/turn-model.json` 1.739 bayt. Dosyayı `scripts/train_turn_model.py` üretiyor; başındaki not elle değiştirilmemesi gerektiğini söylüyor. Alanlar:

| Alan | İçerik |
|---|---|
| `version` | Dosya biçiminin sürümü (1) |
| `features` | 22 özniteliğin adı, sırasıyla (tur sayısı, mesaj uzunlukları, benzerlik, güçlü onarım ifadesi sayısı, görev türü gibi) |
| `mean`, `scale` | Eğitimdeki StandardScaler parametreleri |
| `coef`, `intercept` | Lojistik regresyon katsayıları ve sabit terim |
| `platt` | Platt kalibrasyonu (a = 0,888, b = −2,165) |
| `thresholds` | "Öneri" eşiği 0,168 ve "yüksek güven" eşiği 0,30 |
| `high_requires` | Yüksek güven için kanıt şartı: sohbette en az bir güçlü onarım ifadesi (`n_strong_repairs`) |
| `min_turn`, `max_turn` | Modelin çalıştığı tur aralığı (2 ile 6; daha uzun sohbetlerde tur sayısı 6'da sabitlenir) |

Tarayıcıdaki hesap, eğitimdeki hesabın birebir aynısı ve kütüphane gerektirmiyor:

```
ham       = sigmoid(sabit + Σ katsayı × (değer − ortalama) / ölçek)
olasılık  = sigmoid(a × logit(ham) + b)
```

### 2.3 Model dışındaki kurallar da aynı biçimde

Kâfi AI'nın kararlarının çoğu modelden değil, ölçülerek seçilmiş kurallardan geliyor: benzer mesaj eşiği, onarım ifadeleri, varyasyon isteği, özür döngüsü, kısa mesaj kuralları, düzeltme alınmadı, kuralın yeniden hatırlatılması, kişisel sohbet tespiti. Bunlar `extension/src/data/` altında JSON dosyalarında duruyor: `repair-rules.json`, `repeat-rules.json`, `signal-rules.json`, `personal-rules.json`, `task-rules.json`, `task-norms.json`, `model-reasons.json`, `insights-config.json`, `platforms.json` ve `counter-schema.json`. Python tarafı (`src/kafiai/`) aynı dosyaları okuyor. Böylece bir eşik tek bir yerde değişiyor ve değerlendirme betiği ile eklenti hiçbir zaman farklı kurallarla çalışmıyor.

### 2.4 Depolama ve sürümleme

Model ve kural dosyaları git'te kodla birlikte sürümleniyor; her model ya da kural güncellemesi bir commit olarak görülüyor. Toplam boyut birkaç on kilobayt olduğu için ayrı bir model deposuna (model registry) ya da sıkıştırmaya ihtiyaç duyulmadı. Derleme sırasında JSON dosyaları JavaScript paketinin içine gömülüyor; çalışma anında ayrıca bir dosya indirilmiyor ya da okunmuyor. Her kural değişikliği iki dilde birlikte yapılıyor ve `tests/fixtures/*_parity.json` içine örnek ekleniyor.

---

## 3. Model Serving

### 3.1 Çalışma ortamı

Model Chrome'un Manifest V3 eklenti yapısı içinde, içerik betiğinde (`content.js`) çalışıyor. İçerik betiği yalnızca manifestte listelenen altı adreste yükleniyor: ChatGPT (iki adres), Gemini, Claude, Copilot ve Google AI Modu. Her site için ayrı bir adaptör (`extension/src/adapters/`) sayfadaki mesaj kutusunu, gönderimi ve cevabın bitişini yakalıyor; karar çekirdeği (`extension/src/core/`) beş sitede ortak.

Bir turdaki akış şöyle:

1. Kullanıcı mesajı gönderir. Adaptör gönderimi yakalar; mesaj ancak sayfada gerçekten gönderildiği görülünce sayılır (kutu boşaldı, yeni kullanıcı mesajı belirdi ya da üretim başladı). Enter'dan sonra sitenin kendi Gönder tıklaması aynı gönderim sayılır. Bu korumalar beş sitede ortak bir yardımcıda (`send-confirmer.ts`, K38).
2. Gönderimden önce mesaj son mesajlarla karşılaştırılır; birebir tekrar ya da kısa onarım ifadesi ("olmadı") varsa gönderim bekletilir ve şerit çıkar.
3. O ana kadarki mesajlardan 22 öznitelik çıkarılır (`turn-features.ts`) ve `predict` olasılığı, seviyeyi ("düşük", "öneri", "yüksek") ve gerekçeyi döndürür.
4. Cevap bitince cevabın başı ve sonu yalnızca bellekte okunur: özürle mi başlıyor, öncekinin neredeyse aynısı mı, soruyla mı bitiyor.
5. Tahmin sohbet sinyalleriyle birleşir; halka güncellenir ve gerekirse çıkış kartı açılır. Bir turda en fazla bir müdahale yapılır.

Hesap 22 çarpma ve iki sigmoid'den ibaret olduğu için tahmin süresi pratikte sıfır; tarayıcıda fark edilir bir bellek ya da işlemci yükü oluşturmuyor.

### 3.2 Neden bulut değil?

[Bölüm 3](03_technology_review.md) üç seçeneği karşılaştırmıştı: cihazda çalışan model, tarayıcının kendi yerleşik yapay zekası ve bulut sunucusu. Bulut seçeneği her sohbet mesajını bir sunucuya göndermeyi gerektirirdi. Bu hem gizlilik sözümüzle çelişirdi hem de sunucu maliyeti, erişilebilirlik ve kimlik doğrulama gibi yeni sorunlar getirirdi. Tarayıcının yerleşik yapay zekası ise her cihazda yok ve sonuçlarını açıklamak zor. Cihazda çalışan küçük bir doğrusal model ve açık kurallar bu üç sorunu birden ortadan kaldırıyor.

### 3.3 Derleme ve kurulum

Derleme esbuild ile yapılıyor (`extension/build.mjs`). Giriş noktaları `build-entries.json` içinde listeli: içerik betiği, arka plan çalışanı, araç çubuğu penceresi ve karşılama sayfası. Montserrat yazı tipi ağdan değil, pakete gömülü olarak geliyor. Derlenmiş paket `extension/dist/` klasörüne yazılıyor.

```bash
cd extension
npm ci
npm run check    # tip kontrolü, testler, derleme
```

Ardından Chrome'da `chrome://extensions` sayfasında "Geliştirici modu" açılıyor ve "Paketlenmemiş öğe yükle" ile `extension/dist` klasörü seçiliyor. Eklenti ilk kurulduğunda karşılama sayfası açılıyor.

### 3.4 İsteğe bağlı anlam desteği sunucusu (K51)

Kurallar ve tur modeli cihazda çalışmaya devam ediyor. Kullanıcı izin verirse açılan anlam desteği için tek bir sunucusuz fonksiyon var: `server/api/judge.ts` (Vercel). İstem, şema ve model `server/judge-spec.json` dosyasında; Python ikizi (`src/kafiai/judge.py`) çevrimdışı değerlendirmede aynı metni üretir.

| Adım | Ne yapılır |
|---|---|
| Vercel projesi | Kök klasör `server`; Node 22 (`server/package.json` `engines`) |
| Ortam değişkenleri | `ANTHROPIC_API_KEY` zorunlu; `KAFI_TOKEN` isteğe bağlı. `KAFI_TOKEN` tanımlanırsa eklentinin `src/data/judge.json` `token` alanına aynı değer derlemeden önce yazılmalı, yoksa her istek 401 alır. Belirteç pakette durduğu için gizli değildir; yalnızca rastgele taramayı eler |
| Kötüye kullanım | Fonksiyondaki oran sınırı yalnızca en iyi çaba (örnek başına bellek). Vercel Firewall'da oran sınırı kuralı ve Anthropic Console'da harcama sınırı kurulmalı |
| Doğrulama | Yayından sonra tek bir deneme isteğiyle 200 dönüşü ve kararın şemaya uyduğu kontrol edilir |

Sunucu metni diske ya da günlüğe yazmaz; günlüğe yalnızca durum ve süre düşer.

### 3.5 Mağaza paketi ve Chrome Web Store

İki paket türü var. Adres verilmeden derlenen paket hiçbir ağ isteği yapmaz ve manifestte `connect-src 'none'` kalır; anlam desteği anahtarı pencerede devre dışı görünür. Sunucu adresiyle derlenen pakette anahtar açılabilir ve manifest yalnızca o sunucuya bağlantıya izin verir.

```bash
cd extension
unset KAFI_JUDGE_URL && npm run package                                  # anlam desteği olmadan
KAFI_JUDGE_URL=https://<alan>/api/judge npm run package                   # anlam desteğiyle
grep -r localhost dist || echo "yerel adres yok"                          # yerel deneme adresi pakete girmemeli
```

`npm run package` paketi derler ve `extension/kafi-ai-<sürüm>.zip` dosyasını kaynak haritaları olmadan üretir (zip git dışında). Mağaza başvurusu için gizlilik politikası `docs/PRIVACY.md` dosyasında; herkese açık bir adreste (örneğin GitHub Pages) yayımlanıp başvuruya eklenir. İzin gerekçeleri politikanın 4. bölümünde. Mağaza açıklaması 132 karakter sınırına uyar. Mağaza yayınından sonra güncellemeler Chrome'un otomatik güncelleme mekanizmasıyla kullanıcılara ulaşır; model ya da kural güncellemesi de eklentinin yeni bir sürümü olarak dağıtılır.

---

## 4. API Integration

Kâfi AI dışarıya açık bir API sunmuyor ve bu bilinçli bir karar. Modeli bir REST uç noktasının arkasına koymak, sohbet metninin ya da ondan türetilen özniteliklerin cihaz dışına çıkması demekti. Bunun yerine model eklentinin içinde bir fonksiyon olarak çağrılıyor. Bu bölümde o iç arayüzü anlatıyoruz, çünkü Python ile TypeScript arasındaki sözleşme bir API sözleşmesinin yerini tutuyor.

### 4.1 Tahmin arayüzü

| | Açıklama |
|---|---|
| Fonksiyon | `predict(features, maxReasons = 2)` (`extension/src/core/turn-model.ts`), Python karşılığı `kafiai.turn_model.predict` |
| Girdi | Öznitelik sözlüğü: `{ "turn": 3, "last_sim": 0.86, "n_strong_repairs": 1, "task_kod": 1, ... }` (22 alan; eksik alan 0 sayılır) |
| Çıktı | `{ probability: 0.34, level: "yuksek", reasons: [{ key, short, why, tip }] }` |
| Seviye kuralı | Olasılık 0,30 ve üstü ve kanıt şartı sağlanıyorsa "yuksek"; 0,168 ve üstüyse "oneri"; değilse "dusuk" |
| Gerekçe | Olasılığı en çok artıran öznitelik; kullanıcıya `model-reasons.json` içindeki Türkçe karşılığı gösterilir |

### 4.2 Sayfa ile eklenti arasındaki arayüz

Eklentinin "girdi uç noktası" sitelerin sayfaları. Her adaptör aynı arayüzü uygular (`extension/src/adapters/types.ts`): mesaj kutusunu bulma, gönderimi yakalama ve gerektiğinde bekletme, gönderimi doğrulama, cevap bitişini izleme, sohbet geçmişini ve cevabın başını okuma, onarım cümlesini kutuya ekleme. Sitelerin yetenekleri (yeniden üretmeyi ya da düzenlemeyi yakalayabilmek, modelin açık olup olmadığı) `platforms.json` kaydında durur (K19). Yeni bir site eklemek, bu arayüzü uygulayan bir adaptör yazıp kayda eklemek demek; çekirdek değişmiyor. Adaptörler her sitenin temizlenmiş gerçek sayfa görüntüleriyle test ediliyor (34 görüntü, K22).

Araç çubuğu penceresi ile içerik betiği arasında da küçük bir iç arayüz var: pencere "Bu sohbet" bilgisini tarayıcı içi mesajla ister; cevapta mesaj metni yoktur, yalnızca sayılar ve sabit sözcükler vardır (`src/core/messages.ts`).

### 4.3 Sözleşmenin korunması: parite testleri

Python ve TypeScript aynı modeli ve aynı kuralları ayrı ayrı çalıştırdığı için ikisinin aynı sonucu verdiği sürekli kontrol ediliyor. `tests/fixtures/*_parity.json` dosyaları girdileri ve Python'un verdiği çıktıları içeriyor (benzerlik, tekrar kuralı, sohbet sinyalleri, tur modeli, sayaçlar, haftalık içgörü); eklenti testleri aynı girdilerde aynı olasılığı, seviyeyi ve kural kararını bekliyor. Böylece çevrimdışı değerlendirmede ölçtüğümüz başarı, tarayıcıda çalışan kodun başarısıyla aynı kalıyor.

---

## 5. Security Considerations

Kâfi AI'da güvenliğin merkezinde kimlik doğrulama değil, verinin cihazdan çıkmaması var. Kullanıcı hesabı olmadığı için kimlik doğrulama ve yetkilendirme gerekmiyor; korunması gereken şey kullanıcının sohbet metni. Tek istisna, kullanıcının açtığı anlam desteğidir (3.4, K51): o durumda da metin sunucuda saklanmaz.

### 5.1 Tarayıcı düzeyinde kısıtlar

| Önlem | Ne sağlıyor |
|---|---|
| Güvenlik politikası `connect-src 'none'` | Eklenti sayfaları ve arka plan çalışanı hiçbir adrese bağlantı kuramaz; anlam desteğiyle derlenen pakette yalnızca o sunucuya izin verilir |
| `script-src 'self'` | Yalnızca pakette gelen kod çalışır; uzaktan kod yüklenemez |
| En az izin | `permissions` altında yalnızca `storage` (ayarlar ve sayılar için) ve `clipboardWrite` (Taze başlat taslağını ve sayaç dökümünü kopyalamak için) |
| Sınırlı adres erişimi | `host_permissions` ve içerik betiği yalnızca altı adresi kapsar: chatgpt.com, chat.openai.com, gemini.google.com, claude.ai, copilot.microsoft.com ve google.com/search (adaptör yalnızca AI Modu'nda çalışır). Başka sitelerin sayfalarını göremez |

### 5.2 Kod düzeyinde denetim

İçerik betiği sitenin kendi sayfasında çalıştığı için `connect-src 'none'` onu kapsamıyor. Bu boşluğu bir test kapatıyor (`extension/src/no-network.test.ts`): eklenti, derleme ayarlarıyla aynı biçimde derleniyor ve çıkan kodda `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource` ve `importScripts` adlarından hiçbirinin, `eval` ya da `new Function` kullanımının ve desteklenen site adresleri dışında bir web adresinin geçmediği kontrol ediliyor. Aynı test manifestteki izinleri ve güvenlik politikasını da denetliyor. Test her push ve pull request'te GitHub Actions üzerinde çalışıyor.

### 5.3 Verinin saklanması

1. Mesaj metni yalnızca sekmenin belleğinde tutuluyor; sekme kapanınca ya da sohbet değişince siliniyor. Cevabın yalnızca başı ve sonu, yalnızca bellekte ve yalnızca kurallar için okunuyor.
2. `chrome.storage.local` alanına yalnızca ayarlar ve sayılar yazılıyor. Sayaç anahtarları şemadaki kısa listelerden oluşuyor (platform, saat dilimi, görev türü, tur aralığı); metin, sohbet kimliği ya da adres anahtara giremiyor. Bunu rastgele mesajlarla yapılan bir gizlilik benzetimi testi denetliyor.
3. Konsol günlükleri yalnızca `[KafiAI]` önekli sayı ve etiket içeriyor.
4. Kullanıcı araç çubuğu penceresinden "Tüm verilerimi sil" ile bütün sayıları ve ayarları silebiliyor; sayılar 90 gün sonra kendiliğinden siliniyor.
5. Kişisel ve duygusal sohbetlerde öneri gösterilmiyor (K23); "Yalnızca say" modunda hiçbir şey gösterilmiyor.

### 5.4 Şifreleme

Cihaz dışına veri çıkmadığı için aktarım şifrelemesine gerek kalmıyor. Yerel depoda yalnızca sayılar tutulduğu için ayrı bir şifreleme katmanı eklemedik; bu sayılar kullanıcının cihazındaki Chrome profiliyle aynı korumaya sahip.

### 5.5 Eğitim verisinin güvenliği

Dış veri setlerinin ham verisi depoya girmiyor; yalnızca işleme betikleri ve özet sayılar depoda. ShareChat (CC BY-NC) ve LMSYS veri setleri lisansları gereği yalnızca değerlendirmede kullanılıyor, modelin eğitimine girmiyor. Adaptör testlerinde kullanılan sayfa görüntüleri depoya yalnızca kişisel verileri temizlenmiş hâlde giriyor ve her test çalıştırmasında yeniden denetleniyor (K22).

---

## 6. Monitoring and Logging

Klasik bir dağıtımda model sunucuda çalıştığı için istekler ve tahminler merkezi olarak izlenir. Kâfi AI'da model kullanıcının cihazında çalıştığı ve hiçbir veri dışarı gönderilmediği için uzaktan telemetri yok. İzlemeyi bunun yerine dört katmanda yapıyoruz.

### 6.1 Yerel sayaçlar

Sayaç şeması v2 (`counter-schema.json`, K18) her olayı yalnızca sayı olarak, günlük olarak ve 90 gün boyunca tutuyor. İzlenen olaylardan bazıları:

| Olay | Ne ölçüyor |
|---|---|
| `send` | Gönderilen mesajlar ve sınıfları: benzer, kısa onarım, varyasyon, kısa, farklı. Sayfada görülmeyen gönderim sayılmaz |
| `strip`, `strip_action`, `repair_button` | Şeridin tetiklenmesi, gösterilmesi ya da neden gösterilmediği ve kullanıcının hangi düğmeyi seçtiği |
| `card`, `card_action` | Çıkış kartının kaynağı (model, özür, düzeltme alınmadı, uzun sohbet) ve kullanıcının tepkisi (Taze başlat, ara ver, kapat, yerinde değildi) |
| `hint` | "Yön sende" önerisi: gösterildi, özetlet, adımı ben yazayım, yerinde değildi, kapat |
| `ring` | Halkanın seviye değişimleri ve açıklamanın açılması |
| `signal` | Özür döngüsü, çıkış, konu kayması, belirsiz istek, düzeltme alınmadı, mesajın kısalması, toparlanma, kuralın yeniden hatırlatılması |
| `loop_end` | Döngü görülen sohbetin sonucu: toparlandı, bırakıldı ya da yeni sohbete geçildi |

Kullanıcı bu sayıları araç çubuğu penceresinden JSON olarak kopyalayabiliyor; dökümün biçimi `validateExport` ile denetleniyor. Gerçek kullanımdaki davranış (önerilerin ne sıklıkta çıktığı, hangi düğmenin seçildiği) bu dökümlerle izleniyor.

### 6.2 Geliştirici günlükleri

Elle doğrulamada Chrome konsolunda `[KafiAI]` önekli satırlar takip ediliyor: mesajın nasıl sınıflandığı (benzer, kısa onarım, varyasyon, farklı), gönderimin bekletilip bekletilmediği ya da sayfada görülmediği, halka seviyesi ve sinyal sayıları, model olasılığı, kartın gösterilip gösterilmediği. Bu satırlarda mesaj metni yer almıyor.

### 6.3 Çevrimdışı performans izleme

Pilot yapılmadığı için başarı ölçütümüz WildFeedback üzerinde çevrimdışı yeniden oynatma (`scripts/evaluate_replay.py`, K28). Eklentinin karar zinciri, Python ikiziyle, 20.000 gerçek sohbette tur tur yeniden oynatılıyor ve her müdahalenin veri setindeki memnuniyetsizlik işaretiyle ne kadar örtüştüğü ölçülüyor. Kural seçimi rapor örnekleminden ayrık bir seçim örnekleminde yapılıyor, böylece sayılar iyimser çıkmıyor. Güncel sonuçlar (`outputs/replay_eval.json`, rapor örneklemi, tüm turlarda memnuniyetsizlik %5,04):

| Bileşen | Sıklık | İsabet |
|---|---|---|
| Benzer mesaj şeridi | 100 sohbette 10,14 | %21,54 |
| Kısa onarım şeridi (20 karakter sınırı, K52) | 100 sohbette 1,88 | %58,40 |
| Kısa devam şeridi | 100 sohbette 0,51 | %5,88 (bir uyarı değil, yön sorusu) |
| "Yön sende" önerisi | 100 sohbette 0,02 | eski veride ölçülemeyecek kadar seyrek |
| Halka | turların %21,47'sinde 1. seviye ve üstü, %9,44'ünde 2. seviye | 2. seviyede %29,87 |
| Çıkış kartı (tümü, 3 tur bekleme, K53) | 100 sohbette 23,77 | %30,21 |
| Çıkış kartı, kaynağa göre | model 4.003, özür 513, düzeltme alınmadı 194, uzun sohbet 43 kart | %27,50 · %45,42 · %50,00 · %11,63 |
| Kural notu taşıyan kart | kartların %1,37'si | %36,92 |

İsabet: şeritlerde o mesajda, halka ve kartta o turda ya da bir sonrakinde kullanıcının memnuniyetsiz olması. Kullanıcının iki ya da daha fazla kez memnuniyetsiz olduğu 1.294 sohbetin %31,9'unda kart ikinci şikayetten önce geliyor. Sohbetlerin %24,1'inde bir döngü sinyali görülüyor ve bunların %52,0'si döngü sürerken bitiyor; bu sohbetlerin son iki turunda memnuniyetsizlik %33,1, döngüsü sakinleşerek biten sohbetlerde %16,9. Anlam desteği açıkken ölçülen hibrit sonuçlar Bölüm 5, K52'de.

Tur modelinin kendi test sonuçları (`outputs/turn_model_metrics.json`, eğitimde görülmeyen kullanıcılar): PR-AUC 0,321 (rastgele 0,098), ROC-AUC 0,782, kalibrasyon hatası (ECE) 0,020. Yüksek güven eşiğinde turların %5,07'si işaretleniyor ve bunların %44,57'si gerçekten döngü.

Her kural ya da model değişikliğinden sonra yeniden oynatma tekrar çalıştırılıyor ve önce ile sonra sayıları karşılaştırılıyor. Yeni bir kural önerisi ayrıca `scripts/evaluate_stage3.py` gibi ölçüm betikleriyle önce seçim örnekleminde sınanıyor; net bir iyileşme vermeyen aday eklenmiyor (K47). Bu, sunucu tarafındaki "model kayması izleme" işinin bizim projedeki karşılığı.

### 6.4 Sürekli entegrasyon ve uyarılar

GitHub Actions her push ve pull request'te Python testlerini (Python 3.12), eklentinin tip kontrolünü, derlemesini ve testlerini (Node 22) çalıştırıyor. Bugün Python tarafında 161, eklentide 555 test var. Bu testler parite örneklerini, 22 Türkçe gerçek kullanım senaryosunu, beş sitenin temizlenmiş sayfa görüntüleriyle adaptör testlerini ve ağ denetimini içeriyor. Ham veri gerektiren testler veri yoksa açık bir mesajla atlanıyor. Bir test kırıldığında GitHub'ın bildirimi bizim uyarı mekanizmamız oluyor.

Kullanıcı cihazlarından otomatik uyarı ya da hata raporu toplanmıyor. Bu, gizlilik sözünün doğal bir bedeli: sahada bir sitenin sayfa yapısı değiştiğinde bunu ancak elle doğrulamada ya da kullanıcı geri bildirimiyle öğrenebiliyoruz. Bu riski azaltmak için adaptörler sayfa görüntüleriyle test ediliyor, sayfa yapısı tanınmazsa eklenti sessizce devre dışı kalıyor (K10) ve siteler güncellendikçe görüntüler yenileniyor.
