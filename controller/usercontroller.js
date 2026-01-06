const pool =require('../config/db');
const bcrypt=require('bcryptjs');
const jwt = require('jsonwebtoken');
require("dotenv").config();

const jwr_secret = process.env.JWT_SECRET;



exports.addUser = async (req, res) => {
  const { full_name,email, password,role } = req.body;

  if (!full_name || !email  || !password,!role) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Missing Require Fields',
    });
  }

  try {
    const emailExists = await pool.query(`SELECT email FROM tbl_user WHERE email=$1`,[email]);
   
    if (emailExists.rows.length >0) {
      return res.status(409).json({
        statusCode: 409,
        message: 'Email already registered',
      });
    }

    const hashedpassword=await bcrypt.hash(password,10)
    const newUser = await pool.query(`INSERT INTO tbl_user(full_name,email,password,role) VALUES($1,$2,$3,$4) RETURNING *`,
        [full_name,email,hashedpassword,role]
    )

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
      `SELECT * FROM tbl_user WHERE email=$1`,
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
      jwr_secret,
      { expiresIn: '12h' }
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




exports.getuser=async(req,res)=>{
  const {user_id} =req.body
  
  try{
     const exittutor=await pool.query(`SELECT role FROM tbl_user WHERE user_id=$1 AND role=$2`,[user_id,'tutor']);
     if(exittutor.rows.length ===0){
      return res.status(404).json({
        statusCode:404,
        message:'Tutor Not Found'
      })
     }
      const user=await pool.query(`SELECT full_name,role,status FROM tbl_user WHERE user_id=$1`,[user_id]);
      return res.status(200).json({
        statusCode:200,
        message:'Fetched Sucessfully',
        user:user.rows[0]
      })
  }catch(error){
    return res.status(500).json({
      statusCode:'Internal Server Error'
    })
  }
}



exports.changePassword = async (req, res) => {
 
  const {  user_id: userId,currentPassword, newPassword, confirmNewPassword } = req.body;

  // 1️⃣ Validate input
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return res.status(400).json({
      message: "All fields are required"
    });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({
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
        message: "User not found"
      });
    }

    const storedPassword = userResult.rows[0].password;

    // 3️⃣ Compare current password
    const isMatch = await bcrypt.compare(currentPassword, storedPassword);

    if (!isMatch) {
      return res.status(401).json({
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
      message: "Password updated successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error"
    });
  }
};



exports.getTutorBankDetails = async (req, res) => {
  const { user_id } = req.body; // or req.user.user_id (JWT)

  if (!user_id) {
    return res.status(400).json({ message: "user_id is required" });
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
        message: "Tutor details not found"
      });
    }

    res.status(200).json({
      status: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
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
      statusCode:400,
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
        statusCode:404,
        message: "Tutor not found"
      });
    }

    res.status(200).json({
      statusCode:200,
      message: "Bank details updated successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error"
    });
  }
};
