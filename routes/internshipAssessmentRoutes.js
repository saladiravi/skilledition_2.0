const express = require("express");

const internshipAssessmentRouter = express.Router();

const { createAssessment, getAssessments, createAssessmentSection, getAssessmentSections, createMultipleQuestions, submitAssessmentAnswers, getStudentAssessmentResult, startAssessment, getTodayAssessments, getAssessmentQuestions } = require("../controller/internshipAssessmentController");
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

internshipAssessmentRouter.use(verifyToken)

internshipAssessmentRouter.post(
  "/",
  allowRoles("admin"),
  createAssessment
);

internshipAssessmentRouter.post(
  "/:assessment_id/sections",
  allowRoles("admin"),
  createAssessmentSection
);

internshipAssessmentRouter.post(
  "/sections/:section_id/questions/bulk",
  allowRoles("admin"),
  createMultipleQuestions
);

internshipAssessmentRouter.post(
  "/:assessment_id/submit",
  submitAssessmentAnswers
);

// internshipAssessmentRouter.post(
//   "/:assessment_id/start",
//   startAssessment
// );

internshipAssessmentRouter.post(
  "/:assessment_id/start",
  startAssessment
);

internshipAssessmentRouter.get(
  "/:assessment_id/questions",
  getAssessmentQuestions
);

internshipAssessmentRouter.get(
  "/today-assessments",
  getTodayAssessments
);


internshipAssessmentRouter.get(
  "/:assessment_id/students/:student_id/result",
  getStudentAssessmentResult
);

internshipAssessmentRouter.get(
  "/",
  getAssessments
);

internshipAssessmentRouter.get(
  "/:assessment_id/sections",
  getAssessmentSections
);

module.exports = internshipAssessmentRouter;