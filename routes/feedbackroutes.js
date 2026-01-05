const express=require('express');
const router=express.Router();
const feedback=require('../controller/feedbackcontroller');

router.post('/addfeedback',feedback.addfeedback); // Post addfeedback API --> student will add feedback

router.post('/delete-feedback', feedback.deleteFeedback); // Delete feed back API --> student will delete feedback

router.post('/update-feedback', feedback.updateFeedback); // Update feed back API --> student will update feedback

router.post('/get-tutor-feedbacks', feedback.getTutorFeedbacks); // Get Tutor Feedback API --> tutor will get all feedbacks from students

router.post('/respond-feedback', feedback.respondToFeedback); // Get respond Feedback API --> tutor will respond for student feedback

router.post('/get-student-feedbacks', feedback.getStudentFeedbacks); // Get student feedback API --> student will get the feedback from tutor 

module.exports = router