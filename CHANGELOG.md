# Değişiklik günlüğü

Projenin iş paketleri burada bölüm bölüm kayıtlı; en yeni bölüm en üstte. Kararların gerekçeleri [`docs/05_architecture_decisions.md`](docs/05_architecture_decisions.md) içinde K numaralarıyla, güncel sonuçlar [`docs/10_deployment.md`](docs/10_deployment.md) içinde.

## Teslim turu: anlam desteği, ölçümlü son kurallar ve yayın hazırlığı (19 ile 27 Kasım)

### Eklendi

- **Anlam desteği** (K51): varsayılanı kapalı, izinle çalışan değerlendirici. Sunucu `server/api/judge.ts` (Vercel), istem ve şema `server/judge-spec.json` (Sonnet 5.5, ret durumunda sunucu tarafı yedek model), Python ikizi `src/kafiai/judge.py` ve iki dilde parite testleri. Eklentide tek ağ noktası `background/judge-client.ts`; depodaki ayarda adres boş.
- Aynı istek kartı: aynı istek ya da aynı bilgi, başka sözcüklerle ya da araya başka sorular girdikten sonra ikinci kez sorulunca, önceki cevabın karşılayıp karşılamadığına göre netleştirme sorusu.
- **Anlam onarımı kartı** (K52): onarım kelimesi taşıyan uzun bir mesajda değerlendirici "önceki cevap karşılamadı" derse kart açılır ve mesaj tekrar denemesi sayılır. Sayaç `judge onarim_dedi`.
- Türkçe davranış seti (129 vaka, ayar ve test yarıları) ve değerlendirme modu (`scripts/evaluate_judge.py`), WildFeedback hibrit yeniden oynatması (`scripts/evaluate_judge_replay.py`), açık etiketleme provası (`prova/`).
- Haftalık özet, öneri susturma ve özet başlangıç günü ayarları.
- Eşik tarama betiği `scripts/evaluate_thresholds.py` ve sonuçları `outputs/thresholds_*.json`.
- Gizlilik politikası `docs/PRIVACY.md`; mağaza paketi komutu `npm run package` (kaynak haritası olmadan zip).

### Değişti

- Kısa onarım şeridinin sınırı 12'den 20 karaktere çıktı (`short.repair_max_chars`, K52): rapor örnekleminde şerit 100 sohbette 0,81'den 1,88'e çıktı, isabet aynı kaldı (%58,3 → %58,4); isabetsiz kart değişmedi (13,19 → 13,20). Soruya verilen üç kelimelik ret ("hayır gerek yok") şerit almasın diye teklif reddinin kelime sınırı 3'e çıktı.
- Anlam desteği açıkken yalnızca tur modelinin kartı değerlendiricinin onayını bekliyor; onay için döngü, tıkanma ya da "karşılamadı" belirtilerinden biri yeterli. Değerlendiricinin kendi döngü kartı ayarla kapatıldı (`loop_card`). Rapor örnekleminde (2.000 sohbet) kart isabeti %31,4 → %35,8, yakalama %24,4 → %31,1, isabetsiz kart 100 sohbette 11,7 → 11,05.
- Kart bekleme süresi 5 turdan 3 tura indi (K53): eşik taraması (`scripts/evaluate_thresholds.py`) sonucunda rapor örnekleminde kart 100 sohbette 19,1 → 23,8, isabet %30,8 → %30,2; eklenen kartların isabeti %28. Tur modeli eşiği (0,30), kanıt şartı ve benzerlik eşiği değişmedi; düşürmek ölçüldü ve alınmadı.
- Manifest açıklaması Chrome Web Store'un 132 karakter sınırına göre kısaltıldı; sunucuda Node 22 sabitlendi; sunucu yorumları güncel modele ve tur sınırına göre düzeltildi.
- README, `docs/05` (K51, K52), `docs/06` ve `docs/10` (sunucu kurulumu, mağaza paketi) güncellendi.

