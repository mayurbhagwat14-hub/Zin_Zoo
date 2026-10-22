/**
 * JWT Token Utilities
 * Decode and extract information from JWT tokens
 */

/**
 * Decode JWT token without verification (client-side only)
 * @param {string} token - JWT token
 * @returns {Object|null} - Decoded token payload or null if invalid
 */
export function decodeToken(token) {
  if (!token) return null;

  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode base64url encoded payload
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    
    return decoded;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

/**
 * Get user role from token
 * @param {string} token - JWT token
 * @returns {string|null} - User role or null if not found
 */
export function getRoleFromToken(token) {
  const decoded = decodeToken(token);
  return decoded?.role || null;
}

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @param {number} bufferSeconds - Optional buffer to treat token as expired N seconds before actual expiry (for proactive refresh)
 * @returns {boolean} - True if expired or invalid
 */
export function isTokenExpired(token, bufferSeconds = 0) {
  if (!token || typeof token !== 'string') return true;
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  
  // exp is in seconds, Date.now() is in milliseconds
  return (decoded.exp - bufferSeconds) * 1000 < Date.now();
}

/**
 * Get remaining seconds until token expiry
 * @param {string} token - JWT token
 * @returns {number} - Seconds remaining, 0 if expired or invalid
 */
export function getTokenRemainingSeconds(token) {
  if (!token || typeof token !== 'string') return 0;
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return 0;
  const remaining = decoded.exp - Math.floor(Date.now() / 1000);
  return Math.max(0, remaining);
}

/**
 * Get user ID from token
 * @param {string} token - JWT token
 * @returns {string|null} - User ID or null if not found
 */
export function getUserIdFromToken(token) {
  const decoded = decodeToken(token);
  return decoded?.userId || decoded?.id || null;
}

/**
 * Check if user has access to a module based on role
 * @param {string} role - User role
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {boolean} - True if user has access
 */
export function hasModuleAccess(role, module) {
  const roleModuleMap = {
    'admin': 'admin',
    'restaurant': 'restaurant',
    'delivery': 'delivery',
    'user': 'user'
  };

  return roleModuleMap[role] === module;
}

/**
 * Get module-specific access token
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {string|null} - Access token or null
 */
export function getModuleToken(module) {
  return localStorage.getItem(`${module}_accessToken`);
}

/**
 * Get module-specific refresh token (fallback for WebView environments where cookies may be unreliable)
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {string|null} - Refresh token or null
 */
export function getModuleRefreshToken(module) {
  return localStorage.getItem(`${module}_refreshToken`);
}

/**
 * Get current user's role from a specific module's storage/token
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {string|null} - Current user role or null
 */
export function getCurrentUserRole(module = null) {
  if (module) {
    const userStr = localStorage.getItem(`${module}_user`);
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.role || module;
      } catch (e) {
        return module;
      }
    }
  }
  return module || 'user';
}

/**
 * Get current user object from specific module's storage
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {Object|null} - User object or null
 */
export function getCurrentUser(module) {
  if (!module) return null;
  const userStr = localStorage.getItem(`${module}_user`);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

/**
 * Check if user is authenticated for a specific module.
 * Considers the user authenticated if:
 * 1. A valid (non-expired) access token exists, OR
 * 2. A valid (non-expired) refresh token exists (silent refresh will be attempted)
 * 3. The access token string exists and is a JWT-looking string (3 dot-separated parts)
 *    even if we can't decode the expiry — gives benefit of the doubt and lets the
 *    server-side validation decide.
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {boolean} - True if authenticated
 */
export function isModuleAuthenticated(module) {
  const token = getModuleToken(module);
  if (token && !isTokenExpired(token)) {
    return true;
  }
  // If access token is expired or missing, check if a valid refresh token exists
  const refreshToken = getModuleRefreshToken(module);
  if (refreshToken) {
    // If refresh token string looks like a JWT, consider authenticated
    // even if we can't decode it — the server will validate
    if (!isTokenExpired(refreshToken)) {
      return true;
    }
    // Even if refresh token appears expired by client clock, give benefit of doubt
    // if it's still a valid JWT structure (clock skew protection)
    const decoded = decodeToken(refreshToken);
    if (decoded && decoded.exp) {
      // Allow 5 minutes of clock skew
      const isWithinClockSkew = (decoded.exp + 300) * 1000 > Date.now();
      if (isWithinClockSkew) return true;
    }
  }
  return false;
}

/**
 * Clear authentication data for a specific module
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 */
export function clearModuleAuth(module) {
  localStorage.removeItem(`${module}_accessToken`);
  localStorage.removeItem(`${module}_refreshToken`);
  localStorage.removeItem(`${module}_authenticated`);
  localStorage.removeItem(`${module}_user`);
  // Clear cached FCM web token for this module
  localStorage.removeItem(`fcm_web_registered_token_${module}`);
  if (module === "restaurant") {
    clearRestaurantSessionCache();
  }
  // Also clear any sessionStorage data
  sessionStorage.removeItem(`${module}AuthData`);
}

/**
 * Clear restaurant-local cached UI data to prevent cross-account stale state.
 */
export function clearRestaurantSessionCache() {
  const keys = [
    "restaurant_owner_contact",
    "restaurant_onboarding",
    "restaurant_onboarding_data",
    "restaurant_invited_users",
    "restaurant_schedule_off",
    "restaurant_online_status",
    "restaurant_outlet_timings",
    "restaurant_hub_menu_active_tab",
    "restaurant_name",
    "restaurantName",
    "restaurant_pendingPhone",
  ];

  keys.forEach((key) => localStorage.removeItem(key));
}

export function setRestaurantPendingPhone(phone) {
  if (typeof localStorage === "undefined") return;
  if (!phone) {
    localStorage.removeItem("restaurant_pendingPhone");
    return;
  }
  localStorage.setItem("restaurant_pendingPhone", phone);
}

export function getRestaurantPendingPhone() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("restaurant_pendingPhone");
}

