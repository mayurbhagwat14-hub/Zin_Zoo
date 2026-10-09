import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ChevronDown, Search, Bell, CheckCircle2, Tag, Gift, AlertCircle, Clock, BellOff, X, IndianRupee } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@food/components/ui/popover";
import { Badge } from "@food/components/ui/badge";
import { Avatar, AvatarFallback } from "@food/components/ui/avatar";
import foodIcon from "@food/assets/category-icons/food.png";
import quickIcon from "@food/assets/category-icons/quick.png";
import taxiIcon from "@food/assets/category-icons/taxi.png";
import hotelIcon from "@food/assets/category-icons/hotel.png";
import useNotificationInbox from "@food/hooks/useNotificationInbox";
// import ModuleSwitcher from "../ModuleSwitcher"; // Removed
import HeaderCartIcon from "../HeaderCartIcon";
import HeaderNotificationBell from "../HeaderNotificationBell";

const ICON_MAP = {
  CheckCircle2,
  Tag,
  Gift,
  AlertCircle
};

const DEFAULT_PLACEHOLDERS = [
  'Search "burger"',
  'Search "biryani"',
  'Search "pizza"',
  'Search "desserts"',
  'Search "chinese"',
  'Search "thali"',
  'Search "momos"',
  'Search "dosa"',
];

export default function HomeHeader({
  activeTab,
  setActiveTab,
  location,
  savedAddressText,
  handleLocationClick,
  handleSearchFocus,
  placeholderIndex,
  placeholders,
  vegMode = false,
  handleVegModeChange
}) {
  const activePlaceholders = placeholders && placeholders.length > 0 ? placeholders : DEFAULT_PLACEHOLDERS;
  const [internalIndex, setInternalIndex] = useState(0);

  useEffect(() => {
    if (placeholderIndex !== undefined) return;
    const interval = setInterval(() => {
      setInternalIndex((prev) => (prev + 1) % activePlaceholders.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [placeholderIndex, activePlaceholders.length]);

  const currentPlaceholderIndex = placeholderIndex !== undefined ? placeholderIndex : internalIndex;


  return (
    <div className="relative pt-2 pb-0 px-4 transition-all duration-700 overflow-hidden bg-transparent shadow-none">
      {/* Subtle Artistic Glows - Adds depth without being 'boring' */}
      <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-[#F84E04]/5 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-[#48c479]/5 blur-[80px] rounded-full pointer-events-none" />

      {/* Main Header Content */}
      <div className="relative z-10 space-y-2.5">
        {/* Row 1: Logo + Location (Left), Actions (Right) */}
        <div className="flex items-start justify-between gap-3">
          
          {/* Left Column: Logo and Location Selector */}
          <div
            className="flex items-center gap-2 cursor-pointer group min-w-0 flex-1 pt-1"
            onClick={handleLocationClick}
          >
            {/* Logo - Perfectly Cropped to Black Border (Currently Hidden) 
            <div className="w-[58px] h-[22px] sm:w-[68px] sm:h-[26px] overflow-hidden shrink-0 flex items-center justify-center rounded-[2px] shadow-sm">
              <img 
                src="/zinzoo-logo.png" 
                alt="ZinZoo" 
                className="w-[162%] max-w-none h-auto object-center" 
              />
            </div>
            */}

            {/* MapPin */}
            <div className="bg-white/10 p-1 rounded-lg group-active:scale-95 transition-all shrink-0">
              <MapPin className="h-3.5 w-3.5 text-white/90 fill-white/20" />
            </div>

            {/* Address Details */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[14px] font-black text-white truncate drop-shadow-sm">
                  {(() => {
                    const area = location?.area || location?.subLocality || location?.mainTitle || location?.neighborhood;
                    const city = (location?.city || "").toLowerCase();
                    const state = (location?.state || "").toLowerCase();

                    if (area && !/^-?\d+(\.\d+)?$/.test(area.trim())) {
                      const areaLower = area.toLowerCase();
                      if (areaLower !== city && areaLower !== state) {
                        return area;
                      }
                    }

                    if (location?.address && location.address !== "Select location") {
                      const parts = location.address.split(',').map(p => p.trim());
                      for (const part of parts) {
                        const partLower = part.toLowerCase();
                        if (partLower &&
                          partLower !== city &&
                          partLower !== state &&
                          !/^-?\d/.test(part) &&
                          part.length > 2) {
                          return part;
                        }
                      }
                    }

                    return location?.area || location?.city || "Select Location";
                  })()}
                </span>
                <ChevronDown className="h-3 w-3 text-white/70" />
              </div>

              <span className="text-[10px] font-medium text-white/90 truncate leading-tight mt-0.5">
                {(() => {
                  const state = location?.state || "";
                  const pincode = location?.pincode || "";

                  if (state && pincode) return `${state}, ${pincode}`;
                  if (state) return state;
                  if (pincode) return pincode;

                  const addr = location?.address || "";
                  if (addr && addr.length > 10) {
                    return addr.split(',').slice(1, 3).join(',').trim() || "Pinpoint location";
                  }

                  return "Pinpoint location";
                })()}
              </span>

              <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.25em] leading-tight mt-0.5">
                {location?.city || ""}
              </span>
            </div>
          </div>

          {/* Right Actions: Veg Toggle & Bell */}
          <div className="flex items-center gap-2.5 pt-2">
            {/* Pure Veg Toggle */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full border transition-all duration-300 ${vegMode ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/5'}`}
              onClick={() => handleVegModeChange?.(!vegMode)}
            >
              <div className={`w-3 h-3 rounded-sm border flex items-center justify-center transition-colors ${vegMode ? 'border-white bg-white' : 'border-white/30'}`}>
                {vegMode && <div className="w-1 h-1 rounded-full bg-[#00b09b]" />}
              </div>
              <span className={`text-[8px] font-black uppercase tracking-tight ${vegMode ? 'text-white' : 'text-white/60'}`}>Veg</span>
            </div>

            <HeaderNotificationBell className="h-4 w-4 text-white/90" triggerClass="rounded-full h-8 w-8" />

            <HeaderCartIcon />
          </div>
        </div>

        <div
          className="relative bg-white rounded-2xl flex items-center px-3.5 py-2.5 shadow-lg border border-black/5 cursor-pointer active:scale-[0.98] transition-all duration-300 max-w-[95%] mx-auto"
          onClick={handleSearchFocus}
        >
          <Search className="h-4 w-4 text-[#F84E04] mr-2 shrink-0" strokeWidth={3} />

          <div className="flex-1 overflow-hidden relative h-4.5">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentPlaceholderIndex}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 text-xs font-bold text-gray-400 truncate flex items-center"
              >
                {activePlaceholders?.[currentPlaceholderIndex] || 'Search'}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
