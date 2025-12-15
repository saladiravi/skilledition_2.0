const express = require('express');
const pool = require('../config/db');
const { uploadToS3, getSignedVideoUrl} =require('../utils/s3upload');


// exports.addTutoronboard = async (req, res) => {
//   const {
//     first_name,
//     last_name,
//     email,
//     country,
//     subject_to_teach,
//     speak_language,
//     phone_number,
//     user_id
//   } = req.body;

//   if (
//     !first_name || !last_name || !email ||
//     !country || !subject_to_teach || !speak_language ||
//     !phone_number || !user_id
//   ) {
//     return res.status(400).json({
//       statusCode: 400,
//       message: 'Missing required fields'
//     });
//   }

//   try {
//     let profile_pic_key = null;

//     // Upload profile picture to S3
//     if (req.files?.profile_pic?.length > 0) {
//       profile_pic_key = await uploadToS3(
//         req.files.profile_pic[0],  
//         "users/profile_pics"       // folder name inside S3 bucket
//       );
//     }

//     const query = `
//       INSERT INTO tbl_tutor
//       (first_name, last_name, email, country, subject_to_teach, speak_language,
//        phone_number, profile_pic, user_id)
//       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
//       RETURNING *;
//     `;

//     const values = [
//       first_name,
//       last_name,
//       email,
//       country,
//       subject_to_teach,
//       speak_language,
//       phone_number,
//       profile_pic_key,  // store only S3 key
//       user_id
//     ];

//     const result = await pool.query(query, values);

