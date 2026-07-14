import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Clock, MapPin, IndianRupee, Wrench } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { servicesUserAPI, servicesPublicAPI } from "@food/api"
import { toast } from "sonner"

export default function MyServices() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("upcoming")
  const [bookings, setBookings] = useState({ upcoming: [], past: [] })
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])

  const fetchCategories = async () => {
    try {
      const res = await servicesPublicAPI.getCategories()
      if (res.data?.success) {
        setCategories(res.data.data.categories || [])
      }
    } catch (err) {
      console.error("Failed to fetch categories in MyServices:", err)
    }
  }

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const res = await servicesUserAPI.getUserBookings()
      if (res.data?.success) {
        setBookings({
          upcoming: res.data.data.upcoming || [],
          past: res.data.data.past || []
        })
      }
    } catch (error) {
      console.error(error)
      toast.error("Failed to load your bookings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBookings()
    fetchCategories()
  }, [])

  const handleBookAgain = (booking) => {
    if (!booking.category) {
      navigate('/food/user/services')
      return
    }

    const matchedCategory = categories.find(
      cat => cat.name.toLowerCase().trim() === booking.category.toLowerCase().trim()
    )

    if (matchedCategory) {
      const slug = matchedCategory.name.toLowerCase().replace(/\s+/g, '-')
      navigate(`/food/user/services/${slug}?categoryId=${matchedCategory._id}&serviceName=${encodeURIComponent(booking.serviceName)}`)
    } else {
      navigate('/food/user/services')
    }
  }

  const handleCancel = async (id) => {
    try {
      await servicesUserAPI.cancelBooking(id)
      toast.success("Booking cancelled")
      fetchBookings()
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to cancel")
    }
  }

  const currentList = bookings[activeTab] || []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-[#1a1a1a] shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/food/user/profile")} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex-1">
            My Services
          </h1>
        </div>
        
        {/* Tabs */}
        <div className="max-w-3xl mx-auto px-4 flex gap-6 border-b border-gray-100 dark:border-gray-800">
          <button 
            className={`pb-4 px-2 font-medium text-sm relative ${activeTab === 'upcoming' ? 'text-orange-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming
            {activeTab === 'upcoming' && (
              <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 rounded-t-full" />
            )}
          </button>
          <button 
            className={`pb-4 px-2 font-medium text-sm relative ${activeTab === 'past' ? 'text-orange-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('past')}
          >
            Past Bookings
            {activeTab === 'past' && (
              <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 rounded-t-full" />
            )}
          </button>
        </div>
      </div>

      {/* Bookings List */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading bookings...</div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Wrench className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No {activeTab} bookings</h3>
            <p className="text-gray-500 text-sm">You don't have any service bookings in this section.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentList.map((booking, idx) => (
              <motion.div 
                key={booking._id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold text-gray-500 mb-1 block">ID: {booking._id ? String(booking._id).slice(-6).toUpperCase() : (booking.id ? String(booking.id).slice(-6).toUpperCase() : "N/A")}</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{booking.serviceName || "Unknown Service"}</h3>
                    <p className="text-sm text-gray-500">{booking.category}</p>
                  </div>
                  
                  {booking.status === 'pending' && (
                    <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">Pending</span>
                  )}
                  {booking.status === 'accepted' && (
                    <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">Professional Assigned</span>
                  )}
                  {booking.status === 'completed' && (
                    <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center gap-1">
                      Completed
                    </span>
                  )}
                  {booking.status === 'cancelled' && (
                    <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">Cancelled</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 bg-gray-50 dark:bg-[#121212] p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <Clock className="h-4 w-4 text-orange-500" /> 
                    <span>{booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString() : (booking.date || 'N/A')}<br/><span className="text-xs text-gray-500">{booking.timeSlot}</span></span>
                  </div>
                  <div className="flex flex-col gap-1 items-end text-sm text-gray-700 dark:text-gray-300 font-bold justify-end">
                    <div className="flex items-center gap-1"><IndianRupee className="h-4 w-4 text-gray-500" /> {booking.totalAmount}</div>
                    <span className="text-xs text-gray-400 font-normal">
                      {booking.paymentMode === 'pay_upfront' ? 'Paid Online' : 'Pay After Service'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-sm text-gray-500 mb-5">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-gray-400" />
                  <span>{booking.serviceAddress}</span>
                </div>

                <div className="flex gap-3">
                  {booking.status === 'pending' && (
                    <Button 
                      variant="outline" 
                      onClick={() => handleCancel(booking._id)}
                      className="flex-1 rounded-xl h-11 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Cancel
                    </Button>
                  )}
                  {(booking.status === 'completed' || booking.status === 'cancelled') && (
                    <Button 
                      className="flex-1 rounded-xl h-11 bg-orange-600 hover:bg-orange-700 text-white"
                      onClick={() => handleBookAgain(booking)}
                    >
                      Book Again
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
