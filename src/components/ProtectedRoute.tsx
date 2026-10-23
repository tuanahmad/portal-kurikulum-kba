import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { FullPageSkeleton } from "./Skeleton";

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: Array<"management" | "guru" | "olahraga">;
}) {
  const { session, role, loading, rosterReady } = useAuth();

  if (loading || (session && !rosterReady)) {
    return <FullPageSkeleton />;
  }

  if (!session) return <Navigate to="/login" replace />;

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
