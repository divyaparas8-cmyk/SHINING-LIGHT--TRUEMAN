const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        
        const db = mongoose.connection.db;
        
        // The collection name is usually pluralized lower case model name
        const collection = db.collection('housingenrollments');
        
        try {
            await collection.dropIndex('studentId_1_siteId_1');
            console.log('Successfully dropped old unique index: studentId_1_siteId_1');
        } catch (err) {
            if (err.code === 27) {
                console.log('Index not found, maybe already dropped.');
            } else {
                console.error('Error dropping index:', err.message);
            }
        }

        mongoose.connection.close();
    } catch (err) {
        console.error('Connection error:', err);
        process.exit(1);
    }
}

run();
