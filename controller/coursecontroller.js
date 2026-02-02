const pool = require('../config/db');
const { uploadToS3, getSignedVideoUrl, deletefroms3 } = require('../utils/s3upload');
const ffmpeg = require("fluent-ffmpeg");
const ffprobe = require("ffprobe-static");

ffmpeg.setFfprobePath(ffprobe.path);
function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration); // in seconds
    });
  });
}


function formatDurationHMS(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const h = hrs.toString().padStart(2, "0");
  const m = mins.toString().padStart(2, "0");
  const s = secs.toString().padStart(2, "0");

  return `${h}:${m}:${s}`;
}



exports.addcourse = async (req, res) => {
  const {
    category_id,
    tutor_id,
    course_title,
    course_description,
    duration,
    no_of_modules,
    level
  } = req.body;

  if (!category_id || !tutor_id || !course_title) {
    return res.status(400).json({
      statusCode: 400,
      message: "Missing required fields"
    });
  }

  try {
    // 1. Check category exists
    const checkCategory = await pool.query(
      `SELECT category_id FROM tbl_category WHERE category_id=$1`,
      [category_id]
    );

    if (checkCategory.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Category not found"
      });
    }

    // 2. Check tutor exists in tbl_user with role tutor
    const checkTutor = await pool.query(
      `SELECT user_id FROM tbl_user WHERE user_id=$1 AND role='tutor'`,
      [tutor_id]
    );

    if (checkTutor.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Tutor not found or role not tutor"
      });
    }

    // 3. Insert course
    const insertCourse = await pool.query(
      `INSERT INTO tbl_course 
      (category_id, tutor_id, course_title, course_description, duration, no_of_modules, level)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING course_id`,
      [
        category_id,
        tutor_id,
        course_title,
        course_description,
        duration,
        no_of_modules,
        level
      ]
    );

    return res.status(200).json({
      statusCode: 200,
      message: "Course added successfully",
      course_id: insertCourse.rows[0]
    });

  } catch (error) {
    console.error("Add Course Error:", error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};


exports.updatecourse = async (req, res) => {
  try {
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "course_id is required"
      });
    }

    // Prepare fields dynamically
    let fields = [];
    let values = [];
    let idx = 1;

    const allowedFields = [
      "category_id",
      "tutor_id",
      "course_title",
      "course_description",
      "duration",
      "no_of_modules",
      "level"
    ];

    // Add text fields if provided
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = $${idx}`);
        values.push(req.body[field]);
        idx++;
      }
    });

    // Handle course image upload to S3
    if (req.files?.course_image?.length > 0) {
      const uploadedImageKey = await uploadToS3(
        req.files.course_image[0],
        "courses/images"
      );

      fields.push(`course_image = $${idx}`);
      values.push(uploadedImageKey);
      idx++;
    }

    // If no update fields provided
    if (fields.length === 0) {
      return res.status(400).json({
        statusCode: 400,
        message: "No fields to update"
      });
    }

    // Add WHERE condition
    values.push(course_id);

    const query = `
      UPDATE public.tbl_course
      SET ${fields.join(", ")}
      WHERE course_id = $${idx}
      RETURNING *;
    `;

    const result = await pool.query(query, values);

    return res.status(200).json({
      statusCode: 200,
      message: "Course updated successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};



exports.getcourseBytutor = async (req, res) => {
  const { tutor_id } = req.body;

  try {
    const checkTutor = await pool.query(
      `SELECT user_id FROM tbl_user WHERE user_id=$1 AND role='tutor'`,
      [tutor_id]
    );

    if (checkTutor.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Tutor not found or role not tutor"
      });
    }

    const result = await pool.query(
      `SELECT * FROM tbl_course WHERE tutor_id=$1`,
      [tutor_id]
    );

    // 🔥 Generate signed URL for each course image
    const coursesWithSignedUrl = await Promise.all(
      result.rows.map(async (course) => {
        if (course.course_image) {
          course.course_image_url = await getSignedVideoUrl(course.course_image);
        } else {
          course.course_image_url = null;
        }
        return course;
      })
    );

    return res.status(200).json({
      statusCode: 200,
      message: "Fetched Successfully",
      course: coursesWithSignedUrl
    });

  } catch (error) {
    console.log("Error:", error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};



// exports.addmodulewithvideos = async (req, res) => {
//   const { course_id, module_title, module_description } = req.body;

//   try {
//     const exitcourse = await pool.query(
//       `SELECT course_id FROM tbl_course WHERE course_id=$1`,
//       [course_id]
//     );

//     if (exitcourse.rows.length === 0) {
//       return res.status(404).json({ statusCode: 404, message: "Course Not Found" });
//     }

//     let sheet_file = null;
//     if (req.files?.sheet_file?.length > 0) {
//       sheet_file = await uploadToS3(req.files.sheet_file[0], "modules/sheets");
//     }

//     const moduleInsert = await pool.query(
//       `INSERT INTO tbl_module (course_id, module_title, module_description, sheet_file)
//        VALUES ($1, $2, $3, $4)
//        RETURNING module_id`,
//       [course_id, module_title, module_description, sheet_file]
//     );

//     const module_id = moduleInsert.rows[0].module_id;
//     let insertedVideos = 0;

//     if (req.files?.video_files?.length > 0) {
//       // let index = 0;

//       for (const file of req.files.video_files) {

//         const durationSeconds = await getVideoDuration(file.path);
//         const formattedDuration = formatDurationHMS(durationSeconds);

//         const uploadedVideoUrl = await uploadToS3(file, "modules/videos");



//         // let duration = Array.isArray(video_duration)
//         //   ? video_duration[index]
//         //   : video_duration;

//        const videoTitle = file.originalname.replace(/\.[^/.]+$/, "");
//         await pool.query(
//           `INSERT INTO tbl_module_videos 
//             (module_id, video, video_title, video_duration, status)
//             VALUES ($1, $2, $3, $4, $5)`,
//           [
//             module_id,
//            uploadedVideoUrl,
//             videoTitle,
//             formattedDuration,
//             "pending" 
//           ]
//         );


