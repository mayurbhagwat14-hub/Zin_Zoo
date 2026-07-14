import { Link } from "react-router-dom"
import { X, ChevronRight } from "lucide-react"
import { useCart } from "@food/context/CartContext"
import { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useActiveModule } from "@food/hooks/useActiveModule"
import { gsap } from "gsap"

export default function StickyCartCard() {
  const { cart, getCartCount, lastAddEvent } = useCart()
  const [isVisible, setIsVisible] = useState(true)
  const [bottomPosition, setBottomPosition] = useState("bottom-[70px]") // Fixed above bottom navigation
  const cartCount = getCartCount()
  const activeModule = useActiveModule()

  const [flyingProduct, setFlyingProduct] = useState(null)
  const flyingThumbnailRef = useRef(null)
  const linkRef = useRef(null) // Target button link

  // Handle fly-to-cart animation when product is added
  useEffect(() => {
    // Disable card animation for Grocery and Accessories since they have pre-existing page animations
    if (activeModule === 'grocery' || activeModule === 'accessories') return

    if (lastAddEvent && lastAddEvent.sourcePosition && linkRef.current) {
      const { product, sourcePosition } = lastAddEvent
      if ((product?.moduleType || 'food') !== activeModule) return

      const savedSourcePosition = { ...sourcePosition }
      const savedProduct = { ...product }

      setFlyingProduct({ product: savedProduct, startPos: savedSourcePosition })

      setTimeout(() => {
        if (flyingThumbnailRef.current && linkRef.current) {
          const thumbnail = flyingThumbnailRef.current
          const targetRect = linkRef.current.getBoundingClientRect()
          const endX = targetRect.left + targetRect.width / 2
          const endY = targetRect.top + targetRect.height / 2

          const getScrollX = () => window.scrollX || window.pageXOffset || document.documentElement?.scrollLeft || document.body?.scrollLeft || 0
          const getScrollY = () => window.scrollY || window.pageYOffset || document.documentElement?.scrollTop || document.body?.scrollTop || 0

          const currentScrollX = getScrollX()
          const currentScrollY = getScrollY()

          let sourceX, sourceY
          if (savedSourcePosition.viewportX !== undefined && savedSourcePosition.viewportY !== undefined) {
            const scrollDeltaX = currentScrollX - (savedSourcePosition.scrollX || 0)
            const scrollDeltaY = currentScrollY - (savedSourcePosition.scrollY || 0)
            sourceX = savedSourcePosition.viewportX - scrollDeltaX
            sourceY = savedSourcePosition.viewportY - scrollDeltaY
          } else {
            sourceX = savedSourcePosition.x - currentScrollX
            sourceY = savedSourcePosition.y - currentScrollY
          }

          const thumbnailCenterOffset = 16

          gsap.set(thumbnail, {
            position: 'fixed',
            left: sourceX - thumbnailCenterOffset,
            top: sourceY - thumbnailCenterOffset,
            zIndex: 10000,
            scale: 1,
            rotation: 0,
            opacity: 1,
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            x: 0,
            y: 0,
          })

          const deltaX = endX - sourceX
          const deltaY = endY - sourceY

          const tl = gsap.timeline({
            onComplete: () => {
              setFlyingProduct(null)
            },
          })

          tl.to(thumbnail, {
            scale: 1.4,
            duration: 0.25,
            ease: 'power2.out',
          })
          .to(thumbnail, {
            x: deltaX,
            y: deltaY,
            rotation: 720,
            scale: 0.5,
            duration: 0.8,
            ease: 'power2.out',
          })
          .to(thumbnail, {
            scale: 0.2,
            opacity: 0,
            duration: 0.2,
            ease: 'power2.in',
          })
        }
      }, 100)
    }
  }, [lastAddEvent, activeModule])

  // Set fixed position above bottom navigation (no scroll-based movement)
  useEffect(() => {
    // Set initial position based on screen size
    const setInitialPosition = () => {
      if (window.innerWidth >= 768) {
        setBottomPosition("bottom-6") // Desktop: fixed position
      } else {
        setBottomPosition("bottom-[70px]") // Mobile: above bottom nav (fixed, doesn't move with scroll)
      }
    }

    setInitialPosition()

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setBottomPosition("bottom-6") // Desktop: always fixed
      } else {
        setBottomPosition("bottom-[70px]") // Mobile: above bottom nav (fixed)
      }
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  // Get item module type
  const cartModuleType = cart[0]?.moduleType || "food"
  const isFood = cartModuleType === "food"

  // Get info based on module type
  const displayName = isFood 
    ? (cart[0]?.restaurant || "Restaurant") 
    : (cart[0]?.storeName || cart[0]?.name || "Store")
    
  const displayImage = cart[0]?.image || "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200&h=200&fit=crop"

  // Create slug from name
  const displaySlug = displayName.toLowerCase().replace(/\s+/g, "-")

  const cartLink = `/food/user/cart?module=${cartModuleType}`

  // Calculate total price
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity * 83), 0)

  // Animation variants for the popout effect
  const cardVariants = {
    initial: {
      opacity: 1,
      scale: 1,
      y: 0,
      rotate: 0,
    },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      rotate: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 25,
        mass: 0.8,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      y: 100,
      rotate: -5,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  }

  // Don't render if cart is empty
  if (cartCount === 0) return null

  return (
    <>
      {/* Flying product thumbnail */}
      {flyingProduct && (
        <div
          ref={flyingThumbnailRef}
          className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-white flex-shrink-0 shadow-lg"
          style={{
            borderRadius: '50%',
            objectFit: 'cover',
            pointerEvents: 'none',
            zIndex: 10000,
          }}
        >
          {flyingProduct.product?.imageUrl || flyingProduct.product?.image ? (
            <img
              src={flyingProduct.product.imageUrl || flyingProduct.product.image}
              alt={flyingProduct.product.name}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-200 text-neutral-400 text-xs font-semibold rounded-full">
              {flyingProduct.product?.name?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={`fixed ${bottomPosition} md:bottom-6 left-0 right-0 md:left-auto md:right-6 z-50 px-4 md:px-0 pb-4 md:pb-0 pointer-events-none`}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={cardVariants}
          >
            <div className="max-w-7xl md:max-w-none mx-auto md:mx-0 pointer-events-auto">
              <div className="bg-white dark:bg-[#0a0a0a] dark:text-white rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden md:max-w-md md:w-[400px]">
                <div className="flex items-center gap-3 p-3 md:p-4">
                  {/* Restaurant Image */}
                  <div className="flex-shrink-0">
                    <img
                      src={displayImage}
                      alt={displayName}
                      className="w-14 h-14 md:w-16 md:h-16 rounded-lg object-cover"
                    />
                  </div>

                  {/* Info */}
                  <Link to={cartLink} className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-gray-200 text-base md:text-lg mb-0.5 line-clamp-1">
                      {displayName}
                    </h3>
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 text-sm md:text-base">
                      <span>View Cart</span>
                      <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
                    </div>
                  </Link>

                  {/* View Cart Button */}
                  <Link
                    ref={linkRef}
                    to={cartLink}
                    className="flex-shrink-0 text-white px-4 py-2.5 md:px-5 md:py-3 rounded-lg font-semibold transition-colors"
                    style={{
                      background: "linear-gradient(135deg, rgba(var(--module-theme-rgb,248,78,4),0.92), var(--module-theme-color,#F84E04))",
                      boxShadow: "0 8px 18px rgba(var(--module-theme-rgb,248,78,4),0.28)",
                    }}
                  >
                    <div className="text-center">
                      <div className="text-xs md:text-sm opacity-90">View Cart</div>
                      <div className="text-xs md:text-sm font-bold">{cartCount} {cartCount === 1 ? 'item' : 'items'}</div>
                    </div>
                  </Link>

                {/* Close Button */}
                <motion.button
                  onClick={() => setIsVisible(false)}
                  className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <X className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400" />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  )
}
