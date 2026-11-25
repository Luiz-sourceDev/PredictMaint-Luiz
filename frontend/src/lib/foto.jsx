/* Prepara a foto antes do envio.
   Foto de celular costuma ter 4 a 12 MB e o servidor aceita até 5 MB:
   aqui ela é reduzida para no máximo 1600 px e vira JPG (fica com uns 200 a 500 KB),
   já com a rotação certa. Se o navegador não conseguir abrir o arquivo, envia como veio. */
const ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PX = 1600;

export async function prepararFoto(arquivo) {
  if (!arquivo) return null;
  try {
    const img = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    const k = Math.min(1, MAX_PX / Math.max(img.width, img.height));
    const tela = document.createElement('canvas');
    tela.width = Math.round(img.width * k);
    tela.height = Math.round(img.height * k);
    tela.getContext('2d').drawImage(img, 0, 0, tela.width, tela.height);
    img.close?.();
    const blob = await new Promise(ok => tela.toBlob(ok, 'image/jpeg', 0.82));
    if (blob){ 
      return new File([blob], (arquivo.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
    };
  } catch { /* formato que o navegador não abre (ex.: HEIC no Windows) */ }
  if (!ACEITOS.includes(arquivo.type)){ 
    throw new Error('Não consegui abrir essa foto. Use JPG, PNG ou WEBP (ou tire a foto pela câmera).');
  }
  return arquivo;
}
