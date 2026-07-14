import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Star, Clock, Copy, Ticket, Calendar } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Card, CardContent } from "@food/components/ui/card"
import { restaurantAPI } from "@food/api"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import { toast } from "sonner"
import { RestaurantGridSkeleton } from "@food/components/ui/loading-skeletons"
import { useDelayedLoading } from "@food/hooks/useDelayedLoading"

// Import banner image
import offerBanner from "@food/assets/offerpagebanner.png"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function Offers() {
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const [offers, setOffers] = useState([])
  const [groupedOffers, setGroupedOffers] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const showOffersSkeleton = useDelayedLoading(loading)

  const handleCopy = (code) => {
    if (!code) return
    navigator.clipboard.writeText(code)
    toast.success(`Coupon code "${code}" copied to clipboard!`)
  }

  // Fetch offers from API
  useEffect(() => {
    const fetchOffers = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await restaurantAPI.getPublicOffers()
        const data = response?.data?.data
        
        if (data) {
          setOffers(data.allOffers || [])
          setGroupedOffers(data.groupedByOffer || {})
        }
      } catch (err) {
        debugError('Error fetching offers:', err)
        debugError('Error details:', err?.response?.data || err?.message)
        const errorMessage = err?.response?.data?.message || err?.message || 'Failed to load offers'
        setError(errorMessage)
        toast.error(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchOffers()
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      {/* Banner Section */}
      <div className="relative w-full overflow-hidden min-h-[25vh] md:min-h-[30vh]">
        {/* Back Button */}
        <button 
          onClick={goBack}
          className="absolute top-4 left-4 md:top-6 md:left-6 z-20 w-10 h-10 md:w-12 md:h-12 bg-gray-800/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-gray-800/80 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 md:h-6 md:w-6 text-white" />
        </button>
        
        {/* Banner Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src={offerBanner} 
            alt="Great Offers" 
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 md:px-8 lg:px-10 py-6 md:py-8 lg:py-10 space-y-6 md:space-y-8">
        <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        {/* Loading State */}
        {showOffersSkeleton && <RestaurantGridSkeleton count={4} compact />}

        {/* Error State */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-red-500 dark:text-red-400 text-center">{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">Retry</Button>
          </div>
        )}

        {/* Offers Sections */}
        {!showOffersSkeleton && !error && (
          <>
            {/* Grouped Offers Sections */}
            {Object.keys(groupedOffers).length > 0 && Object.entries(groupedOffers).map(([offerText, dishes]) => (
              <section key={offerText}>
                <h2 className="text-2xl sm:text-3xl font-black text-red-500 dark:text-red-400 text-center mb-4 tracking-wide">
                  {offerText}
                </h2>
                
                {/* Restaurant Cards - Grid Layout */}
                <div 
                  className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6"
                >
                  {dishes.slice(0, 8).map((dish) => (
                    <Link 
                      key={dish.id} 
                      to={`/user/restaurants/${dish.restaurantSlug}`}
                      className="w-full"
                    >
                      <div className="group">
                        {/* Image Container */}
                        <div className="relative h-32 sm:h-36 rounded-xl overflow-hidden mb-2">
                          <img 
                            src={dish.dishImage || dish.restaurantImage || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"} 
                            alt={dish.dishName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {/* Offer Badge */}
                          <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] sm:text-xs font-semibold px-2 py-1 rounded">
                            {dish.offer}
                          </div>
                        </div>
                        
                        {/* Rating Badge */}
                        <div className="flex items-center gap-1 mb-1">
                          <div className="bg-green-600 text-white text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            {dish.restaurantRating?.toFixed(1) || '0.0'}
                            <Star className="h-2.5 w-2.5 fill-white" />
                          </div>
                        </div>
                        
                        {/* Restaurant Info */}
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-1">
                          {dish.restaurantName}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mb-1">
                          {dish.dishName} - ₹{dish.discountedPrice}
                        </p>
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs">
                          <Clock className="h-3 w-3" />
                          <span>{dish.deliveryTime}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}

            {/* Coupon-style offers (admin created) */}
            {Object.keys(groupedOffers).length === 0 && offers.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="bg-red-500/10 dark:bg-red-500/20 p-2 rounded-xl">
                    <Ticket className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100">
                      Available Coupons
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      Claim these discounts to save big on your next orders!
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {offers.map((o) => (
                    <div 
                      key={o.id || o.offerId} 
                      className="relative overflow-hidden bg-white dark:bg-[#121212] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-300 flex items-stretch gap-4"
                    >
                      {/* Ticket Cutout Left */}
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 z-10" />
                      
                      {/* Ticket Cutout Right */}
                      <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 z-10" />

                      {/* Left Coupon Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                              Coupon Code
                            </span>
                          </div>
                          
                          {/* Code Display */}
                          <div 
                            onClick={() => handleCopy(o.couponCode)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700/60 cursor-pointer border border-slate-200/60 dark:border-slate-700/60 transition-colors group/code"
                          >
                            <span className="font-mono text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 tracking-wider">
                              {o.couponCode || "-"}
                            </span>
                            <Copy className="h-3.5 w-3.5 text-slate-400 group-hover/code:text-slate-600 dark:group-hover/code:text-slate-300 transition-colors" />
                          </div>
                        </div>

                        {/* Scope & Validation */}
                        <div className="mt-4 space-y-1.5">
                          <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                            <span className="font-semibold text-slate-400 dark:text-slate-500 mr-1 uppercase text-[9px] tracking-wider">Scope:</span>
                            {o.restaurantScope === "all" || o.restaurantName === "All Restaurants" ? "Global / Platform" : o.restaurantName}
                          </p>
                          {o.endDate && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              <span>Valid till: {new Date(o.endDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Dashed Separator */}
                      <div className="border-l border-dashed border-slate-200 dark:border-slate-800/80 my-1 relative" />

                      {/* Right Coupon Discount */}
                      <div className="flex flex-col items-center justify-center pl-2 min-w-[90px] shrink-0 text-center">
                        <span className="text-sm font-black bg-red-500/10 text-red-500 dark:bg-red-500/20 px-3 py-1.5 rounded-xl border border-red-500/10">
                          {o.title || "OFF"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {offers.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No offers available at the moment</p>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  )
}

