const express=require('express');
const router=express.Router();
const notificationcontroller=require('../controller/notificationcontroller');



router.post('/getnotification',notificationcontroller.getnotification);


module.exports=router