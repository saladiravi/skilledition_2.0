const pool = require('../config/db');
const { uploadToS3, getSignedVideoUrl, deletefroms3 } = require('../utils/s3upload');

exports.getprofile = async (req, res) => {
  const { user_id } = req.body;

  try {
    const result = await pool.query(`
      SELECT 
        tu.user_id AS user_id,
        tu.full_name,
        tu.email AS user_email,
        tu.role,
       
        tu.created_at,

        ts.student_id,
        ts.mobile_number,
        ts.gender,
        ts.date_of_birth,
        ts.college,
        ts.qualification,
        ts.year_of_passing,
        ts.address,
        ts.pincode,
        ts.profile_image
      FROM tbl_user tu
      LEFT JOIN tbl_student ts
        ON tu.user_id::bigint = ts.user_id
      WHERE tu.user_id = $1
    `, [user_id]);

    if (!result.rows.length) {
      return res.status(404).json({
        statusCode: 404,
        message: "User Not Found"
      });
    }

    let userData = result.rows[0];

    // 🔥 Generate signed URL if profile image exists
    if (userData.profile_image) {
      const signedUrl = await getSignedVideoUrl(userData.profile_image);
      userData.profile_image = signedUrl;
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Fetched Successfully",
      data: userData
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};


// exports.updateprofile = async (req, res) => {
//   try {
//     const { user_id } = req.body;

//     if (!user_id) {
//       return res.status(400).json({
//         statusCode: 400,
//         message: "user_id is required"
//       });
//     }

//     // 🔹 Check if student exists
//     let checkStudent = await pool.query(
//       `SELECT * FROM tbl_student WHERE user_id = $1`,
//       [user_id]
//     );

//     // 🔥 If NOT exist → create empty student record
//     if (checkStudent.rows.length === 0) {
//       await pool.query(
//         `INSERT INTO tbl_student (user_id) VALUES ($1)`,
//         [user_id]
//       );

//       // Fetch again
//       checkStudent = await pool.query(
//         `SELECT * FROM tbl_student WHERE user_id = $1`,
//         [user_id]
//       );
//     }

//     let profile_pic_key = checkStudent.rows[0].profile_image;

//     if (req.file) {
//       profile_pic_key = await uploadToS3(
//         req.file,
//         "users/profile_image"
//       );
//     }

//     await pool.query(
//       `
//       UPDATE tbl_student
//       SET 
//           mobile_number = $1,
//           gender = $2,
//           date_of_birth = $3,
//           college = $4,
//           qualification = $5,
//           year_of_passing = $6,
//           address = $7,
//           pincode = $8,
//           profile_image = $9
//       WHERE user_id = $10
//       `,
//       [
     
//         req.body.mobile_number,
//         req.body.gender,
//         req.body.date_of_birth,
//         req.body.college,
//         req.body.qualification,
//         req.body.year_of_passing,
//         req.body.address,
//         req.body.pincode,
//         profile_pic_key,
//         user_id
//       ]
//     );

//     return res.status(200).json({
//       statusCode: 200,
//       message: "Profile updated successfully"
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       statusCode: 500,
//       message: "Internal Server Error"
//     });
//   }
// };


exports.updateprofile = async (req, res) => {
  try {
    const { user_id, full_name } = req.body;

    if (!user_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "user_id is required"
      });
    }

    // 🔹 Check if student exists
    let checkStudent = await pool.query(
      `SELECT * FROM tbl_student WHERE user_id = $1`,
      [user_id]
    );

    // 🔥 If NOT exist → create empty student record
    if (checkStudent.rows.length === 0) {
      await pool.query(
        `INSERT INTO tbl_student (user_id) VALUES ($1)`,
        [user_id]
      );

      checkStudent = await pool.query(
        `SELECT * FROM tbl_student WHERE user_id = $1`,
        [user_id]
      );
    }

    let profile_pic_key = checkStudent.rows[0].profile_image;

    if (req.file) {
      profile_pic_key = await uploadToS3(
        req.file,
        "users/profile_image"
      );
    }

    // ✅ 1️⃣ Update full_name in tbl_user
    if (full_name) {
      await pool.query(
        `UPDATE tbl_user SET full_name = $1 WHERE user_id = $2`,
        [full_name, user_id]
      );
    }

    // ✅ 2️⃣ Update tbl_student
    await pool.query(
      `
      UPDATE tbl_student
      SET 
          mobile_number = $1,
          gender = $2,
          date_of_birth = $3,
          college = $4,
          qualification = $5,
          year_of_passing = $6,
          address = $7,
          pincode = $8,
          profile_image = $9
      WHERE user_id = $10
      `,
      [
        req.body.mobile_number,
        req.body.gender,
        req.body.date_of_birth,
        req.body.college,
        req.body.qualification,
        req.body.year_of_passing,
        req.body.address,
        req.body.pincode,
        profile_pic_key,
        user_id
      ]
    );

    return res.status(200).json({
      statusCode: 200,
      message: "Profile updated successfully"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};