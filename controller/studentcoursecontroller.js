const pool = require('../config/db');
const { getSignedVideoUrl } = require('../utils/s3upload');


exports.studentbuycourse = async (req, res) => {
  const { course_id, student_id } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert purchase
    await client.query(`
      INSERT INTO tbl_student_course (student_id, course_id)
      VALUES ($1, $2)
    `, [student_id, course_id]);

    // 2. Insert progress for all videos (locked by default)
    await client.query(`
      INSERT INTO tbl_student_course_progress
        (student_id, course_id, module_id, module_video_id, is_unlocked, is_completed)
      SELECT
        $1,
        tm.course_id,
        tm.module_id,
        tmv.module_video_id,
        false, -- locked by default
        false
      FROM tbl_module tm
      JOIN tbl_module_videos tmv ON tm.module_id = tmv.module_id
      WHERE tm.course_id = $2
    `, [student_id, course_id]);

    // 3. Unlock first video of first module
    await client.query(`
      UPDATE tbl_student_course_progress
      SET is_unlocked = true,
          is_unlocked_at = NOW()
      WHERE student_id = $1
        AND course_id = $2
        AND module_video_id = (
          SELECT tmv.module_video_id
          FROM tbl_module tm
          JOIN tbl_module_videos tmv ON tm.module_id = tmv.module_id
          WHERE tm.course_id = $2
          ORDER BY tm.module_id, tmv.module_video_id
          LIMIT 1
        )
    `, [student_id, course_id]);

    await client.query('COMMIT');

    return res.status(200).json({
      statusCode: 200,
      message: 'Course purchased successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
    });
  } finally {
    client.release();
  }
};


exports.getStudentMyCourse = async (req, res) => {
  const { student_id } = req.body;

  try {
    if (!student_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "student_id is required"
      });
    }

    const result = await pool.query(
      `
      SELECT 
        tsc.student_course_id,
        tsc.student_id,
        tsc.course_id,
        tc.course_title,
        tc.course_description,
         tc.price
      FROM tbl_student_course tsc
      JOIN tbl_course tc 
        ON tsc.course_id = tc.course_id
      WHERE tsc.student_id = $1
      `,
      [student_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "No courses found for this student"
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Fetched Successfully",
      result: result.rows
    });

  } catch (error) {
    console.error("getStudentMyCourse Error:", error);

    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};

exports.getAllCoursesWithEnrollStatus = async (req, res) => {
  const { student_id } = req.body;

  try {
    if (!student_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "student_id is required"
      });
    }

    const result = await pool.query(`
      SELECT
        tc.course_id,
        tc.course_title,
        tc.course_description,
        tc.price,

        EXISTS (
          SELECT 1 
          FROM tbl_student_course tsc
          WHERE tsc.course_id = tc.course_id
          AND tsc.student_id = $1
        ) AS is_enrolled

      FROM tbl_course tc
       WHERE status='Published'
      ORDER BY tc.course_id DESC
    `, [student_id]);

    return res.status(200).json({
      statusCode: 200,
      message: "Fetched Successfully",
      result: result.rows
    });

  } catch (error) {
    console.error("getAllCoursesWithEnrollStatus Error:", error);

    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};

exports.getstudentcourse = async (req, res) => {
  const { course_id, student_id } = req.body;

  try {
    const { rows } = await pool.query(`
      SELECT
        tc.course_id,
        tc.course_title,
        tc.no_of_modules,
        tc.duration,

        tm.module_id,
        tm.module_title,

        tmv.module_video_id,
        tmv.video_title,

        ta.assignment_id,
        ta.assignment_title,

        COALESCE(tsp.is_unlocked, false) AS is_unlocked,
        COALESCE(tsp.is_completed, false) AS is_completed,

        COUNT(tmv.module_video_id) OVER() AS total_videos,
        COUNT(
          CASE WHEN tsp.is_completed = true THEN 1 END
        ) OVER() AS completed_videos

      FROM tbl_course tc
      JOIN tbl_module tm
        ON tc.course_id = tm.course_id
      LEFT JOIN tbl_module_videos tmv
        ON tm.module_id = tmv.module_id
      LEFT JOIN tbl_assignment ta
        ON tm.module_id = ta.module_id
      LEFT JOIN tbl_student_course_progress tsp
        ON tsp.module_video_id = tmv.module_video_id
       AND tsp.student_id = $2
       AND tsp.course_id = tc.course_id
      WHERE tc.course_id = $1
     
    `, [course_id, student_id]);

    if (rows.length === 0) {
      return res.json({
        statusCode: 200,
        data: null
      });
    }

    // 🔹 Overall progress
    const totalVideos = Number(rows[0].total_videos);
    const completedVideos = Number(rows[0].completed_videos);

    const progressPercentage =
      totalVideos === 0
        ? 0
        : Math.round((completedVideos / totalVideos) * 100);

    // 🔹 Base course object
    const course = {
      course_id: rows[0].course_id,
      course_title: rows[0].course_title,
      no_of_modules: rows[0].no_of_modules,
      duration: rows[0].duration,
      progress: {
        total_videos: totalVideos,
        completed_videos: completedVideos,
        percentage: progressPercentage
      },
      modules: []
    };

    // 🔹 Build modules + videos
    const moduleMap = {};

    for (const row of rows) {
      // create module if not exists
      if (!moduleMap[row.module_id]) {
        moduleMap[row.module_id] = {
          module_id: row.module_id,
          module_title: row.module_title,
          assignment: row.assignment_id
            ? {
              assignment_id: row.assignment_id,
              assignment_title: row.assignment_title
            }
            : null,
          videos: []
        };

        course.modules.push(moduleMap[row.module_id]);
      }

      // add video
      if (row.module_video_id) {
        moduleMap[row.module_id].videos.push({
          module_video_id: row.module_video_id,
          video_title: row.video_title,
          is_unlocked: row.is_unlocked,
          is_completed: row.is_completed
        });
      }
    }

    return res.json({
      statusCode: 200,
      data: course
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
    });
  }
};


