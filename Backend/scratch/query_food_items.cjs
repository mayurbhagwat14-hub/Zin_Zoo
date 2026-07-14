const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://zinzoox99_db_user:zinzoo123@zinzoo.tzwv8he.mongodb.net/zinzoo').then(async () => {
    const db = mongoose.connection.db;
    const items = await db.collection('food_items').find().toArray();
    console.log("Total items:", items.length);
    const dalItems = items.filter(i => i.name && i.name.toLowerCase().includes('dal makhani'));
    console.log("Dal Makhani found:", dalItems.length);
    console.log(JSON.stringify(dalItems, null, 2));
    
    // Check Pizza
    const pizza = items.filter(i => i.name && i.name.toLowerCase().includes('pizza'));
    console.log("Pizza items:", pizza.map(p => ({ name: p.name, approvalStatus: p.approvalStatus, restaurantId: p.restaurantId })));

    process.exit(0);
});
