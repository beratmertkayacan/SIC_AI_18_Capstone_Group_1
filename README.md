# SIC AI 18 Capstone Projesi, Grup 1

### Üretken yapay zeka kullanımında verimsiz döngülerin ve aşırı güvenin tespiti

Samsung Innovation Campus Yapay Zeka programının 18. dönem bitirme projesi. Bu yılın teması Yeşilay iş birliğiyle **dijital bağımlılık**.

---

## Proje hakkında

ChatGPT, Gemini ve Copilot gibi yapay zeka asistanları kısa sürede ders çalışmanın ve iş yapmanın sıradan bir parçası oldu. Bu araçlar verimliliği artırıyor, fakat yoğun kullanımla birlikte yeni bir alışkanlık da ortaya çıkıyor: aynı talebi tekrar tekrar sormak, cevabı defalarca yeniden ürettirmek ve düşünme işini giderek araca bırakmak. Oturum uzuyor, gerçek ilerleme duruyor.

Mevcut dijital iyi oluş araçları bu sorunu göremiyor, çünkü yalnızca **süreyi** ölçüyorlar. Oysa iki saatlik verimli bir çalışma ile iki saat boyunca aynı yerde dönmek arasındaki fark sürede değil, **kullanım biçiminde**.

Bu projede problemli yapay zeka kullanımını kullanım biçimi üzerinden tanımlıyor ve iki göstergeye odaklanıyoruz:

1. **Verimsiz kullanım döngüleri:** Aynı talebin neredeyse aynı şekilde tekrar gönderildiği, uzayan ama sonuca ulaşmayan sohbetler.
2. **Aşırı güven ve düşünme devri:** Üretimin ve kararın tamamen yapay zekaya bırakılması.

Hedeflediğimiz ürün, kullanıcının tarayıcısında çalışan bir **Chrome eklentisi**. Eklenti, açık kaynak sohbet verileriyle eğitilen bir model sayesinde bu örüntüleri kullanım sırasında fark ediyor ve yasak ya da süre sınırı koymak yerine doğru anda kısa, gerekçesini açıklayan bir yönlendirme sunuyor. Kullanıcının mesajları cihazından dışarı çıkmıyor.

**Hedef grup:** Günlük ders ve iş süreçlerinde üretken yapay zeka kullanan 18 ile 30 yaş arası yetişkinler, yani üniversite öğrencileri ve genç profesyoneller.

---



## Öne çıkan bulgular

WildChat 1M veri setinden alınan 50.000 gerçek ChatGPT sohbeti üzerinde yaptığımız analizin özeti. Ayrıntılar ve tüm grafikler [Bölüm 2: Veri Araştırması](docs/02_data_research.md) içinde.


| Bulgu                                                                                                            | Değer              |
| ---------------------------------------------------------------------------------------------------------------- | ------------------ |
| En az 3 turluk sohbetlerde, kullanıcının en az bir kez neredeyse aynı mesajı tekrar gönderdiği sohbetlerin oranı | **%31,6**          |
| Aynı oran 10 tur ve üzeri sohbetlerde                                                                            | **%47,5**          |
| En yoğun %1 kullanıcının toplam sohbetlerdeki payı                                                               | **%28,0**          |
| En yoğun %10 kullanıcının toplam sohbetlerdeki payı                                                              | **%54,1**          |
| Türkiye'den gelen sohbetlerde gece 00:00 ile 05:59 arası kullanım (sohbet bazında / kullanıcı ağırlıklı)         | **%30,7 / %17,5**  |
| Uzun sohbetlerde açık memnuniyetsizlik ifadelerinin kısa sohbetlere göre artışı                                  | **yaklaşık 7 kat** |
| Programlar tarafından otomatik gönderilen şablon sohbetlerin oranı                                               | **%16,5**          |



|                                                                                                                                                                                                             |                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Ardışık mesaj benzerliği](figures/05_consecutive_similarity.png) **Ardışık kullanıcı mesajlarının benzerliği.** 1,0'daki tepe, kullanıcının neredeyse aynı mesajı tekrar gönderdiği durumları gösteriyor. | ![Sohbet uzunluğuna göre tekrar oranı](figures/10_repeat_by_length.png) **Sohbet uzadıkça tekrar artıyor.** 10 tur ve üzeri sohbetlerin neredeyse yarısında en az bir tekrar var. |
| ![Kullanım yoğunlaşması](figures/04_user_concentration.png) **Kullanım az sayıda kişide toplanıyor.** Eğri ile kesikli çizgi arasındaki açıklık yoğunlaşmanın büyüklüğünü gösteriyor.                       | ![Saatlere göre kullanım](figures/03_hour_of_day.png) **Günün saatlerine göre kullanım.** Sağda Türkiye, yerel saat ve kullanıcı ağırlıklı.                                       |


---



## Chrome eklentisi: KafiAI

`extension/` klasöründe, ChatGPT ve Gemini sayfalarında çalışan bir Chrome eklentisi (Manifest V3, TypeScript) var. İlk sürüm **modelsiz, kural tabanlı** bir çekirdekle çalışıyor. Makine öğrenmesi katmanı sonraki aşamada eklenecek.

**Ne yapar?**

- **Benzer mesaj uyarısı:** Gönder'e basıldığı anda mesaj, son 5 mesajla karşılaştırılır. Neredeyse aynıysa mesaj gönderilmeden önce kısa bir şerit çıkar: "Yine de gönder", mesajı düzenle ya da "Yerinde değildi". Mesaj yalnızca bu durumda bekletilir, aksi halde akış hiç kesilmez.
- **Çıkış kartı:** Sohbet uzayıp tekrar görüldüğünde (şimdilik 6. turdan sonra) bir kart önerilir. "Taze başlat" o ana kadarki isteklerden kısa bir özet taslağı çıkarır, panoya kopyalar ve yeni sohbet açar. Kart "Bir daha gösterme" ile kapatılabilir.
- **Araç çubuğu penceresi:** Eklenti açma/kapama, çıkış kartı açma/kapama, son 7 günün sayaçları ve "Tüm verilerimi sil".

