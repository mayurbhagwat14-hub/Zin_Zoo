import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import { config } from './src/config/env.js';
import { VendorService } from './src/modules/services/models/vendorService.model.js';

const seedServices = async () => {
    try {
        await mongoose.connect(config.mongodbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        const services = [
            {
                name: 'AC Repair & Service',
                category: 'Home Appliances',
                subCategory: 'AC',
                basePrice: 500,
                description: 'Professional AC cleaning and repair service.',
                availableFrom: '09:00',
                availableTo: '18:00',
                provider: 'Admin',
                isActive: true
            },
            {
                name: 'Deep Home Cleaning',
                category: 'Cleaning',
                subCategory: 'Home',
                basePrice: 1500,
                description: 'Complete deep cleaning for 2BHK/3BHK.',
                availableFrom: '08:00',
                availableTo: '19:00',
                provider: 'Admin',
                isActive: true
            },
            {
                name: 'Monthly Tiffin Service',
                category: 'Food',
                subCategory: 'Lunch',
                basePrice: 3000,
                description: 'Healthy home-cooked meals delivered daily.',
                availableFrom: '11:00',
                availableTo: '14:00',
                provider: 'Admin',
                isActive: true
            },
            {
                name: 'Plumbing Service',
                category: 'Home Repairs',
                subCategory: 'Plumbing',
                basePrice: 300,
                description: 'Quick fix for leakage and pipe fitting.',
                availableFrom: '00:00',
                availableTo: '23:59',
                provider: 'Admin',
                isActive: true
            }
        ];

        await VendorService.insertMany(services);
        console.log('4 Services seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedServices();
