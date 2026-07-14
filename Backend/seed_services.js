import mongoose from 'mongoose';
import { ServiceCategory } from './src/modules/services/models/serviceCategory.model.js';
import { VendorService } from './src/modules/services/models/vendorService.model.js';
import { config } from './src/config/env.js';

const seedData = async () => {
    try {
        console.log('Connecting to database...', config.mongodbUri);
        await mongoose.connect(config.mongodbUri);
        console.log('Connected!');

        // Clear existing just in case (though it's 0 currently)
        await ServiceCategory.deleteMany({});
        await VendorService.deleteMany({});

        // 1. Create Categories
        const catElectronics = await ServiceCategory.create({
            name: 'Electronics Repair',
            image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=800&auto=format&fit=crop',
            subCategories: [
                { name: 'AC Servicing', image: 'https://images.unsplash.com/photo-1599388147291-7f89d38c64bb?q=80&w=400&auto=format&fit=crop' },
                { name: 'TV Mounting', image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?q=80&w=400&auto=format&fit=crop' }
            ],
            isActive: true
        });

        const catPlumbing = await ServiceCategory.create({
            name: 'Plumbing Services',
            image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?q=80&w=800&auto=format&fit=crop',
            subCategories: [
                { name: 'Tap Repair', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=400&auto=format&fit=crop' },
                { name: 'Pipe Installation', image: 'https://images.unsplash.com/photo-1607472586893-edb57cb31422?q=80&w=400&auto=format&fit=crop' }
            ],
            isActive: true
        });

        const catCleaning = await ServiceCategory.create({
            name: 'Deep Cleaning',
            image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=800&auto=format&fit=crop',
            subCategories: [
                { name: 'Sofa Cleaning', image: 'https://images.unsplash.com/photo-1567634861273-0d3596913c38?q=80&w=400&auto=format&fit=crop' },
                { name: 'Bathroom Cleaning', image: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?q=80&w=400&auto=format&fit=crop' }
            ],
            isActive: true
        });

        // 2. Create Services
        await VendorService.create([
            {
                name: 'Split AC Full Servicing',
                image: 'https://images.unsplash.com/photo-1599388147291-7f89d38c64bb?q=80&w=800&auto=format&fit=crop',
                category: 'Electronics Repair',
                subCategory: 'AC Servicing',
                basePrice: 499,
                description: 'Complete cleaning of cooling coils, filters, and gas check. Takes approx 45 mins.',
                availableFrom: '09:00',
                availableTo: '18:00',
                isActive: true
            },
            {
                name: 'TV Wall Mounting (Up to 55 inch)',
                image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?q=80&w=800&auto=format&fit=crop',
                category: 'Electronics Repair',
                subCategory: 'TV Mounting',
                basePrice: 349,
                description: 'Professional wall mounting with concealed wiring (wiring cost extra).',
                availableFrom: '09:00',
                availableTo: '19:00',
                isActive: true
            },
            {
                name: 'Tap/Faucet Repair',
                image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800&auto=format&fit=crop',
                category: 'Plumbing Services',
                subCategory: 'Tap Repair',
                basePrice: 149,
                description: 'Fixing leaking taps, replacing washers, or installing new faucets.',
                availableFrom: '08:00',
                availableTo: '20:00',
                isActive: true
            },
            {
                name: 'Washbasin Blockage Removal',
                image: 'https://images.unsplash.com/photo-1607472586893-edb57cb31422?q=80&w=800&auto=format&fit=crop',
                category: 'Plumbing Services',
                subCategory: 'Pipe Installation',
                basePrice: 249,
                description: 'Complete unclogging of washbasin pipes using high-pressure air and chemicals.',
                availableFrom: '08:00',
                availableTo: '20:00',
                isActive: true
            },
            {
                name: '3-Seater Sofa Dry Cleaning',
                image: 'https://images.unsplash.com/photo-1567634861273-0d3596913c38?q=80&w=800&auto=format&fit=crop',
                category: 'Deep Cleaning',
                subCategory: 'Sofa Cleaning',
                basePrice: 599,
                description: 'Deep vacuuming, shampooing, and spot removal for fabric sofas.',
                availableFrom: '09:00',
                availableTo: '17:00',
                isActive: true
            },
            {
                name: 'Intense Bathroom Cleaning',
                image: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?q=80&w=800&auto=format&fit=crop',
                category: 'Deep Cleaning',
                subCategory: 'Bathroom Cleaning',
                basePrice: 399,
                description: 'Deep cleaning of tiles, floor, toilet bowl, and removing hard water stains.',
                availableFrom: '09:00',
                availableTo: '17:00',
                isActive: true
            }
        ]);

        console.log('Seed data inserted successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
};

seedData();
