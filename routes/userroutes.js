// routes/userroutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controller/usercontroller');
const uploads = require('../utils/uploadfile');


router.post('/adduser', userController.addUser);
router.post('/loginuser',userController.loginUser);
router.post('/getuser',userController.getuser);
router.post('/changePassword',userController.changePassword);
router.post('/getTutorBankDetail',userController.getTutorBankDetails)
router.post('/updatetutorbankdetails',userController.updateTutorBankDetails);

router.post('/getprofile',userController.getProfile)


router.post('/updateprofile', uploads.fields([
  { name: 'profile_pic', maxCount: 10 },
]), userController.updateProfile);


module.exports = router;
