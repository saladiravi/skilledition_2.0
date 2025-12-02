const express=require('express');
const router=express.Router();
const studentcourse=require('../controller/studentcoursecontroller');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");



router.post('/buycourse',verifyToken, allowRoles("admin","student","tutor"),studentcourse.studentbuycourse);
router.post('/getcoursebystudent',verifyToken, allowRoles("admin","student","tutor"),studentcourse.getstudentcourse);
router.post('/getmodulebycourse',verifyToken, allowRoles("admin","student","tutor"),studentcourse.getcoursemodule);
router.post('/getvideosbymodule',verifyToken, allowRoles("admin","student","tutor"),studentcourse.getvideobymodule)

module.exports=router