### Denenip alınmayanlar

- İlk hata raporunda model kartını kapatan kapı (yakalama 6,6 puan düştü), aynı istek kuralında "son cevap yeni bilgi verdiyse kart yok" (davranış setinde 66/67 → 63/67), kural hatırlatma listesine yalın "dedim" (Türkçe veride hiç geçmiyor). Ayrıntılar K52'de.

### Testler

- Python 195, eklenti 740 (46 dosya), sunucu 5; tip kontrolleri temiz. Temiz mağaza paketinde `connect-src 'none'`, yerel adres yok, tek ağ çağrısı arka plandaki değerlendirici istemcisinde ve adres boş.

## Son tur: genelleme, kuralın hatırlatılması ve belgeler (18 Kasım)

### Eklendi

- Gönderim doğrulaması, çift olay koruması ve satır içi ekleme beş sitede: ortak yardımcı `extension/src/adapters/send-confirmer.ts`; Gemini, Claude, Copilot ve Google AI Modu adaptörleri ChatGPT ile aynı kuralı kullanıyor. Her site için sayfa görüntüsü testleri: sayfa göndermezse sayılmaz, Enter ile Gönder tıklaması tek sayılır (K38).
- Kuralın yeniden hatırlatılması (K48): "söylemiştim", "dediğim gibi", "I told you" gibi güçlü işaretler (`signal-rules.json` "restate"; `signals.ts restatesRule`, Python `restates_rule`, parite örnekleri). Kart başka bir nedenle açıldığında bir not ekler; Taze başlat taslağının başına "Bu sohbette baştan uymanı istediğim kurallar" bölümü girer. Tetikleyici değil; sayaç `signal kural_hatirlatildi`. Yeniden oynatmada kartların %1,25'inde not çıkıyor, bu kartların isabeti %39,6.
- "Yön sende" önerisine ikinci düğme: "Adımı ben yazayım" (K49); sayaç `hint adim_yaz`.
- Aşama 3 ölçümü (K47): `scripts/evaluate_stage3.py`, `src/kafiai/correction_patterns.py` (İngilizce ve Türkçe sözlük), `outputs/stage3_secim.json` ve `outputs/stage3_rapor.json`. Hiçbir aday tetikleyici olarak eklenmedi.
- `scripts/evaluate_replay.py`: aday kural denemesi için `replay(..., extra=...)` ve kural notlu kart ölçümü.
- Türkçe senaryo setine "kural yeniden hatırlatma" senaryosu (22 senaryo).

### Değişti

- Ürünün adı arayüzde ve belgelerde **Kâfi AI** (K30); karşılama başlığı "Kâfi AI'ya hoş geldin".
- Karşılama ekranındaki "Cevabın metnini okumaz." cümlesi gerçeğe uygun hâle getirildi: eklenti cevabın başına ve sonuna yalnızca bellekte, birkaç kural için bakıyor.
- Gemini ve Copilot'ta onarım cümlesi yeni paragraf yerine aynı satıra ekleniyor; kullanılmayan `appendAsNewLine` kaldırıldı.
- README, `docs/01` ile `docs/10` bugünkü duruma göre güncellendi; karar günlüğü K22 ile K50 arasıyla tamamlandı. Kapsam dışı bırakılan işler (hassasiyet ayarı, tur modelinin genişletilmesi, yeni ChatGPT sinyalleri, ikinci dalga özellikleri) belgelerden plan olarak çıkarıldı (K50).

### Testler

- Python 161, eklenti 555 (36 dosya); derleme temiz; derlenmiş kodda ağ API'si yok.

## Döngüden çıkış ve kısa mesajlar (14 ile 17 Kasım)

### Eklendi