//     return res.status(200).json({
//       statusCode: 200,
//       message: "Tutor added successfully",
//       tutor: result.rows[0]
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       statusCode: 500,
//       message: "Internal Server Error"
//     });
//   }
// };


  
exports.addTutoronboard = async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    country,
    subject_to_teach,
    speak_language,
    phone_number,
    level,
    user_id
  } = req.body;

  if (
    !first_name || !last_name || !email ||
    !country || !subject_to_teach || !speak_language ||
    !phone_number || !user_id  
  ) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Missing required fields'
    });
  }

  try {
    // let profile_pic_key = null;

    // // Upload profile picture to S3
    // if (req.files?.profile_pic?.length > 0) {
    //   profile_pic_key = await uploadToS3(
    //     req.files.profile_pic[0],
    //     "users/profile_pics"       // folder name inside S3 bucket
    //   );
    // }

    const query = `
      INSERT INTO tbl_tutor
      (first_name, last_name, email, country, subject_to_teach, speak_language,
       phone_number, user_id,level)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *;
    `;

    const values = [
      first_name,
      last_name,
      email,
      country,
      subject_to_teach,
      speak_language,
      phone_number,
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

exports.updateTutor = async (req, res) => {
  const { tutor_id } = req.body;

  const {
    first_name,
    last_name,
    email,
    country,
    subject_to_teach,
    speak_language,
    phone_number,
    years_of_experience,
    professional_background,
    achievements
  } = req.body;

  if (
    !first_name || !last_name || !email ||
    !country || !subject_to_teach || !speak_language ||
    !phone_number
  ) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Missing required fields'
    });
  }

  try {
    let updateFields = [
      'first_name=$1',
      'last_name=$2',
      'email=$3',
      'country=$4',
      'subject_to_teach=$5',
      'speak_language=$6',
      'phone_number=$7',
      'years_of_experience=$8',
      'professional_background=$9',
      'achievements=$10'
    ];

    let values = [
      first_name,
      last_name,
      email,
      country,
      subject_to_teach,
      speak_language,
      phone_number,
      years_of_experience || null,
      professional_background || null,
      achievements || null
    ];

    // Upload profile pic if provided
    if (req.file) {
      const profile_pic_key = await uploadToS3(req.file, 'users/profile_pics');
      updateFields.push(`profile_pic=$${values.length + 1}`);
      values.push(profile_pic_key);
    }

    // Add condition
    values.push(tutor_id);
    const query = `
      UPDATE tbl_tutor
      SET ${updateFields.join(', ')}
      WHERE tutor_id=$${values.length}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Tutor not found'
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: 'Tutor updated successfully',
      tutor: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
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




exports.getTutorOnboarding = async (req, res) => {
  const { user_id } = req.body;

  try {
    // 1️⃣ Get tutor basic details
    const tutorRes = await pool.query(
      `SELECT * FROM tbl_tutor WHERE user_id = $1`,
      [user_id]
    );

    if (tutorRes.rows.length === 0) {
      return res.json({
        success: false,
        message: "Tutor not found for this user_id"
      });
    }

    let tutor = tutorRes.rows[0];
    const tutor_id = tutor.tutor_id;

    // Convert profile_pic to signed URL if exists
    if (tutor.profile_pic) {
      tutor.profile_pic_url = await getSignedVideoUrl(tutor.profile_pic);
    }

    // 2️⃣ Education details
    const educationRes = await pool.query(
      `SELECT degree, institution, specialization, year_of_passout
       FROM tbl_tutor_education
       WHERE tutor_id = $1`,
      [tutor_id]
    );

    // 3️⃣ Certificates
    const certificateRes = await pool.query(
      `SELECT certificate_name, issued_by, date_of_issue, certificate_file
       FROM tbl_tutor_certificates
       WHERE tutor_id = $1`,
      [tutor_id]
    );

    // Convert certificate files to signed URLs
    const certificates = await Promise.all(
      certificateRes.rows.map(async (cert) => {
        if (cert.certificate_file) {
          cert.certificate_file_url = await getSignedVideoUrl(cert.certificate_file);
        }
        return cert;
      })
    );

    // 4️⃣ Demo video
    const demoVideoRes = await pool.query(
      `SELECT video_title, video_description, video_file, short_bio, teaching_style
       FROM tbl_demo_videos
       WHERE tutor_id = $1`,
      [tutor_id]
    );

    let demo_video = null;
    if (demoVideoRes.rows.length > 0) {
      demo_video = demoVideoRes.rows[0];
      if (demo_video.video_file) {
        demo_video.video_file_url = await getSignedVideoUrl(demo_video.video_file);
      }
    }

    return res.json({
      success: true,
      tutor: {
        tutor_details: tutor,
        education: educationRes.rows,
        certificates,
        demo_video
      }
    });

  } catch (err) {
    console.error("Get tutor error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
 
// exports.getTutorDetails = async (req, res) => {
//   const { tutor_id } = req.body;

//   if (!tutor_id) {
//     return res.status(400).json({
//       statusCode: 400,
//       message: 'tutor_id is required'
//     });
//   }

//   try {
//     // 1️⃣ Fetch tutor profile
//     const tutorQuery = 'SELECT * FROM tbl_tutor WHERE tutor_id=$1';
//     const tutorResult = await pool.query(tutorQuery, [tutor_id]);

//     if (tutorResult.rowCount === 0) {
//       return res.status(404).json({
//         statusCode: 404,
//         message: 'Tutor not found'
//       });
//     }

//     const tutor = tutorResult.rows[0];

//     // 2️⃣ Fetch certificates
//     const certQuery = 'SELECT * FROM tbl_tutor_certificates WHERE tutor_id=$1';
//     const certResult = await pool.query(certQuery, [tutor_id]);
//     const certificates = certResult.rows;

//     // 3️⃣ Fetch education details
//     const eduQuery = 'SELECT * FROM tbl_tutor_education WHERE tutor_id=$1';
//     const eduResult = await pool.query(eduQuery, [tutor_id]);
//     const education = eduResult.rows;

//     // 4️⃣ Fetch demo videos
//     const videoQuery = 'SELECT * FROM tbl_demo_videos WHERE tutor_id=$1';
//     const videoResult = await pool.query(videoQuery, [tutor_id]);
//     const demo_videos = await Promise.all(
//       videoResult.rows.map(async (video) => {
//         // Optionally, generate signed URL for video
//         if (video.video_file) {
//           video.video_url = await getSignedVideoUrl(video.video_file);
//         }
//         return video;
//       })
//     );

//     return res.status(200).json({
//       statusCode: 200,
//       message: 'Tutor details fetched successfully',
//       tutor: {
//         ...tutor,
//         certificates,
//         education,
//         demo_videos
//       }
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       statusCode: 500,
//       message: 'Internal Server Error'
//     });
//   }
// };


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

    return res.status(201).json({
      statusCode: 201,
      message: "Demo video added successfully",
      demo_video_id: result.rows[0].demo_video_id,
      next_step: "profile_details"
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
      video_description,
      short_bio,
      teaching_style,
      status,
      plan_type,
      royalty_percentage,
      price,
      bank_upi_data
    } = req.body;

    if (!demo_video_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "demo_video_id is required"
      });
    }

    // file upload
    let video_file_key = null;
    if (req.files && req.files.video_file && req.files.video_file.length > 0) {
      video_file_key = await uploadToS3(req.files.video_file[0], 'tutors/demo_videos');
    }

    // build dynamic SQL
    let updateFields = [];
    let values = [];
    let idx = 1;

    if (tutor_id) {
      updateFields.push(`tutor_id = $${idx++}`);
      values.push(tutor_id);
    }

    if (video_title) {
      updateFields.push(`video_title = $${idx++}`);
      values.push(video_title);
    }

    if (video_description) {
      updateFields.push(`video_description = $${idx++}`);
      values.push(video_description);
    }

    if (short_bio) {
      updateFields.push(`short_bio = $${idx++}`);
      values.push(short_bio);
    }

    if (teaching_style) {
      updateFields.push(`teaching_style = $${idx++}`);
      values.push(teaching_style);
    }

    if (status) {
      updateFields.push(`status = $${idx++}`);
      values.push(status);
    }

    if (plan_type) {
      updateFields.push(`plan_type = $${idx++}`);
      values.push(plan_type);
    }

    if (royalty_percentage) {
      updateFields.push(`royalty_percentage = $${idx++}`);
      values.push(royalty_percentage);
    }

    if (price) {
      updateFields.push(`price = $${idx++}`);
      values.push(price);
    }

    if (bank_upi_data) {
      updateFields.push(`bank_upi_data = $${idx++}`);
      values.push(bank_upi_data);
    }

    if (video_file_key) {
      updateFields.push(`video_file = $${idx++}`);
      values.push(video_file_key);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        statusCode: 400,
        message: "No fields to update"
      });
    }

    // Add condition
    values.push(demo_video_id);
    const query = `
      UPDATE tbl_demo_videos 
      SET ${updateFields.join(", ")}
      WHERE demo_video_id = $${idx}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Demo video not found"
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Demo video updated successfully",
      video: result.rows[0]
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
        status = $3,
        student_can_expect=$4
        
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


exports.updateDemoVideoPlanDetails = async (req, res) => {
  const {
    demo_video_id,
    plan_type,
    royalty_percentage,
    price,
    bank_upi_data
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
        plan_type = $1,
        royalty_percentage = $2,
        price = $3,
        bank_upi_data = $4
      
      WHERE demo_video_id = $5
      RETURNING demo_video_id
    `;

    const values = [
      plan_type || null,
      royalty_percentage || null,
      price || null,
      bank_upi_data || null,
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
      message: "Plan details updated successfully"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};


exports.updatestatus = async (req, res) => {
    const { demo_video_id, status } = req.body;

    if (!demo_video_id || !status) {
        return res.status(400).json({
            statusCode: 400,
            message: "Missing Required Fields (demo_video_id, status)"
        });
    }

    try {
        // Check record exists
        const exists = await pool.query(
            `SELECT demo_video_id FROM tbl_demo_videos WHERE demo_video_id = $1`,
            [demo_video_id]
        );

        if (exists.rows.length === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: "Demo video not found"
            });
        }

        // Update Status
        const result = await pool.query(
            `UPDATE tbl_demo_videos 
             SET status = $1 
             WHERE demo_video_id = $2
             RETURNING *`,
            [status, demo_video_id]
        );

        return res.status(200).json({
            statusCode: 200,
            message: "Status Updated Successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            statusCode: 500,
            message: "Internal Server Error"
        });
    }
};
