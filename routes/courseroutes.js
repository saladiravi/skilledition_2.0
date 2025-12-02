const express = require('express');
const router = express.Router();
const upload = require('../utils/uploadfile');
const  Course  = require('../controller/coursecontroller');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");


router.post('/addcourse',verifyToken, allowRoles("admin","student","tutor"),Course.addcourse);
router.post('/updatecourse',verifyToken, allowRoles("admin","student","tutor"),upload.fields([
    { name: "course_image", maxCount: 1 }]),Course.updatecourse);
router.post('/getcoursebytutor',verifyToken, allowRoles("admin","student","tutor"),Course.getcourseBytutor);
router.get('/getcoursewithmodules',verifyToken, allowRoles("admin","student","tutor"),Course.getcoursewithmoduledetails);
router.post('/getcoursemodulebyId',verifyToken, allowRoles("admin","student","tutor"),Course.getcoursemoduleById);
router.post('/add-module',upload.fields([
    { name: "sheet_file", maxCount: 1 },
    { name: "video_files", maxCount: 20 }]),verifyToken, allowRoles("admin","student","tutor"), Course.addmodulewithvideos);

router.post('/updatemodulevideostatus',verifyToken, allowRoles("admin","student","tutor"),Course.updatestatus);


module.exports = router;
