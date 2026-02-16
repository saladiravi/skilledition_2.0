const pool = require('../config/db');
const { getSignedVideoUrl } = require('../utils/s3upload');


function timeToSeconds(time) {
  if (!time) return 0;

  const parts = time.split(':').map(Number);

  if (parts.some(isNaN)) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return Number(time) || 0;
}

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

    await client.query(`
        INSERT INTO tbl_student_course_progress
          (student_id, course_id, module_id, module_video_id, assignment_id, is_unlocked, is_completed)
        SELECT
          $1,
          tm.course_id,
          tm.module_id,
          NULL,
          ta.assignment_id,
          false,
          false
        FROM tbl_module tm
        JOIN tbl_assignment ta ON tm.module_id = ta.module_id
        WHERE tm.course_id = $2
      `, [student_id, course_id]);


    // 3. Unlock first video of first module
    await client.query(`
      UPDATE tbl_student_course_progress
      SET is_unlocked = true,
          unlocked_at = NOW()
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


    await createFinalAssignment(client, student_id, course_id);


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
        tc.price,
        tc.level,

        tc.category_id,
        cat.category_name

      FROM tbl_student_course tsc

      JOIN tbl_course tc 
        ON tsc.course_id = tc.course_id

      JOIN tbl_category cat
        ON tc.category_id = cat.category_id

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
        tc.level,
        tc.category_id,
        cat.category_name,

        tsc.student_course_id,

        CASE 
          WHEN tsc.student_course_id IS NOT NULL 
          THEN true 
          ELSE false 
        END AS is_enrolled

      FROM tbl_course tc

      JOIN tbl_category cat
        ON tc.category_id = cat.category_id

      LEFT JOIN tbl_student_course tsc
        ON tsc.course_id = tc.course_id
       AND tsc.student_id = $1

      WHERE tc.status = 'Published'

      /* ✅ ALL assignments must be Published */
      AND NOT EXISTS (
        SELECT 1
        FROM tbl_assignment ta
        WHERE ta.course_id = tc.course_id
          AND ta.status <> 'Published'
      )

      /* optional: ensure course HAS assignments */
      AND EXISTS (
        SELECT 1
        FROM tbl_assignment ta
        WHERE ta.course_id = tc.course_id
      )

      ORDER BY tc.course_id ASC
    `, [student_id]);

    return res.status(200).json({
      statusCode: 200,
      message: "Fetched Successfully",
      result: result.rows
    });

  } catch (error) {
    console.error(error);
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
   

    tm.module_id,
    tm.module_title,
    tm.module_description,
    tm.sheet_file,
    tm.total_duration,

    tmv.module_video_id,
    tmv.video,
    tmv.video_title,

    ta.assignment_id,
    ta.assignment_title,

    tu.full_name,
    tt.subject_to_teach,
    tt.professional_background,

    COALESCE(tsp.is_unlocked, false) AS is_unlocked,
    COALESCE(tsp.is_completed, false) AS is_completed,

    COALESCE(tspa.is_unlocked, false) AS assignment_is_unlocked,
      tspa.unlocked_at AS assignment_unlocked_at,
      COALESCE(tspa.is_completed, false) AS assignment_is_completed,

    COUNT(tmv.module_video_id) OVER() AS total_videos,
     TO_CHAR(
    SUM(tmv.video_duration::INTERVAL) OVER (),
    'HH24:MI:SS'
  ) AS total_video_duration,
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

    LEFT JOIN tbl_student_course_progress tspa
      ON tspa.assignment_id = ta.assignment_id
      AND tspa.student_id = $2
      AND tspa.course_id = tc.course_id

  JOIN tbl_user tu
    ON tc.tutor_id = tu.user_id

  /* ✅ FIX */
  LEFT JOIN tbl_tutor tt
    ON tc.tutor_id = tt.user_id

  WHERE tc.course_id = $1
  ORDER BY 
  tm.module_id ASC,
  tmv.module_video_id ASC
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
    const totalVideoDuration = rows[0].total_video_duration;
    const progressPercentage =
      totalVideos === 0
        ? 0
        : Math.round((completedVideos / totalVideos) * 100);

    // 🔹 Base course object
    const course = {
      course_id: rows[0].course_id,
      course_title: rows[0].course_title,
      total_video_duration: totalVideoDuration,
      no_of_modules: rows[0].no_of_modules,
      tutor_name: rows[0].full_name,
      subject_to_teach: rows[0].subject_to_teach,
      professional_background: rows[0].professional_background,
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

      if (!moduleMap[row.module_id]) {

        const signedSheet = row.sheet_file
          ? await getSignedVideoUrl(row.sheet_file)
          : null;

        moduleMap[row.module_id] = {
          module_id: row.module_id,
          module_title: row.module_title,
          module_description: row.module_description,
          total_duration: row.total_duration,
          sheet_file: row.sheet_file,
          sheet_file_url: signedSheet,
          videos: [],
          assignment: row.assignment_id
            ? {
              assignment_id: row.assignment_id,
              assignment_title: row.assignment_title,
              is_unlocked: row.assignment_is_unlocked,
              is_completed: row.assignment_is_completed,
              unlocked_at: row.assignment_unlocked_at
            }
            : null,
        };

        course.modules.push(moduleMap[row.module_id]);
      }

      if (row.module_video_id) {

        let videoUrl = null;

        if (row.is_unlocked && row.video) {
          videoUrl = await getSignedVideoUrl(row.video);
        }

        moduleMap[row.module_id].videos.push({
          module_video_id: row.module_video_id,
          video_title: row.video_title,
          video_url: videoUrl,
          is_unlocked: row.is_unlocked,
          is_completed: row.is_completed
        });
      }
    }

    return res.status(200).json({
      statusCode: 200,
      message: 'Fetched Sucessfully',
      data: course
    });

  } catch (error) {

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
    if (lockCheck.rows.length === 0 || lockCheck.rows[0].is_unlocked === false) {
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
      message: 'watched sucessfully',
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


exports.updateWatchProgress = async (req, res) => {

  const { student_id, module_video_id, watched } = req.body;

  if (!student_id || !module_video_id || watched == null) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Missing Required Fields'
    });
  }

  try {

    /* ============================
       1. Get Video Info
    ============================*/

    const videoRes = await pool.query(`
      SELECT module_id, video_duration
      FROM tbl_module_videos
      WHERE module_video_id = $1
    `, [module_video_id]);

    if (videoRes.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Video not found'
      });
    }

    const { module_id, video_duration } = videoRes.rows[0];


    /* ============================
       2. Convert Time
    ============================*/

    const watchedSeconds = timeToSeconds(watched);
    const durationSeconds = timeToSeconds(video_duration);


    /* ============================
       3. Update Watched
    ============================*/

    await pool.query(`
      UPDATE tbl_student_course_progress
      SET watched = $1
      WHERE student_id = $2
      AND module_video_id = $3
    `, [watched, student_id, module_video_id]);


    /* ============================
       4. Check Completed
    ============================*/

    const isCompleted =
      watchedSeconds + 2 >= durationSeconds;


    if (!isCompleted) {

      return res.status(200).json({
        statusCode: 200,
        message: 'Progress Updated'
      });
    }


    /* ============================
       5. Mark Completed
    ============================*/

    await pool.query(`
      UPDATE tbl_student_course_progress
      SET is_completed = true,
          completed_at = NOW()
      WHERE student_id = $1
      AND module_video_id = $2
    `, [student_id, module_video_id]);


    /* ============================
       6. Get Video List
    ============================*/

    const listRes = await pool.query(`
      SELECT module_video_id
      FROM tbl_module_videos
      WHERE module_id = $1
      ORDER BY module_video_id
    `, [module_id]);

    const ids = listRes.rows.map(v => Number(v.module_video_id));

    const index = ids.indexOf(Number(module_video_id));


    /* ============================
       7. Unlock Next Video
    ============================*/

    if (index !== -1 && index + 1 < ids.length) {

      const nextId = ids[index + 1];


      const check = await pool.query(`
        SELECT student_course_progress_id
        FROM tbl_student_course_progress
        WHERE student_id = $1
        AND module_video_id = $2
      `, [student_id, nextId]);


      if (check.rows.length === 0) {

        await pool.query(`
          INSERT INTO tbl_student_course_progress
          (student_id, course_id, module_id, module_video_id, is_unlocked)
          SELECT
            $1,
            course_id,
            module_id,
            $2,
            true
          FROM tbl_student_course_progress
          WHERE student_id = $1
          AND module_video_id = $3
          LIMIT 1
        `, [student_id, nextId, module_video_id]);

      } else {

        await pool.query(`
          UPDATE tbl_student_course_progress
          SET is_unlocked = true,
              unlocked_at = NOW()
          WHERE student_id = $1
          AND module_video_id = $2
        `, [student_id, nextId]);
      }
    }


    /* ============================
     8. Check ALL Videos Completed
  ============================ */

    const allCompletedRes = await pool.query(`
        SELECT
          COUNT(*) AS total_videos,
          COUNT(
            CASE WHEN is_completed = true THEN 1 END
          ) AS completed_videos
        FROM tbl_student_course_progress
        WHERE student_id = $1
          AND module_id = $2
          AND module_video_id IS NOT NULL
      `, [student_id, module_id]);

    const { total_videos, completed_videos } = allCompletedRes.rows[0];

    const allVideosCompleted =
      Number(total_videos) > 0 &&
      Number(total_videos) === Number(completed_videos);

    /* ============================
     9. Unlock Assignment
  ============================ */

    if (allVideosCompleted) {

      await pool.query(`
    UPDATE tbl_student_course_progress
    SET is_unlocked = true,
        unlocked_at = NOW()
    WHERE student_id = $1
      AND module_id = $2
      AND assignment_id IS NOT NULL
  `, [student_id, module_id]);
    }

    return res.status(200).json({
      statusCode: 200,
      message: 'Video Completed & Next Unlocked'
    });


  } catch (err) {

    console.error(err);

    return res.status(500).json({
      statusCode: 500,
      message: 'Server Error'
    });
  }
};