export function clearRestaurantPendingPhone() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem("restaurant_pendingPhone");
}

/**
 * Clear all authentication data for all modules
 */
export function clearAuthData() {
  const modules = ['admin', 'restaurant', 'delivery', 'user'];
  modules.forEach(module => {
    clearModuleAuth(module);
  });
  // Also clear legacy token if it exists
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
}

/**
 * Set authentication data for a specific module
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @param {string} token - Access token
 * @param {Object} user - User data
 * @param {string|null} refreshToken - Optional refresh token
 * @throws {Error} If localStorage is not available or quota exceeded
 */
export function setAuthData(module, token, user, refreshToken = null) {
  try {
    // Check if localStorage is available
    if (typeof Storage === 'undefined' || !localStorage) {
      throw new Error('localStorage is not available');
    }

    // Validate inputs
    if (!module || !token) {
      throw new Error(`Invalid parameters: module=${module}, token=${!!token}`);
    }

    console.log(`[setAuthData] Storing auth for module: ${module}`, {
      hasToken: !!token,
      tokenLength: token?.length,
      hasUser: !!user
    });

    // Store module-specific token (don't clear other modules)
    const tokenKey = `${module}_accessToken`;
    const refreshTokenKey = `${module}_refreshToken`;
    const authKey = `${module}_authenticated`;
    const userKey = `${module}_user`;

    // Prevent stale restaurant profile data from previous account after re-login.
    if (module === "restaurant") {
      clearRestaurantSessionCache();
    }

    localStorage.setItem(tokenKey, token);
    if (refreshToken && typeof refreshToken === "string") {
      localStorage.setItem(refreshTokenKey, refreshToken);
    }
    localStorage.setItem(authKey, 'true');
    
    if (user) {
      try {
        localStorage.setItem(userKey, JSON.stringify(user));
      } catch (userError) {
        console.warn('Failed to store user data, but token was stored:', userError);
        // Don't throw - token storage is more important
      }
    }

    // Verify the token was stored correctly
    const storedToken = localStorage.getItem(tokenKey);
    const storedAuth = localStorage.getItem(authKey);
    
    if (storedToken !== token) {
      console.error(`[setAuthData] Token mismatch:`, {
        expected: token?.substring(0, 20) + '...',
        stored: storedToken?.substring(0, 20) + '...'
      });
      throw new Error(`Token storage verification failed for module: ${module}`);
    }

    if (storedAuth !== 'true') {
      console.error(`[setAuthData] Auth flag mismatch:`, {
        expected: 'true',
        stored: storedAuth
      });
      throw new Error(`Authentication flag storage failed for module: ${module}`);
    }

    console.log(`[setAuthData] Successfully stored auth data for ${module}`);
    try {
      scheduleProactiveRefresh(module);
    } catch (_) {}
  } catch (error) {
    // If quota exceeded, try to clear some space
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.warn('localStorage quota exceeded. Attempting to clear old data...');
      // Clear legacy tokens
      try {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        // Retry storing
        localStorage.setItem(`${module}_accessToken`, token);
        if (refreshToken && typeof refreshToken === "string") {
          localStorage.setItem(`${module}_refreshToken`, refreshToken);
        }
        localStorage.setItem(`${module}_authenticated`, 'true');
        if (user) {
          localStorage.setItem(`${module}_user`, JSON.stringify(user));
        }
        
        // Verify again after retry
        const storedToken = localStorage.getItem(`${module}_accessToken`);
        if (storedToken !== token) {
          throw new Error('Token storage failed even after clearing space');
        }
      } catch (retryError) {
        console.error('Failed to store auth data after clearing space:', retryError);
        throw new Error('Unable to store authentication data. Please clear browser storage and try again.');
      }
    } else {
      console.error('[setAuthData] Error storing auth data:', error);
      throw error;
    }
  }
}

// ─── Proactive Background Token Refresh ─────────────────────────────────────
// Refreshes access tokens in the background BEFORE they expire,
// just like mobile apps do — so the user never gets logged out unexpectedly.

const _refreshTimers = {}; // module -> timeoutId

/**
 * Schedule a proactive background refresh for a module's access token.
 * Automatically refreshes at 80% of the token's lifetime to prevent expiry.
 * Call this after login and after each successful refresh.
 * @param {string} module - Module name (user, admin, restaurant, delivery)
 */
