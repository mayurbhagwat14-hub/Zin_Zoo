import { Link } from "react-router-dom"
import { useState, useMemo } from "react"

import { Heart, ArrowRight, ArrowLeft, Bookmark, X, ShoppingCart } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import ScrollReveal from "@food/components/user/ScrollReveal"
import { Card, CardContent, CardTitle } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { useProfile } from "@food/context/ProfileContext"
import { useCart } from "@food/context/CartContext"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@food/components/ui/sheet"
import { toast } from "sonner"

export default function Favorites() {
  const { getDishFavorites, removeDishFavorite } = useProfile()
  const { addToCart } = useCart()
  const dishFavorites = getDishFavorites()
  const [activeTab, setActiveTab] = useState("all") // "all", "food", "grocery", "accessories"
  const [selectedProduct, setSelectedProduct] = useState(null)

  const handleRemoveDishFavorite = (e, dishId, restaurantId, type = "food") => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm("Remove this item from collections?")) {
      removeDishFavorite(dishId, restaurantId, type)
      toast.success("Item removed from collections")
    }
  }

  const totalFavorites = dishFavorites.length

  const filteredDishes = useMemo(() => {
    if (activeTab === "all") return dishFavorites
    if (activeTab === "food") return dishFavorites.filter((d) => (d.type || "food") === "food")
    if (activeTab === "grocery") return dishFavorites.filter((d) => d.type === "grocery")
    if (activeTab === "accessories") return dishFavorites.filter((d) => d.type === "accessories")
    return []
  }, [dishFavorites, activeTab])

  if (totalFavorites === 0) {
    return (
      <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-orange-50/20 dark:from-[#0a0a0a] dark:via-[#0a0a0a] dark:to-[#0a0a0a] p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <ScrollReveal>
            <div className="flex items-center gap-3 sm:gap-4">
              <Link to="/user/profile">
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-10 sm:w-10">
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold">My Collections</h1>
            </div>
          </ScrollReveal>
          <Card>
            <CardContent className="py-12 text-center">
              <Heart
                className="h-16 w-16 mx-auto mb-4"
                style={{ color: "var(--module-theme-color, #F84E04)" }}
              />
              <p className="text-muted-foreground text-lg mb-4">You haven't added any items to your collections yet</p>
              <Link to="/user">
                <Button
                  className="text-white border-0"
                  style={{
                    background: "linear-gradient(135deg, rgba(var(--module-theme-rgb,248,78,4),0.92), var(--module-theme-color,#F84E04))",
                    boxShadow: "0 8px 18px rgba(var(--module-theme-rgb,248,78,4),0.25)",
                  }}
                >
                  Explore Items
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-orange-50/20 dark:from-[#0a0a0a] dark:via-[#0a0a0a] dark:to-[#0a0a0a] p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <ScrollReveal>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link to="/user/profile">
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-10 sm:w-10">
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold">My Collections</h1>
                <p className="text-gray-700 dark:text-gray-300 mt-1 text-sm font-semibold">
                  {dishFavorites.length || 0} {dishFavorites.length === 1 ? "item" : "items"}
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Unified Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto scrollbar-hide">
          {[
            { id: "all", label: `All (${dishFavorites.length})` },
            { id: "food", label: `Food (${dishFavorites.filter(d => (d.type || 'food') === 'food').length})` },
            { id: "grocery", label: `Grocery (${dishFavorites.filter(d => d.type === 'grocery').length})` },
            { id: "accessories", label: `Accessories (${dishFavorites.filter(d => d.type === 'accessories').length})` },
          ].map((tab) => {
            const isSelected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 font-semibold text-xs whitespace-nowrap transition-colors rounded-lg ${
                  isSelected
                    ? "bg-[#F84E04] text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-855"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Wishlist Items List */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredDishes.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Bookmark className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg mb-4">No items saved under this category yet</p>
              <Link to="/user">
                <Button
                  className="text-white border-0"
                  style={{
                    background: "linear-gradient(135deg, rgba(var(--module-theme-rgb,248,78,4),0.92), var(--module-theme-color,#F84E04))",
                    boxShadow: "0 8px 18px rgba(var(--module-theme-rgb,248,78,4),0.25)",
                  }}
                >
                  Explore Items
                </Button>
              </Link>
            </div>
          ) : (
            filteredDishes.map((dish, index) => {
              const type = dish.type || "food"
              let categoryName = "Item"
              let badgeText = "Food"

              if (type === "food") {
                categoryName = dish.restaurantName || "Restaurant"
                badgeText = "Food"
              } else if (type === "grocery") {
                categoryName = dish.category?.name || "Grocery Item"
                badgeText = "Grocery"
              } else if (type === "accessories") {
                categoryName = dish.category?.name || "Accessory"
                badgeText = "Accessories"
              }

              return (
                <ScrollReveal key={`${dish.id}-${type}`} delay={index * 0.1}>
                  <div onClick={() => setSelectedProduct(dish)}>
                    <Card className="overflow-hidden h-full cursor-pointer hover:shadow-lg transition-shadow relative">
                      {/* Type Badge */}
                      <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-wider">
                        {badgeText}
                      </div>

                      <div className="h-32 w-full relative overflow-hidden bg-gray-50 dark:bg-gray-900">
                        <img
                          src={dish.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&q=80"}
                          alt={dish.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&q=80"
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute top-2 right-2 z-20">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white text-red-500"
                            onClick={(e) => handleRemoveDishFavorite(e, dish.id, dish.restaurantId || null, type)}
                          >
                            <Bookmark className="h-4 w-4 fill-red-500" />
                          </Button>
                        </div>
                      </div>
                      <CardContent className="p-3 space-y-2">
                        <div>
                          <CardTitle className="text-sm font-bold mb-0.5 line-clamp-1">
                            {dish.name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {categoryName}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t">
                          <div className="flex items-center gap-1">
                            {type === "food" && (
                              <>
                                {dish.foodType === "Veg" ? (
                                  <div className="w-3 h-3 border-2 border-green-600 flex items-center justify-center rounded-sm">
                                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                  </div>
                                ) : (
                                  <div className="w-3 h-3 border-2 border-orange-600 flex items-center justify-center rounded-sm">
                                    <div className="w-1.5 h-1.5 bg-orange-600 rounded-full"></div>
                                  </div>
                                )}
                                <span className="text-muted-foreground font-medium text-xs">{dish.foodType || "N/A"}</span>
                              </>
                            )}
                            {type !== "food" && (
                              <span className="text-muted-foreground font-medium text-xs">{dish.unit || "1 unit"}</span>
                            )}
                          </div>
                          <div className="text-sm font-bold text-primary-orange">
                            {"\u20B9"}{Math.round(dish.price || 0)}
                          </div>
                        </div>
                        <Button className="w-full bg-gradient-to-r bg-primary-orange hover:opacity-90 text-white text-xs py-1.5 h-8">
                          View Item
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollReveal>
              )
            })
          )}
        </div>
      </div>

      {/* Product Details Bottom Sheet */}
      <Sheet open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <SheetContent side="bottom" className="h-[80vh] md:h-[90vh] md:w-[500px] md:mx-auto md:mb-4 rounded-t-3xl md:rounded-3xl p-0 flex flex-col overflow-hidden bg-white dark:bg-[#121212] font-outfit border-0 shadow-2xl z-[99999]">
          {selectedProduct && (() => {
            const type = selectedProduct.type || "food"
            let badgeText = "Food"
            let categoryName = selectedProduct.restaurantName || "Restaurant"
            if (type === "grocery") {
              badgeText = "Grocery"
              categoryName = selectedProduct.category?.name || "Grocery Item"
            } else if (type === "accessories") {
              badgeText = "Accessories"
              categoryName = selectedProduct.category?.name || "Accessory"
            }

            return (
              <>
                <SheetHeader className="sr-only">
                  <SheetTitle>{selectedProduct.name}</SheetTitle>
                  <SheetDescription>Product details for {selectedProduct.name}</SheetDescription>
                </SheetHeader>

                {/* Image Section */}
                <div className="relative w-full h-[40%] bg-gray-50 dark:bg-gray-800/40 p-8 flex items-center justify-center border-b dark:border-gray-800">
                  <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 bg-white/50 backdrop-blur-md dark:bg-gray-900/50 p-2 rounded-full z-10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                  {selectedProduct.image ? (
                    <img src={selectedProduct.image} alt={selectedProduct.name} className="max-w-full max-h-full object-cover rounded-xl" />
                  ) : (
                    <ShoppingCart className="w-20 h-20 text-gray-300" />
                  )}
                </div>

                {/* Details Section */}
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">
                      {badgeText}
                    </span>
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs px-2.5 py-1 rounded-md font-bold">
                      {categoryName}
                    </span>
                  </div>

                  <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                    {selectedProduct.name}
                  </h3>

                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-gray-950 dark:text-white">&#8377;{selectedProduct.price}</span>
                    <span className="text-sm text-gray-400 line-through">&#8377;{Math.round(selectedProduct.price * 1.2)}</span>
                    <span className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/20 dark:text-orange-400 px-2 py-0.5 rounded font-bold">20% OFF</span>
                  </div>

                  <div className="border-t border-b dark:border-gray-800 py-4 my-2">
                    <h4 className="font-extrabold text-sm text-gray-900 dark:text-white mb-2 uppercase tracking-wider">Product Description</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                      {selectedProduct.description || "No description available for this product."}
                    </p>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="p-4 border-t dark:border-gray-800 bg-white dark:bg-[#121212] flex items-center justify-between gap-4">
                  <Button
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                      toast.success(`${selectedProduct.name} added to cart`);
                    }}
                    className="flex-1 h-12 text-white font-extrabold text-sm uppercase tracking-wider rounded-xl bg-[#F84E04] hover:bg-[#D94203]"
                  >
                    Add to Cart - &#8377;{selectedProduct.price}
                  </Button>
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </AnimatedPage>
  )
}
