// routes/userroutes.js
const express = require('express');
const router = express.Router();
const studentController = require('../controller/studentcontroller');
 const uploads = require('../utils/uploadfile');

router.post('/getprofile',verifyToken,allowRoles("admin","student","tutor"),studentController.getprofile);


router.post('/updateprofile', verifyToken,allowRoles("admin","student","tutor"),uploads.fields([
  { name: 'profile_pic', maxCount: 10 },
]), studentController.updateprofile);


module.exports = router;
 