exports.unlockAssignmentAfterModule = async (req, res) => {

  const { student_id, module_id } = req.body;

  if (!student_id || !module_id) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Missing Required Fields'
    });
  }

  try {

    /* ============================
       1. Check All Videos Completed
    ============================*/

    const checkRes = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_completed = true) AS done
      FROM tbl_student_course_progress
      WHERE student_id = $1
      AND module_id = $2
      AND module_video_id IS NOT NULL
    `, [student_id, module_id]);

    const { total, done } = checkRes.rows[0];

    if (Number(total) === 0) {
      return res.status(400).json({
        statusCode: 400,
        message: 'No videos in this module'
      });
    }

    if (Number(total) !== Number(done)) {
      return res.status(400).json({
        statusCode: 400,
        message: 'All videos not completed yet'
      });
    }


    /* ============================
       2. Get Assignment ID (FIXED)
    ============================*/

    const assignRes = await pool.query(`
      SELECT assignment_id
      FROM tbl_assignment
      WHERE module_id = $1
    `, [module_id]);

    if (assignRes.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'No Assignment Found For This Module'
      });
    }

    const assignmentId = assignRes.rows[0].assignment_id;


    /* ============================
       3. Check Progress Row
    ============================*/

    const checkAssign = await pool.query(`
      SELECT student_course_progress_id
      FROM tbl_student_course_progress
      WHERE student_id = $1
      AND assignment_id = $2
    `, [student_id, assignmentId]);


    /* ============================
       4. Insert / Update
    ============================*/

    if (checkAssign.rows.length === 0) {

      // Insert if not exists
      await pool.query(`
        INSERT INTO tbl_student_course_progress
        (student_id, course_id, module_id, assignment_id, is_unlocked, unlocked_at)
        SELECT
          $1,
          course_id,
          module_id,
          $2,
          true,
          NOW()
        FROM tbl_student_course_progress
        WHERE student_id = $1
        AND module_id = $3
        LIMIT 1
      `, [student_id, assignmentId, module_id]);

    } else {

      // Update if exists
      await pool.query(`
        UPDATE tbl_student_course_progress
        SET is_unlocked = true,
            unlocked_at = NOW()
        WHERE student_id = $1
        AND assignment_id = $2
      `, [student_id, assignmentId]);
    }


    /* ============================
       5. Success
    ============================*/

    return res.status(200).json({
      statusCode: 200,
      message: 'Assignment Unlocked Successfully'
    });


  } catch (err) {

    console.error(err);

    return res.status(500).json({
      statusCode: 500,
      message: 'Server Error'
    });
  }
};


// exports.getexamstudent = async (req, res) => {
//   try {
//     const { student_id } = req.body;

//     if (!student_id) {
//       return res.status(400).json({
//         statusCode: 400,
//         message: "student_id is required"
//       });
//     }

//     const result = await pool.query(`
//       SELECT
//         ta.assignment_id,
//         ta.assignment_title,
//         ta.total_questions,

