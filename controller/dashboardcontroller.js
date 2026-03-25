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


//tutor analytics 
exports.getTutoranalyticsDashboard = async (req, res) => {
  try {
    const { tutor_id } = req.body;

    if (!tutor_id) {
      return res.status(400).json({
        success: false,
        message: "tutor_id is required"
      });
    }

    // =========================
    // 1️⃣ STATS
    // =========================
    const statsQuery = await pool.query(`
      SELECT
        -- Total Students (who enrolled tutor courses)
        COUNT(DISTINCT sc.student_id) AS total_students,

        -- Total Views (students not purchased tutor courses)
        (
          SELECT COUNT(*)
          FROM tbl_user u
          WHERE role = 'student'
          AND NOT EXISTS (
            SELECT 1 FROM tbl_student_course sc2
            JOIN tbl_course c2 ON sc2.course_id = c2.course_id
            WHERE sc2.student_id = u.user_id
            AND c2.tutor_id = $1
          )
        ) AS total_views,

        -- Avg Completion
        COALESCE(ROUND(
          (COUNT(*) FILTER (WHERE fa.is_unlocked = true) * 100.0) /
          NULLIF(COUNT(fa.final_assignment_id),0), 2
        ),0) AS avg_completion,

        -- Avg Rating
        COALESCE(ROUND(AVG(f.rating),2),0) AS avg_rating

      FROM tbl_course c
      LEFT JOIN tbl_student_course sc ON c.course_id = sc.course_id
      LEFT JOIN tbl_student_final_assignment fa ON c.course_id = fa.course_id
      LEFT JOIN tbl_feedback f ON c.course_id = f.course_id
      WHERE c.tutor_id = $1
    `, [tutor_id]);

    // =========================
    // 2️⃣ MONTHLY GRAPH
    // =========================
    const monthlyQuery = await pool.query(`
      WITH months AS (
        SELECT generate_series(1, 12) AS month_number
      )
      SELECT 
        TO_CHAR(TO_DATE(months.month_number::text, 'MM'), 'Mon') AS month,

        COUNT(DISTINCT sc.student_id) AS enrollments,

        COUNT(DISTINCT u.user_id) FILTER (
          WHERE u.role = 'student'
        ) AS views,

        COUNT(*) FILTER (
          WHERE fa.is_unlocked = true
        ) AS completions

      FROM months

      LEFT JOIN tbl_course c
        ON c.tutor_id = $1

      LEFT JOIN tbl_student_course sc
        ON sc.course_id = c.course_id
        AND EXTRACT(MONTH FROM sc.created_at) = months.month_number

      LEFT JOIN tbl_user u
        ON EXTRACT(MONTH FROM u.created_at) = months.month_number

      LEFT JOIN tbl_student_final_assignment fa
        ON fa.course_id = c.course_id
        AND EXTRACT(MONTH FROM fa.created_at) = months.month_number

      GROUP BY months.month_number
      ORDER BY months.month_number;
    `, [tutor_id]);

    const monthlyGraph = {
      xAxis: monthlyQuery.rows.map(r => r.month),
      enrollments: monthlyQuery.rows.map(r => Number(r.enrollments)),
      views: monthlyQuery.rows.map(r => Number(r.views)),
      completions: monthlyQuery.rows.map(r => Number(r.completions))
    };

    // =========================
    // 3️⃣ GRADE DISTRIBUTION
    // =========================
    const gradeQuery = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE grade = 'A+') AS "A+",
        COUNT(*) FILTER (WHERE grade = 'A') AS "A",
        COUNT(*) FILTER (WHERE grade = 'B') AS "B",
        COUNT(*) FILTER (WHERE grade = 'C') AS "C",
        COUNT(*) FILTER (WHERE grade NOT IN ('A+','A','B','C')) AS "Below"
      FROM tbl_student_final_assignment fa
      JOIN tbl_course c ON fa.course_id = c.course_id
      WHERE c.tutor_id = $1
      AND fa.is_unlocked = true
    `, [tutor_id]);

    const g = gradeQuery.rows[0];

    const gradeChart = {
      xAxis: ["A+", "A", "B", "C", "Below"],
      yAxis: [g["A+"], g["A"], g["B"], g["C"], g["Below"]]
    };

    // =========================
    // 4️⃣ TOP COURSES (LAST 3 MONTHS)
    // =========================
    const coursesQuery = await pool.query(`
      SELECT 
        c.course_title,

        COUNT(DISTINCT sc.student_id) AS students,

        COALESCE(ROUND(
          (COUNT(*) FILTER (WHERE fa.is_unlocked = true) * 100.0) /
          NULLIF(COUNT(fa.final_assignment_id),0), 2
        ),0) AS completion_rate,

        COALESCE(ROUND(AVG(f.rating),2),0) AS avg_rating

      FROM tbl_course c

      LEFT JOIN tbl_student_course sc
        ON c.course_id = sc.course_id

      LEFT JOIN tbl_student_final_assignment fa
        ON c.course_id = fa.course_id

      LEFT JOIN tbl_feedback f
        ON c.course_id = f.course_id

      WHERE c.tutor_id = $1
      AND fa.created_at >= NOW() - INTERVAL '3 months'

      GROUP BY c.course_id
      ORDER BY students DESC
      LIMIT 5;
    `, [tutor_id]);

    // =========================
    // FINAL RESPONSE
    // =========================
    return res.json({
      success: true,
      dashboard: {
        stats: statsQuery.rows[0],
        monthlyGraph,
        gradeChart,
        topCourses: coursesQuery.rows
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

//tutor
exports.studentperformancetutordashboard = async (req, res) => {
  const { tutor_id } = req.body;
  try {


    const studentPerformanceQuery = await pool.query(`
  SELECT 
    u.full_name AS student_name,
    c.course_title,

    -- Progress (based on assignment unlock)
    CASE 
      WHEN fa.is_unlocked = true THEN '100%'
      ELSE 'In Progress'
    END AS progress,

    -- Avg Score
    COALESCE(AVG(fa.total_marks::int), 0) AS avg_score,

    -- Activity Status
    CASE 
      WHEN MAX(fa.created_at) >= NOW() - INTERVAL '7 days'
      THEN 'Active'
      ELSE 'Inactive'
    END AS activity_status

  FROM tbl_student_final_assignment fa

  JOIN tbl_user u 
    ON fa.student_id = u.user_id

  JOIN tbl_course c 
    ON fa.course_id = c.course_id

  WHERE c.tutor_id = $1

  GROUP BY u.full_name, c.course_title, fa.is_unlocked
  ORDER BY avg_score DESC
  LIMIT 10;
`, [tutor_id]);

    const activeStudentsQuery = await pool.query(`
  SELECT COUNT(DISTINCT sc.student_id) AS active_students
  FROM tbl_student_course sc
  JOIN tbl_course c ON sc.course_id = c.course_id
  WHERE c.tutor_id = $1
`, [tutor_id]);

    const completionQuery = await pool.query(`
  SELECT 
    COALESCE(ROUND(
      (COUNT(*) FILTER (WHERE fa.status = 'Completed') * 100.0) /
      NULLIF(COUNT(*),0), 2
    ),0) AS assignment_completion
  FROM tbl_student_final_assignment fa
  JOIN tbl_course c ON fa.course_id = c.course_id
  WHERE c.tutor_id = $1
`, [tutor_id]);

    const studyTimeQuery = await pool.query(`
  SELECT 
    COALESCE(
      TO_CHAR(
        AVG(watched::interval),
        'HH24:MI'
      ),
      '00:00'
    ) AS avg_study_time
  FROM tbl_student_course_progress scp
  JOIN tbl_course c ON scp.course_id = c.course_id
  WHERE c.tutor_id = $1
`, [tutor_id]);

    return res.status(200).json({
      statusCode: 200,
      message: 'Fetched Sucessfully',
      dashboard: {
        studentPerformanceQuery: studentPerformanceQuery.rows[0],
        activeStudentsQuery: activeStudentsQuery.rows[0],
        completionQuery: completionQuery.rows[0],
        studyTimeQuery: studyTimeQuery.rows[0]
      }
    })
  } catch (error) {
    console.log(error)
    return res.status(500).json({

      statusCode: 500,
      message: 'Internal Server Error'
    })
  }
}