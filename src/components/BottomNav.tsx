import { Link, useLocation } from "react-router-dom";
import { C } from "../data";
import { NAV_ITEMS } from "./navIcons";

/** Bottom tab bar — dipakai di mobile & tablet. Disembunyikan di layar lg ke atas (lihat Sidebar). */
export function BottomNav() {
  const { pathname } = useLocation();

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
        {NAV_ITEMS.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
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
