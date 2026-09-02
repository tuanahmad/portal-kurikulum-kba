import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import InstrumenPage from "./pages/InstrumenPage";
import RpbPage from "./pages/RpbPage";
import CapaianPage from "./pages/CapaianPage";
import AbsenPage from "./pages/AbsenPage";
import JurnalPage from "./pages/JurnalPage";
import PreviewPage from "./pages/PreviewPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute allowedRoles={["management", "guru"]}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/home" element={<HomePage />} />
            <Route path="/instrumen" element={<InstrumenPage />} />
            <Route path="/rpb" element={<RpbPage />} />
            <Route path="/capaian" element={<CapaianPage />} />
            <Route path="/absen" element={<AbsenPage />} />
            <Route path="/jurnal" element={<JurnalPage />} />
          </Route>
          <Route
            path="/preview"
            element={
              <ProtectedRoute allowedRoles={["management", "guru"]}>
                <PreviewPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
