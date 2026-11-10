/**
 * Sanal liste (yalnızca ekrandaki mesajları çizen sohbet sayfaları: Claude ve Copilot). Sayfa, ekran
 * okuyucular için her mesajı role="article" öğesine koyup toplam mesaj sayısını aria-setsize ile
 * bildiriyor; bu bilgi çizilmeyen mesajlar için de doğru. Mesajlar kullanıcı ve yapay zeka arasında
 * sırayla gittiği için toplamın yarısı (yukarı yuvarlanmış) kullanıcınındır. Bilgi yoksa null.
 */
export function reportedUserTurns(root: ParentNode = document): number | null {
  let total = 0;
  for (const row of Array.from(root.querySelectorAll('[role="article"][aria-setsize]'))) {
    const size = Number(row.getAttribute("aria-setsize"));
    if (Number.isFinite(size) && size > total) total = size;
  }
  return total > 0 ? Math.ceil(total / 2) : null;
}
