/** Eklenti ilk kurulduğunda karşılama ekranını açar; güncellemede ve yeniden yüklemede açmaz. */
export function openWelcomeOnInstall(details: { reason: string }, open: () => void): boolean {
  if (details.reason !== "install") return false;
  open();
  return true;
}
