const express = require('express');
const pool = require('../config/db');
const { uploadToS3, getSignedVideoUrl } = require('../utils/s3upload');





exports.addtutorAbout = async (req, res) => {
  const {
    country,
    subject_to_teach,
    speak_language,
    level,
    user_id
  } = req.body;

  if (

    !country || !subject_to_teach || !speak_language ||
    !user_id
  ) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Missing required fields'
    });
  }

  try {


    const query = `
      INSERT INTO tbl_tutor
      (country, subject_to_teach, speak_language,
        user_id,level)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *;
    `;

    const values = [
      country,
      subject_to_teach,
      speak_language,
      user_id,
      level
    ];

    const result = await pool.query(query, values);

    return res.status(200).json({
      statusCode: 200,
      message: "Tutor added successfully",
      tutor: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};

exports.updateTutorabout = async (req, res) => {
  try {
    const {
      tutor_id,
      country,
      subject_to_teach,
      speak_language,
      level
    } = req.body;

    if (!tutor_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "tutor_id is required"
      });
    }

    // 1️⃣ Check tutor exists
    const exists = await pool.query(
      `SELECT tutor_id FROM tbl_tutor WHERE tutor_id = $1`,
      [tutor_id]
    );

    if (exists.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Tutor not found"
      });
    }

    // 2️⃣ Update tutor
    const updateQuery = `
      UPDATE tbl_tutor
      SET
        country = COALESCE($1, country),
        subject_to_teach = COALESCE($2, subject_to_teach),
        speak_language = COALESCE($3, speak_language),
        level = COALESCE($4, level)
       
      WHERE tutor_id = $5
      RETURNING *;
    `;

    const values = [
      country,
      subject_to_teach,
      speak_language,
      level,
      tutor_id
    ];

    const result = await pool.query(updateQuery, values);

    return res.status(200).json({
      statusCode: 200,
      message: "Tutor updated successfully",
      tutor: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};

exports.updateTutorProfessionalDetails = async (req, res) => {
  try {
    const {
      tutor_id,
      years_of_experience,
      professional_background,
      achievements
    } = req.body;

    if (!tutor_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "tutor_id is required"
      });
    }

    // 1️⃣ Check tutor exists
    const exists = await pool.query(
      `SELECT tutor_id FROM tbl_tutor WHERE tutor_id = $1`,
      [tutor_id]
    );

    if (exists.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Tutor not found"
      });
    }

    // 2️⃣ Update professional details
    const updateQuery = `
      UPDATE tbl_tutor
      SET
        years_of_experience = COALESCE($1, years_of_experience),
        professional_background = COALESCE($2, professional_background),
        achievements = COALESCE($3, achievements)
      
      WHERE tutor_id = $4
      RETURNING tutor_id,
                years_of_experience,
                professional_background,
                achievements;
    `;

    const values = [
      years_of_experience,
      professional_background,
      achievements,
      tutor_id
    ];

    const result = await pool.query(updateQuery, values);

    return res.status(200).json({
      statusCode: 200,
      message: "Professional details updated successfully",
      tutor: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};


exports.getTutorProfilePic = async (req, res) => {
  const { tutor_id } = req.body;

  if (!tutor_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "tutor_id is required"
    });
  }

  try {
    const query = `
      SELECT profile_pic
      FROM tbl_tutor
      WHERE tutor_id = $1
    `;

    const result = await pool.query(query, [tutor_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Tutor not found"
      });
    }

    let profilePicUrl = null;

    if (result.rows[0].profile_pic) {
      profilePicUrl = await getSignedVideoUrl(
        result.rows[0].profile_pic
      );
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Profile picture fetched successfully",
      profile_pic: profilePicUrl
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};

exports.updateTutorProfilePic = async (req, res) => {
  const { tutor_id } = req.body;

  if (!tutor_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "tutor_id is required"
    });
  }

  try {
    let profile_pic_key = null;

    // Upload profile picture to S3
    if (req.files?.profile_pic?.length > 0) {
      profile_pic_key = await uploadToS3(
        req.files.profile_pic[0],
        "users/profile_pics"
      );
    }

    if (!profile_pic_key) {
      return res.status(400).json({
        statusCode: 400,
        message: "Profile picture not provided"
      });
    }

    const query = `
      UPDATE tbl_tutor
      SET profile_pic = $1
          
      WHERE tutor_id = $2
      RETURNING tutor_id, profile_pic;
    `;

    const values = [profile_pic_key, tutor_id];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Tutor not found"
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Profile picture updated successfully",
      tutor: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};






