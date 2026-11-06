/** Testlerde sayfa görüntüleri metin olarak yüklenir (Vite "?raw" içe aktarması). */
declare module "*.html?raw" {
  const content: string;
  export default content;
}
