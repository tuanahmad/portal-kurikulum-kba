import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { C } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { LogoutIcon, CalendarCheckIcon } from "./navIcons";
import { ProfileNameField } from "./ProfileNameField";
import { PushNotifToggle } from "./PushNotifToggle";

/** Ikon profil melayang di kanan atas, ada di semua halaman — isinya info akun & tombol keluar. */
export function ProfileMenu() {
  const { role, kelas, fullName, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const initial = (fullName || kelas || (role === "management" ? "Management" : "Akun")).charAt(0).toUpperCase();

  return (
    <div ref={ref} className="lg:hidden fixed top-3 right-3 sm:top-4 sm:right-4 z-40">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu akun"
        aria-expanded={open}
        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm backdrop-blur-md transition-shadow hover:shadow-md"
        style={{
          background: "rgba(255,255,255,0.45)",
          color: C.green,
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "0 1px 4px rgba(28,74,51,0.10)",
        }}
      >
        {initial}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-52 rounded-2xl p-2 overflow-hidden backdrop-blur-lg"
          style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.6)", boxShadow: "0 8px 24px rgba(28,74,51,0.14)" }}
        >
          <ProfileNameField variant="light" />
          {role === "guru" && (
            <>
              <div className="h-px my-1" style={{ background: C.line }} />
              <Link
                to="/absen"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:opacity-80"
                style={{ color: C.ink }}
              >
                <CalendarCheckIcon />
                <span className="text-sm font-medium">Absen Hari Ini</span>
              </Link>
              <div className="h-px my-1" style={{ background: C.line }} />
              <PushNotifToggle variant="light" />
            </>
          )}
          {role === "olahraga" && (
            <>
              <div className="h-px my-1" style={{ background: C.line }} />
              <PushNotifToggle variant="light" />
            </>
          )}
          <div className="h-px my-1" style={{ background: C.line }} />
          <button
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:opacity-80"
            style={{ color: C.muted }}
          >
            <LogoutIcon />
            <span className="text-sm font-medium">Keluar</span>
          </button>
        </div>
      )}
    </div>
  );
}
