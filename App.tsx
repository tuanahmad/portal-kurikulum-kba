import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import InstrumenPage from "./pages/InstrumenPage";
import RpbPage from "./pages/RpbPage";
import CapaianPage from "./pages/CapaianPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute allowedRoles={["management", "guru"]}>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/instrumen"
            element={
              <ProtectedRoute allowedRoles={["management", "guru"]}>
                <InstrumenPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rpb"
            element={
              <ProtectedRoute allowedRoles={["management", "guru"]}>
                <RpbPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/capaian"
            element={
              <ProtectedRoute allowedRoles={["management", "guru"]}>
                <CapaianPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
