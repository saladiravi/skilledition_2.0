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


exports.updateprofile = async (req, res) => {
  try {
    const { user_id, full_name } = req.body;

    if (!user_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "user_id is required"
      });
    }

    const mobile_number = req.body.mobile_number || null;
    const gender = req.body.gender || null;
    const date_of_birth = req.body.date_of_birth || null;
    const college = req.body.college || null;
    const qualification = req.body.qualification || null;
    const year_of_passing = req.body.year_of_passing || null;
    const address = req.body.address || null;
    const pincode = req.body.pincode || null;

    let checkStudent = await pool.query(
      `SELECT * FROM tbl_student WHERE user_id=$1`,
      [user_id]
    );

    if (checkStudent.rows.length === 0) {
      await pool.query(
        `INSERT INTO tbl_student (user_id) VALUES ($1)`,
        [user_id]
      );
    }

    let profile_pic_key = checkStudent.rows?.[0]?.profile_image || null;

    if (req.file) {
      profile_pic_key = await uploadToS3(req.file, "users/profile_image");
    }

    if (full_name) {
      await pool.query(
        `UPDATE tbl_user SET full_name=$1 WHERE user_id=$2`,
        [full_name, user_id]
      );
    }

    await pool.query(
      `UPDATE tbl_student
       SET mobile_number=$1,
           gender=$2,
           date_of_birth=$3,
           college=$4,
           qualification=$5,
           year_of_passing=$6,
           address=$7,
           pincode=$8,
           profile_image=$9
       WHERE user_id=$10`,
      [
        mobile_number,
        gender,
        date_of_birth,
        college,
        qualification,
        year_of_passing,
        address,
        pincode,
        profile_pic_key,
        user_id
      ]
    );

    return res.status(200).json({
      statusCode: 200,
      message: "Profile updated successfully"
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};


exports.getStudentAccess = async (req, res) => {
  const { student_id } = req.body;

  try {
    // ✅ 1. Validation
    if (!student_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "student_id is required"
      });
    }

    // ✅ 2. Check student exists
    const studentCheck = await pool.query(
      `SELECT user_id FROM tbl_user WHERE user_id = $1 AND role = 'student'`,
      [student_id]
    );

    if (studentCheck.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Student not found"
      });
    }

    // ✅ 3. Locking Query
    const result = await pool.query(`
      SELECT
         CASE 
              WHEN sc.student_id IS NOT NULL THEN true
              ELSE false
          END AS overview_unlocked,

          CASE 
              WHEN sc.student_id IS NOT NULL THEN true
              ELSE false
          END AS assignment_unlocked,

          CASE 
              WHEN sc.student_id IS NOT NULL THEN true
              ELSE false
          END AS chat_unlocked,

          CASE 
              WHEN cert.student_id IS NOT NULL THEN true
              ELSE false
          END AS certificate_unlocked,

          CASE 
              WHEN cert.student_id IS NOT NULL THEN true
              ELSE false
          END AS internship_unlocked

      FROM (SELECT $1::int AS student_id) input

      LEFT JOIN (
          SELECT DISTINCT student_id 
          FROM tbl_student_course
      ) sc
        ON sc.student_id = input.student_id

      LEFT JOIN (
          SELECT DISTINCT student_id 
          FROM tbl_certificates
      ) cert
        ON cert.student_id = input.student_id
    `, [student_id]);

    // ✅ 4. Success response
    return res.status(200).json({
      statusCode: 200,
      message: "Student access fetched successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};