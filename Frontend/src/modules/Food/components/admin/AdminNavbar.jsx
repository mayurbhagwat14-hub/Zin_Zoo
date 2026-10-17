import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  User,
  ChevronDown,
  UtensilsCrossed,
  LogOut,
  Settings,
  FileText,
  Package,
  Users,
  AlertCircle,
  ArrowRight,
  Building2,
  Utensils,
  Grid,
  PlusCircle,
  Bell,
  BellOff,
  Sun,
  Moon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu";
import { Input } from "@food/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@food/components/ui/popover";
import quickSpicyLogo from "@food/assets/zinzoox-logo.png";
import { adminAPI } from "@food/api";
import { clearModuleAuth } from "@food/utils/auth";
import { getCachedSettings, loadBusinessSettings } from "@food/utils/businessSettings";
import useAdminNotifications from "@food/hooks/useAdminNotifications";
import { adminAlertSound } from "@food/utils/adminAlertSound";
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function AdminNavbar({ onMenuClick }) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("adminTheme") || "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("adminTheme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [businessSettings, setBusinessSettings] = useState(() => getCachedSettings() || null);
  const searchInputRef = useRef(null);
  const { items: adminNotifications, unreadCount, dismissOne, clearAll } = useAdminNotifications();

  // Load business settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const cached = getCachedSettings();
        if (cached) {
          setBusinessSettings(cached);
        } else {
          const settings = await loadBusinessSettings();
          if (settings) {
            setBusinessSettings(settings);
          }
        }
      } catch (error) {
        debugError('Error loading settings:', error);
      }
    };
    loadSettings();

    // Listen for business settings updates
    const handleSettingsUpdate = () => {
      const settings = getCachedSettings();
      if (settings) {
        setBusinessSettings(settings);
      }
    };
    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate);
  }, []);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('admin_recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        setRecentSearches([]);
      }
    }
  }, []);

  // Universal Search logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        setIsSearching(true);
        try {
          const response = await adminAPI.globalSearch(searchQuery);
          if (response?.data?.success) {
            setSearchResults(response.data.data || []);
          }
        } catch (error) {
          debugError('Error searching:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const groupedResults = useMemo(() => {
    const groups = {};
    searchResults.forEach((res) => {
      if (!groups[res.type]) groups[res.type] = [];
      groups[res.type].push(res);
    });
    return groups;
  }, [searchResults]);

  const handleResultClick = (result) => {
    // Save to recent searches
    const updatedRecent = [
      result.title,
      ...recentSearches.filter(s => s !== result.title)
    ].slice(0, 5);
    setRecentSearches(updatedRecent);
    localStorage.setItem('admin_recent_searches', JSON.stringify(updatedRecent));

    setSearchOpen(false);
    setSearchQuery("");
    navigate(result.path);
  };

  const handleRecentClick = (term) => {
    setSearchQuery(term);
  };

  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('admin_recent_searches');
  };

  // Load admin data from localStorage
  useEffect(() => {
    const loadAdminData = () => {
      try {
        const adminUserStr = localStorage.getItem('admin_user');
        if (adminUserStr) {
          const adminUser = JSON.parse(adminUserStr);
          setAdminData(adminUser);
        }
      } catch (error) {
        debugError('Error loading admin data:', error);
      }
    };

    loadAdminData();

    // Listen for auth changes
    const handleAuthChange = () => {
      loadAdminData();
    };
    window.addEventListener('adminAuthChanged', handleAuthChange);

    return () => {
      window.removeEventListener('adminAuthChanged', handleAuthChange);
    };
  }, []);

  // Keyboard shortcut for search (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  // Focus search input when modal opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [searchOpen]);

  // Handle logout
  const handleLogout = async () => {
    try {
      // Call backend logout API to clear refresh token cookie
      try {
        await adminAPI.logout();
      } catch (apiError) {
        // Continue with logout even if API call fails (network issues, etc.)
        debugWarn("Logout API call failed, continuing with local cleanup:", apiError);
      }

      // Clear admin authentication and preference data from localStorage
      clearModuleAuth('admin');
      localStorage.removeItem('admin_accessToken');
      localStorage.removeItem('admin_authenticated');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_sidebar_state');
      localStorage.removeItem('admin_recent_searches');

      // Clear sessionStorage if any
      sessionStorage.removeItem('adminAuthData');

      // Dispatch auth change event to notify other components
      window.dispatchEvent(new Event('adminAuthChanged'));

      // Navigate to admin login page
      navigate('/admin/login', { replace: true });
    } catch (error) {
      // Even if there's an error, we should still clear local data and logout
      debugError("Error during logout:", error);

      // Clear local data anyway
      clearModuleAuth('admin');
      localStorage.removeItem('admin_accessToken');
      localStorage.removeItem('admin_authenticated');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_sidebar_state');
      localStorage.removeItem('admin_recent_searches');
      sessionStorage.removeItem('adminAuthData');
      window.dispatchEvent(new Event('adminAuthChanged'));

      // Navigate to login
      navigate('/admin/login', { replace: true });
    }
  };

  const notificationCount = unreadCount || 0;
  const openNotificationsPage = () => {
    adminAlertSound.stopAlert();
    setNotificationsOpen(false);
    navigate("/admin/food/notifications");
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white dark:bg-[#1a1a1a] border-b border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 gap-2">
          {/* Left: Logo and Mobile Menu */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-24 sm:w-32 h-9 sm:h-12 flex items-center justify-center overflow-hidden">
                <img
                  src="/zinzoo-logo.png"
                  alt={businessSettings?.companyName || "Company"}
                  className="w-[160px] sm:w-[200px] h-[160px] sm:h-[200px] max-w-none object-contain"
                  style={{ mixBlendMode: "multiply" }}
                  loading="lazy"
                />
              </div>
            </div>
          </div>

          {/* Center: Search Bar (Desktop) */}
          <div className="flex-1 hidden md:flex justify-center max-w-md mx-4 lg:mx-8">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-100 dark:bg-[#262626] text-neutral-600 dark:text-neutral-400 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors w-full border border-neutral-200 dark:border-neutral-800"
            >
              <Search className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
              <span className="text-sm flex-1 text-left text-neutral-700 dark:text-neutral-300">Search</span>
              <span className="text-xs px-2 py-0.5 rounded bg-white dark:bg-[#1a1a1a] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800">
                Ctrl+K
              </span>
            </button>
          </div>

          {/* Right: User Profile & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Mobile Search Icon Button */}
            <button
              onClick={() => setSearchOpen(true)}
              type="button"
              className="md:hidden h-9 w-9 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#262626] text-neutral-700 dark:text-neutral-300 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              type="button"
              className="h-9 w-9 sm:h-11 sm:w-11 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#262626] text-neutral-700 dark:text-neutral-300 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="relative h-9 w-9 sm:h-11 sm:w-11 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#262626] text-neutral-700 dark:text-neutral-300 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  {notificationCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 min-w-3.5 h-3.5 sm:min-w-4 sm:h-4 rounded-full bg-amber-500 text-white text-[9px] sm:text-[10px] font-bold flex items-center justify-center px-0.5 sm:px-1">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-96 p-0 mt-2 border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-2xl overflow-hidden" align="end">
                <div className="bg-white dark:bg-[#1a1a1a]">
                  <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Notifications</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Approval and support alerts</p>
                    </div>
                    <button
                      type="button"
                      onClick={openNotificationsPage}
                      className="text-xs font-semibold text-amber-600 hover:text-amber-700"
                    >
                      View all
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {adminNotifications.length === 0 ? (
                      <div className="px-6 py-10 text-center flex flex-col items-center gap-2">
                        <BellOff className="w-9 h-9 text-neutral-300 dark:text-neutral-700" />
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">No notifications yet</p>
                      </div>
                    ) : (
                      adminNotifications.slice(0, 8).map((item) => (
                        <button
                          key={item?.id}
                          type="button"
                          onClick={openNotificationsPage}
                          className="w-full text-left px-4 py-4 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                {item?.title || "Notification"}
                              </p>
                              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
                                {item?.message || "-"}
                              </p>
                              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2">
                                {item?.metaLabel || item?.category || "Admin alert"}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] text-neutral-400 dark:text-neutral-500">
                              {item?.timeLabel || "Now"}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* User Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2 pl-3 border-l border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md px-2 py-1 transition-colors">

                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {adminData?.name || "Admin User"}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {adminData?.email
                        ? (() => {
                          const [local, domain] = adminData.email.split("@");
                          return (
                            local[0] +
                            "*".repeat(Math.min(local.length - 1, 5)) +
                            "@" +
                            domain
                          );
                        })()
                        : "admin@example.com"}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-700 dark:text-neutral-300 hidden md:block" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg z-50 text-neutral-900 dark:text-neutral-100 animate-in fade-in-0 zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
              >
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden border border-neutral-300">
                      {adminData?.profileImage ? (
                        <img
                          src={adminData.profileImage && adminData.profileImage.trim() ? adminData.profileImage : undefined}
                          alt={adminData.name || "Admin"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-semibold text-neutral-600">
                          {adminData?.name
                            ? adminData.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .substring(0, 2)
                            : "AD"}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {adminData?.name || "Admin User"}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {adminData?.email
                          ? (() => {
                            const [local, domain] = adminData.email.split("@");
                            return (
                              local[0] +
                              "*".repeat(Math.min(local.length - 1, 5)) +
                              "@" +
                              domain
                            );
                          })()
                          : "admin@example.com"}
                      </p>
                    </div>
                  </div>
                </div>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:bg-neutral-100 dark:focus:bg-neutral-800"
                    onClick={() => navigate("/admin/food/profile")}
                  >
                    <User className="mr-2 w-4 h-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:bg-neutral-100 dark:focus:bg-neutral-800"
                    onClick={() => navigate("/admin/food/settings")}
                  >
                    <Settings className="mr-2 w-4 h-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="dark:bg-neutral-800" />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 focus:bg-red-50 dark:focus:bg-red-950/20"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 w-4 h-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Search Modal */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl p-0 bg-white dark:bg-neutral-900 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 ease-in-out data-[state=open]:scale-100 data-[state=closed]:scale-100 border border-neutral-200 dark:border-neutral-800">
          <DialogHeader className="p-6 pb-4 border-b border-neutral-200 dark:border-neutral-800">
            <DialogTitle className="text-xl font-semibold text-neutral-900 dark:text-white">
              Universal Search
            </DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search orders, users, products, reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-3 text-base border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-500 focus:border-black dark:focus:border-white focus:ring-black dark:focus:ring-white"
              />
            </div>

            {searchQuery.trim() === "" ? (
              <div className="space-y-4">
                <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Quick Actions</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Package, label: "Orders", path: "/admin/food/orders/all" },
                    { icon: Users, label: "Users", path: "/admin/food/customers" },
                    { icon: UtensilsCrossed, label: "Products", path: "/admin/food/foods" },
                    { icon: FileText, label: "Reports", path: "/admin/food/transaction-report" },
                  ].map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSearchOpen(false);
                        navigate(action.path);
                      }}
                      className="flex items-center gap-3 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all"
                    >
                      <div className="p-2 rounded-md bg-black dark:bg-white text-white dark:text-black">
                        <action.icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{action.label}</span>
                    </button>
                  ))}
                </div>
                {recentSearches.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Recent Searches</p>
                      <button onClick={clearRecent} className="text-[10px] text-red-500 dark:text-red-400 hover:underline">Clear All</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((term, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleRecentClick(term)}
                          className="px-3 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full text-neutral-700 dark:text-neutral-300 transition-colors"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {isSearching ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white mx-auto mb-3"></div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Searching...</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">No results found for "{searchQuery}"</p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 ml-1">
                      {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
                    </div>
                    {Object.entries(groupedResults).map(([type, results]) => (
                      <div key={type} className="mb-4">
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                            {type}s
                          </span>
                          <div className="h-px flex-1 bg-neutral-100 dark:bg-neutral-800"></div>
                        </div>
                        <div className="space-y-2">
                          {results.map((result, idx) => (
                            <button
                              key={`${type}-${idx}`}
                              onClick={() => handleResultClick(result)}
                              className="w-full flex items-center gap-3 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all text-left group"
                            >
                              <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400 group-hover:bg-white dark:group-hover:bg-neutral-700 group-hover:text-black dark:group-hover:text-white transition-colors">
                                {result.type === 'Order' && <Package className="w-5 h-5" />}
                                {result.type === 'User' && <User className="w-5 h-5" />}
                                {result.type === 'Restaurant' && <Building2 className="w-5 h-5" />}
                                {result.type === 'Product' && <Utensils className="w-5 h-5" />}
                                {result.type === 'Category' && <Grid className="w-5 h-5" />}
                                {result.type === 'Addon' && <PlusCircle className="w-5 h-5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                  {result.title}
                                </p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                                  {result.description}
                                </p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-black dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


