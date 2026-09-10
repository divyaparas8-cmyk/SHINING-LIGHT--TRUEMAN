const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Organization = require('./models/Organization');
const SubscriptionPlan = require('./models/SubscriptionPlan');

dotenv.config();

const seedUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for seeding');

        // Create a default plan
        let defaultPlan = await SubscriptionPlan.findOne({ planName: 'Enterprise' });
        if (!defaultPlan) {
            defaultPlan = await SubscriptionPlan.create({
                planName: 'Enterprise',
                price: 1500,
                studentLimit: 5000,
                features: ['Unlimited Students', 'Advanced Analytics', 'priority Support', 'White Labeling']
            });
            console.log('Default plan created');
        }

        // Create a default organization
        let defaultOrg = await Organization.findOne({ name: 'Shining Light HQ' });
        if (!defaultOrg) {
            // We'll link the admin below
            defaultOrg = await Organization.create({
                name: 'Shining Light HQ',
                planId: defaultPlan._id,
                status: 'Active'
            });
            console.log('Default organization created');
        }

        // Check if Super Admin exists
        let superAdmin = await User.findOne({ email: 'superadmin@gmail.com' });
        if (!superAdmin) {
            await User.create({
                name: 'Super Administrator',
                email: 'superadmin@gmail.com',
                password: '123',
                role: 'super_admin'
            });
            console.log('Super Admin user created');
        }

        // Check if admin exists
        let adminUser = await User.findOne({ email: 'admin@gmail.com' });
        if (!adminUser) {
            adminUser = await User.create({
                name: 'System Admin',
                email: 'admin@gmail.com',
                password: '123',
                role: 'admin',
                organizationId: defaultOrg._id
            });
            console.log('Admin user created');
            
            // Link admin to organization
            defaultOrg.adminUserId = adminUser._id;
            await defaultOrg.save();
        }

        // Check if staff exists
        let staffUser = await User.findOne({ email: 'staff@gmail.com' });
        if (!staffUser) {
            await User.create({
                name: 'System Staff',
                email: 'staff@gmail.com',
                password: '123',
                role: 'staff',
                organizationId: defaultOrg._id
            });
            console.log('Staff user created');
        }

        console.log('Data successfully seeded!');
        process.exit();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

seedUsers();
