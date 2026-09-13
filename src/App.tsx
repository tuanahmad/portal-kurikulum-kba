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
import OlahragaPage from "./pages/OlahragaPage";
import PreviewPage from "./pages/PreviewPage";
import RpbBulanPage from "./pages/RpbBulanPage";
import RpbFormPage from "./pages/RpbFormPage";
import RefleksiFormPage from "./pages/RefleksiFormPage";
import CapaianQuranFormPage from "./pages/CapaianQuranFormPage";
import CapaianQuranDiagramPage from "./pages/CapaianQuranDiagramPage";
import CapaianIlmuFormPage from "./pages/CapaianIlmuFormPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute allowedRoles={["management", "guru", "olahraga"]}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/home" element={<HomePage />} />
            <Route path="/instrumen" element={<InstrumenPage />} />
            <Route path="/rpb" element={<RpbPage />} />
            <Route path="/rpb/:bulan" element={<RpbBulanPage />} />
            <Route path="/capaian" element={<CapaianPage />} />
            <Route path="/absen" element={<AbsenPage />} />
            <Route path="/jurnal" element={<JurnalPage />} />
            <Route
              path="/olahraga"
              element={
                <ProtectedRoute allowedRoles={["olahraga", "management"]}>
                  <OlahragaPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/olahraga/:mode"
              element={
                <ProtectedRoute allowedRoles={["olahraga", "management"]}>
                  <OlahragaPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route
            path="/preview"
            element={
              <ProtectedRoute allowedRoles={["management", "guru"]}>
                <PreviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rpb/:bulan/isi"
            element={
              <ProtectedRoute allowedRoles={["guru"]}>
                <RpbFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rpb/:bulan/refleksi"
            element={
              <ProtectedRoute allowedRoles={["guru"]}>
                <RefleksiFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/capaian/quran"
            element={
              <ProtectedRoute allowedRoles={["guru", "management"]}>
                <CapaianQuranFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/capaian/quran/diagram"
            element={
              <ProtectedRoute allowedRoles={["management", "guru"]}>
                <CapaianQuranDiagramPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/capaian/ilmu"
            element={
              <ProtectedRoute allowedRoles={["guru", "management"]}>
                <CapaianIlmuFormPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
