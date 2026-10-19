"""Veriyi temizleme ve eğitim/test olarak bölme.

İki önemli kural var:

1. Şablon sohbetler çıkarılır. Bunlar programların otomatik gönderdiği hazır
   isteklerdir ve gerçek bir kişinin kullanım biçimini temsil etmez (Bölüm 2'de %16,5).

2. Bölme kullanıcı bazlı yapılır. Aynı kişinin sohbetleri hem eğitimde hem testte
   olursa model kişinin yazım tarzını ezberler ve skor olduğundan iyi görünür.
   WildChat'teki şifrelenmiş IP (hashed_ip) kullanıcı kimliği yerine kullanılır.
"""

from sklearn.model_selection import GroupShuffleSplit

from kafiai.config import SEED, TEMPLATE_MIN_COUNT, TEMPLATE_PREFIX_CHARS


def mark_templates(df):
    """Her sohbet için şablon olup olmadığını gösteren True/False serisi döner."""
    prefix = (
        df["first_prompt"].fillna("").str.lower()
        .str.replace(r"\s+", " ", regex=True).str.strip()
        .str[:TEMPLATE_PREFIX_CHARS]
    )
    counts = prefix.map(prefix.value_counts())
    return (counts >= TEMPLATE_MIN_COUNT) & (df["first_prompt"].fillna("").str.len() >= 30)


def user_split(df, test_size=0.2, group_col="hashed_ip", seed=SEED):
    """Kullanıcıları ayırarak eğitim ve test indekslerini döner."""
    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
    train_idx, test_idx = next(splitter.split(df, groups=df[group_col]))
    return df.index[train_idx], df.index[test_idx]
