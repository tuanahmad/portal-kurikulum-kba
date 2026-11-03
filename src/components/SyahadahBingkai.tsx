// Bingkai syahadah bergaya Andalusia (Al-Hambra): pita pola khatam (bintang dari dua persegi bersilang), rosetta bintang
// 16 sudut di keempat sudut, medali bintang di tengah tiap sisi, tepi bergerigi (lambrequin), dan lengkung tapal kuda di
// sekeliling judul. Warna: biru tua + abu baja, aksen terakota. Digambar di kanvas 297 x 210 (mm), mengikuti kertas A4 lanskap.

const NAVY = "#1F2D4D";
const BAJA = "#3B4C73";
const ABU = "#7F8AA3";
const TANAH = "#B4553A";
const LATAR = "#FBFAF6";
const TINT = "#EEF1F7";

const f = (n: number) => Math.round(n * 100) / 100;

function titikBintang(cx: number, cy: number, R: number, r: number, n: number): string {
  const p: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? r : R;
    const a = (Math.PI * i) / n - Math.PI / 2;
    p.push(`${f(cx + rr * Math.cos(a))},${f(cy + rr * Math.sin(a))}`);
  }
  return p.join(" ");
}

function Rosetta({ cx, cy, R }: { cx: number; cy: number; R: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={R} fill={LATAR} stroke={NAVY} strokeWidth={0.6} />
      <circle cx={cx} cy={cy} r={f(R - 1.1)} fill="none" stroke={ABU} strokeWidth={0.25} />
      <polygon points={titikBintang(cx, cy, f(R - 1.6), f(R * 0.58), 16)} fill={TINT} stroke={NAVY} strokeWidth={0.4} strokeLinejoin="round" />
      <polygon points={titikBintang(cx, cy, f(R * 0.56), f(R * 0.28), 8)} fill={TANAH} fillOpacity={0.22} stroke={NAVY} strokeWidth={0.35} strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r={f(R * 0.13)} fill={TANAH} />
    </g>
  );
}

function Medali({ cx, cy, R }: { cx: number; cy: number; R: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={R} fill={LATAR} stroke={NAVY} strokeWidth={0.45} />
      <polygon points={titikBintang(cx, cy, f(R - 0.8), f(R * 0.5), 8)} fill={TINT} stroke={NAVY} strokeWidth={0.3} strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r={f(R * 0.14)} fill={TANAH} />
    </g>
  );
}

type Sisi = "atas" | "bawah" | "kiri" | "kanan";

/** Tepi bergerigi di sisi dalam pita: busur-busur kecil menghadap ke dalam, titik terakota di tiap ujung. */
function Gerigi({ x0, y0, x1, y1, sisi }: { x0: number; y0: number; x1: number; y1: number; sisi: Sisi }) {
  const mendatar = sisi === "atas" || sisi === "bawah";
  const L = mendatar ? x1 - x0 : y1 - y0;
  const n = Math.round(L / 6);
  const w = L / n;
  const r = w / 2;
  let d = "";
  const titik: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (sisi === "atas") {
      d += `M${f(x0 + i * w)} ${y0}a${f(r)} ${f(r)} 0 0 0 ${f(w)} 0`;
      titik.push({ x: f(x0 + i * w), y: y0 });
    } else if (sisi === "bawah") {
      d += `M${f(x0 + i * w)} ${y0}a${f(r)} ${f(r)} 0 0 1 ${f(w)} 0`;
      titik.push({ x: f(x0 + i * w), y: y0 });
    } else if (sisi === "kiri") {
      d += `M${x0} ${f(y0 + i * w)}a${f(r)} ${f(r)} 0 0 1 0 ${f(w)}`;
      titik.push({ x: x0, y: f(y0 + i * w) });
    } else {
      d += `M${x0} ${f(y0 + i * w)}a${f(r)} ${f(r)} 0 0 0 0 ${f(w)}`;
      titik.push({ x: x0, y: f(y0 + i * w) });
    }
  }
  return (
    <>
      <path d={d} fill={TINT} fillOpacity={0.7} stroke={NAVY} strokeWidth={0.35} />
      {titik.map((t, i) => (
        <circle key={i} cx={t.x} cy={t.y} r={0.5} fill={TANAH} />
      ))}
    </>
  );
}

/** Lengkung tapal kuda: kaki lurus ke bawah, busur membulat melewati garis tengah. */
function lengkung(r: number, kaki: number): string {
  const cx = 148.5;
  const cy = 56;
  const dy = 7;
  const xk = cx - Math.sqrt(r * r - dy * dy);
  const xk2 = cx + Math.sqrt(r * r - dy * dy);
  return `M${f(xk)} ${kaki}L${f(xk)} ${cy + dy}A${r} ${r} 0 1 1 ${f(xk2)} ${cy + dy}L${f(xk2)} ${kaki}`;
}

