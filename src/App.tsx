import { FullPageSkeleton } from "./components/Skeleton";
import { lazy, Suspense } from "react";
import { ToastHost } from "./components/Toast";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
const InstrumenPage = lazy(() => import("./pages/InstrumenPage"));
const RpbPage = lazy(() => import("./pages/RpbPage"));
const CapaianPage = lazy(() => import("./pages/CapaianPage"));
const AbsenPage = lazy(() => import("./pages/AbsenPage"));
const JurnalPage = lazy(() => import("./pages/JurnalPage"));
const OlahragaPage = lazy(() => import("./pages/OlahragaPage"));
const PreviewPage = lazy(() => import("./pages/PreviewPage"));
const RpbBulanPage = lazy(() => import("./pages/RpbBulanPage"));
const RpbFormPage = lazy(() => import("./pages/RpbFormPage"));
const RefleksiFormPage = lazy(() => import("./pages/RefleksiFormPage"));
const CapaianQuranFormPage = lazy(() => import("./pages/CapaianQuranFormPage"));
const CapaianQuranDiagramPage = lazy(() => import("./pages/CapaianQuranDiagramPage"));
const CapaianIlmuFormPage = lazy(() => import("./pages/CapaianIlmuFormPage"));
const TasmiPage = lazy(() => import("./pages/TasmiPage"));
const TasmiSertifikatPage = lazy(() => import("./pages/TasmiSertifikatPage"));
import { SERTIFIKAT_TASMI_AKTIF } from "./data";
const TasmiRekapPage = lazy(() => import("./pages/TasmiRekapPage"));
const SajianDataPage = lazy(() => import("./pages/SajianDataPage"));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<FullPageSkeleton />}>
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
              path="/sajian-data"
              element={
                <ProtectedRoute allowedRoles={["management"]}>
                  <SajianDataPage />
                </ProtectedRoute>
              }
            />
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
          <Route
            path="/capaian/tasmi"
            element={
              <ProtectedRoute allowedRoles={["guru", "management"]}>
                <TasmiPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/capaian/tasmi/:id/sertifikat"
            element={
              <ProtectedRoute allowedRoles={["guru", "management"]}>
                {SERTIFIKAT_TASMI_AKTIF ? <TasmiSertifikatPage /> : <Navigate to="/capaian/tasmi" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/capaian/tasmi-rekap"
            element={
              <ProtectedRoute allowedRoles={["management"]}>
                <TasmiRekapPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
        <ToastHost />
      </AuthProvider>
    </BrowserRouter>
  );
}
