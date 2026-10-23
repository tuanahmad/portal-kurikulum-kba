import { PageLoadingSkeleton } from "./Skeleton";
import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { ProfileMenu } from "./ProfileMenu";

/** Layout bersama untuk semua halaman setelah login: menu overlay di desktop, bottom tab di mobile/tablet. */
export function AppLayout() {
  const { pathname } = useLocation();
  return (
    <>
      <Sidebar />
      <ProfileMenu />
      <div key={pathname} className="halaman-masuk">
        <Suspense
          fallback={
            <div className="max-w-2xl mx-auto px-4 pt-9">
              <PageLoadingSkeleton />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </div>
      <BottomNav />
    </>
  );
}
