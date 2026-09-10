const dotenv = require('dotenv');
const connectDB = require('./config/database');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = require('./app');
const Workshop = require('./models/Workshop');
const Student = require('./models/Student');

const sync = async () => {
    try {
        await Workshop.syncIndexes();
        await Student.syncIndexes();
        console.log('MongoDB Indexes Synced');
    } catch (err) {
        console.error('Index Sync Error:', err);
    }
};
sync();

const PORT = process.env.PORT || 5000;

const server = app.listen(
    PORT,
    console.log(
        `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
    )
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
});
