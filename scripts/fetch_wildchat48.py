"""WildChat 4.8M sürümünden zamana yayılmış bir örneklem indirir.

WildChat 4.8M, 1M sürümünün devamıdır: Nisan 2023 ile Temmuz 2025 arasındaki yaklaşık
3,2 milyon sohbet, GPT-4o ve o1 gibi daha yeni modeller ve çok daha fazla Türkçe sohbet.
Tamamı 15 GB olduğu için hepsini indirmiyoruz. Veri 86 parça dosyaya bölünmüş ve parçalar
zamana göre sıralı; baştan sona eşit aralıklı 10 parça seçip her birinden aynı sayıda sohbeti
rastgele alıyoruz. Böylece örneklem iki yılın tamamını kapsıyor.

Çıktılar (repoya eklenmez, data/processed altında durur):
    data/processed/wildchat48_sample.parquet    rastgele örneklem (varsayılan 150.000 sohbet)
    data/processed/wildchat48_turkish.parquet   seçilen parçalardaki tüm Türkçe sohbetler
    data/processed/wildchat48_multiturn.parquet seçilen parçalardaki en az 4 turlu tüm sohbetler

Rastgele örneklem keşif analizi içindir ve verinin genelini temsil eder. Model ise yalnızca en az
4 turlu sohbetlerle eğitilebildiği için (bkz. config.MIN_TURNS_FOR_LABEL) bu sohbetler ayrıca
eksiksiz alınır. Parça dosyalar bir kez indirildikten sonra önbellekte durur; script'i yeniden
çalıştırmak tekrar indirme yapmaz.

Çalıştırma (repo kök klasöründe, internet gerekir, yaklaşık 2 GB indirir):
    pip install huggingface_hub pyarrow
    python scripts/fetch_wildchat48.py
    python scripts/fetch_wildchat48.py --shards 4 --n-sample 40000   # hızlı deneme
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from kafiai.config import MIN_TURNS_FOR_LABEL, SEED  # noqa: E402

REPO_ID = "allenai/WildChat-4.8M"
N_SHARDS_TOTAL = 86
OUT_DIR = ROOT / "data" / "processed"
COLUMNS = ["conversation_hash", "timestamp", "model", "turn", "language", "country",
           "hashed_ip", "toxic", "redacted", "conversation"]

# Kullanıcı mesajları bu uzunlukta kesilir. Modelin öznitelikleri zaten ilk 1.000 karaktere
# bakıyor (config.MAX_CHARS); sınır, dosya boyutunu makul tutmak için.
KEEP_CHARS = 2000


def shard_indices(n):
    """0 ile 85 arasında eşit aralıklı n parça numarası."""
    return sorted(set(np.linspace(0, N_SHARDS_TOTAL - 1, n).round().astype(int).tolist()))


def extract(row):
    """Ham sohbet satırını analizde kullandığımız sade biçime çevirir (run_eda.py ile aynı alanlar)."""
    conv = row["conversation"] or []
    users = [(t.get("content") or "")[:KEEP_CHARS] for t in conv if t.get("role") == "user"]
    assistant_chars = sum(len(t.get("content") or "") for t in conv if t.get("role") == "assistant")
    return {
        "conversation_hash": row["conversation_hash"],
        "timestamp": row["timestamp"],
        "model": row["model"],
        "turn": row["turn"],
        "language": row["language"],
        "country": row["country"],
        "hashed_ip": row["hashed_ip"],
        "toxic": row["toxic"],
        "redacted": row["redacted"],
        "user_msgs": users,
        "n_user_msgs": len(users),
        "first_prompt": users[0] if users else "",
        "first_prompt_chars": len(users[0]) if users else 0,
        "assistant_chars": assistant_chars,
    }


def main():
    parser = argparse.ArgumentParser(description="WildChat 4.8M örneklemi indir")
    parser.add_argument("--shards", type=int, default=10, help="kaç parça dosya indirilecek (en çok 86)")
    parser.add_argument("--n-sample", type=int, default=150_000, help="toplam örneklem büyüklüğü")
    args = parser.parse_args()

    from huggingface_hub import hf_hub_download

    shards = shard_indices(min(args.shards, N_SHARDS_TOTAL))
    per_shard = args.n_sample // len(shards)
    rng = np.random.default_rng(SEED)
    sample_parts, turkish_parts, multi_parts = [], [], []

    for i, shard in enumerate(shards, 1):
        name = f"data/train-{shard:05d}-of-{N_SHARDS_TOTAL:05d}.parquet"
        print(f"[{i}/{len(shards)}] {name} indiriliyor")
        path = hf_hub_download(REPO_ID, name, repo_type="dataset")
        table = pq.read_table(path, columns=COLUMNS)

        # Rastgele seçilen satırlar ve Türkçe satırlar ayrı ayrı çıkarılır.
        n = table.num_rows
        picked = np.sort(rng.choice(n, size=min(per_shard, n), replace=False))
        languages = table.column("language").to_pylist()
        turkish = [j for j, lang in enumerate(languages) if lang == "Turkish"]
        turns = table.column("turn").to_pylist()
        multi = [j for j, t in enumerate(turns) if t >= MIN_TURNS_FOR_LABEL]

        sample_parts.append(pd.DataFrame([extract(r) for r in table.take(picked).to_pylist()]))
        if turkish:
            turkish_parts.append(pd.DataFrame([extract(r) for r in table.take(turkish).to_pylist()]))
        multi_parts.append(pd.DataFrame([extract(r) for r in table.take(multi).to_pylist()]))
        multi_parts[-1]["shard"] = shard
        print(f"    {n:,} sohbet, {len(picked):,} seçildi, {len(turkish):,} Türkçe, {len(multi):,} çok turlu")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sample = pd.concat(sample_parts, ignore_index=True)
    sample["shard"] = np.repeat(shards, [len(p) for p in sample_parts])
    sample.to_parquet(OUT_DIR / "wildchat48_sample.parquet", compression="zstd")

    turkish = pd.concat(turkish_parts, ignore_index=True) if turkish_parts else pd.DataFrame()
    turkish.to_parquet(OUT_DIR / "wildchat48_turkish.parquet", compression="zstd")

    multiturn = pd.concat(multi_parts, ignore_index=True)
    multiturn.to_parquet(OUT_DIR / "wildchat48_multiturn.parquet", compression="zstd")

    ts = pd.to_datetime(sample["timestamp"], utc=True)
    print(f"\nÖrneklem: {len(sample):,} sohbet, {sample['hashed_ip'].nunique():,} kullanıcı, "
          f"{ts.min().date()} ile {ts.max().date()} arası")
    print(f"Türkçe sohbet: {len(turkish):,}")
    print(f"En az {MIN_TURNS_FOR_LABEL} turlu sohbet: {len(multiturn):,}, {multiturn['hashed_ip'].nunique():,} kullanıcı")
    print(f"Yazıldı: {OUT_DIR.relative_to(ROOT)}/wildchat48_sample, _turkish ve _multiturn (.parquet)")


if __name__ == "__main__":
    main()
