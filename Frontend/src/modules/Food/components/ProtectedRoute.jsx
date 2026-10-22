import { useEffect, useState, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isModuleAuthenticated, getModuleToken, getModuleRefreshToken, isTokenExpired, scheduleProactiveRefresh } from "@food/utils/auth";
import { restaurantAPI } from "@food/api";
import axios from "axios";

const baseURL =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, "")
    : "";

const REFRESH_LOCK_KEY = (module) => `zinzoo_refresh_lock_${module}`;
const REFRESH_LOCK_TTL = 8000; // 8 seconds — covers the 10s request timeout

/**
 * Silently refreshes the access token using the stored refresh token.
 * Uses a localStorage-based lock to prevent parallel calls across tabs.
 * Returns { success: true, token } or { success: false, reason: "invalid" | "network" }.
 */
async function silentRefresh(module) {
  const refreshToken = getModuleRefreshToken(module);
  if (!refreshToken) return { success: false, reason: "invalid" };

  const lockKey = REFRESH_LOCK_KEY(module);

  // --- Cross-tab lock: check if another tab is already refreshing ---
  const existingLock = localStorage.getItem(lockKey);
  if (existingLock) {
    const lockTime = parseInt(existingLock, 10);
    if (Date.now() - lockTime < REFRESH_LOCK_TTL) {
      // Another tab is refreshing — wait for it to finish, then reuse its token
      await new Promise((resolve) => setTimeout(resolve, REFRESH_LOCK_TTL));
      const savedToken = localStorage.getItem(`${module}_accessToken`);
      if (savedToken && !isTokenExpired(savedToken)) {
        return { success: true, token: savedToken };
      }
      return { success: false, reason: "invalid" };
    }
    // Lock is stale — clear it and proceed
    localStorage.removeItem(lockKey);
  }

  // Acquire lock
  try { localStorage.setItem(lockKey, String(Date.now())); } catch (_) {}

  try {
    let refreshUrl = "/api/v1/food/auth/refresh-token";
    if (baseURL) {
      if (baseURL.endsWith("/api/v1")) {
        refreshUrl = `${baseURL}/food/auth/refresh-token`;
      } else if (baseURL.endsWith("/api")) {
        refreshUrl = `${baseURL}/v1/food/auth/refresh-token`;
      } else {
        refreshUrl = `${baseURL}/api/v1/food/auth/refresh-token`;
      }
    }
    const { data } = await axios.post(refreshUrl, { refreshToken }, { timeout: 10000 });
    const newAccessToken = data?.data?.accessToken || data?.accessToken;
    const newRefreshToken = data?.data?.refreshToken || data?.refreshToken;
    if (newAccessToken) {
      try {
        localStorage.setItem(`${module}_accessToken`, newAccessToken);
        // Save the rotated refresh token so next refresh uses the new one
        if (newRefreshToken && typeof newRefreshToken === "string") {
          localStorage.setItem(`${module}_refreshToken`, newRefreshToken);
        }
        scheduleProactiveRefresh(module);
      } catch (_) {}
      return { success: true, token: newAccessToken };
    }
    return { success: false, reason: "invalid" };
  } catch (err) {
    if (err.response && err.response.status >= 400 && err.response.status < 500) {
      // Client errors (401, 403, 400) mean the token is definitively invalid
      return { success: false, reason: "invalid" };
    }
    // Network errors, timeouts, 500+ server errors — do NOT log user out
    return { success: false, reason: "network" };
  } finally {
    // Release lock
    try { localStorage.removeItem(lockKey); } catch (_) {}
  }
}

/**
 * Computes the initial auth state synchronously from localStorage.
 * Called once during component initialization.
 */
function getInitialAuthState(requiredRole) {
  if (!requiredRole) return "authenticated";
  if (isModuleAuthenticated(requiredRole)) return "authenticated";
  if (getModuleRefreshToken(requiredRole)) return "refreshing";
  return "unauthenticated";
}

/**
 * Role-based Protected Route Component
 * Only allows access if user is authenticated for the specific module.
 * On app restart, if the access token is expired but a refresh token exists,
 * it silently refreshes before deciding to redirect to login.
 *
 * IMPORTANT: All hooks are declared unconditionally at the top to comply with
 * React's Rules of Hooks. Early returns based on role check are done via state.
 */
