const Student = require('../models/Student');
const Workshop = require('../models/Workshop');
const User = require('../models/User');
const Organization = require('../models/Organization');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
    try {
        const isStaff = req.user.role === 'staff';
        const filter = { organizationId: req.user.organizationId };
        if (isStaff) filter.assignedStaff = req.user._id;

        const students = await Student.find(filter).sort({ createdAt: -1 });
        const totalWorkshops = await Workshop.countDocuments({ organizationId: req.user.organizationId });
        const organization = await Organization.findById(req.user.organizationId).select('expireDate status');

        const totalStudents = students.length;
        let activeStudents = 0;
        let completedStudents = 0;
        let droppedStudents = 0;
        let secondaryCompletionStudents = 0;
        let totalPointsEarned = 0;
        let maxPossiblePoints = 0;

        const recentActivities = [];

        students.forEach(student => {
            // Count statuses
            if (student.status === 'Active') activeStudents++;
            else if (student.status === 'Completed') completedStudents++;
            else if (student.status === 'Dropped') droppedStudents++;
            else if (student.status === 'Secondary Completion') secondaryCompletionStudents++;

            // Accumulate points for attendance rate
            totalPointsEarned += (student.points || 0);
            maxPossiblePoints += (student.totalPoints || 250);

            // Extract recent activities from attendance
            if (student.attendance && student.attendance.length > 0) {
                student.attendance.forEach(att => {
                    recentActivities.push({
                        id: att._id,
                        name: student.name,
                        workshop: att.workshopName,
                        points: `+${att.pointsEarned}`,
                        // Keep date format as provided, or parse if needed. Assuming 'DD MMM YYYY' from UI
                        date: att.date,
                        timestamp: new Date(att.date).getTime() || 0 // Fallback for sorting if date string parsing fails
                    });
                });
            }
        });

        // Top 5 recent students
        const recentStudents = students.slice(0, 5).map(s => ({
            _id: s._id,
            name: s.name,
            status: s.status,
            points: s.points,
            totalPoints: s.totalPoints || 250
        }));

        // Sort activities by timestamp descending and take top 5
        recentActivities.sort((a, b) => b.timestamp - a.timestamp);
        const topRecentActivities = recentActivities.slice(0, 5);

        // Calculate rates
        const attendanceRate = maxPossiblePoints > 0 ? ((totalPointsEarned / maxPossiblePoints) * 100).toFixed(1) : 0;
        const completionRate = totalStudents > 0 ? (((completedStudents + secondaryCompletionStudents) / totalStudents) * 100).toFixed(1) : 0;

        // Completion Chart Data
        const completionData = [
            { name: 'Active', value: activeStudents },
            { name: 'Inactive', value: droppedStudents },
            { name: 'Completed', value: completedStudents + secondaryCompletionStudents }
        ];

        // Progress Chart Data (Enrollment over last 6 months)
        const progressDataMap = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        // Initialize last 6 months
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            progressDataMap[`${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`] = 0;
        }

        // Count enrollments
        students.forEach(student => {
            if (student.createdAt) {
                const date = new Date(student.createdAt);
                const key = `${monthNames[date.getMonth()]} ${date.getFullYear().toString().substring(2)}`;
                if (progressDataMap[key] !== undefined) {
                    progressDataMap[key]++;
                }
            }
        });

        const progressData = Object.keys(progressDataMap).map(key => ({
            name: key,
            students: progressDataMap[key]
        }));

        res.status(200).json({
            success: true,
            data: {
                totalStudents,
                activeStudents,
                completedStudents: completedStudents + secondaryCompletionStudents,
                totalWorkshops,
                attendanceRate,
                completionRate,
                recentStudents,
                recentActivities: topRecentActivities,
                completionData,
                progressData,
                expiration: organization ? {
                    expireDate: organization.expireDate,
                    status: organization.status
                } : null
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
    getDashboardStats
};
