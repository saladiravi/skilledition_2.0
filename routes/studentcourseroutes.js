const express=require('express');
const router=express.Router();
const studentcourse=require('../controller/studentcoursecontroller');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");



router.post('/buycourse',verifyToken,allowRoles("admin","student","tutor"),studentcourse.studentbuycourse);
router.post('/getstudentmycourse',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getStudentMyCourse);
router.post('/getAllCoursesWithEnrollStatus',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getAllCoursesWithEnrollStatus);
router.post('/getstudentcourse',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getstudentcourse);
router.post('/studentwatchvideo',verifyToken,allowRoles("admin","student","tutor"),studentcourse.studentwatchvideo);
router.post('/submitExam',verifyToken,allowRoles("admin","student","tutor"),studentcourse.submitExam);
router.post('/updateWatchProgress',verifyToken,allowRoles("admin","student","tutor"),studentcourse.updateWatchProgress)
router.post('/unlockAssignmentAfterModule',verifyToken,allowRoles("admin","student","tutor"),studentcourse.unlockAssignmentAfterModule)

router.post('/getexamstudent',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getexamstudent)

module.exports=router