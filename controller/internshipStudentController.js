const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { sendforgotpasswordOtpMail } = require("../utils/mail");


exports.registerInternshipStudent = async (req, res) => {
  const {
    full_name,
    email,
    phone,
    password,
    college_id,
    college_name,
    specialization,
    current_year,
    graduation_year,
    native_place,
    father_name,
    address,
    father_phone,
    father_occupation,
    family_annual_income,
    siblings_count,
    post_btech_plan,
    higher_studies_destination,
    preferred_countries,
  } = req.body || {};

  try {
    if (
      typeof full_name !== "string" ||
      !full_name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof phone !== "string" ||
      !phone.trim() ||
      typeof password !== "string" ||
      !password ||
      typeof college_id !== "string" ||
      !college_id.trim() ||
      typeof college_name !== "string" ||
      !college_name.trim() ||
      typeof specialization !== "string" ||
      !specialization.trim() ||
      typeof current_year !== "string" ||
      !current_year.trim() ||
      graduation_year === undefined ||
      graduation_year === null ||
      graduation_year === "" ||
      typeof native_place !== "string" ||
      !native_place.trim() ||
      typeof father_name !== "string" ||
      !father_name.trim() ||
      typeof address !== "string" ||
      !address.trim() ||
      typeof father_phone !== "string" ||
      !father_phone.trim() ||
      typeof father_occupation !== "string" ||
      !father_occupation.trim() ||
      family_annual_income === undefined ||
      family_annual_income === null ||
      family_annual_income === "" ||
      siblings_count === undefined ||
      siblings_count === null ||
      siblings_count === "" ||
      typeof post_btech_plan !== "string" ||
      !post_btech_plan.trim()
    ) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "All required fields must be provided",
      });
    }

    const cleanedName = full_name.trim();
    const cleanedEmail = email.trim().toLowerCase();
    const cleanedPhone = phone.trim().replace(/[\s()-]/g, "");
    const cleanedCollegeId = college_id.trim();
    const cleanedCollegeName = college_name.trim();
    const cleanedSpecialization = specialization.trim();
    const cleanedCurrentYear = current_year.trim();
    const cleanedNativePlace = native_place.trim();
    const cleanedFatherName = father_name.trim();
    const cleanedAddress = address.trim();
    const cleanedFatherOccupation = father_occupation.trim();
    const cleanedFatherPhone = father_phone.trim().replace(/[\s()-]/g, "");

    const parsedGraduationYear = Number(graduation_year);
    const parsedFamilyAnnualIncome = Number(family_annual_income);
    const parsedSiblingsCount = Number(siblings_count);

    if (cleanedName.length > 150) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Full name must not exceed 150 characters",
      });
    }

    if (
      cleanedEmail.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)
    ) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid email address is required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Password must contain at least 8 characters",
      });
    }

    if (cleanedCollegeId.length > 255) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "College ID must not exceed 255 characters",
      });
    }

    if (cleanedCollegeName.length > 255) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "College name must not exceed 255 characters",
      });
    }

    if (cleanedSpecialization.length > 150) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Specialization must not exceed 150 characters",
      });
    }

    if (cleanedCurrentYear.length > 30) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Current year must not exceed 30 characters",
      });
    }

    if (
      !Number.isInteger(parsedGraduationYear) ||
      parsedGraduationYear < 2000 ||
      parsedGraduationYear > 2100
    ) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid graduation year is required",
      });
    }

    if (cleanedNativePlace.length > 255) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Native place must not exceed 255 characters",
      });
    }

    if (cleanedFatherName.length > 150) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Father name must not exceed 150 characters",
      });
    }

    if (cleanedFatherOccupation.length > 150) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Father occupation must not exceed 150 characters",
      });
    }

    let normalizedPhone;

    if (/^[6-9]\d{9}$/.test(cleanedPhone)) {
      normalizedPhone = `+91${cleanedPhone}`;
    } else if (/^\+91[6-9]\d{9}$/.test(cleanedPhone)) {
      normalizedPhone = cleanedPhone;
    } else {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid Indian mobile number is required",
      });
    }

    let normalizedFatherPhone;

    if (/^[6-9]\d{9}$/.test(cleanedFatherPhone)) {
      normalizedFatherPhone = `+91${cleanedFatherPhone}`;
    } else if (/^\+91[6-9]\d{9}$/.test(cleanedFatherPhone)) {
      normalizedFatherPhone = cleanedFatherPhone;
    } else {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid father's Indian mobile number is required",
      });
    }

    if (
      !Number.isFinite(parsedFamilyAnnualIncome) ||
      parsedFamilyAnnualIncome < 0 ||
      parsedFamilyAnnualIncome > 9999999999.99
    ) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid family annual income is required",
      });
    }

    if (
      !Number.isInteger(parsedSiblingsCount) ||
      parsedSiblingsCount < 0 ||
      parsedSiblingsCount > 100
    ) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Siblings count must be a non-negative integer",
      });
    }

    const cleanedPostBtechPlan = post_btech_plan.trim().toUpperCase();

    let cleanedHigherStudiesDestination = null;
    let cleanedPreferredCountries = null;

    if (!["JOB", "HIGHER_STUDIES"].includes(cleanedPostBtechPlan)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid post-B.Tech plan is required",
      });
    }

    if (cleanedPostBtechPlan === "HIGHER_STUDIES") {
      cleanedHigherStudiesDestination =
        higher_studies_destination?.trim().toUpperCase();

      if (!["INDIA", "ABROAD"].includes(cleanedHigherStudiesDestination)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: "Valid higher studies destination is required",
        });
      }

      if (cleanedHigherStudiesDestination === "ABROAD") {
        if (
          !Array.isArray(preferred_countries) ||
          preferred_countries.length === 0 ||
          preferred_countries.some(
            (country) => typeof country !== "string" || !country.trim()
          )
        ) {
          return res.status(400).json({
            success: false,
            statusCode: 400,
            message: "Select at least one preferred country",
          });
        }

        cleanedPreferredCountries = [
          ...new Set(
            preferred_countries.map((country) =>
              country.trim().toUpperCase()
            )
          ),
        ];
      }
    }

    const existingStudent = await pool.query(
      `SELECT student_id
       FROM tbl_internship_students
       WHERE LOWER(email) = $1 OR phone = $2
       LIMIT 1`,
      [cleanedEmail, normalizedPhone]
    );

    if (existingStudent.rowCount > 0) {
      return res.status(409).json({
        success: false,
        statusCode: 409,
        message: "Email or phone number is already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO tbl_internship_students (
        full_name,
        email,
        phone,
        password_hash,
        college_id,
        college_name,
        specialization,
        current_year,
        graduation_year,
        native_place,
        father_name,
        address,
        father_phone,
        father_occupation,
        family_annual_income,
        siblings_count,
        post_btech_plan,
        higher_studies_destination,
        preferred_countries
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      RETURNING
        student_id,
        full_name,
        email,
        phone,
        college_id,
        college_name,
        specialization,
        current_year,
        graduation_year,
        native_place,
        father_name,
        address,
        father_phone,
        father_occupation,
        family_annual_income,
        siblings_count,
        post_btech_plan,
        higher_studies_destination,
        preferred_countries,
        created_at`,
      [
        cleanedName,
        cleanedEmail,
        normalizedPhone,
        passwordHash,
        cleanedCollegeId,
        cleanedCollegeName,
        cleanedSpecialization,
        cleanedCurrentYear,
        parsedGraduationYear,
        cleanedNativePlace,
        cleanedFatherName,
        cleanedAddress,
        normalizedFatherPhone,
        cleanedFatherOccupation,
        parsedFamilyAnnualIncome,
        parsedSiblingsCount,
        cleanedPostBtechPlan,
        cleanedHigherStudiesDestination,
        cleanedPreferredCountries,
      ]
    );

    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: "Student registered successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Register internship student error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        statusCode: 409,
        message: "Email or phone number is already registered",
      });
    }

    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
};





exports.loginInternshipStudent = async (req, res) => {
  const { email, password } = req.body || {};

  try {
    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Email and password are required",
      });
    }

    const cleanedEmail = email.trim().toLowerCase();

    if (
      cleanedEmail.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)
    ) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid email address is required",
      });
    }

    const result = await pool.query(
      `SELECT
         student_id,
         full_name,
         email,
         phone,
         password_hash,
         college_name,
         specialization,
         college_id,
         current_year,
         graduation_year
       FROM tbl_internship_students
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [cleanedEmail]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Invalid email or password",
      });
    }

    const student = result.rows[0];

    const isPasswordValid = await bcrypt.compare(
      password,
      student.password_hash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        student_id: student.student_id,
        role: "INTERNSHIP_STUDENT",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const {
      password_hash,
      ...studentData
    } = student;

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Login successful",
      data: {
        student: studentData,
        token,
      },
    });

  } catch (error) {
    console.error("Internship student login error:", error);

    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
};


