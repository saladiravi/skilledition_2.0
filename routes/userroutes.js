// routes/userroutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controller/usercontroller');
const uploads = require('../utils/uploadfile');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");


router.post('/adduser', userController.addUser);
router.post('/loginuser',userController.loginUser);
router.post('/getuser',userController.getuser);
router.post('/tutorchangePassword', verifyToken, allowRoles("admin", "student", "tutor"),userController.changePassword);
router.post('/tutorgetTutorBankDetail', verifyToken, allowRoles("admin", "student", "tutor"),userController.getTutorBankDetails)
router.post('/tutorupdatetutorbankdetails', verifyToken, allowRoles("admin", "student", "tutor"),userController.updateTutorBankDetails);

router.post('/tutorgetprofile', verifyToken, allowRoles("admin", "student", "tutor"),userController.getProfile)


router.post('/tutorupdateprofile',  verifyToken, allowRoles("admin", "student", "tutor"),uploads.fields([
  { name: 'profile_pic', maxCount: 10 },
]), userController.updateProfile);


module.exports = router;
