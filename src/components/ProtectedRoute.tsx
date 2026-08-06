import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PageLoadingSkeleton } from "./Skeleton";

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: Array<"management" | "guru">;
}) {
  const { session, role, loading } = useAuth();

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  if (!session) return <Navigate to="/login" replace />;

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/sheet" replace />;
  }

  return <>{children}</>;
}
