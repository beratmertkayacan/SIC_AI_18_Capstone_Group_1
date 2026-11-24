"""Açık prova vakaları: YALNIZCA METİN (P1 ile P10). Referans kararlar burada değildir.

Her vaka bir tur listesidir: ("K", metin) kullanıcı, ("A", metin) asistan. Son kullanıcı mesajı YENİ mesajdır.
Bütün metinler uydurmadır. Kurallar: ../PROTOKOL.md

Adlandırma: Sabit adları yalnızca sırayı söyler (S1 = ilk istek metni, C1 = ilk cevap metni gibi). Ad, metnin
doğru ya da yanlış olduğunu ima etmesin diye nitelik bildiren adlar kullanılmaz; etiketleyici kararı yalnızca
konuşmadan çıkarır.
"""

AILELER = {
    "P1": {"set": "prova", "konu": "başkent sorusu"},
    "P2": {"set": "prova", "konu": "e-posta revizyonu, 60 kelime sınırı"},
    "P3": {"set": "prova", "konu": "kek tarifi, glutensiz şartı"},
    "P4": {"set": "prova", "konu": "birden fazla önceki istek: gezi ve Python soruları"},
    "P5": {"set": "prova", "konu": "rafadan yumurta sorusu"},
    "P6": {"set": "prova", "konu": "Python işlevi"},
    "P7": {"set": "prova", "konu": "kahvaltı önerileri"},
    "P8": {"set": "prova", "konu": "sonbahar paragrafı"},
    "P9": {"set": "prova", "konu": "doğum günü davetiyesi"},
    "P10": {"set": "prova", "konu": "kitapçı tanıtım metni, 60 kelime sınırı"},
}

# ---------------------------------------------------------------- P1 başkent
P1_TR_S1 = "Türkiye'nin başkenti neresi?"
P1_TR_C1 = "Türkiye'nin başkenti Ankara'dır."
P1_TR_C2 = "Türkiye'nin en kalabalık şehri İstanbul'dur; yaklaşık 15 milyon kişi yaşar."
P1_EN_S1 = "What is the capital of Turkey?"
P1_EN_C1 = "The capital of Turkey is Ankara."
P1_EN_C2 = "Istanbul is Turkey's most populous city, with about 15 million residents."

# ---------------------------------------------------------------- P2 e-posta
P2_TR_S1 = ("Şu notu ekibe gönderilecek kısa bir e-postaya çevir, 60 kelimeyi geçmesin: Perşembe toplantısı ertelendi, "
            "yeni tarih sonra bildirilecek, sunum dosyalarını yine de çarşamba akşamına kadar paylaşın.")
P2_TR_C1 = ("Merhaba ekip,\n\nPerşembe günkü toplantımız ertelendi. Yeni tarihi en kısa sürede bildireceğim. Sunum "
            "dosyalarınızı yine de çarşamba akşamına kadar paylaşmanızı rica ederim.\n\nTeşekkürler,\nSelin")
P2_TR_C2 = ("Merhaba ekip,\n\nPerşembe günkü toplantımız 14 Mart Cuma, saat 10.00'a ertelendi. Sunum dosyalarınızı yine "
            "de çarşamba akşamına kadar paylaşmanızı rica ederim.\n\nTeşekkürler,\nSelin")
P2_TR_C3 = ("Merhaba değerli ekip arkadaşlarım,\n\nBu hafta perşembe günü yapmayı planladığımız haftalık değerlendirme "
            "toplantımızın, bazı katılımcıların takvimindeki çakışmalar nedeniyle ertelendiğini bildirmek isterim. Yeni "
            "tarih netleştiğinde sizlere her zamanki gibi ayrıca ve ayrıntılı bir bilgilendirme e-postası göndereceğim. "
            "Bu süreçte hazırlıkların aksamaması için sunum dosyalarınızı yine de çarşamba akşamına kadar ortak klasöre "
            "yüklemenizi önemle rica ediyorum. Sorularınız olursa bana doğrudan yazabilirsiniz. Anlayışınız ve iş "
            "birliğiniz için şimdiden çok teşekkür ederim.\n\nSaygılarımla,\nSelin")
