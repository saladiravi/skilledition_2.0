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

        /* ✅ student_course_id if enrolled */
        tsc.student_course_id,

        /* ✅ enrolled status */
        CASE 
          WHEN tsc.student_course_id IS NOT NULL 
          THEN true 
          ELSE false 
        END AS is_enrolled

      FROM tbl_course tc

      JOIN tbl_category cat 
        ON tc.category_id = cat.category_id

      /* ✅ Join student_course */
      LEFT JOIN tbl_student_course tsc
        ON tsc.course_id = tc.course_id
       AND tsc.student_id = $1

      WHERE tc.status = 'Published'
      ORDER BY tc.course_id ASC
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

// exports.getstudentcourse = async (req, res) => {
//   const { course_id, student_id } = req.body;

//   try {
//     const { rows } = await pool.query(`
//       SELECT
//         tc.course_id,
//         tc.course_title,
//         tc.no_of_modules,
//         tc.duration,

//         tm.module_id,
//         tm.module_title,

//         tmv.module_video_id,
//         tmv.video_title,

//         ta.assignment_id,
//         ta.assignment_title,

//         COALESCE(tsp.is_unlocked, false) AS is_unlocked,
//         COALESCE(tsp.is_completed, false) AS is_completed,

//         COUNT(tmv.module_video_id) OVER() AS total_videos,
//         COUNT(
//           CASE WHEN tsp.is_completed = true THEN 1 END
//         ) OVER() AS completed_videos

//       FROM tbl_course tc
//       JOIN tbl_module tm
//         ON tc.course_id = tm.course_id
//       LEFT JOIN tbl_module_videos tmv
//         ON tm.module_id = tmv.module_id
//       LEFT JOIN tbl_assignment ta
//         ON tm.module_id = ta.module_id
//       LEFT JOIN tbl_student_course_progress tsp
//         ON tsp.module_video_id = tmv.module_video_id
//        AND tsp.student_id = $2
//        AND tsp.course_id = tc.course_id
//       WHERE tc.course_id = $1

//     `, [course_id, student_id]);

//     if (rows.length === 0) {
//       return res.json({
//         statusCode: 200,
//         data: null
//       });
//     }

//     // 🔹 Overall progress
//     const totalVideos = Number(rows[0].total_videos);
//     const completedVideos = Number(rows[0].completed_videos);

//     const progressPercentage =
//       totalVideos === 0
//         ? 0
//         : Math.round((completedVideos / totalVideos) * 100);

//     // 🔹 Base course object
//     const course = {
//       course_id: rows[0].course_id,
//       course_title: rows[0].course_title,
//       no_of_modules: rows[0].no_of_modules,
//       duration: rows[0].duration,
//       progress: {
//         total_videos: totalVideos,
//         completed_videos: completedVideos,
//         percentage: progressPercentage
//       },
//       modules: []
//     };

//     // 🔹 Build modules + videos
//     const moduleMap = {};

//     for (const row of rows) {
//       // create module if not exists
//       if (!moduleMap[row.module_id]) {
//         moduleMap[row.module_id] = {
//           module_id: row.module_id,
//           module_title: row.module_title,
//           assignment: row.assignment_id
//             ? {
//               assignment_id: row.assignment_id,
//               assignment_title: row.assignment_title
//             }
//             : null,
//           videos: []
//         };

//         course.modules.push(moduleMap[row.module_id]);
//       }

//       // add video
//       if (row.module_video_id) {
//         moduleMap[row.module_id].videos.push({
//           module_video_id: row.module_video_id,
//           video_title: row.video_title,
//           is_unlocked: row.is_unlocked,
//           is_completed: row.is_completed
//         });
//       }
//     }

//     return res.json({
//       statusCode: 200,
//       data: course
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       statusCode: 500,
//       message: 'Internal Server Error'
//     });
//   }
// };

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

  JOIN tbl_user tu
    ON tc.tutor_id = tu.user_id

  /* ✅ FIX */
  LEFT JOIN tbl_tutor tt
    ON tc.tutor_id = tt.tutor_id

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
              assignment_title: row.assignment_title
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

  if (!student_id || !module_video_id || !watched) {
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


exports.getexamstudent = async (req, res) => {
  try {
    const { student_id } = req.body;

    if (!student_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "student_id is required"
      });
    }

    const result = await pool.query(`
      SELECT
        ta.assignment_id,
        ta.assignment_title,
        ta.total_questions,

        tc.course_title,

        tsa.student_assignment_id,

        /* ✅ If exam not written */
        COALESCE(tsa.status, 'NOT ATTEMPTED') AS status,

        COALESCE(tsa.total_marks, 0) AS total_marks,

        /* ✅ Correct answers */
        COUNT(
          CASE WHEN tans.is_correct = true THEN 1 END
        ) AS correct_answers,

        /* ✅ Wrong answers */
        COUNT(
          CASE WHEN tans.is_correct = false THEN 1 END
        ) AS wrong_answers

      FROM tbl_student_course tsc

      JOIN tbl_course tc
        ON tsc.course_id = tc.course_id

      JOIN tbl_assignment ta
        ON tc.course_id = ta.course_id

      /* 🔥 IMPORTANT: LEFT JOIN */
      LEFT JOIN tbl_student_assignment tsa
        ON ta.assignment_id = tsa.assignment_id
       AND tsa.student_id = tsc.student_id

      LEFT JOIN tbl_student_answers tans
        ON tsa.student_assignment_id = tans.student_assignment_id

      WHERE tsc.student_id = $1

      GROUP BY
        ta.assignment_id,
        ta.assignment_title,
        ta.total_questions,
        tc.course_title,
        tsa.student_assignment_id,
        tsa.status,
        tsa.total_marks

      ORDER BY ta.assignment_id ASC
    `, [student_id]);

    return res.status(200).json({
      statusCode: 200,
      message:'Fetched Sucessfully',
      data: result.rows
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

 
    // 1️⃣ Create student assignment
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

    // 2️⃣ Loop through answers
    for (let ans of answers) {
      const { question_id, selected_answer } = ans;

      // fetch correct answer
      const q = await pool.query(
        `SELECT answer FROM tbl_questions WHERE question_id = $1`,
        [question_id]
      );

      const correct_answer = q.rows[0].answer;
      const is_correct = selected_answer === correct_answer;

      if (is_correct) totalMarks++;

      // insert answer
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

    // 3️⃣ Update marks + status
    await pool.query(
      `
      UPDATE tbl_student_assignment
      SET total_marks = $1,
          status = 'COMPLETED'
      WHERE student_assignment_id = $2
      `,
      [totalMarks, student_assignment_id]
    );

  
    res.status(200).json({
      message: 'Exam submitted successfully',
      student_assignment_id,
      total_marks: totalMarks
    });
  } catch (error) {
  
    console.error(error);

    res.status(500).json({
      message: 'Something went wrong'
    });
  } finally {
    
  }
};