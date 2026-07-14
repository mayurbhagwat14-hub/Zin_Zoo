import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useEffect, Suspense, lazy } from "react"
import ProtectedRoute from "@food/components/ProtectedRoute"
import AuthRedirect from "@food/components/AuthRedirect"
import Loader from "@food/components/Loader"
import PushSoundEnableButton from "@food/components/PushSoundEnableButton"
import { registerWebPushForCurrentModule } from "@food/utils/firebaseMessaging"
import { isModuleAuthenticated } from "@food/utils/auth"
import { applyModulePowerScanning, getCachedSettings, loadBusinessSettings } from "@food/utils/businessSettings"

// Lazy Loading Components
const UserRouter = lazy(() => import("@food/components/user/UserRouter"))

// Admin Module
const AdminRouter = lazy(() => import("@food/components/admin/AdminRouter"))
const AdminLogin = lazy(() => import("@food/pages/admin/auth/AdminLogin"))
const AdminSignup = lazy(() => import("@food/pages/admin/auth/AdminSignup"))
const AdminForgotPassword = lazy(() => import("@food/pages/admin/auth/AdminForgotPassword"))


function UserPathRedirect() {
  const location = useLocation()
  // Correctly handle the /food/user -> /food redirect regardless of where it starts
  const newPath = location.pathname.replace("/user", "") || "/food"
  return <Navigate to={newPath} replace />
}

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}


export default function App() {
  const location = useLocation()

  useEffect(() => {
    registerWebPushForCurrentModule(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    const resolveModule = () => {
      return "user"
    }

    const applyPowerScanning = async () => {
      const moduleName = resolveModule()
      const cached = getCachedSettings()
      if (cached) {
        applyModulePowerScanning(moduleName, cached)
      }

      // Always revalidate from server so theme updates propagate across browsers/devices
      // even when an older localStorage cache exists.
      const settings = await loadBusinessSettings()
      if (settings) {
        applyModulePowerScanning(moduleName, settings)
      }
    }

    applyPowerScanning()
    const handleSettingsUpdate = () => applyPowerScanning()
    window.addEventListener("businessSettingsUpdated", handleSettingsUpdate)
    return () => window.removeEventListener("businessSettingsUpdated", handleSettingsUpdate)
  }, [location.pathname])

  return (
    <>
      <ScrollToTop />
      <PushSoundEnableButton />
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* User Module - Explicitly mapped to /user */}
          <Route
            path="user/*"
            element={<UserRouter />}
          />

          {/* Admin Auth Routes */}
          <Route
            path="admin/login"
            element={
              <AuthRedirect module="admin">
                <AdminLogin />
              </AuthRedirect>
            }
          />
          <Route
            path="admin/signup"
            element={
              <AuthRedirect module="admin">
                <AdminSignup />
              </AuthRedirect>
            }
          />
          <Route
            path="admin/forgot-password"
            element={
              <AuthRedirect module="admin">
                <AdminForgotPassword />
              </AuthRedirect>
            }
          />

          {/* Admin Dashboard Router */}
          <Route
            path="admin/*"
            element={
              <ProtectedRoute requiredRole="admin" loginPath="/food/admin/login">
                <AdminRouter />
              </ProtectedRoute>
            }
          />

          {/* Legacy Redirects & Fallbacks - use absolute path to avoid /user appended in a loop */}
          <Route path="/" element={<Navigate to="/food/user" replace />} />
          <Route path="*" element={<Navigate to="/food/user" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
