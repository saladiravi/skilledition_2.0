const pool = require('../config/db');
const { uploadToS3, getSignedVideoUrl, deletefroms3 } = require('../utils/s3upload');

exports.addinternship = async (req, res) => {
  try {
    const { student_id, project_name, phone_number,github_url, description, web_url } = req.body;




    await pool.query(`
            INSERT INTO tbl_internship 
            (student_id, project_name,phone_number, github_url, web_url, description, applied_date) 
            VALUES ($1, $2, $3, $4, $5,$6, NOW())
        `,
      [student_id, project_name,phone_number, github_url, web_url, description]);

    return res.status(200).json({
      statusCode: 200,
      message: "Submitted Successfully"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};

exports.getinternship = async (req, res) => {
  const { user_id } = req.body;

  try {
    const result = await pool.query(
      `SELECT 
          u.full_name,
          u.email,
          i.internship_id,
          i.project_name,
          i.github_url,
          i.web_url,
          i.description,
          i.status,
          i.role,
          i.phone_number,
          i.intership_certificate,
          TO_CHAR(i.start_date, 'DD-MM-YYYY') AS start_date,
          TO_CHAR(i.end_date, 'DD-MM-YYYY') AS end_date,
          TO_CHAR(i.applied_date, 'DD-MM-YYYY') AS applied_date
       FROM tbl_user u
       LEFT JOIN tbl_internship i 
          ON u.user_id = i.student_id
       WHERE u.user_id = $1
       ORDER BY i.internship_id DESC`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "No data found"
      });
    }

    // ✅ Generate signed URL for certificate
    const updatedRows = await Promise.all(
      result.rows.map(async (row) => {
        if (row.intership_certificate) {
          row.intership_certificate =
            await getSignedVideoUrl(row.intership_certificate);
        }
        return row;
      })
    );

    return res.status(200).json({
      statusCode: 200,
      message: "Fetched Successfully",
      data: updatedRows
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};


exports.gettotalinternship = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          u.user_id,
          u.full_name,
          u.email,
          i.internship_id,
          i.project_name,
          i.github_url,
          i.web_url,
          i.description,
          i.status,
          i.role,
          i.phone_number,
          i.intership_certificate,
          TO_CHAR(i.start_date, 'DD-MM-YYYY') AS start_date,
          TO_CHAR(i.end_date, 'DD-MM-YYYY') AS end_date,
          TO_CHAR(i.applied_date, 'DD-MM-YYYY') AS applied_date
       FROM tbl_user u
       INNER JOIN tbl_internship i 
            ON u.user_id = i.student_id
       ORDER BY i.internship_id DESC`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "No internship applications found"
      });
    }

    // ✅ Generate signed URLs
    const updatedRows = await Promise.all(
      result.rows.map(async (row) => {
        if (row.intership_certificate) {
          row.intership_certificate =
            await getSignedVideoUrl(row.intership_certificate);
        }
        return row;
      })
    );

    return res.status(200).json({
      statusCode: 200,
      message: "Internship Applications Fetched Successfully",
      data: updatedRows
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};


exports.updateInternship = async (req, res) => {
  try {
    const { internship_id, role, status, start_date, end_date } = req.body;

    // ✅ Validation
    if (!internship_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "internship_id is required"
      });
    }

    if (!role || !start_date) {
      return res.status(400).json({
        statusCode: 400,
        message: "role and start_date are required"
      });
    }

    let certificateKey = null;

    // ✅ Check if file uploaded
    if (req.files?.intership_certificate?.length > 0) {
      certificateKey = await uploadToS3(
        req.files.intership_certificate[0],
        "internships/certificates"
      );
    }

    // ✅ Build dynamic query
    let query = `
      UPDATE tbl_internship
      SET role = $1,
          start_date = $2,
          status = $3,
          end_date = $4
    `;

    const values = [role, start_date, status, end_date];
    let paramIndex = 5;

    // If certificate uploaded, update column
    if (certificateKey) {
      query += `, intership_certificate = $${paramIndex}`;
      values.push(certificateKey);
      paramIndex++;
    }

    query += ` WHERE internship_id = $${paramIndex} RETURNING *`;
    values.push(internship_id);

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Internship not found"
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Internship updated successfully",
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