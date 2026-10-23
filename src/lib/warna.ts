/** Kartu "kaca": warna tetap kaya tetapi sedikit tembus (alpha), diberi kilau diagonal di sudut kiri-atas
 *  supaya terasa bening, bukan pucat. Tiap warna heksa (#RRGGBB) pada gradient dijadikan rgba. */
export function lembut(gradient: string, alpha = 0.9): string {
  const warna = gradient.replace(/#([0-9a-f]{6})\b/gi, (_, h: string) => {
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  });
  return `linear-gradient(150deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 55%), ${warna}`;
}
