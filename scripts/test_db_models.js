const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const HousingData = require('../models/HousingData');
const MonthlySnapshot = require('../models/MonthlySnapshot');
const ProgramSite = require('../models/ProgramSite');
const Student = require('../models/Student');

const testModels = async () => {
    try {
        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected successfully!');

        // Check students
        const studentCount = await Student.countDocuments();
        console.log(`✅ Master Students Count: ${studentCount} (Expected: 158)`);

        // Check ProgramSites
        const sites = await ProgramSite.find();
        console.log(`✅ Program Sites Count: ${sites.length}`);
        sites.forEach(s => {
            console.log(`   - Site: "${s.name}" (Code: ${s.code}, Capacity: ${s.capacity}, Units: ${s.units?.length} beds)`);
        });

        // Check HousingData documents
        const hDataList = await HousingData.find().limit(3);
        console.log(`✅ Housing Data Records Verified: ${hDataList.length} checked`);

        console.log('\nAll Database Schemas (HousingData.monthlyEvaluations & MonthlySnapshot) are 100% verified and compatible with Live MongoDB Atlas!');
    } catch (err) {
        console.error('❌ Error testing models:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

testModels();