export function SyahadahBingkai() {
  return (
    <svg viewBox="0 0 297 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <defs>
        <pattern id="syh-khatam" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect x="1.4" y="1.4" width="5.2" height="5.2" fill="none" stroke={BAJA} strokeWidth={0.28} />
          <rect x="1.4" y="1.4" width="5.2" height="5.2" fill="none" stroke={BAJA} strokeWidth={0.28} transform="rotate(45 4 4)" />
          <circle cx="4" cy="4" r="0.75" fill={TANAH} />
        </pattern>
        {/* Latar: jaringan bintang & salib khas Al-Hambra, sangat tipis supaya tulisan tetap terbaca dan hemat tinta. */}
        <pattern id="syh-latar" width="24" height="24" patternUnits="userSpaceOnUse">
          <g fill="none" stroke={BAJA} strokeWidth={0.22} strokeLinejoin="round">
            <rect x="7.5" y="7.5" width="9" height="9" />
            <rect x="7.5" y="7.5" width="9" height="9" transform="rotate(45 12 12)" />
            <circle cx="12" cy="12" r="3.1" />
            <path d="M12 12L0 0M12 12L24 0M12 12L0 24M12 12L24 24" strokeOpacity=".7" />
            <path d="M12 5.6V0M12 18.4V24M5.6 12H0M18.4 12H24" strokeOpacity=".7" />
            <path d="M0 -3.4L3.4 0L0 3.4L-3.4 0ZM24 -3.4L27.4 0L24 3.4L20.6 0ZM0 20.6L3.4 24L0 27.4L-3.4 24ZM24 20.6L27.4 24L24 27.4L20.6 24Z" />
          </g>
          <circle cx="12" cy="12" r="0.7" fill={TANAH} />
        </pattern>
      </defs>
      <rect x="17.4" y="17.4" width="262.2" height="175.2" fill="url(#syh-latar)" opacity={0.13} />
      <g opacity={0.09} fill="none" stroke={NAVY} strokeLinejoin="round">
        <circle cx="148.5" cy="108" r="66" strokeWidth={0.5} />
        <circle cx="148.5" cy="108" r="62" strokeWidth={0.25} />
        <polygon points={titikBintang(148.5, 108, 60, 38, 16)} strokeWidth={0.45} />
        <polygon points={titikBintang(148.5, 108, 40, 24, 8)} strokeWidth={0.4} />
        <circle cx="148.5" cy="108" r="12" strokeWidth={0.3} />
      </g>
      <path d="M5 5H292V205H5Z M13 13V197H284V13Z" fill={TINT} fillRule="evenodd" />
      <path d="M5 5H292V205H5Z M13 13V197H284V13Z" fill="url(#syh-khatam)" fillRule="evenodd" />
      <rect x="5" y="5" width="287" height="200" fill="none" stroke={NAVY} strokeWidth={0.9} />
      <rect x="2.6" y="2.6" width="291.8" height="204.8" fill="none" stroke={ABU} strokeWidth={0.25} />
      <rect x="13" y="13" width="271" height="184" fill="none" stroke={NAVY} strokeWidth={0.5} />
      <Gerigi x0={28} y0={13} x1={269} y1={13} sisi="atas" />
      <Gerigi x0={28} y0={197} x1={269} y1={197} sisi="bawah" />
      <Gerigi x0={13} y0={28} x1={13} y1={182} sisi="kiri" />
      <Gerigi x0={284} y0={28} x1={284} y1={182} sisi="kanan" />
      <rect x="17.4" y="17.4" width="262.2" height="175.2" fill="none" stroke={ABU} strokeWidth={0.25} />
      <path d={lengkung(28, 67)} fill="none" stroke={NAVY} strokeWidth={0.7} strokeLinecap="round" />
      <path d={lengkung(25.6, 67)} fill="none" stroke={ABU} strokeWidth={0.3} strokeLinecap="round" />
      <path d="M118 67H179" stroke={NAVY} strokeWidth={0.5} />
      <Medali cx={148.5} cy={9} R={5.2} />
      <Medali cx={148.5} cy={201} R={5.2} />
      <Medali cx={9} cy={105} R={5.2} />
      <Medali cx={288} cy={105} R={5.2} />
      <Rosetta cx={13} cy={13} R={13} />
      <Rosetta cx={284} cy={13} R={13} />
      <Rosetta cx={13} cy={197} R={13} />
      <Rosetta cx={284} cy={197} R={13} />
    </svg>
  );
}