//         insertedVideos++;
//       }
//     }

//     return res.status(200).json({
//       statusCode: 200,
//       message: "Module and videos added successfully",
//       module_id,
//       videos_uploaded: insertedVideos
//     });

//   } catch (error) {
//     console.error("Error adding module with videos:", error);
//     return res.status(500).json({
//       statusCode: 500,
//       message: "Internal Server Error"
//     });
//   }
// };



exports.addModulesWithVideos = async (req, res) => {
  const { course_id, modules } = req.body;

  if (!course_id || !modules) {
    return res.status(400).json({
      statusCode: 400,
      message: "course_id and modules are required"
    });
  }

  const parsedModules = JSON.parse(modules);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Check course
    const course = await client.query(
      `SELECT course_id FROM tbl_course WHERE course_id=$1`,
      [course_id]
    );

    if (course.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Course not found" });
    }

    let moduleResults = [];

    for (let i = 0; i < parsedModules.length; i++) {
      const module = parsedModules[i];

      // 2️⃣ Upload sheet (one per module)
      const sheet = req.files.find(
        file => file.fieldname === `sheet_files[${i}]`
      );

      let sheetFile = null;
      if (sheet) {
        sheetFile = await uploadToS3(sheet, "modules/sheets");
      }


      // 3️⃣ Insert module
      const moduleInsert = await client.query(
        `INSERT INTO tbl_module
         (course_id, module_title, module_description, sheet_file)
         VALUES ($1, $2, $3, $4)
         RETURNING module_id`,
        [course_id, module.module_title, module.module_description, sheetFile]
      );

      const module_id = moduleInsert.rows[0].module_id;
      let videoCount = 0;

      // 4️⃣ Insert videos for this module
      // Videos for module i
      const videos = req.files.filter(file =>
        file.fieldname.startsWith(`video_files[${i}]`)
      );


      for (const file of videos) {
        const durationSeconds = await getVideoDuration(file.path);
        const formattedDuration = formatDurationHMS(durationSeconds);

        const videoUrl = await uploadToS3(file, "modules/videos");
        const videoTitle = file.originalname.replace(/\.[^/.]+$/, "");

        await client.query(
          `INSERT INTO tbl_module_videos
           (module_id, video, video_title, video_duration, status)
           VALUES ($1, $2, $3, $4, 'Pending')`,
          [module_id, videoUrl, videoTitle, formattedDuration]
        );

        videoCount++;
      }

      moduleResults.push({
        module_id,
        videos_uploaded: videoCount
      });
    }
    // ✅ Update module count in tbl_course
    await client.query(
      `UPDATE tbl_course
      SET no_of_modules = (
        SELECT COUNT(*)
        FROM tbl_module
        WHERE course_id = $1
      )
      WHERE course_id = $1`,
      [course_id]
    );

 
    await client.query("COMMIT");

    return res.status(200).json({
      statusCode: 200,
      message: "Modules and videos added successfully",
      modules: moduleResults
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  } finally {
    client.release();
  }
};


exports.getcoursewithmoduledetails = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
          tc.course_id,
          tc.course_title,
          tc.course_description,
          tc.duration,
          tm.module_id,
          tm.module_title,
          tm.module_description,
          tmv.module_video_id,
          tmv.video_title,
          tmv.video,
          tmv.video_duration
      FROM tbl_course AS tc
      JOIN tbl_module AS tm ON tc.course_id = tm.course_id
      JOIN tbl_module_videos AS tmv ON tm.module_id = tmv.module_id
    `);

    const coursesMap = new Map();

    for (const row of result.rows) {
      if (!coursesMap.has(row.course_id)) {
        coursesMap.set(row.course_id, {
          course_id: row.course_id,
          course_title: row.course_title,
          course_description: row.course_description,
          duration: row.duration,
          modules: new Map(),
        });
      }

      const course = coursesMap.get(row.course_id);

      if (!course.modules.has(row.module_id)) {
        course.modules.set(row.module_id, {
          module_id: row.module_id,
          module_title: row.module_title,
          module_description: row.module_description,
          videos: [],
        });
      }

      const moduleData = course.modules.get(row.module_id);

      // Generate signed video URL
      const signedUrl = await getSignedVideoUrl(row.video);

      moduleData.videos.push({
        module_video_id: row.module_video_id,
        video_title: row.video_title,
        video_url: signedUrl,
        video_duration: row.video_duration
      });
    }

    const response = Array.from(coursesMap.values()).map(course => ({
      ...course,
      modules: Array.from(course.modules.values())
    }));

    return res.status(200).json({
      statusCode: 200,
      message: "course details fetched successfully",
      course: response,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
};


exports.getcoursemoduleById = async (req, res) => {
  const { course_id } = req.body;

  try {
    // Check if course exists
    const exitcourseid = await pool.query(
      'SELECT course_id FROM tbl_course WHERE course_id=$1',
      [course_id]
    );

    if (exitcourseid.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Course Not Found',
      });
    }

    // Fetch course, modules and videos
    const result = await pool.query(
      `
      SELECT
          tc.course_id,
          tc.course_title,
          tc.course_description,
          tc.duration,
          tm.module_id,
          tm.module_title,
          tm.module_description,
          tmv.module_video_id,
          tmv.video_title,
          tmv.video
      FROM tbl_course AS tc
      JOIN tbl_module AS tm ON tc.course_id = tm.course_id
      JOIN tbl_module_videos AS tmv ON tm.module_id = tmv.module_id
      WHERE tc.course_id = $1
      `,
      [course_id]
    );

    let coursemap = {};

    for (const row of result.rows) {
      // Create course entry
      if (!coursemap[row.course_id]) {
        coursemap[row.course_id] = {
          course_id: row.course_id,
          course_title: row.course_title,
          course_description: row.course_description,
          duration: row.duration,
          modules: {},
        };
      }

      const course = coursemap[row.course_id];

      // Create module entry
      if (!course.modules[row.module_id]) {
        course.modules[row.module_id] = {
          module_id: row.module_id,
          module_title: row.module_title,
          module_description: row.module_description,
          videos: [],
        };
      }

      // Generate signed URL for the video
      const signedUrl = await getSignedVideoUrl(row.video);

      // Add video entry
      course.modules[row.module_id].videos.push({
        module_video_id: row.module_video_id,
        video_title: row.video_title,
        video_url: signedUrl,
      });
    }

    // Convert module object to array
    const finalcourse = Object.values(coursemap).map((c) => ({
      ...c,
      modules: Object.values(c.modules),
    }));

    return res.status(200).json({
      statusCode: 200,
      message: 'Course details fetched successfully',
      course: finalcourse,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error',
    });
  }
};



exports.updatestatus = async (req, res) => {

  const { module_video_id, status, reason } = req.body;

  if (!module_video_id || !status) {
    return res.status(400).json({
      statusCode: 400,
      message: "module_video_id and status are required"
    });
  }

  try {

    // ✅ Update video and get module_id
    const updateResult = await pool.query(
      `UPDATE tbl_module_videos
       SET status = $1, reason = $2
       WHERE module_video_id = $3
       RETURNING module_id`,
      [status, reason, module_video_id]
    );


    if (updateResult.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Module video not found"
      });
    }


    const module_id = updateResult.rows[0].module_id;


    // ✅ Get course_id from module
    const courseResult = await pool.query(
      `SELECT course_id
       FROM tbl_module
       WHERE module_id = $1`,
      [module_id]
    );


    if (courseResult.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Course not found"
      });
    }


    const course_id = courseResult.rows[0].course_id;


    // ✅ Auto check & update course status
    await updateCourseStatusIfReady(course_id);


    return res.status(200).json({
      statusCode: 200,
      message: "Video status updated successfully"
    });


  } catch (error) {

    console.log("updatestatus Error:", error);

    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};


exports.gettotalcourse = async (req, res) => {
  const { tutor_id } = req.body;

  if (!tutor_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "tutor_id is required"
    });
  }

  try {
    const { rows } = await pool.query(`
      SELECT
        tc.course_id,
        tc.course_title,
        tc.course_description,
        tc.duration,
        tc.no_of_modules,
        tc.level,
        tc.course_image,
        tc.status AS course_status,

        tcg.category_id,
        tcg.category_name,

        tm.module_id,
        tm.module_title,
        tm.module_description,
        tm.sheet_file,
        tm.total_duration,

        tmv.module_video_id,
        tmv.video,
        tmv.video_title,
        tmv.status AS video_status,
        tmv.reason,
        tmv.video_duration,

        tu.user_id AS student_id,
        tu.full_name AS student_name,

        COUNT(DISTINCT tsc.student_id) AS enrolled_count

      FROM tbl_course tc
      JOIN tbl_category tcg 
        ON tc.category_id = tcg.category_id

      LEFT JOIN tbl_module tm 
        ON tc.course_id = tm.course_id

      LEFT JOIN tbl_module_videos tmv
        ON tm.module_id = tmv.module_id
       AND tmv.status IN ('Pending', 'Published', 'Rejected')

      LEFT JOIN tbl_student_course tsc
        ON tc.course_id = tsc.course_id

      LEFT JOIN tbl_user tu
        ON tsc.student_id = tu.user_id
       AND tu.role = 'student'

      WHERE tc.tutor_id = $1

      GROUP BY
        tc.course_id,
        tcg.category_id,
        tm.module_id,
        tmv.module_video_id,
        tu.user_id;
    `, [tutor_id]);

    const coursesMap = {};

    // ------------------ GROUP DATA ------------------
    for (const row of rows) {

      // ---------- COURSE ----------
      if (!coursesMap[row.course_id]) {
        coursesMap[row.course_id] = {
          course_id: row.course_id,
          course_title: row.course_title,
          course_description: row.course_description,
          duration: row.duration,
          no_of_modules: row.no_of_modules,
          level: row.level,
          course_image: row.course_image,
          status: row.course_status,
          category: {
            category_id: row.category_id,
            category_name: row.category_name
          },
          enrolled_count: Number(row.enrolled_count),
          modules: [],
          students: []
        };
      }

      const course = coursesMap[row.course_id];

      // ---------- MODULE ----------
      let module = course.modules.find(
        m => m.module_id === row.module_id
      );

      if (!module && row.module_id) {

        module = {
          module_id: row.module_id,
          module_title: row.module_title,
          module_description: row.module_description,
          sheet_file: row.sheet_file,
          total_duration: row.total_duration,
          videos: []
        };
        course.modules.push(module);
      }

      // ---------- VIDEO ----------
      if (row.module_video_id && module) {
        const signedUrl = await getSignedVideoUrl(row.video);
        module.videos.push({
          module_video_id: row.module_video_id,
          video_url: signedUrl,
          video: row.video,
          video_title: row.video_title,
          status: row.video_status,
          reason: row.reason,
          video_duration: row.video_duration
        });
      }

      // ---------- STUDENT ----------
      if (row.student_id) {
        const exists = course.students.find(
          s => s.student_id === row.student_id
        );

        if (!exists) {
          course.students.push({
            student_id: row.student_id,
            student_name: row.student_name
          });
        }
      }
    }

    // ---------- SHOW ONLY REJECTED VIDEOS ----------
    for (const course of Object.values(coursesMap)) {
      for (const module of course.modules) {
        const rejectedVideos = module.videos.filter(
          v => v.status === 'Rejected'
        );

        if (rejectedVideos.length > 0) {
          module.videos = rejectedVideos;
        }
      }

      // ---------- NO STUDENTS -> NULL ----------
      if (course.students.length === 0) {
        course.students = null;
      }
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Courses fetched successfully",
      data: Object.values(coursesMap)
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};
exports.getvideosbymoduleid = async (req, res) => {
  const { module_id, status } = req.body
  try {
    const result = await pool.query(`
        SELECT tmv.*
        FROM tbl_module AS tm
        JOIN  tbl_module_videos AS tmv ON tm.module_id=tmV.module_id
        WHERE tm.module_id=$1 AND status=$2`, [module_id, status])
    return res.status(200).json({
      statusCode: 200,
      message: 'Fetched Sucessfully',
      videos: result.rows
    })
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
    })
  }
}


exports.updateModuleVideos = async (req, res) => {
  const {
    module_id,
    module_video_id,
    module_title,
    module_description
  } = req.body;

  if (!module_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "module_id is required"
    });
  }

  // Ensure module_video_id is array
  const videoIds = module_video_id
    ? (Array.isArray(module_video_id) ? module_video_id : [module_video_id])
    : [];

  const videoFiles = req.files?.video_files || [];
  const sheetFile = req.files?.sheet_file?.[0] || null;

  if (videoIds.length > 0 && videoIds.length !== videoFiles.length) {
    return res.status(400).json({
      statusCode: 400,
      message: "module_video_id count must match uploaded videos count"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Check module exists
    const moduleCheck = await client.query(
      `SELECT module_id FROM tbl_module WHERE module_id = $1`,
      [module_id]
    );

    if (moduleCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        statusCode: 404,
        message: "Module not found"
      });
    }

    // 2️⃣ UPDATE MODULE DETAILS (if provided)
    if (module_title || module_description || sheetFile) {
      let sheetUrl = null;

      if (sheetFile) {
        sheetUrl = await uploadToS3(sheetFile, "modules/sheets");
      }

      await client.query(
        `
        UPDATE tbl_module
        SET
          module_title = COALESCE($1, module_title),
          module_description = COALESCE($2, module_description),
          sheet_file = COALESCE($3, sheet_file)
        WHERE module_id = $4
        `,
        [
          module_title || null,
          module_description || null,
          sheetUrl,
          module_id
        ]
      );
    }

    // 3️⃣ UPDATE MODULE VIDEOS (ONLY REJECTED)
    let updatedCount = 0;

    for (let i = 0; i < videoIds.length; i++) {
      const mvId = videoIds[i];
      const file = videoFiles[i];

      const checkVideo = await client.query(
        `
        SELECT module_video_id
        FROM tbl_module_videos
        WHERE module_video_id = $1
          AND module_id = $2
          AND status IN ('Rejected', 'Pending')
        `,
        [mvId, module_id]
      );

      if (checkVideo.rowCount === 0) continue;

      const durationSeconds = await getVideoDuration(file.path);
      const formattedDuration = formatDurationHMS(durationSeconds);

      const videoUrl = await uploadToS3(file, "modules/videos");
      const videoTitle = file.originalname.replace(/\.[^/.]+$/, "");

      await client.query(
        `
        UPDATE tbl_module_videos
        SET
          video = $1,
          video_title = $2,
          video_duration = $3,
          status = 'Pending',
          reason = NULL,
          module_video_created_at = NOW()
        WHERE module_video_id = $4
        `,
        [videoUrl, videoTitle, formattedDuration, mvId]
      );

      updatedCount++;
    }

    await client.query("COMMIT");

    return res.status(200).json({
      statusCode: 200,
      message: "Module updated successfully",
      updated_videos: updatedCount
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  } finally {
    client.release();
  }
};



exports.getvideos = async (req, res) => {
  const { module_id, module_video_id } = req.body;

  if (!module_id || !module_video_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "module_id and module_video_id are required"
    });
  }

  // Normalize module_video_id to array
  const videoIds = Array.isArray(module_video_id)
    ? module_video_id
    : [module_video_id];

  const client = await pool.connect();

  try {
    const result = await client.query(
      `
      SELECT
        module_video_id,
        module_id,
        video,
        video_title,
        video_duration,
        status,
        reason
      FROM tbl_module_videos
      WHERE module_id = $1
        AND module_video_id = ANY($2::int[])
      ORDER BY module_video_id
      `,
      [module_id, videoIds]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "No videos found"
      });
    }

    // 🔹 Generate signed URLs
    const videosWithSignedUrl = await Promise.all(
      result.rows.map(async (row) => {
        const signedUrl = await getSignedVideoUrl(row.video);

        return {
          module_video_id: row.module_video_id,
          module_id: row.module_id,
          video_url: signedUrl,        // ✅ signed URL
          video_title: row.video_title,
          video_duration: row.video_duration,
          status: row.status,
          reason: row.reason
        };
      })
    );

    return res.status(200).json({
      statusCode: 200,
      message: "Videos fetched successfully",
      count: videosWithSignedUrl.length,
      data: videosWithSignedUrl
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  } finally {
    client.release();
  }
};


exports.deleteModule = async (req, res) => {
  const { module_id } = req.body;

  if (!module_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "module_id is required"
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1️⃣ Get module sheet file
    const moduleRes = await client.query(
      `
      SELECT sheet_file
      FROM tbl_module
      WHERE module_id = $1
      `,
      [module_id]
    );

    if (moduleRes.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Module Not Found'
      })
    }

    const sheetFileKey = moduleRes.rows[0].sheet_file;

    // 2️⃣ Get module video files
    const videoRes = await client.query(
      `
      SELECT video
      FROM tbl_module_videos
      WHERE module_id = $1
      `,
      [module_id]
    );

    // 3️⃣ Delete sheet file from S3
    if (sheetFileKey) {
      await deletefroms3(sheetFileKey);
    }

    // 4️⃣ Delete video files from S3
    for (const v of videoRes.rows) {
      if (v.video) {
        await deletefroms3(v.video);
      }
    }

    // 5️⃣ Delete videos from DB
    await client.query(
      `
      DELETE FROM tbl_module_videos
      WHERE module_id = $1
      `,
      [module_id]
    );

    // 6️⃣ Delete module
    await client.query(
      `
      DELETE FROM tbl_module
      WHERE module_id = $1
      `,
      [module_id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      statusCode: 200,
      message: "Module, sheet file, and videos deleted successfully"
    });

  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({
      statusCode: 500,
      message: error.message || "Internal Server Error"
    });

  } finally {
    client.release();
  }
};


exports.deleteCourse = async (req, res) => {
  const { course_id } = req.body;

  if (!course_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "course_id is required"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Check course exists
    const courseCheck = await client.query(
      `SELECT course_id FROM tbl_course WHERE course_id = $1`,
      [course_id]
    );

    if (courseCheck.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Course Not Found'
      })
    }

    // 2️⃣ Get all module sheet files
    const moduleSheets = await client.query(
      `
      SELECT sheet_file
      FROM tbl_module
      WHERE course_id = $1
      `,
      [course_id]
    );

    // 3️⃣ Get all module video files
    const moduleVideos = await client.query(
      `
      SELECT mv.video
      FROM tbl_module_videos mv
      JOIN tbl_module m ON m.module_id = mv.module_id
      WHERE m.course_id = $1
      `,
      [course_id]
    );

    // 4️⃣ Delete sheet files from S3
    for (const m of moduleSheets.rows) {
      if (m.sheet_file) {
        await deletefroms3(m.sheet_file);
      }
    }

    // 5️⃣ Delete video files from S3
    for (const v of moduleVideos.rows) {
      if (v.video) {
        await deletefroms3(v.video);
      }
    }

    // 6️⃣ Delete module videos from DB
    await client.query(
      `
      DELETE FROM tbl_module_videos
      WHERE module_id IN (
        SELECT module_id FROM tbl_module WHERE course_id = $1
      )
      `,
      [course_id]
    );

    // 7️⃣ Delete modules
    await client.query(
      `
      DELETE FROM tbl_module
      WHERE course_id = $1
      `,
      [course_id]
    );

    // 8️⃣ Delete course
    await client.query(
      `
      DELETE FROM tbl_course
      WHERE course_id = $1
      `,
      [course_id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      statusCode: 200,
      message: "Course, modules, videos, and S3 files deleted successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    return res.status(500).json({
      statusCode: 500,
      message: error.message || "Internal Server Error"
    });

  } finally {
    client.release();
  }
};

exports.getTutorCoursesWithModules = async (req, res) => {
  const { tutorid } = req.body;

  try {
    const getCoursesWithModulesByTutor = `
        SELECT
          c.course_id,
          c.course_title,
          c.course_description,
          c.duration,
          c.no_of_modules,
          c.level,
          c.course_image,
          c.status,
          c.course_created_at,

          m.module_id,
          m.module_title,
          m.module_description,
          m.sheet_file,
          m.total_duration
        FROM tbl_course c
        LEFT JOIN tbl_module m
          ON c.course_id = m.course_id
        WHERE c.tutor_id = $1
        ORDER BY c.course_id, m.module_id
      `;


    const result = await pool.query(getCoursesWithModulesByTutor, [tutorid]);

    const coursesMap = {};

    result.rows.forEach(row => {
      // If course not yet added
      if (!coursesMap[row.course_id]) {
        coursesMap[row.course_id] = {
          course_id: row.course_id,
          course_title: row.course_title,
          course_description: row.course_description,
          duration: row.duration,
          no_of_modules: row.no_of_modules,
          level: row.level,
          course_image: row.course_image,
          status: row.status,
          course_created_at: row.course_created_at,
          modules: []
        };
      }

      // Add module if exists
      if (row.module_id) {
        coursesMap[row.course_id].modules.push({
          module_id: row.module_id,
          module_title: row.module_title,
          module_description: row.module_description,
          sheet_file: row.sheet_file,
          total_duration: row.total_duration
        });
      }
    });

    res.status(200).json({
      statusCode:200,
      message:'Fetched Sucessfully',
      data: Object.values(coursesMap)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Server error"
    });
  }
};




// admin API's


exports.getAdminCourseList = async (req, res) => {
  try {

    const query = `
      SELECT
        tc.course_id,

        tc.course_title AS course,

        COUNT(DISTINCT tm.module_id) AS modules,

        tcg.category_name AS category,

        tu.full_name AS tutor,

        tc.level,

        COUNT(DISTINCT tsc.student_id) AS students,

        tc.status

      FROM tbl_course tc

      -- Category
      JOIN tbl_category tcg
        ON tc.category_id = tcg.category_id

      -- Tutor
      JOIN tbl_user tu
        ON tc.tutor_id = tu.user_id
       AND tu.role = 'tutor'

      -- Modules
      LEFT JOIN tbl_module tm
        ON tc.course_id = tm.course_id

      -- Students
      LEFT JOIN tbl_student_course tsc
        ON tc.course_id = tsc.course_id

      GROUP BY
        tc.course_id,
        tc.course_title,
        tcg.category_name,
        tu.full_name,
        tc.level,
        tc.status

      ORDER BY tc.course_id ASC
    `;

    const { rows } = await pool.query(query);

    return res.status(200).json({
      statusCode: 200,
      message: "Course list fetched successfully",
      data: rows
    });

  } catch (error) {

    console.error("getAdminCourseList Error:", error);

    return res.status(500).json({
      statusCode: 500,
      message: "Internal server error"
    });
  }
};


// exports.getadmintotalcourse = async (req, res) => {

//   const { status } = req.body; // Pending / Approved / Rejected

//   try {

//     const query = `
     
//   SELECT

//     -- COURSE
//     tc.course_id,
//     tc.course_title,
//     tc.course_description,
//     tc.duration,
//     tc.level,
//     tc.status AS course_status,

//     -- CATEGORY
//     tcg.category_name,

//     -- TUTOR
//     tut.full_name AS tutor_name,

//     -- MODULE
//     tm.module_id,
//     tm.module_title,

//     -- VIDEO
//     tmv.module_video_id,
//     tmv.video_title,
//     tmv.status AS video_status,

//     -- STUDENTS
//     COUNT(DISTINCT tsc.student_id) AS enrolled_count,

//     -- TOTAL MODULES (FROM SUBQUERY)
//     COALESCE(mc.total_modules, 0) AS total_modules


//   FROM tbl_course tc


//   -- CATEGORY
//   JOIN tbl_category tcg
//     ON tc.category_id = tcg.category_id


//   -- TUTOR
//   JOIN tbl_user tut
//     ON tc.tutor_id = tut.user_id
//    AND tut.role = 'tutor'


//   -- MODULE
//   LEFT JOIN tbl_module tm
//     ON tc.course_id = tm.course_id


//   -- VIDEOS
//   LEFT JOIN tbl_module_videos tmv
//     ON tm.module_id = tmv.module_id


//   -- STUDENTS
//   LEFT JOIN tbl_student_course tsc
//     ON tc.course_id = tsc.course_id


//   -- MODULE COUNT SUBQUERY
//   LEFT JOIN (
//     SELECT
//       course_id,
//       COUNT(DISTINCT module_id) AS total_modules
//     FROM tbl_module
//     GROUP BY course_id
//   ) mc ON mc.course_id = tc.course_id


//   WHERE tc.status = $1


//   GROUP BY
//     tc.course_id,
//     tcg.category_name,
//     tut.full_name,
//     tm.module_id,
//     tmv.module_video_id,
//     mc.total_modules
// `;

//     const { rows } = await pool.query(query, [status]);

//     const courses = {};

//     // ---------- FORMAT RESPONSE ----------
//     for (const row of rows) {

//       // COURSE
//       if (!courses[row.course_id]) {

//         courses[row.course_id] = {
//           course_id: row.course_id,
//           course_title: row.course_title,
//           status: row.course_status,

//           description: row.course_description,
//           category: row.category_name,
//           level: row.level,
//           duration: row.duration,

//           tutor: row.tutor_name,

//           total_modules: Number(row.total_modules),
//           enrolled_students: Number(row.enrolled_count),

//           modules: []
//         };
//       }

//       const course = courses[row.course_id];

//       // MODULE
//       let module = course.modules.find(
//         m => m.module_id === row.module_id
//       );

//       if (!module && row.module_id) {

//         module = {
//           module_id: row.module_id,
//           module_title: row.module_title,
//           videos: []
//         };

//         course.modules.push(module);
//       }

//       // VIDEO
//       if (row.module_video_id && module) {

//         module.videos.push({
//           module_video_id: row.module_video_id,
//           video_title: row.video_title,
//           status: row.video_status
//         });
//       }
//     }


//     return res.status(200).json({
//       statusCode: 200,
//       message: "Admin courses fetched successfully",
//       data: Object.values(courses)
//     });


//   } catch (error) {

//     console.error("getadmintotalcourse Error:", error);

//     return res.status(500).json({
//       statusCode: 500,
//       message: "Internal Server Error"
//     });
//   }
// };


// exports.getadmintotalcourse = async (req, res) => {

//   const { status } = req.body;

//   try {

//     const query = `

//       SELECT

//         -- COURSE
//         tc.course_id,
//         tc.course_title,
//         tc.course_description,
//         tc.duration,
//         tc.level,
//         tc.status AS course_status,

//         -- CATEGORY
//         tcg.category_name,

//         -- TUTOR
//         tut.full_name AS tutor_name,

//         -- MODULE
//         tm.module_id,
//         tm.module_title,

//         -- VIDEO
//         tmv.module_video_id,
//         tmv.video_title,
//         tmv.status AS video_status,

//         -- ASSIGNMENT
//         ta.assignment_id,
//         ta.assignment_title,
//         ta.assignment_type,
//         ta.total_questions,
//         ta.total_marks,
//         ta.pass_percentage,
//         ta.status AS assignment_status,
//         ta.assignment_date,
//         ta.reason AS assignment_reason,

//         -- QUESTION
//         tq.question_id,
//         tq.question,
//         tq.a,
//         tq.b,
//         tq.c,
//         tq.d,
//         tq.answer,

//         -- STUDENTS
//         COUNT(DISTINCT tsc.student_id) AS enrolled_count,

//         -- TOTAL MODULES
//         COALESCE(mc.total_modules, 0) AS total_modules


//       FROM tbl_course tc


//       -- CATEGORY
//       JOIN tbl_category tcg
//         ON tc.category_id = tcg.category_id


//       -- TUTOR
//       JOIN tbl_user tut
//         ON tc.tutor_id = tut.user_id
//        AND tut.role = 'tutor'


//       -- MODULE
//       JOIN tbl_module tm
//         ON tc.course_id = tm.course_id


//       -- VIDEOS (FILTER BY STATUS)
//       LEFT JOIN tbl_module_videos tmv
//         ON tm.module_id = tmv.module_id
//        AND tmv.status = $1


//       -- ASSIGNMENT (FILTER BY STATUS)
//       LEFT JOIN tbl_assignment ta
//         ON tm.module_id = ta.module_id
//        AND ta.status = $1


//       -- QUESTIONS (NO STATUS FILTER)
//       LEFT JOIN tbl_questions tq
//         ON ta.assignment_id = tq.assignment_id


//       -- STUDENTS
//       LEFT JOIN tbl_student_course tsc
//         ON tc.course_id = tsc.course_id


//       -- MODULE COUNT
//       LEFT JOIN (
//         SELECT
//           course_id,
//           COUNT(DISTINCT module_id) AS total_modules
//         FROM tbl_module
//         GROUP BY course_id
//       ) mc ON mc.course_id = tc.course_id


//       GROUP BY
//         tc.course_id,
//         tc.course_title,
//         tc.course_description,
//         tc.duration,
//         tc.level,
//         tc.status,
//         tcg.category_name,
//         tut.full_name,

//         tm.module_id,
//         tm.module_title,

//         tmv.module_video_id,
//         tmv.video_title,
//         tmv.status,

//         ta.assignment_id,
//         ta.assignment_title,
//         ta.assignment_type,
//         ta.total_questions,
//         ta.total_marks,
//         ta.pass_percentage,
//         ta.status,
//         ta.assignment_date,
//         ta.reason,

//         tq.question_id,
//         tq.question,
//         tq.a,
//         tq.b,
//         tq.c,
//         tq.d,
//         tq.answer,

//         mc.total_modules
//     `;


//     const { rows } = await pool.query(query, [status]);

//     const courses = {};


//     // ---------- FORMAT RESPONSE ----------
//     for (const row of rows) {

//       /* ---------- COURSE ---------- */
//       if (!courses[row.course_id]) {

//         courses[row.course_id] = {

//           course_id: row.course_id,
//           course_title: row.course_title,
//           status: row.course_status,

//           description: row.course_description,
//           category: row.category_name,
//           level: row.level,
//           duration: row.duration,

//           tutor: row.tutor_name,

//           total_modules: Number(row.total_modules),
//           enrolled_students: Number(row.enrolled_count),

//           modules: []
//         };
//       }


//       const course = courses[row.course_id];


//       /* ---------- MODULE ---------- */
//       let module = course.modules.find(
//         m => m.module_id === row.module_id
//       );


//       if (!module && row.module_id) {

//         module = {

//           module_id: row.module_id,
//           module_title: row.module_title,
//           status: "Pending",

//           videos: [],
//           assignments: [] // ✅ IMPORTANT
//         };

//         course.modules.push(module);
//       }


//       /* ---------- VIDEO ---------- */
//       if (row.module_video_id && module) {

//         module.videos.push({

//           module_video_id: row.module_video_id,
//           video_title: row.video_title,
//           status: row.video_status
//         });
//       }


//       /* ---------- ASSIGNMENT ---------- */
//       if (row.assignment_id && module) {

//         let assignment = module.assignments.find(
//           a => a.assignment_id === row.assignment_id
//         );


//         if (!assignment) {

//           assignment = {

//             assignment_id: row.assignment_id,
//             title: row.assignment_title,
//             type: row.assignment_type,

//             total_questions: row.total_questions,
//             total_marks: row.total_marks,
//             pass_percentage: row.pass_percentage,

//             status: row.assignment_status,
//             date: row.assignment_date,
//             reason: row.assignment_reason,

//             questions: []
//           };

//           module.assignments.push(assignment);
//         }


//         /* ---------- QUESTION ---------- */
//         if (row.question_id) {

//           assignment.questions.push({

//             question_id: row.question_id,
//             question: row.question,

//             options: {
//               a: row.a,
//               b: row.b,
//               c: row.c,
//               d: row.d
//             },

//             answer: row.answer
//           });
//         }
//       }

//     }


//     return res.status(200).json({

//       statusCode: 200,
//       message: "Admin courses fetched successfully",
//       data: Object.values(courses)

//     });


//   } catch (error) {

//     console.error("getadmintotalcourse Error:", error);

//     return res.status(500).json({

//       statusCode: 500,
//       message: "Internal Server Error"

//     });
//   }
// };

exports.getadmintotalcourse = async (req, res) => {

  const { status } = req.body;

  if (!status) {
    return res.status(401).json({
      statusCode: 401,
      message: 'Missing Required Field'
    })
  }

  try {

    const query = `

      SELECT

        -- COURSE
        tc.course_id,
        tc.course_title,
        tc.course_description,
        tc.duration,
        tc.level,
        tc.status AS course_status,

        -- CATEGORY
        tcg.category_name,

        -- TUTOR
        tut.full_name AS tutor_name,

        -- MODULE
        tm.module_id,
        tm.module_title,

        -- VIDEO
        tmv.module_video_id,
        tmv.video_title,
        tmv.status AS video_status,

        -- ASSIGNMENT
        ta.assignment_id,
        ta.assignment_title,
        ta.assignment_type,
        ta.total_questions,
        ta.total_marks,
        ta.pass_percentage,
        ta.status AS assignment_status,
        ta.assignment_date,
        ta.reason AS assignment_reason,

      

        -- STUDENTS
        COUNT(DISTINCT tsc.student_id) AS enrolled_count,

        -- TOTAL MODULES
        COALESCE(mc.total_modules, 0) AS total_modules


      FROM tbl_course tc


      -- CATEGORY
      JOIN tbl_category tcg
        ON tc.category_id = tcg.category_id


      -- TUTOR
      JOIN tbl_user tut
        ON tc.tutor_id = tut.user_id
       AND tut.role = 'tutor'


      -- MODULE
      JOIN tbl_module tm
        ON tc.course_id = tm.course_id


      -- VIDEOS (FILTER BY STATUS)
      LEFT JOIN tbl_module_videos tmv
        ON tm.module_id = tmv.module_id
       AND tmv.status = $1


      -- ASSIGNMENT (FILTER BY STATUS)
      LEFT JOIN tbl_assignment ta
        ON tm.module_id = ta.module_id
       AND ta.status = $1

 
      -- STUDENTS
      LEFT JOIN tbl_student_course tsc
        ON tc.course_id = tsc.course_id


      -- MODULE COUNT
      LEFT JOIN (
        SELECT
          course_id,
          COUNT(DISTINCT module_id) AS total_modules
        FROM tbl_module
        GROUP BY course_id
      ) mc ON mc.course_id = tc.course_id

      WHERE (
        tmv.module_video_id IS NOT NULL
        OR ta.assignment_id IS NOT NULL
      )
    
      GROUP BY
        tc.course_id,
        tc.course_title,
        tc.course_description,
        tc.duration,
        tc.level,
        tc.status,
        tcg.category_name,
        tut.full_name,

        tm.module_id,
        tm.module_title,

        tmv.module_video_id,
        tmv.video_title,
        tmv.status,

        ta.assignment_id,
        ta.assignment_title,
        ta.assignment_type,
        ta.total_questions,
        ta.total_marks,
        ta.pass_percentage,
        ta.status,
        ta.assignment_date,
        ta.reason,

  

        mc.total_modules
    `;


    const { rows } = await pool.query(query, [status]);

    const courses = {};


    // ---------- FORMAT RESPONSE ----------
    for (const row of rows) {

      /* ---------- COURSE ---------- */
      if (!courses[row.course_id]) {

        courses[row.course_id] = {

          course_id: row.course_id,
          course_title: row.course_title,
          status: row.course_status,

          description: row.course_description,
          category: row.category_name,
          level: row.level,
          duration: row.duration,

          tutor: row.tutor_name,

          total_modules: Number(row.total_modules),
          enrolled_students: Number(row.enrolled_count),

          modules: []
        };
      }


      const course = courses[row.course_id];


      /* ---------- MODULE ---------- */
      let module = course.modules.find(
        m => m.module_id === row.module_id
      );


          if (
          !module &&
          row.module_id &&
          (row.module_video_id || row.assignment_id)
        ) {

          module = {

            module_id: row.module_id,
            module_title: row.module_title,
            status: row.video_status,

            videos: [],
            assignments: []
          };

        course.modules.push(module);
      }


      /* ---------- VIDEO ---------- */
      if (row.module_video_id && module) {

        module.videos.push({

          module_video_id: row.module_video_id,
          video_title: row.video_title,
          status: row.video_status
        });
      }


      /* ---------- ASSIGNMENT ---------- */
   /* ---------- ASSIGNMENT ---------- */
      if (row.assignment_id && module) {

        let assignment = module.assignments.find(
          a => a.assignment_id === row.assignment_id
        );

        if (!assignment) {

          assignment = {
            assignment_id: row.assignment_id,

            // ✅ Module Info inside assignment
            module_id: row.module_id,
            module_title: row.module_title,

            title: row.assignment_title,
            type: row.assignment_type,

            total_questions: row.total_questions,
            total_marks: row.total_marks,
            pass_percentage: row.pass_percentage,

            status: row.assignment_status,
            date: row.assignment_date,
            reason: row.assignment_reason,
          };

          module.assignments.push(assignment);
        }
      }


    }


      const result = Object.values(courses);

    if (result.length === 0) {
      return res.status(200).json({
        statusCode: 200,
        message: "No courses found",
        data: []
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Admin courses fetched successfully",
      data: result
    });



  } catch (error) {

    console.error("getadmintotalcourse Error:", error);

    return res.status(500).json({

      statusCode: 500,
      message: "Internal Server Error"

    });
  }
};

exports.updateadminassignmentstatus = async (req, res) => {

  const { assignment_id, status, reason } = req.body;

  if (!assignment_id || !status) {
    return res.status(400).json({
      statusCode: 400,
      message: "assignment_id and status are required"
    });
  }

  try {

    // Update assignment
    const updateResult = await pool.query(
      `UPDATE tbl_assignment
       SET status = $1, reason = $2
       WHERE assignment_id = $3
       RETURNING module_id`,
      [status, reason, assignment_id]
    );


    if (updateResult.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Assignment not found"
      });
    }


    const module_id = updateResult.rows[0].module_id;


    // Get course_id
    const courseResult = await pool.query(
      `SELECT course_id FROM tbl_module WHERE module_id = $1`,
      [module_id]
    );

    const course_id = courseResult.rows[0].course_id;


    // ✅ Auto update course
    await updateCourseStatusIfReady(course_id);


    return res.status(200).json({
      statusCode: 200,
      message: "Assignment status updated successfully"
    });


  } catch (error) {

    console.log(error);

    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};




const updateCourseStatusIfReady = async (course_id) => {

  const result = await pool.query(`

    SELECT

      COUNT(DISTINCT CASE
        WHEN tmv.status != 'Published' THEN tmv.module_video_id
      END) AS pending_videos,

      COUNT(DISTINCT CASE
        WHEN ta.status != 'Published' THEN ta.assignment_id
      END) AS pending_assignments

    FROM tbl_course tc

    JOIN tbl_module tm
      ON tc.course_id = tm.course_id

    LEFT JOIN tbl_module_videos tmv
      ON tm.module_id = tmv.module_id

    LEFT JOIN tbl_assignment ta
      ON tm.module_id = ta.module_id

    WHERE tc.course_id = $1

  `, [course_id]);


  const { pending_videos, pending_assignments } = result.rows[0];


  // ✅ If all approved → Publish course
  if (pending_videos == 0 && pending_assignments == 0) {

    await pool.query(
      `UPDATE tbl_course
       SET status = 'Published'
       WHERE course_id = $1`,
      [course_id]
    );

  } else {

    // Optional: keep Pending if something not approved
    await pool.query(
      `UPDATE tbl_course
       SET status = 'Pending'
       WHERE course_id = $1`,
      [course_id]
    );
  }
};

exports.getModuleVideoById = async (req, res) => {

  const { module_video_id } = req.body;

  try {

    if (!module_video_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "module_video_id is required"
      });
    }

    const query = `
      SELECT
        module_video_id,
        module_id,
        video,
        video_title,
        status,
        reason,
        video_duration,
        module_video_created_at
      FROM tbl_module_videos
      WHERE module_video_id = $1
    `;

    const { rows } = await pool.query(query, [module_video_id]);

    if (rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Video not found"
      });
    }

    const videoData = rows[0];

    // Generate signed URL
    const signedUrl = await getSignedVideoUrl(videoData.video);

    return res.status(200).json({
      statusCode: 200,
      message: "Video fetched successfully",
      data: {
        ...videoData,
        video_url: signedUrl
      }
    });

  } catch (error) {
     return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};