- Teklifi geri çevirmek: soruyla biten cevaba verilen yalın "hayır" kısa onarım sayılmıyor; adaptörler cevabın son 200 karakterini de yalnızca bellekte okuyor (K40).
- Kısa devam şeridi: üst üste üçüncü yönsüz devam isteğinde niyet sorusu (K41); yönsüz devam istekleri tek niyet (K43).
- "Yön sende" önerisi: teklif sorularına üst üste kısa onaylarda özet önerisi (K42).
- Düzeltme alınmadı: onarımdan sonra cevap öncekinin neredeyse aynısıysa halka 2, kart "tekrar" gerekçesiyle (K44).
- Davranışsal çıkış: döngü sinyalinden sonra iki temiz tur (K45).
- Döngü sonucu ölçümü: `loop_end`, `signal mesaj_kisaldi` ve `toparlandi` (K46).
- Taze başlat taslağına "Beklediğim sonuç:" ve "Önceki denemelerde olmayan kısım:" satırları.
- Türkçe gerçek kullanım senaryo seti: `tests/fixtures/scenarios_tr.json` ve `tests/test_scenarios.py`.

### Düzeltildi

- ChatGPT'de mesaj ancak sayfada gönderildiği görülünce sayılıyor; Enter ile Gönder'in çift olayı tek sayılıyor; onarım cümlesi satır içine ekleniyor (K38).
- Bir turda en fazla bir müdahale: şerit çıkan turda kart bir sonraki tura kalıyor (K39).
- Şeritteki deneme sayısı yalnızca o mesajın kendi tekrarlarını sayıyor.

## Kural inceltmeleri ve Türkçe kapsama (13 Kasım)

### Değişti

- Benzer mesaj şeridi gönderimi yalnızca birebir tekrarda (benzerlik 0,99 ve üstü) ya da mesaj güçlü bir onarım ifadesi taşıyorsa bekletiyor. Birebir olmayan yeniden yazım halka ve çıkış kartı için sayılmaya devam ediyor. Yeniden oynatmada şerit 100 sohbette 14,7'den 10,1'e indi, isabeti %17,0'dan %21,5'e çıktı; halka ve kart değişmedi (K37).
- Kurallar veriyle inceltildi, tur modeli yeniden eğitildi, yüksek güven eşiğine 0,30 alt sınırı ve uzun sohbet kartında iki işaret (K35; docs/09 güncelleme bölümü).

### Eklendi

- Türkçe karaktersiz yazım: onarım, varyasyon, dolgu, çıkış ve belirsiz istek kuralları "yanlis", "olmadi", "baska", "tesekkurler" gibi yazımları da tanıyor; "süper" İngilizce "super" ile çakıştığı için hariç (K36).
- Türkçe onarım karşılıkları: "ama" ile başlama, "emin misin", "çalışmadı", "düzelmedi" (K36).
- Konsolda halka seviyesi değişimi sinyal sayılarıyla tek satırda; yakın tekrar "bekletilmedi" olarak ayrı yazılıyor.
- Parite örnekleri: Türkçe karaktersiz yazım ve gönderim bekletme kararı (`hold`) için yeni vakalar.

### Düzeltildi

- Büyük harfle yazılmış İngilizce mesajlarda ("CONTINUE", "ALTERNATIVE") varyasyon ve onarım kelimeleri Türkçe "I → ı" kuralı yüzünden tanınmıyordu.

## Platformlar, halka ve sohbet sinyalleri (Ekim sonu ile 10 Kasım)

### Eklendi

