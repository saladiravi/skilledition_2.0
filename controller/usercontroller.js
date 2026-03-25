const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { uploadToS3, getSignedVideoUrl } = require('../utils/s3upload');
require("dotenv").config();
const { sendOtpMail } = require('../utils/mail');
const jwt_secret = process.env.JWT_SECRET;



exports.addUser = async (req, res) => {
  const { full_name, email,phone_number, password, role, otp } = req.body;

  // ✅ Validation
  if (!full_name || !email || !phone_number || !password || !role || !otp) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Missing Required Fields',
    });
  }

  try {
    const otpResult = await pool.query(
      `SELECT * FROM tbl_email_otp 
       WHERE email=$1 AND otp=$2
       ORDER BY created_at DESC LIMIT 1`,
      [email, otp]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Invalid OTP',
      });
    }

    const otpData = otpResult.rows[0];

    // ✅ Check expiry
    if (new Date() > otpData.expires_at) {
      return res.status(400).json({
        statusCode: 400,
        message: 'OTP expired',
      });
    }

    // 🔥 OPTIONAL (good practice): delete OTP after success
    await pool.query(
      `DELETE FROM tbl_email_otp WHERE email=$1`,
      [email]
    );

    // ✅ Check email exists
    const emailExists = await pool.query(
      `SELECT email FROM tbl_user WHERE email=$1`,
      [email]
    );

    if (emailExists.rows.length > 0) {
      return res.status(409).json({
        statusCode: 409,
        message: 'Email already registered',
      });
    }

    // ✅ Hash password
    const hashedpassword = await bcrypt.hash(password, 10);

    let studentRegNumber = null;

    // 🎯 Generate student_reg_number only for students
    if (role === 'student') {

      const lastStudent = await pool.query(`
        SELECT student_reg_number 
        FROM tbl_user
        WHERE role = 'student' 
        AND student_reg_number IS NOT NULL
        ORDER BY student_reg_number DESC
        LIMIT 1
      `);

      if (lastStudent.rows.length > 0) {
        const lastReg = lastStudent.rows[0].student_reg_number; // SE-A001

        // Extract number part
        const numberPart = parseInt(lastReg.split('A')[1]);

        const nextNumber = numberPart + 1;

        // Format with leading zeros
        studentRegNumber = `SE26-A${String(nextNumber).padStart(3, '0')}`;

      } else {
        // First student
        studentRegNumber = 'SE26-A001';
      }
    }

    // ✅ Insert user
    const newUser = await pool.query(
      `INSERT INTO tbl_user(full_name,email,phone_number,password,role,student_reg_number) 
       VALUES($1,$2,$3,$4,$5,$6) 
       RETURNING *`,
      [full_name, email, phone_number,hashedpassword, role, studentRegNumber]
    );

    return res.status(200).json({
      statusCode: 200,
      message: 'Registered successfully',
      data: newUser.rows[0],
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
    });
  }
};


// exports.loginUser = async (req, res) => {
//   const { email, password } = req.body;

//   if (!email || !password) {
//     return res.status(400).json({
//       statusCode: 400,
//       message: 'Email and password are required'
//     });
//   }

//   try {
//     const result = await pool.query(
//       `SELECT * FROM tbl_user WHERE email=$1
//       AND role IN ('student', 'tutor')`,
//       [email]
//     );

//     // FIX: Check if user exists
//     if (result.rows.length === 0) {
//       return res.status(404).json({
//         statusCode: 404,
//         message: 'User not found'
//       });
//     }

//     const user = result.rows[0];

//     // Compare passwords
//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) {
//       return res.status(401).json({
//         statusCode: 401,
//         message: 'Invalid password'
//       });
//     }

//     // FIX: Correct JWT payload
//     const token = jwt.sign(
//       {
//         id: user.user_id,
//         email: user.email,
//         role: user.role
//       },
//       jwt_secret,
//       { expiresIn: '24h' }
//     );

//     return res.status(200).json({
//       statusCode: 200,
//       message: 'Login successfully',
//       token,
//       user
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       statusCode: 500,
//       message: 'Internal server error'
//     });
//   }
// };


exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Email and password are required'
    });
  }

  try {
    const result = await pool.query(
      `SELECT 
        u.*,

        CASE 
          WHEN sc.student_id IS NOT NULL THEN true
          ELSE false
        END AS overview_unlocked

      FROM tbl_user u

      LEFT JOIN (
        SELECT DISTINCT student_id 
        FROM tbl_student_course
      ) sc
      ON sc.student_id = u.user_id

      WHERE u.email = $1
      AND u.role IN ('student', 'tutor')`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Invalid password'
      });
    }

    // 👉 Only for student
    if (user.role !== 'student') {
      user.overview_unlocked = null;
    }

    const token = jwt.sign(
      {
        id: user.user_id,
        email: user.email,
        role: user.role
      },
      jwt_secret,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      statusCode: 200,
      message: 'Login successfully',
      token,
      user
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};


exports.adminloginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Email and password are required'
    });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM tbl_user WHERE email=$1
      AND role='admin'`,
      [email]
    );

    // FIX: Check if user exists
    if (result.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Invalid password'
      });
    }

    // FIX: Correct JWT payload
    const token = jwt.sign(
      {
        id: user.user_id,
        email: user.email,
        role: user.role
      },
      jwt_secret,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      statusCode: 200,
      message: 'Login successfully',
      token,
      user: {
        user_id: user.user_id,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};


exports.getuser = async (req, res) => {
  const { user_id } = req.body

  try {

    const user = await pool.query(`SELECT full_name,role,status,student_reg_number FROM tbl_user WHERE user_id=$1`, [user_id]);
    return res.status(200).json({
      statusCode: 200,
      message: 'Fetched Sucessfully',
      user: user.rows[0]
    })
  } catch (error) {
    return res.status(500).json({
      message: 500,
      statusCode: 'Internal Server Error'
    })
  }
}



exports.changePassword = async (req, res) => {

  const { user_id: userId, currentPassword, newPassword, confirmNewPassword } = req.body;

  // 1️⃣ Validate input
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return res.status(400).json({
      statusCode: 400,
      message: "All fields are required"
    });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({
      statusCode: 400,
      message: "New password and confirm password do not match"
    });
  }

  try {
    // 2️⃣ Get user from DB
    const userResult = await pool.query(
      `SELECT password FROM tbl_user WHERE user_id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "User not found"
      });
    }

    const storedPassword = userResult.rows[0].password;

    // 3️⃣ Compare current password
    const isMatch = await bcrypt.compare(currentPassword, storedPassword);

    if (!isMatch) {
      return res.status(401).json({
        statusCode: 401,
        message: "Current password is incorrect"
      });
    }

    // 4️⃣ Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 5️⃣ Update password
    await pool.query(
      `UPDATE tbl_user SET password = $1 WHERE user_id = $2`,
      [hashedPassword, userId]
    );

    // 6️⃣ Success response
    res.status(200).json({
      statusCode: 200,
      message: "Password updated successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      statusCode: 500,
      message: "Internal server error"
    });
  }
};



