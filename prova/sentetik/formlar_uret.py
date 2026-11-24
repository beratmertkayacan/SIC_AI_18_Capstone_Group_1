"""Açık prova kitapçığını ve boş A/B formlarını üretir. Referans kararları kullanmaz.

Kullanım (repo kökünden):
    PYTHONDONTWRITEBYTECODE=1 .venv/bin/python prova/sentetik/formlar_uret.py --eslem /repo/disi/klasor/eslem_v03.json

Kitapçık ve formlar vaka kimliği yerine opak kod (K01, K02 ...) gösterir. Opak kod ile vaka kimliği eşlemesi
yalnızca --eslem ile verilen dosyaya yazılır; bu yol repo içindeyse betik durur.
"""
import argparse
import csv
import json
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
from olcum import FORM_COLS, kitapcik_bolumu  # noqa: E402
from vakalar_prova import VAKALAR  # noqa: E402

# Sürüm tek yerde tutulur; kitapçık başlığı ve formlardaki sürüm sütunu buradan okur. Protokol değişince yalnızca
# bu satır değişir, böylece kitapçık ile form farklı sürüm yazamaz.
PROTOKOL_SURUMU = "0.3"
# Sabit tohum: aynı vaka listesi her çalıştırmada aynı sırayı ve aynı opak kodları verir.
TOHUM = 20261124
OUT = HERE / "cikti"


def grup(vid):
    # "P1a-tr" ile "P1a-en" aynı konuşmanın çevirileridir; dil son eki atılınca aynı grup kalır.
    return vid.split("-")[0]


def karistir(vids, rng):
    """Çeviri eşleri yan yana gelmeyene kadar karıştırır.

    Eşler art arda durursa etiketleyici birinin kararını ötekine kopyalayabilir; bu da bağımsız etiketlemeyi bozar.
    Aynı rng kullanıldığı için sonuç tohuma bağlıdır ve her çalıştırmada aynıdır.
    """
    vids = list(vids)
    for _ in range(10000):
        rng.shuffle(vids)
        if all(grup(a) != grup(b) for a, b in zip(vids, vids[1:])):
            return vids
    raise SystemExit("Çeviri eşlerini ayıran bir sıra bulunamadı.")


def repo_icinde_mi(path):
    p = path.resolve()
    return p == REPO or REPO in p.parents


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--eslem", type=Path, default=None,
                    help="Opak kod ile vaka kimliği eşlemesinin yazılacağı JSON yolu (repo dışında olmalı).")
    args = ap.parse_args()

    # Eşleme repo içine düşerse etiketleyici kodu vakaya ve aileye bağlayabilir; bu yüzden kesin olarak engellenir.
    if args.eslem is not None and repo_icinde_mi(args.eslem):
        raise SystemExit(f"Eşleme repo içine yazılamaz: {args.eslem}")

    order = karistir(VAKALAR, random.Random(TOHUM))
    kodlar = {vid: f"K{i:02d}" for i, vid in enumerate(order, start=1)}

    OUT.mkdir(exist_ok=True)
    md = [f"# Açık prova vakaları (protokol sürümü {PROTOKOL_SURUMU})", "",
          "Kurallar: ../../PROTOKOL.md. Her vakada YENİ mesaj değerlendirilir. Konuşma alıntısını yalnızca 'Konuşma' "
          "bölümünden alın; 'Kural ölçümü' bloğunu alıntılamayın, dayandıysanız `kural_olcumune_dayandi = evet` yazın. "
          "Vaka kodları opaktır; kodun sırası ya da numarası vaka hakkında bilgi vermez.", ""]
    for vid in order:
        md += kitapcik_bolumu(kodlar[vid], VAKALAR[vid])
    (OUT / "kitapcik_prova.md").write_text("\n".join(md), encoding="utf-8")

    # Sürüm sütunu, doldurulmuş bir formun hangi protokolle etiketlendiğini sonradan karıştırmamak için eklenir.
    cols = FORM_COLS[:2] + ["protokol_surumu"] + FORM_COLS[2:]
    for who in ("A", "B"):
        with open(OUT / f"etiket_formu_prova_{who}.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(cols)
            for vid in order:
                w.writerow([kodlar[vid], who, PROTOKOL_SURUMU] + [""] * (len(cols) - 3))

    if args.eslem is not None:
        args.eslem.parent.mkdir(parents=True, exist_ok=True)
        veri = {"protokol_surumu": PROTOKOL_SURUMU, "tohum": TOHUM,
                "eslem": {kodlar[vid]: vid for vid in order}}
        args.eslem.write_text(json.dumps(veri, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Eşleme yazıldı (repo dışı): {args.eslem}")
    else:
        print("Eşleme yazılmadı (--eslem verilmedi). Aynı tohumla yeniden çalıştırınca aynı kodlar çıkar.")
    print(f"{len(order)} prova vakası, protokol {PROTOKOL_SURUMU}: {OUT}")


if __name__ == "__main__":
    main()
