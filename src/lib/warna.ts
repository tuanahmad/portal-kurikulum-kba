/** Kartu "kaca": warna dijenuhkan sedikit (supaya segar, bukan kusam) lalu dibuat agak tembus (alpha).
 *  Tiap warna heksa (#RRGGBB) pada gradient diubah jadi rgba. Tanpa lapisan putih di atasnya karena itu membuat warna pucat. */
function jenuhkan(hex: string, alpha: number): string {
  const n = parseInt(hex, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  let h = 0;
  let s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  // hanya warna yang kusam (kejenuhan rendah) yang dinaikkan; warna yang sudah pekat dibiarkan supaya tidak terlalu mencolok
  const sasaran = l < 0.3 ? 0.85 : 0.7; // warna gelap paling cepat terlihat kusam, jadi dinaikkan lebih tinggi
  if (s < sasaran) s += (sasaran - s) * 0.6;
  const a = s * Math.min(l, 1 - l);
  const f = (k: number) => {
    const m = (k + h / 30) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(m - 3, 9 - m, 1))) * 255);
  };
  return `rgba(${f(0)}, ${f(8)}, ${f(4)}, ${alpha})`;
}

export function lembut(gradient: string, alpha = 0.86): string {
  return gradient.replace(/#([0-9a-f]{6})\b/gi, (_, h: string) => jenuhkan(h, alpha));
}
