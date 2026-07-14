import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import { config } from './src/config/env.js';
import { ServiceCategory } from './src/modules/services/models/serviceCategory.model.js';

const seedCategories = async () => {
    try {
        await mongoose.connect(config.mongodbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        const categories = [
            {
                name: 'Food',
                subCategories: ['Breakfast', 'Lunch', 'Dinner'],
                isActive: true
            },
            {
                name: 'Grocery',
                subCategories: ['Fresh Produce', 'Dairy & Eggs', 'Snacks', 'Beverages'],
                isActive: true
            }
        ];

        // Upsert to avoid duplicate key error if run multiple times
        for (const cat of categories) {
            await ServiceCategory.findOneAndUpdate({ name: cat.name }, cat, { upsert: true, new: true });
        }

        console.log('Categories seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedCategories();
