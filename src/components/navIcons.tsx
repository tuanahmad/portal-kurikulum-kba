// Ikon & daftar menu navigasi — dipakai bareng oleh BottomNav (mobile/tablet) dan Sidebar (desktop)

// Absen sengaja gak masuk sini — dipindah ke Menu Profil (ProfileMenu) karena
// sifatnya aksi harian sekali klik, bukan halaman yang dibuka berulang.
type NavItem = { to: string; label: string; icon: (p: { active?: boolean }) => JSX.Element };

// Home sengaja ditaruh di tengah (index 2 dari 5) — BottomNav render-nya lebih besar/menonjol
// khusus buat item ini (lihat isHome di BottomNav.tsx), jadi urutan array = urutan tampil.
const GURU_NAV: NavItem[] = [
  { to: "/instrumen", label: "Instrumen", icon: BookIcon },
  { to: "/rpb", label: "Rencana", icon: DocIcon },
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/capaian", label: "Capaian", icon: CapaianIcon },
  { to: "/jurnal", label: "Jurnal", icon: NotebookIcon },
];

// Management (HP): tanpa Instrumen, ditambah Rekap Olahraga di paling kanan. Home tetap di tengah (index 2 dari 5).
const MANAGEMENT_NAV: NavItem[] = [
  { to: "/rpb", label: "Rencana", icon: DocIcon },
  { to: "/capaian", label: "Capaian", icon: CapaianIcon },
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/jurnal", label: "Jurnal", icon: NotebookIcon },
  { to: "/olahraga", label: "Olahraga", icon: AnggarIcon },
];

const OLAHRAGA_NAV: NavItem[] = [
  { to: "/instrumen", label: "Panduan", icon: BookIcon },
  { to: "/olahraga/rencana", label: "Rencana", icon: DocIcon },
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/olahraga/evaluasi", label: "Evaluasi", icon: EvaluasiIcon },
  { to: "/jurnal", label: "Jurnal", icon: NotebookIcon },
];

// Semua 6 tujuan yang ada di card Home management (Instrumen Ilmu/Rencana & Refleksi/Capaian
// Santri/Absen Guru/Daily Jurnal/Rekap Olahraga) — dipakai KHUSUS di Sidebar desktop (lihat
// sidebarItemsFor), bukan di BottomNav mobile (yang tetap ngikut navItemsFor biasa, cuma 5 slot).
const MANAGEMENT_NAV_FULL: NavItem[] = [
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/instrumen", label: "Instrumen Ilmu", icon: BookIcon },
  { to: "/rpb", label: "Rencana & Refleksi", icon: DocIcon },
  { to: "/capaian", label: "Capaian Santri", icon: CapaianIcon },
  { to: "/absen", label: "Absen Guru", icon: CalendarCheckIcon },
  { to: "/jurnal", label: "Daily Jurnal", icon: NotebookIcon },
  { to: "/olahraga", label: "Rekap Olahraga", icon: AnggarIcon },
  { to: "/sajian-data", label: "Sajian Data", icon: BarChartIcon },
];

/** Menu navigasi sesuai role. Guru olahraga lihat Home + Panduan + Rencana + Evaluasi + Jurnal;
 *  Absen-nya ada di Menu Profil (HP) / hamburger (desktop), sama seperti guru kelas. */
export function navItemsFor(role: "management" | "guru" | "olahraga" | null): NavItem[] {
  if (role === "olahraga") return OLAHRAGA_NAV;
  if (role === "management") return MANAGEMENT_NAV;
  return GURU_NAV;
}

/** Dipakai Sidebar (desktop) doang — management dapet semua 6 tujuan Home-card-nya di hamburger,
 *  bukan cuma subset kayak BottomNav mobile. Guru/olahraga sama aja kayak navItemsFor biasa. */
export function sidebarItemsFor(role: "management" | "guru" | "olahraga" | null): NavItem[] {
  if (role === "management") return MANAGEMENT_NAV_FULL;
  return navItemsFor(role);
}

