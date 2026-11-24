# Kör etiket provası (sürüm 0.2, paylaşılabilir)

Bu klasör ürün kodu değildir ve model çalıştırmaz. Gerçek sohbet metni, kapalı kıyas vakaları, cevap anahtarı ya da inceleme çıktıları **içermez**.

| Dosya | Ne | Kim kullanır |
|---|---|---|
| `PROTOKOL.md` | Etiket kuralları (v0.2) | Herkes |
| `sentetik/vakalar_prova.py` | 21 açık prova vakasının metni (P1–P3) | Üretici |
| `sentetik/olcum.py` | Kural ölçümü: kelime (ürünün `count_words` işlevi) ve dolu satır | Üretici |
| `sentetik/formlar_uret.py` | Kitapçığı ve boş formları üretir; anahtar kullanmaz | Hazırlayan |
| `sentetik/cikti/kitapcik_prova.md` | Prova kitapçığı (konuşma ve kural ölçümü ayrı bloklarda) | Etiketleyici A ve B |
| `sentetik/cikti/etiket_formu_prova_A.csv` / `_B.csv` | Boş formlar | Her kişi yalnızca kendi formunu |
| `gercek_kor/kor_etiket.py` | Gerçek veri kör provası: mesajlar yalnızca terminalde gösterilir, dosyaya yalnızca opak kod ve kararlar yazılır | Etiketleyici A ve B (ayrı onayla) |

Repoda olmayanlar:
- Prova vakalarının beklenen kararları,
- denetlenmiş sentetik kıyas seti (kapalı vakalar),
- gözden geçirme formları,
- inceleme çıktıları.

Bunlar repo dışındaki ayrı bir klasörde tutulur. Kıyas seti **nihai bağımsız test değildir** (bkz. `PROTOKOL.md` §8).

## Sıra

1. A ve B, `kitapcik_prova.md` vakalarını kendi formlarına bağımsız etiketler. Birbirlerinin formunu uzlaşmadan önce görmezler.
2. Uyum, uzlaşmadan önce alan alan raporlanır. Prova kararları kıyas setine ya da model seçimine girmez.
3. Gerçek veri provası ayrı onayla yapılır: önce `kor_etiket.py kontrol`, sonra her kişi `kor_etiket.py etiketle --etiketleyici A|B`.

Formları yeniden üretmek için (repo kökünden): `.venv/bin/python prova/sentetik/formlar_uret.py`
