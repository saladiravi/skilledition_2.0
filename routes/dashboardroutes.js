const express = require('express');
const router = express.Router();
const  dashboard  = require('../controller/dashboardcontroller');


router.post('/addcourse',verifyToken, allowRoles("admin","student","tutor"),dashboard.getDashboardStats);

module.exports = router