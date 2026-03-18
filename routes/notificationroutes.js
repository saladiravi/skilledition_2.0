const express=require('express');
const router=express.Router();
const notificationcontroller=require('../controller/notificationcontroller');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");


router.post('/getnotification',verifyToken,allowRoles("admin","student","tutor"),notificationcontroller.getnotification);
router.post('/markNotificationAsRead',verifyToken,allowRoles("admin","student","tutor"),notificationcontroller.markNotificationAsRead);


module.exports=router