export function scheduleProactiveRefresh(module) {
  if (!module) return;

  // Clear any existing timer for this module
  if (_refreshTimers[module]) {
    clearTimeout(_refreshTimers[module]);
    delete _refreshTimers[module];
  }

  const token = getModuleToken(module);
  if (!token) return;

  const remainingSeconds = getTokenRemainingSeconds(token);
  if (remainingSeconds <= 0) return; // Already expired, let ProtectedRoute/axios handle it

  // Refresh when token is at 80% of lifetime or has <= 2 days left.
  // Cap timer delay to max 12 hours (43,200 seconds) to avoid 32-bit setTimeout integer overflow.
  const MAX_TIMER_SECONDS = 43200; // 12 hours
  const shouldRefreshNow = remainingSeconds <= 172800; // <= 2 days left
  const targetSeconds = shouldRefreshNow ? Math.max(60, Math.floor(remainingSeconds * 0.5)) : MAX_TIMER_SECONDS;
  const refreshInSeconds = Math.min(targetSeconds, MAX_TIMER_SECONDS);

  console.log(
    `[ProactiveRefresh] ${module} token check scheduled in ${Math.round(refreshInSeconds / 60)} minutes ` +
    `(token expires in ${Math.round(remainingSeconds / 3600)} hours)`
  );

  _refreshTimers[module] = setTimeout(async () => {
    delete _refreshTimers[module];

    // Re-check remaining seconds
    const currentToken = getModuleToken(module);
    const curRemaining = getTokenRemainingSeconds(currentToken);
    // If token still has more than 2 days left, just reschedule the check
    if (curRemaining > 172800) {
      scheduleProactiveRefresh(module);
      return;
    }

    const refreshToken = getModuleRefreshToken(module);
    if (!refreshToken) return;

    try {
      const baseURL =
        typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
          ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')
          : '';

      let refreshUrl = '/api/v1/food/auth/refresh-token';
      if (baseURL) {
        if (baseURL.endsWith('/api/v1')) {
          refreshUrl = `${baseURL}/food/auth/refresh-token`;
        } else if (baseURL.endsWith('/api')) {
          refreshUrl = `${baseURL}/v1/food/auth/refresh-token`;
        } else {
          refreshUrl = `${baseURL}/api/v1/food/auth/refresh-token`;
        }
      }

      const { default: axios } = await import('axios');
      const { data } = await axios.post(refreshUrl, { refreshToken }, { timeout: 15000 });
      const newAccessToken = data?.data?.accessToken || data?.accessToken;
      const newRefreshToken = data?.data?.refreshToken || data?.refreshToken;

      if (newAccessToken) {
        localStorage.setItem(`${module}_accessToken`, newAccessToken);
        if (newRefreshToken && typeof newRefreshToken === 'string') {
          localStorage.setItem(`${module}_refreshToken`, newRefreshToken);
        }
        console.log(`[ProactiveRefresh] ✅ ${module} token refreshed successfully in background`);

        // Dispatch event so any listeners (e.g., socket reconnect) can pick up the new token
        try {
          window.dispatchEvent(new CustomEvent('authRefreshed', {
            detail: { module, token: newAccessToken }
          }));
        } catch (_) {}

        // Schedule the next refresh for the new token
        scheduleProactiveRefresh(module);
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status && status >= 400 && status < 500) {
        // Refresh token is definitively invalid — don't retry
        console.warn(`[ProactiveRefresh] ${module} refresh token rejected by server (${status}). User will need to re-login.`);
      } else {
        // Network error — retry in 2 minutes
        console.warn(`[ProactiveRefresh] ${module} refresh failed (network/server error), retrying in 2 minutes`);
        _refreshTimers[module] = setTimeout(() => scheduleProactiveRefresh(module), 120000);
      }
    }
  }, refreshInSeconds * 1000);
}

/**
 * Initialize proactive refresh for all currently authenticated modules.
 * Call this once on app startup.
 */
export function initializeProactiveRefresh() {
  const modules = ['user', 'admin', 'restaurant', 'delivery'];
  for (const module of modules) {
    if (isModuleAuthenticated(module)) {
      scheduleProactiveRefresh(module);
    }
  }
}

// Listen for authRefreshFailed events from axios interceptor —
// only clear auth for definitive server rejections (handled in axios.js),
// not for network errors.
if (typeof window !== 'undefined') {
  window.addEventListener('authRefreshFailed', (event) => {
    const { module } = event.detail || {};
    if (module) {
      console.warn(`[Auth] Refresh definitively failed for ${module}, clearing auth.`);
      clearModuleAuth(module);
    }
  });

  // Listen for visibility change — when user comes back to the tab,
  // check if tokens need refreshing
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const modules = ['user', 'admin', 'restaurant', 'delivery'];
      for (const mod of modules) {
        const token = getModuleToken(mod);
        if (token && isModuleAuthenticated(mod)) {
          // If token is expired or about to expire (within 24 hours), trigger refresh
          if (isTokenExpired(token, 86400)) {
            scheduleProactiveRefresh(mod);
          }
        }
      }
    }
  });
}
