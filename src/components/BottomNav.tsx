import { Link, useLocation } from "react-router-dom";
import { C } from "../data";
import { navItemsFor } from "./navIcons";
import { useAuth } from "../contexts/AuthContext";

/** Bottom tab bar — dipakai di mobile & tablet. Disembunyikan di layar lg ke atas (lihat Sidebar).
 *  Bentuknya kapsul melayang (kaca): posisi tetap di bawah, isi halaman lewat di belakangnya dan warnanya
 *  tembus lewat blur. */
export function BottomNav() {
  const { pathname } = useLocation();
  const { role } = useAuth();
  const items = navItemsFor(role);

  return (
    <nav
      className="lg:hidden fixed left-0 right-0 z-20 px-3 pointer-events-none"
      style={{ bottom: "calc(10px + env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        className="max-w-md mx-auto flex items-center p-1.5 pointer-events-auto"
        style={{
          borderRadius: 32,
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(18px) saturate(1.6)",
          WebkitBackdropFilter: "blur(18px) saturate(1.6)",
          border: "1px solid rgba(255,255,255,0.75)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.7)",
        }}
      >
        {items.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          const isHome = it.to === "/home";

          // Home ditaruh di tengah array (lihat navIcons.tsx): lingkaran kaca yang sedikit lebih besar dari menu lain.
          if (isHome) {
            return (
              <Link key={it.to} to={it.to} title={it.label} className="flex-1 flex items-center justify-center min-w-0">
                <span
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 50,
                    height: 50,
                    background: "rgba(255,255,255,0.35)",
                    border: "1.5px solid rgba(255,255,255,0.85)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.12), inset 0 1.5px 0 rgba(255,255,255,0.7)",
                    color: C.greenDeep,
                  }}
                >
                  <span className="scale-125">
                    <Icon active />
                  </span>
                </span>
              </Link>
            );
          }

          return (
            <Link key={it.to} to={it.to} title={it.label} className="flex-1 flex items-center justify-center min-w-0">
              {/* Tinggi tetap (50px). Ikon berada di tengah; hanya menu aktif yang naik dan menampilkan namanya,
                  yang lain diam di tempat. Bar tidak berubah tinggi saat pindah halaman. */}
              <span
                className="relative w-full rounded-3xl transition-colors"
                style={{ height: 50, color: active ? C.green : C.muted, background: active ? `${C.green}1F` : "transparent" }}
              >
                <span
                  className="absolute left-1/2 top-1/2 transition-transform duration-200 ease-out"
                  style={{ transform: `translate(-50%, ${active ? "-80%" : "-50%"}) scale(1.1)` }}
                >
                  <Icon active={active} />
                </span>
                <span
                  className="absolute inset-x-0 bottom-[5px] text-center text-[11px] font-medium leading-none truncate px-0.5 transition-opacity duration-200"
                  style={{ color: C.green, opacity: active ? 1 : 0 }}
                  aria-hidden={!active}
                >
                  {it.label}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
