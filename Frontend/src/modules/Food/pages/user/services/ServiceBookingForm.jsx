import React, { useState } from "react"
import { motion } from "framer-motion"
import { Calendar, Clock, MapPin, Phone, User, CheckCircle2, IndianRupee, ArrowLeft } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@food/components/ui/sheet"
import { useNavigate } from "react-router-dom"
import { servicesUserAPI } from "@food/api"
import { toast } from "sonner"
import { initRazorpayPayment } from "@food/utils/razorpay"

export default function ServiceBookingForm({ isOpen, onClose, service, categoryTitle }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: Details, 2: Payment, 3: Success
  const [formData, setFormData] = useState({
    date: "",
    timeSlot: "",
    name: "",
    phone: "",
    address: "",
    paymentMode: ""
  })

  if (!service) return null

  const timeSlots = [
    "09:00 AM - 11:00 AM",
    "11:00 AM - 01:00 PM",
    "02:00 PM - 04:00 PM",
    "04:00 PM - 06:00 PM"
  ]

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleProceedToPayment = () => {
    if (!formData.date) return alert("Please select a date for the service")
    if (!formData.timeSlot) return alert("Please select a time slot")
    if (!formData.name) return alert("Please enter your name")
    if (!formData.phone) return alert("Please enter your phone number")
    if (!formData.address) return alert("Please enter your service address")
    setStep(2)
  }

  const handleBooking = async () => {
    if (!formData.paymentMode) {
      toast.error("Please select a payment option before confirming your booking.")
      return
    }
    try {
      const price = Number(service.price || service.basePrice || 0)
      const res = await servicesUserAPI.createBooking({
        serviceName: service.name,
        category: categoryTitle,
        customerName: formData.name,
        customerPhone: formData.phone,
        serviceAddress: formData.address,
        bookingDate: formData.date,
        timeSlot: formData.timeSlot,
        totalAmount: price,
        paymentMode: formData.paymentMode
      })

      const booking = res.data?.data?.booking
      const razorpay = res.data?.data?.razorpay

      if (formData.paymentMode === 'pay_upfront' && razorpay) {
        try {
          await initRazorpayPayment({
            key: razorpay.key,
            amount: razorpay.amount,
            currency: razorpay.currency || 'INR',
            order_id: razorpay.orderId,
            name: "Zin Zoo",
            description: `Booking for ${service.name}`,
            prefill: {
              name: formData.name,
              contact: formData.phone
            },
            handler: async (paymentResponse) => {
              try {
                await servicesUserAPI.verifyBookingPayment(booking._id, {
                  razorpayPaymentId: paymentResponse.razorpay_payment_id,
                  razorpayOrderId: paymentResponse.razorpay_order_id,
                  razorpaySignature: paymentResponse.razorpay_signature
                })
                setStep(3)
              } catch (verifyErr) {
                console.error("Payment verification failed:", verifyErr)
                toast.error(verifyErr.response?.data?.message || "Payment verification failed.")
              }
            },
            modal: {
              ondismiss: () => {
                toast.error("Payment cancelled. Please try again.")
              }
            }
          })
        } catch (paymentErr) {
          console.error("Razorpay error:", paymentErr)
          toast.error(paymentErr.message || "Failed to initialize payment.")
        }
      } else {
        setStep(3)
      }
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || "Failed to book service")
    }
  }

  const closeAndReset = () => {
    onClose()
    setTimeout(() => {
      setStep(1)
      setFormData({
        date: "",
        timeSlot: "",
        name: "",
        phone: "",
        address: "",
        paymentMode: ""
      })
    }, 500)
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeAndReset()}>
      <SheetContent side="bottom" className="h-[90vh] sm:h-[85vh] rounded-t-3xl bg-white dark:bg-[#121212] overflow-y-auto border-t-0 p-0">
        
        {step === 3 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1 }} 
              className="w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mb-6"
            >
              <CheckCircle2 className="h-12 w-12" />
            </motion.div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Booking Confirmed!</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
              Your service request for <strong>{service.name}</strong> has been successfully booked for {formData.date} at {formData.timeSlot}.
            </p>
            <div className="flex w-full gap-4 max-w-sm">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={closeAndReset}>
                Close
              </Button>
              <Button 
                className="flex-1 rounded-xl bg-orange-600 hover:bg-orange-700" 
                onClick={() => {
                  closeAndReset()
                  navigate("/food/user/profile/my-services")
                }}
              >
                Track Booking
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-[#121212] z-10">
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full mx-auto mb-4" />
              <SheetHeader className="text-left flex flex-row items-center gap-3 space-y-0">
                <Button variant="ghost" size="icon" onClick={closeAndReset} className="h-8 w-8 rounded-full -ml-2 shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <SheetTitle className="text-xl md:text-2xl font-black">
                    Book {service.name}
                  </SheetTitle>
                  <SheetDescription>
                    {categoryTitle} • <IndianRupee className="inline h-3 w-3 -mt-0.5" />{service.price || service.basePrice}
                  </SheetDescription>
                </div>
              </SheetHeader>
            </div>

            <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              {step === 1 && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  {/* Date & Time */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-orange-500" /> Date & Time
                    </h3>
                    <Input 
                      type="date" 
                      name="date"
                      value={formData.date}
                      onChange={handleChange}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      min={new Date().toISOString().split('T')[0]}
                      className="rounded-xl h-12 bg-gray-50 dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-800 w-full" 
                    />
                    
                    <div className="grid grid-cols-2 gap-3">
                      {timeSlots.map(slot => (
                        <button
                          key={slot}
                          onClick={() => setFormData({...formData, timeSlot: slot})}
                          className={`p-3 rounded-xl text-sm font-medium border text-center transition-all ${
                            formData.timeSlot === slot 
                              ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600" 
                              : "border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-orange-200"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Personal Details */}
                  <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <User className="h-4 w-4 text-orange-500" /> Contact Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Input name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} className="rounded-xl h-12" />
                      <Input name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} className="rounded-xl h-12" />
                    </div>
                    <Input name="address" placeholder="Complete Service Address" value={formData.address} onChange={handleChange} className="rounded-xl h-12" />
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  {/* Payment Selection */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-900 dark:text-white">Payment Method</h3>
                    
                    <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${formData.paymentMode === 'pay_upfront' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-gray-200 dark:border-gray-800'}`}>
                      <input 
                        type="radio" 
                        name="paymentMode" 
                        value="pay_upfront" 
                        checked={formData.paymentMode === 'pay_upfront'} 
                        onChange={handleChange} 
                        className="w-5 h-5 text-orange-500 focus:ring-orange-500"
                      />
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">Pay Online Now</div>
                        <div className="text-xs text-gray-500">Credit/Debit Card, UPI, Wallets</div>
                      </div>
                    </label>

                    <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${formData.paymentMode === 'pay_after_service' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-gray-200 dark:border-gray-800'}`}>
                      <input 
                        type="radio" 
                        name="paymentMode" 
                        value="pay_after_service" 
                        checked={formData.paymentMode === 'pay_after_service'} 
                        onChange={handleChange}
                        className="w-5 h-5 text-orange-500 focus:ring-orange-500" 
                      />
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">Pay After Service</div>
                        <div className="text-xs text-gray-500">Cash or UPI after job completion</div>
                      </div>
                    </label>
                  </div>

                  {/* Bill Summary */}
                  <div className="bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-xl space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Service Cost</span>
                      <span className="font-medium">₹{service.price || service.basePrice}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Visiting Charge</span>
                      <span className="font-medium text-green-600">Free</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-3 border-t border-gray-200 dark:border-gray-700">
                      <span>Total Amount</span>
                      <span>₹{service.price || service.basePrice}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="p-4 md:p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#121212] sticky bottom-0">
              {step === 1 ? (
                <Button 
                  className="w-full h-14 rounded-xl text-lg font-bold bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={handleProceedToPayment}
                >
                  Proceed to Payment
                </Button>
              ) : (
                <div className="flex gap-3">
                  <Button variant="outline" className="h-14 rounded-xl px-6" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button 
                    className="flex-1 h-14 rounded-xl text-lg font-bold bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={handleBooking}
                  >
                    Confirm Booking
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