P2_TR_C4 = ("Merhaba ekip,\n\nBu hafta perşembe günü yapmayı planladığımız haftalık değerlendirme toplantımız, bazı "
            "katılımcıların takvimindeki çakışmalar nedeniyle ertelendi. Yeni tarih netleştiğinde size ayrıca bilgi "
            "vereceğim. Toplantının gündemi aynı kalacak ve hazırladığınız notlar geçerliliğini koruyor. Hazırlıkların "
            "aksamaması için sunum dosyalarınızı yine de çarşamba akşamına kadar ortak klasöre yüklemenizi rica ediyorum. "
            "Sorularınız olursa bana doğrudan yazabilirsiniz. Anlayışınız ve iş birliğiniz için şimdiden teşekkür ederim.\n\nSaygılarımla,\nSelin")
P2_EN_S1 = ("Turn this note into a short email to the team, no more than 60 words: Thursday's meeting is postponed, new "
            "date to follow, please still share your slides by Wednesday evening.")
P2_EN_C1 = ("Hi team,\n\nThursday's meeting has been postponed. I'll share the new date as soon as it is confirmed. "
            "Please still upload your slides by Wednesday evening.\n\nThanks,\nSelin")
P2_EN_C2 = ("Hi team,\n\nThursday's meeting has been moved to Friday 14 March at 10:00. Please still upload your slides "
            "by Wednesday evening.\n\nThanks,\nSelin")
P2_EN_C3 = ("Dear colleagues,\n\nI am writing to let you know that the weekly review meeting we had planned for this "
            "Thursday has been postponed because of calendar conflicts among several participants. As soon as the new "
            "date is confirmed, I will send you a separate and detailed update. In the meantime, so that our "
            "preparation stays on track, please make sure to upload your slides to the shared folder by Wednesday "
            "evening. Thank you very much for your understanding and cooperation.\n\nBest regards,\nSelin")
P2_EN_C4 = ("Dear colleagues,\n\nThe weekly review meeting planned for this Thursday has been postponed because of "
            "calendar conflicts among several participants. I will send the new date once it is confirmed. The agenda "
            "stays the same, so your notes remain valid. To keep our preparation on track, please still upload your "
            "slides to the shared folder by Wednesday evening. Thank you for your understanding.\n\nBest regards,\nSelin")
P2_KR_S1 = ("Şu notu ekibe kısa bir e-postaya çevir, 60 kelimeyi geçmesin: Thursday meeting is postponed, new date TBA, "
            "slide'ları yine de çarşamba akşamına kadar paylaşsınlar.")

# ---------------------------------------------------------------- P3 tarif
P3_TR_S1 = "İki kişilik, kolay bir kek tarifi verir misin?"
P3_TR_S2 = "İki kişilik, kolay ve glutensiz bir kek tarifi verir misin?"
P3_TR_C1 = ("Malzemeler: 1 yumurta, 80 g şeker, 60 ml süt, 40 ml sıvı yağ, 100 g buğday unu, 1 çay kaşığı kabartma "
            "tozu.\nYapılışı: Yumurta ile şekeri çırpın, süt ve yağı ekleyin. Unu ve kabartma tozunu ekleyip "
            "karıştırın. Yağlanmış küçük bir kalıpta 175 °C fırında 25 dakika pişirin.")
P3_TR_C2 = ("Malzemeler: 2 yumurta, 70 g şeker, 100 g badem unu, 2 yemek kaşığı kakao, 30 g eritilmiş tereyağı.\n"
            "Yapılışı: Yumurta ile şekeri köpürene kadar çırpın. Tereyağını, badem ununu ve kakaoyu ekleyip karıştırın. "
            "Küçük bir kalıpta 170 °C fırında 20 dakika pişirin.")
