const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkDatabase = async () => {
    try {
        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected successfully to MongoDB Atlas!');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log('\n--- Collections in Database ---');
        for (const col of collections) {
            const count = await db.collection(col.name).countDocuments();
            console.log(`- ${col.name}: ${count} documents`);
        }

        console.log('\nDatabase check completed safely without any modifications.');
    } catch (err) {
        console.error('❌ Database connection error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

checkDatabase();
