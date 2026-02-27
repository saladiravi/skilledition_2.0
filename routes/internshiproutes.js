const express=require('express')
const router=express.Router();
const internship=require('../controller/intenshipcontroller');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const upload = require('../utils/uploadfile');

router.post("/submitintership",verifyToken,allowRoles("admin","student","tutor"),internship.addinternship);

router.post('/getintership',verifyToken,allowRoles("admin","student","tutor"),internship.getinternship)
router.get('/gettotalinternship',verifyToken,allowRoles("admin","student","tutor"),internship.gettotalinternship)

router.post(
  "/updateInternship",
  verifyToken,
  allowRoles("admin", "student", "tutor"),
  upload.fields([
    { name: "intership_certificate", maxCount: 1 }
  ]),
  internship.updateInternship
);

module.exports =router