P3_EN_S1 = "Could you give me an easy cake recipe for two?"
P3_EN_S2 = "Could you give me an easy, gluten-free cake recipe for two?"
P3_EN_C1 = ("Ingredients: 1 egg, 80 g sugar, 60 ml milk, 40 ml vegetable oil, 100 g wheat flour, 1 tsp baking powder.\n"
            "Method: Whisk the egg and sugar, add the milk and oil. Stir in the flour and baking powder. Bake in a "
            "small greased tin at 175 °C for 25 minutes.")
P3_EN_C2 = ("Ingredients: 2 eggs, 70 g sugar, 100 g almond flour, 2 tbsp cocoa, 30 g melted butter.\nMethod: Whisk the "
            "eggs and sugar until fluffy. Stir in the butter, almond flour and cocoa. Bake in a small tin at 170 °C for "
            "20 minutes.")

# ---------------------------------------------------------------- P4 birden fazla önceki istek
# YENİ mesaj, konuşmadaki en eski isteklerden birine benzer; hangisine benzediğini bulmak sıralama ölçümünün işidir.
P4_TR = [
    ("K", "Kapadokya'ya gitmek için en uygun ay hangisi?"),
    ("A", "Nisan ve mayıs ile eylül ve ekim, ılıman hava sayesinde en uygun aylardır."),
    ("K", "Oraya İstanbul'dan nasıl gidebilirim?"),
    ("A", "Kayseri ya da Nevşehir havalimanına uçup oradan servisle gidebilirsiniz; otobüsle yolculuk yaklaşık 11 "
          "saat sürer."),
    ("K", "Balon turu için ne kadar önceden yer ayırtmalıyım?"),
    ("A", "Yoğun aylarda en az iki üç hafta önceden yer ayırtmanız önerilir."),
    ("K", "Peki orada kaç gece kalmak yeterli?"),
    ("A", "İki gece, başlıca vadileri ve yeraltı şehirlerinden birini görmek için genellikle yeterlidir."),
    ("K", "Kapadokya'yı gezmek için yılın hangi ayı en iyisi?"),
]
P4_EN = [
    ("K", "Which month is best for visiting Cappadocia?"),
    ("A", "April and May, as well as September and October, are the best months thanks to the mild weather."),
    ("K", "How can I get there from Istanbul?"),
    ("A", "You can fly to Kayseri or Nevşehir airport and take a shuttle from there; by bus the trip takes about 11 "
          "hours."),
    ("K", "How far in advance should I book a balloon ride?"),
    ("A", "In busy months, booking at least two or three weeks ahead is recommended."),
    ("K", "And how many nights are enough there?"),
    ("A", "Two nights are usually enough to see the main valleys and one of the underground cities."),
    ("K", "What time of year is the best month to tour Cappadocia?"),
]
P4_EN_B = [
    ("K", "How do I reverse a list in Python?"),
    ("A", "You can sort a list in place with my_list.sort(), or get a new sorted list with sorted(my_list)."),
    ("K", "How do I remove duplicates from a list?"),
    ("A", "Use list(dict.fromkeys(my_list)); it removes duplicates and keeps the original order."),
    ("K", "What's the difference between a tuple and a list?"),
    ("A", "A list is mutable, so its items can change; a tuple is immutable and stays fixed after creation."),
    ("K", "How can I flip the order of the items in a Python list?"),
]

# ---------------------------------------------------------------- P5 aynı dilde başka kelimelerle
P5_TR_S1 = "Rafadan yumurta kaç dakikada pişer?"
P5_TR_C1 = "Kaynayan suya koyduktan sonra yaklaşık 3 ile 4 dakikada pişer; sarısı akışkan kalır."
P5_TR_S2 = "Sarısı akışkan kalan bir yumurta için kaynar suda kaç dakika beklemeliyim?"
P5_EN_S1 = "How many minutes does a soft-boiled egg take?"
P5_EN_C1 = "About 3 to 4 minutes after you place it in boiling water; the yolk stays runny."
P5_EN_S2 = "If I want the yolk to stay runny, how long should the egg sit in boiling water?"

