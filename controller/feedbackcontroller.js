const con = require('../config/db');

exports.addfeedback = async (req, res) => {
  try {
    const { student_id, tutor_id, course_id, rating, enjoy_most, review} = req.body;

    if (!student_id || !tutor_id || !rating) {
      return res.status(400).json({
        statusCode:400,
        message: "student_id, tutor_id and rating are required"
      });
    }

    const studentCheck = await con.query(
      `SELECT role FROM tbl_user WHERE user_id = $1`,
      [student_id]
    );

    if (
      studentCheck.rows.length === 0 ||
      studentCheck.rows[0].role !== 'student'
    ) {
      return res.status(400).json({
        statusCode:400,
        message: "Invalid student_id"
      });
    }

    const tutorCheck = await con.query(
      `SELECT role FROM tbl_user WHERE user_id = $1`,
      [tutor_id]
    );

    if (
      tutorCheck.rows.length === 0 ||
      tutorCheck.rows[0].role !== 'tutor'
    ) {
      return res.status(400).json({
        statusCode:400,
        message: "Invalid tutor_id"
      });
    }

    const result = await con.query(`INSERT INTO tbl_feedback (student_id, tutor_id, course_id, rating, enjoy_most, review) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [ student_id, tutor_id, course_id || null, rating, enjoy_most || null, review || null ]
    );

    return res.status(200).json({
      statusCode:200,
      message: "Feedback added successfully",
      data: result.rows[0]
    });

  } catch (error) {
 
    return res.status(500).json({
      statusCode:500,
      message: "Internal server error"
    });
  }
};

exports.deleteFeedback = async (req, res) => {
  try {
    const { feedback_id } = req.body;

    if (!feedback_id) {
      return res.status(400).json({
        statusCode:400,
        message: "feedback_id is required"
      });
    }

    const check = await con.query(`SELECT feedback_id FROM tbl_feedback WHERE feedback_id = $1`,
      [feedback_id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        statusCode:404,
        message: "Feedback not found"
      });
    }

    await con.query(`DELETE FROM tbl_feedback WHERE feedback_id = $1`,
      [feedback_id]
    );

    return res.status(200).json({
      statusCode:200,
      message: "Feedback deleted successfully"
    });

  } catch (error) {
     
    return res.status(500).json({
      statusCode:500,
      message: "Internal server error"
    });
  }
};

exports.updateFeedback = async (req, res) => {
  try {
    const { feedback_id, rating, enjoy_most, review } = req.body;

    if (!feedback_id) {
      return res.status(400).json({
        statusCode:400,
        message: "feedback_id is required"
      });
    }

    if (rating === undefined && enjoy_most === undefined && review === undefined) {
      return res.status(400).json({
        statusCode:400,
        message: "At least one field (rating, enjoy_most, review) is required to update"
      });
    }

    const result = await con.query(`UPDATE tbl_feedback SET rating = COALESCE($1, rating), enjoy_most = COALESCE($2, enjoy_most), review = COALESCE($3, review) WHERE feedback_id = $4 RETURNING *`,
      [rating, enjoy_most, review, feedback_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        statusCode:404,
        message: "Feedback not found"
      });
    }

    return res.status(200).json({
      statusCode:200,
      message: "Feedback updated successfully",
      data: result.rows[0]
    });

  } catch (error) {
   
    return res.status(500).json({
      statusCode:'500',
      message: "Internal server error"
    });
  }
};

exports.getTutorFeedbacks = async (req, res) => {
  try {
    const { tutor_id } = req.body;

    if (!tutor_id) {
      return res.status(400).json({
         statusCode:400,
        message: "tutor_id is required"
      });
    }

     const feedbackResult = await con.query(`SELECT f.feedback_id, f.rating, f.enjoy_most, f.review, f.response, f.feedback_created_at, u.user_id AS student_id, u.full_name AS student_name, c.course_id, c.course_title FROM tbl_feedback f JOIN tbl_user u ON f.student_id = u.user_id LEFT JOIN tbl_course c ON f.course_id = c.course_id WHERE f.tutor_id = $1 ORDER BY f.feedback_id DESC`,
      [tutor_id]
    );

    const ratingResult = await con.query(`SELECT COUNT(*) FILTER (WHERE rating = 5) AS total_5_rating, COUNT(*) FILTER (WHERE rating = 4) AS total_4_rating, COUNT(*) FILTER (WHERE rating = 3) AS total_3_rating, COUNT(*) FILTER (WHERE rating = 2) AS total_2_rating, COUNT(*) FILTER (WHERE rating = 1) AS total_1_rating FROM tbl_feedback WHERE tutor_id = $1`,
      [tutor_id]
    );

    return res.status(200).json({
      statusCode:200,
      message: "Tutor feedbacks fetched successfully",
      total_feedbacks: feedbackResult.rows.length,
      rating_summary: ratingResult.rows[0],
      data: feedbackResult.rows
    });

  } catch (error) {
   
    return res.status(500).json({
       statusCode:500,
      message: "Internal server error"
    });
  }
};

exports.respondToFeedback = async (req, res) => {
  try {
    const { feedback_id, response } = req.body;

    if (!feedback_id || !response) {
      return res.status(400).json({
        statusCode:400,
        message: "feedback_id and response are required"
      });
    }

    const result = await con.query(`UPDATE tbl_feedback SET response = $1 WHERE feedback_id = $2`,
      [response, feedback_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode:404,
        message: "Feedback not found"
      });
    }

    return res.status(200).json({
      statusCode:200,
      message: "Updated Successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("RESPOND FEEDBACK ERROR 🔴:", error);
    return res.status(500).json({
      statusCode:500,
      message: "Internal server error"
    });
  }
};


exports.getStudentFeedbacks = async (req, res) => {
  try {
    const { student_id } = req.body;

    if (!student_id) {
      return res.status(400).json({
        message: "student_id is required"
      });
    }

    const result = await con.query(`SELECT f.feedback_id, f.rating, f.enjoy_most, f.review, f.response, f.feedback_created_at, u.user_id AS tutor_id, u.full_name AS tutor_name, c.course_id, c.course_title FROM tbl_feedback f JOIN tbl_user u ON f.tutor_id = u.user_id LEFT JOIN tbl_course c ON f.course_id = c.course_id WHERE f.student_id = $1 ORDER BY f.feedback_created_at DESC`,
      [student_id]
    );

    return res.status(200).json({
      message: "Student feedbacks fetched successfully",
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error("GET STUDENT FEEDBACKS ERROR 🔴:", error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
};


exports.getStudentCoursefeedback = async (req, res) => {
  try {
    const { student_id, course_id } = req.body;

    if (!student_id || !course_id) {
      return res.status(400).json({
        message: "student_id and course_id are required"
      });
    }

    const result = await con.query(
      `
      SELECT 
        c.course_id,
        c.course_title,
        c.course_description,
       
        c.no_of_modules,
    

        u.user_id AS tutor_id,
        u.full_name AS tutor_name,

        -- TOTAL COURSE VIDEO DURATION
        COALESCE(
          SUM(
            EXTRACT(EPOCH FROM mv.video_duration::interval)
          ), 0
        ) AS total_duration_seconds,

        f.feedback_id,
        f.rating,
        f.review

      FROM tbl_course c

      JOIN tbl_user u 
        ON c.tutor_id = u.user_id

      LEFT JOIN tbl_module m
        ON m.course_id = c.course_id

      LEFT JOIN tbl_module_videos mv
        ON mv.module_id = m.module_id
        AND mv.status = 'Approved'

      LEFT JOIN tbl_feedback f 
        ON f.course_id = c.course_id 
        AND f.student_id = $1

      WHERE c.course_id = $2

      GROUP BY 
        c.course_id,
        u.user_id,
        f.feedback_id
      `,
      [student_id, course_id]
    );

    return res.status(200).json({
      statusCode:200,
      message: "Fetched successfully",
      data: result.rows[0] || null
    });

  } catch (error) {
    console.log(error)
    return res.status(500).json({
      statusCode:500,
      message: "Internal server error"
    });
  }
};