exports.getTutorBankDetails = async (req, res) => {
  const { user_id } = req.body; // or req.user.user_id (JWT)

  if (!user_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "user_id is required"
    });
  }

  try {
    const result = await pool.query(
      `SELECT
        account_holder_name,
        bank_name,
        account_number,
        ifsc_code,
        upi_id,
        pan_number,
        billing_address
       FROM tbl_tutor
       WHERE user_id = $1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Tutor details not found"
      });
    }

    res.status(200).json({
      statusCode: 200,
      message: 'Fetched Sucessfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      statusCode: 500,
      message: "Internal server error"
    });
  }
};



exports.updateTutorBankDetails = async (req, res) => {
  const {
    user_id,
    account_holder_name,
    bank_name,
    account_number,
    ifsc_code,
    upi_id,
    pan_number,
    billing_address
  } = req.body;

  if (
    !user_id ||
    !account_holder_name ||
    !bank_name ||
    !account_number ||
    !ifsc_code ||
    !pan_number ||
    !billing_address
  ) {
    return res.status(400).json({
      statusCode: 400,
      message: "Required fields are missing"
    });
  }

  try {
    const result = await pool.query(
      `UPDATE tbl_tutor
       SET
         account_holder_name = $1,
         bank_name = $2,
         account_number = $3,
         ifsc_code = $4,
         upi_id = $5,
         pan_number = $6,
         billing_address = $7
       WHERE user_id = $8
       RETURNING tutor_id`,
      [
        account_holder_name,
        bank_name,
        account_number,
        ifsc_code,
        upi_id || null,
        pan_number,
        billing_address,
        user_id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Tutor not found"
      });
    }

    res.status(200).json({
      statusCode: 200,
      message: "Bank details updated successfully"
    });

  } catch (error) {

    res.status(500).json({
      statusCode: 500,
      message: "Internal server error"
    });
  }
};


exports.getProfile = async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "user_id is required"
    });
  }

  try {
    const result = await pool.query(
      `
        SELECT 
          tt.profile_pic,
          tu.full_name,
          tu.email,
          te.degree,
          tt.professional_background,
          tt.subject_to_teach,
          tt.phone_number
        FROM tbl_user AS tu
        JOIN tbl_tutor AS tt 
          ON tu.user_id = tt.user_id
        JOIN tbl_tutor_education AS te 
          ON tt.tutor_id = te.tutor_id
        WHERE tu.user_id = $1
          AND te.year_of_passout = (
            SELECT MAX(year_of_passout)
            FROM tbl_tutor_education
            WHERE tutor_id = tt.tutor_id
          )
        `,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Profile not found"
      });
    }

    const profile = result.rows[0];

    // Generate signed URL if profile pic exists
    if (profile.profile_pic) {
      profile.profile_pic = await getSignedVideoUrl(profile.profile_pic);
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Fetched successfully",
      data: profile
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};



exports.updateProfile = async (req, res) => {
  const {
    user_id,
    full_name,
    professional_background,
    subject_to_teach,
    phone_number
  } = req.body;

  if (!user_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "user_id is required"
    });
  }

  try {
    let profile_pic_key = null;

    // Upload profile picture to S3 (if provided)
    if (req.files?.profile_pic?.length > 0) {
      profile_pic_key = await uploadToS3(
        req.files.profile_pic[0],
        "users/profile_pics"
      );
    }

    /* -------------------- Update tbl_user -------------------- */
    if (full_name) {
      await pool.query(
        `UPDATE tbl_user SET full_name = $1 WHERE user_id = $2`,
        [full_name, user_id]
      );
    }

    /* -------------------- Update tbl_tutor -------------------- */
    const query = `
      UPDATE tbl_tutor
      SET 
       
        professional_background = COALESCE($1, professional_background),
        subject_to_teach = COALESCE($2, subject_to_teach),
        profile_pic = COALESCE($3, profile_pic),
        phone_number = COALESCE($4, phone_number)
      WHERE user_id = $5
      RETURNING user_id, profile_pic, phone_number;
    `;

    const values = [

      professional_background,
      subject_to_teach,
      profile_pic_key,
      phone_number,
      user_id
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Tutor not found"
      });
    }

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



exports.sendOTP = async (req, res) => {
  const { email } = req.body;

  // ✅ Validation
  if (!email) {
    return res.status(400).json({
      statusCode: 400,
      message: "Email is required"
    });
  }

  try {
    // ✅ Check email already exists
    const emailExists = await pool.query(
      `SELECT email FROM tbl_user WHERE email=$1`,
      [email]
    );

    if (emailExists.rows.length > 0) {
      return res.status(409).json({
        statusCode: 409,
        message: "Email already registered"
      });
    }

    // ✅ Generate OTP (6 digit)
    const otp = Math.floor(100000 + Math.random() * 900000);

    // ✅ Remove old OTPs for this email (important)
    await pool.query(
      `DELETE FROM tbl_email_otp WHERE email=$1`,
      [email]
    );

    // ✅ Store new OTP (5 minutes expiry)
    await pool.query(
      `INSERT INTO tbl_email_otp (email, otp, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
      [email, otp]
    );

    // ✅ Send Email
    await sendOtpMail(email, otp);

    return res.status(200).json({
      statusCode: 200,
      message: "OTP sent successfully"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal server error"
    });
  }
};