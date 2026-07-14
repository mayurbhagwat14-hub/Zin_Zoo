import { Link, useLocation } from "react-router-dom"
import { Home, LayoutGrid, ClipboardList, User } from "lucide-react"
import { useActiveModule, MODULES } from "@food/hooks/useActiveModule"

export default function BottomNavigation() {
  const location = useLocation()
  const pathname = location.pathname
  const activeModuleId = useActiveModule()
  
  const activeModule = MODULES.find(m => m.id === activeModuleId) || MODULES[0];

  // Determine Category path based on module
  let categoryPath = activeModule.path;
  if (activeModuleId === "food") {
    categoryPath = "/food/user/categories";
  } else if (activeModuleId === "accessories") {
    categoryPath = "/food/user/accessories/categories";
  } else if (activeModuleId === "grocery") {
    categoryPath = "/food/user/under-250/categories";
  } else if (activeModuleId === "services") {
    categoryPath = "/food/user/services/categories";
  }

  // Determine active states
  const isHome = pathname === activeModule.path || pathname === activeModule.path + "/";
  const isCategories = pathname.includes("/categories") || (pathname === categoryPath && !isHome);
  
  // If we are in a module where categoryPath === homePath (like grocery),
  // and we want to highlight Home by default. We'll just let Home be highlighted
  // if pathname exactly matches Home path, and Categories if it matches category specific path.
  // Since grocery has no separate category path, clicking Categories will just go to Home, 
  // but Home will be highlighted. This matches the user request of default Home selected.
  const activeHome = isHome && !pathname.includes("/categories");
  const activeCat = pathname.includes("/categories");
  const activeOrders = pathname.includes("/user/orders");
  const activeProfile = pathname.includes("/user/profile");

  const activeColor = "var(--module-theme-color, #F84E04)"
  const activeBg = "rgba(var(--module-theme-rgb, 248,78,4), 0.12)"
  const activeFill = "rgba(var(--module-theme-rgb, 248,78,4), 0.2)"

  return (
    <div className="md:hidden fixed bottom-6 left-5 right-5 z-50 pointer-events-none">
      <div className="flex items-center justify-around h-auto px-4 py-2 bg-white/85 dark:bg-[#1a1a1a]/85 backdrop-blur-[20px] border border-white/50 dark:border-white/10 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.15)] pointer-events-auto">
        
        {/* Home Tab */}
        <Link
          to={activeModule.path}
          className={`flex flex-1 flex-col items-center justify-center gap-1 px-2 py-1.5 transition-all duration-300 relative rounded-full ${activeHome
              ? ""
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
            }`}
          style={activeHome ? { color: activeColor, backgroundColor: activeBg } : undefined}
        >
          <div className="relative">
            <Home className={`h-5 w-5 transition-transform duration-300 ${activeHome ? "scale-110" : "text-gray-500 dark:text-gray-400"}`} strokeWidth={activeHome ? 2.5 : 2} style={activeHome ? { color: activeColor, fill: activeFill } : undefined} />
          </div>
          <span className={`text-[10px] sm:text-xs font-semibold tracking-wide transition-all ${activeHome ? "" : "text-gray-500 dark:text-gray-400 opacity-80"}`}>
            Home
          </span>
        </Link>

        {/* Categories Tab */}
        <Link
          to={categoryPath}
          className={`flex flex-1 flex-col items-center justify-center gap-1 px-2 py-1.5 transition-all duration-300 relative rounded-full ${activeCat
              ? ""
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
            }`}
          style={activeCat ? { color: activeColor, backgroundColor: activeBg } : undefined}
        >
          <div className="relative">
            <LayoutGrid className={`h-5 w-5 transition-transform duration-300 ${activeCat ? "scale-110" : "text-gray-500 dark:text-gray-400"}`} strokeWidth={activeCat ? 2.5 : 2} style={activeCat ? { color: activeColor, fill: activeFill } : undefined} />
          </div>
          <span className={`text-[10px] sm:text-xs font-semibold tracking-wide transition-all ${activeCat ? "" : "text-gray-500 dark:text-gray-400 opacity-80"}`}>
            Categories
          </span>
        </Link>

        {/* Orders Tab */}
        <Link
          to="/food/user/orders"
          className={`flex flex-1 flex-col items-center justify-center gap-1 px-2 py-1.5 transition-all duration-300 relative rounded-full ${activeOrders
              ? ""
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
            }`}
          style={activeOrders ? { color: activeColor, backgroundColor: activeBg } : undefined}
        >
          <div className="relative">
            <ClipboardList className={`h-5 w-5 transition-transform duration-300 ${activeOrders ? "scale-110" : "text-gray-500 dark:text-gray-400"}`} strokeWidth={activeOrders ? 2.5 : 2} style={activeOrders ? { color: activeColor, fill: activeFill } : undefined} />
          </div>
          <span className={`text-[10px] sm:text-xs font-semibold tracking-wide transition-all ${activeOrders ? "" : "text-gray-500 dark:text-gray-400 opacity-80"}`}>
            Orders
          </span>
        </Link>

        {/* Profile Tab */}
        <Link
          to="/food/user/profile"
          className={`flex flex-1 flex-col items-center justify-center gap-1 px-2 py-1.5 transition-all duration-300 relative rounded-full ${activeProfile
              ? ""
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
            }`}
          style={activeProfile ? { color: activeColor, backgroundColor: activeBg } : undefined}
        >
          <div className="relative">
            <User className={`h-5 w-5 transition-transform duration-300 ${activeProfile ? "scale-110" : "text-gray-500 dark:text-gray-400"}`} strokeWidth={activeProfile ? 2.5 : 2} style={activeProfile ? { color: activeColor, fill: activeFill } : undefined} />
          </div>
          <span className={`text-[10px] sm:text-xs font-semibold tracking-wide transition-all ${activeProfile ? "" : "text-gray-500 dark:text-gray-400 opacity-80"}`}>
            Profile
          </span>
        </Link>

      </div>
    </div>
  )
}
