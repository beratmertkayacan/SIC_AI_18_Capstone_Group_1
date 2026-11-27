# Kör etiket provası (protokol sürümü 0.3, paylaşılabilir)

Bu klasör ürün kodu değildir ve model çalıştırmaz. Gerçek sohbet metni, kapalı kıyas vakaları, referans kararlar ya da inceleme çıktıları **içermez**.

| Dosya | Ne | Kim kullanır |
|---|---|---|
| `PROTOKOL.md` | Etiket kuralları (v0.3) | Herkes |
| `sentetik/vakalar_prova.py` | 37 açık prova vakasının metni (P1 ile P10 aileleri); sabit adları yalnızca sıra bildirir | Üretici |
| `sentetik/olcum.py` | Kural ölçümü: kelime (ürünün `count_words` işlevi) ve dolu satır | Üretici |
| `sentetik/formlar_uret.py` | Kitapçığı ve boş formları üretir; protokol sürümü burada tek yerde (`PROTOKOL_SURUMU`) tutulur; vaka sırasını sabit tohumla karıştırır ve opak kod verir | Hazırlayan |
| `sentetik/cikti/kitapcik_prova.md` | Prova kitapçığı (opak vaka kodları; konuşma ve kural ölçümü ayrı bloklarda) | Etiketleyici A ve B |
| `sentetik/cikti/etiket_formu_prova_A.csv` / `_B.csv` | Boş formlar; `protokol_surumu` sütunu dolu gelir | Her kişi yalnızca kendi formunu |
| `eslem_v03.json` (**repo dışında**) | Opak kod ile vaka kimliği eşlemesi; `formlar_uret.py --eslem` ile yazılır, repo içine yazılamaz | Yalnızca hazırlayan, uzlaşmadan sonra |
| `gercek_kor/kor_etiket.py` | Gerçek veri kör provası: mesajlar yalnızca terminalde gösterilir, dosyaya yalnızca opak kod ve kararlar yazılır | Etiketleyici A ve B (ayrı onayla) |

Repoda olmayanlar:
- Prova vakalarının referans kararları,
- opak kod ile vaka kimliği eşlemesi,
- denetlenmiş sentetik kıyas seti (kapalı vakalar),
- gözden geçirme formları,
- inceleme çıktıları.

Bunlar repo dışındaki ayrı bir klasörde tutulur. Kıyas seti **nihai bağımsız test değildir** (bkz. `PROTOKOL.md` §8).

## Sıra

1. A ve B, `kitapcik_prova.md` vakalarını kendi formlarına bağımsız etiketler. Birbirlerinin formunu uzlaşmadan önce görmezler.
2. Uyum, uzlaşmadan önce alan alan raporlanır. Prova kararları kıyas setine ya da model seçimine girmez.
3. Gerçek veri provası ayrı onayla yapılır: önce `kor_etiket.py kontrol`, sonra her kişi `kor_etiket.py etiketle --etiketleyici A|B`.

Formları yeniden üretmek için (repo kökünden; eşleme yolu repo dışında olmalı):

```
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python prova/sentetik/formlar_uret.py --eslem /repo/disi/klasor/eslem_v03.json
```

`--eslem` verilmezse eşleme hiçbir yere yazılmaz; aynı tohumla yeniden çalıştırmak aynı kodları verir.
