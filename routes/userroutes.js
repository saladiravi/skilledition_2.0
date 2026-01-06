// routes/userroutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controller/usercontroller');

router.post('/adduser', userController.addUser);
router.post('/loginuser',userController.loginUser);
router.post('/getuser',userController.getuser);
router.post('/changePassword',userController.changePassword);
router.post('/getTutorBankDetail',userController.getTutorBankDetails)
router.post('/updatetutorbankdetails',userController.updateTutorBankDetails);



module.exports = router;
