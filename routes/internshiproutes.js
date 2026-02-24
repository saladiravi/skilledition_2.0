const express=require('express')
const router=express.Router();
const internship=require('../controller/intenshipcontroller');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

router.post("/submitintership",verifyToken,allowRoles("admin","student","tutor"),internship.addinternship);

router.post('/getintership',verifyToken,allowRoles("admin","student","tutor"),internship.getinternship)
router.post('/gettotalinternship',verifyToken,allowRoles("admin","student","tutor"),internship.gettotalinternship)


module.exports =router


