import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { ProfileMenu } from "./ProfileMenu";

/** Layout bersama untuk semua halaman setelah login: menu overlay di desktop, bottom tab di mobile/tablet. */
export function AppLayout() {
  return (
    <>
      <Sidebar />
      <ProfileMenu />
      <Outlet />
      <BottomNav />
    </>
  );
}