exports.sendForgotPasswordOTP = async (req, res) => {
  const { email } = req.body;

  if (
    !email ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return res.status(400).json({
      statusCode: 400,
      message: "Valid email is required",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const emailExists = await pool.query(
      `SELECT email
       FROM tbl_internship_students
       WHERE LOWER(email) = $1`,
      [normalizedEmail]
    );

    if (emailExists.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Email not found",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    await pool.query(
      `DELETE FROM tbl_email_otp
       WHERE email = $1`,
      [normalizedEmail]
    );

    const otpResult = await pool.query(
      `INSERT INTO tbl_email_otp (email, otp, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
       RETURNING email_otp_id`,
      [normalizedEmail, otp]
    );

    emailOtpId = otpResult.rows[0].email_otp_id;

    await sendforgotpasswordOtpMail(normalizedEmail, otp);

    return res.status(200).json({
      statusCode: 200,
      message: "Forgot password OTP sent successfully",
      email_otp_id: emailOtpId,
    });
  } catch (error) {

    await pool.query(
      "DELETE FROM tbl_email_otp WHERE email_otp_id = $1",
      [emailOtpId]
    );

    console.error("Failed to send forgot password OTP:", error);

    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Failed to send OTP email. Please try again.",
    });
  }
};

exports.verifyForgotPasswordOTP = async (req, res) => {
  const { email_otp_id, otp } = req.body;

  if (
    !email_otp_id ||
    !Number.isInteger(Number(email_otp_id)) ||
    Number(email_otp_id) <= 0
  ) {
    return res.status(400).json({
      statusCode: 400,
      message: "Valid email OTP ID is required",
    });
  }

  if (!/^\d{6}$/.test(String(otp ?? ""))) {
    return res.status(400).json({
      statusCode: 400,
      message: "Valid six-digit OTP is required",
    });
  }

  try {
    const result = await pool.query(
      `SELECT email_otp_id, email, otp, expires_at
       FROM tbl_email_otp
       WHERE email_otp_id = $1`,
      [Number(email_otp_id)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "OTP record not found",
      });
    }

    const otpRecord = result.rows[0];

    if (new Date(otpRecord.expires_at) <= new Date()) {
      await pool.query(
        `DELETE FROM tbl_email_otp
         WHERE email_otp_id = $1`,
        [Number(email_otp_id)]
      );

      return res.status(400).json({
        statusCode: 400,
        message: "OTP has expired. Please request a new OTP",
      });
    }

    if (String(otpRecord.otp) !== String(otp)) {
      return res.status(400).json({
        statusCode: 400,
        message: "Invalid OTP",
      });
    }

    const resetToken = jwt.sign(
      {
        email: otpRecord.email,
        purpose: "password_reset",
      },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );

    await pool.query(
      `DELETE FROM tbl_email_otp
       WHERE email_otp_id = $1`,
      [Number(email_otp_id)]
    );

    return res.status(200).json({
      statusCode: 200,
      message: "OTP verified successfully",
      reset_token: resetToken,
    });
  } catch (error) {
    console.error("Verify forgot password OTP error:", error);

    return res.status(500).json({
      statusCode: 500,
      message: "Internal server error",
    });
  }
};


