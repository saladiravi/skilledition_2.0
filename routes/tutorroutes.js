const express=require('express');
const router=express.Router();
const tutorcontroller=require('../controller/tutorcontroller');
const uploads=require('../utils/uploadfile');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");


router.post('/tutoronboarding', verifyToken, allowRoles("admin","student","tutor"),uploads.fields([
    { name: 'profile_pic', maxCount: 10 },
 
  ]),tutorcontroller.addTutoronboard);
router.post('/updatetutorprofile',verifyToken, allowRoles("admin","student","tutor"),uploads.fields([
    { name: 'profile_pic', maxCount: 10 },
 
  ]),tutorcontroller.updateTutorProfilePic);

  
router.post('/getprofilepic',verifyToken, allowRoles("admin","student","tutor"),tutorcontroller.getTutorProfilePic);
 router.post('/tutorgetonbardbyuserid',verifyToken, allowRoles("admin","student","tutor"),tutorcontroller.getTutorOnboarding);
 router.post('/addtutorcertificates', verifyToken, allowRoles("admin","student","tutor"),uploads.fields([{ name: "certificate_file", maxCount: 20 }]),tutorcontroller.addCertificates);
 router.post('/addtutoreducation',verifyToken, allowRoles("admin","student","tutor"),tutorcontroller.addEducation);
 router.post('/adddemovideos', verifyToken, allowRoles("admin","student","tutor"),uploads.fields([{ name: "video_file", maxCount: 20 }]),tutorcontroller.addDemoVideo);
 router.post('/updateDemovideo', verifyToken, allowRoles("admin","student","tutor"),uploads.fields([{ name: "video_file", maxCount: 20 }]),tutorcontroller.updateDemoVideo);
 router.post('/updatedemovideoprofiledetails',verifyToken, allowRoles("admin","student","tutor"),tutorcontroller.updateDemoVideoProfileDetails);
 router.post('/updatedemovideoplandetails',verifyToken, allowRoles("admin","student","tutor"), uploads.none(),tutorcontroller.updateDemoVideoPlanDetails);
 
 router.post('/updatetutoronboarding', verifyToken, allowRoles("admin","student","tutor"),uploads.fields([
    { name: 'profile_pic', maxCount: 10 },
  ]),tutorcontroller.updateTutor);
  
 router.post('/updatestatus',verifyToken, allowRoles("admin","student","tutor"),tutorcontroller.updatestatus);


module.exports=router; 