- Claude, Copilot ve Google AI Modu adaptörleri; sanal liste kullanan sitelerde tur sayısı sayfanın bildirdiği toplamdan (K31). Desteklenen siteler: ChatGPT, Gemini, Claude, Copilot, Google AI Modu.
- Kişisel ve duygusal sohbetlerde öneri yok; kural tabanlı tespit (K23).
- Araç çubuğu penceresinde "Bu sohbet" ve "Son 7 gün" içgörüleri; Python ikizi ve parite örnekleri (K24).
- Platform başına model kararı: `scripts/evaluate_platforms.py`, `outputs/platform_eval.json`; beş sitede model açık (K25). Dış etiketlerle doğrulama: `scripts/evaluate_external_labels.py` (EmoWOZ, ChatBench).
- Halka: mesaj kutusunun yanında üç seviyeli gösterge, açıklama satırı ve ayar (K29).
- Marka kimliği: ad, slogan, palet, logo, Montserrat yazı tipi (K30).
- Sohbet sinyalleri: özür döngüsü, çıkış, belirsiz istek, konu kayması; özür kartı (K32). Uzun sohbet kartı için döngü işareti (K33).
- Varyasyon isteği ("başka", "sonraki", "another") şerit açmıyor; tek harfli şık cevapları içerik sayılıyor.
- Kısa onarım şeridi (K34).
- Çevrimdışı yeniden oynatma değerlendirmesi: `scripts/evaluate_replay.py`, `outputs/replay_eval.json` (K28).
- Gerçek sayfa görüntüleriyle ChatGPT, Gemini, Claude, Copilot ve Google AI Modu adaptör testleri; ChatGPT ve Gemini'de düzenleme, Gemini ve Copilot'ta yeniden üretme sayılıyor.

### Değişti

- Şerit metni duruma göre ve üçüncü denemede "Yeni sohbete geç" (K26); yeni içerik getiren mesajda şerit çıkmıyor (K20).
- Şerit ve kart ortak görünümde; tema sayfanın arka planından seçiliyor (K27).

## Sayfa görüntüsü temizleyici (P5 ve P6 hazırlığı)

### Eklendi

- `scripts/sanitize_snapshot.py` (K22): kaydedilmiş sayfalardan `<script>` ve `<style>` içeriklerini, HTML yorumlarını, e-postaları, `--name` ile verilen hesap adlarını, resim ve çerçeve adreslerini, sohbet bağlantılarının metnini ve adresini, sayfa başlığını, UUID'leri, JWT'leri ve belirteç benzeri dizgileri çıkarır; neyin kaç kez çıkarıldığını raporlar. Temizlikten sonra kalan bir şey bulursa dosyayı yazmaz.
- `tests/test_sanitize_snapshot.py`: örnek bir sayfada kişisel verinin çıktığını ve adaptörlerin dayandığı yapının kaldığını sınar; ayrıca `extension/test-snapshots/` altındaki her dosyanın temiz olduğunu her çalıştırmada denetler.
- `.gitignore`: `snapshots_raw/`.
- Karar günlüğü: K22.

### Düzeltildi

- `CHANGELOG.md` P2 PR'ına girmemişti; P1 ve P2 kayıtlarıyla birlikte bu PR'da eklendi.

## P2: Platformdan bağımsız temel

### Eklendi

- CI: `.github/workflows/tests.yml`. Her push ve PR'da Python testleri (3.12) ve eklenti için kurulum, tip kontrolü, derleme ve testler (Node 22). CI için hafif bağımlılık listesi `requirements-ci.txt`.
- Veri gerektiren testler için `tests/conftest.py` içinde `requires_data` işareti: veri yoksa test açık bir mesajla atlanır (`pytest -rs` nedeni gösterir). Veri hattını sınayan iki test `tests/test_data_pipeline.py` içinde.
- Platform kaydı (K19): `extension/src/data/platforms.json` ve `src/adapters/registry.ts`. Her platformun adresleri ve yetenekleri (`regenerate`, `edit`, `model`, `interventions`). Adaptör arayüzüne platform kimliği ve isteğe bağlı `onRegenerate`, `onEdit` eklendi. Manifest ile kaydın tutarlılığını `registry.test.ts` denetler.
- Sayaç şeması v2 (K18): `extension/src/data/counter-schema.json`, `src/core/counters.ts`, `src/kafiai/counters.py`. Günlük, seyrek, boyutlu sayaçlar; günün fazı; toplu ve gecikmeli yazma; 90 gün saklama; v1'den bir kerelik göç.
- Python ile TypeScript arasında sayaç paritesi: `tests/fixtures/counter_parity.json` (kovalar, saat dilimleri, sohbet sonucu, geçerli ve geçersiz dışa aktarımlar) iki tarafta da sınanıyor.
- Sayaç testleri: göç, şema, 90 günlük boyut (günde 300 olayla 1,5 MB altı), gizlilik benzetimi (rastgele mesajlardan sonra depoda metin parçası, adres ya da sohbet kimliği yok; anahtarlar izinli listeden).
- Gösterilmeyen öneriler artık nedeniyle sayılıyor: sayım dönemi, bekleme süresi, ayarın kapalı olması, platformun yalnızca sayım modunda olması, kullanıcının yazıyor olması.
- Sohbet sonucu (döngü ya da normal), "Taze başlat" sonrası yeni sohbetin uzunluğu, onarım düğmelerinin türü ve "Yerinde değildi" sayılıyor.

