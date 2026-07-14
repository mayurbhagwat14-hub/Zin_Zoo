import mongoose from 'mongoose';
import { config } from './src/config/env.js';
import { AccessoriesCategory } from './src/modules/accessories/models/accessoriesCategory.model.js';
import { AccessoriesProduct } from './src/modules/accessories/models/accessoriesProduct.model.js';
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
        await AccessoriesCategory.deleteMany({});
        await AccessoriesProduct.deleteMany({});

        const cats = [
            { name: 'Watches', img: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&q=80' },
            { name: 'Bags & Backpacks', img: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80' },
            { name: 'Jewelry', img: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=80' },
            { name: 'Sunglasses', img: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400&q=80' },
            { name: 'Tech Accessories', img: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&q=80' },
        ];

        console.log('Uploading categories...');
        const catMap = {};
        for (const c of cats) {
            const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const url = await upload(c.img, 'accessories/categories', slug);
            const doc = await AccessoriesCategory.create({ name: c.name, image: url, isActive: true });
            catMap[c.name] = doc;
        }

        const items = [
            // Watches
            { cat: 'Watches', name: 'Classic Leather Watch', price: 2500, unit: '1 pc', desc: 'Elegant watch with brown leather strap.', img: 'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=400&q=80' },
            { cat: 'Watches', name: 'Silver Steel Chronograph', price: 4500, unit: '1 pc', desc: 'Premium stainless steel chronograph watch.', img: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=400&q=80' },
            { cat: 'Watches', name: 'Minimalist Black Dial', price: 1800, unit: '1 pc', desc: 'Sleek black dial with matte finish.', img: 'https://images.unsplash.com/photo-1509048191080-d2984bad6ae5?w=400&q=80' },
            { cat: 'Watches', name: 'Gold Tone Luxury Watch', price: 6000, unit: '1 pc', desc: 'Luxurious gold-tone analog watch.', img: 'https://images.unsplash.com/photo-1587925358603-c2eea5305bbc?w=400&q=80' },
            { cat: 'Watches', name: 'Smart Fitness Band', price: 1200, unit: '1 pc', desc: 'Track your steps, heart rate, and sleep.', img: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400&q=80' },
            { cat: 'Watches', name: 'Sport Digital Watch', price: 900, unit: '1 pc', desc: 'Durable, water-resistant digital watch.', img: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&q=80' },
            { cat: 'Watches', name: 'Rose Gold Women\'s Watch', price: 3200, unit: '1 pc', desc: 'Beautiful rose gold watch for women.', img: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?w=400&q=80' },
            { cat: 'Watches', name: 'Vintage Pocket Watch', price: 1500, unit: '1 pc', desc: 'Classic antique-style pocket watch.', img: 'https://images.unsplash.com/photo-1501162946741-4960f913dcb2?w=400&q=80' },
            { cat: 'Watches', name: 'Automatic Skeleton Watch', price: 8500, unit: '1 pc', desc: 'Exquisite automatic watch revealing inner mechanics.', img: 'https://images.unsplash.com/photo-1585123334904-845d60e97b29?w=400&q=80' },
            { cat: 'Watches', name: 'Nylon Strap Casual Watch', price: 600, unit: '1 pc', desc: 'Everyday casual watch with colorful nylon strap.', img: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80' },

            // Bags
            { cat: 'Bags & Backpacks', name: 'Leather Messenger Bag', price: 3500, unit: '1 pc', desc: 'Genuine leather messenger bag for office.', img: 'https://images.unsplash.com/photo-1547949003-9792a18a2601?w=400&q=80' },
            { cat: 'Bags & Backpacks', name: 'Canvas Travel Backpack', price: 1800, unit: '1 pc', desc: 'Durable canvas backpack for short trips.', img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80' },
            { cat: 'Bags & Backpacks', name: 'Women\'s Tote Bag', price: 1200, unit: '1 pc', desc: 'Spacious and stylish everyday tote bag.', img: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=400&q=80' },
            { cat: 'Bags & Backpacks', name: 'Laptop Sleeve 15"', price: 800, unit: '1 pc', desc: 'Protective sleeve for 15-inch laptops.', img: 'https://images.unsplash.com/photo-1603313011101-320f66a4f360?w=400&q=80' },
            { cat: 'Bags & Backpacks', name: 'Hiking Backpack 40L', price: 4200, unit: '1 pc', desc: 'Large backpack designed for trekking and hiking.', img: 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=400&q=80' },
            { cat: 'Bags & Backpacks', name: 'Crossbody Sling Bag', price: 950, unit: '1 pc', desc: 'Compact sling bag for essentials.', img: 'https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?w=400&q=80' },
            { cat: 'Bags & Backpacks', name: 'Designer Handbag', price: 5500, unit: '1 pc', desc: 'Premium designer handbag for special occasions.', img: 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=400&q=80' },
            { cat: 'Bags & Backpacks', name: 'Gym Duffel Bag', price: 1100, unit: '1 pc', desc: 'Spacious duffel bag with shoe compartment.', img: 'https://images.unsplash.com/photo-1553456558-aff63285bdd1?w=400&q=80' },
            { cat: 'Bags & Backpacks', name: 'Anti-Theft Backpack', price: 2200, unit: '1 pc', desc: 'Secure backpack with hidden zippers.', img: 'https://images.unsplash.com/photo-1546394411-9a7c39d897dc?w=400&q=80' },
            { cat: 'Bags & Backpacks', name: 'Drawstring Gym Bag', price: 300, unit: '1 pc', desc: 'Lightweight drawstring bag for quick workouts.', img: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&q=80' },

            // Jewelry
            { cat: 'Jewelry', name: 'Diamond Solitaire Ring', price: 15000, unit: '1 pc', desc: 'Stunning 1-carat diamond ring in white gold.', img: 'https://images.unsplash.com/photo-1605100804763-247f67b2548e?w=400&q=80' },
            { cat: 'Jewelry', name: 'Gold Chain Necklace', price: 8000, unit: '1 pc', desc: '24k pure gold chain, elegant and durable.', img: 'https://images.unsplash.com/photo-1599643478514-4a11011d789e?w=400&q=80' },
            { cat: 'Jewelry', name: 'Pearl Earrings', price: 2500, unit: '1 pair', desc: 'Classic freshwater pearl stud earrings.', img: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&q=80' },
            { cat: 'Jewelry', name: 'Silver Charm Bracelet', price: 1800, unit: '1 pc', desc: 'Sterling silver bracelet with unique charms.', img: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&q=80' },
            { cat: 'Jewelry', name: 'Emerald Pendant', price: 4500, unit: '1 pc', desc: 'Beautiful green emerald set in a gold pendant.', img: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=400&q=80' },
            { cat: 'Jewelry', name: 'Men\'s Tungsten Ring', price: 1200, unit: '1 pc', desc: 'Scratch-resistant tungsten carbide ring for men.', img: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=400&q=80' },
            { cat: 'Jewelry', name: 'Boho Layered Necklace', price: 600, unit: '1 pc', desc: 'Trendy multi-layered bohemian necklace.', img: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=400&q=80' },
            { cat: 'Jewelry', name: 'Hoop Earrings Gold', price: 1500, unit: '1 pair', desc: 'Large gold-plated hoop earrings.', img: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=400&q=80' },
            { cat: 'Jewelry', name: 'Sapphire Promise Ring', price: 5500, unit: '1 pc', desc: 'Elegant blue sapphire promise ring.', img: 'https://images.unsplash.com/photo-1605100805128-4bb83577e3fb?w=400&q=80' },
            { cat: 'Jewelry', name: 'Beaded Anklet', price: 300, unit: '1 pc', desc: 'Colorful handmade beaded ankle bracelet.', img: 'https://images.unsplash.com/photo-1615178652432-841498b584a4?w=400&q=80' },

            // Sunglasses
            { cat: 'Sunglasses', name: 'Classic Aviator Sunglasses', price: 1200, unit: '1 pc', desc: 'Timeless aviator design with UV protection.', img: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400&q=80' },
            { cat: 'Sunglasses', name: 'Wayfarer Black Shades', price: 900, unit: '1 pc', desc: 'Iconic black wayfarer sunglasses.', img: 'https://images.unsplash.com/photo-1572635196237-14b3f281501f?w=400&q=80' },
            { cat: 'Sunglasses', name: 'Round Retro Glasses', price: 1500, unit: '1 pc', desc: 'Vintage round frames with tinted lenses.', img: 'https://images.unsplash.com/photo-1508296695146-257a814050b4?w=400&q=80' },
            { cat: 'Sunglasses', name: 'Polarized Sports Glasses', price: 2200, unit: '1 pc', desc: 'High-performance polarized sunglasses for outdoor activities.', img: 'https://images.unsplash.com/photo-1559564484-e48b3e040ff4?w=400&q=80' },
            { cat: 'Sunglasses', name: 'Oversized Women\'s Shades', price: 1800, unit: '1 pc', desc: 'Glamorous oversized sunglasses for women.', img: 'https://images.unsplash.com/photo-1582142339217-b1274f886f44?w=400&q=80' },
            { cat: 'Sunglasses', name: 'Cat Eye Sunglasses', price: 1100, unit: '1 pc', desc: 'Trendy cat-eye frames with mirror lenses.', img: 'https://images.unsplash.com/photo-1577803645773-f96470509666?w=400&q=80' },
            { cat: 'Sunglasses', name: 'Clubmaster Style Glasses', price: 1400, unit: '1 pc', desc: 'Classic half-frame clubmaster sunglasses.', img: 'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=400&q=80' },
            { cat: 'Sunglasses', name: 'Mirrored Aviators', price: 1600, unit: '1 pc', desc: 'Aviator frames with blue mirrored lenses.', img: 'https://images.unsplash.com/photo-1509695507497-903c140c43b0?w=400&q=80' },
            { cat: 'Sunglasses', name: 'Wooden Frame Sunglasses', price: 2500, unit: '1 pc', desc: 'Eco-friendly bamboo wood frame sunglasses.', img: 'https://images.unsplash.com/photo-1589148967919-48c081e749e7?w=400&q=80' },
            { cat: 'Sunglasses', name: 'Clear Frame Glasses', price: 800, unit: '1 pc', desc: 'Modern transparent frame sunglasses.', img: 'https://images.unsplash.com/photo-1625591342279-d59665bc758c?w=400&q=80' },

            // Tech Accessories
            { cat: 'Tech Accessories', name: 'Wireless Earbuds', price: 3500, unit: '1 pair', desc: 'High-fidelity truly wireless earbuds with noise cancellation.', img: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&q=80' },
            { cat: 'Tech Accessories', name: 'Fast Charging Power Bank', price: 1500, unit: '1 pc', desc: '10000mAh power bank with fast charging support.', img: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&q=80' },
            { cat: 'Tech Accessories', name: 'Mechanical Keyboard', price: 4200, unit: '1 pc', desc: 'RGB backlit mechanical keyboard with blue switches.', img: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=400&q=80' },
            { cat: 'Tech Accessories', name: 'Wireless Mouse', price: 800, unit: '1 pc', desc: 'Ergonomic wireless optical mouse.', img: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&q=80' },
            { cat: 'Tech Accessories', name: 'USB-C Hub Multiport', price: 2100, unit: '1 pc', desc: '7-in-1 Type-C hub with HDMI, USB 3.0, and SD reader.', img: 'https://images.unsplash.com/photo-1621252179027-94459d278660?w=400&q=80' },
            { cat: 'Tech Accessories', name: 'Phone Stand Aluminum', price: 450, unit: '1 pc', desc: 'Sturdy adjustable aluminum stand for smartphones.', img: 'https://images.unsplash.com/photo-1585842880017-d57b3227faaf?w=400&q=80' },
            { cat: 'Tech Accessories', name: 'Over-Ear Headphones', price: 2800, unit: '1 pc', desc: 'Comfortable over-ear headphones with deep bass.', img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80' },
            { cat: 'Tech Accessories', name: 'Smartwatch Strap', price: 350, unit: '1 pc', desc: 'Silicone replacement strap for smartwatches.', img: 'https://images.unsplash.com/photo-1579811216948-6f57c19376a5?w=400&q=80' },
            { cat: 'Tech Accessories', name: 'Webcam 1080p', price: 1900, unit: '1 pc', desc: 'Full HD webcam with built-in microphone for streaming.', img: 'https://images.unsplash.com/photo-1620295324209-7d312be03ff1?w=400&q=80' },
            { cat: 'Tech Accessories', name: 'Laptop Cooling Pad', price: 1200, unit: '1 pc', desc: 'Dual-fan cooling pad for laptops up to 17 inches.', img: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=400&q=80' }
        ];

        console.log(`\nUploading ${items.length} product images to Cloudinary...`);
        for (let i = 0; i < items.length; i++) {
            const p = items[i];
            const cat = catMap[p.cat];
            if (!cat) continue;
            const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const url = await upload(p.img, 'accessories/products', slug);
            await AccessoriesProduct.create({
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
