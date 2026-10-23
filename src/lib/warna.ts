/** Melembutkan gradient kartu: tiap warna heksa (#RRGGBB) dijadikan rgba dengan sedikit transparan,
 *  supaya kartu tidak terlalu pekat dan latar (wallpaper) tipis ikut tembus. Teks putih di atasnya tetap terbaca. */
export function lembut(gradient: string, alpha = 0.86): string {
  return gradient.replace(/#([0-9a-f]{6})\b/gi, (_, h: string) => {
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  });
}
