import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import { config } from './src/config/env.js';
import { VendorService } from './src/modules/services/models/vendorService.model.js';
import { ServiceBooking } from './src/modules/services/models/serviceBooking.model.js';

const seedBookings = async () => {
    try {
        await mongoose.connect(config.mongodbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        // Fetch existing services
        const services = await VendorService.find({});
        if (services.length === 0) {
            console.log('No services found. Run seedServices.js first.');
            process.exit(1);
        }

        // Clear existing dummy bookings if necessary (optional)
        await ServiceBooking.deleteMany({});
        console.log('Cleared existing bookings');

        const dummyBookings = [
            {
                serviceId: services[0 % services.length]._id,
                customerName: 'John Doe',
                customerPhone: '1234567890',
                serviceAddress: '123 Main St, Cityville',
                bookingDate: new Date(Date.now() + 86400000), // Tomorrow
                timeSlot: '10:00 - 11:00',
                totalAmount: services[0 % services.length].basePrice || 500,
                status: 'pending'
            },
            {
                serviceId: services[1 % services.length]._id,
                customerName: 'Jane Smith',
                customerPhone: '0987654321',
                serviceAddress: '456 Elm St, Townsville',
                bookingDate: new Date(Date.now() + 172800000), // Day after tomorrow
                timeSlot: '12:00 - 13:00',
                totalAmount: services[1 % services.length].basePrice || 800,
                status: 'accepted'
            },
            {
                serviceId: services[2 % services.length]._id,
                customerName: 'Alice Johnson',
                customerPhone: '5551234567',
                serviceAddress: '789 Pine St, Villageville',
                bookingDate: new Date(Date.now() - 86400000), // Yesterday
                timeSlot: '09:00 - 10:00',
                totalAmount: services[2 % services.length].basePrice || 600,
                status: 'completed'
            },
            {
                serviceId: services[3 % services.length]._id,
                customerName: 'Bob Brown',
                customerPhone: '5559876543',
                serviceAddress: '321 Oak St, Hamletville',
                bookingDate: new Date(Date.now() + 259200000), // 3 Days from now
                timeSlot: '14:00 - 15:00',
                totalAmount: services[3 % services.length].basePrice || 1200,
                status: 'pending'
            },
            {
                serviceId: services[0 % services.length]._id,
                customerName: 'Charlie Davis',
                customerPhone: '5557778888',
                serviceAddress: '654 Birch St, Forestville',
                bookingDate: new Date(), // Today
                timeSlot: '16:00 - 17:00',
                totalAmount: (services[0 % services.length].basePrice || 500) * 1.5,
                status: 'cancelled'
            }
        ];

        await ServiceBooking.insertMany(dummyBookings);

        console.log('Dummy bookings seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedBookings();