//         ts.is_unlocked,
//         tc.course_title,

//         tsa.student_assignment_id,

//         COALESCE(tsa.status, 'Pending') AS status,
//         COALESCE(tsa.total_marks, 0) AS total_marks,

//         COUNT(CASE WHEN tans.is_correct = true THEN 1 END) AS correct_answers,
//         COUNT(CASE WHEN tans.is_correct = false THEN 1 END) AS wrong_answers,

//         COUNT(*) OVER () AS total_assignments,

//         COUNT(
//           CASE
//             WHEN COALESCE(tsa.status, 'Pending') = 'Pending'
//             THEN 1
//           END
//         ) OVER () AS pending_assignments,

//         COUNT(
//           CASE
//             WHEN tsa.status = 'Completed'
//             THEN 1
//           END
//         ) OVER () AS submitted_assignments

//       FROM tbl_student_course tsc
//       JOIN tbl_course tc
//         ON tsc.course_id = tc.course_id
//       JOIN tbl_assignment ta
//         ON tc.course_id = ta.course_id

//       LEFT JOIN tbl_student_assignment tsa
//         ON ta.assignment_id = tsa.assignment_id
//        AND tsa.student_id = tsc.student_id

//       LEFT JOIN tbl_student_answers tans
//         ON tsa.student_assignment_id = tans.student_assignment_id

