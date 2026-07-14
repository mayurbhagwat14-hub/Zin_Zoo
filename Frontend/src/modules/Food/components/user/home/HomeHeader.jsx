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


  return (
    <div className="relative pt-2 pb-0 px-4 transition-all duration-700 overflow-hidden bg-transparent shadow-none">
      {/* Subtle Artistic Glows - Adds depth without being 'boring' */}
      <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-[#F84E04]/5 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-[#48c479]/5 blur-[80px] rounded-full pointer-events-none" />

      {/* Main Header Content */}
      <div className="relative z-10 space-y-2.5">
        {/* Row 1: Location, Toggle, and Notifications */}
        <div className="flex items-center justify-between gap-3">
          {/* Location Selector */}
          <div
            className="flex items-center gap-2 cursor-pointer group min-w-0 flex-1"
            onClick={handleLocationClick}
          >
            <div className="bg-white/10 p-1 rounded-lg group-active:scale-95 transition-all">
              <MapPin className="h-3.5 w-3.5 text-white/90 fill-white/20" />
            </div>
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
                    
                    // Fallback to a part of the address if area is missing or redundant
                    if (location?.address && location.address !== "Select location") {
                      const parts = location.address.split(',').map(p => p.trim());
                      // Take the first part that isn't city or state
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
                  // Format Row 2: State, Pincode (matching screenshot)
                  const state = location?.state || "";
                  const pincode = location?.pincode || "";
                  
                  if (state && pincode) return `${state}, ${pincode}`;
                  if (state) return state;
                  if (pincode) return pincode;
                  
                  // Fallback to snippet of address if no state/pincode
                  const addr = location?.address || "";
                  if (addr && addr.length > 10) {
                     return addr.split(',').slice(1, 3).join(',').trim() || "Pinpoint location";
                  }
                  
                  return "Pinpoint location";
                })()}
              </span>
              
              <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.25em] leading-tight mt-0.5">
                {location?.city || "Indore"}
              </span>
            </div>
          </div>

          {/* Right Actions: Veg Toggle & Bell */}
          <div className="flex items-center gap-2.5">
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
                key={placeholderIndex}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 text-xs font-bold text-gray-400 truncate flex items-center"
              >
                {placeholders?.[placeholderIndex] || 'Search'}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