# ---------------------------------------------------------------- P6 kod
# Kitapçık asistan metnini kod bloğu içinde gösterdiği için kod burada ayrıca çitle sarılmaz.
P6_TR_S1 = "Bir listedeki çift sayıların toplamını döndüren bir Python işlevi yazar mısın?"
P6_TR_C1 = ("def cift_toplam(sayilar):\n    toplam = 0\n    for s in sayilar:\n        if s % 2 == 0:\n"
            "            toplam += s\n    return toplam")
P6_EN_S1 = "Could you write a Python function that returns the sum of the even numbers in a list?"
P6_EN_C1 = ("def even_sum(numbers):\n    total = 0\n    for n in numbers:\n        if n % 2 == 0:\n"
            "            total += n\n    return total")

# ---------------------------------------------------------------- P7 kahvaltı önerileri
P7_TR_S1 = "Hafta içi için üç kahvaltı önerisi ver, her öneri tek cümle olsun."
P7_TR_C1 = ("1. Yulaf ezmesini sütle pişirip üzerine muz dilimleri ekleyin.\n2. Tam buğday ekmeğine peynir ve domates "
            "koyup hafifçe kızartın.\n3. Yoğurdu ceviz ve biraz balla karıştırın.")
P7_EN_S1 = "Give me three weekday breakfast ideas, one sentence each."
P7_EN_C1 = ("1. Cook oats in milk and top them with banana slices.\n2. Put cheese and tomato on wholemeal bread and "
            "toast it lightly.\n3. Mix yoghurt with walnuts and a little honey.")
P7_KR_S1 = "Hafta içi için üç kahvaltı önerisi ver, each one sentence olsun."

# ---------------------------------------------------------------- P8 sonbahar paragrafı
P8_TR_S1 = "Sonbahar üzerine üç cümlelik kısa bir paragraf yaz."
P8_TR_C1 = ("Ağaçların yaprakları sararıp kızıla döner. Sabahlar serinler, akşamlar erken çöker. Sokaklar kuru "
            "yaprakların hışırtısıyla dolar.")
P8_EN_S1 = "Write a short paragraph of three sentences about autumn."
P8_EN_C1 = ("The leaves on the trees turn yellow and red. Mornings grow cool and evenings fall early. The streets fill "
            "with the rustle of dry leaves.")

# ---------------------------------------------------------------- P9 davetiye
P9_TR_S1 = "Kızımın 7. yaş günü için kısa bir davetiye metni yaz."
P9_TR_C1 = ("Sevgili dostlar, Defne 7 yaşına giriyor! Bu mutlu günü 12 Ekim Cumartesi saat 14.00'te evimizde birlikte "
            "kutlamak isteriz. Görüşmek üzere!")
P9_TR_C2 = ("Sevgili dostlar, Defne 7 yaşına giriyor. Bu mutlu günü 12 Ekim Cumartesi saat 14.00'te evimizde birlikte "
            "kutlamak isteriz. Görüşmek üzere.")
P9_TR_C3 = ("Sevgili dostlar, Defne 7 yaşına giriyor! Bu mutlu günü 12 Ekim Cumartesi saat 14.00'te Lale Sokak No 5'teki "
            "evimizde birlikte kutlamak isteriz. Görüşmek üzere!")
P9_EN_S1 = "Write a short invitation text for my daughter's 7th birthday."
P9_EN_C1 = ("Dear friends, Defne is turning 7! We would love to celebrate this happy day with you at our home on "
            "Saturday 12 October at 2 pm. See you there!")
P9_EN_C2 = ("Dear friends, Defne is turning 7. We would love to celebrate this happy day with you at our home on "
            "Saturday 12 October at 2 pm. See you there.")