### Değişti

- "Sayaçlarımı kopyala" çıktısı v2 biçiminde ve sürüm numaralı: `{"schema": "kafiai.counts", "version": 2, "exported": "YYYY-MM-DD", "days": {...}}`.
- Araç çubuğu penceresindeki haftalık özet v2 sayaçlarından hesaplanıyor; kartlar için "Bunlardan modelin önerdiği" satırı eklendi.
- Eski sayaç kodu (`settings.ts` içindeki sayaçlar, `summary.ts`, `send-stats.ts`) kaldırıldı; yerini `counters.ts` aldı.
- `content/index.ts` adaptörü platform kaydından seçiyor; model, platformun yeteneğinde kapalıysa çalışmıyor; `count_only` platformda öneri gösterilmiyor, yalnızca sayılıyor.
- Karar günlüğü: K09 "Değiştirildi (K17)", K12 "Değiştirildi (K18)"; K18 ve K19 eklendi.

### Düzeltildi

- "Taze başlat" sürüm 1'de iki kez sayılabiliyordu; artık yalnızca kopyalama başarılı olunca bir kez sayılıyor.
- Sohbetten ayrılırken tur sayısı adres değiştikten sonra okunduğu için sıfır görünebiliyordu; artık bellekteki mesaj sayısından alınıyor.

### Ek iyileştirmeler

- Ağ testi giriş dosyalarını `extension/build-entries.json`'dan alıyor; `build.mjs` de aynı listeyi kullanıyor. Yeni bir giriş eklenince test kendiliğinden kapsıyor.
- Yeni güvenlik testi: derlenmiş kodda izinli platform adresleri dışında web adresi, `eval` ya da `new Function` geçmiyor.
- `make test` (Python ve eklenti testleri birlikte) ve eklentide `npm run check` (tip kontrolü, testler, derleme).

## P1: Doğruluk ve düzen

### Eklendi

- `scripts/compute_findings.py` ve `outputs/findings.json`: README'deki bulguların tek kaynağı; 1M ve 4.8M için tekrar oranı, uzunluğa göre tekrar, birebir tekrar, şablon payı, gece oranı (kullanıcı ağırlıklı, güven aralıklı), kullanıcı yoğunlaşması ve onarım oranı.
- `extension/src/no-network.test.ts`: derlenmiş içerik betiğinde, arka plan çalışanında ve pencerede ağ API'si geçmediğini denetler (CSP içerik betiğini kapsamadığı için).
- `LICENSE` (MIT) ve `data/README.md` (dış veri setlerinin lisansları ve neden depoya girmedikleri).

### Değişti

- README baştan yazıldı; bulgular `findings.json`'dan.
- `docs/02` için güncelleme notu; `docs/05` içinde K07 "Değiştirildi (K17)" ve K11 düzeltmesi; `docs/06` Bölüm 6 ve 9.

### Düzeltildi

- Tur modeli parite testi macOS ile Linux arasındaki son basamak farkında (`log1p`) kırılıyordu; tolerans 1e-12.
