"""WildFeedback'teki memnuniyet etiketlerini sohbet düzeyine çevirip kaydeder.

WildFeedback (Microsoft, 2024), WildChat sohbetlerinde kullanıcının memnun kalmadığı (DSAT) ve
memnun kaldığı (SAT) mesajları işaretleyen hazır bir etiket setidir. Bizim etiketimiz kendi
kuralımızdan (sonraki turlarda tekrar ya da onarım) geldiği için, bu set etiketimizi dışarıdan
doğrulamamızı sağlıyor: "kuralımızın döngü dediği sohbetlerde kullanıcı gerçekten memnuniyetsiz mi?"

Veri tur tur (mesaj mesaj) tutuluyor ve sohbet kimliği yok. Her sohbette mesaj numarası
(UtterranceId) sıfırdan başladığı için, numara geriye düştüğünde yeni bir sohbet başlamış sayılır.

Çıktı (repoya eklenmez):
    data/processed/wildfeedback_conversations.parquet
        conv_id, user_msgs, n_user_msgs, dsat_turns, sat_turns, first_intent, first_domain, dsat_reasons

Çalıştırma (repo kök klasöründe, internet gerekir, yaklaşık 0,6 GB indirir):
    python scripts/fetch_wildfeedback.py
"""

import sys
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "processed" / "wildfeedback_conversations.parquet"
REPO_ID = "microsoft/WildFeedback"
SUBSET = "sat_dsat_annotation"
KEEP_CHARS = 2000


def find_column(columns, must, avoid=()):
    """Kolon adlarında yazım farkı olabildiği için (ör. 'Disatisfaction') parçaya göre bulur."""
    for c in columns:
        low = c.lower()
        if must in low and not any(a in low for a in avoid):
            return c
    raise KeyError(f"'{must}' içeren kolon bulunamadı: {columns}")


def to_conversations(df):
    """Mesaj satırlarını sohbet satırlarına çevirir."""
    utt = find_column(df.columns, "utter")
    role = find_column(df.columns, "role")
    content = find_column(df.columns, "content")
    sat = find_column(df.columns, "satisfaction", avoid=("dis", "justif"))
    dsat = find_column(df.columns, "isatisfaction", avoid=("justif",))
    dsat_why = find_column([c for c in df.columns if c.lower().startswith("dis")], "justif")
    intent = find_column(df.columns, "intent")
    domain = find_column(df.columns, "domain")

    # Mesaj numarası bir öncekinden küçük ya da eşitse yeni sohbet başlamıştır.
    ids = pd.to_numeric(df[utt], errors="coerce").fillna(0).to_numpy()
    new_conv = [True] + [ids[i] <= ids[i - 1] for i in range(1, len(ids))]
    df = df.assign(conv_id=pd.Series(new_conv).cumsum().to_numpy() - 1)

    users = df[df[role].astype(str).str.lower() == "user"].copy()
    users["user_turn"] = users.groupby("conv_id").cumcount()

    def flag(series):
        return series.astype(str).str.lower().isin(["true", "1", "yes"])

    users["is_dsat"] = flag(users[dsat])
    users["is_sat"] = flag(users[sat])

    rows = []
    for conv_id, g in users.groupby("conv_id", sort=True):
        msgs = [str(m or "")[:KEEP_CHARS] for m in g[content]]
        rows.append({
            "conv_id": int(conv_id),
            "user_msgs": msgs,
            "n_user_msgs": len(msgs),
            "dsat_turns": g.loc[g["is_dsat"], "user_turn"].tolist(),
            "sat_turns": g.loc[g["is_sat"], "user_turn"].tolist(),
            "dsat_reasons": [r for r in g.loc[g["is_dsat"], dsat_why].astype(str) if r not in ("N/A", "nan")],
            "first_intent": str(g[intent].iloc[0]),
            "first_domain": str(g[domain].iloc[0]),
        })
    return pd.DataFrame(rows)


def main():
    from huggingface_hub import HfApi, hf_hub_download

    # Hugging Face, JSON dosyasının Parquet kopyasını ayrı bir dalda tutuyor; o daha küçük ve hızlı.
    revision = "refs/convert/parquet"
    files = [f for f in HfApi().list_repo_files(REPO_ID, repo_type="dataset", revision=revision)
             if f.startswith(SUBSET + "/") and f.endswith(".parquet")]
    if not files:
        sys.exit("Parquet dosyası bulunamadı; Hugging Face sayfasını kontrol edin.")

    parts = []
    for f in sorted(files):
        print(f"{f} indiriliyor")
        path = hf_hub_download(REPO_ID, f, repo_type="dataset", revision=revision)
        parts.append(pq.read_table(path).to_pandas())
    raw = pd.concat(parts, ignore_index=True)
    print(f"{len(raw):,} mesaj satırı okundu")

    conv = to_conversations(raw)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    conv.to_parquet(OUT, compression="zstd")
    has_dsat = conv["dsat_turns"].str.len() > 0
    print(f"{len(conv):,} sohbet, en az bir DSAT içeren %{has_dsat.mean()*100:.1f}")
    print(f"Yazıldı: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
