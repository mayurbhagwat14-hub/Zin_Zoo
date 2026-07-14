import { VendorService } from '../models/vendorService.model.js';
import { ServiceCategory } from '../models/serviceCategory.model.js';
import { ServiceBooking } from '../models/serviceBooking.model.js';
import { broadcastPublicUpdate } from '../../../config/socket.js';

export async function getAllServices(req, res) {
    try {
        const query = {};
        if (req.query.search) {
            query.name = { $regex: req.query.search, $options: 'i' };
        }
        
        const services = await VendorService.find(query).sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            data: { services }
        });
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch services', error: error.message });
    }
}

export async function createService(req, res) {
    try {
        const { name, image, category, subCategory, basePrice, description, availableFrom, availableTo, provider, isActive, zoneId } = req.body;
        
        const newService = new VendorService({
            name,
            image: image || '',
            category,
            subCategory,
            basePrice,
            description,
            availableFrom,
            availableTo,
            provider: provider || 'Admin',
            zoneId: zoneId || undefined,
            isActive: isActive !== undefined ? isActive : true
        });
        
        await newService.save();
        broadcastPublicUpdate('services:item:update', { action: 'create', data: newService });
        
        res.status(201).json({
            success: true,
            message: 'Service created successfully',
            data: { service: newService }
        });
    } catch (error) {
        console.error('Error creating service:', error);
        res.status(500).json({ success: false, message: 'Failed to create service', error: error.message });
    }
}

export async function updateService(req, res) {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const updatedService = await VendorService.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );
        
        if (!updatedService) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }
        broadcastPublicUpdate('services:item:update', { action: 'update', data: updatedService });
        
        res.status(200).json({
            success: true,
            message: 'Service updated successfully',
            data: { service: updatedService }
        });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({ success: false, message: 'Failed to update service', error: error.message });
    }
}

export async function deleteService(req, res) {
    try {
        const { id } = req.params;
        const deletedService = await VendorService.findByIdAndDelete(id);
        
        if (!deletedService) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }
        broadcastPublicUpdate('services:item:update', { action: 'delete', data: { _id: id } });
        
        res.status(200).json({
            success: true,
            message: 'Service deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting service:', error);
    }
}

// ==================== CATEGORIES ====================

export async function getAllCategories(req, res) {
    try {
        const query = {};
        if (req.query.search) {
            query.name = { $regex: req.query.search, $options: 'i' };
        }
        
        const categories = await ServiceCategory.find(query).sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            data: { categories }
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
    }
}

export async function createCategory(req, res) {
    try {
        const { name, image, subCategories, isActive, zoneId } = req.body;
        
        const newCategory = new ServiceCategory({
            name,
            image: image || '',
            subCategories: subCategories || [],
            zoneId: zoneId || undefined,
            isActive: isActive !== undefined ? isActive : true
        });
        
        await newCategory.save();
        broadcastPublicUpdate('services:category:update', { action: 'create', data: newCategory });
        
        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: { category: newCategory }
        });
    } catch (error) {
        console.error('Error creating category:', error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Category with this name already exists' });
        }
        res.status(500).json({ success: false, message: 'Failed to create category', error: error.message });
    }
}

export async function updateCategory(req, res) {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const updatedCategory = await ServiceCategory.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );
        
        if (!updatedCategory) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        broadcastPublicUpdate('services:category:update', { action: 'update', data: updatedCategory });
        
        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: { category: updatedCategory }
        });
    } catch (error) {
        console.error('Error updating category:', error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Category with this name already exists' });
        }
        res.status(500).json({ success: false, message: 'Failed to update category', error: error.message });
    }
}

export async function deleteCategory(req, res) {
    try {
        const { id } = req.params;
        const deletedCategory = await ServiceCategory.findByIdAndDelete(id);
        
        if (!deletedCategory) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        broadcastPublicUpdate('services:category:update', { action: 'delete', data: { _id: id } });
        
        res.status(200).json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ success: false, message: 'Failed to delete category', error: error.message });
    }
}

// ==================== BOOKINGS ====================

export async function getAllBookings(req, res) {
    try {
        const query = {};
        if (req.query.status && req.query.status !== 'all') {
            query.status = req.query.status;
        }
        if (req.query.search) {
            query.customerName = { $regex: req.query.search, $options: 'i' };
        }
        
        const bookings = await ServiceBooking.find(query).populate('serviceId', 'name category').sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            data: { bookings }
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch bookings', error: error.message });
    }
}

export async function updateBookingStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const booking = await ServiceBooking.findById(id);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        let refundResult = null;
        if (status === 'cancelled') {
            // Process refund if online payment was made and is currently 'paid'
            if (booking.paymentMode === 'pay_upfront' && booking.paymentDetails?.razorpayPaymentId && booking.paymentStatus === 'paid') {
                const { initiateRazorpayRefund, isRazorpayConfigured } = await import('../../food/orders/helpers/razorpay.helper.js');
                if (isRazorpayConfigured()) {
                    try {
                        refundResult = await initiateRazorpayRefund(
                            booking.paymentDetails.razorpayPaymentId,
                            booking.totalAmount
                        );
                        if (refundResult.success) {
                            booking.paymentStatus = 'refunded';
                        } else {
                            console.error("Razorpay refund failed:", refundResult.error);
                        }
                    } catch (err) {
                        console.error("Failed to process Razorpay refund:", err);
                    }
                } else {
                    // Simulating successful refund for development mode if keys are not set
                    booking.paymentStatus = 'refunded';
                    refundResult = { success: true, simulated: true };
                }
            }
        } else if (status === 'completed' && booking.paymentMode === 'pay_after_service') {
            // For cash bookings, completion marks payment status as paid
            booking.paymentStatus = 'paid';
        }

        booking.status = status;
        await booking.save();

        const updatedBooking = await ServiceBooking.findById(id).populate('serviceId', 'name category');
        
        res.status(200).json({
            success: true,
            message: 'Booking status updated successfully',
            data: { 
                booking: updatedBooking,
                refund: refundResult
            }
        });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ success: false, message: 'Failed to update booking status', error: error.message });
    }
}

