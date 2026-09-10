const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Student = require('./models/Student');
const User = require('./models/User');

dotenv.config();

const testCreate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const staff = await User.findOne({ role: 'staff' });

        const student = new Student({
            name: "Test Student",
            phone: "123456789",
            email: "test@example.com",
            assignedStaff: staff ? staff._id : new mongoose.Types.ObjectId()
        });

        // Trigger validation manually
        await student.validate();
        await student.save();

        console.log("Successfully saved student:", student);
        process.exit(0);
    } catch (error) {
        console.error("Test Error:", error);
        process.exit(1);
    }
}

testCreate();
