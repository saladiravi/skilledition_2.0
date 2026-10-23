const express = require("express");

const { registerInternshipStudent, loginInternshipStudent, sendForgotPasswordOTP, verifyForgotPasswordOTP, resetForgotPassword } = require("../controller/internshipStudentController");

const internshipStudentRouter = express.Router();

internshipStudentRouter.post("/register", registerInternshipStudent);

internshipStudentRouter.post("/login", loginInternshipStudent);

internshipStudentRouter.post("/send-password-otp", sendForgotPasswordOTP);

internshipStudentRouter.post("/verify-forgot-password-otp", verifyForgotPasswordOTP);

internshipStudentRouter.post("/reset-forgot-password", resetForgotPassword);

module.exports = internshipStudentRouter;