exports.addCertificates = async (req, res) => {
  try {
    const { tutor_id, certificates } = req.body;

    if (!tutor_id || !certificates) {
      return res.status(400).json({
        statusCode: 400,
        message: "Missing tutor_id or certificates"
      });
    }

    let certificateList;
    try {
      certificateList = JSON.parse(certificates);
    } catch (err) {
      return res.status(400).json({
        message: "Invalid certificates JSON format"
      });
    }

    if (!req.files || !req.files.certificate_file) {
      return res.status(400).json({
        statusCode: 400,
        message: "Certificate files are required"
      });
    }

    const files = req.files.certificate_file;

    if (files.length !== certificateList.length) {
      return res.status(400).json({
        message: "Number of files & certificate details mismatch"
      });
    }

    let insertedRows = [];

    for (let i = 0; i < certificateList.length; i++) {
      const file = files[i];
      const cert = certificateList[i];

      const certificateKey = await uploadToS3(file, 'tutors/certificates');
      const query = `
        INSERT INTO tbl_tutor_certificates
        (tutor_id, certificate_name, issued_by, date_of_issue, certificate_file)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const values = [
        tutor_id,
        cert.certificate_name,
        cert.issued_by,
        cert.date_of_issue,
        certificateKey
      ];

      const result = await pool.query(query, values);
      insertedRows.push(result.rows[0]);
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Certificates added successfully",
      certificates: insertedRows
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};

exports.updateTutorCertificates = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { tutor_id, certificates } = req.body;

    if (!tutor_id || !certificates) {
      return res.status(400).json({
        statusCode: 400,
        message: "tutor_id and certificates are required"
      });
    }

    const certificateList = JSON.parse(certificates);
    // const files = req.files?.certificate_file || [];
    const filesMap = {};
    (req.files || []).forEach(file => {
      filesMap[file.fieldname] = file;
    });
    // 1️⃣ Fetch existing IDs from DB
    const existing = await client.query(
      `SELECT tutor_certificate_id
       FROM tbl_tutor_certificates
       WHERE tutor_id = $1`,
      [tutor_id]
    );

    const existingIds = existing.rows.map(
      r => r.tutor_certificate_id.toString()
    );

    // 2️⃣ IDs sent from frontend
    const sentIds = certificateList
      .filter(c => c.tutor_certificate_id)
      .map(c => c.tutor_certificate_id.toString());

    // 3️⃣ DELETE missing IDs (DB - Request)
    const idsToDelete = existingIds.filter(
      id => !sentIds.includes(id)
    );

    if (idsToDelete.length > 0) {
      await client.query(
        `DELETE FROM tbl_tutor_certificates
         WHERE tutor_id = $1
         AND tutor_certificate_id = ANY($2::int[])`,
        [tutor_id, idsToDelete]
      );
    }

    const resultData = [];

    // 4️⃣ UPDATE & INSERT
    for (let i = 0; i < certificateList.length; i++) {
      const cert = certificateList[i];
      const {
        tutor_certificate_id,
        certificate_name,
        issued_by,
        date_of_issue
      } = cert;

      let certificateKey = null;

      const file = filesMap[cert.file_key];
      if (file) {
        certificateKey = await uploadToS3(file, "tutors/certificates");
      }

      // UPDATE
      if (tutor_certificate_id) {
        const old = await client.query(
          `SELECT certificate_file
           FROM tbl_tutor_certificates
           WHERE tutor_certificate_id = $1 AND tutor_id = $2`,
          [tutor_certificate_id, tutor_id]
        );

        if (old.rowCount === 0) continue;

        const finalFile =
          certificateKey || old.rows[0].certificate_file;

        const update = await client.query(
          `UPDATE tbl_tutor_certificates
           SET certificate_name = $1,
               issued_by = $2,
               date_of_issue = $3,
               certificate_file = $4
               
           WHERE tutor_certificate_id = $5 AND tutor_id = $6
           RETURNING *`,
          [
            certificate_name,
            issued_by,
            date_of_issue,
            finalFile,
            tutor_certificate_id,
            tutor_id
          ]
        );

        resultData.push(update.rows[0]);
      }
      // INSERT
      else {
        const insert = await client.query(
          `INSERT INTO tbl_tutor_certificates
           (tutor_id, certificate_name, issued_by, date_of_issue, certificate_file)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            tutor_id,
            certificate_name,
            issued_by,
            date_of_issue,
            certificateKey
          ]
        );

        resultData.push(insert.rows[0]);
      }
    }

    await client.query("COMMIT");

    return res.status(200).json({
      statusCode: 200,
      message: "Certificates synced successfully",
      data: resultData
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

exports.addEducation = async (req, res) => {
  try {
    const { tutor_id, education } = req.body;

    if (!tutor_id || !education) {
      return res.status(400).json({
        statusCode: 400,
        message: "Missing tutor_id or education array"
      });
    }

    let educationList;

    if (typeof education === "string") {
      try {
        educationList = JSON.parse(education);
      } catch (err) {
        return res.status(400).json({
          message: "Invalid education JSON format"
        });
      }
    } else if (Array.isArray(education)) {
      educationList = education;
    } else {
      return res.status(400).json({
        message: "Education must be JSON array"
      });
    }

    let insertedRows = [];

    for (let edu of educationList) {
      const query = `
        INSERT INTO tbl_tutor_education
        (tutor_id, degree, institution, specialization, year_of_passout)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const values = [
        tutor_id,
        edu.degree,
        edu.institution,
        edu.specialization,
        edu.year_of_passout
      ];

      const result = await pool.query(query, values);
      insertedRows.push(result.rows[0]);
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Education details added successfully",
      education: insertedRows
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};


exports.updateEducation = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { tutor_id, education } = req.body;

    if (!tutor_id || !education) {
      return res.status(400).json({
        statusCode: 400,
        message: "Missing tutor_id or education array"
      });
    }

    // Parse education safely
    let educationList;
    if (typeof education === "string") {
      educationList = JSON.parse(education);
    } else if (Array.isArray(education)) {
      educationList = education;
    } else {
      return res.status(400).json({
        message: "Education must be an array"
      });
    }

    /* 1️⃣ Fetch existing education IDs */
    const existing = await client.query(
      `SELECT tutor_education_id
       FROM tbl_tutor_education
       WHERE tutor_id = $1`,
      [tutor_id]
    );

    const existingIds = existing.rows.map(r =>
      r.tutor_education_id.toString()
    );

    /* 2️⃣ IDs sent from frontend */
    const sentIds = educationList
      .filter(e => e.tutor_education_id)
      .map(e => e.tutor_education_id.toString());

    /* 3️⃣ DELETE removed education */
    const idsToDelete = existingIds.filter(
      id => !sentIds.includes(id)
    );

    if (idsToDelete.length > 0) {
      await client.query(
        `DELETE FROM tbl_tutor_education
         WHERE tutor_id = $1
         AND tutor_education_id = ANY($2::int[])`,
        [tutor_id, idsToDelete]
      );
    }

    const resultData = [];

    /* 4️⃣ UPDATE & INSERT */
    for (const edu of educationList) {
      const {
        tutor_education_id,
        degree,
        institution,
        specialization,
        year_of_passout
      } = edu;

      // UPDATE
      if (tutor_education_id) {
        const update = await client.query(
          `UPDATE tbl_tutor_education
           SET degree = $1,
               institution = $2,
               specialization = $3,
               year_of_passout = $4
             
           WHERE tutor_education_id = $5 AND tutor_id = $6
           RETURNING *`,
          [
            degree,
            institution,
            specialization,
            year_of_passout,
            tutor_education_id,
            tutor_id
          ]
        );

        if (update.rowCount > 0) {
          resultData.push(update.rows[0]);
        }
      }
      // INSERT
      else {
        const insert = await client.query(
          `INSERT INTO tbl_tutor_education
           (tutor_id, degree, institution, specialization, year_of_passout)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            tutor_id,
            degree,
            institution,
            specialization,
            year_of_passout
          ]
        );

        resultData.push(insert.rows[0]);
      }
    }

    await client.query("COMMIT");

    return res.status(200).json({
      statusCode: 200,
      message: "Education details synced successfully",
      education: resultData
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


exports.getTutorOnboarding = async (req, res) => {
  const { user_id } = req.body;

  try {
    // 1️⃣ Get user + tutor (LEFT JOIN)
    const tutorRes = await pool.query(
      `
      SELECT 
        u.user_id,
        u.full_name,
        u.email,
        t.tutor_id,
        t.country,
        t.subject_to_teach,
        t.speak_language,
        u.phone_number,
        t.profile_pic,
        t.years_of_experience,
        t.professional_background,
        t.achievements,
        t.reject_reason,
        t.level
      FROM tbl_user u
      LEFT JOIN tbl_tutor t ON t.user_id = u.user_id
      WHERE u.user_id = $1
      `,
      [user_id]
    );

    // ❌ No user at all
    if (tutorRes.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "User not found"
      });
    }

    let tutor = tutorRes.rows[0];

    // ✅ If tutor not created yet
    if (!tutor.tutor_id) {
      return res.status(200).json({
        statusCode: 200,
        message: "User exists but tutor onboarding not completed",
        fullname: tutor.full_name,
        reject_reason: tutor.reject_reason,
        tutor: {

          tutor_details: tutor, // contains full_name, email
          education: [],
          certificates: [],
          demo_video: null,
          payment_plan: null
        }
      });
    }

    const tutor_id = tutor.tutor_id;

    // ✅ Profile pic URL
    if (tutor.profile_pic) {
      tutor.profile_pic_url = await getSignedVideoUrl(tutor.profile_pic);
    }

    // 2️⃣ Education
    const educationRes = await pool.query(
      `SELECT tutor_education_id, degree, institution, specialization, year_of_passout
       FROM tbl_tutor_education
       WHERE tutor_id = $1`,
      [tutor_id]
    );

    // 3️⃣ Certificates
    const certificateRes = await pool.query(
      `SELECT tutor_certificate_id, certificate_name, issued_by, date_of_issue, certificate_file
       FROM tbl_tutor_certificates
       WHERE tutor_id = $1`,
      [tutor_id]
    );

    const certificates = await Promise.all(
      certificateRes.rows.map(async (cert) => {
        if (cert.certificate_file) {
          cert.certificate_file_url = await getSignedVideoUrl(cert.certificate_file);
        }
        return cert;
      })
    );

    // 4️⃣ Demo Video
    const demoVideoRes = await pool.query(
      `
      SELECT
        demo_video_id,
        tutor_id,
        video_title,
        video_description,
        video_file,
        short_bio,
        teaching_style,
        student_can_expect,
        demo_video_reject_reason,
        demo_video_created_at
      FROM tbl_demo_videos
      WHERE tutor_id = $1
      `,
      [tutor_id]
    );

    let demo_video = null;

    if (demoVideoRes.rows.length > 0) {
      demo_video = demoVideoRes.rows[0];



      if (demo_video.video_file) {
        demo_video.video_file_url = await getSignedVideoUrl(demo_video.video_file);
      }
    }

    // 5️⃣ Payment Plan
    const paymentPlanRes = await pool.query(
      `
      SELECT
        p.payment_plan_id,
        p.plan_type,
        p.price,
        p.royalty_percentage,
        p.status,
        t.upi_id
      FROM tbl_tutor_payment_plan p
      JOIN tbl_tutor t ON t.tutor_id = p.tutor_id
      WHERE p.tutor_id = $1
      ORDER BY p.payment_plan_id DESC
      LIMIT 1
      `,
      [tutor_id]
    );

    const payment_plan =
      paymentPlanRes.rows.length > 0 ? paymentPlanRes.rows[0] : null;

    // ✅ Final response
    return res.status(200).json({
      statusCode: 200,
      message: "Fetched successfully",
      fullname: tutor.full_name,
      reject_reason: tutor.reject_reason,
      tutor: {
        tutor_details: tutor,
        education: educationRes.rows,
        certificates,
        demo_video,
        payment_plan
      }
    });

  } catch (err) {

    return res.status(500).json({
      statusCode: 500,
      message: "Server error",
      error: err.message
    });
  }
};

exports.addDemoVideo = async (req, res) => {
  try {
    const { tutor_id, video_title, video_description } = req.body;

    if (!tutor_id || !video_title || !video_description) {
      return res.status(400).json({
        statusCode: 400,
        message: "Missing required fields"
      });
    }

    if (!req.files?.video_file?.length) {
      return res.status(400).json({
        statusCode: 400,
        message: "Video file is required"
      });
    }

    const video_file_key = await uploadToS3(
      req.files.video_file[0],
      "tutors/demo_videos"
    );

    const query = `
      INSERT INTO tbl_demo_videos
      (tutor_id, video_title, video_description, video_file)
      VALUES ($1, $2, $3, $4)
      RETURNING demo_video_id
    `;

    const values = [
      tutor_id,
      video_title,
      video_description,
      video_file_key
    ];

    const result = await pool.query(query, values);

    return res.status(200).json({
      statusCode: 200,
      message: "Demo video added successfully",
      demo_video_id: result.rows[0].demo_video_id

    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};



exports.updateDemoVideo = async (req, res) => {
  try {
    const {
      demo_video_id,
      tutor_id,
      video_title,
      video_description
    } = req.body;

    if (!demo_video_id || !tutor_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "demo_video_id and tutor_id are required"
      });
    }

    // 1️⃣ Check existing video
    const existing = await pool.query(
      `SELECT video_file
       FROM tbl_demo_videos
       WHERE demo_video_id = $1 AND tutor_id = $2`,
      [demo_video_id, tutor_id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Demo video not found"
      });
    }

    let videoFileKey = existing.rows[0].video_file;

    // 2️⃣ Upload new video if provided
    if (req.files?.video_file?.length > 0) {
      videoFileKey = await uploadToS3(
        req.files.video_file[0],
        "tutors/demo_videos"
      );
    }

    // 3️⃣ Update record
    const updateQuery = `
      UPDATE tbl_demo_videos
      SET
        video_title = COALESCE($1, video_title),
        video_description = COALESCE($2, video_description),
        video_file = $3,
        status = 'pending'
         
      WHERE demo_video_id = $4 AND tutor_id = $5
      RETURNING *
    `;

    const values = [
      video_title,
      video_description,
      videoFileKey,
      demo_video_id,
      tutor_id
    ];

    const result = await pool.query(updateQuery, values);

    return res.status(200).json({
      statusCode: 200,
      message: "Demo video updated successfully",
      demo_video: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};

exports.updateDemoVideoProfileDetails = async (req, res) => {
  const {
    demo_video_id,
    short_bio,
    teaching_style,
    student_can_expect
  } = req.body;

  if (!demo_video_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "demo_video_id is required"
    });
  }

  try {
    const query = `
      UPDATE tbl_demo_videos
      SET
        short_bio = $1,
        teaching_style = $2,
        student_can_expect=$3
        
      WHERE demo_video_id = $4
      RETURNING demo_video_id
    `;

    const values = [
      short_bio || null,
      teaching_style || null,
      student_can_expect || null,
      demo_video_id
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Demo video not found"
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Profile details updated successfully",

    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};



exports.addpaymentplan = async (req, res) => {
  const {
    tutor_id,
    demo_id,
    plan_type,
    royalty_percentage,
    price,
    upi_id
  } = req.body;

  try {
    // 1️⃣ Validation
    if (!tutor_id || !demo_id || !plan_type || !price) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Missing required fields'
      });
    }

    if (plan_type === 'ROYALTY' && !royalty_percentage) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Royalty percentage is required for royalty plan'
      });
    }

    const tutorCheck = await pool.query(
      `SELECT tutor_id FROM tbl_tutor WHERE tutor_id = $1`,
      [tutor_id]
    );

    if (tutorCheck.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Tutor not found'
      });
    }
    // 2️⃣ Insert payment plan
    await pool.query(
      `
      INSERT INTO tbl_tutor_payment_plan
      (tutor_id, demo_id, plan_type, royalty_percentage, price)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        tutor_id,
        demo_id,
        plan_type,
        plan_type === 'ROYALTY' ? royalty_percentage : null,
        price
      ]
    );

    // 3️⃣ Update tutor UPI ID
    if (upi_id) {
      await pool.query(
        `
        UPDATE tbl_tutor
        SET upi_id = $1
        WHERE tutor_id = $2
        `,
        [upi_id, tutor_id]
      );
    }

    return res.status(200).json({
      statusCode: 200,
      message: 'Payment plan added successfully'
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
    });
  }
};

exports.updatePaymentPlan = async (req, res) => {
  const {
    payment_plan_id,   // REQUIRED to update
    tutor_id,
    demo_id,
    plan_type,
    royalty_percentage,
    price,
    upi_id
  } = req.body;

  try {
    // 1️⃣ Validation
    if (!payment_plan_id || !tutor_id || !demo_id || !plan_type || !price) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Missing required fields'
      });
    }

    if (plan_type === 'ROYALTY' && !royalty_percentage) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Royalty percentage is required for royalty plan'
      });
    }

    // 2️⃣ Check payment plan exists
    const planCheck = await pool.query(
      `
      SELECT payment_plan_id
      FROM tbl_tutor_payment_plan
      WHERE payment_plan_id = $1 AND tutor_id = $2
      `,
      [payment_plan_id, tutor_id]
    );

    if (planCheck.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Payment plan not found'
      });
    }

    // 3️⃣ Update payment plan
    await pool.query(
      `
      UPDATE tbl_tutor_payment_plan
      SET
        demo_id = $1,
        plan_type = $2,
        royalty_percentage = $3,
        price = $4
      WHERE payment_plan_id = $5
      `,
      [
        demo_id,
        plan_type,
        plan_type === 'ROYALTY' ? royalty_percentage : null,
        price,
        payment_plan_id
      ]
    );

    // 4️⃣ Update tutor UPI (optional)
    if (upi_id) {
      await pool.query(
        `
        UPDATE tbl_tutor
        SET upi_id = $1
        WHERE tutor_id = $2
        `,
        [upi_id, tutor_id]
      );
    }

    return res.status(200).json({
      statusCode: 200,
      message: 'Payment plan updated successfully'
    });

  } catch (error) {
    console.error('Update payment plan error:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
    });
  }
};


exports.updatestatus = async (req, res) => {
  const { demo_video_id, status, demo_video_reject_reason } = req.body;

  if (!demo_video_id || !status) {
    return res.status(400).json({
      statusCode: 400,
      message: "Missing Required Fields (demo_video_id, status)"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Get tutor_id from demo video
    const demoVideo = await client.query(
      `SELECT tutor_id 
       FROM tbl_demo_videos 
       WHERE demo_video_id = $1`,
      [demo_video_id]
    );

    if (demoVideo.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        statusCode: 404,
        message: "Demo video not found"
      });
    }

    const tutorId = demoVideo.rows[0].tutor_id;

    // 2️⃣ Get user_id from tbl_tutor
    const tutor = await client.query(
      `SELECT user_id 
       FROM tbl_tutor 
       WHERE tutor_id = $1`,
      [tutorId]
    );

    if (tutor.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        statusCode: 404,
        message: "Tutor not found"
      });
    }

    const userId = tutor.rows[0].user_id;

    // 3️⃣ Update demo video status
    const result = await client.query(
      `UPDATE tbl_demo_videos 
       SET 
         status = $1,
         demo_video_reject_reason = $2
       WHERE demo_video_id = $3
       RETURNING *`,
      [
        status,
        status === "rejected" ? demo_video_reject_reason : null,
        demo_video_id
      ]
    );

    // 4️⃣ ONLY when status = accept → update tbl_user
    if (status === "accept") {
      await client.query(
        `UPDATE tbl_user
         SET status = 'accept'
         WHERE user_id = $1`,
        [userId]
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      statusCode: 200,
      message: "Status Updated Successfully",
      data: {
        demo_video_id: result.rows[0].demo_video_id,
        status: result.rows[0].status,
        demo_video_reject_reason: result.rows[0].demo_video_reject_reason
      }
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

exports.getonboardstatus = async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Missing required field: user_id'
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT 
        tt.status,
        tt.reject_reason,
        tu.full_name
      FROM tbl_user AS tu
      JOIN tbl_tutor AS tt
        ON tu.user_id = tt.user_id
      WHERE tu.user_id = $1
        AND tu.role = 'tutor';
      `,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Tutor not found or user is not a tutor'
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: 'Fetched successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
    });
  }
};


