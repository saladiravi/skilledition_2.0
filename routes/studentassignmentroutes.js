const express=require('express');
const router=express.Router();
const studentassignment=require('../controller/studentassignmentcontroller');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");


router.post('/writeassignment',verifyToken, allowRoles("admin","student","tutor"),studentassignment.writeassignment);
router.post('/gethistroy',verifyToken, allowRoles("admin","student","tutor"),studentassignment.getAttemptHistory);
router.post('/getstudentassignmenthistory',verifyToken, allowRoles("admin","student","tutor"),studentassignment.getassigmenthistroy);


module.exports =router