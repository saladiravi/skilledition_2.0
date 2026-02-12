const pool = require('../config/db');


exports.getprofile = async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Missing Required Field'
    });
  }

  try {

  const result = await pool.query(`
  SELECT 
    tu.email,
    tu.role,
    ts.*
  FROM tbl_user AS tu
  JOIN tbl_student AS ts 
    ON tu.user_id = ts.user_id
  WHERE tu.user_id = $1
    AND LOWER(tu.role) = 'student'
`, [user_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Student Not Found'
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: 'Fetched Successfully',
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


exports.updateprofile = async (req, res) => {
  try {
    const {
      student_id,
      first_name,
      last_name,
      mobile_number,
      gender,
      date_of_birth,
      college,
      qualification,
      year_of_passing,
      address,
      pincode
    } = req.body;

    if (!student_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "student_id is required"
      });
    }

    // ✅ Check student exists
    const checkStudent = await pool.query(
      `SELECT * FROM tbl_student WHERE student_id = $1`,
      [student_id]
    );

    if (checkStudent.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Student not found"
      });
    }

    let profile_pic_key = checkStudent.rows[0].profile_image; // keep old image

    // ✅ Upload profile picture to S3 (if provided)
    if (req.files?.profile_image?.length > 0) {
      profile_pic_key = await uploadToS3(
        req.files.profile_image[0],
        "users/profile_image"
      );
    }

    // ✅ Update student profile
    await pool.query(
      `
      UPDATE tbl_student
      SET first_name = $1,
          last_name = $2,
          modile_number = $3,
          gender = $4,
          date_of_birth = $5,
          college = $6,
          qualification = $7,
          year_of_passing = $8,
          address = $9,
          pincode = $10,
          profile_image = $11
      WHERE student_id = $12
      `,
      [
        first_name,
        last_name,
        mobile_number,
        gender,
        date_of_birth,
        college,
        qualification,
        year_of_passing,
        address,
        pincode,
        profile_pic_key,
        student_id
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