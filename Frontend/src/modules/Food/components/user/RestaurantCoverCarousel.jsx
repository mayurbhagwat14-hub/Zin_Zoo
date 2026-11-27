import { useEffect, useRef, useState, useCallback } from "react"

const toUrl = (img) => {
  if (!img) return ""
  if (typeof img === "string") return img.trim()
  return String(img.url || img.secure_url || img.imageUrl || "").trim()
}

/** Build the unique, non-empty list of images to show for a restaurant. */
export function getRestaurantCoverImages(restaurant) {
  if (!restaurant) return []
  const list = [
    ...(Array.isArray(restaurant.coverImages) ? restaurant.coverImages : []),
    restaurant.profileImage,
    restaurant.image,
  ]
    .map(toUrl)
    .filter(Boolean)
  return [...new Set(list)]
}

/**
 * Swipeable cover-photo carousel: centre slide with neighbours peeking,
 * dots, and auto-advance (pauses while the user is touching it).
 */
export default function RestaurantCoverCarousel({ images = [], alt = "Restaurant", autoPlayMs = 3500 }) {
  const trackRef = useRef(null)
  const [active, setActive] = useState(0)
  const interactingRef = useRef(false)
  const single = images.length <= 1

  const scrollToIndex = useCallback((index) => {
    const track = trackRef.current
    const slide = track?.children?.[index]
    if (!track || !slide) return
    const left = slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2
    track.scrollTo({ left, behavior: "smooth" })
  }, [])

  // Track which slide is centred.
  const handleScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const center = track.scrollLeft + track.clientWidth / 2
    let best = 0
    let bestDist = Infinity
    Array.from(track.children).forEach((child, i) => {
      const dist = Math.abs(child.offsetLeft + child.clientWidth / 2 - center)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    setActive(best)
  }, [])

  useEffect(() => {
    if (single || !autoPlayMs) return undefined
    const id = setInterval(() => {
      if (interactingRef.current || document.visibilityState === "hidden") return
      setActive((prev) => {
        const next = (prev + 1) % images.length
        scrollToIndex(next)
        return next
      })
    }, autoPlayMs)
    return () => clearInterval(id)
  }, [single, autoPlayMs, images.length, scrollToIndex])

  if (!images.length) return null

  return (
    <div className="relative w-full bg-gray-100 dark:bg-[#111]">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onTouchStart={() => { interactingRef.current = true }}
        onTouchEnd={() => { interactingRef.current = false }}
        onMouseEnter={() => { interactingRef.current = true }}
        onMouseLeave={() => { interactingRef.current = false }}
        className={`flex overflow-x-auto snap-x snap-mandatory scrollbar-hide ${single ? "" : "gap-1.5"}`}
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {images.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className={`snap-center shrink-0 h-64 sm:h-72 md:h-96 lg:h-[28rem] overflow-hidden ${
              single ? "w-full" : "w-[78%] sm:w-[70%] md:w-[60%] lg:w-[50%] first:ml-[11%] last:mr-[11%] sm:first:ml-[15%] sm:last:mr-[15%] md:first:ml-[20%] md:last:mr-[20%] lg:first:ml-[25%] lg:last:mr-[25%]"
            }`}
          >
            <img
              src={src}
              alt={`${alt} ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              className="h-full w-full object-cover select-none"
              onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
            />
          </div>
        ))}
      </div>

      {!single && (
        <div className="absolute bottom-9 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur-sm">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show photo ${i + 1}`}
              onClick={() => scrollToIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === active ? "w-2 bg-[#F84E04]" : "w-2 bg-white/90"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
