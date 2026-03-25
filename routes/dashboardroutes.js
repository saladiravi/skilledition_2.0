const express = require('express');
const router = express.Router();
const  dashboard  = require('../controller/dashboardcontroller');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");


router.get('/getadminDashboardStats',verifyToken, allowRoles("admin","student","tutor"),dashboard.getDashboardStats);
router.post('/getTutoranalyticsDashboard',verifyToken, allowRoles("admin","student","tutor"),dashboard.getTutoranalyticsDashboard);
router.post('/studentperformancetutordashboard',verifyToken, allowRoles("admin","student","tutor"),dashboard.studentperformancetutordashboard);

module.exports = router