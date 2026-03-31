// routes/userroutes.js
const express = require('express');
const router = express.Router();
const studentController = require('../controller/studentcontroller');
 const uploads = require('../utils/uploadfile');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const {studentvalidateProfilePic} =require('../utils/validatefiles');

router.post('/getprofile',verifyToken,allowRoles("admin","student","tutor"),studentController.getprofile);

router.post(
  '/updateprofile',verifyToken,allowRoles("admin","student","tutor"),
  uploads.single('profile_image'),studentvalidateProfilePic, 
  studentController.updateprofile
);

router.post('/studentdashboardlock',verifyToken,allowRoles("admin","student","tutor"),studentController.getStudentAccess
);

module.exports = router;
 