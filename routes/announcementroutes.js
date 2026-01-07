const express=require('express');
const router=express.Router();
const announcement=require('../controller/announcementcontroller');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");


router.post('/createanouncement', verifyToken, allowRoles("admin", "student", "tutor"),announcement.createAnnouncement);
router.post('/getStudentAnnouncements', verifyToken, allowRoles("admin", "student", "tutor"),announcement.getStudentAnnouncements);
router.post('/getTutorAnnouncements', verifyToken, allowRoles("admin", "student", "tutor"),announcement.getTutorAnnouncements);
router.post('/updateAnnouncement', verifyToken, allowRoles("admin", "student", "tutor"),announcement.updateAnnouncement);
router.post('/deleteAnnouncement', verifyToken, allowRoles("admin", "student", "tutor"),announcement.deleteAnnouncement);

 

module.exports =router;
