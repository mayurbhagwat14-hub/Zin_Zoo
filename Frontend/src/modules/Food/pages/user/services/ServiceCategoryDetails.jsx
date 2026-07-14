import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ChevronLeft, Star, Clock, ShieldCheck, Wrench, IndianRupee, MapPin, Briefcase } from "lucide-react"
import { Button } from "@food/components/ui/button"
import ServiceBookingForm from "./ServiceBookingForm"
import { servicesPublicAPI } from "@food/api"
import { useSearchParams } from "react-router-dom"
import { usePublicSocket } from "@food/hooks/usePublicSocket"



export default function ServiceCategoryDetails() {
  const { serviceSlug } = useParams()
  const [searchParams] = useSearchParams()
  const categoryId = searchParams.get('categoryId')
  const navigate = useNavigate()
  
  const [data, setData] = useState({ title: '', description: '', color: 'from-blue-500 to-cyan-500', services: [] })
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState(null)
  const [isBookingOpen, setIsBookingOpen] = useState(false)

  const handleOpenBooking = (svc) => {
    setSelectedService(svc)
    setIsBookingOpen(true)
  }

  const handleCloseBooking = () => {
    setIsBookingOpen(false)
    setSelectedService(null)
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('serviceName')
    navigate({ search: newParams.toString() }, { replace: true })
  }

  useEffect(() => {
    const serviceNameToOpen = searchParams.get('serviceName')
    if (serviceNameToOpen && data.services.length > 0 && !selectedService) {
      const matched = data.services.find(
        svc => svc.name.toLowerCase().trim() === serviceNameToOpen.toLowerCase().trim()
      )
      if (matched) {
        handleOpenBooking(matched)
      }
    }
  }, [searchParams, data.services, selectedService])

  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true)
      const zoneId = localStorage.getItem("userZoneId")
      const catRes = await servicesPublicAPI.getCategories({ zoneId })
      let categoryName = serviceSlug.split('-').join(' ')
      let categoryColor = "from-blue-500 to-cyan-500"
      
      if (catRes.data?.success) {
        const categories = catRes.data.data.categories || []
        const found = categories.find(c => c._id === categoryId)
        if (found) {
          categoryName = found.name
        }
      }

      let servicesList = []
      if (categoryName) {
        const svcRes = await servicesPublicAPI.getServices({ category: categoryName, zoneId })
        if (svcRes.data?.success) {
          servicesList = svcRes.data.data.services || []
        }
      }

      setData({
        title: categoryName,
        description: "Professional home service at your doorstep.",
        color: categoryColor,
        services: servicesList
      })

    } catch (error) {
      console.error("Error fetching service details:", error)
    } finally {
      setLoading(false)
    }
  }, [serviceSlug, categoryId])

  useEffect(() => {
    fetchDetails()
  }, [fetchDetails])

  // Real-time updates from admin
  const socketListeners = useMemo(() => ({
    'services:item:update': () => {
      console.log('[ServiceDetails] Service updated via socket, refetching...');
      fetchDetails();
    },
    'services:category:update': () => {
      console.log('[ServiceDetails] Category updated via socket, refetching...');
      fetchDetails();
    },
  }), [fetchDetails]);
  usePublicSocket(socketListeners);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-[#0a0a0a] dark:text-white">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-24">
      {/* Header Banner */}
      <div className={`relative pt-16 pb-12 px-4 bg-gradient-to-br ${data.color} overflow-hidden`}>
        {/* Abstract pattern */}
        <div className="absolute inset-0 opacity-10">
           <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="2" fill="currentColor"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#pattern)"/>
           </svg>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-start">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/food/user/services")}
            className="rounded-full bg-white/50 backdrop-blur-sm border border-white/20 hover:bg-white mb-6"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-black text-white mb-3"
          >
            {data.title}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-white/80 text-sm md:text-base max-w-md"
          >
            {data.description}
          </motion.p>

          <div className="flex flex-wrap gap-3 mt-6">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-sm text-xs font-medium text-white">
              <ShieldCheck className="h-4 w-4" /> Verified Pros
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-sm text-xs font-medium text-white">
              <Star className="h-4 w-4 text-yellow-300" fill="currentColor" /> Top Rated
            </div>
          </div>
        </div>
      </div>

      {/* Services List */}
      <div className="max-w-3xl mx-auto px-4 -mt-6 relative z-20">
        <div className="bg-white dark:bg-[#1a1a1a] rounded-t-3xl p-4 md:p-6 shadow-xl border border-gray-100 dark:border-gray-800 min-h-[500px]">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Select a Service</h2>
          
          <div className="flex flex-col gap-4">
            {data.services.map((svc, idx) => (
              <motion.div 
                key={svc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-blue-100 dark:hover:border-gray-700 hover:shadow-md transition-all gap-4"
              >
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                  {svc.image && (
                    <div className="w-full sm:w-32 h-32 sm:h-auto flex-shrink-0 rounded-xl overflow-hidden shadow-sm bg-gray-100 dark:bg-gray-800">
                      <img src={svc.image} alt={svc.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 py-1">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{svc.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1 font-medium text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded-md">
                        <Star className="h-3 w-3" fill="currentColor" /> {4.8}
                      </span>
                      <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                        <Clock className="h-3 w-3" /> {svc.availableFrom} - {svc.availableTo}
                      </span>
                    </div>
                    {svc.description && (
                      <p className="mt-3 text-xs md:text-sm text-gray-500 line-clamp-2 leading-relaxed">{svc.description}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center sm:flex-col justify-between sm:justify-center gap-3">
                  <div className="text-lg font-black text-gray-900 dark:text-white flex items-center">
                    <IndianRupee className="h-4 w-4" />{svc.basePrice}
                  </div>
                  <Button 
                    className="rounded-full font-bold px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90"
                    onClick={() => handleOpenBooking(svc)}
                  >
                    Add
                  </Button>
                </div>
              </motion.div>
            ))}
            {data.services.length === 0 && (
              <p className="text-center text-gray-500 py-10">No services found for this category.</p>
            )}
          </div>
        </div>
      </div>

      <ServiceBookingForm 
        isOpen={isBookingOpen} 
        onClose={handleCloseBooking} 
        service={selectedService} 
        categoryTitle={data.title}
      />
    </div>
  )
}
