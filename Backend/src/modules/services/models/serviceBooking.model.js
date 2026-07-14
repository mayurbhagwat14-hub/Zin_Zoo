import mongoose from 'mongoose';

const serviceBookingSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required']
        },
        serviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'VendorService'
        },
        serviceName: {
            type: String,
            required: [true, 'Service name is required'],
            trim: true
        },
        category: {
            type: String,
            required: [true, 'Category is required'],
            trim: true
        },
        customerName: {
            type: String,
            required: [true, 'Customer name is required'],
            trim: true
        },
        customerPhone: {
            type: String,
            required: [true, 'Customer phone is required'],
            trim: true
        },
        serviceAddress: {
            type: String,
            required: [true, 'Service address is required'],
            trim: true
        },
        bookingDate: {
            type: Date,
            required: [true, 'Booking date is required']
        },
        timeSlot: {
            type: String,
            required: [true, 'Time slot is required (e.g., 10:00 - 11:00)']
        },
        totalAmount: {
            type: Number,
            required: [true, 'Total amount is required'],
            min: 0
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'completed', 'cancelled'],
            default: 'pending'
        },
        paymentMode: {
            type: String,
            enum: ['pay_upfront', 'pay_after_service'],
            default: 'pay_after_service'
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'refunded'],
            default: 'pending'
        },
        paymentDetails: {
            razorpayOrderId: {
                type: String,
                default: null
            },
            razorpayPaymentId: {
                type: String,
                default: null
            },
            razorpaySignature: {
                type: String,
                default: null
            }
        }
    },
    {
        timestamps: true
    }
);

export const ServiceBooking = mongoose.model('ServiceBooking', serviceBookingSchema);
