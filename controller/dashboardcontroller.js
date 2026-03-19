const pool = require('../config/db');

exports.getDashboardStats = async (req, res) => {
  try {

    // ✅ Users
    const users = await pool.query(`
      SELECT
          COUNT(*) FILTER (WHERE role = 'student') AS total_students,
          COUNT(*) FILTER (WHERE role = 'tutor') AS active_tutors
      FROM tbl_user
    `);

    // ✅ Courses
    const courses = await pool.query(`
      SELECT COUNT(*) AS active_courses
      FROM tbl_course
      WHERE status = 'Published'
    `);

    // ✅ Internship
    const internship = await pool.query(`
      SELECT
          COUNT(*) AS internship_requests,
          COUNT(*) FILTER (WHERE status = 'Pending') AS pending_requests,
          COUNT(*) FILTER (WHERE status = 'Approved') AS approved_requests,
          COUNT(*) FILTER (WHERE status = 'Rejected') AS rejected_requests
      FROM tbl_internship
    `);

    // ✅ Graph
    const graph = await pool.query(`
      SELECT
          TO_CHAR(created_at, 'Mon YYYY') AS month,
          COUNT(*) AS student_count
      FROM tbl_user
      WHERE role = 'student'
      AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY MIN(created_at)
    `);

    return res.status(200).json({
      statusCode: 200,
      message: "Dashboard stats fetched successfully",

      stats: {
        total_students: users.rows[0].total_students,
        active_tutors: users.rows[0].active_tutors,
        active_courses: courses.rows[0].active_courses,
        internship_requests: internship.rows[0].internship_requests,
        pending_requests: internship.rows[0].pending_requests,
        approved_requests: internship.rows[0].approved_requests,
        rejected_requests: internship.rows[0].rejected_requests
      },

      graph: graph.rows
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};