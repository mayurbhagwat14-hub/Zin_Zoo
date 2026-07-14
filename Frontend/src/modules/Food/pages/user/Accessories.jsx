import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, ChevronLeft, Minus, Plus, ShoppingCart, X, Heart } from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { Card } from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { Input } from "@food/components/ui/input";
import PageNavbar from "@food/components/user/PageNavbar";
import { accessoriesPublicAPI, publicGetOnce } from "@food/api";
import { useCart } from "@food/context/CartContext";
import { useProfile } from "@food/context/ProfileContext";
import { toast } from "sonner";
import { Skeleton } from "@food/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@food/components/ui/sheet";
import { usePublicSocket } from "@food/hooks/usePublicSocket";
import ModuleNavbar from "@food/components/user/ModuleNavbar";
import StickyCartCard from "@food/components/user/StickyCartCard";
import HeaderNotificationBell from "@food/components/user/HeaderNotificationBell";

export default function AccessoriesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cart, addToCart, removeFromCart, updateQuantity } = useCart();
  const { addDishFavorite, removeDishFavorite, isDishFavorite } = useProfile();
  
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingProds, setLoadingProds] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentBanner, setCurrentBanner] = useState(0);
  const cartIconRef = useRef(null);

  const [dynamicBanners, setDynamicBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(true);

  const fetchBanners = async () => {
    try {
      setBannersLoading(true);
      const res = await publicGetOnce("/food/hero-banners/accessories/public");
      if (res?.data?.success && Array.isArray(res.data.data?.banners)) {
        setDynamicBanners(res.data.data.banners);
      } else {
        setDynamicBanners([]);
      }
    } catch (err) {
      console.error("Failed to fetch accessories banners", err);
      setDynamicBanners([]);
    } finally {
      setBannersLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchBanners();
  }, []);

  useEffect(() => {
    const catId = searchParams.get("category");
    if (catId) {
      setActiveCategory(catId);
      fetchProducts(catId);
    } else {
      fetchProducts();
    }
  }, [searchParams]);

  useEffect(() => {
    if (dynamicBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % dynamicBanners.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [dynamicBanners]);

  // Real-time updates from admin panel
  const socketListeners = useMemo(() => ({
    'accessories:category:update': () => {
      console.log('[accessories] Category updated via socket, refetching...');
      fetchCategories();
    },
    'accessories:product:update': () => {
      console.log('[accessories] Product updated via socket, refetching...');
      fetchProducts(activeCategory, searchQuery);
    },
    'banner:update': (data) => {
      if (data?.section === 'accessories') {
        console.log('[accessories] Banner updated via socket, refetching...');
        fetchBanners();
      }
    },
  }), [activeCategory, searchQuery]);
  usePublicSocket(socketListeners);

  const fetchCategories = async () => {
    try {
      setLoadingCats(true);
      const res = await accessoriesPublicAPI.getCategories();
      if (res.data?.success) {
        setCategories(res.data.data.categories || []);
      }
    } catch (err) {
      console.error("Failed to load accessories categories", err);
    } finally {
      setLoadingCats(false);
    }
  };

  const fetchProducts = async (catId = null, search = "") => {
    try {
      setLoadingProds(true);
      const params = {};
      if (catId) params.categoryId = catId;
      if (search) params.search = search;

      const res = await accessoriesPublicAPI.getProducts(params);
      if (res.data?.success) {
        setProducts(res.data.data.products || []);
      }
    } catch (err) {
      console.error("Failed to load accessories products", err);
    } finally {
      setLoadingProds(false);
    }
  };

  const handleCategoryClick = (catId) => {
    if (activeCategory === catId) {
      setActiveCategory(null);
      fetchProducts(null, searchQuery);
    } else {
      setActiveCategory(catId);
      fetchProducts(catId, searchQuery);
    }
  };

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    // basic debounce
    setTimeout(() => {
      fetchProducts(activeCategory, val);
    }, 500);
  };

  const handleAdd = (e, product) => {
    e.stopPropagation(); // prevent modal opening
    
    const btnRect = e.target.getBoundingClientRect();
    const sourcePosition = { x: btnRect.left, y: btnRect.top };
    
    addToCart({
      id: product._id,
      name: product.name,
      price: product.price,
      image: product.image,
      moduleType: 'accessories',
    }, sourcePosition);
    
    // Fly to cart animation
    if (cartIconRef.current && product.image) {
      const btnRect = e.target.getBoundingClientRect();
      const cartRect = cartIconRef.current.getBoundingClientRect();

      const flyingImg = document.createElement("img");
      flyingImg.src = product.image;
      flyingImg.style.position = "fixed";
      flyingImg.style.left = `${btnRect.left}px`;
      flyingImg.style.top = `${btnRect.top}px`;
      flyingImg.style.width = "40px";
      flyingImg.style.height = "40px";
      flyingImg.style.borderRadius = "50%";
      flyingImg.style.objectFit = "cover";
      flyingImg.style.zIndex = "99999";
      flyingImg.style.boxShadow = "0 10px 25px rgba(0,0,0,0.2)";
      flyingImg.style.transition = "all 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)"; // pop-out and curve effect
      
      document.body.appendChild(flyingImg);

      // Trigger animation
      setTimeout(() => {
        flyingImg.style.left = `${cartRect.left}px`;
        flyingImg.style.top = `${cartRect.top}px`;
        flyingImg.style.width = "15px";
        flyingImg.style.height = "15px";
        flyingImg.style.opacity = "0.2";
      }, 50);

      // Remove element
      setTimeout(() => {
        if (document.body.contains(flyingImg)) {
          document.body.removeChild(flyingImg);
        }
      }, 1200);
    }
  };

  const handleRemove = (e, product) => {
    e.stopPropagation();
    
    const currentQty = cart.find(i => i.id === product._id)?.quantity || 0;
    const btnRect = e.target.getBoundingClientRect();
    const sourcePosition = { x: btnRect.left, y: btnRect.top };
    
    if (currentQty <= 1) {
      removeFromCart(product._id, sourcePosition, { ...product, id: product._id });
    } else {
      updateQuantity(product._id, currentQty - 1, sourcePosition, { ...product, id: product._id });
    }
  };

  return (
    <AnimatedPage>
      <div className="min-h-screen bg-gray-50 dark:bg-[#121212] pb-24 font-outfit">
        {/* Header */}
        <div className="md:hidden sticky top-0 z-40 bg-[var(--module-theme-color,#F84E04)] shadow-md">
          <div className="flex items-center gap-3 p-4">
            <button onClick={() => navigate("/food")} className="p-2 -ml-2 rounded-full hover:bg-white/20">
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <div>
              <h1 className="text-xl font-bold font-poppins text-white">Zin Zoo X</h1>
              <p className="text-xs text-white/80 font-medium">Premium Accessories</p>
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <HeaderNotificationBell className="w-5 h-5 text-white/95" triggerClass="h-9 w-9 rounded-lg" />
              <div ref={cartIconRef} className="bg-white/10 text-white p-2 rounded-lg flex items-center gap-2 relative cursor-pointer hover:bg-white/20 transition-colors" onClick={() => navigate("/food/user/cart?module=accessories")}>
                <ShoppingCart className="w-5 h-5" />
                {cart.filter(i => i.moduleType === 'accessories').reduce((a, b) => a + (b.quantity || 1), 0) > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-white text-[var(--module-theme-color,#F84E04)] text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                     {cart.filter(i => i.moduleType === 'accessories').reduce((a, b) => a + (b.quantity || 1), 0)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
              <Input
                placeholder="Search for 'Watches', 'Bags'..."
                className="pl-10 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/70 rounded-xl font-medium focus-visible:ring-1 focus-visible:ring-white/40 focus:bg-white/20 shadow-inner"
                value={searchQuery}
                onChange={handleSearch}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1a1a1a]">
            <ModuleNavbar />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-0 md:px-6 lg:px-8 py-0 md:py-6">
          {/* Desktop Header */}
          <div className="hidden">
            <div>
              <h1 className="text-2xl font-bold font-poppins text-gray-900 dark:text-white">Zin Zoo X</h1>
              <p className="text-xs text-gray-500 font-medium">Premium Accessories</p>
            </div>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search for 'Watches', 'Bags'..."
                className="pl-9 h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl text-sm focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-[var(--module-theme-color,#F84E04)]"
                value={searchQuery}
                onChange={handleSearch}
              />
            </div>
          </div>

          {/* Promotional Banner Carousel */}
          {dynamicBanners.length > 0 && (
            <div className="px-4 md:px-0 py-4 relative">
            <div className="w-full h-32 md:h-48 rounded-2xl overflow-hidden relative shadow-[0_8px_20px_-4px_rgba(0,0,0,0.1)] bg-gray-100">
              {dynamicBanners.map((banner, index) => (
                <div 
                  key={banner._id} 
                  className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${index === currentBanner ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                >
                  <img src={banner.imageUrl} alt={banner.title || `Banner ${index + 1}`} className="w-full h-full object-cover" />
                  {(banner.title || banner.ctaText) && (
                    <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-center p-6 z-20">
                      <div className="text-white pl-2">
                        {banner.title && <h2 className="text-2xl md:text-3xl font-black font-poppins italic tracking-tight drop-shadow-md">{banner.title}</h2>}
                        {banner.ctaText && (
                          <Button className="mt-3 bg-white text-black hover:bg-gray-100 rounded-full h-8 text-xs px-5 font-bold transition-transform hover:scale-105 shadow-md">
                            {banner.ctaText}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Carousel Indicators */}
              {dynamicBanners.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
                  {dynamicBanners.map((_, index) => (
                    <div 
                      key={index} 
                      className={`h-1.5 rounded-full transition-all duration-300 ${index === currentBanner ? 'bg-white w-4' : 'bg-white/50 w-1.5'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Categories Section */}
        <div className="px-4 md:px-0 mb-6">
          <div className="flex items-center gap-2 min-w-0 mb-3">
            <h3 className="text-lg font-bold font-poppins">Shop by Category</h3>
            <div className="h-[1px] bg-gray-100 dark:bg-gray-800 flex-1"></div>
            <Link to="/food/user/accessories/categories" className="text-sm font-bold text-gray-400 dark:text-gray-500 flex items-center gap-0.5 whitespace-nowrap shrink-0">
              View All <ChevronLeft className="h-3 w-3 rotate-180" />
            </Link>
          </div>
          <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide">
            {loadingCats ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 min-w-[72px]">
                  <Skeleton className="w-16 h-16 rounded-full" />
                  <Skeleton className="w-12 h-3" />
                </div>
              ))
            ) : categories.length > 0 ? (
              categories.map(cat => (
                <div 
                  key={cat._id} 
                  className="flex flex-col items-center gap-2 min-w-[72px] cursor-pointer"
                  onClick={() => handleCategoryClick(cat._id)}
                >
                  <div className={`w-16 h-16 rounded-full overflow-hidden flex items-center justify-center p-1 transition-all ${activeCategory === cat._id ? 'ring-2 ring-[var(--module-theme-color)] ring-offset-2' : 'bg-white dark:bg-gray-800 shadow-sm border dark:border-gray-700'}`}>
                    {cat.image ? (
                      <img src={cat.image} alt={cat.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <div className="w-full h-full bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-bold text-center leading-tight">
                        {cat.name.substring(0,2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className={`text-[11px] font-semibold text-center leading-tight ${activeCategory === cat._id ? 'text-[var(--module-theme-color)]' : 'text-gray-700 dark:text-gray-300'}`}>
                    {cat.name}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No categories found.</p>
            )}
          </div>
        </div>

        {/* Products Grid */}
        <div className="px-4 md:px-0 mb-8">
          <h3 className="text-lg font-bold font-poppins mb-4">
            {activeCategory ? "Category Products" : "Trending Daily Needs"}
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {loadingProds ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="rounded-xl overflow-hidden shadow-sm border-0 border-gray-100">
                  <Skeleton className="h-32 w-full" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-8 w-full mt-2" />
                  </div>
                </Card>
              ))
            ) : products.length > 0 ? (
              products.map(product => {
                const qty = cart.find(i => i.id === product._id)?.quantity || 0;
                return (
                  <Card 
                    key={product._id} 
                    onClick={() => setSelectedProduct(product)}
                    className="rounded-xl overflow-hidden bg-white dark:bg-[#1a1a1a] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.1)] dark:shadow-none dark:border dark:border-gray-800 flex flex-col relative group cursor-pointer hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] transition-all"
                  >
                    {/* Discount badge - fake for ui */}
                    {product.isRecommended && (
                       <div className="absolute top-0 left-0 bg-[var(--module-theme-color)] text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg z-10">
                         BEST SELLER
                       </div>
                    )}
                    
                    <div className="relative pt-[100%] bg-gray-50 dark:bg-gray-800/50 p-2">
                      <div className="absolute inset-2 flex items-center justify-center">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="max-w-full max-h-full object-contain mix-blend-multiply dark:mix-blend-normal group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                            <ShoppingCart className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      {/* Wishlist Heart Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const pId = product.id || product._id;
                          const isFav = isDishFavorite(pId, null, "accessories");
                          if (isFav) {
                            removeDishFavorite(pId, null, "accessories");
                            toast.success("Removed from wishlist");
                          } else {
                            addDishFavorite({ ...product, type: "accessories" });
                            toast.success("Added to wishlist");
                          }
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-md transition-all hover:scale-110 z-20"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            isDishFavorite(product.id || product._id, null, "accessories")
                              ? "fill-red-500 text-red-500"
                              : "text-gray-600 dark:text-gray-300"
                          }`}
                        />
                      </button>
                    </div>
                    
                    <div className="p-3 flex flex-col flex-grow">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="bg-gray-100 dark:bg-gray-800 text-[10px] px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 font-medium">
                          {product.unit || '1 pc'}
                        </span>
                      </div>
                      
                      <h4 className="font-semibold text-sm leading-tight line-clamp-2 text-gray-900 dark:text-gray-100 mb-1 flex-grow">
                        {product.name}
                      </h4>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-base font-poppins">&#8377;{product.price}</span>
                          {/* Fake original price for UI */}
                          <span className="text-[10px] text-gray-400 line-through">&#8377;{Math.round(product.price * 1.2)}</span>
                        </div>
                        
                        {product.quantity === 0 ? (
                          <span className="text-[10px] text-red-500 font-extrabold uppercase bg-red-50 dark:bg-red-950/20 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900/30 cursor-not-allowed">
                            Out of stock
                          </span>
                        ) : qty === 0 ? (
                          <button 
                            onClick={(e) => handleAdd(e, product)}
                            className="bg-[#F84E04] hover:bg-[#D94203] text-white transition-colors h-8 px-4 rounded-lg font-extrabold text-[10px] uppercase tracking-wider shadow-sm hover:shadow-md flex items-center justify-center"
                          >
                            ADD
                          </button>
                        ) : (
                          <div className="flex items-center bg-[var(--module-theme-color)] text-white h-8 rounded-lg overflow-hidden shadow-sm" onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => handleRemove(e, product)} className="w-7 h-full flex items-center justify-center hover:bg-black/10 transition-colors">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold">{qty}</span>
                            <button onClick={(e) => handleAdd(e, product)} className="w-7 h-full flex items-center justify-center hover:bg-black/10 transition-colors">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                <p className="font-medium">No products found in this category</p>
              </div>
            )}
          </div>
        </div>
        </div> {/* closes max-w-7xl wrapper */}
      </div>

      {/* Product Details Bottom Sheet */}
      <Sheet open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <SheetContent side="bottom" className="h-[80vh] md:h-[90vh] md:w-[500px] md:mx-auto md:mb-4 rounded-t-3xl md:rounded-3xl p-0 flex flex-col overflow-hidden bg-white dark:bg-[#121212] font-outfit border-0 shadow-2xl z-[99999]">
          {selectedProduct && (
            <>
              {/* Image Section */}
              <div className="relative w-full h-[40%] bg-gray-50 dark:bg-gray-800/40 p-8 flex items-center justify-center border-b dark:border-gray-800">
                 <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 bg-white/50 backdrop-blur-md dark:bg-gray-900/50 p-2 rounded-full z-10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                   <X className="w-5 h-5" />
                 </button>
                 {selectedProduct.image ? (
                   <img src={selectedProduct.image} alt={selectedProduct.name} className="max-w-full max-h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                 ) : (
                   <ShoppingCart className="w-20 h-20 text-gray-300" />
                 )}
              </div>
              
              {/* Details Section */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">
                    {selectedProduct.category?.name || "accessories"}
                  </span>
                  <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs px-2.5 py-1 rounded-md font-bold">
                    {selectedProduct.unit || '1 pc'}
                  </span>
                </div>
                
                <div>
                  <SheetTitle className="text-2xl font-black text-gray-900 dark:text-white leading-tight font-poppins mb-1.5">
                    {selectedProduct.name}
                  </SheetTitle>
                  <div className="flex items-end gap-2 mt-1">
                    <span className="font-black text-3xl text-gray-900 dark:text-white font-poppins leading-none">&#8377;{selectedProduct.price}</span>
                    <span className="text-sm text-gray-400 line-through font-semibold mb-0.5">&#8377;{Math.round(selectedProduct.price * 1.2)}</span>
                    <span className="text-[10px] font-black text-white bg-green-500 px-2 py-0.5 rounded-sm ml-1 mb-1">20% OFF</span>
                  </div>
                </div>
                               <div className="mt-1">
                  <h5 className="font-bold text-sm mb-1.5 text-gray-900 dark:text-white">Product Description</h5>
                  <SheetDescription className="text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed">
                    {selectedProduct.description || "Farm fresh and carefully selected daily essentials. Delivered safely and securely to your doorstep in 10-15 minutes. Perfect for your everyday needs!"}
                  </SheetDescription>
                </div>

                <div className="mt-2 flex items-center gap-2 text-xs font-bold">
                  {selectedProduct.quantity > 0 ? (
                    <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-2.5 py-1 rounded">
                      In Stock ({selectedProduct.quantity} items left)
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2.5 py-1 rounded">
                      Out of Stock
                    </span>
                  )}
                </div>
                
                {/* Info Cards */}
                <div className="mt-2 flex gap-3">
                   <div className="flex flex-col items-center justify-center p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex-1">
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-0.5">Delivery</span>
                      <span className="text-sm font-black text-blue-700 dark:text-blue-300">10 mins</span>
                   </div>
                   <div className="flex flex-col items-center justify-center p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-900/30 flex-1">
                      <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-0.5">Quality</span>
                      <span className="text-sm font-black text-purple-700 dark:text-purple-300">Guaranteed</span>
                   </div>
                </div>
              </div>

              {/* Bottom Sticky Add to Cart Section */}
              <div className="p-4 border-t dark:border-gray-800 bg-white dark:bg-[#1a1a1a] pb-6 md:pb-4 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
                {(() => {
                  const qty = cart.find(i => i.id === selectedProduct._id)?.quantity || 0;
                  if (selectedProduct.quantity === 0) {
                    return (
                      <Button 
                        disabled
                        className="w-full h-14 bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 font-bold text-lg rounded-xl cursor-not-allowed border border-gray-300/40 dark:border-gray-700/40"
                      >
                        Out of Stock
                      </Button>
                    )
                  } else if (qty === 0) {
                    return (
                      <Button 
                        className="w-full h-14 bg-[var(--module-theme-color)] hover:bg-[var(--module-theme-color)]/90 text-white font-bold text-lg rounded-xl shadow-lg shadow-[var(--module-theme-color)]/30 transition-all hover:scale-[1.02] hover:shadow-[var(--module-theme-color)]/40 active:scale-95"
                        onClick={(e) => handleAdd(e, selectedProduct)}
                      >
                        Add to Cart - &#8377;{selectedProduct.price}
                      </Button>
                    )
                  } else {
                    return (
                      <div className="flex items-center justify-between w-full h-14 bg-white dark:bg-gray-900 border-[2.5px] border-[var(--module-theme-color)] rounded-xl px-2 shadow-sm">
                         <button onClick={(e) => handleRemove(e, selectedProduct)} className="w-14 h-full flex items-center justify-center text-[var(--module-theme-color)] hover:bg-[var(--module-theme-color)]/10 rounded-lg transition-colors active:scale-90">
                           <Minus className="w-6 h-6" strokeWidth={2.5} />
                         </button>
                         <div className="flex flex-col items-center">
                           <span className="font-black text-lg text-[var(--module-theme-color)] leading-none">{qty}</span>
                           <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">in cart</span>
                         </div>
                         <button onClick={(e) => handleAdd(e, selectedProduct)} className="w-14 h-full flex items-center justify-center text-[var(--module-theme-color)] hover:bg-[var(--module-theme-color)]/10 rounded-lg transition-colors active:scale-90">
                           <Plus className="w-6 h-6" strokeWidth={2.5} />
                         </button>
                      </div>
                    )
                  }
                })()}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <StickyCartCard />
    </AnimatedPage>
  );
}
