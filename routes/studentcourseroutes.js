const express=require('express');
const router=express.Router();
const pool = require('../config/db');
const studentcourse=require('../controller/studentcoursecontroller');
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");



router.post('/buyscourse',verifyToken,allowRoles("admin","student","tutor"),studentcourse.studentbuycourse);
router.post('/getstudentmycourse',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getStudentMyCourse);
router.post('/getAllCoursesWithEnrollStatus',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getAllCoursesWithEnrollStatus);
router.post('/getstudentcourse',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getstudentcourse);
router.post('/studentwatchvideo',verifyToken,allowRoles("admin","student","tutor"),studentcourse.studentwatchvideo);
router.post('/submitExam',verifyToken,allowRoles("admin","student","tutor"),studentcourse.submitExam);
router.post('/updateWatchProgress',verifyToken,allowRoles("admin","student","tutor"),studentcourse.updateWatchProgress)
router.post('/unlockAssignmentAfterModule',verifyToken,allowRoles("admin","student","tutor"),studentcourse.unlockAssignmentAfterModule)

router.post('/writeExam',verifyToken,allowRoles("admin","student","tutor"),studentcourse.writeExam)
router.post('/getexamstudent',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getexamstudent)
router.post('/getAssignmentById',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getAssignmentById)
router.post('/getfinalquestions',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getfinalquestions)
router.post('/writeFinalExam',verifyToken,allowRoles("admin","student","tutor"),studentcourse.writeFinalExam)
router.post('/getfinalexamresult',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getfinalexamresult)
router.post('/getstudentassignmentresult',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getstudentassignmentresult)
router.post('/unlockfinalassignment',verifyToken,allowRoles("admin","student","tutor"),studentcourse.unlockfinalassignment)


router.post('/updatedtime',verifyToken,allowRoles("admin","student","tutor"),studentcourse.updatedtime)

router.post('/getcourseenroleDetails',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getCourseenroleDetails)
router.post('/getstudentoverview',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getstudentoverview)

router.get('/getadminstudentmanagement',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getadminstudentmanagement)
router.post('/getadminstudentmanagementbyid',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getadminstudentmanagementbyid)
router.post('/getPurchaseList',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getPurchaseList)

router.post('/getPurchaseInvoice',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getPurchaseInvoice)


 
router.post('/buycourse',studentcourse.initiatePayment);
router.post('/callback',studentcourse.paymentCallback);
router.post('/verifyPayment',studentcourse.verifyPayment);

// For showing user a success/failure page after payment
router.get('/test/payment/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cashfree Payment Test</title>
      <script src="https://sdk.cashfree.com/js/ui/2.0.0/cashfree.js"></script>
    </head>
    <body>
      <h2>Testing Cashfree Payment</h2>
      <button id="payBtn">Pay Now</button>

      <script>
        document.addEventListener("DOMContentLoaded", function () {
          // Wait for SDK to load
          if (typeof Cashfree === "undefined") {
            console.error("❌ Cashfree SDK not loaded");
            alert("Cashfree SDK failed to load. Check your internet connection.");
            return;
          }

          const cashfree = Cashfree({ mode: "sandbox" }); // or "production"

          document.getElementById("payBtn").addEventListener("click", () => {
            cashfree.checkout({
              paymentSessionId: "${sessionId}",
              redirectTarget: "_self"
            });
          });
        });
      </script>
    </body>
    </html>
  `;

  res.send(html);
});
module.exports=router