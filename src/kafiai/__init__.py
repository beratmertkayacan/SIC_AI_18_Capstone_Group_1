"""KafiAI: üretken yapay zeka sohbetlerinde verimsiz döngüleri erken fark eden model.

Modüller:
    config    eşikler ve sabitler, tek yerden ayarlanır
    text      metin temizleme, benzerlik, onarım ifadeleri, talep türü
    features  sohbetin ilk k turundan öznitelik çıkarımı
    labels    sohbetin tamamına bakarak kural tabanlı zayıf etiket
    split     şablon sohbetleri ayıklama ve kullanıcı bazlı bölme
    data      veri kaynaklarını okuma ve 6 adımlı temizleme
    tasks     ilk mesajdan görev türü (eklentiyle ortak kurallar)
    extension_similarity  eklentinin benzerlik hesabının Python ikizi
"""

__version__ = "0.1.0"
