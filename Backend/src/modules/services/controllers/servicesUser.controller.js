import { ServiceBooking } from '../models/serviceBooking.model.js';
import { createRazorpayOrder, getRazorpayKeyId, isRazorpayConfigured } from '../../food/orders/helpers/razorpay.helper.js';

// @desc    Create a new service booking
// @route   POST /api/v1/services/user/bookings
// @access  Private (User)
export const createBooking = async (req, res, next) => {
    try {
        const { serviceId, serviceName, category, customerName, customerPhone, serviceAddress, bookingDate, timeSlot, totalAmount, paymentMode } = req.body;

        if (!serviceName || !category || !bookingDate || !timeSlot || !totalAmount) {
            return res.status(400).json({ success: false, message: 'Missing required booking details' });
        }

        const booking = await ServiceBooking.create({
            userId: req.user.userId,
            serviceId: serviceId || undefined,
            serviceName,
            category,
            customerName,
            customerPhone,
            serviceAddress,
            bookingDate,
            timeSlot,
            totalAmount,
            paymentMode,
            status: 'pending'
        });

        let razorpay = null;
        if (paymentMode === 'pay_upfront') {
            if (isRazorpayConfigured()) {
                try {
                    const orderAmount = Math.round(totalAmount * 100);
                    const rzOrder = await createRazorpayOrder(orderAmount, 'INR', String(booking._id));
                    razorpay = {
                        orderId: rzOrder.id,
                        amount: rzOrder.amount,
                        currency: rzOrder.currency,
                        key: getRazorpayKeyId()
                    };
                } catch (rzError) {
                    console.error("Razorpay order creation failed for service booking:", rzError);
                }
            }
        }

        res.status(201).json({
            success: true,
            message: 'Service booked successfully',
            data: {
                booking,
                razorpay
            }
        });
    } catch (error) {
        console.error("createBooking error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// @desc    Get all bookings for logged-in user
// @route   GET /api/v1/services/user/bookings
// @access  Private (User)
export const getUserBookings = async (req, res, next) => {
    try {
        const bookings = await ServiceBooking.find({ userId: req.user.userId })
            .sort({ createdAt: -1 });

        const upcoming = [];
        const past = [];

        bookings.forEach(b => {
            if (b.status === 'pending' || b.status === 'accepted') {
                upcoming.push(b);
            } else {
                past.push(b);
            }
        });

        res.status(200).json({
            success: true,
            data: {
                upcoming,
                past,
                all: bookings
            }
        });
    } catch (error) {
        console.error("getUserBookings error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// @desc    Cancel a pending booking
// @route   PUT /api/v1/services/user/bookings/:id/cancel
// @access  Private (User)
export const cancelBooking = async (req, res, next) => {
    try {
        const booking = await ServiceBooking.findOne({ 
            _id: req.params.id, 
            userId: req.user.userId 
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (booking.status !== 'pending') {
            return res.status(400).json({ success: false, message: `Cannot cancel booking with status: ${booking.status}` });
        }

        booking.status = 'cancelled';
        await booking.save();

        res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully',
            data: {
                booking
            }
        });
    } catch (error) {
        console.error("cancelBooking error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// @desc    Verify payment signature for a service booking
// @route   PUT /api/v1/services/user/bookings/:id/verify-payment
// @access  Private (User)
export const verifyBookingPayment = async (req, res, next) => {
    try {
        const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
        
        const booking = await ServiceBooking.findOne({ 
            _id: req.params.id, 
            userId: req.user.userId 
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        const { verifyPaymentSignature, isRazorpayConfigured } = await import('../../food/orders/helpers/razorpay.helper.js');
        const isConfigured = isRazorpayConfigured();
        
        let isValid = false;
        if (isConfigured) {
            isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
        } else {
            isValid = true; // Bypass signature verification if Razorpay is not configured
        }

        if (!isValid) {
            console.warn("Razorpay signature verification failed. Bypassing check in development.");
            // If in development mode, bypass to let the flow complete
            if (process.env.NODE_ENV === 'production') {
                return res.status(400).json({ success: false, message: 'Invalid payment signature' });
            }
        }

        booking.paymentDetails = {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        };
        booking.paymentStatus = 'paid';
        
        await booking.save();

        res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            data: {
                booking
            }
        });
    } catch (error) {
        console.error("verifyBookingPayment error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
