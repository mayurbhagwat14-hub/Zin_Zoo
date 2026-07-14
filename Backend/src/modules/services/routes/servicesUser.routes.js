import express from 'express';
import * as servicesUserController from '../controllers/servicesUser.controller.js';

const router = express.Router();

// Routes are already prefixed with /v1/services/user in index.js, 
// so the base path here is /bookings
router.post('/bookings', servicesUserController.createBooking);
router.get('/bookings', servicesUserController.getUserBookings);
router.put('/bookings/:id/cancel', servicesUserController.cancelBooking);
router.put('/bookings/:id/verify-payment', servicesUserController.verifyBookingPayment);

export default router;
