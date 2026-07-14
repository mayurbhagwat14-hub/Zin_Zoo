/**
 * Seed script: Replace test/fake data with real food items, grocery products & orders
 * 
 * Usage:  node --env-file=.env scripts/seed-real-data.js
 *   (or)  node -r dotenv/config scripts/seed-real-data.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI;
if (!MONGO_URI) {
    console.error('❌ MONGO_URI / MONGODB_URI missing in Backend/.env');
    process.exit(1);
}

// ─── Image URLs (royalty-free from Unsplash / picsum / pexels CDN) ───
const FOOD_IMAGES = {
    // Indian Food
    butterChicken: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&h=400&fit=crop',
    paneerTikka: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=400&fit=crop',
    biryani: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=400&fit=crop',
    dalMakhani: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=400&fit=crop',
    tandooriChicken: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=400&fit=crop',
    chholeKulche: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=400&h=400&fit=crop',
    masalaDosa: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&h=400&fit=crop',
    samosa: 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=400&h=400&fit=crop',
    gulabJamun: 'https://images.unsplash.com/photo-1666190073498-e04d7239ef45?w=400&h=400&fit=crop',
    mangoLassi: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&h=400&fit=crop',
    // Pizza & Burger
    pizza: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop',
    burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop',
    pasta: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=400&fit=crop',
    friedRice: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=400&fit=crop',
    noodles: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=400&fit=crop',
    iceCream: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&h=400&fit=crop',
    milkshake: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=400&fit=crop',
    frenchFries: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=400&fit=crop',
    momos: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&h=400&fit=crop',
    springRoll: 'https://images.unsplash.com/photo-1548507200-cf000d3a26d5?w=400&h=400&fit=crop',
    chai: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&h=400&fit=crop',
    coffee: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop',
    wrap: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&h=400&fit=crop',
    salad: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop',
};

const GROCERY_IMAGES = {
    rice: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop',
    wheat: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&h=400&fit=crop',
    sugar: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400&h=400&fit=crop',
    oil: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&h=400&fit=crop',
    milk: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&h=400&fit=crop',
    eggs: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&h=400&fit=crop',
    bread: 'https://images.unsplash.com/photo-1549931319-a545753467c8?w=400&h=400&fit=crop',
    butter: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&h=400&fit=crop',
    onion: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400&h=400&fit=crop',
    potato: 'https://images.unsplash.com/photo-1518977676601-b53f82ber5f7?w=400&h=400&fit=crop',
    tomato: 'https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=400&h=400&fit=crop',
    apple: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&h=400&fit=crop',
    banana: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&h=400&fit=crop',
    mango: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&h=400&fit=crop',
    paneer: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=400&fit=crop',
    chicken: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=400&fit=crop',
    tea: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&h=400&fit=crop',
    curd: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=400&fit=crop',
    chips: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&h=400&fit=crop',
    biscuit: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&h=400&fit=crop',
    soap: 'https://images.unsplash.com/photo-1584305574647-0cc949a2bb9f?w=400&h=400&fit=crop',
    detergent: 'https://images.unsplash.com/photo-1585441695325-21557c932984?w=400&h=400&fit=crop',
    toothpaste: 'https://images.unsplash.com/photo-1559667809-4c246baed0da?w=400&h=400&fit=crop',
    shampoo: 'https://images.unsplash.com/photo-1615478503562-ec2d8aa0a24d?w=400&h=400&fit=crop',
};

const CATEGORY_IMAGES = {
    northIndian: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=400&fit=crop',
    southIndian: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&h=400&fit=crop',
    chinese: 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=400&h=400&fit=crop',
    fastFood: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=400&h=400&fit=crop',
    desserts: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=400&fit=crop',
    beverages: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=400&fit=crop',
    snacks: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&h=400&fit=crop',
    italian: 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?w=400&h=400&fit=crop',
    // Grocery category images
    staples: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop',
    dairy: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&h=400&fit=crop',
    fruits: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&h=400&fit=crop',
    vegetables: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=400&fit=crop',
    nonVeg: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=400&fit=crop',
    snacksGrocery: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&h=400&fit=crop',
    personalCare: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=400&fit=crop',
    household: 'https://images.unsplash.com/photo-1585441695325-21557c932984?w=400&h=400&fit=crop',
};

// ─── Customer names for orders ───
const CUSTOMERS = [
    { name: 'Rahul Sharma', phone: '9876543210' },
    { name: 'Priya Singh', phone: '9871234567' },
    { name: 'Amit Patel', phone: '9898765432' },
    { name: 'Sneha Gupta', phone: '9845612378' },
    { name: 'Vikram Reddy', phone: '9912345678' },
    { name: 'Anjali Verma', phone: '9834567890' },
    { name: 'Rohit Kumar', phone: '9867890123' },
    { name: 'Neha Joshi', phone: '9856781234' },
    { name: 'Arjun Nair', phone: '9823456789' },
    { name: 'Kavita Desai', phone: '9890123456' },
];

const ADDRESSES = [
    { street: '42, MG Road, Sector 14', city: 'Noida', state: 'Uttar Pradesh', zipCode: '201301', label: 'Home' },
    { street: '15, Lajpat Nagar, Block C', city: 'New Delhi', state: 'Delhi', zipCode: '110024', label: 'Home' },
    { street: '78, Koramangala 5th Block', city: 'Bengaluru', state: 'Karnataka', zipCode: '560095', label: 'Office' },
    { street: '23, Bandra West, Hill Road', city: 'Mumbai', state: 'Maharashtra', zipCode: '400050', label: 'Home' },
    { street: '56, Anna Nagar, 2nd Avenue', city: 'Chennai', state: 'Tamil Nadu', zipCode: '600040', label: 'Office' },
    { street: '9, Salt Lake, Sector V', city: 'Kolkata', state: 'West Bengal', zipCode: '700091', label: 'Home' },
    { street: '34, Aundh, DP Road', city: 'Pune', state: 'Maharashtra', zipCode: '411007', label: 'Home' },
    { street: '67, Jubilee Hills, Road No 5', city: 'Hyderabad', state: 'Telangana', zipCode: '500033', label: 'Office' },
];

async function main() {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected\n');

    const db = mongoose.connection.db;

    // ─────────── 1. FOOD CATEGORIES ───────────
    console.log('🍽️  Step 1: Seeding Food Categories...');
    const foodCatCollection = db.collection('food_categories');

    // Remove old test categories
    await foodCatCollection.deleteMany({});
    console.log('   ✓ Cleared old food categories');

    const foodCategories = [
        { name: 'North Indian', type: 'Main Course', image: CATEGORY_IMAGES.northIndian, foodTypeScope: 'Both', isActive: true, isApproved: true, approvalStatus: 'approved', sortOrder: 1 },
        { name: 'South Indian', type: 'Main Course', image: CATEGORY_IMAGES.southIndian, foodTypeScope: 'Veg', isActive: true, isApproved: true, approvalStatus: 'approved', sortOrder: 2 },
        { name: 'Chinese', type: 'Main Course', image: CATEGORY_IMAGES.chinese, foodTypeScope: 'Both', isActive: true, isApproved: true, approvalStatus: 'approved', sortOrder: 3 },
        { name: 'Fast Food', type: 'Snacks', image: CATEGORY_IMAGES.fastFood, foodTypeScope: 'Both', isActive: true, isApproved: true, approvalStatus: 'approved', sortOrder: 4 },
        { name: 'Italian', type: 'Main Course', image: CATEGORY_IMAGES.italian, foodTypeScope: 'Both', isActive: true, isApproved: true, approvalStatus: 'approved', sortOrder: 5 },
        { name: 'Desserts', type: 'Desserts', image: CATEGORY_IMAGES.desserts, foodTypeScope: 'Veg', isActive: true, isApproved: true, approvalStatus: 'approved', sortOrder: 6 },
        { name: 'Beverages', type: 'Drinks', image: CATEGORY_IMAGES.beverages, foodTypeScope: 'Veg', isActive: true, isApproved: true, approvalStatus: 'approved', sortOrder: 7 },
        { name: 'Snacks & Starters', type: 'Starters', image: CATEGORY_IMAGES.snacks, foodTypeScope: 'Both', isActive: true, isApproved: true, approvalStatus: 'approved', sortOrder: 8 },
    ];

    const catTimestamps = { createdAt: new Date(), updatedAt: new Date() };
    const insertedFoodCats = await foodCatCollection.insertMany(
        foodCategories.map(c => ({ ...c, ...catTimestamps }))
    );
    const foodCatIds = Object.values(insertedFoodCats.insertedIds);
    console.log(`   ✓ Inserted ${foodCatIds.length} food categories`);

    // ─────────── 2. FOOD ITEMS ───────────
    console.log('\n🍛  Step 2: Seeding Food Items...');
    const foodCollection = db.collection('food_items');
    await foodCollection.deleteMany({});
    console.log('   ✓ Cleared old food items');

    const foodItems = [
        // North Indian
        { categoryId: foodCatIds[0], categoryName: 'North Indian', name: 'Butter Chicken', description: 'Tender chicken cooked in rich tomato-butter gravy with aromatic spices', price: 320, image: FOOD_IMAGES.butterChicken, foodType: 'Non-Veg', isAvailable: true, preparationTime: '25 min' },
        { categoryId: foodCatIds[0], categoryName: 'North Indian', name: 'Dal Makhani', description: 'Slow-cooked black lentils in creamy butter gravy', price: 220, image: FOOD_IMAGES.dalMakhani, foodType: 'Veg', isAvailable: true, preparationTime: '20 min' },
        { categoryId: foodCatIds[0], categoryName: 'North Indian', name: 'Paneer Tikka', description: 'Chargrilled cottage cheese marinated in spiced yogurt', price: 280, image: FOOD_IMAGES.paneerTikka, foodType: 'Veg', isAvailable: true, preparationTime: '20 min' },
        { categoryId: foodCatIds[0], categoryName: 'North Indian', name: 'Chicken Biryani', description: 'Fragrant basmati rice layered with spiced chicken and saffron', price: 350, image: FOOD_IMAGES.biryani, foodType: 'Non-Veg', isAvailable: true, preparationTime: '30 min' },
        { categoryId: foodCatIds[0], categoryName: 'North Indian', name: 'Tandoori Chicken', description: 'Whole chicken marinated in yogurt and tandoori spices, clay oven roasted', price: 380, image: FOOD_IMAGES.tandooriChicken, foodType: 'Non-Veg', isAvailable: true, preparationTime: '35 min' },
        { categoryId: foodCatIds[0], categoryName: 'North Indian', name: 'Chole Kulche', description: 'Spicy chickpea curry served with soft leavened bread', price: 180, image: FOOD_IMAGES.chholeKulche, foodType: 'Veg', isAvailable: true, preparationTime: '15 min' },

        // South Indian
        { categoryId: foodCatIds[1], categoryName: 'South Indian', name: 'Masala Dosa', description: 'Crispy rice crepe filled with spiced potato filling, served with sambar & chutney', price: 150, image: FOOD_IMAGES.masalaDosa, foodType: 'Veg', isAvailable: true, preparationTime: '15 min' },

        // Chinese
        { categoryId: foodCatIds[2], categoryName: 'Chinese', name: 'Veg Fried Rice', description: 'Wok-tossed basmati rice with seasonal vegetables and soy sauce', price: 180, image: FOOD_IMAGES.friedRice, foodType: 'Veg', isAvailable: true, preparationTime: '15 min' },
        { categoryId: foodCatIds[2], categoryName: 'Chinese', name: 'Hakka Noodles', description: 'Stir-fried noodles with vegetables in Indo-Chinese sauce', price: 190, image: FOOD_IMAGES.noodles, foodType: 'Veg', isAvailable: true, preparationTime: '15 min' },
        { categoryId: foodCatIds[2], categoryName: 'Chinese', name: 'Chicken Momos', description: 'Steamed dumplings filled with minced chicken and herbs, served with spicy chutney', price: 160, image: FOOD_IMAGES.momos, foodType: 'Non-Veg', isAvailable: true, preparationTime: '20 min' },
        { categoryId: foodCatIds[2], categoryName: 'Chinese', name: 'Spring Rolls', description: 'Crispy golden rolls stuffed with vegetables', price: 140, image: FOOD_IMAGES.springRoll, foodType: 'Veg', isAvailable: true, preparationTime: '15 min' },

        // Fast Food
        { categoryId: foodCatIds[3], categoryName: 'Fast Food', name: 'Classic Chicken Burger', description: 'Juicy grilled chicken patty with lettuce, tomato & mayo in a toasted bun', price: 199, image: FOOD_IMAGES.burger, foodType: 'Non-Veg', isAvailable: true, preparationTime: '12 min' },
        { categoryId: foodCatIds[3], categoryName: 'Fast Food', name: 'Crispy French Fries', description: 'Golden crispy potato fries seasoned with peri-peri spice', price: 120, image: FOOD_IMAGES.frenchFries, foodType: 'Veg', isAvailable: true, preparationTime: '10 min' },
        { categoryId: foodCatIds[3], categoryName: 'Fast Food', name: 'Paneer Wrap', description: 'Grilled paneer with fresh veggies rolled in a soft tortilla', price: 180, image: FOOD_IMAGES.wrap, foodType: 'Veg', isAvailable: true, preparationTime: '10 min' },

        // Italian
        { categoryId: foodCatIds[4], categoryName: 'Italian', name: 'Margherita Pizza', description: 'Classic pizza with fresh mozzarella, tomato sauce and basil', price: 299, image: FOOD_IMAGES.pizza, foodType: 'Veg', isAvailable: true, preparationTime: '20 min' },
        { categoryId: foodCatIds[4], categoryName: 'Italian', name: 'Penne Arrabbiata', description: 'Penne pasta tossed in spicy tomato sauce with garlic and chilli flakes', price: 260, image: FOOD_IMAGES.pasta, foodType: 'Veg', isAvailable: true, preparationTime: '18 min' },

        // Desserts
        { categoryId: foodCatIds[5], categoryName: 'Desserts', name: 'Gulab Jamun', description: 'Soft milk-solid dumplings soaked in rose-flavoured sugar syrup (2 pcs)', price: 80, image: FOOD_IMAGES.gulabJamun, foodType: 'Veg', isAvailable: true, preparationTime: '5 min' },
        { categoryId: foodCatIds[5], categoryName: 'Desserts', name: 'Chocolate Ice Cream', description: 'Rich and creamy Belgian chocolate ice cream scoop', price: 120, image: FOOD_IMAGES.iceCream, foodType: 'Veg', isAvailable: true, preparationTime: '5 min' },

        // Beverages
        { categoryId: foodCatIds[6], categoryName: 'Beverages', name: 'Mango Lassi', description: 'Chilled yogurt smoothie blended with fresh Alphonso mango pulp', price: 90, image: FOOD_IMAGES.mangoLassi, foodType: 'Veg', isAvailable: true, preparationTime: '5 min' },
        { categoryId: foodCatIds[6], categoryName: 'Beverages', name: 'Masala Chai', description: 'Traditional Indian spiced tea brewed with cardamom, ginger & cloves', price: 40, image: FOOD_IMAGES.chai, foodType: 'Veg', isAvailable: true, preparationTime: '5 min' },
        { categoryId: foodCatIds[6], categoryName: 'Beverages', name: 'Cold Coffee', description: 'Chilled coffee blended with ice cream and topped with whipped cream', price: 150, image: FOOD_IMAGES.coffee, foodType: 'Veg', isAvailable: true, preparationTime: '5 min' },
        { categoryId: foodCatIds[6], categoryName: 'Beverages', name: 'Strawberry Milkshake', description: 'Thick milkshake made with fresh strawberries and vanilla ice cream', price: 130, image: FOOD_IMAGES.milkshake, foodType: 'Veg', isAvailable: true, preparationTime: '5 min' },

        // Snacks & Starters
        { categoryId: foodCatIds[7], categoryName: 'Snacks & Starters', name: 'Samosa (2 pcs)', description: 'Crispy triangular pastry filled with spiced potato and peas', price: 50, image: FOOD_IMAGES.samosa, foodType: 'Veg', isAvailable: true, preparationTime: '10 min' },
        { categoryId: foodCatIds[7], categoryName: 'Snacks & Starters', name: 'Garden Fresh Salad', description: 'Mix of fresh greens, cherry tomatoes, cucumber with honey-lime dressing', price: 160, image: FOOD_IMAGES.salad, foodType: 'Veg', isAvailable: true, preparationTime: '8 min' },
    ];

    const foodTimestamps = { createdAt: new Date(), updatedAt: new Date() };
    const restaurantId = new mongoose.Types.ObjectId('6a1d300d79724756fb93c9d5');
    const restaurantName = 'Shree Vaarahi Home Foods';
    const zoneId = new mongoose.Types.ObjectId('6a3bab351f7bff8f5c1a5e66');
    
    const insertedFoods = await foodCollection.insertMany(
        foodItems.map(f => ({ 
            ...f, 
            restaurantId, 
            restaurantName, 
            zoneId,
            variants: [], 
            isRecommended: false, 
            ...foodTimestamps 
        }))
    );
    const foodIds = Object.values(insertedFoods.insertedIds);
    console.log(`   ✓ Inserted ${foodIds.length} food items`);

    // ─────────── 3. GROCERY CATEGORIES ───────────
    console.log('\n🛒  Step 3: Seeding Grocery Categories...');
    const groceryCatCollection = db.collection('grocery_categories');
    await groceryCatCollection.deleteMany({});
    console.log('   ✓ Cleared old grocery categories');

    const groceryCategories = [
        { name: 'Staples & Grains', image: CATEGORY_IMAGES.staples, isActive: true, sortOrder: 1 },
        { name: 'Dairy & Eggs', image: CATEGORY_IMAGES.dairy, isActive: true, sortOrder: 2 },
        { name: 'Fruits', image: CATEGORY_IMAGES.fruits, isActive: true, sortOrder: 3 },
        { name: 'Vegetables', image: CATEGORY_IMAGES.vegetables, isActive: true, sortOrder: 4 },
        { name: 'Meat & Poultry', image: CATEGORY_IMAGES.nonVeg, isActive: true, sortOrder: 5 },
        { name: 'Snacks & Biscuits', image: CATEGORY_IMAGES.snacksGrocery, isActive: true, sortOrder: 6 },
        { name: 'Personal Care', image: CATEGORY_IMAGES.personalCare, isActive: true, sortOrder: 7 },
        { name: 'Household', image: CATEGORY_IMAGES.household, isActive: true, sortOrder: 8 },
    ];

    const insertedGroceryCats = await groceryCatCollection.insertMany(
        groceryCategories.map(c => ({ ...c, ...catTimestamps }))
    );
    const groceryCatIds = Object.values(insertedGroceryCats.insertedIds);
    console.log(`   ✓ Inserted ${groceryCatIds.length} grocery categories`);

    // ─────────── 4. GROCERY PRODUCTS ───────────
    console.log('\n📦  Step 4: Seeding Grocery Products...');
    const groceryCollection = db.collection('grocery_products');
    await groceryCollection.deleteMany({});
    console.log('   ✓ Cleared old grocery products');

    const groceryProducts = [
        // Staples & Grains
        { categoryId: groceryCatIds[0], categoryName: 'Staples & Grains', name: 'Basmati Rice - India Gate', description: 'Premium aged basmati rice, extra long grain', price: 320, unit: '5 kg', stock: 50, image: GROCERY_IMAGES.rice, isActive: true },
        { categoryId: groceryCatIds[0], categoryName: 'Staples & Grains', name: 'Aashirvaad Whole Wheat Atta', description: 'Whole wheat flour for soft rotis', price: 280, unit: '5 kg', stock: 40, image: GROCERY_IMAGES.wheat, isActive: true },
        { categoryId: groceryCatIds[0], categoryName: 'Staples & Grains', name: 'Sugar', description: 'Refined white sugar crystals', price: 48, unit: '1 kg', stock: 100, image: GROCERY_IMAGES.sugar, isActive: true },
        { categoryId: groceryCatIds[0], categoryName: 'Staples & Grains', name: 'Fortune Sunflower Oil', description: 'Heart-healthy refined sunflower cooking oil', price: 180, unit: '1 L', stock: 60, image: GROCERY_IMAGES.oil, isActive: true },

        // Dairy & Eggs
        { categoryId: groceryCatIds[1], categoryName: 'Dairy & Eggs', name: 'Amul Toned Milk', description: 'Fresh pasteurized toned milk', price: 30, unit: '500 ml', stock: 100, image: GROCERY_IMAGES.milk, isActive: true },
        { categoryId: groceryCatIds[1], categoryName: 'Dairy & Eggs', name: 'Farm Fresh Eggs', description: 'Farm-raised brown eggs, protein-rich', price: 90, unit: '12 pcs', stock: 80, image: GROCERY_IMAGES.eggs, isActive: true },
        { categoryId: groceryCatIds[1], categoryName: 'Dairy & Eggs', name: 'Amul Butter', description: 'Pasteurized salted butter', price: 56, unit: '100 g', stock: 60, image: GROCERY_IMAGES.butter, isActive: true },
        { categoryId: groceryCatIds[1], categoryName: 'Dairy & Eggs', name: 'Mother Dairy Curd', description: 'Fresh set curd, creamy and smooth', price: 35, unit: '400 g', stock: 50, image: GROCERY_IMAGES.curd, isActive: true },
        { categoryId: groceryCatIds[1], categoryName: 'Dairy & Eggs', name: 'Amul Paneer', description: 'Fresh cottage cheese, perfect for curries and grills', price: 90, unit: '200 g', stock: 40, image: GROCERY_IMAGES.paneer, isActive: true },

        // Fruits
        { categoryId: groceryCatIds[2], categoryName: 'Fruits', name: 'Shimla Apple', description: 'Fresh red apples from Shimla orchards', price: 180, unit: '1 kg', stock: 30, image: GROCERY_IMAGES.apple, isActive: true },
        { categoryId: groceryCatIds[2], categoryName: 'Fruits', name: 'Robusta Banana', description: 'Sweet ripe bananas, rich in potassium', price: 45, unit: '1 dozen', stock: 50, image: GROCERY_IMAGES.banana, isActive: true },
        { categoryId: groceryCatIds[2], categoryName: 'Fruits', name: 'Alphonso Mango', description: 'Premium Alphonso mangoes from Ratnagiri', price: 450, unit: '1 kg', stock: 20, image: GROCERY_IMAGES.mango, isActive: true },

        // Vegetables
        { categoryId: groceryCatIds[3], categoryName: 'Vegetables', name: 'Onion', description: 'Fresh red onions, essential for every kitchen', price: 35, unit: '1 kg', stock: 100, image: GROCERY_IMAGES.onion, isActive: true },
        { categoryId: groceryCatIds[3], categoryName: 'Vegetables', name: 'Potato', description: 'Fresh potatoes, versatile for all dishes', price: 30, unit: '1 kg', stock: 100, image: GROCERY_IMAGES.potato, isActive: true },
        { categoryId: groceryCatIds[3], categoryName: 'Vegetables', name: 'Tomato', description: 'Farm-fresh red tomatoes', price: 40, unit: '1 kg', stock: 80, image: GROCERY_IMAGES.tomato, isActive: true },

        // Meat & Poultry
        { categoryId: groceryCatIds[4], categoryName: 'Meat & Poultry', name: 'Chicken Breast (Boneless)', description: 'Fresh boneless chicken breast, antibiotic-free', price: 320, unit: '500 g', stock: 25, image: GROCERY_IMAGES.chicken, isActive: true },

        // Snacks & Biscuits
        { categoryId: groceryCatIds[5], categoryName: 'Snacks & Biscuits', name: "Lay's Classic Salted Chips", description: 'Classic salted potato chips', price: 20, unit: '52 g', stock: 100, image: GROCERY_IMAGES.chips, isActive: true },
        { categoryId: groceryCatIds[5], categoryName: 'Snacks & Biscuits', name: 'Parle-G Gold Biscuit', description: 'India\'s favourite glucose biscuit', price: 30, unit: '200 g', stock: 80, image: GROCERY_IMAGES.biscuit, isActive: true },
        { categoryId: groceryCatIds[5], categoryName: 'Snacks & Biscuits', name: 'Britannia Good Day Bread', description: 'Soft and fresh white bread', price: 40, unit: '400 g', stock: 50, image: GROCERY_IMAGES.bread, isActive: true },

        // Personal Care
        { categoryId: groceryCatIds[6], categoryName: 'Personal Care', name: 'Dove Beauty Soap', description: 'Moisturizing beauty bar with ¼ cream', price: 55, unit: '100 g', stock: 60, image: GROCERY_IMAGES.soap, isActive: true },
        { categoryId: groceryCatIds[6], categoryName: 'Personal Care', name: 'Colgate MaxFresh Toothpaste', description: 'Cooling crystals for fresh breath', price: 85, unit: '150 g', stock: 50, image: GROCERY_IMAGES.toothpaste, isActive: true },
        { categoryId: groceryCatIds[6], categoryName: 'Personal Care', name: 'Head & Shoulders Shampoo', description: 'Anti-dandruff shampoo for clean scalp', price: 210, unit: '340 ml', stock: 30, image: GROCERY_IMAGES.shampoo, isActive: true },

        // Household
        { categoryId: groceryCatIds[7], categoryName: 'Household', name: 'Surf Excel Liquid Detergent', description: 'Tough stain removal, gentle on clothes', price: 240, unit: '1 L', stock: 40, image: GROCERY_IMAGES.detergent, isActive: true },
        { categoryId: groceryCatIds[7], categoryName: 'Household', name: 'Tata Tea Gold', description: 'Premium blend of 15% gold leaf tea', price: 250, unit: '500 g', stock: 40, image: GROCERY_IMAGES.tea, isActive: true },
    ];

    const insertedGrocery = await groceryCollection.insertMany(
        groceryProducts.map(g => ({ 
            ...g, 
            zoneId,
            isRecommended: false, 
            ...foodTimestamps 
        }))
    );
    const groceryIds = Object.values(insertedGrocery.insertedIds);
    console.log(`   ✓ Inserted ${groceryIds.length} grocery products`);

    // ─────────── 5. FIND OR CREATE A USER ───────────
    console.log('\n👤  Step 5: Finding a user for orders...');
    const userCollection = db.collection('users');
    let user = await userCollection.findOne({});
    let userId;
    if (user) {
        userId = user._id;
        console.log(`   ✓ Using existing user: ${user.name || user.fullName || user._id}`);
    } else {
        const insertResult = await userCollection.insertOne({
            name: 'Demo Customer',
            fullName: 'Demo Customer',
            email: 'demo@zinzoo.com',
            phone: '9999999999',
            role: 'user',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        userId = insertResult.insertedId;
        console.log('   ✓ Created demo user');
    }

    // ─────────── 6. FOOD ORDERS ───────────
    console.log('\n📋  Step 6: Seeding Food Orders...');
    const foodOrderCollection = db.collection('food_orders');

    // Remove test orders
    const deletedFoodOrders = await foodOrderCollection.deleteMany({
        $or: [
            { 'items.name': { $regex: /test/i } },
            { 'items.name': { $regex: /food item/i } },
            { customerName: '' },
            { customerName: { $exists: false } },
        ]
    });
    console.log(`   ✓ Removed ${deletedFoodOrders.deletedCount} test food orders`);

    // Get the inserted food docs to reference their IDs
    const allFoods = await foodCollection.find({}).toArray();
    const statuses = ['delivered', 'confirmed', 'preparing', 'ready_for_pickup', 'created'];
    const paymentMethods = ['cash', 'razorpay'];

    const foodOrders = [];
    for (let i = 0; i < 15; i++) {
        const customer = CUSTOMERS[i % CUSTOMERS.length];
        const address = ADDRESSES[i % ADDRESSES.length];
        const status = statuses[i % statuses.length];
        const payMethod = paymentMethods[i % paymentMethods.length];

        // Pick 1–3 random food items
        const numItems = 1 + Math.floor(Math.random() * 3);
        const shuffled = [...allFoods].sort(() => Math.random() - 0.5);
        const orderItems = shuffled.slice(0, numItems).map(f => ({
            itemId: String(f._id),
            name: f.name,
            price: f.price,
            quantity: 1 + Math.floor(Math.random() * 2),
            isVeg: f.foodType === 'Veg',
            image: f.image,
            notes: '',
        }));

        const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const deliveryFee = 30 + Math.floor(Math.random() * 20);
        const tax = Math.round(subtotal * 0.05);
        const total = subtotal + deliveryFee + tax;

        const timestamp = Date.now().toString().slice(-4);
        const random = Math.floor(100 + Math.random() * 900);
        const orderId = `FOD-${timestamp}${random}`;

        const createdAt = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)); // within last 7 days

        foodOrders.push({
            order_id: orderId,
            orderId: orderId,
            userId: userId,
            items: orderItems,
            deliveryAddress: {
                label: address.label,
                name: customer.name,
                fullName: customer.name,
                street: address.street,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode,
                phone: customer.phone,
            },
            customerName: customer.name,
            customerPhone: customer.phone,
            pricing: {
                subtotal, tax, deliveryFee, packagingFee: 10, platformFee: 5, discount: 0, total, currency: 'INR',
            },
            payment: {
                method: payMethod,
                status: payMethod === 'cash' ? 'cod_pending' : 'paid',
            },
            orderStatus: status,
            dispatch: { modeAtCreation: 'auto', status: 'unassigned' },
            deliveryState: { currentPhase: 'en_route_to_pickup' },
            statusHistory: [{ at: createdAt, byRole: 'USER', from: '', to: 'created', note: 'Order placed' }],
            note: '',
            sendCutlery: true,
            createdAt,
            updatedAt: createdAt,
        });
    }

    await foodOrderCollection.insertMany(foodOrders);
    console.log(`   ✓ Inserted ${foodOrders.length} realistic food orders`);

    // ─────────── 7. GROCERY ORDERS ───────────
    console.log('\n🛍️  Step 7: Seeding Grocery Orders...');
    const groceryOrderCollection = db.collection('grocery_orders');

    const deletedGroceryOrders = await groceryOrderCollection.deleteMany({
        $or: [
            { 'items.name': { $regex: /test/i } },
            { customerName: '' },
            { customerName: { $exists: false } },
        ]
    });
    console.log(`   ✓ Removed ${deletedGroceryOrders.deletedCount} test grocery orders`);

    const allGroceries = await groceryCollection.find({}).toArray();
    const groceryStatuses = ['delivered', 'confirmed', 'preparing', 'created'];

    const groceryOrders = [];
    for (let i = 0; i < 10; i++) {
        const customer = CUSTOMERS[i % CUSTOMERS.length];
        const address = ADDRESSES[i % ADDRESSES.length];
        const status = groceryStatuses[i % groceryStatuses.length];
        const payMethod = paymentMethods[i % paymentMethods.length];

        const numItems = 2 + Math.floor(Math.random() * 3);
        const shuffled = [...allGroceries].sort(() => Math.random() - 0.5);
        const orderItems = shuffled.slice(0, numItems).map(g => ({
            itemId: String(g._id),
            name: g.name,
            price: g.price,
            quantity: 1 + Math.floor(Math.random() * 3),
            unit: g.unit,
            image: g.image,
            notes: '',
        }));

        const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const deliveryFee = 25 + Math.floor(Math.random() * 15);
        const tax = Math.round(subtotal * 0.05);
        const total = subtotal + deliveryFee + tax;

        const timestamp = Date.now().toString().slice(-4);
        const random = Math.floor(100 + Math.random() * 900);
        const orderId = `GRO-${timestamp}${random}`;

        const createdAt = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));

        groceryOrders.push({
            order_id: orderId,
            orderId: orderId,
            userId: userId,
            items: orderItems,
            deliveryAddress: {
                label: address.label,
                name: customer.name,
                fullName: customer.name,
                street: address.street,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode,
                phone: customer.phone,
            },
            customerName: customer.name,
            customerPhone: customer.phone,
            pricing: {
                subtotal, tax, deliveryFee, packagingFee: 5, platformFee: 3, discount: 0, total, currency: 'INR',
            },
            payment: {
                method: payMethod,
                status: payMethod === 'cash' ? 'cod_pending' : 'paid',
            },
            orderStatus: status,
            dispatch: { modeAtCreation: 'auto', status: 'unassigned' },
            deliveryState: { currentPhase: 'en_route_to_pickup' },
            statusHistory: [{ at: createdAt, byRole: 'USER', from: '', to: 'created', note: 'Order placed' }],
            note: '',
            createdAt,
            updatedAt: createdAt,
        });
    }

    await groceryOrderCollection.insertMany(groceryOrders);
    console.log(`   ✓ Inserted ${groceryOrders.length} realistic grocery orders`);

    // ─────────── DONE ───────────
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL DONE! Summary:');
    console.log(`   📁 ${foodCatIds.length} Food Categories`);
    console.log(`   🍛 ${foodIds.length} Food Items (with real images)`);
    console.log(`   📁 ${groceryCatIds.length} Grocery Categories`);
    console.log(`   📦 ${groceryIds.length} Grocery Products (with real images)`);
    console.log(`   📋 ${foodOrders.length} Food Orders (realistic)`);
    console.log(`   🛍️  ${groceryOrders.length} Grocery Orders (realistic)`);
    console.log('='.repeat(60));

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
