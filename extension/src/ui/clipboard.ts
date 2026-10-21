/**
 * Metni panoya kopyalar. Yalnızca kullanıcının tıklamasıyla çağrılır.
 * Önce modern API, olmazsa seçip kopyalama yöntemi denenir. Başarıyı döndürür.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // modern API reddedildi veya yok: yedek yönteme geç
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(area);
  try {
    area.select();
    return typeof document.execCommand === "function" ? document.execCommand("copy") : false;
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
