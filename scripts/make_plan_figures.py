"""Uygulama planındaki zaman çizelgesi (Gantt) grafiğini üretir.

Çalıştırma:
    python scripts/make_plan_figures.py
Çıktı:
    figures/12_gantt.png

Mimari diyagramı ayrı bir kaynaktan üretilir:
    dot -Tpng -Gdpi=170 docs/diagrams/architecture.dot -o figures/11_architecture.png
"""

from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "figures" / "12_gantt.png"

COLORS = {
    "Veri": "#1F5F6B",
    "Model": "#3F8A8C",
    "Eklenti": "#C4562A",
    "Değerlendirme": "#8A6D3B",
    "Teslim": "#4A5A5E",
}

# (görev, aşama, başlangıç haftası, bitiş haftası). Haftalar 0'dan başlar; 1.5 haftanın ortası demektir.
TASKS = [
    ("Concept note ve mimari kararlar", "Teslim", 0.0, 0.3),
    ("Öznitelik, kural etiketi, ilk temel modeller", "Veri", 0.0, 1.0),
    ("Meşru tekrarların ayıklanması, görev normları", "Veri", 0.5, 1.0),
    ("Hazır ve LLM etiketleri, Türkçe etiketleme", "Veri", 1.0, 2.0),
    ("Elle doğrulama (300 sohbet)", "Veri", 1.4, 2.0),
    ("Model seçimi, eşik ayarı, ShareChat testi", "Model", 2.0, 3.0),
    ("Sohbeti okuma, tekrar tespiti, uyarı şeridi", "Eklenti", 2.0, 3.0),
    ("Halka, çıkış kartı, Taze başlat, ayarlar", "Eklenti", 3.0, 4.0),
    ("Modelin eklentiye gömülmesi", "Model", 3.3, 4.0),
    ("Haftalık özet, öğrenme sorusu, destek yolu", "Eklenti", 4.0, 4.7),
    ("Pilot çalışma (10 kişi, 1 hafta)", "Değerlendirme", 4.3, 5.3),
    ("Final rapor, demo videosu, sunum", "Teslim", 5.0, 6.0),
]

MILESTONES = [("K1", 1), ("K2", 2), ("K3", 3), ("K4", 4), ("K5", 5), ("K6", 6)]


def main():
    plt.rcParams.update({"font.size": 9, "font.family": "DejaVu Sans"})
    fig, ax = plt.subplots(figsize=(11, 5.0))

    for i, (name, phase, start, end) in enumerate(TASKS):
        ax.barh(i, end - start, left=start, height=0.55, color=COLORS[phase], edgecolor="white")
    ax.set_yticks(range(len(TASKS)))
    ax.set_yticklabels([task[0] for task in TASKS])
    ax.invert_yaxis()

    for label, week in MILESTONES:
        ax.axvline(week, color="#9AA5A8", lw=0.8, ls="--", zorder=0)
        ax.text(week, -0.95, label, ha="center", va="bottom", fontsize=8, color="#4A5A5E")

    ax.set_xticks([w + 0.5 for w in range(6)])
    ax.set_xticklabels([f"Hafta {w + 1}" for w in range(6)])
    ax.set_xlim(0, 6)
    ax.set_ylim(len(TASKS) - 0.4, -1.3)
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.tick_params(axis="y", length=0)
    ax.tick_params(axis="x", length=0)
    ax.grid(axis="x", alpha=0)

    handles = [plt.Rectangle((0, 0), 1, 1, color=c) for c in COLORS.values()]
    ax.legend(handles, COLORS.keys(), ncol=5, loc="upper center", bbox_to_anchor=(0.5, -0.07), frameon=False)
    ax.set_title("KafiAI uygulama planı (6 hafta)", loc="left", fontsize=11)

    fig.tight_layout()
    fig.savefig(OUT, dpi=170, bbox_inches="tight")
    print(f"Grafik yazıldı: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