**Kurulum (geliştirici modu):**

```bash
cd extension
npm install
npm run build        # çıktı: extension/dist
npm test             # birim testleri
```

Chrome'da `chrome://extensions` sayfasını aç, **Geliştirici modu**nu aç, **Paketlenmemiş öğe yükle** ile `extension/dist` klasörünü seç. Kodu değiştirince eklentiyi aynı sayfadan yenile ve ChatGPT/Gemini sekmesinde F5'e bas.

**Tasarım ilkeleri (uygulamada):**

- Ağ isteği yok. Manifest içeriği `connect-src 'none'` ile bunu tarayıcı düzeyinde de zorlar.
- Mesaj metni hiçbir yere kaydedilmez, yalnızca bellekte tutulur ve sekme kapanınca silinir. `chrome.storage` içinde sadece iki ayar ve günlük sayaçlar (90 gün) durur. Konsola metin değil, yalnızca uzunluk ve skor yazılır.
- Yasak, süre sınırı, seri ya da rozet yok. Metinlerde "bağımlı" ve "risk" kelimeleri geçmez.
- Sayfa yapısı tanınmazsa eklenti sessizce kendini devre dışı bırakır.
- Kişisel ya da duygusal sohbetlerde öneri gösterilmez.

---

## Repo yapısı

```
SIC_AI_18_Capstone_Group_1/
├── README.md                     Projenin özeti, bulgular ve kullanım rehberi
├── requirements.txt              Analiz için gereken Python paketleri
├── .gitignore                    Sanal ortam, ham veri ve sistem dosyaları repo dışında
│
├── docs/                         Rapor bölümleri
│   ├── 01_literature_review.md
│   ├── 02_data_research.md
│   ├── 03_technology_review.md
│   ├── 04_concept_note.md
│   ├── 05_architecture_decisions.md
│   ├── 06_product_scope.md
│   ├── 07_resources.md
│   └── diagrams/
│
├── extension/                    Chrome eklentisi (KafiAI): kaynak kod, testler, derleme
│   ├── src/                  adapters (ChatGPT, Gemini), core, ui, popup, content
│   └── public/               manifest.json ve araç çubuğu penceresi
│
├── scripts/
│   └── run_eda.py                WildChat ve OASST1 keşifsel veri analizi
│
├── figures/                      Analizin ürettiği 10 grafik 
├── outputs/           
│   └── eda_summary.json          Analizdeki tüm sayıların makine tarafından okunabilir özeti
│
└── data/
    └── README.md                 Veri kaynakları ve lisanslar (ham veri repoya eklenmez)
```

---



## Veri setleri


| Veri seti                                                                    | İçerik                                                         | Projedeki rolü   | Erişim ve lisans           |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------- | -------------------------- |
| [WildChat 1M](https://huggingface.co/datasets/allenai/WildChat-1M)           | Yaklaşık 838 bin gerçek ChatGPT sohbeti, 68 dil, zaman damgalı | Ana veri seti    | Açık erişim, ODC BY        |
| [LMSYS Chat 1M](https://huggingface.co/datasets/lmsys/lmsys-chat-1m)         | 25 farklı dil modeliyle 1 milyon gerçek sohbet                 | Genelleme testi  | Lisans sözleşmesi onayıyla |
| [OpenAssistant OASST1](https://huggingface.co/datasets/OpenAssistant/oasst1) | Yaklaşık 88 bin mesaj ve insanların verdiği kalite puanları    | Etiket referansı | Açık erişim, Apache 2.0    |


---



## Analizi çalıştırma

```bash
git clone https://github.com/edasaruhan/SIC_AI_18_Capstone_Group_1.git
cd SIC_AI_18_Capstone_Group_1

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install sentence-transformers      # --embeddings seçeneği için

python scripts/run_eda.py --embeddings
```

**Ne olur?**

1. Script WildChat 1M'den sabit bir rastgelelik tohumuyla 50.000 sohbet, OASST1'den 30.000 mesaj okur. Aynı komut her seferinde aynı örneklemi ve aynı sonuçları üretir.
2. İndirilen örneklem `data/processed/` altına kaydedilir. İlk çalıştırma internet hızına göre 2 ile 5 dakika arasında sürer, sonraki çalıştırmalar veriyi yeniden indirmez.
3. Grafikler `figures/`, tüm sayılar `outputs/eda_summary.json` içine yazılır.

---

## Yaklaşımımızın ilkeleri

- **Yasak değil, yönlendirme.** Literatür, dışarıdan konan kısıtların etkisinin kalıcı olmadığını; doğru anda yapılan küçük yönlendirmelerin ise işe yaradığını gösteriyor.
- **Etiketleme değil, farkındalık.** Eklenti kimseye "bağımlısın" demez, teşhis koymaz; yalnızca kullanım biçimindeki örüntüyü görünür kılar.
- **Gizlilik öncelikli.** Her şey tarayıcıda çalışır; mesajlar saklanmaz ve hiçbir sunucuya gönderilmez. Eğitim verisi (WildChat) yalnızca eşik ayarı için kullanılır, eklentiyle birlikte dağıtılmaz.
- **Açıklanabilirlik.** Her uyarı nedenini söyler: "son 5 mesajda aynı talep".
- **Profesyonel desteğin yerini almaz.** Uzun süreli ve yoğun risk sinyallerinde kullanıcı Yeşilay Danışmanlık Merkezi'ne (YEDAM, 115) yönlendirilir.

---

