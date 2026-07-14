import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://zinzoox99_db_user:zinzoo123@zinzoo.tzwv8he.mongodb.net/zinzoo';

async function auditDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        const db = mongoose.connection.db;
        
        const collections = await db.listCollections().toArray();
        console.log("Collections count:", collections.length);
        
        for (const col of collections) {
            const count = await db.collection(col.name).countDocuments();
            if (count > 0) {
                console.log(`- ${col.name}: ${count} records`);
            }
        }
        
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}
auditDB();