exports.resetForgotPassword = async (req, res) => {
  const { reset_token, new_password, confirm_password } = req.body;

  if (
    !reset_token ||
    typeof reset_token !== "string" ||
    !new_password ||
    typeof new_password !== "string" ||
    !confirm_password ||
    typeof confirm_password !== "string"
  ) {
    return res.status(400).json({
      statusCode: 400,
      message: "Reset token, new password and confirm password are required",
    });
  }

  if (new_password.length < 8) {
    return res.status(400).json({
      statusCode: 400,
      message: "Password must be at least 8 characters long",
    });
  }

  if (new_password !== confirm_password) {
    return res.status(400).json({
      statusCode: 400,
      message: "New password and confirm password do not match",
    });
  }

  try {
    let decoded;

    try {
      decoded = jwt.verify(reset_token, process.env.JWT_SECRET);

      if (
        decoded.purpose !== "password_reset" ||
        !decoded.email
      ) {
        throw new Error("Invalid reset token");
      }
    } catch (error) {
      return res.status(401).json({
        statusCode: 401,
        message: "Invalid or expired password reset token",
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 12);

    const result = await pool.query(
      `UPDATE tbl_internship_students
       SET password_hash = $1
       WHERE LOWER(email) = LOWER($2)
       RETURNING student_id`,
      [hashedPassword, decoded.email]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Internship student not found",
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Reset forgot password error:", error);

    return res.status(500).json({
      statusCode: 500,
      message: "Internal server error",
    });
  }
};