//       LEFT JOIN tbl_student_course_progress ts
//         ON ts.assignment_id = ta.assignment_id
//        AND ts.student_id = tsc.student_id

//       WHERE tsc.student_id = $1

//       GROUP BY
//         ta.assignment_id,
//         ta.assignment_title,
//         ta.total_questions,
//         tc.course_title,
//         tsa.student_assignment_id,
//         tsa.status,
//         tsa.total_marks,
//         ts.is_unlocked

//       ORDER BY ta.assignment_id ASC
//     `, [student_id]);

//     if (result.rows.length === 0) {
//       return res.status(200).json({
//         statusCode: 200,
//         data: {
//           counts: {
//             total_assignments: 0,
//             pending_assignments: 0,
//             submitted_assignments: 0
//           },
//           assignment: []
//         }
//       });
//     }



//     // ✅ Extract counts from FIRST row
//     const {
//       total_assignments,
//       pending_assignments,
//       submitted_assignments
//     } = result.rows[0];

//     // ✅ Remove count fields from list items
//     const assignment = result.rows.map(row => {
//       const {
//         total_assignments,
//         pending_assignments,
//         submitted_assignments,
//         ...rest
//       } = row;
//       return rest;
//     });

//     return res.status(200).json({
//       statusCode: 200,
//       message: 'Fetched Successfully',
//       data: {
//         counts: {
//           total_assignments: Number(total_assignments),
//           pending_assignments: Number(pending_assignments),
//           submitted_assignments: Number(submitted_assignments)
//         },
//         assignment
//       }
//     });

//   } catch (error) {
//     console.error("getexamstudent Error:", error);
//     return res.status(500).json({
//       statusCode: 500,
//       message: "Internal Server Error"
//     });
//   }
// };

