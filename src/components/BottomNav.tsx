import { Link, useLocation } from "react-router-dom";
import { C } from "../data";
import { useAuth } from "../contexts/AuthContext";

export function BottomNav() {
  const { signOut } = useAuth();
  const { pathname } = useLocation();

  const items = [
    { to: "/home", label: "Home", icon: HomeIcon },
    { to: "/instrumen", label: "Instrumen", icon: BookIcon },
    { to: "/rpb", label: "Rencana", icon: DocIcon },
    { to: "/capaian", label: "Capaian", icon: GridIcon },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20"
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
          return (
            <Link
              key={it.to}
              to={it.to}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5"
              style={{ color: active ? C.green : C.muted }}
            >
              <Icon active={active} />
              <span className="text-[10px] font-medium" style={{ color: active ? C.green : C.muted }}>
                {it.label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={() => signOut()}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5"
          style={{ color: C.muted }}
        >
          <LogoutIcon />
          <span className="text-[10px] font-medium">Keluar</span>
        </button>
      </div>
    </nav>
  );
}

function HomeIcon({ active }: { active?: boolean }) {
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

function BookIcon({ active }: { active?: boolean }) {
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

function DocIcon({ active }: { active?: boolean }) {
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

function GridIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.3" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.3" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.3" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.3" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M9 4.5H6a1 1 0 0 0-1 1V18.5a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13 8.5 17 12l-4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 12H9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
