const mongoose = require('mongoose');
const { getPublicApprovedRestaurantMenu } = require('./src/modules/food/restaurant/services/restaurantMenu.service.js');
const { FoodItem } = require('./src/modules/food/admin/models/food.model.js');
const { FoodRestaurant } = require('./src/modules/food/restaurant/models/restaurant.model.js');
const { FoodCategory } = require('./src/modules/food/admin/models/category.model.js');

mongoose.connect('mongodb+srv://zinzoox99_db_user:zinzoo123@zinzoo.tzwv8he.mongodb.net/zinzoo').then(async () => {
    try {
        const menu = await getPublicApprovedRestaurantMenu('apna-sweets');
        console.log("Menu returned:", menu ? true : false);
        if (menu) {
            console.log("Categories:", menu.categories.map(c => c.name));
            console.log("Total Sections:", menu.sections.length);
            const dalSection = menu.sections.find(s => s.name === 'North Indian Food');
            console.log("North Indian Food section found:", dalSection ? true : false);
            if (dalSection) {
                console.log("Items in North Indian Food:", dalSection.items.map(i => i.name));
            }
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
});
