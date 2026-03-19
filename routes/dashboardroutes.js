const express = require('express');
const router = express.Router();
const  dashboard  = require('../controller/dashboardcontroller');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");


router.get('/getadminDashboardStats',verifyToken, allowRoles("admin","student","tutor"),dashboard.getDashboardStats);

module.exports = router