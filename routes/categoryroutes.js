const express=require('express');
const router=express.Router();
const categroycontroller=require('../controller/categorycontroller');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

router.post('/addcategroy', verifyToken, allowRoles("admin","student","tutor"),categroycontroller.addcategory);
router.get('/getcategory', verifyToken, allowRoles("admin","student","tutor"),categroycontroller.getcategory);
router.post('/getcategorybyid',verifyToken, allowRoles("admin","student","tutor"),categroycontroller.getcategorybyid);
router.post('/deletecategory',verifyToken, allowRoles("admin","student","tutor"),categroycontroller.delcategory);
router.post('/updatecategory',verifyToken, allowRoles("admin","student","tutor"),categroycontroller.updatecategory);


module.exports =router