exports.onboardnotification = async (req, res) => {
  const { sender_id, type, type_id, message, status } = req.body;

  try {
    // 1️⃣ Validation
    if (!sender_id || !type || !type_id || !message || !status) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Missing required fields'
      });
    }

    // 2️⃣ Insert notification
    await pool.query(
      `
      INSERT INTO tbl_notifications 
      (sender_id, type, receiver_id, type_id, message)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [sender_id, type, '15', type_id, message]
    );

    // 3️⃣ Update tutor status
    const tutorUpdate = await pool.query(
      `
      UPDATE tbl_tutor
      SET status = $1
      WHERE tutor_id = $2
      `,
      [status, type_id]
    );

    // Optional safety check
    if (tutorUpdate.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Tutor not found'
      });
    }

    // 4️⃣ Update user status
    await pool.query(
      `
      UPDATE tbl_user
      SET status = $1
      WHERE user_id = $2
      `,
      [status, sender_id]
    );

    return res.status(200).json({
      statusCode: 200,
      message: 'Notification sent and status updated successfully'
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
    });
  }
};



exports.getAllTutors = async (req, res) => {
  try {
    const query = `
        SELECT
            t.tutor_id,
            u.full_name,
            u.email,
            t.years_of_experience,
            te.degree,
            t.country,
            t.level,
            u.phone_number,
            u.status
            
        FROM tbl_tutor t
        JOIN tbl_user u 
            ON u.user_id = t.user_id
        JOIN tbl_tutor_education te 
            ON t.tutor_id = te.tutor_id
        WHERE u.role = 'tutor'
          AND te.year_of_passout = (
              SELECT MAX(year_of_passout)
              FROM tbl_tutor_education
              WHERE tutor_id = t.tutor_id
          )
         ORDER BY t.tutor_id ASC
      `;

    const { rows } = await pool.query(query);

    res.status(200).json({
      statusCode: 200,
      message: "Tutors fetched successfully",
      data: rows
    });

  } catch (error) {
    console.error("error:", error);
    res.status(500).json({
      statusCode: 500,
      message: "Internal server error"
    });
  }
};


exports.getTutorById = async (req, res) => {
  const { tutor_id } = req.body;

  try {
    const tutorQuery = `
          SELECT
            u.user_id,
            u.full_name,
            u.email,
            u.phone_number,
            u.status,
            u.created_at,
            t.tutor_id,
            t.country,
            t.subject_to_teach,
            t.speak_language,
            t.profile_pic,
            t.years_of_experience,
            t.professional_background,
            t.achievements,
            t.level,
            t.highest_qualification,
            t.professional_bio,
            t.status
        FROM tbl_user u
        JOIN tbl_tutor t 
            ON t.user_id = u.user_id
        WHERE t.tutor_id = $1
        AND u.role = 'tutor';
        `;

    const tutorResult = await pool.query(tutorQuery, [tutor_id]);

    if (tutorResult.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Tutor not found"
      });
    }

    const tutor = tutorResult.rows[0];

    /* 🔹 PROFILE PIC SIGNED URL */
    if (tutor.profile_pic) {
      tutor.profile_pic = await getSignedVideoUrl(tutor.profile_pic);
    }

    /* 🔹 EDUCATION */
    const educationResult = await pool.query(
      `SELECT * FROM tbl_tutor_education WHERE tutor_id = $1`,
      [tutor_id]
    );

    /* 🔹 CERTIFICATES + SIGNED FILE */
    const certificatesResult = await pool.query(
      `SELECT * FROM tbl_tutor_certificates WHERE tutor_id = $1`,
      [tutor_id]
    );

    const certificates = await Promise.all(
      certificatesResult.rows.map(async (cert) => {
        if (cert.certificate_file) {
          cert.certificate_file =
            await getSignedVideoUrl(cert.certificate_file);
        }
        return cert;
      })
    );

    /* 🔹 DEMO VIDEOS + SIGNED VIDEO FILE */
    const demoVideosResult = await pool.query(
      `SELECT * FROM tbl_demo_videos WHERE tutor_id = $1`,
      [tutor_id]
    );

    const demoVideos = await Promise.all(
      demoVideosResult.rows.map(async (video) => {
        if (video.video_file) {
          video.video_file =
            await getSignedVideoUrl(video.video_file);
        }
        return video;
      })
    );
    const paymentPlanResult = await pool.query(
      `SELECT 
            payment_plan_id,
            plan_type,
            price,
            royalty_percentage,
            created_at,
            tutor_id
        FROM tbl_tutor_payment_plan
        WHERE tutor_id = $1`,
      [tutor_id]
    );
    return res.status(200).json({
      statusCode: 200,
      message: "Tutor details fetched successfully",
      data: {
        tutor,
        education: educationResult.rows,
        certificates,
        demo_videos: demoVideos,
        payment_plans: paymentPlanResult.rows
      }
    });

  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      message: "Internal server error"
    });
  }
};



exports.getAllTutorbystatus = async (req, res) => {
  try {
    let { status } = req.body;

    // Clean & Validate status
    status = status?.trim();

    if (!status) {
      return res.status(400).json({
        statusCode: 400,
        message: "status is required"
      });
    }

    let query = '';
    let values = [status];

    // 🔴 REJECTED
    if (status === 'Rejected') {

      query = `
        SELECT
          t.tutor_id,
          u.full_name,
          u.email,
          t.subject_to_teach,
          t.status,
          TO_CHAR(t.rejected_at, 'DD-MM-YYYY') AS rejected_date,
          t.reject_reason,
          dv.short_bio

        FROM tbl_tutor t
        JOIN tbl_user u ON u.user_id = t.user_id
        LEFT JOIN tbl_demo_videos dv ON dv.tutor_id = t.tutor_id

        WHERE t.status = $1

        ORDER BY t.rejected_at DESC
      `;

    }

    // 🟡 PENDING
    else if (status === 'Pending') {

      query = `
        SELECT
          t.tutor_id,
          u.full_name,
          u.email,
          t.years_of_experience AS experience,
          t.subject_to_teach,
          t.status,

          COUNT(DISTINCT tc.tutor_certificate_id) AS certifications,
          COUNT(DISTINCT te.tutor_education_id) AS education,

          tp.plan_type,
          tp.royalty_percentage,
          tp.price,
          dv.short_bio,
 
          TO_CHAR(t.submitted_at AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12-MI AM') AS submitted_at,
          t.country

        FROM tbl_tutor t
        JOIN tbl_user u ON u.user_id = t.user_id

        LEFT JOIN tbl_tutor_certificates tc ON tc.tutor_id = t.tutor_id
        LEFT JOIN tbl_tutor_education te ON te.tutor_id = t.tutor_id
        LEFT JOIN tbl_demo_videos dv ON dv.tutor_id = t.tutor_id
        LEFT JOIN tbl_tutor_payment_plan tp ON tp.demo_id = dv.demo_video_id

        WHERE u.role = 'tutor'
          AND t.status = $1

        GROUP BY
          t.tutor_id,
          u.full_name,
          u.email,
          t.years_of_experience,
          t.subject_to_teach,
          t.status,
          t.country,
          t.submitted_at,
          tp.plan_type,
          tp.royalty_percentage,
          tp.price,
          dv.short_bio

        ORDER BY t.submitted_at DESC
      `;

    }

    // 🟢 PUBLISHED
    else if (status === 'Published') {

      query = `
        SELECT
          t.tutor_id,
          u.full_name,
          u.email,
          t.years_of_experience AS experience,
          t.subject_to_teach,
          t.status,

          COUNT(DISTINCT tc.tutor_certificate_id) AS certifications,
          COUNT(DISTINCT te.tutor_education_id) AS education,

       
          TO_CHAR(t.submitted_at AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12-MI AM') AS submitted_at,

          tp.plan_type,
          tp.royalty_percentage,
          tp.price,
          dv.short_bio,

          t.country

        FROM tbl_tutor t
        JOIN tbl_user u ON u.user_id = t.user_id

        LEFT JOIN tbl_tutor_certificates tc ON tc.tutor_id = t.tutor_id
        LEFT JOIN tbl_tutor_education te ON te.tutor_id = t.tutor_id
        LEFT JOIN tbl_demo_videos dv ON dv.tutor_id = t.tutor_id
        LEFT JOIN tbl_tutor_payment_plan tp ON tp.demo_id = dv.demo_video_id

        WHERE u.role = 'tutor'
          AND t.status = $1

        GROUP BY
          t.tutor_id,
          u.full_name,
          u.email,
          t.years_of_experience,
          t.subject_to_teach,
          t.status,
          t.country,
          t.submitted_at,
          tp.plan_type,
          tp.royalty_percentage,
          tp.price,
          dv.short_bio

        ORDER BY t.submitted_at DESC
      `;

    }

    // ❌ INVALID STATUS
    else {
      return res.status(400).json({
        statusCode: 400,
        message: "Invalid status value"
      });
    }

    // Execute Query
    const { rows } = await pool.query(query, values);

    return res.status(200).json({
      statusCode: 200,
        data: rows
    });

  } catch (error) {
  return res.status(500).json({
      statusCode: 500,
      message: "Internal server error"
    });

  }
};








exports.updateTutorStatus = async (req, res) => {
  const { tutor_id, status, reject_reason } = req.body;

  if (!tutor_id || !status) {
    return res.status(400).json({
      statusCode: 400,
      message: "tutor_id and status are required"
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let tutorQuery = '';
    let tutorValues = [];

    // 🟢 APPROVE
    if (status === 'Published' || status === 'Pending') {
      tutorQuery = `
        UPDATE tbl_tutor
        SET status = $1,
        submitted_at = NOW()
        WHERE tutor_id = $2
        RETURNING tutor_id, user_id, status
      `;
      tutorValues = [status, tutor_id];
    }

    // 🔴 REJECT
    else if (status === 'Rejected') {
      if (!reject_reason) {
        return res.status(400).json({
          statusCode: 400,
          message: "reject_reason is required when rejecting tutor"
        });
      }

      tutorQuery = `
        UPDATE tbl_tutor
        SET 
          status = $1,
          reject_reason = $2,
          rejected_at = NOW()
        WHERE tutor_id = $3
        RETURNING tutor_id, user_id, status
      `;
      tutorValues = [status, reject_reason, tutor_id];
    }
    else {
      return res.status(400).json({
        statusCode: 400,
        message: "Invalid status value"
      });
    }

    // 1️⃣ Update tutor
    const tutorResult = await client.query(tutorQuery, tutorValues);

    if (tutorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        statusCode: 404,
        message: "Tutor not found"
      });
    }

    const { user_id } = tutorResult.rows[0];

    // 2️⃣ Update user status automatically
    await client.query(
      `
      UPDATE tbl_user
      SET status = $1
      WHERE user_id = $2
      `,
      [status, user_id]
    );

    await client.query('COMMIT');

    res.status(200).json({
      statusCode: 200,
      message: `Tutor ${status} successfully`,
      data: tutorResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("error:", error);

    res.status(500).json({
      statusCode: 500,
      message: "Internal server error"
    });
  } finally {
    client.release();
  }
};




exports.gettutordetailsbyId = async (req, res) => {
  try {
    let { status, tutor_id } = req.body;

    status = status?.trim();

    if (!status) {
      return res.status(400).json({
        statusCode: 400,
        message: "status is required"
      });
    }

    let query = '';
    let values = [status];
    let condition = `t.status = $1`;

    // ✅ Optional tutor_id filter (from tbl_tutor)
    if (tutor_id) {
      values.push(tutor_id);
      condition += ` AND t.tutor_id = $2`;
    }

    // 🔴 REJECTED
    if (status === 'Rejected') {

      query = `
        SELECT
          t.tutor_id,
          u.user_id,
          u.full_name,
          u.email,
          t.subject_to_teach,
          t.status,
          TO_CHAR(t.rejected_at, 'Mon DD, YYYY') AS rejected_date,
          t.reject_reason,
          t.professional_bio AS description
        FROM tbl_tutor t
        JOIN tbl_user u ON u.user_id = t.user_id
        WHERE ${condition}
        ORDER BY t.rejected_at DESC
      `;
    }

    // 🟡 PENDING
    else if (status === 'Pending') {

      query = `
        SELECT
          t.tutor_id,
          u.user_id,
          u.full_name,
          u.email,
          t.years_of_experience AS experience,
          t.subject_to_teach,
          t.status,
          TO_CHAR(t.submitted_at,'DD/MM/YYYY') AS submitted_at,
        

          COUNT(DISTINCT tc.tutor_certificate_id) AS certifications,
          COUNT(DISTINCT te.tutor_education_id) AS education,

          tp.plan_type,
          tp.royalty_percentage,
          tp.price,
          dv.short_bio,
          t.country

        FROM tbl_tutor t
        JOIN tbl_user u ON u.user_id = t.user_id

        LEFT JOIN tbl_tutor_certificates tc 
          ON tc.tutor_id = t.tutor_id

        LEFT JOIN tbl_tutor_education te 
          ON te.tutor_id = t.tutor_id

        LEFT JOIN tbl_demo_videos dv 
          ON dv.tutor_id = t.tutor_id

        LEFT JOIN tbl_tutor_payment_plan tp 
          ON tp.demo_id = dv.demo_video_id

        WHERE u.role = 'tutor'
          AND ${condition}

        GROUP BY 
          t.tutor_id,
          u.user_id,
          u.full_name,
          u.email,
          t.years_of_experience,
          t.subject_to_teach,
          t.status,
          t.country,
           
          tp.plan_type,
          tp.royalty_percentage,
          tp.price,
          dv.short_bio

        ORDER BY t.submitted_at ASC
      `;
    }

    // 🟢 PUBLISHED
    else if (status === 'Published') {

      query = `
        SELECT
          t.tutor_id,
          u.user_id,
          u.full_name,
          u.email,
          t.years_of_experience AS experience,
          t.subject_to_teach,
          t.status,
          TO_CHAR(t.submitted_at,'DD/MM/YYYY') AS submitted_at,

          COUNT(DISTINCT tc.tutor_certificate_id) AS certifications,
          COUNT(DISTINCT te.tutor_education_id) AS education,

          tp.plan_type,
          tp.royalty_percentage,
          tp.price,
          dv.short_bio,
          t.country

        FROM tbl_tutor t
        JOIN tbl_user u ON u.user_id = t.user_id

        LEFT JOIN tbl_tutor_certificates tc 
          ON tc.tutor_id = t.tutor_id

        LEFT JOIN tbl_tutor_education te 
          ON te.tutor_id = t.tutor_id

        LEFT JOIN tbl_demo_videos dv 
          ON dv.tutor_id = t.tutor_id

        LEFT JOIN tbl_tutor_payment_plan tp 
          ON tp.demo_id = dv.demo_video_id

        WHERE u.role = 'tutor'
          AND ${condition}

        GROUP BY 
          t.tutor_id,
          u.user_id,
          u.full_name,
          u.email,
          t.years_of_experience,
          t.subject_to_teach,
          t.status,
          t.country,
         
          tp.plan_type,
          tp.royalty_percentage,
          tp.price,
          dv.short_bio
      `;
    }

    else {
      return res.status(400).json({
        statusCode: 400,
        message: "Invalid status value"
      });
    }

    const { rows } = await pool.query(query, values);

    return res.status(200).json({
      statusCode: 200,
      data: rows
    });

  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      message: "Internal server error"
    });
  }
};



exports.tutordashboards = async (req, res) => {
  const { tutor_id } = req.body
  try {
    const checktutor = await pool.query(`SELECT role,full_name FROM tbl_user WHERE user_id=$1`, [tutor_id]);
    if (checktutor.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Tutor Not Found'
      })
    }
    const statsQuery = `
        SELECT
        COUNT(DISTINCT c.course_id)
        FILTER (WHERE c.status = 'Published') AS total_courses,

        COUNT(DISTINCT sc.student_id) AS active_students,

        COUNT(DISTINCT tsfa.final_assignment_id)
        FILTER (WHERE tsfa.tutor_status = 'Pending') AS assignments_pending,

        ROUND(AVG(DISTINCT f.rating)::numeric,1) AS average_rating

        FROM tbl_course c

        LEFT JOIN tbl_student_course sc
        ON sc.course_id = c.course_id

        LEFT JOIN tbl_student_final_assignment tsfa
        ON tsfa.course_id = c.course_id

        LEFT JOIN tbl_feedback f
        ON f.course_id = c.course_id

        WHERE c.tutor_id = $1
    `;

    const recentAssignmentQuery = `
        SELECT
        u.full_name AS student,
        c.course_title,
        tsfa.assignment_title,
        TO_CHAR(tsfa.submitted_at,'DD/MM/YYYY') AS submitted,
        CASE
          WHEN tsfa.tutor_status = 'Pending' THEN 'Pending'
          ELSE 'Graded'
        END AS status
        FROM tbl_student_final_assignment tsfa
        JOIN tbl_user u ON tsfa.student_id = u.user_id
        JOIN tbl_course c ON tsfa.course_id = c.course_id
        WHERE c.tutor_id = $1
        ORDER BY tsfa.submitted_at DESC
        LIMIT 5
        `;

    const [statsResult, recentAssignments] = await Promise.all([
      pool.query(statsQuery, [tutor_id]),
      pool.query(recentAssignmentQuery, [tutor_id])
    ]);

    const tutor_name = checktutor.rows[0].full_name;
    return res.status(200).json({
      statusCode: 200,
      tutor_name: tutor_name,
      stats: statsResult.rows[0],
      recent_assignments: recentAssignments.rows
    });
  } catch (error) {

    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
    })
  }
}