exports.getexamstudent = async (req, res) => {
  try {
    const { student_id } = req.body;

    if (!student_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "student_id is required"
      });
    }

    /* =======================
       1️⃣ ASSIGNMENTS QUERY
    ======================= */
    const assignmentResult = await pool.query(`
      SELECT
        ta.assignment_id,
        ta.assignment_title,
        ta.total_questions,

        ts.is_unlocked,
        tc.course_title,

        tsa.student_assignment_id,

        COALESCE(tsa.status, 'Pending') AS status,
        COALESCE(tsa.total_marks, 0) AS total_marks,

      CAST(COUNT(CASE WHEN tans.is_correct = true THEN 1 END) AS INTEGER) AS correct_answers,
      CAST(COUNT(CASE WHEN tans.is_correct = false THEN 1 END) AS INTEGER) AS wrong_answers,

        COUNT(*) OVER () AS total_assignments,

        COUNT(
          CASE
            WHEN COALESCE(tsa.status, 'Pending') = 'Pending'
            THEN 1
          END
        ) OVER () AS pending_assignments,

        COUNT(
          CASE
            WHEN tsa.status = 'Completed'
            THEN 1
          END
        ) OVER () AS submitted_assignments

      FROM tbl_student_course tsc
      JOIN tbl_course tc
        ON tsc.course_id = tc.course_id
      JOIN tbl_assignment ta
        ON tc.course_id = ta.course_id

      LEFT JOIN tbl_student_assignment tsa
        ON ta.assignment_id = tsa.assignment_id
       AND tsa.student_id = tsc.student_id

      LEFT JOIN tbl_student_answers tans
        ON tsa.student_assignment_id = tans.student_assignment_id

      LEFT JOIN tbl_student_course_progress ts
        ON ts.assignment_id = ta.assignment_id
       AND ts.student_id = tsc.student_id

      WHERE tsc.student_id = $1

      GROUP BY
        ta.assignment_id,
        ta.assignment_title,
        ta.total_questions,
        tc.course_title,
        tsa.student_assignment_id,
        tsa.status,
        tsa.total_marks,
        ts.is_unlocked

      ORDER BY ta.assignment_id ASC
    `, [student_id]);

    /* =======================
       2️⃣ FINAL ASSIGNMENT QUERY
    ======================= */
    const finalAssignmentResult = await pool.query(`
      SELECT
        tfa.final_assignment_id,
        tc.course_title,
        tfa.assignment_title,
        tfa.total_questions,
        tfa.is_unlocked,
        tfa.unlocked_date,
        tfa.status,
        COALESCE(tfa.correct_answers, 0) AS correct_answers,
        COALESCE(tfa.wrong_answer, 0) AS wrong_answers
        
      FROM tbl_student_final_assignment tfa
      JOIN tbl_course tc
        ON tfa.course_id = tc.course_id
      WHERE tfa.student_id = $1
    `, [student_id]);

    /* =======================
       3️⃣ HANDLE EMPTY CASE
    ======================= */
    if (assignmentResult.rows.length === 0) {
      return res.status(200).json({
        statusCode: 200,
        data: {
          counts: {
            total_assignments: 0,
            pending_assignments: 0,
            submitted_assignments: 0
          },
          assignment: [],
          finalassignment: finalAssignmentResult.rows
        }
      });
    }

    /* =======================
       4️⃣ EXTRACT COUNTS
    ======================= */
    const {
      total_assignments,
      pending_assignments,
      submitted_assignments
    } = assignmentResult.rows[0];

    const assignment = assignmentResult.rows.map(row => {
      const {
        total_assignments,
        pending_assignments,
        submitted_assignments,
        ...rest
      } = row;
      return rest;
    });

    /* =======================
       5️⃣ FINAL RESPONSE
    ======================= */
    return res.status(200).json({
      statusCode: 200,
      message: 'Fetched Successfully',
      data: {
        counts: {
          total_assignments: Number(total_assignments),
          pending_assignments: Number(pending_assignments),
          submitted_assignments: Number(submitted_assignments)
        },
        assignment,
        finalassignment: finalAssignmentResult.rows
      }
    });

  } catch (error) {
    console.error("getexamstudent Error:", error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};


exports.writeExam = async (req, res) => {
  try {
    const { student_id, assignment_id, answers } = req.body;

    // 1️⃣ Get assignment details (module + course)
    const assignmentRes = await pool.query(
      `
      SELECT module_id, course_id
      FROM tbl_assignment
      WHERE assignment_id = $1
      `,
      [assignment_id]
    );

    if (assignmentRes.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Assignment not found"
      });
    }

    const { module_id, course_id } = assignmentRes.rows[0];

    // 2️⃣ Create student assignment entry
    const assignmentResult = await pool.query(
      `
      INSERT INTO tbl_student_assignment
      (assignment_id, student_id, total_marks, status, created_at)
      VALUES ($1, $2, 0, 'IN_PROGRESS', NOW())
      RETURNING student_assignment_id
      `,
      [assignment_id, student_id]
    );

    const student_assignment_id =
      assignmentResult.rows[0].student_assignment_id;

    let totalMarks = 0;

    // 3️⃣ Store answers + calculate marks
    for (let ans of answers) {
      const { question_id, selected_answer } = ans;

      const q = await pool.query(
        `SELECT answer FROM tbl_questions WHERE question_id = $1`,
        [question_id]
      );

      const correct_answer = q.rows[0].answer;
      const is_correct = selected_answer === correct_answer;

      if (is_correct) totalMarks++;

      await pool.query(
        `
        INSERT INTO tbl_student_answers
        (student_assignment_id, question_id, selected_answer, correct_answer, is_correct, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        `,
        [
          student_assignment_id,
          question_id,
          selected_answer,
          correct_answer,
          is_correct
        ]
      );
    }

    // 4️⃣ Update assignment result
    await pool.query(
      `
      UPDATE tbl_student_assignment
      SET total_marks = $1,
          status = 'Completed'
      WHERE student_assignment_id = $2
      `,
      [totalMarks, student_assignment_id]
    );

    // 5️⃣ Mark current module as completed
    await pool.query(
      `
      UPDATE tbl_student_course_progress
      SET is_completed = true,
          completed_at = NOW()
      WHERE student_id = $1
        AND course_id = $2
        AND module_id = $3
        AND assignment_id = $4
      `,
      [student_id, course_id, module_id, assignment_id]
    );

    // 6️⃣ Unlock NEXT module

    // Step 1: Get next module
    const nextModuleRes = await pool.query(
      `
  SELECT module_id
  FROM tbl_student_course_progress
  WHERE student_id = $1
    AND course_id = $2
    AND module_id > $3
  ORDER BY module_id ASC
  LIMIT 1
  `,
      [student_id, course_id, module_id]
    );

    if (nextModuleRes.rows.length > 0) {

      const nextModuleId = nextModuleRes.rows[0].module_id;

      // Step 2: Get first video of next module
      const firstVideoRes = await pool.query(
        `
    SELECT module_video_id
    FROM tbl_module_videos
    WHERE module_id = $1
    ORDER BY module_video_id ASC
    LIMIT 1
    `,
        [nextModuleId]
      );

      if (firstVideoRes.rows.length > 0) {
        const firstVideoId = firstVideoRes.rows[0].module_video_id;

        // Step 3: Unlock that video
        await pool.query(
          `
      UPDATE tbl_student_course_progress
      SET is_unlocked = true,
          unlocked_at = NOW()
      WHERE student_id = $1
        AND course_id = $2
        AND module_video_id = $3
      `,
          [student_id, course_id, firstVideoId]
        );
      }
    }

    res.status(200).json({
      statusCode: 200,
      message: "Exam submitted successfully",
      student_assignment_id,
      total_marks: totalMarks
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};



exports.getAssignmentById = async (req, res) => {
  const { assignment_id } = req.body;

  try {
    // Check assignment exists
    const assignmentData = await pool.query(
      `SELECT * FROM tbl_assignment WHERE assignment_id = $1`,
      [assignment_id]
    );

    if (assignmentData.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Assignment Not Found"
      });
    }

    const assignment = assignmentData.rows[0];
    const fetchdata = await pool.query(`SELECT * FROM tbl_assignment WHERE assignment_id=$1`, [assignment_id]);

    // Fetch questions belonging to this assignment
    const questionData = await pool.query(
      `SELECT question_id, question, a, b, c, d
             FROM tbl_questions 
             WHERE assignment_id = $1
             ORDER BY question_id ASC`,
      [assignment_id]
    );

    const questions = questionData.rows;

    return res.status(200).json({
      statusCode: 200,
      message: "Assignment fetched successfully",
      assignment: {
        assignment_id: assignment.assignment_id,
        assignment_title: assignment.assignment_title,
        questions: questions
      }
    });

  } catch (error) {

    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};



const createFinalAssignment = async (client, student_id, course_id) => {
  try {

    // 1. Create final assignment entry
    const finalAssignmentResult = await client.query(`
  INSERT INTO tbl_student_final_assignment
    (student_id, course_id, assignment_title, created_at, unlocked_date, is_unlocked, status)
  SELECT
    $1::integer,
    $2::integer,
    'Final Assignment',
    NOW(),
    NOW() + (tc.duration || ' days')::INTERVAL,
    false,
    'Pending'
  FROM tbl_course tc
  WHERE tc.course_id = $2::integer
  RETURNING final_assignment_id
`, [student_id, course_id]);

    const final_assignment_id = finalAssignmentResult.rows[0].final_assignment_id;

    // 2. Get all modules
    const modules = await client.query(`
      SELECT module_id
      FROM tbl_module
      WHERE course_id = $1
      ORDER BY module_id
    `, [course_id]);

    let totalInsertedQuestions = 0;

    // 3. Loop modules
    for (const module of modules.rows) {

      const questions = await client.query(`
        SELECT tq.question, tq.a, tq.b, tq.c, tq.d, tq.answer
        FROM tbl_assignment ta
        JOIN tbl_questions tq ON ta.assignment_id = tq.assignment_id
        WHERE ta.course_id = $1
          AND ta.module_id = $2
         
        ORDER BY RANDOM()
        LIMIT 5
      `, [course_id, module.module_id]);

      for (const q of questions.rows) {
        await client.query(`
          INSERT INTO tbl_student_final_assignment_questions
            (final_assignment_id, question, a, b, c, d, answer)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7)
        `, [
          final_assignment_id,
          q.question,
          q.a,
          q.b,
          q.c,
          q.d,
          q.answer
        ]);

        totalInsertedQuestions++;
      }
    }

    // 4. Calculate Timer (1 question = 1 minute)
    const timerMinutes = totalInsertedQuestions; // 1 min per question

    // 5. Update final assignment with totals
    await client.query(`
      UPDATE tbl_student_final_assignment
      SET total_questions = $1,
          total_marks = $1,
          timmer = $2
      WHERE final_assignment_id = $3
    `, [
      totalInsertedQuestions,
      timerMinutes + ' minutes',
      final_assignment_id
    ]);

    return final_assignment_id;

  } catch (error) {
    throw error;
  }
};



exports.getfinalquestions = async (req, res) => {
  const { final_assignment_id } = req.body;

  if (!final_assignment_id) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Missing Required Field'
    });
  }

  try {

    // 1. Check assignment lock status
    const checklock = await pool.query(`
      SELECT is_unlocked
      FROM tbl_student_final_assignment
      WHERE final_assignment_id = $1
    `, [final_assignment_id]);

    if (checklock.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Final assignment not found'
      });
    }

    if (checklock.rows[0].is_unlocked === false) {
      return res.status(403).json({
        statusCode: 403,
        message: 'Exam is locked'
      });
    }
    const assigment = await pool.query(`SELECT is_unlocked ,status,timmer FROM tbl_student_final_assignment WHERE final_assignment_id=$1`, [final_assignment_id])

    // 2. Get Questions & Options
    const questions = await pool.query(`
      SELECT 
        final_assignment_question_id,
        question,
        a,
        b,
        c,
        d
        
      FROM tbl_student_final_assignment_questions
      WHERE final_assignment_id = $1
      ORDER BY final_assignment_question_id
    `, [final_assignment_id]);

    return res.status(200).json({
      statusCode: 200,
      message: 'Questions fetched successfully',
      assignment: assigment.rows,
      data: questions.rows
    });

  } catch (error) {

    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
    });
  }
};


