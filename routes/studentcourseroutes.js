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
router.get('/getadminPurchaseList',verifyToken,allowRoles("admin","student","tutor"),studentcourse.getadminPurchaseList)


router.post('/buycourse',studentcourse.initiatePayment);
router.post('/callback',studentcourse.paymentCallback);

// For showing user a success/failure page after payment
router.get(
  '/payment/redirect/:transactionId',
  async (req, res) => {

    const { transactionId } = req.params;

    console.log(
      "Transaction ID:",
      transactionId
    );

    try {

      const result = await pool.query(
        `
        SELECT status
        FROM tbl_student_course
        WHERE transaction_id = $1
        `,
        [transactionId]
      );

      console.log(
        "DB Result:",
        result.rows
      );

      if (result.rows.length === 0) {

        return res
          .status(404)
          .send("Transaction not found");
      }

      const status =
        result.rows[0].status;

      console.log(
        "Payment Status:",
        status
      );

      if (status === "SUCCESS") {
        return res.send(
          "🎉 Payment Successful!"
        );
      }

      if (status === "FAILED") {
        return res.send(
          "❌ Payment Failed."
        );
      }

      return res.send(
        "⏳ Payment Pending..."
      );

    } catch (err) {

      console.error(
        "Redirect Error:",
        err
      );

      return res.status(500).send(`
        <h2>Redirect Error</h2>
        <pre>${err.message}</pre>
      `);
    }
});


module.exports=router