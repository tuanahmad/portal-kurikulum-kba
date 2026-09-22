import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { C } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { sidebarItemsFor, LogoutIcon, CalendarCheckIcon } from "./navIcons";
import { ProfileNameField } from "./ProfileNameField";

/** Menu desktop (lg ke atas) — hamburger di kiri-atas membuka panel melayang di atas konten.
 *  Panel ini juga isinya info akun, Absen, & Keluar (di desktop gak ada ProfileMenu terpisah lagi). */
export function Sidebar() {
  const { pathname } = useLocation();
  const { role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div ref={ref} className="hidden lg:block">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Tutup menu" : "Buka menu"}
        aria-expanded={open}
        className="fixed top-4 left-4 z-30 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-shadow hover:shadow-md"
        style={{
          background: "rgba(255,255,255,0.45)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "0 1px 4px rgba(28,74,51,0.10)",
        }}
      >
        {open ? <CloseIcon /> : <HamburgerIcon />}
      </button>

      {open && (
        <div
          className="fixed top-20 left-4 z-30 w-64 rounded-2xl p-3 overflow-hidden"
          style={{
            background: `linear-gradient(165deg, ${C.green} 0%, ${C.greenDeep} 100%)`,
            boxShadow: "0 16px 40px rgba(20,55,38,0.35)",
          }}
        >
          <nav className="space-y-1.5">
            {sidebarItemsFor(role).map((it) => {
              const active = pathname === it.to;
              const Icon = it.icon;
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className="flex items-center gap-3.5 rounded-xl px-3.5 py-3 transition-colors"
                  style={{
                    background: active ? "rgba(255,255,255,0.16)" : "transparent",
                    color: active ? C.gold : "rgba(255,255,255,0.88)",
                  }}
                >
                  <Icon active={active} />
                  <span className="text-sm font-medium">{it.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="h-px my-2" style={{ background: "rgba(255,255,255,0.18)" }} />

          <ProfileNameField variant="dark" />

          {role === "guru" && (
            <Link
              to="/absen"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3.5 rounded-xl px-3.5 py-3 transition-colors"
              style={{ color: "rgba(255,255,255,0.88)" }}
            >
              <CalendarCheckIcon />
              <span className="text-sm font-medium">Absen Hari Ini</span>
            </Link>
          )}

          <button
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="w-full flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-colors"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            <LogoutIcon />
            <span className="text-sm font-medium">Keluar</span>
          </button>
        </div>
      )}
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 6h16M4 12h16M4 18h16" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
