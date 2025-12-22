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