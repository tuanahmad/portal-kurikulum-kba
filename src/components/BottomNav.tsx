import { Link, useLocation } from "react-router-dom";
import { C } from "../data";
import { navItemsFor } from "./navIcons";
import { useAuth } from "../contexts/AuthContext";

/** Bottom tab bar — dipakai di mobile & tablet. Disembunyikan di layar lg ke atas (lihat Sidebar). */
export function BottomNav() {
  const { pathname } = useLocation();
  const { role } = useAuth();
  const items = navItemsFor(role);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-20"
      style={{
        background: "#FFFFFF",
        borderTop: `1px solid ${C.line}`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="max-w-3xl mx-auto flex items-stretch">
        {items.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          const isHome = it.to === "/home";

          // Home ditaruh di tengah array (lihat navIcons.tsx) dan dirender lebih besar/menonjol
          // di sini — lingkaran terangkat sedikit di atas garis bar, kayak pola "tombol utama"
          // yang umum di app lain, biar gampang ditemuin jempol tanpa lihat.
          if (isHome) {
            return (
              <Link
                key={it.to}
                to={it.to}
                title={it.label}
                className="flex-1 flex flex-col items-center justify-center min-w-0"
              >
                <span
                  className="flex items-center justify-center rounded-full -mt-6"
                  style={{
                    width: 54,
                    height: 54,
                    background: `linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`,
                    border: "3px solid #FFFFFF",
                    boxShadow: "0 4px 12px rgba(28,74,51,0.35)",
                    color: "#FFFFFF",
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
            <Link
              key={it.to}
              to={it.to}
              title={it.label}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-3.5 min-w-0"
              style={{ color: active ? C.green : C.muted }}
            >
              <span className="scale-125">
                <Icon active={active} />
              </span>
              {/* Label cuma muncul di menu yang aktif — biar 6 menu gak sesak di layar sempit */}
              {active && (
                <span className="text-xs font-medium truncate max-w-full px-0.5" style={{ color: C.green }}>
                  {it.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
