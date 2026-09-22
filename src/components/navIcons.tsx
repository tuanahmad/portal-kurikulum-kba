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
  { to: "/capaian", label: "Capaian", icon: GridIcon },
  { to: "/jurnal", label: "Jurnal", icon: NotebookIcon },
];

const OLAHRAGA_NAV: NavItem[] = [
  { to: "/instrumen", label: "Panduan", icon: BookIcon },
  { to: "/olahraga/rencana", label: "Rencana", icon: DocIcon },
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/olahraga/evaluasi", label: "Evaluasi", icon: GridIcon },
  { to: "/olahraga/absen", label: "Absen", icon: CalendarCheckIcon },
];

// Semua 6 tujuan yang ada di card Home management (Instrumen Ilmu/Rencana & Refleksi/Capaian
// Santri/Absen Guru/Daily Jurnal/Rekap Olahraga) — dipakai KHUSUS di Sidebar desktop (lihat
// sidebarItemsFor), bukan di BottomNav mobile (yang tetap ngikut navItemsFor biasa, cuma 5 slot).
const MANAGEMENT_NAV_FULL: NavItem[] = [
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/instrumen", label: "Instrumen Ilmu", icon: BookIcon },
  { to: "/rpb", label: "Rencana & Refleksi", icon: DocIcon },
  { to: "/capaian", label: "Capaian Santri", icon: GridIcon },
  { to: "/absen", label: "Absen Guru", icon: CalendarCheckIcon },
  { to: "/jurnal", label: "Daily Jurnal", icon: NotebookIcon },
  { to: "/olahraga", label: "Rekap Olahraga", icon: WhistleIcon },
];

/** Menu navigasi sesuai role. Guru olahraga lihat Home + Panduan + Rencana + Evaluasi + Absen
 *  (gantinya tab Rencana/Evaluasi/Absen yang tadinya ada di dalam halaman Olahraga). */
export function navItemsFor(role: "management" | "guru" | "olahraga" | null): NavItem[] {
  if (role === "olahraga") return OLAHRAGA_NAV;
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
        strokeWidth={active ? 2 : 1.6}
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
        strokeWidth={active ? 2 : 1.6}
        strokeLinejoin="round"
      />
      <path d="M12 6v13" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
    </svg>
  );
}

export function DocIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinejoin="round"
      />
      <path d="M14 3.5V8h4" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinejoin="round" />
      <path d="M8 12.5h8M8 16h5.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
    </svg>
  );
}

export function GridIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.3" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.3" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.3" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.3" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
    </svg>
  );
}

export function CalendarCheckIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <path d="M8 3v3.5M16 3v3.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
      <path d="M8.5 14.5l2 2 4.5-4.5" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NotebookIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <path d="M8 3.5v17" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <path d="M11.5 9h5M11.5 12.5h5M11.5 16h3.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
    </svg>
  );
}

export function WhistleIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M13 8h7a1 1 0 0 1 1 1v1a6 6 0 1 1-8.5-5.4L13 8Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="13" r="2.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <path d="M13 3.5h4" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
    </svg>
  );
}

export function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M9 4.5H6a1 1 0 0 0-1 1V18.5a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13 8.5 17 12l-4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 12H9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