exports.writeFinalExam = async (req, res) => {
  try {
    const { final_assignment_id, answers } = req.body;

    if (!final_assignment_id || !answers || answers.length === 0) {
      return res.status(400).json({
        statusCode: 400,
        message: "Missing required fields"
      });
    }

    // 1️⃣ Check if assignment exists & unlocked
    const assignmentRes = await pool.query(
      `
      SELECT *
      FROM tbl_student_final_assignment
      WHERE final_assignment_id = $1
      `,
      [final_assignment_id]
    );

    if (assignmentRes.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Final assignment not found"
      });
    }

    const assignment = assignmentRes.rows[0];

    if (assignment.is_unlocked === true) {
      return res.status(403).json({
        statusCode: 403,
        message: "Exam is locked"
      });
    }

    if (assignment.status === "Completed") {
      return res.status(400).json({
        statusCode: 400,
        message: "Exam already submitted"
      });
    }

    let correctCount = 0;
    let wrongCount = 0;

    // 2️⃣ Loop answers
    for (let ans of answers) {

      const { final_assignment_question_id, selected_answer } = ans;

      const questionRes = await pool.query(
        `
        SELECT answer
        FROM tbl_student_final_assignment_questions
        WHERE final_assignment_question_id = $1
          AND final_assignment_id = $2
        `,
        [final_assignment_question_id, final_assignment_id]
      );

      if (questionRes.rows.length === 0) continue;

      const correctAnswer = questionRes.rows[0].answer;
      const isCorrect = selected_answer === correctAnswer;

      if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
      }

      await pool.query(
        `
        UPDATE tbl_student_final_assignment_questions
        SET student_answer = $1,
            is_correct = $2
        WHERE final_assignment_question_id = $3
        `,
        [selected_answer, isCorrect, final_assignment_question_id]
      );
    }

    const totalQuestions = correctCount + wrongCount;
    const totalMarks = correctCount; // 1 mark per question

    // 3️⃣ Calculate Grade (Optional Logic)
    let grade = "F";
    const percentage = (correctCount / totalQuestions) * 100;

    if (percentage >= 90) grade = "A+";
    else if (percentage >= 75) grade = "A";
    else if (percentage >= 60) grade = "B";
    else if (percentage >= 50) grade = "C";

    // 4️⃣ Update Final Assignment
    await pool.query(
      `
      UPDATE tbl_student_final_assignment
      SET correct_answers = $1,
          wrong_answer = $2,
          total_marks = $3,
          grade = $4,
          submitted_at = NOW(),
          status = 'Completed',
          is_unlocked = true
      WHERE final_assignment_id = $5
      `,
      [
        correctCount,
        wrongCount,
        totalMarks.toString(),
        grade,
        final_assignment_id
      ]
    );

    return res.status(200).json({
      statusCode: 200,
      message: "Final Exam submitted successfully",
      result: {
        total_questions: totalQuestions,
        correct_answers: correctCount,
        wrong_answers: wrongCount,
        total_marks: totalMarks,
        grade: grade
      }
    });

  } catch (error) {

    return res.status(500).json({
      message: "Something went wrong"
    });
  }
};


exports.getfinalexamresult = async (req, res) => {
  const { final_assignment_id } = req.body;

  if (!final_assignment_id) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Missing Required Field'
    });
  }

  try {

    // 1. Check assignment lock status
    const checklock = await pool.query(`
      SELECT is_unlocked
      FROM tbl_student_final_assignment
      WHERE final_assignment_id = $1
    `, [final_assignment_id]);

    if (checklock.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Final assignment not found'
      });
    }



    // 2. Get Questions & Options
    const questions = await pool.query(`
      SELECT 
        final_assignment_question_id,
        question,
        a,
        b,
        c,
        d,
        answer, 
        student_answer,
        is_correct
        
      FROM tbl_student_final_assignment_questions
      WHERE final_assignment_id = $1
      ORDER BY final_assignment_question_id
    `, [final_assignment_id]);

    return res.status(200).json({
      statusCode: 200,
      message: 'Questions fetched successfully',
      data: questions.rows
    });

  } catch (error) {

    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
    });
  }
};