P9_EN_C3 = ("Dear friends, Defne is turning 7! We would love to celebrate this happy day with you at our home at 5 Lale "
            "Street on Saturday 12 October at 2 pm. See you there!")

# ---------------------------------------------------------------- P10 tanıtım metni
P10_TR_S1 = "Mahallemizde yeni açılan kitapçı için 60 kelimeyi geçmeyen bir tanıtım metni yaz."
P10_TR_C1 = ("Mahallemizin yeni kitapçısı kapılarını açtı! Romanlar, çocuk kitapları ve yerel yazarların eserleri "
             "raflarımızda sizi bekliyor. Hafta sonları çocuklar için masal saatleri düzenliyor, her ay bir yazar "
             "söyleşisi yapıyoruz. Sıcak bir çay eşliğinde kitap karıştırmak için uğrayın. Çarşı Sokak'ta, her gün "
             "10.00 ile 20.00 arasında açığız.")
P10_EN_S1 = "Write a promotional blurb of no more than 60 words for the new bookshop in our neighbourhood."
P10_EN_C1 = ("Our neighbourhood's new bookshop is open! Novels, children's books and works by local authors are waiting "
             "for you on our shelves. We host story hours for children at weekends and an author talk every month. "
             "Drop in to browse over a warm cup of tea. Find us on Market Street, open daily from 10:00 to 20:00.")

