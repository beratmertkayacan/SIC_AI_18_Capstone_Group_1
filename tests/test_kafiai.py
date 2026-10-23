"""Temel davranış testleri. Çalıştırma: python -m pytest tests"""

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from kafiai.features import FEATURE_COLUMNS, build_feature_table, conversation_features  # noqa: E402
from kafiai.labels import weak_label  # noqa: E402
from kafiai.split import mark_templates, user_split  # noqa: E402
from kafiai.text import has_repair, request_type, similarity  # noqa: E402


def test_similarity_same_and_different():
    assert similarity("bu kodu düzelt", "bu kodu düzelt") > 0.99
    assert similarity("bu kodu düzelt", "Bu kodu düzelt!") > 0.8
    assert similarity("bu kodu düzelt", "istanbulda hava nasıl") < 0.3
    assert similarity("", "metin") == 0.0


def test_repair_phrases_tr_and_en():
    assert has_repair("olmadı, tekrar yaz")
    assert has_repair("that's not what I asked")
    assert not has_repair("teşekkürler, çok iyi oldu")


def test_request_type():
    assert request_type("Bana bir dilekçe yaz") == "uretim"
    assert request_type("Fotosentez nasıl çalışır?") == "anlama"
    assert request_type("merhaba") == "diger"


def test_features_only_use_first_k_turns():
    short = ["bir makale yaz", "daha kısa olsun"]
    longer = short + ["olmadı", "olmadı", "olmadı"]
    assert conversation_features(short, k=2) == conversation_features(longer, k=2)


def test_weak_label():
    loop = ["kodu düzelt", "hata var", "olmadı tekrar dene", "hala yanlış", "yine olmadı"]
    fine = ["bir şiir yaz", "daha kısa olsun", "teşekkürler", "başlık da ekle"]
    assert weak_label(loop, k=2) == 1
    assert weak_label(fine, k=2) == 0


def test_templates_and_user_split():
    df = pd.DataFrame({
        "first_prompt": ["You are a helpful assistant that writes product titles"] * 25 + ["merhaba"] * 5,
        "hashed_ip": [f"u{i % 10}" for i in range(30)],
        "user_msgs": [["a", "b"]] * 30,
    })
    assert mark_templates(df).sum() == 25
    train_idx, test_idx = user_split(df, test_size=0.3)
    assert set(df.loc[train_idx, "hashed_ip"]).isdisjoint(df.loc[test_idx, "hashed_ip"])
    assert list(build_feature_table(df).columns) == FEATURE_COLUMNS