export default function ProtectedRoute({ children, requiredRole, loginPath = "/food/user/auth/login" }) {
  const location = useLocation();
  const isRestaurantRoute = requiredRole === "restaurant";

  // --- ALL hooks declared unconditionally ---
  // Use a ref to hold the initial state so it's only computed ONCE and not
  // affected by React 18 Strict Mode's double-invoke behavior.
  const initialAuthStateRef = useRef(null);
  if (initialAuthStateRef.current === null) {
    initialAuthStateRef.current = getInitialAuthState(requiredRole);
  }

  const [authState, setAuthState] = useState(initialAuthStateRef.current);
  const [isSubscriptionCheckDone, setIsSubscriptionCheckDone] = useState(!isRestaurantRoute);
  const [serverRequiresPayment, setServerRequiresPayment] = useState(false);

  // --- Silent token refresh effect ---
  useEffect(() => {
    // If no role required or already authenticated, nothing to do
    if (!requiredRole || authState !== "refreshing") return;

    let cancelled = false;

    silentRefresh(requiredRole).then((result) => {
      if (cancelled) return;
      if (result.success && result.token && !isTokenExpired(result.token)) {
        setAuthState("authenticated");
        try {
          window.dispatchEvent(new CustomEvent("authRefreshed", {
            detail: { module: requiredRole, token: result.token }
          }));
        } catch (_) {}
      } else if (result.reason === "network") {
        // Network error on startup — do NOT log the user out.
        // The Axios interceptor will handle the refresh on the first API call.
        setAuthState("authenticated");
      } else {
        // Token is definitively invalid — clear stale data and redirect to login
        try {
          localStorage.removeItem(`${requiredRole}_accessToken`);
          localStorage.removeItem(`${requiredRole}_refreshToken`);
          localStorage.removeItem(`${requiredRole}_authenticated`);
        } catch (_) {}
        setAuthState("unauthenticated");
      }
    });

    return () => { cancelled = true; };
  }, [requiredRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Restaurant subscription check effect ---
  useEffect(() => {
    if (!requiredRole || !isRestaurantRoute || authState !== "authenticated") return;

    let active = true;
    const allowedPaths = [
      "/food/restaurant/onboarding-payment",
      "/food/restaurant/onboarding",
      "/food/restaurant/pending-verification",
    ];

    if (allowedPaths.includes(location.pathname)) {
      setIsSubscriptionCheckDone(true);
      setServerRequiresPayment(false);
      return () => { active = false; };
    }

    const syncRestaurantSubscription = async () => {
      try {
        const [restaurantResult, featureResult] = await Promise.allSettled([
          restaurantAPI.getCurrentRestaurant(),
          restaurantAPI.getFeatureSettingsPublic(),
        ]);
        const response =
          restaurantResult.status === "fulfilled" ? restaurantResult.value : null;
        const featureRes =
          featureResult.status === "fulfilled" ? featureResult.value : null;

        const restaurant =
          response?.data?.data?.restaurant ||
          response?.data?.restaurant ||
          null;

        if (!restaurant) {
          if (active) setServerRequiresPayment(true);
          return;
        }
        if (restaurant) {
          localStorage.setItem("restaurant_user", JSON.stringify(restaurant));
        }

        const rows = Array.isArray(featureRes?.data?.data) ? featureRes.data.data : [];
        const feature = rows.find((row) => row.key === "restaurant_subscription");
        const subscriptionFeatureEnabled = feature ? Boolean(feature.isEnabled) : true;
        localStorage.setItem("restaurant_subscription_feature_enabled", String(subscriptionFeatureEnabled));

        const onboardingFeePaid = Boolean(restaurant?.onboardingFeePaid);
        const expiryRaw = restaurant?.subscriptionValidTill;
        const expiryMs = expiryRaw ? new Date(expiryRaw).getTime() : NaN;
        const isExpired = Number.isFinite(expiryMs) && expiryMs < Date.now();
        const shouldBlock = subscriptionFeatureEnabled && (!onboardingFeePaid || isExpired);

        if (active) setServerRequiresPayment(shouldBlock);
      } catch {
        if (active) setServerRequiresPayment(true);
      } finally {
        if (active) setIsSubscriptionCheckDone(true);
      }
    };

    syncRestaurantSubscription();
    return () => { active = false; };
  }, [isRestaurantRoute, authState, location.pathname, requiredRole]);

  // --- Render logic (all hooks already declared above) ---

  // If no role required, allow access unconditionally
  if (!requiredRole) {
    return children;
  }

  // Show nothing (blank) while silently refreshing the token
  if (authState === "refreshing") {
    return null;
  }

  // Not authenticated and refresh definitively failed → redirect to login
  if (authState === "unauthenticated") {
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
  }

  // User is authenticated — apply restaurant subscription gate if needed
  if (isRestaurantRoute) {
    if (!isSubscriptionCheckDone) return null;
    if (serverRequiresPayment) {
      return <Navigate to="/food/restaurant/onboarding-payment" replace />;
    }
  }

  return children;
}