exports.studentwatchvideo = async (req, res) => {
  const { student_id, module_video_id } = req.body;

  if (!module_video_id || !student_id) {
    return res.status(401).json({
      statusCode: 401,
      message: 'Missing Required Field'
    });
  }

  try {
    // 1. Check lock status
    const lockCheck = await pool.query(`
      SELECT is_unlocked
      FROM tbl_student_course_progress
      WHERE student_id = $1
      AND module_video_id = $2
    `, [student_id, module_video_id]);

    // If no record found OR locked
    if (lockCheck.rows.length === 0 || lockCheck.rows[0].is_unlocked === False) {
      return res.status(403).json({
        statusCode: 403,
        message: 'Video is locked. Complete previous videos to unlock.'
      });
    }

    // 2. If unlocked → fetch video
    const data = await pool.query(`
      SELECT module_video_id, video, video_title
      FROM tbl_module_videos
      WHERE module_video_id = $1
    `, [module_video_id]);

        if (data.rows.length === 0) {
              return res.status(404).json({
                statusCode: 404,
                message: 'Video not found'
              });
            }

     const videoData = data.rows[0];

   
    const signedUrl = await getSignedVideoUrl(videoData.video);

   
    videoData.video = signedUrl;
    return res.status(200).json({
      statusCode: 200,
      message: 'Fetched Successfully',
       result: videoData
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
    });
  }
};



exports.submitExam = async (req, res) => {
  try {

    const { assignment_id, student_id, answers } = req.body;

    /* ✅ Check if already submitted */
    const checkQuery = `
      SELECT student_assignment_id
      FROM tbl_student_assignment
      WHERE assignment_id=$1
        AND student_id=$2
        AND status='Completed'
    `;

    const checkResult = await pool.query(checkQuery, [
      assignment_id,
      student_id
    ]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        message: "Exam already submitted"
      });
    }

    /* ✅ Create student assignment FIRST */
    const insertAssignment = `
      INSERT INTO tbl_student_assignment
      (
        assignment_id,
        student_id,
        status
      )
      VALUES ($1,$2,'Completed')
      RETURNING student_assignment_id
    `;

    const assignResult = await pool.query(
      insertAssignment,
      [assignment_id, student_id]
    );

    // 🎯 Auto generated ID
    const student_assignment_id =
      assignResult.rows[0].student_assignment_id;

    let totalMarks = 0;

    /* ✅ Save Answers */
    for (let ans of answers) {

      const qRes = await pool.query(
        `SELECT answer FROM tbl_questions WHERE question_id=$1`,
        [ans.question_id]
      );

      if (!qRes.rows.length) continue;

      const correct = qRes.rows[0].answer;

      const isCorrect = ans.selected_answer === correct;

      if (isCorrect) totalMarks++;

      await pool.query(`
        INSERT INTO tbl_student_answers
        (
          student_assignment_id,
          question_id,
          selected_answer,
          correct_answer,
          is_correct
        )
        VALUES ($1,$2,$3,$4,$5)
      `, [
        student_assignment_id,
        ans.question_id,
        ans.selected_answer,
        correct,
        isCorrect
      ]);
    }

    /* ✅ Update Marks */
    await pool.query(`
      UPDATE tbl_student_assignment
      SET total_marks=$1
      WHERE student_assignment_id=$2
    `, [
      totalMarks,
      student_assignment_id
    ]);

    res.json({
      success: true,
      student_assignment_id,
      marks: totalMarks
    });

  } catch (err) {
    console.error("Submit Exam Error:", err);
    res.status(500).json({ success: false });
  }
};




