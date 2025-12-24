const pool = require('../config/db');
const {uploadToS3,getSignedVideoUrl} =require('../utils/s3upload');
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
           VALUES ($1, $2, $3, $4, 'pending')`,
          [module_id, videoUrl, videoTitle, formattedDuration]
        );

        videoCount++;
      }

      moduleResults.push({
        module_id,
        videos_uploaded: videoCount
      });
    }

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

        const updateResult = await pool.query(
            `UPDATE tbl_module_videos
             SET status = $1, reason = $2
             WHERE module_video_id = $3`,
            [status, reason, module_video_id]
        );

        if (updateResult.rowCount === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: "Module video not found"
            });
        }

        return res.status(200).json({
            statusCode: 200,
            message: "Status updated successfully"
        });

    } catch (error) {
        console.log(error);
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

        COUNT(DISTINCT tsc.student_id) AS enrolled_count

      FROM tbl_course tc
      JOIN tbl_category tcg 
        ON tc.category_id = tcg.category_id

      LEFT JOIN tbl_module tm 
        ON tc.course_id = tm.course_id

      LEFT JOIN tbl_module_videos tmv
        ON tm.module_id = tmv.module_id
       AND tmv.status IN ('pending', 'published', 'rejected')

      LEFT JOIN tbl_student_course tsc
        ON tc.course_id = tsc.course_id

      WHERE tc.tutor_id = $1

      GROUP BY
        tc.course_id,
        tcg.category_id,
        tm.module_id,
        tmv.module_video_id;
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
          modules: []
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
        module.videos.push({
          module_video_id: row.module_video_id,
          video: row.video,
          video_title: row.video_title,
          status: row.video_status,
          reason: row.reason,
          video_duration: row.video_duration
        });
      }
    }


    for (const course of Object.values(coursesMap)) {
      for (const module of course.modules) {
        const rejectedVideos = module.videos.filter(
          v => v.status === 'rejected'
        );


        if (rejectedVideos.length > 0) {
          module.videos = rejectedVideos;
        }
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


exports.updateModuleVideos = async (req, rees) => {
  const { module_id, module_video_id } = req.body;

  if (!module_id || !module_video_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "module_id and module_video_id are required"
    });
  }

  // Ensure module_video_id is array
  const videoIds = Array.isArray(module_video_id)
    ? module_video_id
    : [module_video_id];

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      statusCode: 400,
      message: "No video files uploaded"
    });
  }

  if (videoIds.length !== req.files.length) {
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
      return res.status(404).json({ message: "Module not found" });
    }

    let updatedCount = 0;

    // 2️⃣ Update videos one by one (ID-based)
    for (let i = 0; i < videoIds.length; i++) {
      const file = req.files[i];
      const mvId = videoIds[i];

      // Ensure this video belongs to module & is rejected
      const checkVideo = await client.query(
        `
        SELECT module_video_id
        FROM tbl_module_videos
        WHERE module_video_id = $1
          AND module_id = $2
          AND status = 'rejected'
        `,
        [mvId, module_id]
      );

      if (checkVideo.rowCount === 0) {
        continue; // skip invalid / non-rejected videos
      }

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
          status = 'pending',
          reason = NULL
        WHERE module_video_id = $4
        `,
        [videoUrl, videoTitle, formattedDuration, mvId]
      );

      updatedCount++;
    }

    await client.query("COMMIT");

    return res.status(200).json({
      statusCode: 200,
      message: "Module videos updated successfully",
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