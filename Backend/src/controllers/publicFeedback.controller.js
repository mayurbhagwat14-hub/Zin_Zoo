import { FeedbackExperience } from '../modules/food/admin/models/feedbackExperience.model.js';
import { sendResponse, sendError } from '../utils/response.js';

/**
 * Public feedback submission (no authentication required).
 * POST /api/v1/food/public/feedback
 * Used by QR code on invoice receipts.
 */
export async function submitPublicFeedback(req, res) {
    try {
        const { orderId, rating, comment, customerName, customerPhone } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return sendError(res, 400, 'Rating is required (1-5)');
        }

        if (!orderId) {
            return sendError(res, 400, 'Order ID is required');
        }

        // Check if feedback already submitted for this order
        const existing = await FeedbackExperience.findOne({ orderId, module: 'order' });
        if (existing) {
            return sendError(res, 409, 'Feedback already submitted for this order');
        }

        const feedback = await FeedbackExperience.create({
            orderId,
            rating: Number(rating),
            comment: String(comment || '').trim(),
            customerName: String(customerName || '').trim(),
            customerPhone: String(customerPhone || '').trim(),
            module: 'order',
            userModel: 'FoodUser'
        });

        // Broadcast real-time update to admin
        try {
            const { broadcastPublicUpdate } = await import('../config/socket.js');
            broadcastPublicUpdate('feedback:update', { action: 'create', data: feedback });
        } catch (e) {
            console.error('Failed to broadcast feedback update:', e);
        }

        return sendResponse(res, 201, 'Feedback submitted successfully', feedback);
    } catch (error) {
        console.error('Error submitting public feedback:', error);
        return sendError(res, 500, 'Failed to submit feedback: ' + error.message);
    }
}
