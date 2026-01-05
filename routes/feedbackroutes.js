const express=require('express');
const router=express.Router();
const feedback=require('../controller/feedbackcontroller');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

router.post('/addfeedback',verifyToken,allowRoles("admin","student","tutor"),feedback.addfeedback); // Post addfeedback API --> student will add feedback

router.post('/delete-feedback',verifyToken,allowRoles("admin","student","tutor"), feedback.deleteFeedback); // Delete feed back API --> student will delete feedback

router.post('/update-feedback', verifyToken,allowRoles("admin","student","tutor"),feedback.updateFeedback); // Update feed back API --> student will update feedback

router.post('/get-tutor-feedbacks',verifyToken,allowRoles("admin","student","tutor"), feedback.getTutorFeedbacks); // Get Tutor Feedback API --> tutor will get all feedbacks from students

router.post('/respond-feedback', verifyToken,allowRoles("admin","student","tutor"),feedback.respondToFeedback); // Get respond Feedback API --> tutor will respond for student feedback

router.post('/get-student-feedbacks', verifyToken,allowRoles("admin","student","tutor"),feedback.getStudentFeedbacks); // Get student feedback API --> student will get the feedback from tutor 

module.exports = router