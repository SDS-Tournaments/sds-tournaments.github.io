/** Сжимает картинку в WebP: не шире maxWidth и не больше maxBytes (снижает качество по шагам) */
export async function compressImage(file: File, maxWidth = 1600, maxBytes = 500_000): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bmp.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();

  for (let q = 0.85; ; q -= 0.1) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', q));
    if (!blob) throw new Error('compress');
    if (blob.size <= maxBytes || q <= 0.4) return blob;
  }
}