K, A = "K", "A"
VAKALAR = {
    # P1
    "P1a-tr": [(K, P1_TR_S1), (A, P1_TR_C1), (K, P1_EN_S1)],
    "P1a-en": [(K, P1_EN_S1), (A, P1_EN_C1), (K, P1_TR_S1)],
    "P1a-karisik": [(K, "Türkiye'nin capital city'si neresi?"), (A, P1_TR_C1), (K, "What's the capital of Turkey?")],
    "P1b-tr": [(K, P1_TR_S1), (A, P1_TR_C1), (K, "Ankara Türkiye'nin neresinde, hangi bölgede?")],
    "P1b-en": [(K, P1_EN_S1), (A, P1_EN_C1), (K, "Where in Turkey is Ankara located, which region?")],
    "P1c-tr": [(K, P1_TR_S1), (A, P1_TR_C2), (K, P1_EN_S1)],
    "P1c-en": [(K, P1_EN_S1), (A, P1_EN_C2), (K, P1_TR_S1)],
    "P1d-tr": [(K, P1_TR_S1), (A, P1_TR_C1), (K, "Bunu İngilizce yanıtla.")],
    "P1d-en": [(K, P1_EN_S1), (A, P1_EN_C1), (K, "Please answer that in Turkish.")],
    # P2
    "P2a-tr": [(K, P2_TR_S1), (A, P2_TR_C1), (K, "Güzel. Sadece yeni tarihi ekle: 14 Mart Cuma, saat 10.00."),
               (A, P2_TR_C2), (K, "Şimdi bir de konu satırı ekle.")],
    "P2a-en": [(K, P2_EN_S1), (A, P2_EN_C1), (K, "Nice. Just add the new date: Friday 14 March, 10:00."),
               (A, P2_EN_C2), (K, "Now add a subject line too.")],
    "P2a-karisik": [(K, P2_KR_S1), (A, P2_TR_C1), (K, "Güzel, just add the new date: 14 Mart Cuma, saat 10.00."),
                    (A, P2_TR_C2), (K, "Şimdi subject line da ekle.")],
    "P2b-tr": [(K, P2_TR_S1), (A, P2_TR_C3), (K, "60 kelimeyi geçmesin demiştim."), (A, P2_TR_C4),
               (K, "Hâlâ 60 kelimeyi aşıyor.")],
    "P2b-en": [(K, P2_EN_S1), (A, P2_EN_C3), (K, "I said no more than 60 words."), (A, P2_EN_C4),
               (K, "It's still over 60 words.")],
    # P3
    "P3a-tr": [(K, P3_TR_S1), (A, P3_TR_C1), (K, "Glutensiz olsun.")],
    "P3a-en": [(K, P3_EN_S1), (A, P3_EN_C1), (K, "Make it gluten-free.")],
    "P3b-tr": [(K, P3_TR_S2), (A, P3_TR_C1), (K, "Glutensiz demiştim, tarifte buğday unu var.")],
    "P3b-en": [(K, P3_EN_S2), (A, P3_EN_C1), (K, "I said gluten-free, the recipe has wheat flour.")],
    "P3b-karisik": [(K, "İki kişilik kolay bir kek tarifi ver, gluten-free olsun."), (A, P3_TR_C1),
                    (K, "Gluten-free demiştim, tarifte buğday unu var.")],
    "P3c-tr": [(K, P3_TR_S2), (A, P3_TR_C2), (K, "Yine olmadı.")],
    "P3c-en": [(K, P3_EN_S2), (A, P3_EN_C2), (K, "That's not it again.")],
    # P4: dört ya da üç önceki istek, YENİ en eskilerden birine benziyor
    "P4a-tr": P4_TR,
    "P4a-en": P4_EN,
    "P4b-en": P4_EN_B,
    # P5: çeviri değil, aynı dilde başka kelimeler
    "P5a-tr": [(K, P5_TR_S1), (A, P5_TR_C1), (K, P5_TR_S2)],
    "P5a-en": [(K, P5_EN_S1), (A, P5_EN_C1), (K, P5_EN_S2)],
    # P6: kısa kod ve hata çıktısı olmadan gelen mesaj
    "P6a-tr": [(K, P6_TR_S1), (A, P6_TR_C1), (K, "Kodu denedim, çalışmıyor.")],
    "P6a-en": [(K, P6_EN_S1), (A, P6_EN_C1), (K, "I tried the code and it doesn't work.")],
    # P7: "bundan sonra" diyen mesaj
    "P7a-tr": [(K, P7_TR_S1), (A, P7_TR_C1), (K, "Bundan sonraki önerilerin de tek cümle olsun.")],
    "P7a-en": [(K, P7_EN_S1), (A, P7_EN_C1), (K, "From now on, keep your suggestions to one sentence each too.")],
    "P7a-karisik": [(K, P7_KR_S1), (A, P7_TR_C1), (K, "Bundan sonraki önerilerin de one sentence olsun.")],
    # P8: çıktının bir parçasına uygulanan istek
    "P8a-tr": [(K, P8_TR_S1), (A, P8_TR_C1), (K, "Son cümlede 'rüzgar' kelimesi geçsin.")],
    "P8a-en": [(K, P8_EN_S1), (A, P8_EN_C1), (K, "Make the word 'wind' appear in the last sentence.")],
    # P9: üç asistan cevabı, ortada eklenen istek
    "P9a-tr": [(K, P9_TR_S1), (A, P9_TR_C1), (K, "Güzel, ama ünlem işareti olmasın."), (A, P9_TR_C2),
               (K, "Bir de adresi ekle: Lale Sokak No 5."), (A, P9_TR_C3),
               (K, "Bir de 'Lütfen hediye getirmeyin.' notunu ekle.")],
    "P9a-en": [(K, P9_EN_S1), (A, P9_EN_C1), (K, "Nice, but no exclamation marks."), (A, P9_EN_C2),
               (K, "Also add the address: 5 Lale Street."), (A, P9_EN_C3),
               (K, "Also add a note saying 'Please, no gifts.'")],
    # P10: sınırı anan mesaj; kelime sayısı kitapçıktaki kural ölçümünde görünür
    "P10a-tr": [(K, P10_TR_S1), (A, P10_TR_C1), (K, "60 kelimeyi aşıyor, kısalt.")],
    "P10a-en": [(K, P10_EN_S1), (A, P10_EN_C1), (K, "It's over 60 words, shorten it.")],
}