// dipertahankan utk kompatibilitas kalau masih ada yang import
export const NAV_ITEMS = GURU_NAV;

export function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-8.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BookIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5.5c2-1 5-1 8 .5 3-1.5 6-1.5 8-.5v13c-2-1-5-1-8 .5-3-1.5-6-1.5-8-.5v-13Z"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
        strokeLinejoin="round"
      />
      <path d="M12 6v13" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
    </svg>
  );
}

export function DocIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
        strokeLinejoin="round"
      />
      <path d="M14 3.5V8h4" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinejoin="round" />
      <path d="M8 12.5h8M8 16h5.5" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" />
    </svg>
  );
}

export function GridIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.3" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.3" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.3" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.3" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
    </svg>
  );
}

/** Capaian santri: garis perkembangan yang naik. */
export function CapaianIcon({ active }: { active?: boolean }) {
  const w = active ? 2.1 : 1.7;
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3.5 17.5l5.5-5.5 4 4 7.5-7.5" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 8.5h5.5V14" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 20.5h17" stroke="currentColor" strokeWidth={w} strokeLinecap="round" opacity={0.45} />
    </svg>
  );
}

/** Evaluasi olahraga: papan klip berisi daftar centang. */
export function EvaluasiIcon({ active }: { active?: boolean }) {
  const w = active ? 2.1 : 1.7;
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" stroke="currentColor" strokeWidth={w} />
      <path d="M9 4.5V3.5h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" stroke="currentColor" strokeWidth={w} strokeLinejoin="round" />
      <path d="M8.5 11l1.3 1.3 2.2-2.3M8.5 16l1.3 1.3 2.2-2.3" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 11h2M14 16h2" stroke="currentColor" strokeWidth={w} strokeLinecap="round" />
    </svg>
  );
}

export function CalendarCheckIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <path d="M8 3v3.5M16 3v3.5" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" />
      <path d="M8.5 14.5l2 2 4.5-4.5" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NotebookIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <path d="M8 3.5v17" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <path d="M11.5 9h5M11.5 12.5h5M11.5 16h3.5" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" />
    </svg>
  );
}

export function BarChartIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ opacity: active ? 1 : 0.9 }}>
      <path d="M5 20V11M12 20V5M19 20v-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Atlet anggar dalam sikap menusuk (lunge) -- ikon Rekap Olahraga. */
export function AnggarIcon({ active }: { active?: boolean }) {
  // Digambar dalam kotak 24 tetapi mengisi hampir penuh; dikecilkan supaya ukurannya sama dengan ikon lain (garis dikompensasi).
  const t = (active ? 2.1 : 1.7) / 0.82;
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <g transform="translate(12 12) scale(0.82) translate(-12.4 -11.55)">
      {/* kepala (bertopeng) */}
      <circle cx="8.6" cy="4.6" r="2" stroke="currentColor" strokeWidth={t} />
      {/* badan condong ke depan */}
      <path d="M8.9 6.9 L10.6 13" stroke="currentColor" strokeWidth={t} strokeLinecap="round" />
      {/* lengan depan memegang pedang lurus ke depan */}
      <path d="M9.4 9 L15.2 8.3" stroke="currentColor" strokeWidth={t} strokeLinecap="round" />
      <path d="M15.2 8.3 L22 7.1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      {/* lengan belakang terangkat */}
      <path d="M9 8.8 L6 7.6 L4.8 5.2" stroke="currentColor" strokeWidth={t} strokeLinecap="round" strokeLinejoin="round" />
      {/* kaki depan menekuk (lunge) */}
      <path d="M10.6 13 L14.2 15.2 L14.2 20.5" stroke="currentColor" strokeWidth={t} strokeLinecap="round" strokeLinejoin="round" />
      {/* kaki belakang lurus */}
      <path d="M10.6 13 L6 17 L2.8 20" stroke="currentColor" strokeWidth={t} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M9 4.5H6a1 1 0 0 0-1 1V18.5a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M13 8.5 17 12l-4 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 12H9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
