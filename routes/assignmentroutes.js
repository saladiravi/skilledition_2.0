const express=require('express');
const router=express.Router();
const assignment=require('../controller/assignmentcontroller');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");


router.post('/addassignment',verifyToken, allowRoles("admin","student","tutor"),assignment.addasignment);
router.post('/updateAssignment',verifyToken, allowRoles("admin","student","tutor"),assignment.updateAssignment);
router.get('/getassignments',verifyToken, allowRoles("admin","student","tutor"),assignment.getAssignments);
router.post('/getassignmentById',verifyToken, allowRoles("admin","student","tutor"),assignment.getAssignmentById);
router.post('/addassignmentquestions',verifyToken, allowRoles("admin","student","tutor"),assignment.addassignmentquestion);
router.post('/getassignmentdetails',verifyToken, allowRoles("admin","student","tutor"),assignment.getassignmentsdetails);

router.post('/getTutorAssignmentDetails',verifyToken, allowRoles("admin","student","tutor"),assignment.getTutorAssignmentDetails)

router.post('/addAssignmentWithQuestions',verifyToken, allowRoles("admin","student","tutor"),assignment.addAssignmentWithQuestions);
router.post('/updaterejectquestions',verifyToken, allowRoles("admin","student","tutor"),assignment.rejectQuestion);
router.post('/getRejectedQuestions',verifyToken, allowRoles("admin","student","tutor"),assignment.getRejectedQuestions);
router.post('/updateRejectedQuestions',verifyToken, allowRoles("admin","student","tutor"),assignment.updateRejectedQuestions);
router.post('/deleteAssignment',verifyToken, allowRoles("admin","student","tutor"),assignment.deleteAssignmentIfPending);




module.exports=router;
