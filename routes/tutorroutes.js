const express = require('express');
const router = express.Router();
const tutorcontroller = require('../controller/tutorcontroller');
const uploads = require('../utils/uploadfile');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");


router.post('/addtutorabout', verifyToken, allowRoles("admin", "student", "tutor"), uploads.fields([
  { name: 'profile_pic', maxCount: 10 },

]), tutorcontroller.addtutorAbout);
router.post('/updatetutorprofile', verifyToken, allowRoles("admin", "student", "tutor"), uploads.fields([
  { name: 'profile_pic', maxCount: 10 },
]), tutorcontroller.updateTutorProfilePic);

router.post('/updatetutorabout',verifyToken, allowRoles("admin", "student", "tutor"),tutorcontroller.updateTutorabout);
router.post('/updateTutorProfessionalDetails',verifyToken, allowRoles("admin", "student", "tutor"),tutorcontroller.updateTutorProfessionalDetails);

router.post('/getprofilepic', verifyToken, allowRoles("admin", "student", "tutor"), tutorcontroller.getTutorProfilePic);
router.post('/gettutoronbardbyuserid', verifyToken, allowRoles("admin", "student", "tutor"), tutorcontroller.getTutorOnboarding);
router.post('/addtutorcertificates', verifyToken, allowRoles("admin", "student", "tutor"), uploads.fields([{ name: "certificate_file", maxCount: 20 }]), tutorcontroller.addCertificates);
router.post('/updatetutorcertificates', verifyToken, allowRoles("admin", "student", "tutor"), uploads.fields([{ name: "certificate_file", maxCount: 20 }]), tutorcontroller.updateTutorCertificates);
router.post('/addtutoreducation', verifyToken, allowRoles("admin", "student", "tutor"), tutorcontroller.addEducation);
router.post('/updatetutoreducation', verifyToken, allowRoles("admin", "student", "tutor"), tutorcontroller.updateEducation);

router.post('/adddemovideos', verifyToken, allowRoles("admin", "student", "tutor"), uploads.fields([{ name: "video_file", maxCount: 20 }]), tutorcontroller.addDemoVideo);
router.post('/updateDemovideo', verifyToken, allowRoles("admin", "student", "tutor"), uploads.fields([{ name: "video_file", maxCount: 20 }]), tutorcontroller.updateDemoVideo);
router.post('/updatedemovideodescription', verifyToken, allowRoles("admin", "student", "tutor"), tutorcontroller.updateDemoVideoProfileDetails);
router.post('/updatedemovideoplandetails', verifyToken, allowRoles("admin", "student", "tutor"), uploads.none(), tutorcontroller.updateDemoVideoPlanDetails);

 

router.post('/updatestatus', verifyToken, allowRoles("admin", "student", "tutor"), tutorcontroller.updatestatus);



module.exports = router;

