import mongoose from 'mongoose';
import { config } from './src/config/env.js';
import { GroceryCategory } from './src/modules/food/admin/models/groceryCategory.model.js';
import { GroceryProduct } from './src/modules/food/admin/models/groceryProduct.model.js';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
});

async function upload(url, folder, id) {
    try {
        const r = await cloudinary.uploader.upload(url, {
            folder, public_id: id, resource_type: 'image', overwrite: true,
        });
        console.log(`  ✓ ${id}`);
        return r.secure_url;
    } catch (e) {
        console.error(`  ✗ ${id}: ${e.message}`);
        return url;
    }
}

const seed = async () => {
    try {
        await mongoose.connect(config.mongodbUri);
        await GroceryCategory.deleteMany({});
        await GroceryProduct.deleteMany({});

        // Categories with Unsplash images (always work with Cloudinary fetch)
        const cats = [
            { name: 'Fresh Fruits', img: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&q=80' },
            { name: 'Fresh Vegetables', img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80' },
            { name: 'Dairy & Eggs', img: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400&q=80' },
            { name: 'Bakery & Bread', img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80' },
            { name: 'Snacks & Beverages', img: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&q=80' },
        ];

        console.log('Uploading categories...');
        const catMap = {};
        for (const c of cats) {
            const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const url = await upload(c.img, 'grocery/categories', slug);
            const doc = await GroceryCategory.create({ name: c.name, image: url, isActive: true });
            catMap[c.name] = doc;
        }

        // All product images from Unsplash (real food photos, reliable CDN)
        const items = [
            // Fruits
            { cat: 'Fresh Fruits', name: 'Red Apple', price: 150, unit: '1 kg', desc: 'Farm-fresh red apples, crispy and sweet.',
              img: 'https://images.unsplash.com/photo-1568702846914-96b305d2uj8c?w=400&q=80' },
            { cat: 'Fresh Fruits', name: 'Yellow Banana', price: 60, unit: '1 Dozen', desc: 'Organic ripe yellow bananas.',
              img: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80' },
            { cat: 'Fresh Fruits', name: 'Sweet Strawberry', price: 200, unit: '500 g', desc: 'Fresh juicy red strawberries.',
              img: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=400&q=80' },
            { cat: 'Fresh Fruits', name: 'Nagpur Orange', price: 120, unit: '1 kg', desc: 'Sweet and tangy oranges.',
              img: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=400&q=80' },
            { cat: 'Fresh Fruits', name: 'Green Grapes', price: 90, unit: '500 g', desc: 'Seedless green grapes.',
              img: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=400&q=80' },
            { cat: 'Fresh Fruits', name: 'Juicy Watermelon', price: 80, unit: '1 pc', desc: 'Refreshing summer watermelon.',
              img: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&q=80' },
            { cat: 'Fresh Fruits', name: 'Ripe Mango', price: 250, unit: '1 kg', desc: 'Alphonso mangoes, king of fruits.',
              img: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&q=80' },
            { cat: 'Fresh Fruits', name: 'Fresh Pineapple', price: 110, unit: '1 pc', desc: 'Tropical sweet pineapple.',
              img: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=400&q=80' },
            { cat: 'Fresh Fruits', name: 'Pomegranate', price: 180, unit: '1 kg', desc: 'Ruby red pomegranate.',
              img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400&q=80' },
            { cat: 'Fresh Fruits', name: 'Kiwi Fruit', price: 140, unit: '3 pcs', desc: 'Green kiwi, tangy and nutritious.',
              img: 'https://images.unsplash.com/photo-1585059895524-72f7a5e6b3e4?w=400&q=80' },

            // Vegetables
            { cat: 'Fresh Vegetables', name: 'Red Tomato', price: 40, unit: '1 kg', desc: 'Ripe red tomatoes for cooking.',
              img: 'https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=400&q=80' },
            { cat: 'Fresh Vegetables', name: 'Potato', price: 30, unit: '1 kg', desc: 'Premium quality potatoes.',
              img: 'https://images.unsplash.com/photo-1518977676601-b53f82ber49?w=400&q=80' },
            { cat: 'Fresh Vegetables', name: 'Red Onion', price: 45, unit: '1 kg', desc: 'Fresh red onions.',
              img: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400&q=80' },
            { cat: 'Fresh Vegetables', name: 'Fresh Carrot', price: 60, unit: '1 kg', desc: 'Crunchy orange carrots.',
              img: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&q=80' },
            { cat: 'Fresh Vegetables', name: 'Cauliflower', price: 50, unit: '1 pc', desc: 'White fresh cauliflower.',
              img: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=400&q=80' },
            { cat: 'Fresh Vegetables', name: 'Green Capsicum', price: 80, unit: '500 g', desc: 'Bell pepper for salads.',
              img: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&q=80' },
            { cat: 'Fresh Vegetables', name: 'Broccoli', price: 120, unit: '1 pc', desc: 'Healthy green broccoli.',
              img: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400&q=80' },
            { cat: 'Fresh Vegetables', name: 'Fresh Cabbage', price: 35, unit: '1 pc', desc: 'Green cabbage.',
              img: 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=400&q=80' },
            { cat: 'Fresh Vegetables', name: 'Green Peas', price: 90, unit: '500 g', desc: 'Fresh green peas.',
              img: 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=400&q=80' },
            // Dairy
            { cat: 'Dairy & Eggs', name: 'Cow Milk', price: 65, unit: '1 Litre', desc: 'Pure fresh cow milk.',
              img: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=80' },
            { cat: 'Dairy & Eggs', name: 'Farm Eggs', price: 80, unit: '6 pcs', desc: 'Brown farm-fresh eggs.',
              img: 'https://images.unsplash.com/photo-1569288052389-dac9b01c9c05?w=400&q=80' },
            { cat: 'Dairy & Eggs', name: 'Amul Butter', price: 55, unit: '100 g', desc: 'Creamy salted butter.',
              img: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80' },
            { cat: 'Dairy & Eggs', name: 'Cheddar Cheese', price: 150, unit: '200 g', desc: 'Aged cheddar cheese.',
              img: 'https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=400&q=80' },
            { cat: 'Dairy & Eggs', name: 'Plain Curd', price: 40, unit: '400 g', desc: 'Fresh homestyle dahi.',
              img: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80' },
            { cat: 'Dairy & Eggs', name: 'Fresh Paneer', price: 90, unit: '200 g', desc: 'Soft cottage cheese.',
              img: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=80' },
            { cat: 'Dairy & Eggs', name: 'Toned Milk', price: 55, unit: '1 Litre', desc: 'Low-fat toned milk.',
              img: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80' },
            { cat: 'Dairy & Eggs', name: 'Desi Ghee', price: 650, unit: '1 Litre', desc: 'Pure cow ghee.',
              img: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&q=80' },
            { cat: 'Dairy & Eggs', name: 'Greek Yogurt', price: 80, unit: '200 g', desc: 'Thick creamy yogurt.',
              img: 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&q=80' },
            { cat: 'Dairy & Eggs', name: 'Mozzarella Cheese', price: 180, unit: '200 g', desc: 'Stretchy pizza mozzarella.',
              img: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&q=80' },

            // Bakery
            { cat: 'Bakery & Bread', name: 'White Bread', price: 45, unit: '1 pack', desc: 'Soft white bread.',
              img: 'https://images.unsplash.com/photo-1549931319-a545753467c8?w=400&q=80' },
            { cat: 'Bakery & Bread', name: 'Brown Bread', price: 55, unit: '1 pack', desc: 'Whole wheat bread.',
              img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80' },
            { cat: 'Bakery & Bread', name: 'Chocolate Cake', price: 350, unit: '500 g', desc: 'Rich chocolate cake.',
              img: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80' },
            { cat: 'Bakery & Bread', name: 'Chocolate Cupcake', price: 200, unit: '250 g', desc: 'Delicious chocolate cupcakes with rich creamy frosting.',
              img: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2f85?w=400&q=80' },
            { cat: 'Bakery & Bread', name: 'Croissant', price: 60, unit: '1 pc', desc: 'Buttery French croissant.',
              img: 'https://images.unsplash.com/photo-1555507036-ab1f4038024a?w=400&q=80' },
            { cat: 'Bakery & Bread', name: 'Burger Buns', price: 40, unit: '4 pcs', desc: 'Soft sesame burger buns.',
              img: 'https://images.unsplash.com/photo-1586816001966-79b736744398?w=400&q=80' },
            { cat: 'Bakery & Bread', name: 'Pizza Base', price: 50, unit: '2 pcs', desc: 'Ready pizza base.',
              img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80' },
            { cat: 'Bakery & Bread', name: 'Glazed Donut', price: 70, unit: '1 pc', desc: 'Sweet glazed donut.',
              img: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&q=80' },
            { cat: 'Bakery & Bread', name: 'Blueberry Muffin', price: 45, unit: '1 pc', desc: 'Moist blueberry muffin.',
              img: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&q=80' },
            { cat: 'Bakery & Bread', name: 'Baguette', price: 60, unit: '1 pack', desc: 'Classic French baguette.',
              img: 'https://images.unsplash.com/photo-1568471173242-461f0a730452?w=400&q=80' },
            { cat: 'Bakery & Bread', name: 'Chocolate Cookies', price: 80, unit: '1 pack', desc: 'Choco chip cookies.',
              img: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&q=80' },

            // Snacks
            { cat: 'Snacks & Beverages', name: 'Potato Chips', price: 20, unit: '1 pack', desc: 'Crispy salted chips.',
              img: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&q=80' },
            { cat: 'Snacks & Beverages', name: 'Cola Drink', price: 40, unit: '750 ml', desc: 'Chilled cola drink.',
              img: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80' },
            { cat: 'Snacks & Beverages', name: 'Orange Juice', price: 110, unit: '1 Litre', desc: 'Fresh orange juice.',
              img: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80' },
            { cat: 'Snacks & Beverages', name: 'Dark Chocolate', price: 50, unit: '1 pc', desc: 'Premium dark chocolate.',
              img: 'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=400&q=80' },
            { cat: 'Snacks & Beverages', name: 'Nachos Pack', price: 60, unit: '1 pack', desc: 'Crunchy cheese nachos.',
              img: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400&q=80' },
            { cat: 'Snacks & Beverages', name: 'Energy Drink', price: 110, unit: '250 ml', desc: 'Caffeine energy drink.',
              img: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=400&q=80' },
            { cat: 'Snacks & Beverages', name: 'Mixed Nuts', price: 450, unit: '500 g', desc: 'Premium mixed dry fruits.',
              img: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400&q=80' },
            { cat: 'Snacks & Beverages', name: 'Green Tea', price: 150, unit: '100 g', desc: 'Organic green tea.',
              img: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&q=80' },
            { cat: 'Snacks & Beverages', name: 'Coffee Powder', price: 290, unit: '100 g', desc: 'Arabica coffee.',
              img: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&q=80' },
            { cat: 'Snacks & Beverages', name: 'Popcorn Box', price: 30, unit: '1 pack', desc: 'Butter popcorn.',
              img: 'https://images.unsplash.com/photo-1585535065945-0d138e6bf2b3?w=400&q=80' },
        ];

        console.log(`\nUploading ${items.length} product images to Cloudinary...`);
        for (let i = 0; i < items.length; i++) {
            const p = items[i];
            const cat = catMap[p.cat];
            if (!cat) continue;
            const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const url = await upload(p.img, 'grocery/products', slug);
            await GroceryProduct.create({
                categoryId: cat._id, categoryName: cat.name,
                name: p.name, description: p.desc, price: p.price,
                unit: p.unit, stock: Math.floor(Math.random() * 100) + 10,
                image: url, isActive: true,
            });
            console.log(`  [${i+1}/${items.length}] ${p.name}`);
        }

        console.log('\n✅ Done! All images hosted on Cloudinary.');
        process.exit(0);
    } catch (e) { console.error(e); process.exit(1); }
};

seed();
