import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import { uploadImageBuffer } from '../services/localUpload.service.js';

// Import Models
import { FoodCategory } from '../modules/food/admin/models/category.model.js';
import { GroceryCategory } from '../modules/food/admin/models/groceryCategory.model.js';
import { FoodItem } from '../modules/food/admin/models/food.model.js';
import { GroceryProduct } from '../modules/food/admin/models/groceryProduct.model.js';
import { FoodBusinessSettings } from '../modules/food/admin/models/businessSettings.model.js';
import { FoodUser } from '../core/users/user.model.js';
import { FoodHeroBanner } from '../modules/food/landing/models/heroBanner.model.js';
import TopBanner from '../modules/food/landing/models/topBanner.model.js';
import { HomePromotionBanner } from '../modules/food/landing/models/homePromotionBanner.model.js';
import { FoodUnder250Banner } from '../modules/food/landing/models/under250Banner.model.js';
import { FoodAccessoriesBanner } from '../modules/food/landing/models/accessoriesBanner.model.js';
import { FoodExploreIcon } from '../modules/food/landing/models/exploreIcon.model.js';
import { FoodLandingSettings } from '../modules/food/landing/models/landingSettings.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const downloadImage = (url) => {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to download image, status code: ${res.statusCode}`));
            }
            const data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
    });
};

const processField = async (doc, field, folderName) => {
    const url = doc[field];
    if (url && typeof url === 'string' && (url.includes('cloudinary.com') || url.startsWith('http'))) {
        try {
            console.log(`Downloading ${field} for ${doc._id}: ${url}`);
            const buffer = await downloadImage(url);
            const localUrl = await uploadImageBuffer(buffer, folderName);
            doc[field] = localUrl;
            return true;
        } catch (err) {
            console.error(`Error migrating ${field} for ${doc._id}:`, err.message);
        }
    }
    return false;
};

const migrateCollection = async (Model, fields, folderName) => {
    console.log(`\nMigrating collection: ${Model.modelName}`);
    const docs = await Model.find({});
    let updatedCount = 0;

    for (const doc of docs) {
        let isUpdated = false;
        for (const field of fields) {
            const updated = await processField(doc, field, folderName);
            if (updated) isUpdated = true;
        }
        if (isUpdated) {
            await doc.save();
            updatedCount++;
            console.log(`Updated document ${doc._id}`);
        }
    }
    console.log(`Completed migrating ${Model.modelName}. Total updated: ${updatedCount}`);
};

const runMigration = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        await migrateCollection(FoodCategory, ['image'], 'categories');
        await migrateCollection(GroceryCategory, ['image'], 'categories');
        await migrateCollection(FoodItem, ['image'], 'foods');
        await migrateCollection(GroceryProduct, ['image'], 'foods');
        await migrateCollection(FoodBusinessSettings, ['logo', 'favicon'], 'banners');
        await migrateCollection(FoodUser, ['avatar', 'profileImage'], 'users');
        await migrateCollection(FoodHeroBanner, ['imageUrl'], 'food/hero-banners');
        await migrateCollection(TopBanner, ['image'], 'food/top-banners');
        await migrateCollection(HomePromotionBanner, ['imageUrl'], 'food/home-promotions');
        await migrateCollection(FoodUnder250Banner, ['imageUrl'], 'food/under250-banners');
        await migrateCollection(FoodAccessoriesBanner, ['imageUrl'], 'food/accessories-banners');
        await migrateCollection(FoodExploreIcon, ['iconUrl'], 'food/explore-icons');
        await migrateCollection(FoodLandingSettings, ['heroVideoUrl'], 'food/landing-settings');

        console.log('\nMigration complete.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

runMigration();
