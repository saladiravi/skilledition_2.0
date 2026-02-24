const pool=require('../config/db');


exports.addinternship = async (req, res) => {
    try {
        const { student_id, project_name, github_url, description,web_url } = req.body;
        
        

     
        await pool.query(`
            INSERT INTO tbl_internship 
            (student_id, project_name, github_url, web_url, description, applied_date) 
            VALUES ($1, $2, $3, $4, $5, NOW())
        `,
        [student_id, project_name, github_url, web_url, description]);

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
                i.project_name,
                i.github_url,
                i.web_url,
                i.description,
                i.status
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

        return res.status(200).json({
            statusCode: 200,
            message: "Fetched Successfully",
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
          i.status
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

    return res.status(200).json({
      statusCode: 200,
      message: "Internship Applications Fetched Successfully",
      data: result.rows
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
    const { internship_id, role, start_date } = req.body;

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

    const result = await pool.query(
      `UPDATE tbl_internship
       SET role = $1,
           start_date = $2
       WHERE internship_id = $3
       RETURNING *`,
      [role, start_date, internship_id]
    );

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