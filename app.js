const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const userRoutes = require('./routes/userRoutes');
const staffRoutes = require('./routes/staffRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const workshopRoutes = require('./routes/workshopRoutes');
const settingRoutes = require('./routes/settingRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static assets if they exist
app.use(express.static(path.join(__dirname, '../Frontend/dist')));

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/workshops', workshopRoutes);
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/pcp-reports', require('./routes/pcpReportRoutes'));
app.use('/api/settings', settingRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/plans', require('./routes/planRoutes'));
app.use('/api/payment', paymentRoutes);
app.use('/api/housing', require('./routes/housingRoutes'));

// Basic API route
app.get('/api', (req, res) => {
    res.send('RIDSS PROGRAM CRM API is running...');
});

// Explicit SPA fallback for /register and other frontend routes
app.get(['/register', '/login', '/dashboard'], (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/dist/index.html'), (err) => {
        if (err) {
            console.error('Error sending index.html:', err);
            res.status(500).send('Frontend build not found. Please build the frontend.');
        }
    });
});

// Send React app for all other non-API requests (Catch-all)
app.get(/.*/, (req, res, next) => {
    if (req.originalUrl.startsWith('/api/')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../Frontend/dist/index.html'), (err) => {
        if (err) {
            // If it's not an API route and we can't find index.html, just let it 404
            next();
        }
    });
});

// Error Handling Middleware (Basic)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: err.message || 'Server Error'
    });
});

module.exports = app;
