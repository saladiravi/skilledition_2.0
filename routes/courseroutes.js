const express = require('express');
const router = express.Router();
const  Course  = require('../controller/coursecontroller');
const upload = require('../utils/uploadfile');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");


router.post('/addcourse',verifyToken, allowRoles("admin","student","tutor"),Course.addcourse);
router.post('/updatecourse',verifyToken, allowRoles("admin","student","tutor"),upload.fields([
    { name: "course_image", maxCount: 1 }]),Course.updatecourse);
router.post('/getcoursebytutor',verifyToken, allowRoles("admin","student","tutor"),Course.getcourseBytutor);
router.get('/getcoursewithmodules',verifyToken, allowRoles("admin","student","tutor"),Course.getcoursewithmoduledetails);
router.post('/getcoursemodulebyId',verifyToken, allowRoles("admin","student","tutor"),Course.getcoursemoduleById);
 
router.post(
  "/add-module",
  upload.any(),verifyToken, allowRoles("admin","student","tutor"),
  Course.addModulesWithVideos
);
router.post('/updatemodulevideostatus',verifyToken, allowRoles("admin","student","tutor"),Course.updatestatus);
router.post('/gettotalcourse',verifyToken, allowRoles("admin","student","tutor"),Course.gettotalcourse);
router.post('/getmodulebyid',verifyToken, allowRoles("admin","student","tutor"),Course.getvideosbymoduleid);
 
router.post(
  "/update-module-videos",
 upload.fields([
  { name: "video_files", maxCount: 10 },
  { name: "sheet_file", maxCount: 1 }
]),verifyToken, allowRoles("admin","student","tutor"),
  Course.updateModuleVideos
);
router.post('/getvideos',verifyToken, allowRoles("admin","student","tutor"),Course.getvideos);
router.post('/deletecourse',verifyToken,allowRoles("admin","student","tutor"),Course.deleteCourse);
router.post('/deletemodule',verifyToken,allowRoles("admin","student","tutor"),Course.deleteModule);
router.post('/getTutorCoursesWithModules',verifyToken,allowRoles("admin","student","tutor"),Course.getTutorCoursesWithModules);

module.exports = router;
