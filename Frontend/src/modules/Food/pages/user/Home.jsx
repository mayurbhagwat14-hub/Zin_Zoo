import { useSearchParams, Link, useNavigate } from "react-router-dom";
import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
  startTransition,
} from "react";
import { createPortal } from "react-dom";
import {
  Star,
  Clock,
  MapPin,
  Heart,
  Search,
  Tag,
  Flame,
  ShoppingBag,
  ShoppingCart,
  Mic,
  SlidersHorizontal,
  CheckCircle2,
  Bookmark,
  BadgePercent,
  X,
  ArrowDownUp,
  Timer,
  CalendarClock,
  ShieldCheck,
  IndianRupee,
  UtensilsCrossed,
  Pizza,
  Leaf,
  AlertCircle,
  Loader2,
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight,
  Check,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@food/components/ui/sheet";

import Footer from "@food/components/user/Footer";
import AddToCartButton from "@food/components/user/AddToCartButton";
import StickyCartCard from "@food/components/user/StickyCartCard";
import OrderTrackingCard from "@food/components/user/OrderTrackingCard";
import {
  CategoryChipRowSkeleton,
  ExploreGridSkeleton,
  HeroBannerSkeleton,
  LoadingSkeletonRegion,
  RestaurantGridSkeleton,
} from "@food/components/ui/loading-skeletons";
import { useProfile } from "@food/context/ProfileContext";
import { useCart } from "@food/context/CartContext";
import { HorizontalCarousel } from "@food/components/ui/horizontal-carousel";
import { DotPattern } from "@food/components/ui/dot-pattern";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { Badge } from "@food/components/ui/badge";
import { Input } from "@food/components/ui/input";
import { Switch } from "@food/components/ui/switch";
import { Checkbox } from "@food/components/ui/checkbox";
import {
  useSearchOverlay,
  useLocationSelector,
} from "@food/components/user/UserLayout";
import PageNavbar from "@food/components/user/PageNavbar";

const debugLog = (...args) => { };
const debugWarn = (...args) => { };
const debugError = (...args) => { };

// Import shared food images - prevents duplication


import { Avatar, AvatarFallback } from "@food/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu";
import { useLocation } from "@food/hooks/useLocation";
import { useZone } from "@food/hooks/useZone";
import { usePublicSocket } from "@food/hooks/usePublicSocket";
import quickSpicyLogo from "@food/assets/quicky-spicy-logo.png";
import offerImage from "@food/assets/offerimage.png";
import api, { publicGetOnce, restaurantAPI, adminAPI } from "@food/api";
import { API_BASE_URL } from "@food/api/config";
import OptimizedImage from "@food/components/OptimizedImage";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import HomeHeader from "@food/components/user/home/HomeHeader";
import ModuleNavbar from "@food/components/user/ModuleNavbar";

import PromoRow from "@food/components/user/home/PromoRow";
import FestBanner from "@food/components/user/home/FestBanner";
import chefMascot from "@food/assets/chef-mascot.png";

// Explore More Icons
import exploreOffers from "@food/assets/explore more icons/offers.png";

import exploreTop10 from "@food/assets/explore more icons/top 10.png";
import exploreCollection from "@food/assets/explore more icons/collection.png";

// Banner images for hero carousel - will be fetched from API

// Animated placeholder for search - moved outside component to prevent recreation
const placeholders = [
  'Search "burger"',
  'Search "biryani"',
  'Search "pizza"',
  'Search "desserts"',
  'Search "chinese"',
  'Search "thali"',
  'Search "momos"',
  'Search "dosa"',
];

const WEBVIEW_SESSION_CACHE_BUSTER = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getRestaurantDisplayName = (restaurant) => {
  const nameCandidates = [
    restaurant?.name,
    restaurant?.restaurantName,
    restaurant?.restaurantName?.english,
    restaurant?.restaurantName?.value,
    restaurant?.onboarding?.step1?.restaurantName,
  ];
  const resolvedName = nameCandidates.find(
    (candidate) =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );
  return resolvedName ? resolvedName.trim() : "Restaurant";
};

// Restaurant Image Carousel Component
const RestaurantImageCarousel = React.memo(
  ({
    restaurant,
    priority = false,
    backendOrigin = "",
    className = "w-full aspect-[4/3]",
    roundedClass = "rounded-t-md",
  }) => {
    const webviewSessionKeyRef = useRef(WEBVIEW_SESSION_CACHE_BUSTER);
    const imageElementRef = useRef(null);

    const withCacheBuster = useCallback(
      (url) => {
        if (typeof url !== "string" || !url) return "";
        if (/^data:/i.test(url) || /^blob:/i.test(url)) return url;

        // Resolve relative URLs (e.g. /uploads/...) so they load on mobile when backend is different from frontend.
        const isRelative = !/^(https?:|\/\/|data:|blob:)/i.test(url.trim());
        const resolvedUrl =
          backendOrigin && isRelative
            ? `${backendOrigin.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`
            : url;

        // Do not mutate signed URLs (legacy S3/Cloudfront/Firebase links can break if query changes).
        const hasSignedParams =
          /[?&](X-Amz-|Signature=|Expires=|AWSAccessKeyId=|GoogleAccessId=|token=|sig=|se=|sp=|sv=)/i.test(
            resolvedUrl,
          );
        if (hasSignedParams) return resolvedUrl;

        try {
          const parsed = new URL(resolvedUrl, window.location.origin);

          // Apply cache-buster only to app/backend-hosted URLs to avoid third-party CDN signature issues.
          const currentHost =
            typeof window !== "undefined" ? window.location.hostname : "";
          const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(
            parsed.hostname,
          );
          const isSameHost = currentHost && parsed.hostname === currentHost;

          if (isLocalHost || isSameHost) {
            parsed.searchParams.set("_wv", webviewSessionKeyRef.current);
          }
          return parsed.toString();
        } catch {
          return resolvedUrl;
        }
      },
      [backendOrigin],
    );

    const images = useMemo(() => {
      const mainImage = restaurant.image || (Array.isArray(restaurant.images) && restaurant.images.length > 0 ? restaurant.images[0] : null);
      const sourceImages = mainImage ? [mainImage] : [];

      const validImages = sourceImages
        .filter((img) => typeof img === "string")
        .map((img) => img.trim())
        .filter(Boolean);

      return validImages.map((img) => withCacheBuster(img));
    }, [restaurant.images, restaurant.image, withCacheBuster]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loadedBySrc, setLoadedBySrc] = useState({});
    const [, setAttemptedSrcs] = useState({});
    const [isImageUnavailable, setIsImageUnavailable] = useState(false);
    const [showShimmer, setShowShimmer] = useState(true);
    const [lastGoodSrc, setLastGoodSrc] = useState("");
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);
    const isSwiping = useRef(false);

    const safeIndex =
      images.length > 0
        ? ((currentIndex % images.length) + images.length) % images.length
        : 0;
    const primarySrc = images[safeIndex] || "";
    const displaySrc = primarySrc;
    const renderSrc = displaySrc || lastGoodSrc;
    const isImageLoaded = Boolean(loadedBySrc[renderSrc] || lastGoodSrc);

    // Reset transient image state when restaurant or source list changes.
    useEffect(() => {
      setCurrentIndex(0);
      setLoadedBySrc({});
      setAttemptedSrcs({});
      setIsImageUnavailable(images.length === 0);
      setShowShimmer(images.length > 0);
    }, [restaurant?.id, restaurant?.slug, restaurant?.updatedAt, images]);

    // Clear sticky successful source only when card identity changes.
    useEffect(() => {
      setLastGoodSrc("");
    }, [restaurant?.id, restaurant?.slug]);

    // WebView can serve from cache without firing onLoad; handle already-complete images.
    useEffect(() => {
      if (!renderSrc) return;
      const imgEl = imageElementRef.current;
      if (!imgEl) return;

      setShowShimmer(true);
      const shimmerTimeout = setTimeout(() => {
        setShowShimmer(false);
      }, 2500);

      if (imgEl.complete) {
        if (imgEl.naturalWidth > 0) {
          setLoadedBySrc((prev) =>
            prev[renderSrc] ? prev : { ...prev, [renderSrc]: true },
          );
          setLastGoodSrc(renderSrc);
          setShowShimmer(false);
        } else {
          setAttemptedSrcs((prev) => ({ ...prev, [renderSrc]: true }));
        }
      }
      return () => clearTimeout(shimmerTimeout);
    }, [renderSrc]);

    // Handle touch events for swipe
    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      isSwiping.current = false;
    };

    const handleTouchMove = (e) => {
      const currentX = e.touches[0].clientX;
      const diff = touchStartX.current - currentX;

      // If swipe distance is significant, mark as swiping
      if (Math.abs(diff) > 10) {
        isSwiping.current = true;
      }
    };

    const handleTouchEnd = (e) => {
      if (!isSwiping.current) return;

      touchEndX.current = e.changedTouches[0].clientX;
      const diff = touchStartX.current - touchEndX.current;
      const minSwipeDistance = 85; // Keep card swipe less sensitive on mobile

      if (Math.abs(diff) > minSwipeDistance) {
        if (diff > 0) {
          // Swipe left - next image
          setCurrentIndex((prev) => (prev + 1) % images.length);
        } else {
          // Swipe right - previous image
          setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
        }
      }

      // Reset
      isSwiping.current = false;
      touchStartX.current = 0;
      touchEndX.current = 0;
    };

    const showMultipleImages = images.length > 1;

    return (
      <div
        className={`relative ${className} w-full overflow-hidden ${roundedClass} flex-shrink-0 group`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}>
        {showShimmer && !isImageUnavailable && Boolean(renderSrc) && (
          <div className="absolute inset-0 z-[1] overflow-hidden bg-gray-200">
            <div className="h-full w-full animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          </div>
        )}

        <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-110">
          {renderSrc && (
            <img
              ref={imageElementRef}
              src={renderSrc}
              alt={`${restaurant.name} - Image ${safeIndex + 1}`}
              className="w-full h-full object-cover"
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
              onLoad={() => {
                setLoadedBySrc((prev) => ({ ...prev, [renderSrc]: true }));
                setLastGoodSrc(renderSrc);
                setShowShimmer(false);
              }}
              onError={() => {
                setAttemptedSrcs((prev) => {
                  const next = { ...prev, [primarySrc]: true };
                  const attemptedCount = Object.keys(next).length;

                  if (attemptedCount >= images.length) {
                    setIsImageUnavailable(true);
                  } else if (images.length > 1) {
                    setCurrentIndex(
                      (prevIndex) => (prevIndex + 1) % images.length,
                    );
                  }

                  return next;
                });
                if (images.length === 1) {
                  setIsImageUnavailable(true);
                }
              }}
            />
          )}
        </div>

        {isImageUnavailable && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-gray-100">
            <span className="text-xs text-gray-500">Image unavailable</span>
          </div>
        )}

        {/* Image Indicators - only show if more than 1 image */}
        {showMultipleImages && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center z-10 -space-x-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                className="w-10 h-10 flex items-center justify-center focus:outline-none group/btn rounded-full"
                aria-label={`Go to image ${index + 1}`}>
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${index === currentIndex
                    ? "w-6 bg-white"
                    : "w-1.5 bg-white/50 group-hover/btn:bg-white/75"
                    }`}
                />
              </button>
            ))}
          </div>
        )}

        {/* Gradient Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Shine Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full transition-transform duration-1000 group-hover:animate-shine" />
      </div>
    );
  },
);

export default function Home() {
  const HERO_BANNER_AUTO_SLIDE_MS = 3500;
  const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api(\/v\d+)?\/?$/, "");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [heroSearch, setHeroSearch] = useState("");
  const { openSearch, closeSearch, searchValue, setSearchValue } =
    useSearchOverlay();
  const { openLocationSelector } = useLocationSelector();
  const {
    vegMode,
    setVegMode: setVegModeContext,
    vegModeOption,
    setVegModeOption
  } = useProfile();
  const [prevVegMode, setPrevVegMode] = useState(vegMode);
  const [showVegModePopup, setShowVegModePopup] = useState(false);
  const [showSwitchOffPopup, setShowSwitchOffPopup] = useState(false);

  const [isApplyingVegMode, setIsApplyingVegMode] = useState(false);
  const [isSwitchingOffVegMode, setIsSwitchingOffVegMode] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0, triangleLeft: 0 });
  const vegModeToggleRef = useRef(null);
  const [isStickyHeaderVisible, setIsStickyHeaderVisible] = useState(false);
  const [showStickySearch] = useState(true);
  const lastScrollY = useRef(0);

  // Load cached state if it exists in sessionStorage
  const cachedState = useMemo(() => {
    try {
      const cached = sessionStorage.getItem("zinzoo_food_home_state");
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          restaurantsData: parsed.restaurantsData || [],
          activeFilters: new Set(parsed.activeFilters || []),
          sortBy: parsed.sortBy || null,
          selectedCuisine: parsed.selectedCuisine || null,
          appliedFilters: {
            activeFilters: new Set(parsed.appliedFilters?.activeFilters || []),
            sortBy: parsed.appliedFilters?.sortBy || null,
            selectedCuisine: parsed.appliedFilters?.selectedCuisine || null,
          },
          visibleRestaurantCount: parsed.visibleRestaurantCount || 9,
        };
      }
    } catch (e) {
      console.error("Error reading cached home state:", e);
    }
    return null;
  }, []);

  const isFirstMountRef = useRef(true);

  // Restore scroll position on mount
  useEffect(() => {
    const savedScroll = sessionStorage.getItem("zinzoo_food_home_scroll");
    const hasCachedState = sessionStorage.getItem("zinzoo_food_home_state");
    if (savedScroll && hasCachedState) {
      const scrollY = parseInt(savedScroll, 10);
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
        let count = 0;
        const scrollFunc = () => {
          window.scrollTo(0, scrollY);
          count++;
          if (count < 8) {
            requestAnimationFrame(scrollFunc);
          }
        };
        requestAnimationFrame(scrollFunc);
      }
    }
  }, []);

  useEffect(() => {
    const handleScrollHeader = () => {
      const currentScrollY = window.scrollY;

      // Show the sticky header as soon as we scroll past 80px
      if (currentScrollY > 80) {
        setIsStickyHeaderVisible(true);
      } else {
        setIsStickyHeaderVisible(false);
      }

      lastScrollY.current = currentScrollY;

      // Save scroll position
      sessionStorage.setItem("zinzoo_food_home_scroll", String(currentScrollY));
    };

    window.addEventListener("scroll", handleScrollHeader, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollHeader);
  }, []);



  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [heroBannerImages, setHeroBannerImages] = useState([]);
  const [heroBannersData, setHeroBannersData] = useState([]); // Store full banner data with linked restaurants
  const [loadingBanners, setLoadingBanners] = useState(true);
  const [hasScrolledPastBanner, setHasScrolledPastBanner] = useState(false);
  const [landingCategories, setLandingCategories] = useState([]);
  const [landingExploreMore, setLandingExploreMore] = useState([]);
  const [exploreMoreHeading, setExploreMoreHeading] = useState("Explore More");
  const [festBannerVideoUrl, setFestBannerVideoUrl] = useState("https://videos.pexels.com/video-files/5533140/5533140-uhd_2160_4096_25fps.mp4");
  const [recommendedRestaurantIds, setRecommendedRestaurantIds] = useState([]);
  const [under250PriceLimit, setUnder250PriceLimit] = useState(250);
  const [
    recommendedRestaurantsFromSettings,
    setRecommendedRestaurantsFromSettings,
  ] = useState([]);
  const [loadingLandingConfig, setLoadingLandingConfig] = useState(true);
  const [restaurantsData, setRestaurantsData] = useState(cachedState ? cachedState.restaurantsData : []);
  const [restaurantsPage, setRestaurantsPage] = useState(1);
  const [hasMoreRestaurantsBackend, setHasMoreRestaurantsBackend] = useState(true);
  const [loadingMoreRestaurants, setLoadingMoreRestaurants] = useState(false);
  const [loadingRestaurants, setLoadingRestaurants] = useState(cachedState ? false : true);
  const [realCategories, setRealCategories] = useState([]);
  const [loadingRealCategories, setLoadingRealCategories] = useState(true);
  const [menuCategories, setMenuCategories] = useState([]);
  const [loadingMenuCategories, setLoadingMenuCategories] = useState(false);
  const [restaurantDietMeta, setRestaurantDietMeta] = useState({});

  const [showAllCategoriesModal, setShowAllCategoriesModal] = useState(false);
  const [availabilityTick, setAvailabilityTick] = useState(Date.now());
  const RESTAURANTS_BATCH_SIZE = 9;
  const [visibleRestaurantCount, setVisibleRestaurantCount] = useState(
    cachedState ? cachedState.visibleRestaurantCount : RESTAURANTS_BATCH_SIZE
  );
  const restaurantLoadMoreRef = useRef(null);
  const publicCategoriesCacheRef = useRef(new Map());
  const publicCategoriesInFlightRef = useRef(new Map());
  const isHandlingSwitchOff = useRef(false);
  const heroShellRef = useRef(null);
  const stickyHeaderRef = useRef(null);
  const slugifyCategory = useCallback(
    (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
    [],
  );
  const festVideoActive =
    typeof festBannerVideoUrl === "string" && festBannerVideoUrl.trim().length > 0;

  // Stable list of restaurant ids for menu-category union so we don't refetch menus
  // when `restaurantsData` changes for reasons like distance recalculation or outletTimings enrichment.
  const menuUnionRestaurantIdsKey = useMemo(() => {
    if (!Array.isArray(restaurantsData) || restaurantsData.length === 0) return "";
    return restaurantsData
      .map((r) => String(r?.restaurantId || r?.id || "").trim())
      .filter(Boolean)
      .sort()
      .join(",");
  }, [restaurantsData]);

  const normalizeImageUrl = useCallback(
    (imageUrl) => {
      if (typeof imageUrl !== "string") return "";
      const trimmed = imageUrl.trim();
      if (!trimmed) return "";
      if (/^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) {
        return trimmed;
      }
      const appProtocol =
        typeof window !== "undefined" ? window.location?.protocol : "";
      const appHost =
        typeof window !== "undefined" ? window.location?.hostname : "";
      let normalizedInput = trimmed
        .replace(/\\/g, "/")
        .replace(/^(https?):\/(?!\/)/i, "$1://")
        .replace(/^(https?:\/\/)(https?:\/\/)/i, "$1");

      if (/^\/\//.test(normalizedInput)) {
        normalizedInput = `${appProtocol || "https:"}${normalizedInput}`;
      }

      // WebView can fail on unescaped spaces/special chars; keep URLs safely encoded.
      if (/^(https?:)?\/\//i.test(normalizedInput)) {
        try {
          const parsed = new URL(normalizedInput, window.location.origin);

          // In mobile production, localhost/127.0.0.1 inside image URLs is unreachable.
          // Use BACKEND_ORIGIN (API server) for image host, not frontend host�uploads are served by the backend.
          if (
            appHost &&
            appHost !== "localhost" &&
            appHost !== "127.0.0.1" &&
            /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)
          ) {
            try {
              const backendUrl = new URL(BACKEND_ORIGIN);
              parsed.protocol = backendUrl.protocol;
              parsed.hostname = backendUrl.hostname;
              parsed.port = backendUrl.port;
            } catch {
              parsed.protocol = window.location.protocol;
              parsed.hostname = window.location.hostname;
              if (window.location.port) parsed.port = window.location.port;
            }
          }

          // Prevent mixed-content image blocking in HTTPS WebView.
          if (appProtocol === "https:" && parsed.protocol === "http:") {
            parsed.protocol = "https:";
          }

          const finalUrl = parsed.toString();
          // Do not encode signed URLs (S3/Cloudfront/Cloudinary); encoding query params can break signatures.
          const hasSignedParams =
            /[?&](X-Amz-|Signature=|Expires=|AWSAccessKeyId=|GoogleAccessId=|token=|sig=|se=|sp=|sv=)/i.test(
              finalUrl,
            );
          return hasSignedParams ? finalUrl : encodeURI(finalUrl);
        } catch {
          return normalizedInput;
        }
      }

      const absolutePath = normalizedInput.startsWith("/")
        ? `${BACKEND_ORIGIN}${normalizedInput}`
        : `${BACKEND_ORIGIN}/${normalizedInput.replace(/^\.?\/*/, "")}`;

      try {
        const parsed = new URL(absolutePath, window.location.origin);
        if (appProtocol === "https:" && parsed.protocol === "http:") {
          parsed.protocol = "https:";
        }
        const finalUrl = parsed.toString();
        const hasSignedParams =
          /[?&](X-Amz-|Signature=|Expires=|AWSAccessKeyId=|GoogleAccessId=|token=|sig=|se=|sp=|sv=)/i.test(
            finalUrl,
          );
        return hasSignedParams ? finalUrl : encodeURI(finalUrl);
      } catch {
        return absolutePath;
      }
    },
    [BACKEND_ORIGIN],
  );

  const extractImageFromValue = useCallback(
    (value) => {
      if (!value) return "";

      if (typeof value === "string") {
        return normalizeImageUrl(value);
      }

      if (typeof value === "object") {
        const candidate =
          value.url ||
          value.secure_url ||
          value.imageUrl ||
          value.imageURL ||
          value.image ||
          value.src ||
          value.path ||
          value.location ||
          value.link ||
          value.href ||
          "";
        return typeof candidate === "string"
          ? normalizeImageUrl(candidate)
          : "";
      }

      return "";
    },
    [normalizeImageUrl],
  );

  const buildRestaurantImageCandidates = useCallback(
    (value) => {
      const normalized = extractImageFromValue(value);
      if (!normalized) return [];

      // Mobile WebView safety: try deterministic JPEG first, then auto, then original.
      if (
        /res\.cloudinary\.com/i.test(normalized) &&
        /\/image\/upload\//i.test(normalized)
      ) {
        const hasTransform =
          /\/image\/upload\/(?:f_|q_|w_|h_|c_|dpr_|g_)/i.test(normalized);
        if (!hasTransform) {
          return Array.from(
            new Set([
              normalized.replace(
                "/image/upload/",
                "/image/upload/f_jpg,q_auto,w_1080/",
              ),
              normalized.replace(
                "/image/upload/",
                "/image/upload/f_auto,q_auto,w_1080/",
              ),
              normalized,
            ]),
          );
        }
      }

      return [normalized];
    },
    [extractImageFromValue],
  );

  const extractImages = useCallback(
    (source) => {
      if (!source) return [];

      const normalizedImages = (Array.isArray(source)
        ? source.flatMap((entry) => buildRestaurantImageCandidates(entry))
        : buildRestaurantImageCandidates(source)
      )
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean);

      // De-duplicate image urls while preserving order.
      return normalizedImages.filter(
        (value, index) => normalizedImages.indexOf(value) === index,
      );

    },
    [buildRestaurantImageCandidates],
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setAvailabilityTick(Date.now());
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const heroShell = heroShellRef.current;
      const stickyHeader = stickyHeaderRef.current;

      if (!heroShell) {
        setHasScrolledPastBanner(false);
        return;
      }

      const heroRect = heroShell.getBoundingClientRect();
      const stickyHeight = stickyHeader?.getBoundingClientRect().height || 0;
      setHasScrolledPastBanner(heroRect.bottom <= stickyHeight);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  // Merge API explore items with fallback to ensure all 4 cards are shown
  const finalExploreItems = useMemo(() => {
    const fallback = [
      {
        id: "offers",
        label: "Offers",
        image: exploreOffers,
        href: "/food/user/offers",
      },

      {
        id: "collection",
        label: "Collections",
        image: exploreCollection,
        href: "/food/user/collections",
      },
    ];

    if (!landingExploreMore || landingExploreMore.length === 0) return fallback;

    return fallback.map((item) => {
      const apiItem = landingExploreMore.find(
        (ai) => ai.label?.toLowerCase() === item.label?.toLowerCase(),
      );
      if (apiItem) {
        const href = apiItem.link
          ? apiItem.link.startsWith("/")
            ? apiItem.link
            : `/${apiItem.link}`
          : item.href;
        return {
          ...item,
          image:
            normalizeImageUrl(apiItem.imageUrl || apiItem.image || "") ||
            item.image,
          href,
        };
      }
      return item;
    });
  }, [landingExploreMore, normalizeImageUrl]);

  const normalizedLandingCategories = useMemo(() => {
    return (landingCategories || []).map((category, index) => ({
      id: category.id || category._id || `landing-category-${index}`,
      name: category.label || category.name || "Category",
      image: normalizeImageUrl(category.imageUrl || category.image) || "",
      slug:
        category.slug || slugifyCategory(category.label || category.name || ""),
      label: category.label || category.name || "Category",
    }));
  }, [landingCategories, normalizeImageUrl, slugifyCategory]);

  const displayCategories = useMemo(() => {
    if (realCategories.length > 0) return realCategories;
    if (menuCategories.length > 0) return menuCategories;
    return normalizedLandingCategories;
  }, [menuCategories, realCategories, normalizedLandingCategories]);

  // Swipe functionality for hero banner carousel
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);
  const isSwiping = useRef(false);
  const autoSlideIntervalRef = useRef(null);

  // Sync prevVegMode when vegMode changes from context
  useEffect(() => {
    if (vegMode !== prevVegMode && !isHandlingSwitchOff.current) {
      setPrevVegMode(vegMode);
    }
  }, [vegMode]);

  // Keep persisted Veg Mode preference; only reset popup UI state on mount.
  useEffect(() => {
    setPrevVegMode(vegMode);
    setShowVegModePopup(false);
    setShowSwitchOffPopup(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle vegMode toggle - show popup when turned ON or OFF
  const handleVegModeChange = (newValue) => {
    // Skip if we're handling switch off confirmation
    if (isHandlingSwitchOff.current) {
      return;
    }

    if (newValue && !prevVegMode) {
      // Veg mode was just turned ON
      // Calculate popup position relative to toggle
      if (vegModeToggleRef.current) {
        const rect = vegModeToggleRef.current.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        const popupWidth = Math.min(screenWidth - 32, 320); // 320 is max-w-xs

        let left = rect.left + rect.width / 2 - popupWidth / 2;
        left = Math.max(16, Math.min(left, screenWidth - popupWidth - 16));

        const triangleLeft = rect.left + rect.width / 2 - left;

        setPopupPosition({
          top: rect.bottom + 10,
          left: left,
          triangleLeft: triangleLeft
        });
      }
      setShowVegModePopup(true);
      // Don't update context yet - wait for user to apply or cancel
    } else if (!newValue && prevVegMode) {
      // Veg mode was just turned OFF - show switch off confirmation popup
      isHandlingSwitchOff.current = true;
      setShowSwitchOffPopup(true);
      // Don't update context yet - wait for user to confirm
    } else {
      // Normal state change - update context directly
      setVegModeContext(newValue);
      setPrevVegMode(newValue);
    }
  };

  // Update popup position on scroll/resize
  useEffect(() => {
    if (!showVegModePopup) return;

    const updatePosition = () => {
      if (vegModeToggleRef.current) {
        const rect = vegModeToggleRef.current.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        const popupWidth = Math.min(screenWidth - 32, 320);

        let left = rect.left + rect.width / 2 - popupWidth / 2;
        left = Math.max(16, Math.min(left, screenWidth - popupWidth - 16));

        const triangleLeft = rect.left + rect.width / 2 - left;

        setPopupPosition({
          top: rect.bottom + 10,
          left: left,
          triangleLeft: triangleLeft
        });
      }
    };

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [showVegModePopup]);




  // Load public categories dynamically
  useEffect(() => {
    let cancelled = false;
    setLoadingRealCategories(true);
    adminAPI.getPublicCategories()
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.data?.categories || res?.data?.categories || [];
        setRealCategories(list.map(c => ({
          id: c._id || c.id,
          name: c.name,
          slug: c.slug || c.name.toLowerCase().replace(/\s+/g, '-'),
          image: c.image || "https://via.placeholder.com/150"
        })));
      })
      .catch((err) => {
        console.error("Failed to load real categories:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingRealCategories(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch explore icons and landing settings from public APIs
  useEffect(() => {
    let cancelled = false;
    setLoadingLandingConfig(true);
    Promise.all([
      publicGetOnce("/food/explore-icons/public")
        .catch(() => ({ data: { data: {} } })),
      publicGetOnce("/food/landing/settings/public")
        .catch(() => ({ data: { data: {} } })),
    ])
      .then(([exploreRes, settingsRes]) => {
        if (cancelled) return;
        const exploreData = exploreRes?.data?.data;
        const items = Array.isArray(exploreData?.items)
          ? exploreData.items
          : Array.isArray(exploreData)
            ? exploreData
            : [];
        setLandingExploreMore(
          items.map((it) => ({
            ...it,
            imageUrl: it.imageUrl || it.iconUrl,
            label: it.label || it.name,
          })),
        );
        const settings = settingsRes?.data?.data || {};
        setExploreMoreHeading(settings.exploreMoreHeading || "Explore More");
        setRecommendedRestaurantIds(settings.recommendedRestaurantIds || []);
        setUnder250PriceLimit(Number(settings.under250PriceLimit) || 250);
        setRecommendedRestaurantsFromSettings(
          settings.recommendedRestaurants || [],
        );
        setFestBannerVideoUrl(typeof settings.festBannerVideoUrl === "string" && settings.festBannerVideoUrl.trim() !== "" ? settings.festBannerVideoUrl : "https://videos.pexels.com/video-files/5533140/5533140-uhd_2160_4096_25fps.mp4");
      })
      .catch(() => {
        if (!cancelled) {
          setLandingExploreMore([]);
          setExploreMoreHeading("Explore More");
          setRecommendedRestaurantsFromSettings([]);
          setFestBannerVideoUrl("");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLandingConfig(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep index within current banner bounds after admin updates/reloads.
  useEffect(() => {
    setCurrentBannerIndex((prev) => {
      if (heroBannerImages.length === 0) return 0;
      return Math.min(prev, heroBannerImages.length - 1);
    });
  }, [heroBannerImages.length]);

  // Preload hero images to avoid white blink during slide transition.
  useEffect(() => {
    heroBannerImages.forEach((src) => {
      if (!src) return;
      const img = new window.Image();
      img.src = src;
    });
  }, [heroBannerImages]);

  const startHeroBannerAutoSlide = useCallback(() => {
    if (autoSlideIntervalRef.current) {
      clearInterval(autoSlideIntervalRef.current);
    }

    if (heroBannerImages.length <= 1) return;

    autoSlideIntervalRef.current = setInterval(() => {
      if (!isSwiping.current) {
        setCurrentBannerIndex((prev) => (prev + 1) % heroBannerImages.length);
      }
    }, HERO_BANNER_AUTO_SLIDE_MS);
  }, [heroBannerImages.length, HERO_BANNER_AUTO_SLIDE_MS]);

  // Auto-cycle hero banner images
  useEffect(() => {
    startHeroBannerAutoSlide();

    return () => {
      if (autoSlideIntervalRef.current) {
        clearInterval(autoSlideIntervalRef.current);
      }
    };
  }, [startHeroBannerAutoSlide]);

  // Helper function to reset auto-slide timer
  const resetAutoSlide = useCallback(() => {
    startHeroBannerAutoSlide();
  }, [startHeroBannerAutoSlide]);

  // Swipe handlers for hero banner carousel
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = true;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (!isSwiping.current || heroBannerImages.length === 0) return;

    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = Math.abs(touchEndY.current - touchStartY.current);
    const minSwipeDistance = 50; // Minimum distance for a swipe

    // Check if it's a horizontal swipe (not vertical scroll)
    if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaX) > deltaY) {
      if (deltaX > 0) {
        // Swipe right - go to previous image
        setCurrentBannerIndex(
          (prev) =>
            (prev - 1 + heroBannerImages.length) % heroBannerImages.length,
        );
      } else {
        // Swipe left - go to next image
        setCurrentBannerIndex((prev) => (prev + 1) % heroBannerImages.length);
      }
      // Reset auto-slide timer after manual swipe
      resetAutoSlide();
    }

    // Reset swipe state after a short delay
    setTimeout(() => {
      isSwiping.current = false;
    }, 300);

    // Reset touch positions
    touchStartX.current = 0;
    touchStartY.current = 0;
    touchEndX.current = 0;
    touchEndY.current = 0;
  };

  // Mouse handlers for desktop drag support
  const handleMouseDown = (e) => {
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
    isSwiping.current = true;
  };

  const handleMouseMove = (e) => {
    if (!isSwiping.current) return;
    touchEndX.current = e.clientX;
    touchEndY.current = e.clientY;
  };

  const handleMouseUp = () => {
    if (!isSwiping.current || heroBannerImages.length === 0) return;

    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = Math.abs(touchEndY.current - touchStartY.current);
    const minSwipeDistance = 50;

    if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaX) > deltaY) {
      if (deltaX > 0) {
        setCurrentBannerIndex(
          (prev) =>
            (prev - 1 + heroBannerImages.length) % heroBannerImages.length,
        );
      } else {
        setCurrentBannerIndex((prev) => (prev + 1) % heroBannerImages.length);
      }
      // Reset auto-slide timer after manual swipe
      resetAutoSlide();
    }

    setTimeout(() => {
      isSwiping.current = false;
    }, 300);

    touchStartX.current = 0;
    touchStartY.current = 0;
    touchEndX.current = 0;
    touchEndY.current = 0;
  };
  const [activeFilters, setActiveFilters] = useState(cachedState ? cachedState.activeFilters : new Set());
  const [sortBy, setSortBy] = useState(cachedState ? cachedState.sortBy : null); // null, 'price-low', 'price-high', 'rating-high', 'rating-low'
  const [selectedCuisine, setSelectedCuisine] = useState(cachedState ? cachedState.selectedCuisine : null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [appliedFilters, setAppliedFilters] = useState(cachedState ? cachedState.appliedFilters : {
    activeFilters: new Set(),
    sortBy: null,
    selectedCuisine: null,
  });
  const [isLoadingFilterResults, setIsLoadingFilterResults] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState("sort");
  const categoryScrollRef = useRef(null);
  const gsapAnimationsRef = useRef([]);

  // Save home state to sessionStorage whenever it changes
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    try {
      const stateToSave = {
        restaurantsData,
        activeFilters: Array.from(activeFilters),
        sortBy,
        selectedCuisine,
        appliedFilters: {
          activeFilters: Array.from(appliedFilters.activeFilters),
          sortBy: appliedFilters.sortBy,
          selectedCuisine: appliedFilters.selectedCuisine,
        },
        visibleRestaurantCount,
      };
      sessionStorage.setItem("zinzoo_food_home_state", JSON.stringify(stateToSave));
    } catch (e) {
      console.error("Error saving home state to cache:", e);
    }
  }, [restaurantsData, activeFilters, sortBy, selectedCuisine, appliedFilters, visibleRestaurantCount]);
  // Show skeletons immediately while loading — delayed toggles caused visible layout swap (CLS).
  const showBannerSkeleton = loadingBanners;
  const showCategorySkeleton = loadingRealCategories || loadingMenuCategories;
  const showExploreSkeleton = loadingLandingConfig;
  const showRestaurantSkeleton = isLoadingFilterResults || loadingRestaurants;
  // Safely get profile context - handle case when ProfileProvider is not available
  let profileContext = null;
  try {
    profileContext = useProfile();
  } catch (error) {
    debugWarn("ProfileProvider not available, using fallback:", error.message);
    // Fallback values when ProfileProvider is not available
    profileContext = {
      addFavorite: () => debugWarn("ProfileProvider not available"),
      removeFavorite: () => debugWarn("ProfileProvider not available"),
      isFavorite: () => false,
      getFavorites: () => [],
      getDefaultAddress: () => null,
      addDishFavorite: () => debugWarn("ProfileProvider not available"),
      removeDishFavorite: () => debugWarn("ProfileProvider not available"),
      isDishFavorite: () => false,
    };
  }

  const {
    addFavorite,
    removeFavorite,
    isFavorite,
    getFavorites,
    getDefaultAddress,
    addDishFavorite,
    removeDishFavorite,
    isDishFavorite,
  } = profileContext;
  const { addToCart, cart, updateQuantity } = useCart();
  const getCartQty = (foodId) => {
    if (!Array.isArray(cart)) return 0;
    // Map both standard id and lineItemId matching
    const item = cart.find(i => String(i.productId || i.itemId || i.id) === String(foodId) || String(i.lineItemId).includes(String(foodId)));
    return item ? item.quantity : 0;
  };
  const { location, loading, requestLocation } = useLocation();
  const {
    zoneId,
    zoneStatus,
    isInService,
    isOutOfService,
    loading: zoneLoading,
    error: zoneError,
  } = useZone(location);
  const [showToast, setShowToast] = useState(false);
  const [showManageCollections, setShowManageCollections] = useState(false);
  const [selectedRestaurantSlug, setSelectedRestaurantSlug] = useState(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    if (isFilterOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFilterOpen]);

  // Fetch categories (zone-aware) for the homepage category rail.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const zoneKey = String(zoneId || "global")
      try {
        // Dedupe repeated calls (StrictMode + zone settling). Cache per zoneKey and share in-flight request.
        const cached = publicCategoriesCacheRef.current.get(zoneKey)
        if (cached) {
          if (!cancelled) setRealCategories(cached)
          return
        }

        const inFlight = publicCategoriesInFlightRef.current.get(zoneKey)
        if (inFlight) {
          const categories = await inFlight
          if (!cancelled) setRealCategories(categories)
          return
        }

        setLoadingRealCategories(true)
        const promise = (async () => {
          const res = await adminAPI.getPublicCategories(zoneId ? { zoneId } : {})
          const list =
            res?.data?.data?.categories ||
            res?.data?.categories ||
            []
          const categories = Array.isArray(list)
            ? list.map((cat, idx) => ({
              id: String(cat?.id || cat?._id || cat?.slug || idx),
              name: cat?.name || "",
              slug: cat?.slug || String(cat?.name || "").toLowerCase().replace(/\s+/g, "-"),
              image: normalizeImageUrl(cat?.image || cat?.imageUrl) || "",
              type: cat?.type || "",
            }))
            : []

          publicCategoriesCacheRef.current.set(zoneKey, categories)
          return categories
        })()

        publicCategoriesInFlightRef.current.set(zoneKey, promise)
        const categories = await promise
        publicCategoriesInFlightRef.current.delete(zoneKey)

        if (!cancelled) setRealCategories(categories)
      } catch (err) {
        debugWarn("Failed to fetch categories:", err)
        if (!cancelled) setRealCategories([])
      } finally {
        if (!cancelled) setLoadingRealCategories(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [zoneId, normalizeImageUrl, refetchTrigger])

  // Memoize cartCount to prevent recalculation on every render - use cart directly
  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + (item.quantity || 0), 0),
    [cart],
  );

  const cityName = location?.city || "Select";
  const stateName = location?.state || "Location";
  const hasLiveLocation = useMemo(() => {
    if (!location) return false;

    const isPlaceholder = (value) => {
      if (!value) return true;
      const normalized = String(value).trim().toLowerCase();
      return (
        !normalized ||
        normalized === "select location" ||
        normalized === "current location"
      );
    };

    const hasAddressText =
      !isPlaceholder(location.formattedAddress) ||
      !isPlaceholder(location.address);
    const hasCityState =
      !isPlaceholder(location.city) || !isPlaceholder(location.state);

    return hasAddressText || hasCityState;
  }, [location]);

  const formatSavedAddress = useCallback((address) => {
    if (!address) return "";

    if (
      address.formattedAddress &&
      address.formattedAddress !== "Select location"
    ) {
      return address.formattedAddress;
    }

    const parts = [];
    if (address.additionalDetails) parts.push(address.additionalDetails);
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.zipCode) parts.push(address.zipCode);

    if (parts.length > 0) return parts.join(", ");
    if (address.address && address.address !== "Select location")
      return address.address;

    return "";
  }, []);

  const savedAddressText = useMemo(() => {
    const defaultAddress = getDefaultAddress?.();
    return formatSavedAddress(defaultAddress);
  }, [getDefaultAddress, formatSavedAddress]);

  const defaultSavedAddress = useMemo(
    () => getDefaultAddress?.() || null,
    [getDefaultAddress],
  );

  const defaultSavedAddressLocation = useMemo(() => {
    const coords = defaultSavedAddress?.location?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const lng = parseFloat(coords[0]);
      const lat = parseFloat(coords[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }

    const lat = parseFloat(
      defaultSavedAddress?.latitude || defaultSavedAddress?.lat,
    );
    const lng = parseFloat(
      defaultSavedAddress?.longitude || defaultSavedAddress?.lng,
    );
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }

    return null;
  }, [defaultSavedAddress]);

  const effectiveLocation = useMemo(() => {
    let deliveryAddressMode = "saved";
    try {
      deliveryAddressMode =
        localStorage.getItem("deliveryAddressMode") || "saved";
    } catch {
      deliveryAddressMode = "saved";
    }

    if (deliveryAddressMode === "current") {
      return location;
    }

    if (
      defaultSavedAddressLocation &&
      Number.isFinite(defaultSavedAddressLocation.latitude) &&
      Number.isFinite(defaultSavedAddressLocation.longitude)
    ) {
      const resolvedAddress = formatSavedAddress(defaultSavedAddress);
      return {
        ...(location || {}),
        latitude: defaultSavedAddressLocation.latitude,
        longitude: defaultSavedAddressLocation.longitude,
        area:
          defaultSavedAddress?.additionalDetails ||
          defaultSavedAddress?.street ||
          defaultSavedAddress?.area ||
          location?.area ||
          "",
        city: defaultSavedAddress?.city || location?.city || "",
        state: defaultSavedAddress?.state || location?.state || "",
        address:
          resolvedAddress ||
          defaultSavedAddress?.address ||
          location?.address ||
          "",
        formattedAddress:
          resolvedAddress ||
          defaultSavedAddress?.formattedAddress ||
          location?.formattedAddress ||
          "",
      };
    }

    return location;
  }, [
    defaultSavedAddress,
    defaultSavedAddressLocation,
    formatSavedAddress,
    location,
  ]);

  const {
    zoneId: effectiveZoneId,
    isOutOfService: isEffectiveLocationOutOfService,
    loading: effectiveZoneLoading,
    error: effectiveZoneError,
  } = useZone(effectiveLocation);

  // Fetch hero banners from public API (no auth required)
  useEffect(() => {
    let cancelled = false;
    setLoadingBanners(true);
    publicGetOnce("/food/hero-banners/public", { params: { zoneId: effectiveZoneId } })
      .then((response) => {
        if (cancelled) return;
        const data = response?.data?.data;
        const list = Array.isArray(data?.banners)
          ? data.banners
          : Array.isArray(data)
            ? data
            : [];
        const images = list
          .map((b) => (b && typeof b.imageUrl === "string" ? b.imageUrl : ""))
          .filter(Boolean);
        setHeroBannerImages(images);
        setHeroBannersData(list);
        setCurrentBannerIndex(0);
      })
      .catch((err) => {
        if (cancelled) return;
        debugError("Failed to fetch hero banners", err);
        setHeroBannerImages([]);
        setHeroBannersData([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBanners(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveZoneId]);

  const shouldShowOutOfZoneHome =
    !effectiveZoneLoading &&
    !effectiveZoneError &&
    isEffectiveLocationOutOfService;

  // Mock points value - replace with actual points from context/store
  const userPoints = 99;

  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("food");


  // Simple filter toggle function
  const toggleFilter = (filterId) => {
    setActiveFilters((prev) => {
      const newSet = new Set(prev);
      const isAlreadyActive = newSet.has(filterId);

      // Determine prefix/group for exclusivity
      let prefix = null;
      if (filterId.startsWith("delivery-under-") || filterId.startsWith("under-30-mins") || filterId.startsWith("under-45-mins")) {
        prefix = "time-group";
      } else if (filterId.startsWith("rating-")) {
        prefix = "rating-";
      } else if (filterId.startsWith("distance-")) {
        prefix = "distance-";
      } else if (filterId.startsWith("price-") || filterId === "under-250") {
        prefix = "price-group";
      }

      // If it belongs to a group, clear all other filters in that group
      if (prefix) {
        newSet.forEach((item) => {
          if (prefix === "time-group") {
            if (item.startsWith("delivery-under-") || item.startsWith("under-30-mins") || item.startsWith("under-45-mins")) {
              newSet.delete(item);
            }
          } else if (prefix === "price-group") {
            if (item.startsWith("price-") || item === "under-250") {
              newSet.delete(item);
            }
          } else if (item.startsWith(prefix)) {
            newSet.delete(item);
          }
        });
      }

      // If it wasn't already active, add it now (since we cleared the group)
      if (!isAlreadyActive) {
        newSet.add(filterId);
      }
      return newSet;
    });
  };

  // Refs for scroll tracking
  const filterSectionRefs = useRef({});
  const [activeScrollSection, setActiveScrollSection] = useState("sort");
  const rightContentRef = useRef(null);
  const restaurantsRequestSeqRef = useRef(0);
  const menuUnionRequestSeqRef = useRef(0);
  const menuUnionCacheRef = useRef(new Map());

  // Scroll tracking effect
  useEffect(() => {
    if (!isFilterOpen || !rightContentRef.current) return;

    const observerOptions = {
      root: rightContentRef.current,
      rootMargin: "-20% 0px -70% 0px",
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute("data-section-id");
          if (sectionId) {
            setActiveScrollSection(sectionId);
            setActiveFilterTab(sectionId);
          }
        }
      });
    }, observerOptions);

    // Observe all filter sections
    Object.values(filterSectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [isFilterOpen]);

  // Fetch restaurants from API with filters
  const fetchRestaurants = useCallback(
    async (filters = {}, pageNum = 1, append = false) => {
      const requestSeq = ++restaurantsRequestSeqRef.current;
      try {
        if (append) {
          setLoadingMoreRestaurants(true);
        } else {
          setLoadingRestaurants(true);
        }

        // Backend disconnected - new backend in progress. Skip health check.

        // Build query parameters from filters
        const params = {
          limit: 10,
          page: pageNum,
        };

        // Always send user coordinates when available so backend can compute distance/sort.
        if (
          Number.isFinite(effectiveLocation?.latitude) &&
          Number.isFinite(effectiveLocation?.longitude)
        ) {
          params.lat = effectiveLocation.latitude;
          params.lng = effectiveLocation.longitude;
        }

        // Sort by
        if (filters.sortBy) {
          params.sortBy = filters.sortBy;
        }

        // Cuisine
        if (filters.selectedCuisine) {
          params.cuisine = filters.selectedCuisine;
        }

        // Rating filters
        if (filters.activeFilters?.has("rating-45-plus")) {
          params.minRating = 4.5;
        } else if (filters.activeFilters?.has("rating-4-plus")) {
          params.minRating = 4.0;
        } else if (filters.activeFilters?.has("rating-35-plus")) {
          params.minRating = 3.5;
        }

        // Delivery time filters
        if (filters.activeFilters?.has("delivery-under-30")) {
          params.maxDeliveryTime = 30;
        } else if (filters.activeFilters?.has("delivery-under-45")) {
          params.maxDeliveryTime = 45;
        }

        // Distance filters
        if (filters.activeFilters?.has("distance-under-1km")) {
          params.radiusKm = 1.0;
        } else if (filters.activeFilters?.has("distance-under-2km")) {
          params.radiusKm = 2.0;
        }

        // Price filters
        if (filters.activeFilters?.has("price-under-200")) {
          params.maxPrice = 200;
        } else if (filters.activeFilters?.has("price-under-500")) {
          params.maxPrice = 500;
        }

        // Offers filter
        if (filters.activeFilters?.has("has-offers")) {
          params.hasOffers = "true";
        }

        // Trust filters
        if (filters.activeFilters?.has("top-rated")) {
          params.topRated = "true";
        } else if (filters.activeFilters?.has("trusted")) {
          params.trusted = "true";
        }

        if (effectiveZoneId) {
          params.zoneId = effectiveZoneId;
        }

        debugLog("Fetching restaurants with params:", params);
        const response = await restaurantAPI.getRestaurants(params);
        debugLog("Restaurants API response:", response.data);

        // If a newer request started, ignore this response to avoid races/flicker.
        if (requestSeq !== restaurantsRequestSeqRef.current) return;

        if (
          response.data &&
          response.data.success &&
          response.data.data &&
          response.data.data.restaurants
        ) {
          const restaurantsArray = response.data.data.restaurants;
          debugLog(`Fetched ${restaurantsArray.length} restaurants from API`);

          const total = response.data.data.total || 0;
          const hasMore = pageNum * 10 < total;
          setHasMoreRestaurantsBackend(hasMore);

          if (restaurantsArray.length === 0) {
            debugWarn("No restaurants found in API response");
            if (!append) {
              setRestaurantsData([]);
            }
            return;
          }

          // Calculate distance helper function
          const calculateDistance = (lat1, lng1, lat2, lng2) => {
            const R = 6371; // Earth's radius in kilometers
            const dLat = ((lat2 - lat1) * Math.PI) / 180;
            const dLng = ((lng2 - lng1) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((lat1 * Math.PI) / 180) *
              Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLng / 2) *
              Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c; // Distance in kilometers
          };

          // Get user coordinates
          const userLat = effectiveLocation?.latitude;
          const userLng = effectiveLocation?.longitude;

          const transformedRestaurants = restaurantsArray
            .filter((restaurant) => {
              const name = (restaurant.restaurantName || restaurant.name || "").toLowerCase()
              return true
            })
            .map((restaurant, index) => {
              // Use restaurant data if available, otherwise use defaults
              const deliveryTime =
                restaurant.estimatedDeliveryTime || "25-30 mins";

              // Calculate distance from user to restaurant
              let distance = restaurant.distance || "1.2 km";

              // Get restaurant coordinates
              const restaurantLocation = restaurant.location;
              const restaurantLat =
                restaurantLocation?.latitude ||
                (restaurantLocation?.coordinates &&
                  Array.isArray(restaurantLocation.coordinates)
                  ? restaurantLocation.coordinates[1]
                  : null);
              const restaurantLng =
                restaurantLocation?.longitude ||
                (restaurantLocation?.coordinates &&
                  Array.isArray(restaurantLocation.coordinates)
                  ? restaurantLocation.coordinates[0]
                  : null);

              // Calculate distance if both user and restaurant coordinates are available
              let distanceInKm = null;
              if (
                userLat &&
                userLng &&
                restaurantLat &&
                restaurantLng &&
                !isNaN(userLat) &&
                !isNaN(userLng) &&
                !isNaN(restaurantLat) &&
                !isNaN(restaurantLng)
              ) {
                distanceInKm = calculateDistance(
                  userLat,
                  userLng,
                  restaurantLat,
                  restaurantLng,
                );
                // Format distance: show 1 decimal place if >= 1km, otherwise show in meters
                if (distanceInKm >= 1) {
                  distance = `${distanceInKm.toFixed(1)} km`;
                } else {
                  const distanceInMeters = Math.round(distanceInKm * 1000);
                  distance = `${distanceInMeters} m`;
                }
              }

              // Get first cuisine or default
              const cuisine =
                restaurant.cuisines && restaurant.cuisines.length > 0
                  ? restaurant.cuisines[0]
                  : "Multi-cuisine";

              // Legacy-safe image extraction (supports old schema variants).
              const coverImages = extractImages([
                ...(Array.isArray(restaurant.coverImages) ? restaurant.coverImages : [restaurant.coverImages]).filter(Boolean),
                restaurant.coverImage,
              ]);

              const profileImageCandidates = extractImages([
                ...buildRestaurantImageCandidates(restaurant.profileImage),
                ...buildRestaurantImageCandidates(
                  restaurant.onboarding?.step2?.profileImageUrl,
                ),
                ...buildRestaurantImageCandidates(restaurant.image),
                ...buildRestaurantImageCandidates(restaurant.imageUrl),
              ]);
              const profileImageUrl = profileImageCandidates[0] || "";

              const allImages = Array.from(
                new Set(
                  [
                    ...profileImageCandidates,
                    ...coverImages,
                  ].filter(Boolean),
                ),
              );

              // Keep single image for backward compatibility
              const image = allImages[0] || profileImageUrl || "";
              const offerText = restaurant.offer || null;

              return {
                id: restaurant.restaurantId || restaurant._id,
                mongoId: restaurant._id || null,
                name: getRestaurantDisplayName(restaurant),
                cuisine: cuisine,
                cuisines: Array.isArray(restaurant.cuisines)
                  ? restaurant.cuisines
                  : [],
                rating: Number(restaurant.rating) || 0,
                deliveryTime:
                  restaurant.deliveryTime ||
                  restaurant.estimatedDeliveryTime ||
                  (restaurant.estimatedDeliveryTimeMinutes
                    ? `${restaurant.estimatedDeliveryTimeMinutes} mins`
                    : deliveryTime),
                distance: distance,
                distanceInKm: distanceInKm, // Store numeric distance for sorting
                image: image,
                images: allImages, // Array of cover images for carousel (separate from menu images)
                priceRange: restaurant.priceRange || "$$", // Use from API or default
                featuredDish:
                  restaurant.featuredDish ||
                  (restaurant.cuisines && restaurant.cuisines.length > 0
                    ? `${restaurant.cuisines[0]} Special`
                    : "Special Dish"),
                featuredPrice: restaurant.featuredPrice || 249, // Use from API or default
                offer: offerText,
                slug: restaurant.slug,
                restaurantId: restaurant.restaurantId,
                pureVegRestaurant: restaurant.pureVegRestaurant === true,
                restaurantType: restaurant.restaurantType || "Both",
                location: restaurant.location, // Store location for distance recalculation
                isActive: restaurant.isActive !== false, // Default to true if not specified
                isAcceptingOrders: restaurant.isAcceptingOrders !== false, // Default to true if not specified
                openDays: Array.isArray(restaurant.openDays)
                  ? restaurant.openDays
                  : [],
                deliveryTimings: restaurant.deliveryTimings || null,
                outletTimings: restaurant.outletTimings || null,
                openingTime: restaurant.openingTime || restaurant?.deliveryTimings?.openingTime || null,
                closingTime: restaurant.closingTime || restaurant?.deliveryTimings?.closingTime || null,
              };
            },
            );

          const sortRestaurantsForDisplay = (restaurants) => {
            return [...restaurants].sort((a, b) => {
              // Available restaurants first, then unavailable
              const aAvailable = getRestaurantAvailabilityStatus(
                a,
                new Date(),
              ).isOpen;
              const bAvailable = getRestaurantAvailabilityStatus(
                b,
                new Date(),
              ).isOpen;

              if (aAvailable !== bAvailable) {
                return aAvailable ? -1 : 1; // Available restaurants come first
              }

              if (!userLat || !userLng) return 0;

              // Apply secondary sort based on sortBy filter
              if (filters.sortBy === "price-low") {
                return (a.featuredPrice || 0) - (b.featuredPrice || 0);
              }
              if (filters.sortBy === "price-high") {
                return (b.featuredPrice || 0) - (a.featuredPrice || 0);
              }
              if (filters.sortBy === "rating-high") {
                return (b.rating || 0) - (a.rating || 0);
              }
              if (filters.sortBy === "rating-low") {
                return (a.rating || 0) - (b.rating || 0);
              }

              // Default: preserve server order (newest first from backend)
              return 0;
            });
          };

          debugLog(
            "Transformed and sorted restaurants:",
            transformedRestaurants,
          );
          startTransition(() => {
            if (append) {
              setRestaurantsData((prev) => {
                const existingIds = new Set(prev.map(r => r.id));
                const uniqueNew = transformedRestaurants.filter(r => !existingIds.has(r.id));
                return sortRestaurantsForDisplay([...prev, ...uniqueNew]);
              });
            } else {
              setRestaurantsData(sortRestaurantsForDisplay(transformedRestaurants));
            }
          });

          const restaurantsNeedingOutletTimings = transformedRestaurants.filter(
            (restaurant) => restaurant.mongoId && !restaurant.outletTimings,
          );

          if (restaurantsNeedingOutletTimings.length > 0) {
            void (async () => {
              const resolvedOutletTimings = new Map();

              for (const restaurant of restaurantsNeedingOutletTimings) {
                try {
                  const outletResponse =
                    await restaurantAPI.getOutletTimingsByRestaurantId(
                      restaurant.mongoId,
                      { noCache: true },
                    );
                  const outletTimings =
                    outletResponse?.data?.data?.outletTimings ||
                    outletResponse?.data?.outletTimings ||
                    null;

                  if (outletTimings) {
                    resolvedOutletTimings.set(restaurant.mongoId, outletTimings);
                  }
                } catch (_) {
                  // Keep the existing restaurant data if enrichment fails.
                }
              }

              if (
                requestSeq !== restaurantsRequestSeqRef.current ||
                resolvedOutletTimings.size === 0
              ) {
                return;
              }

              startTransition(() => {
                setRestaurantsData((currentRestaurants) => {
                  let hasChanges = false;
                  const nextRestaurants = currentRestaurants.map((restaurant) => {
                    if (!restaurant.mongoId) return restaurant;
                    const outletTimings = resolvedOutletTimings.get(
                      restaurant.mongoId,
                    );
                    if (!outletTimings) return restaurant;
                    hasChanges = true;
                    return { ...restaurant, outletTimings };
                  });

                  return hasChanges
                    ? sortRestaurantsForDisplay(nextRestaurants)
                    : currentRestaurants;
                });
              });
            })();
          }
        } else {
          debugWarn("Invalid API response structure:", response.data);
          if (!append) {
            setRestaurantsData([]);
          }
        }
      } catch (error) {
        debugError("Error fetching restaurants:", error);
        debugError("Error details:", error.response?.data || error.message);
        // Don't set hardcoded data here - let the useMemo fallback handle it
        // This way, if API succeeds later, it will show the real data
        if (!append) {
          setRestaurantsData([]);
        }
      } finally {
        if (requestSeq === restaurantsRequestSeqRef.current) {
          setLoadingRestaurants(false);
          setLoadingMoreRestaurants(false);
        }
      }
    },
    [
      extractImages,
      buildRestaurantImageCandidates,
      effectiveLocation?.latitude,
      effectiveLocation?.longitude,
      effectiveZoneId,
    ],
  );

  const applyFiltersAndRefetch = useCallback(
    async (
      nextActiveFilters = activeFilters,
      nextSortBy = sortBy,
      nextSelectedCuisine = selectedCuisine,
    ) => {
      const nextFilterState = {
        activeFilters: new Set(nextActiveFilters),
        sortBy: nextSortBy,
        selectedCuisine: nextSelectedCuisine,
      };

      setRestaurantsPage(1);
      setAppliedFilters(nextFilterState);
      setIsLoadingFilterResults(true);

      try {
        await fetchRestaurants(nextFilterState, 1, false);
      } catch (error) {
        debugError("Error applying filters:", error);
      } finally {
        setIsLoadingFilterResults(false);
      }
    },
    [activeFilters, sortBy, selectedCuisine, fetchRestaurants],
  );

  const publicSocketListeners = useMemo(() => ({
    'food:product:update': () => {
      debugLog('Real-time socket update for food: refetching restaurants');
      menuUnionCacheRef.current.clear();
      setRefetchTrigger(prev => prev + 1);
      fetchRestaurants(appliedFilters, 1, false);
    },
    'food:restaurant:update': () => {
      debugLog('Real-time socket update for restaurant: refetching restaurants');
      menuUnionCacheRef.current.clear();
      setRefetchTrigger(prev => prev + 1);
      fetchRestaurants(appliedFilters, 1, false);
    },
    'food:category:update': () => {
      debugLog('Real-time socket update for category: refetching...');
      setRefetchTrigger(prev => prev + 1);
    },
    'banner:update': (data) => {
      if (data?.section === 'hero' || data?.section === 'home-promotion' || data?.section === 'home') {
        debugLog('Real-time socket update for banners: refetching...');
        setRefetchTrigger(prev => prev + 1);
      }
    },
    'offer:update': () => {
      debugLog('Real-time socket update for offers: refetching...');
      setRefetchTrigger(prev => prev + 1);
    },
    'settings:update': () => {
      debugLog('Real-time socket update for settings: refetching...');
      setRefetchTrigger(prev => prev + 1);
    }
  }), [fetchRestaurants, appliedFilters]);
  usePublicSocket(publicSocketListeners);

  // Fetch restaurants when appliedFilters change
  useEffect(() => {
    setRestaurantsPage(1);
    fetchRestaurants(appliedFilters, 1, false);
  }, [appliedFilters, fetchRestaurants]);

  // Recalculate distances when user location updates
  useEffect(() => {
    if (!effectiveLocation?.latitude || !effectiveLocation?.longitude) return;

    setRestaurantsData((prevData) => {
      if (!prevData || prevData.length === 0) return prevData;

      const calculateDistance = (lat1, lng1, lat2, lng2) => {
        const R = 6371; // Earth's radius in kilometers
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in kilometers
      };

      const userLat = effectiveLocation.latitude;
      const userLng = effectiveLocation.longitude;

      let hasChanges = false;
      const updatedRestaurants = prevData.map((restaurant) => {
        if (!restaurant.location) return restaurant;

        const restaurantLat =
          restaurant.location?.latitude ||
          (restaurant.location?.coordinates &&
            Array.isArray(restaurant.location.coordinates)
            ? restaurant.location.coordinates[1]
            : null);
        const restaurantLng =
          restaurant.location?.longitude ||
          (restaurant.location?.coordinates &&
            Array.isArray(restaurant.location.coordinates)
            ? restaurant.location.coordinates[0]
            : null);

        if (
          !restaurantLat ||
          !restaurantLng ||
          isNaN(restaurantLat) ||
          isNaN(restaurantLng)
        ) {
          return restaurant;
        }

        const distanceInKm = calculateDistance(
          userLat,
          userLng,
          restaurantLat,
          restaurantLng,
        );
        let calculatedDistance = null;

        // Format distance: show 1 decimal place if >= 1km, otherwise show in meters
        if (distanceInKm >= 1) {
          calculatedDistance = `${distanceInKm.toFixed(1)} km`;
        } else {
          const distanceInMeters = Math.round(distanceInKm * 1000);
          calculatedDistance = `${distanceInMeters} m`;
        }

        if (
          restaurant.distance !== calculatedDistance ||
          restaurant.distanceInKm !== distanceInKm
        ) {
          hasChanges = true;
          return {
            ...restaurant,
            distance: calculatedDistance,
            distanceInKm: distanceInKm, // Preserve numeric distance for sorting
          };
        }
        return restaurant;
      });

      return hasChanges ? updatedRestaurants : prevData;
    });

    debugLog(
      "?? Recalculated distances for all restaurants based on user location",
    );
  }, [effectiveLocation?.latitude, effectiveLocation?.longitude]);

  // IMPORTANT:
  // Homepage should avoid eager N+1 menu requests. We only resolve menu metadata
  // when the UI truly needs it: Veg Mode is enabled, or admin categories are unavailable.
  useEffect(() => {
    const restaurantIds = menuUnionRestaurantIdsKey
      ? menuUnionRestaurantIdsKey.split(",").filter(Boolean)
      : [];
    const shouldFetchMenuMeta = vegMode || realCategories.length === 0;

    const fetchMenuCategories = async () => {
      const requestSeq = ++menuUnionRequestSeqRef.current;

      if (!menuUnionRestaurantIdsKey || !shouldFetchMenuMeta) {
        setMenuCategories([]);
        setRestaurantDietMeta({});
        setLoadingMenuCategories(false);
        return;
      }

      setLoadingMenuCategories(true);
      try {
        const categoryMap = new Map();
        const menuCache = menuUnionCacheRef.current;
        const menuResponses = [];

        for (let index = 0; index < restaurantIds.length; index += 4) {
          const batchIds = restaurantIds.slice(index, index + 4);
          const batchResponses = await Promise.all(
            batchIds.map(async (id) => {
              if (!id) return { id: null, menu: null };

              if (menuCache.has(id)) {
                return { id, menu: menuCache.get(id) };
              }

              try {
                const response = await restaurantAPI.getMenuByRestaurantId(id);
                const menu = response?.data?.data?.menu || null;
                menuCache.set(id, menu);
                return { id, menu };
              } catch {
                menuCache.set(id, null);
                return { id, menu: null };
              }
            }),
          );

          if (requestSeq !== menuUnionRequestSeqRef.current) return;
          menuResponses.push(...batchResponses);
        }

        if (requestSeq !== menuUnionRequestSeqRef.current) return;

        const nextDietMeta = {};

        menuResponses.forEach(({ id, menu }) => {
          let hasVeg = false;
          let hasNonVeg = false;
          const sections = Array.isArray(menu?.sections) ? menu.sections : [];
          sections.forEach((section) => {
            const sectionItems = Array.isArray(section?.items)
              ? section.items
              : [];
            sectionItems.forEach((item) => {
              const foodType = String(item?.foodType || "")
                .trim()
                .toLowerCase();
              if (foodType === "veg") hasVeg = true;
              if (
                foodType === "non-veg" ||
                foodType === "non veg" ||
                foodType === "nonveg"
              )
                hasNonVeg = true;
            });

            const subsections = Array.isArray(section?.subsections)
              ? section.subsections
              : [];
            subsections.forEach((subsection) => {
              const subsectionItems = Array.isArray(subsection?.items)
                ? subsection.items
                : [];
              subsectionItems.forEach((item) => {
                const foodType = String(item?.foodType || "")
                  .trim()
                  .toLowerCase();
                if (foodType === "veg") hasVeg = true;
                if (
                  foodType === "non-veg" ||
                  foodType === "non veg" ||
                  foodType === "nonveg"
                )
                  hasNonVeg = true;
              });
            });

            const categoryName = String(section?.name || "").trim();
            if (!categoryName) return;

            const slug = slugifyCategory(categoryName);
            if (!slug) return;

            let image = "";
            if (Array.isArray(section?.items) && section.items.length > 0) {
              image = normalizeImageUrl(section.items[0]?.image);
            }
            if (!image && Array.isArray(section?.subsections)) {
              for (const subsection of section.subsections) {
                if (
                  Array.isArray(subsection?.items) &&
                  subsection.items.length > 0
                ) {
                  image = normalizeImageUrl(subsection.items[0]?.image);
                  if (image) break;
                }
              }
            }

            if (!categoryMap.has(slug)) {
              categoryMap.set(slug, {
                id: slug,
                name: categoryName,
                slug,
                label: categoryName,
                image: image || "",
              });
            } else if (image && !categoryMap.get(slug).image) {
              categoryMap.get(slug).image = image;
            }
          });

          if (id) {
            nextDietMeta[id] = {
              hasVeg,
              hasNonVeg,
              isPureVeg: hasVeg && !hasNonVeg,
            };
          }
        });

        const categories = Array.from(categoryMap.values())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((category, index) => ({
            ...category,
            image: category.image || "",
          }));

        setMenuCategories(categories);
        setRestaurantDietMeta(nextDietMeta);
      } finally {
        if (requestSeq === menuUnionRequestSeqRef.current) {
          setLoadingMenuCategories(false);
        }
      }
    };

    fetchMenuCategories();
  }, [
    menuUnionRestaurantIdsKey,
    normalizeImageUrl,
    realCategories.length,
    slugifyCategory,
    vegMode,
    refetchTrigger,
  ]);

  const matchesVegMode = useCallback(
    (restaurant) => {
      if (!vegMode) return true;
      if (vegModeOption === "pure-veg") {
        return restaurant?.restaurantType === "Veg";
      }
      if (vegModeOption === "all") {
        if (restaurant?.restaurantType === "Non-Veg") return false;
        if (restaurant?.restaurantType === "Both") {
          const meta = restaurantDietMeta[restaurant.id];
          if (meta) {
            return meta.hasVeg === true;
          }
          return true; // Keep visible while metadata is loading to avoid flicker
        }
        return true;
      }
      return true;
    },
    [vegMode, vegModeOption, restaurantDietMeta],
  );

  // Filter restaurants and foods based on active filters
  const filteredRestaurants = useMemo(() => {
    // Rely on API data which is already filtered and sorted by the backend.
    // We only apply client-side Veg Mode filtering here.
    return (restaurantsData || []).filter(matchesVegMode);
  }, [restaurantsData, matchesVegMode]);

  const restaurantLazyLoadResetKey = useMemo(() => {
    const activeFilterKey = Array.from(activeFilters).sort().join("|");
    return `${restaurantsData.length}:${activeFilterKey}:${selectedCuisine || ""}:${sortBy || ""}:${vegMode ? "1" : "0"}:${vegModeOption}`;
  }, [activeFilters, restaurantsData.length, selectedCuisine, sortBy, vegMode, vegModeOption]);

  const visibleRestaurants = filteredRestaurants;

  const hasMoreRestaurants = hasMoreRestaurantsBackend;

  const handleLoadMore = useCallback(async () => {
    if (loadingMoreRestaurants || !hasMoreRestaurantsBackend) return;
    const nextPage = restaurantsPage + 1;
    setRestaurantsPage(nextPage);
    setLoadingMoreRestaurants(true);
    try {
      await fetchRestaurants(appliedFilters, nextPage, true);
    } catch (error) {
      debugError("Error loading more restaurants:", error);
      setLoadingMoreRestaurants(false);
    }
  }, [restaurantsPage, loadingMoreRestaurants, hasMoreRestaurantsBackend, fetchRestaurants, appliedFilters]);

  const recommendedForYouRestaurants = useMemo(() => {
    const idsInOrder = (recommendedRestaurantIds || []).map((id) => String(id));
    const hasIds = idsInOrder.length > 0;
    const fromSettings = Array.isArray(recommendedRestaurantsFromSettings)
      ? recommendedRestaurantsFromSettings
      : [];

    // Primary source: restaurants returned by landing settings API (already admin-selected).
    const fromSettingsMapped = fromSettings.map((restaurant) => {
      const restaurantId = restaurant?._id ? String(restaurant._id) : "";
      const cuisine =
        Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0
          ? restaurant.cuisines[0]
          : "Multi-cuisine";
      const imageCandidates = extractImages([
        ...(Array.isArray(restaurant?.coverImages)
          ? restaurant.coverImages
          : [restaurant?.coverImages]
        ).filter(Boolean),
        restaurant?.profileImage,
      ]);
      const image = imageCandidates[0] || "";

      return {
        id: restaurant?.restaurantId || restaurantId,
        mongoId: restaurantId,
        name: getRestaurantDisplayName(restaurant),
        cuisine,
        rating: Number(restaurant?.rating) || 0,
        distance: "",
        deliveryTime: "",
        image: normalizeImageUrl(image) || "",
        images: imageCandidates.length > 0 ? imageCandidates : [],
        slug: restaurant?.slug || restaurant?.restaurantId || restaurantId,
        offer: null,
        pureVegRestaurant: restaurant?.pureVegRestaurant === true,
        isActive: true,
        isAcceptingOrders: true,
      };
    });

    // Keep admin-selected order when IDs exist.
    const orderedFromSettings = hasIds
      ? idsInOrder
        .map((id) =>
          fromSettingsMapped.find(
            (restaurant) => String(restaurant.mongoId) === id,
          ),
        )
        .filter(Boolean)
      : fromSettingsMapped;

    // Fallback: if settings payload misses some entries, recover them from fetched restaurant list by ID.
    const existingIds = new Set(
      orderedFromSettings.map((restaurant) =>
        String(restaurant.mongoId || restaurant.id),
      ),
    );
    const fromFetchedMissing = (restaurantsData || []).filter((restaurant) => {
      const mongoId = String(restaurant.mongoId || "");
      return (
        hasIds && idsInOrder.includes(mongoId) && !existingIds.has(mongoId)
      );
    });

    return [...orderedFromSettings, ...fromFetchedMissing]
      .filter(matchesVegMode)
      .slice(0, 12);
  }, [
    recommendedRestaurantIds,
    recommendedRestaurantsFromSettings,
    restaurantsData,
    extractImages,
    normalizeImageUrl,
    matchesVegMode,
  ]);

  // Featured foods removed - will be handled by restaurants data from API
  const filteredFeaturedFoods = useMemo(() => {
    // Return empty array - featured foods will come from API if needed
    return [];
  }, [activeFilters, sortBy]);

  // Memoize callbacks to prevent unnecessary re-renders
  const handleLocationClick = useCallback(() => {
    openLocationSelector();
  }, [openLocationSelector]);

  const handleSearchFocus = useCallback(() => {
    navigate("/food/user/search");
  }, [navigate]);

  const handleSearchClose = useCallback(() => {
    closeSearch();
    setHeroSearch("");
  }, [closeSearch]);

  // Removed GSAP animations - using CSS and ScrollReveal components instead for better performance
  // Auto-scroll removed - manual scroll only

  // Animated placeholder cycling - same as RestaurantDetails highlight offer animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 2000); // Change placeholder every 2 seconds (same as RestaurantDetails)

    return () => clearInterval(interval);
  }, []); // placeholders is a constant, no need for dependency

  // Memoized Hero Banner Component for better perf
  const HeroBannerSection = useMemo(() => {
    if (showBannerSkeleton) {
      return (
        <div className="px-4 md:px-0 py-2">
          <HeroBannerSkeleton className="h-36 sm:h-44 lg:h-56 rounded-2xl" />
        </div>
      );
    }

    if (heroBannerImages.length === 0) return null;

    return (
      <div className="px-4 md:px-0 py-2">
        <div
          ref={heroShellRef}
          data-home-hero-shell="true"
          className="relative w-full overflow-hidden aspect-[16/9] md:aspect-[21/9] lg:aspect-[2.5/1] rounded-2xl shadow-sm group cursor-pointer bg-white"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="absolute inset-0 z-0">
            {/* Shining Glint Effect */}
            <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
              <motion.div
                animate={{
                  x: ['-200%', '200%'],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  repeatDelay: 5,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg] w-[150%] h-full"
              />
            </div>
            {heroBannerImages.map((image, index) => (
              <div
                key={`${index}-${image}`}
                className="absolute inset-0 transition-opacity duration-700 ease-in-out"
                style={{
                  opacity: currentBannerIndex === index ? 1 : 0,
                  zIndex: currentBannerIndex === index ? 2 : 1,
                  pointerEvents: "none",
                }}>
                <img
                  src={image}
                  alt={`Hero Banner ${index + 1}`}
                  className="h-full w-full object-cover"
                  loading={index === currentBannerIndex ? "eager" : "lazy"}
                  fetchPriority={index === currentBannerIndex ? "high" : "low"}
                  draggable={false}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            className="absolute inset-0 z-20 h-full w-full border-0 p-0 bg-transparent text-left cursor-pointer"
            onClick={() => {
              const bannerData = heroBannersData[currentBannerIndex];
              if (!bannerData) return;

              // 1. If banner is linked to a food category, redirect to the category page
              const catSlug = bannerData.categorySlug || (bannerData.categoryName ? slugifyCategory(bannerData.categoryName) : "");
              if (catSlug) {
                navigate(`/food/user/category/${catSlug}`);
                return;
              }

              // 2. Fallback to linked restaurant if any
              const linkedRestaurants = bannerData?.linkedRestaurants || [];
              if (linkedRestaurants.length > 0) {
                const firstRestaurant = linkedRestaurants[0];
                const restaurantSlug = firstRestaurant.slug || firstRestaurant.restaurantId || firstRestaurant._id;
                navigate(`/restaurants/${restaurantSlug}`);
              }
            }}
            aria-label={`Open hero banner ${currentBannerIndex + 1}`}
          />

          {/* Desktop Navigation Arrows */}
          {heroBannerImages.length > 1 && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); setCurrentBannerIndex((prev) => (prev - 1 + heroBannerImages.length) % heroBannerImages.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-30 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-md backdrop-blur-sm transition-all hover:scale-105"
                aria-label="Previous banner"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setCurrentBannerIndex((prev) => (prev + 1) % heroBannerImages.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-30 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-md backdrop-blur-sm transition-all hover:scale-105"
                aria-label="Next banner"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Indicators removed as requested */}
        </div>
      </div>
    );
  }, [heroBannerImages, currentBannerIndex, showBannerSkeleton, heroBannersData, navigate]);

  // Memoized Category Rail Component
  const CategoryRailSection = useMemo(() => {
    return (
      <section className="space-y-1 sm:space-y-1.5 lg:space-y-2 min-h-[108px] sm:min-h-[120px]">
        <div
          ref={categoryScrollRef}
          className="flex gap-3 sm:gap-4 lg:gap-5 overflow-x-auto overflow-y-visible scrollbar-hide scroll-smooth px-2 sm:px-3 py-2 sm:py-3"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {/* Meals Under 200 Card */}
          <div
            className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
            onClick={() => navigate("/user/under-250")}
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 aspect-square bg-[#F84E04] rounded-b-full rounded-t-sm shadow-md border-t-4 border-orange-200 flex flex-col items-center justify-center p-1">
              <span className="text-[10px] sm:text-xs font-bold text-white text-center leading-tight">UNDER</span>
              <span className="text-sm sm:text-base font-extrabold text-white">₹200</span>
              <div className="w-10 h-3.5 bg-white rounded-full mt-1 flex items-center justify-center">
                <span className="text-[8px] font-bold text-[#F84E04]">Explore</span>
              </div>
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Offers</span>
          </div>

          {showCategorySkeleton ? (
            <CategoryChipRowSkeleton className="py-1" />
          ) : (
            (displayCategories.length > 8 ? displayCategories.slice(0, 8) : displayCategories).map((category, index) => (
              <Link
                key={category.id || index}
                to={`/food/user/category/${category.slug || category.name.toLowerCase().replace(/\s+/g, "-")}`}
                className="flex-shrink-0 flex flex-col items-center gap-2 group transition-all duration-300 hover:-translate-y-1"
                style={{ animation: `fade-in-up 0.5s ease-out forwards ${index * 0.05}s`, opacity: 0 }}
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 aspect-square rounded-full overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 group-hover:border-[#F84E04] transition-colors">
                  <OptimizedImage
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    sizes="80px"
                  />
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 text-center truncate max-w-[72px]">
                  {category.name}
                </span>
              </Link>
            ))
          )}

          {displayCategories.length > 8 && !showCategorySkeleton && (
            <div
              className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group"
              onClick={() => navigate("/food/user/categories")}
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-orange-50 dark:bg-orange-950 flex items-center justify-center border border-orange-100 group-hover:border-[#F84E04] transition-all">
                <Plus className="w-6 h-6 text-[#F84E04]" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-350">More</span>
            </div>
          )}
        </div>
      </section>
    );
  }, [displayCategories, showCategorySkeleton, navigate]);

  return (

    <div className="relative min-h-screen bg-white dark:bg-[#0a0a0a] pb-16 md:pb-6 overflow-x-clip">


      <div className="transition-all duration-300">
        {/* Unified Background for Entire Page - Vibrant Food Theme */}
        <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none overflow-hidden z-0">
          {/* Main Background */}
          <div className="absolute inset-0 bg-white dark:bg-[#0a0a0a]"></div>
          {/* Background Elements - Reduced to 2 blobs with CSS animations for better performance */}
          <div className="absolute inset-0 overflow-hidden opacity-20">
            {/* Top right blob - CSS animation */}
            <div
              style={{
                animation: "blob 8s ease-in-out infinite",
                willChange: "transform",
              }}
            />
            {/* Bottom left blob - CSS animation */}
            <div
              style={{
                animation: "blob-reverse 10s ease-in-out infinite",
                willChange: "transform",
              }}
            />
          </div>
          {/* CSS keyframes for animations */}
          <style>{`
          @keyframes blob {
            0%, 100% {
              transform: translate(0, 0) scale(1);
            }
            50% {
              transform: translate(50px, -30px) scale(1.2);
            }
          }
          @keyframes blob-reverse {
            0%, 100% {
              transform: translate(0, 0) scale(1);
            }
            50% {
              transform: translate(-40px, 40px) scale(1.3);
            }
          }
          @keyframes fade-in {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes gradient {
            0%, 100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }
          @keyframes fade-in-up {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes wiggle {
            0%, 100% {
              transform: rotate(0deg);
            }
            25% {
              transform: rotate(10deg);
            }
            75% {
              transform: rotate(-10deg);
            }
          }
          @keyframes placeholderFade {
            0% {
              opacity: 0;
              transform: translateY(20px);
            }
            100% {
              opacity: 0.6;
              transform: translateY(0);
            }
          }
          @keyframes gradientShift {
            0%, 100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }
          @keyframes slideUp {
            0% {
              opacity: 0;
              transform: translateY(15px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }
            .red-header-bg {
              background-color: #ef4f5f;
              background-image: linear-gradient(180deg, #ef4f5f 0%, #e03546 100%);
            }
            @keyframes gradient-shift {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            .animate-gradient-shift {
              animation: gradient-shift 3s ease infinite;
            }
          `}</style>
        </div>

        <div className="relative overflow-x-clip bg-white dark:bg-[#0a0a0a]">
          {/* Brand Top Section (Theme Color) */}
          <div className="md:hidden relative overflow-hidden bg-[var(--module-theme-color,#F84E04)] rounded-b-[2rem] shadow-lg mb-2">
            {festVideoActive && (
              <div className="absolute inset-0 z-0">
                <video
                  src={festBannerVideoUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
                <div className="absolute inset-0 bg-black/40" />
              </div>
            )}
            <div className="relative z-10">
              <HomeHeader
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                location={effectiveLocation}
                handleLocationClick={handleLocationClick}
                handleSearchFocus={handleSearchFocus}
                placeholderIndex={placeholderIndex}
                placeholders={placeholders}
                vegMode={vegMode}
                handleVegModeChange={handleVegModeChange}
              />

              {activeTab === "food" && (
                <FestBanner
                  isVegMode={vegMode}
                  videoUrl={festBannerVideoUrl}
                  hideFoodImages={true}
                />
              )}
            </div>
          </div>

          <div className="md:hidden mb-4 mt-2">
            <ModuleNavbar />
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "food" ? (
              <motion.div
                key="food-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-transparent dark:bg-transparent max-w-7xl mx-auto px-0 md:px-6 lg:px-8"
              >

                {/* "What's on your mind today?" Section - Now with Sticky Logic */}
                <div
                  id="categories-section"
                  className="px-4 md:px-0 py-2.5 space-y-3 bg-white dark:bg-[#0a0a0a]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white min-w-0 flex-shrink leading-tight">What's on your mind today?</h2>
                    <div className="h-[1px] bg-gray-100 dark:bg-gray-800 flex-1"></div>
                    <Link to="/food/user/categories" className="text-sm font-bold text-gray-400 dark:text-gray-500 flex items-center gap-0.5 whitespace-nowrap shrink-0">
                      View All <ArrowDownUp className="h-3 w-3 rotate-90" />
                    </Link>
                  </div>
                  {/* Categories Horizontal Slider */}
                  <div className="flex overflow-x-auto gap-2.5 pb-1.5 scrollbar-hide -mx-4 px-4 mask-edge-fade">
                    {(displayCategories.length > 8 ? displayCategories.slice(0, 8) : displayCategories).map((category, index) => (
                      <div
                        key={category.id || index}
                        onClick={() => {
                          const slug = category.slug || category.name.toLowerCase().replace(/\s+/g, "-");
                          navigate(`/food/user/category/${slug}`);
                        }}
                        className="flex-shrink-0 flex flex-col items-center gap-1.5 group w-[70px] xs:w-[78px] sm:w-[94px] md:w-[104px] cursor-pointer"
                      >
                        <div className={`relative w-16 h-16 xs:w-16 sm:w-20 sm:h-20 shrink-0 aspect-square rounded-full overflow-hidden shadow-md border-2 border-gray-150 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] group-active:scale-95 transition-all duration-300`}>
                          {/* Shining Glint Effect */}
                          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
                            <motion.div
                              animate={{
                                x: ['-200%', '200%'],
                              }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                repeatDelay: 3 + index * 0.5,
                                ease: "easeInOut"
                              }}
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] w-[150%] h-full"
                            />
                          </div>

                          <OptimizedImage
                            src={category.image}
                            alt={category.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          />
                        </div>
                        <span className={`text-[10px] xs:text-[11px] sm:text-xs font-bold text-gray-555 dark:text-gray-400 group-hover:text-[#F84E04] text-center leading-tight line-clamp-2 w-full px-0.5`}>
                          {category.name}
                        </span>
                      </div>
                    ))}
                    {displayCategories.length > 8 && (
                      <div
                        onClick={() => navigate("/food/user/categories")}
                        className="flex-shrink-0 flex flex-col items-center gap-1.5 group w-[70px] xs:w-[78px] sm:w-[94px] md:w-[104px] cursor-pointer"
                      >
                        <div className="relative w-16 h-16 xs:w-16 sm:w-20 sm:h-20 shrink-0 aspect-square rounded-full overflow-hidden shadow-md border-2 border-transparent bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center group-hover:bg-orange-100 dark:group-hover:bg-orange-900/30 transition-all duration-300">
                          <Plus className="w-6 h-6 text-[#F84E04]" />
                        </div>
                        <span className="text-[10px] xs:text-[11px] sm:text-xs font-bold text-gray-555 dark:text-gray-400 group-hover:text-[#F84E04] text-center leading-tight">
                          More
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dynamic Sticky Header (Search + Slider + Filters) */}
                <AnimatePresence>
                  {isStickyHeaderVisible && (
                    <motion.div
                      initial={{ y: -200 }}
                      animate={{ y: 0 }}
                      exit={{ y: -200 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="md:hidden fixed top-0 left-0 right-0 z-[100] bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md shadow-md border-b border-gray-100 dark:border-gray-855 safe-top"
                    >
                      {/* Search Bar Row (appears when scrolling up) */}
                      <AnimatePresence>
                        {showStickySearch && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-3 pt-2 pb-1.5"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="flex-1 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl flex items-center px-3 py-1 cursor-pointer border border-[#F84E04] dark:border-[#F84E04]/40 shadow-sm h-8"
                                onClick={handleSearchFocus}
                              >
                                <Search className="h-4 w-4 text-[#F84E04] mr-2" strokeWidth={2.5} />
                                <div className="flex-1 relative h-4 overflow-hidden">
                                  <span className="absolute inset-0 text-xs text-gray-400 dark:text-gray-400 font-bold">Search "biryani"</span>
                                </div>
                                <div className="h-4 w-[1px] bg-gray-200 dark:bg-gray-800 mx-2" />
                                <Mic className="h-4 w-4 text-[#F84E04]" />
                              </div>

                              {/* Veg Toggle in Sticky Header */}
                              <div
                                className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all duration-300 cursor-pointer shadow-sm h-8 ${vegMode ? 'border-[#00b09b]/50 bg-[#00b09b]/10' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a1a]'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVegModeChange?.(!vegMode);
                                }}
                              >
                                <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${vegMode ? 'border-[#00b09b] bg-[#00b09b]' : 'border-gray-300 dark:border-gray-700'}`}>
                                  {vegMode && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
                                </div>
                                <span className={`text-[10px] font-extrabold uppercase tracking-tight ${vegMode ? 'text-[#00b09b]' : 'text-gray-550 dark:text-gray-400'}`}>Veg</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Categories Slider (Sticky Mode) */}
                      <div className="flex overflow-x-auto gap-2.5 py-1.5 px-4 scrollbar-hide mask-edge-fade border-b border-gray-100 dark:border-gray-800">
                        {(displayCategories.length > 8 ? displayCategories.slice(0, 8) : displayCategories).map((category, index) => (
                          <div
                            key={`sticky-${category.id || index}`}
                            onClick={() => {
                              const slug = category.slug || category.name.toLowerCase().replace(/\s+/g, "-");
                              navigate(`/food/user/category/${slug}`);
                            }}
                            className="flex-shrink-0 flex flex-col items-center gap-1.5 group w-[70px] xs:w-[78px] sm:w-[94px] md:w-[104px] cursor-pointer"
                          >
                            <div className={`relative w-16 h-16 xs:w-16 sm:w-20 sm:h-20 shrink-0 aspect-square rounded-full overflow-hidden shadow-md border-2 border-gray-150 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] group-active:scale-95 transition-all duration-300`}>
                              {/* Shining Glint Effect */}
                              <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
                                <motion.div
                                  animate={{
                                    x: ['-200%', '200%'],
                                  }}
                                  transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    repeatDelay: 3 + index * 0.5,
                                    ease: "easeInOut"
                                  }}
                                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] w-[150%] h-full"
                                />
                              </div>

                              <OptimizedImage
                                src={category.image}
                                alt={category.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                              />
                            </div>
                            <span className={`text-[10px] xs:text-[11px] sm:text-xs font-bold text-gray-555 dark:text-gray-400 group-hover:text-[#F84E04] text-center leading-tight line-clamp-2 w-full px-0.5`}>
                              {category.name}
                            </span>
                          </div>
                        ))}
                        {displayCategories.length > 8 && (
                          <div
                            onClick={() => navigate("/food/user/categories")}
                            className="flex-shrink-0 flex flex-col items-center gap-1.5 group w-[70px] xs:w-[78px] sm:w-[94px] md:w-[104px] cursor-pointer"
                          >
                            <div className="relative w-16 h-16 xs:w-16 sm:w-20 sm:h-20 shrink-0 aspect-square rounded-full overflow-hidden shadow-md border-2 border-transparent bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center group-hover:bg-orange-100 dark:group-hover:bg-orange-900/30 transition-all duration-300">
                              <Plus className="w-6 h-6 text-[#F84E04]" />
                            </div>
                            <span className="text-[10px] xs:text-[11px] sm:text-xs font-bold text-gray-555 dark:text-gray-400 group-hover:text-[#F84E04] text-center leading-tight">
                              More
                            </span>
                          </div>
                        )}
                      </div>


                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Admin Hero Banners Section - Now below categories */}
                {HeroBannerSection}



              </motion.div>
            ) : (
              <motion.div
                key="quick-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {recommendedForYouRestaurants.length > 0 && (
          <motion.section
            className="content-auto pt-1 sm:pt-2 max-w-7xl mx-auto px-0 md:px-6 lg:px-8"
            initial={false}
            animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-xs sm:text-sm lg:text-base font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-2 sm:mb-3 px-4 md:px-0">
              Recommended For You
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 px-4 md:px-0">
              {recommendedForYouRestaurants.map((restaurant, index) => {
                const restaurantSlug =
                  restaurant.slug ||
                  restaurant.name.toLowerCase().replace(/\s+/g, "-");
                return (
                  <motion.div
                    key={`recommended-${restaurant.mongoId || restaurant.id || restaurantSlug}`}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: index * 0.05 }}>
                    <Link
                      to={`/user/restaurants/${restaurantSlug}`}
                      className="block rounded-[20px] overflow-hidden border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] shadow-sm hover:shadow-md transition-shadow">
                      <div className="relative w-full aspect-[4/3] bg-gray-50 overflow-hidden rounded-t-[20px]">
                        <RestaurantImageCarousel
                          restaurant={restaurant}
                          backendOrigin={BACKEND_ORIGIN}
                          className="w-full h-full"
                          roundedClass=""
                        />
                        <div className={`absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md ${Number(restaurant.rating) > 0 ? "bg-black/85 backdrop-blur-md text-white font-black" : "bg-gray-800/90 text-white font-bold"} text-[9px] xs:text-[10px] shadow-lg border border-white/10`}>
                          {Number(restaurant.rating) > 0 ? Number(restaurant.rating).toFixed(1) : "NEW"}
                        </div>
                      </div>
                      <div className="p-2.5">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate tracking-tight">
                          {restaurant.name}
                        </p>
                        <p className="text-[10px] text-[#F84E04] font-bold mt-1 flex items-center gap-1 uppercase tracking-wider">
                          <Flame className="w-3.5 h-3.5 fill-[#F84E04]" />
                          Near & Fast
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Explore More Section */}
        <motion.section
          className="content-auto pt-2 sm:pt-3 lg:pt-4 max-w-7xl mx-auto px-0 md:px-6 lg:px-8"
          initial={false}
          animate={{ opacity: 1, y: 0 }}>
          <div className="px-4 md:px-0 mb-6 flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight">
              {exploreMoreHeading}
            </h2>
            <div className="h-[1px] bg-gray-100 dark:bg-gray-800 flex-1"></div>
          </div>
          <div className="px-4 md:px-0 pb-4 lg:pb-6">
            <div className="flex overflow-x-auto no-scrollbar gap-6 sm:gap-8 md:gap-10 items-start justify-start py-2">
              {showExploreSkeleton ? (
                Array(6).fill(0).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-20 sm:w-24 md:w-28">
                    <ExploreGridSkeleton count={1} />
                  </div>
                ))
              ) : (
                finalExploreItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.4,
                      delay: index * 0.08,
                    }}
                    whileHover={{ y: -8 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-shrink-0 w-20 sm:w-24 md:w-28">
                    <Link
                      to={item.href}
                      state={{ backTo: "/user" }}
                      className="block w-full">
                      <div className="flex flex-col items-center gap-2 w-full group">
                        <div className="relative w-full aspect-square rounded-[1.25rem] bg-white dark:bg-[#1a1a1a] flex items-center justify-center shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] group-hover:shadow-[0_12px_24px_-6px_rgba(0,0,0,0.15)] transition-all duration-500 overflow-hidden border border-gray-100 dark:border-gray-800 group-hover:border-[#F84E04]/40">
                          {/* Colorful Glow Background */}
                          <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br ${index % 3 === 0 ? 'from-[#F84E04] to-rose-500' : index % 3 === 1 ? 'from-indigo-500 to-purple-500' : 'from-teal-500 to-emerald-500'} z-20 pointer-events-none`} />

                          {/* Shine Effect */}
                          <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                            <motion.div
                              animate={{ x: ['-200%', '200%'] }}
                              transition={{ duration: 3, repeat: Infinity, repeatDelay: 5 + index * 0.5 }}
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-[-25deg] w-[150%]"
                            />
                          </div>

                          <OptimizedImage
                            src={item.image}
                            alt={item.label}
                            className="w-full h-full object-cover relative z-10 transition-transform duration-500 group-hover:scale-110"
                            width={200}
                            height={200}
                          />
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-bold text-gray-500 dark:text-gray-400 group-hover:text-[#F84E04] dark:group-hover:text-white transition-colors text-center tracking-tight leading-tight uppercase px-1">
                          {item.label}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.section>



        {/* Restaurants Grid */}
        <motion.section
          className="content-auto space-y-0 pt-3 sm:pt-4 lg:pt-6 pb-8 md:pb-10 max-w-7xl mx-auto px-0 md:px-6 lg:px-8"
          initial={false}
          animate={{ opacity: 1 }}>
          <div className="px-4 md:px-0 mb-5 flex items-center justify-between">
            <div className="flex flex-col gap-0.5 lg:gap-1">
              <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#F84E04]/90 dark:text-orange-400/90">
                Restaurants Near You
              </h2>
              <span className="text-lg sm:text-xl lg:text-2xl font-black text-gray-900 dark:text-white leading-tight">
                Order from the best
              </span>
            </div>
            <Link
              to="/food/user/restaurants"
              className="text-sm font-bold text-[#F84E04] hover:text-[#D94203] transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              View All
              <ArrowDownUp className="h-3 w-3 rotate-90" />
            </Link>
          </div>

          {showRestaurantSkeleton || loadingRestaurants ? (
            <div className="px-4 md:px-0">
              <RestaurantGridSkeleton count={4} />
            </div>
          ) : visibleRestaurants.length === 0 ? (
            <div className="mx-4 flex flex-col items-center justify-center py-20 text-center px-4 bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-gray-800">
              <UtensilsCrossed className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-3" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">No Restaurants Available</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">We couldn't find any restaurants in your area right now. Try changing your location.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-4 md:px-0">
              {visibleRestaurants.map((restaurant, index) => {
                const restaurantSlug = restaurant.slug || restaurant.name.toLowerCase().replace(/\s+/g, "-");
                const availability = getRestaurantAvailabilityStatus(restaurant, new Date());
                const isAvailable = availability.isOpen;

                return (
                  <motion.div
                    key={`restaurant-${restaurant.mongoId || restaurant.id || restaurantSlug}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
                  >
                    <Link
                      to={`/food/user/restaurants/${restaurantSlug}`}
                      className="block h-full"
                    >
                      <div className={`bg-white dark:bg-[#151515] rounded-[20px] overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-800 group hover:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col h-full relative ${!isAvailable ? 'opacity-70' : ''}`}>
                        {/* Restaurant Image */}
                        <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-50 dark:bg-gray-900 rounded-t-[20px]">
                          <RestaurantImageCarousel
                            restaurant={restaurant}
                            backendOrigin={BACKEND_ORIGIN}
                            className="w-full h-full"
                            roundedClass=""
                          />
                          {/* Rating Badge */}
                          <div className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-lg ${Number(restaurant.rating) > 0 ? "bg-black/85 backdrop-blur-md text-white font-black" : "bg-gray-800/90 text-white font-bold"} text-[10px] xs:text-xs shadow-lg border border-white/10 flex items-center gap-1`}>
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            {Number(restaurant.rating) > 0 ? Number(restaurant.rating).toFixed(1) : "NEW"}
                          </div>
                          {/* Open/Closed Status Badge */}
                          {!isAvailable && (
                            <div className="absolute top-2 left-2 bg-red-500/90 backdrop-blur-md text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-lg">
                              Closed
                            </div>
                          )}
                          {/* Offer Badge */}
                          {restaurant.offer && (
                            <div className="absolute top-2 right-2 bg-[#F84E04]/90 backdrop-blur-md text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-lg">
                              {restaurant.offer}
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="p-3.5 flex flex-col flex-grow">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white tracking-tight line-clamp-1 flex-1">
                              {restaurant.name}
                            </h3>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2.5 line-clamp-1 font-medium">
                            {Array.isArray(restaurant.cuisines) && restaurant.cuisines.length > 0
                              ? restaurant.cuisines.slice(0, 3).join(", ")
                              : restaurant.cuisine || "Multi-cuisine"}
                          </p>

                          <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2.5 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-bold">
                              <div className="flex items-center gap-0.5">
                                <Clock className="w-3 h-3 flex-shrink-0" />
                                <span>{restaurant.deliveryTime || "25-30 mins"}</span>
                              </div>
                              {/* <div className="flex items-center gap-0.5">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span>{restaurant.distance || ""}</span>
                              </div> */}
                            </div>
                            <span className="bg-[#F84E04] text-white text-[9px] sm:text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-sm hover:bg-[#D94203] transition-colors whitespace-nowrap flex-shrink-0">
                              Order Now
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Load More Button & End of List Message */}
          {!showRestaurantSkeleton && !loadingRestaurants && (
            <div className="flex flex-col items-center justify-center mt-8 mb-12">
              {hasMoreRestaurantsBackend ? (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMoreRestaurants}
                  className="px-8 py-3 rounded-full bg-[#F84E04] hover:bg-[#D94203] text-white font-bold text-sm transition-all duration-300 shadow-[0_4px_14px_rgba(248,78,4,0.3)] hover:shadow-[0_6px_20px_rgba(248,78,4,0.4)] disabled:opacity-50 flex items-center gap-2"
                >
                  {loadingMoreRestaurants ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>More</span>
                  )}
                </button>
              ) : (
                filteredRestaurants.length > 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                      You've reached the end of the list. No more restaurants available.
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </motion.section>
      </div>

      {/* Filter Modal - Bottom Sheet */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-[100]">
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsFilterOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />

            {/* Modal Content */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] rounded-t-3xl max-h-[85vh] flex flex-col"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 400,
                duration: 0.3,
              }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b dark:border-gray-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Filters and sorting
                </h2>
                <button
                  onClick={() => {
                    setActiveFilters(new Set());
                    setSortBy(null);
                    setSelectedCuisine(null);
                  }}
                  className="text-[#F84E04] font-medium text-sm">
                  Clear all
                </button>
              </div>

              {/* Body */}
              <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar - Tabs */}
                <div className="w-24 sm:w-28 bg-gray-50 dark:bg-[#0a0a0a] border-r dark:border-gray-800 flex flex-col">
                  {[
                    { id: "sort", label: "Sort By", icon: ArrowDownUp },
                    { id: "time", label: "Time", icon: Timer },
                    { id: "rating", label: "Rating", icon: Star },
                    { id: "distance", label: "Distance", icon: MapPin },
                    { id: "price", label: "Dish Price", icon: IndianRupee },
                    { id: "offers", label: "Offers", icon: BadgePercent },
                    { id: "trust", label: "Trust", icon: ShieldCheck },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive =
                      activeScrollSection === tab.id ||
                      activeFilterTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveFilterTab(tab.id);
                          const section = filterSectionRefs.current[tab.id];
                          if (section) {
                            section.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                          }
                        }}
                        className={`flex flex-col items-center gap-1 py-4 px-2 text-center relative transition-colors ${isActive
                          ? "bg-white dark:bg-[#1a1a1a] text-[#F84E04]"
                          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                          }`}>
                        {isActive && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#F84E04] rounded-r" />
                        )}
                        <Icon className="h-5 w-5" strokeWidth={1.5} />
                        <span className="text-xs font-medium leading-tight">
                          {tab.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Right Content Area - Scrollable */}
                <div
                  ref={rightContentRef}
                  className="flex-1 overflow-y-auto p-4">
                  {/* Sort By Tab */}
                  <div
                    ref={(el) => (filterSectionRefs.current["sort"] = el)}
                    data-section-id="sort"
                    className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Sort by
                    </h3>
                    <div className="flex flex-col gap-3">
                      {[
                        { id: null, label: "Relevance" },
                        { id: "price-low", label: "Price: Low to High" },
                        { id: "price-high", label: "Price: High to Low" },
                        { id: "rating-high", label: "Rating: High to Low" },
                        { id: "rating-low", label: "Rating: Low to High" },
                      ].map((option) => (
                        <button
                          key={option.id || "relevance"}
                          onClick={() => setSortBy(option.id)}
                          className={`px-4 py-3 rounded-xl border text-left transition-colors ${sortBy === option.id
                            ? "border-[#F84E04] bg-[#F9F9FB] dark:bg-green-900/20"
                            : "border-gray-200 dark:border-gray-800 hover:border-[#F84E04]"
                            }`}>
                          <span
                            className={`text-sm font-medium ${sortBy === option.id ? "text-[#F84E04]" : "text-gray-700 dark:text-gray-300"}`}>
                            {option.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Tab */}
                  <div
                    ref={(el) => (filterSectionRefs.current["time"] = el)}
                    data-section-id="time"
                    className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Estimated Time
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => toggleFilter("delivery-under-30")}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has("delivery-under-30")
                          ? "border-[#F84E04] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#F84E04]"
                          }`}>
                        <Timer
                          className={`h-6 w-6 ${activeFilters.has("delivery-under-30") ? "text-[#F84E04]" : "text-gray-600 dark:text-gray-400"}`}
                          strokeWidth={1.5}
                        />
                        <span
                          className={`text-sm font-medium ${activeFilters.has("delivery-under-30") ? "text-[#F84E04]" : "text-gray-700 dark:text-gray-300"}`}>
                          Under 30 mins
                        </span>
                      </button>
                      <button
                        onClick={() => toggleFilter("delivery-under-45")}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has("delivery-under-45")
                          ? "border-[#F84E04] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#F84E04]"
                          }`}>
                        <Timer
                          className={`h-6 w-6 ${activeFilters.has("delivery-under-45") ? "text-[#F84E04]" : "text-gray-600 dark:text-gray-400"}`}
                          strokeWidth={1.5}
                        />
                        <span
                          className={`text-sm font-medium ${activeFilters.has("delivery-under-45") ? "text-[#F84E04]" : "text-gray-700 dark:text-gray-300"}`}>
                          Under 45 mins
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Rating Tab */}
                  <div
                    ref={(el) => (filterSectionRefs.current["rating"] = el)}
                    data-section-id="rating"
                    className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900  dark:text-white mb-4">
                      Restaurant Rating
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => toggleFilter("rating-35-plus")}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has("rating-35-plus")
                          ? "border-[#F84E04] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#F84E04]"
                          }`}>
                        <Star
                          className={`h-6 w-6 ${activeFilters.has("rating-35-plus") ? "text-[#F84E04] fill-[#F84E04]" : "text-gray-400 dark:text-gray-500"}`}
                        />
                        <span
                          className={`text-sm font-medium ${activeFilters.has("rating-35-plus") ? "text-[#F84E04]" : "text-gray-700 dark:text-gray-300"}`}>
                          Rated 3.5+
                        </span>
                      </button>
                      <button
                        onClick={() => toggleFilter("rating-4-plus")}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has("rating-4-plus")
                          ? "border-[#F84E04] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#F84E04]"
                          }`}>
                        <Star
                          className={`h-6 w-6 ${activeFilters.has("rating-4-plus") ? "text-[#F84E04] fill-[#F84E04]" : "text-gray-400 dark:text-gray-500"}`}
                        />
                        <span
                          className={`text-sm font-medium ${activeFilters.has("rating-4-plus") ? "text-[#F84E04]" : "text-gray-700 dark:text-gray-300"}`}>
                          Rated 4.0+
                        </span>
                      </button>
                      <button
                        onClick={() => toggleFilter("rating-45-plus")}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has("rating-45-plus")
                          ? "border-[#F84E04] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#F84E04]"
                          }`}>
                        <Star
                          className={`h-6 w-6 ${activeFilters.has("rating-45-plus") ? "text-[#F84E04] fill-[#F84E04]" : "text-gray-400 dark:text-gray-500"}`}
                        />
                        <span
                          className={`text-sm font-medium ${activeFilters.has("rating-45-plus") ? "text-[#F84E04]" : "text-gray-700 dark:text-gray-300"}`}>
                          Rated 4.5+
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Distance Tab */}
                  <div
                    ref={(el) => (filterSectionRefs.current["distance"] = el)}
                    data-section-id="distance"
                    className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Distance
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => toggleFilter("distance-under-1km")}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has("distance-under-1km")
                          ? "border-[#F84E04] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#F84E04]"
                          }`}>
                        <MapPin
                          className={`h-6 w-6 ${activeFilters.has("distance-under-1km") ? "text-[#F84E04]" : "text-gray-600 dark:text-gray-400"}`}
                          strokeWidth={1.5}
                        />
                        <span
                          className={`text-sm font-medium ${activeFilters.has("distance-under-1km") ? "text-[#F84E04]" : "text-gray-700 dark:text-gray-300"}`}>
                          Under 1 km
                        </span>
                      </button>
                      <button
                        onClick={() => toggleFilter("distance-under-2km")}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has("distance-under-2km")
                          ? "border-[#F84E04] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#F84E04]"
                          }`}>
                        <MapPin
                          className={`h-6 w-6 ${activeFilters.has("distance-under-2km") ? "text-[#F84E04]" : "text-gray-600 dark:text-gray-400"}`}
                          strokeWidth={1.5}
                        />
                        <span
                          className={`text-sm font-medium ${activeFilters.has("distance-under-2km") ? "text-[#F84E04]" : "text-gray-700 dark:text-gray-300"}`}>
                          Under 2 km
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Price Tab */}
                  <div
                    ref={(el) => (filterSectionRefs.current["price"] = el)}
                    data-section-id="price"
                    className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Dish Price
                    </h3>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => toggleFilter("price-under-200")}
                        className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has("price-under-200")
                          ? "border-[#F84E04] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#F84E04]"
                          }`}>
                        <span
                          className={`text-sm font-medium ${activeFilters.has("price-under-200") ? "text-[#F84E04]" : "text-gray-700 dark:text-gray-300"}`}>
                          Under ₹200
                        </span>
                      </button>
                      <button
                        onClick={() => toggleFilter("price-under-500")}
                        className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has("price-under-500")
                          ? "border-[#F84E04] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#F84E04]"
                          }`}>
                        <span
                          className={`text-sm font-medium ${activeFilters.has("price-under-500") ? "text-[#F84E04]" : "text-gray-700 dark:text-gray-300"}`}>
                          Under ₹500
                        </span>
                      </button>
                    </div>
                  </div>



                  {/* Trust Markers Tab */}
                  <div
                    ref={(el) => (filterSectionRefs.current["trust"] = el)}
                    data-section-id="trust"
                    className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Trust Markers
                    </h3>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => toggleFilter("top-rated")}
                        className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has("top-rated")
                          ? "border-[#F84E04] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#F84E04]"
                          }`}>
                        <span
                          className={`text-sm font-medium ${activeFilters.has("top-rated") ? "text-[#F84E04]" : "text-gray-700 dark:text-gray-300"}`}>
                          Top Rated
                        </span>
                      </button>
                      <button
                        onClick={() => toggleFilter("trusted")}
                        className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has("trusted")
                          ? "border-[#F84E04] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#F84E04]"
                          }`}>
                        <span
                          className={`text-sm font-medium ${activeFilters.has("trusted") ? "text-[#F84E04]" : "text-gray-700 dark:text-gray-300"}`}>
                          Trusted by 1000+ users
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Offers Tab */}
                  <div
                    ref={(el) => (filterSectionRefs.current["offers"] = el)}
                    data-section-id="offers"
                    className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Offers
                    </h3>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => toggleFilter("has-offers")}
                        className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has("has-offers")
                          ? "border-[#F84E04] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#F84E04]"
                          }`}>
                        <span
                          className={`text-sm font-medium ${activeFilters.has("has-offers") ? "text-[#F84E04]" : "text-gray-700 dark:text-gray-300"}`}>
                          Restaurants with offers
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 px-4 py-4 border-t dark:border-gray-800 bg-white dark:bg-[#1a1a1a]">
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-1 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">
                  Close
                </button>
                <button
                  onClick={async () => {
                    setIsFilterOpen(false);
                    await applyFiltersAndRefetch(
                      activeFilters,
                      sortBy,
                      selectedCuisine,
                    );
                  }}
                  className={`flex-1 py-3 font-semibold rounded-xl transition-colors ${activeFilters.size > 0 || sortBy || selectedCuisine
                    ? "bg-[#F84E04] text-slate-950 hover:bg-[#E6AC00]"
                    : "bg-gray-200 text-gray-500"
                    }`}
                  disabled={isLoadingFilterResults}>
                  {isLoadingFilterResults
                    ? "Loading..."
                    : activeFilters.size > 0 || sortBy || selectedCuisine
                      ? `Show results`
                      : "Show results"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Veg Mode Popup */}
      <AnimatePresence>
        {showVegModePopup && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                setShowVegModePopup(false);
                // Revert veg mode to OFF if popup is closed without applying
                setVegModeContext(false);
                setPrevVegMode(false);
              }}
              className="fixed inset-0 bg-black/30 z-[9998] backdrop-blur-sm"
            />

            {/* Popup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 300,
                mass: 0.8,
              }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl p-6 w-[calc(100%-2rem)] max-w-xs"
              onClick={(e) => e.stopPropagation()}>

              {/* Title */}
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">
                See veg dishes from
              </h3>

              {/* Radio Options */}
              <div className="space-y-2 mb-4">
                {/* All restaurants */}
                <label
                  className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setVegModeOption("all")}>
                  <div className="relative flex items-center justify-center">
                    <input
                      type="radio"
                      name="vegModeOption"
                      value="all"
                      checked={vegModeOption === "all"}
                      onChange={() => setVegModeOption("all")}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${vegModeOption === "all"
                        ? "border-green-600 dark:border-green-500 bg-green-600 dark:bg-green-500"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2a2a2a]"
                        }`}>
                      {vegModeOption === "all" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-white" />
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    All restaurants
                  </span>
                </label>

                {/* Pure Veg restaurants only */}
                <label
                  className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setVegModeOption("pure-veg")}>
                  <div className="relative flex items-center justify-center">
                    <input
                      type="radio"
                      name="vegModeOption"
                      value="pure-veg"
                      checked={vegModeOption === "pure-veg"}
                      onChange={() => setVegModeOption("pure-veg")}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${vegModeOption === "pure-veg"
                        ? "border-green-600 dark:border-green-500 bg-green-600 dark:bg-green-500"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2a2a2a]"
                        }`}>
                      {vegModeOption === "pure-veg" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-white" />
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Pure Veg restaurants only
                  </span>
                </label>
              </div>

              {/* Apply Button */}
              <button
                onClick={() => {
                  setShowVegModePopup(false);
                  setIsApplyingVegMode(true);
                  // Confirm veg mode is ON by updating context and prevVegMode
                  setVegModeContext(true);
                  setPrevVegMode(true);
                  // Simulate applying veg mode settings
                  setTimeout(() => {
                    setIsApplyingVegMode(false);
                  }, 2000);
                }}
                className="w-full bg-[#F84E04] text-slate-950 font-semibold py-2.5 rounded-xl hover:bg-[#E6AC00] transition-colors mb-2 text-sm">
                Apply
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Switch Off Veg Mode Popup */}
      <AnimatePresence>
        {showSwitchOffPopup && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                setShowSwitchOffPopup(false);
                isHandlingSwitchOff.current = false;
                setVegModeContext(true);
                // prevVegMode stays true (from before), which is correct
              }}
              className="fixed inset-0 bg-black/50 z-[9998] backdrop-blur-sm"
            />

            {/* Popup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 300,
                mass: 0.8,
              }}
              className="fixed inset-0 z-[9999] flex dark:bg-[#lalala] dark:text-white items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}>
              <div className="bg-white dark:bg-[#lalala] dark:text-white rounded-2xl shadow-2xl w-[85%] max-w-sm p-6">
                {/* Warning Icon */}
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 rounded-full bg-pink-100 flex items-center justify-center">
                    <AlertCircle
                      className="w-20 h-20 text-white bg-red-500/90 rounded-full p-2"
                      strokeWidth={2.5}
                    />
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-gray-900  text-center mb-2">
                  Switch off Veg Mode?
                </h2>

                {/* Description */}
                <p className="text-gray-600 text-center mb-6 text-sm">
                  You'll see all restaurants, including those serving non-veg
                  dishes
                </p>

                {/* Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowSwitchOffPopup(false);
                      setIsSwitchingOffVegMode(true);
                      // Simulate switching off veg mode
                      setTimeout(() => {
                        setIsSwitchingOffVegMode(false);
                        isHandlingSwitchOff.current = false;
                        setVegModeContext(false);
                        setPrevVegMode(false); // Set to false to match current state (veg mode is OFF)
                      }, 2000);
                    }}
                    className="w-full bg-transparent text-red-600 font-normal py-1 text-normal rounded-xl hover:bg-red-50 transition-colors text-base">
                    Switch off
                  </button>

                  <button
                    onClick={() => {
                      setShowSwitchOffPopup(false);
                      isHandlingSwitchOff.current = false;
                      setVegModeContext(true);
                      // prevVegMode stays true (from before), which is correct
                    }}
                    className="w-full text-gray-900 font-normal py-1 text-center rounded-xl hover:bg-gray-200 transition-colors text-base">
                    Keep using this mode
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* All Categories Modal */}
      <AnimatePresence>
        {showAllCategoriesModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowAllCategoriesModal(false)}
              className="fixed inset-0 bg-black/40 z-[9998] backdrop-blur-sm"
            />

            {/* Modal - Full screen with rounded corners */}
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 300,
              }}
              className="fixed inset-x-0 bottom-0 top-12 sm:top-16 md:top-20 z-[9999] bg-white dark:bg-[#1a1a1a] rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-5 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  All Categories
                </h2>
                <button
                  onClick={() => setShowAllCategoriesModal(false)}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close">
                  <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Categories Grid - Scrollable */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 sm:py-5">
                <div className="grid grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                  {displayCategories.map((category, index) => {
                    const categoryData = {
                      name: category.name || category.label,
                      image: category.image || category.imageUrl,
                      slug: category.slug,
                    };
                    return (
                      <motion.div
                        key={category.id || index}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.3,
                          delay: index * 0.02,
                          type: "spring",
                          stiffness: 100,
                        }}
                        whileTap={{ scale: 0.95 }}>
                        <Link
                          to={`/user/category/${categoryData.slug || categoryData.name.toLowerCase().replace(/\s+/g, "-")}`}
                          onClick={() => setShowAllCategoriesModal(false)}
                          className="block">
                          <div className="flex flex-col items-center gap-2 sm:gap-2.5 cursor-pointer w-full">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full overflow-hidden shadow-md transition-all hover:shadow-lg flex-shrink-0">
                              <OptimizedImage
                                src={categoryData.image}
                                alt={categoryData.name}
                                className="w-full h-full bg-white rounded-full"
                                sizes="(max-width: 640px) 80px, (max-width: 768px) 96px, 112px"
                                objectFit="cover"
                                placeholder="blur"
                                onError={() => { }}
                              />
                            </div>
                            <span className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200 text-center leading-tight px-1 break-words w-full min-w-0">
                              {categoryData.name}
                            </span>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isApplyingVegMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[10000] bg-white dark:bg-[#0a0a0a] flex items-center justify-center">
            <div className="relative w-32 h-32 flex items-center justify-center w-full">
              {/* Animated circles - positioned absolutely at the center */}
              {[...Array(8)].map((_, i) => {
                const baseSize = 112;
                const maxSize = 600;
                return (
                  <motion.div
                    key={i}
                    initial={{
                      scale: 1,
                      opacity: 0,
                    }}
                    animate={{
                      scale: maxSize / baseSize,
                      opacity: [0, 0.4, 0.2, 0],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeOut",
                      delay: i * 0.15,
                    }}
                    className="absolute rounded-full border border-green-300 dark:border-green-600"
                    style={{
                      width: baseSize,
                      height: baseSize,
                    }}
                  />
                );
              })}

              {/* 100% VEG badge - absolute positioning at exact center */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  delay: 0.1,
                }}
                className="absolute z-10 w-28 h-28 rounded-full border-2 border-green-600 dark:border-green-500 bg-white dark:bg-[#1a1a1a] flex flex-col items-center justify-center shadow-sm"
              >
                <motion.div
                  className="flex flex-col items-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}>
                  <span className="text-green-600 dark:text-green-400 font-extrabold text-3xl leading-none">
                    100%
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-extrabold text-3xl leading-none mt-0.5">
                    VEG
                  </span>
                </motion.div>
              </motion.div>

              {/* Text below badge */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-xl font-normal text-gray-800 dark:text-gray-200 text-center relative z-10 mt-56 w-full">
                Explore veg dishes from all restaurants
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Screen - Switching Off Veg Mode */}
      <AnimatePresence>
        {isSwitchingOffVegMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[10000] bg-white dark:bg-[#0a0a0a] flex items-center justify-center">
            <div className="flex flex-col items-center gap-6">
              {/* Two Circles Spinning in Opposite Directions */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  delay: 0.1,
                }}
                className="relative w-16 h-16 flex items-center justify-center">
                {/* Outer Circle - Spins Clockwise */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    rotate: {
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "linear",
                    },
                  }}
                  className="absolute w-16 h-16 border-[4px] border-transparent border-t-pink-500 dark:border-t-pink-400 border-r-pink-500 dark:border-r-pink-400 rounded-full"
                />

                {/* Inner Circle - Spins Counter-clockwise */}
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{
                    rotate: {
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    },
                  }}
                  className="absolute w-12 h-12 border-[4px] border-transparent border-r-pink-500 dark:border-r-pink-400 rounded-full"
                />
              </motion.div>

              {/* Loading Text */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center">
                <motion.h2
                  className="text-xl font-normal text-gray-800 dark:text-gray-200 mb-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}>
                  Switching off
                </motion.h2>
                <motion.p
                  className="text-xl font-normal text-gray-800 dark:text-gray-200"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}>
                  Veg Mode for you
                </motion.p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification - Fixed to viewport bottom */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showToast && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ duration: 0.3, type: "spring", damping: 25 }}
                className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[10001] bg-black text-white px-6 py-3 rounded-lg shadow-2xl">
                <p className="text-sm font-medium">Added to bookmark</p>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}






      <StickyCartCard />
      {/* Live order strip: only on homepage (not in UserLayout) */}
      <OrderTrackingCard hasBottomNav />
    </div>
  );
}
