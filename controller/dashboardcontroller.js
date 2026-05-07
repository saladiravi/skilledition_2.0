const pool = require('../config/db');

exports.getDashboardStats = async (req, res) => {
  try {

    // =======================
    // 🔹 USERS
    // =======================
    const users = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE role = 'student') AS total_students,
        COUNT(*) FILTER (WHERE role = 'tutor') AS active_tutors
      FROM tbl_user
    `);

    // =======================
    // 🔹 COURSES
    // =======================
    const courses = await pool.query(`
      SELECT COUNT(*) AS active_courses
      FROM tbl_course
      WHERE status = 'Published'
    `);

    // =======================
    // 🔹 INTERNSHIP
    // =======================
    const internship = await pool.query(`
      SELECT COUNT(*) AS internship_requests
      FROM tbl_internship
    `);

    // =======================
    // 📊 GRAPH (Last 5 Months)
    // =======================

    // 1️⃣ Generate months
    const monthsResult = await pool.query(`
      SELECT 
      generate_series(
        DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '4 months',
        DATE_TRUNC('month', CURRENT_DATE),
        INTERVAL '1 month'
      ) AS month_date,
      TO_CHAR(
        generate_series(
          DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '4 months',
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        ),
        'YYYY-MM'
      ) AS month_key
    `);

    // 2️⃣ Student data
    const graphData = await pool.query(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS month_key,
        COUNT(*) AS student_count
      FROM tbl_user
     WHERE role = 'student'
      AND created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '4 months'
      AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      GROUP BY month_key
      `);

    // 3️⃣ Map
    const graphMap = {};

    graphData.rows.forEach(row => {
      graphMap[row.month_key] = parseInt(row.student_count);
    });

 const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const finalGraph = monthsResult.rows.map(row => {
  const key = row.month_key;
  const monthIndex = parseInt(key.split('-')[1], 10) - 1;

  return {
    month: monthNames[monthIndex], // ✅ FIXED
    student_count: graphMap[key] || 0
  };
});

    // =======================
    // 🥧 PIE CHART (Course Popularity)
    // =======================

    const coursePopularity = await pool.query(`
       SELECT 
    c.course_id,
    c.course_title,
    COUNT(sc.student_id) AS total_students
  FROM tbl_course c
  LEFT JOIN tbl_student_course sc 
    ON c.course_id = sc.course_id
  WHERE c.status = 'Published'
  GROUP BY c.course_id, c.course_title
    `);

    // Total students
    const totalStudents = coursePopularity.rows.reduce((sum, row) => {
      return sum + parseInt(row.total_students);
    }, 0);

    // Convert to %
    const coursePopularityData = coursePopularity.rows.map(row => {
      const count = parseInt(row.total_students);

      return {
        course_id: row.course_id,
        course_title: row.course_title,
        total_students: count,
        percentage: totalStudents > 0
          ? ((count / totalStudents) * 100).toFixed(2)
          : "0.00"
      };
    });


    // =======================
    // 🕒 RECENT SUBMISSIONS
    // =======================

// const recentSubmissions = await pool.query(`
//   SELECT 
//     full_name,
//     type,
//     TO_CHAR(activity_date, 'DD-MM-YYYY') AS activity_date
//   FROM (

//     SELECT u.full_name, u.role, 'Registration' AS type, u.created_at AS activity_date
//     FROM tbl_user u
//     WHERE u.created_at >= NOW() - INTERVAL '2 days'

//     UNION ALL

//     SELECT u.full_name, 'Final Exam' AS type, sfa.submitted_at AS activity_date
//     FROM tbl_student_final_assignment sfa
//     JOIN tbl_user u ON u.user_id = sfa.student_id
//     WHERE sfa.submitted_at >= NOW() - INTERVAL '2 days'

//     UNION ALL

//     SELECT u.full_name, 'Internship' AS type, i.applied_date AS activity_date
//     FROM tbl_internship i
//     JOIN tbl_user u ON u.user_id = i.student_id
//     WHERE i.applied_date >= NOW() - INTERVAL '2 days'

//     UNION ALL

//     SELECT u.full_name, 'Course Purchased' AS type, sc.created_at AS activity_date
//     FROM tbl_student_course sc
//     JOIN tbl_user u ON u.user_id = sc.student_id
//     WHERE sc.created_at >= NOW() - INTERVAL '2 days'

//   ) AS activity

//   ORDER BY activity_date DESC
// `);

const recentSubmissions = await pool.query(`
  SELECT 
    full_name,
    role,
    type,
    TO_CHAR(activity_date, 'DD-MM-YYYY') AS activity_date
  FROM (

    SELECT 
      u.full_name, 
      u.role,
      'Registration' AS type, 
      u.created_at AS activity_date
    FROM tbl_user u
    WHERE u.created_at >= NOW() - INTERVAL '2 days'

    UNION ALL

    SELECT 
      u.full_name,
      u.role,
      'Final Exam' AS type, 
      sfa.submitted_at AS activity_date
    FROM tbl_student_final_assignment sfa
    JOIN tbl_user u ON u.user_id = sfa.student_id
    WHERE sfa.submitted_at >= NOW() - INTERVAL '2 days'

    UNION ALL

    SELECT 
      u.full_name,
      u.role,
      'Internship' AS type, 
      i.applied_date AS activity_date
    FROM tbl_internship i
    JOIN tbl_user u ON u.user_id = i.student_id
    WHERE i.applied_date >= NOW() - INTERVAL '2 days'

    UNION ALL

    SELECT 
      u.full_name,
      u.role,
      'Course Purchased' AS type, 
      sc.created_at AS activity_date
    FROM tbl_student_course sc
    JOIN tbl_user u ON u.user_id = sc.student_id
    WHERE sc.created_at >= NOW() - INTERVAL '2 days'

  ) AS activity

  ORDER BY activity_date DESC
`);
    // =======================
    // ✅ FINAL RESPONSE
    // =======================

    return res.status(200).json({
      statusCode: 200,
      stats: {
        total_students: users.rows[0].total_students,
        active_tutors: users.rows[0].active_tutors,
        active_courses: courses.rows[0].active_courses,
        internship_requests: internship.rows[0].internship_requests,
      },

      charts: {
        studentGraph: finalGraph,
        coursePopularity: coursePopularityData
      },
      recent_submissions: recentSubmissions.rows
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
// exports.getTutoranalyticsDashboard = async (req, res) => {
//   try {
//     const { tutor_id } = req.body;

//     if (!tutor_id) {
//       return res.status(400).json({
//         success: false,
//         message: "tutor_id is required"
//       });
//     }

//     // =========================
//     // 1️⃣ STATS
//     // =========================
//     const statsQuery = await pool.query(`
//       SELECT
//         -- Total Students (who enrolled tutor courses)
//         COUNT(DISTINCT sc.student_id) AS total_students,

//         -- Total Views (students not purchased tutor courses)
//         (
//           SELECT COUNT(*)
//           FROM tbl_user u
//           WHERE role = 'student'
//           AND NOT EXISTS (
//             SELECT 1 FROM tbl_student_course sc2
//             JOIN tbl_course c2 ON sc2.course_id = c2.course_id
//             WHERE sc2.student_id = u.user_id
//             AND c2.tutor_id = $1
//           )
//         ) AS total_views,

//         -- Avg Completion
//         COALESCE(ROUND(
//           (COUNT(*) FILTER (WHERE fa.is_unlocked = true) * 100.0) /
//           NULLIF(COUNT(fa.final_assignment_id),0), 2
//         ),0) AS avg_completion,

//         -- Avg Rating
//         COALESCE(ROUND(AVG(f.rating),2),0) AS avg_rating

//       FROM tbl_course c
//       LEFT JOIN tbl_student_course sc ON c.course_id = sc.course_id
//       LEFT JOIN tbl_student_final_assignment fa ON c.course_id = fa.course_id
//       LEFT JOIN tbl_feedback f ON c.course_id = f.course_id
//       WHERE c.tutor_id = $1
//     `, [tutor_id]);

//     // =========================
//     // 2️⃣ MONTHLY GRAPH
//     // =========================
//     const monthlyQuery = await pool.query(`
//       WITH months AS (
//         SELECT generate_series(1, 12) AS month_number
//       )
//       SELECT 
//         TO_CHAR(TO_DATE(months.month_number::text, 'MM'), 'Mon') AS month,

//         COUNT(DISTINCT sc.student_id) AS enrollments,

//         COUNT(DISTINCT u.user_id) FILTER (
//           WHERE u.role = 'student'
//         ) AS views,

//         COUNT(*) FILTER (
//           WHERE fa.is_unlocked = true
//         ) AS completions

//       FROM months

//       LEFT JOIN tbl_course c
//         ON c.tutor_id = $1

//       LEFT JOIN tbl_student_course sc
//         ON sc.course_id = c.course_id
//         AND EXTRACT(MONTH FROM sc.created_at) = months.month_number

//       LEFT JOIN tbl_user u
//         ON EXTRACT(MONTH FROM u.created_at) = months.month_number

//       LEFT JOIN tbl_student_final_assignment fa
//         ON fa.course_id = c.course_id
//         AND EXTRACT(MONTH FROM fa.created_at) = months.month_number

//       GROUP BY months.month_number
//       ORDER BY months.month_number;
//     `, [tutor_id]);

//     const monthlyGraph = {
//       xAxis: monthlyQuery.rows.map(r => r.month),
//       enrollments: monthlyQuery.rows.map(r => Number(r.enrollments)),
//       views: monthlyQuery.rows.map(r => Number(r.views)),
//       completions: monthlyQuery.rows.map(r => Number(r.completions))
//     };

//     // =========================
//     // 3️⃣ GRADE DISTRIBUTION
//     // =========================
//     const gradeQuery = await pool.query(`
//       SELECT
//         COUNT(*) FILTER (WHERE grade = 'A+') AS "A+",
//         COUNT(*) FILTER (WHERE grade = 'A') AS "A",
//         COUNT(*) FILTER (WHERE grade = 'B') AS "B",
//         COUNT(*) FILTER (WHERE grade = 'C') AS "C",
//         COUNT(*) FILTER (WHERE grade NOT IN ('A+','A','B','C')) AS "Below"
//       FROM tbl_student_final_assignment fa
//       JOIN tbl_course c ON fa.course_id = c.course_id
//       WHERE c.tutor_id = $1
//       AND fa.is_unlocked = true
//     `, [tutor_id]);

//     const g = gradeQuery.rows[0];

//     const gradeChart = {
//       xAxis: ["A+", "A", "B", "C", "Below"],
//       yAxis: [g["A+"], g["A"], g["B"], g["C"], g["Below"]]
//     };

//     // =========================
//     // 4️⃣ TOP COURSES (LAST 3 MONTHS)
//     // =========================
//     const coursesQuery = await pool.query(`
//       SELECT 
//         c.course_title,

//         COUNT(DISTINCT sc.student_id) AS students,

//         COALESCE(ROUND(
//           (COUNT(*) FILTER (WHERE fa.is_unlocked = true) * 100.0) /
//           NULLIF(COUNT(fa.final_assignment_id),0), 2
//         ),0) AS completion_rate,

//         COALESCE(ROUND(AVG(f.rating),2),0) AS avg_rating

//       FROM tbl_course c

//       LEFT JOIN tbl_student_course sc
//         ON c.course_id = sc.course_id

//       LEFT JOIN tbl_student_final_assignment fa
//         ON c.course_id = fa.course_id

//       LEFT JOIN tbl_feedback f
//         ON c.course_id = f.course_id

//       WHERE c.tutor_id = $1
//       AND fa.created_at >= NOW() - INTERVAL '3 months'

//       GROUP BY c.course_id
//       ORDER BY students DESC
//       LIMIT 5;
//     `, [tutor_id]);

//     // =========================
//     // FINAL RESPONSE
//     // =========================
//     return res.json({
//       success: true,
//       dashboard: {
//         stats: statsQuery.rows[0],
//         monthlyGraph,
//         gradeChart,
//         topCourses: coursesQuery.rows
//       }
//     });

//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({
//       success: false,
//       message: "Server Error"
//     });
//   }
// };
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
        COUNT(DISTINCT sc.student_id) AS total_students,

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

        COALESCE(ROUND(
          (COUNT(*) FILTER (WHERE fa.is_unlocked = true) * 100.0) /
          NULLIF(COUNT(fa.final_assignment_id),0), 2
        ),0) AS avg_completion,

        COALESCE(ROUND(AVG(f.rating),2),0) AS avg_rating

      FROM tbl_course c
      LEFT JOIN tbl_student_course sc ON c.course_id = sc.course_id
      LEFT JOIN tbl_student_final_assignment fa ON c.course_id = fa.course_id
      LEFT JOIN tbl_feedback f ON c.course_id = f.course_id
      WHERE c.tutor_id = $1
    `, [tutor_id]);

    // =========================
    // 2️⃣ MONTHLY GRAPH (✅ FIXED)
    // =========================

    // 🔹 Step 1: last 5 months
    const monthsResult = await pool.query(`
      SELECT 
        generate_series(
          DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '4 months',
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) AS month_date
    `);

    // 🔹 Step 2: actual data
    const monthlyData = await pool.query(`
      SELECT 
        DATE_TRUNC('month', sc.created_at) AS month_date,

        COUNT(DISTINCT sc.student_id) AS enrollments,

        COUNT(DISTINCT u.user_id) FILTER (
          WHERE u.role = 'student'
        ) AS views,

        COUNT(*) FILTER (
          WHERE fa.is_unlocked = true
        ) AS completions

      FROM tbl_course c

      LEFT JOIN tbl_student_course sc 
        ON sc.course_id = c.course_id

      LEFT JOIN tbl_user u 
        ON DATE_TRUNC('month', u.created_at) = DATE_TRUNC('month', sc.created_at)

      LEFT JOIN tbl_student_final_assignment fa 
        ON fa.course_id = c.course_id
        AND DATE_TRUNC('month', fa.created_at) = DATE_TRUNC('month', sc.created_at)

      WHERE c.tutor_id = $1
        AND sc.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '4 months'

      GROUP BY month_date
    `, [tutor_id]);

    // 🔹 Step 3: map
    const monthlyMap = {};
    monthlyData.rows.forEach(row => {
      monthlyMap[row.month_date] = {
        enrollments: parseInt(row.enrollments),
        views: parseInt(row.views),
        completions: parseInt(row.completions)
      };
    });

    // 🔹 Step 4: final graph
    const monthlyGraph = monthsResult.rows.map(row => {
      const monthDate = row.month_date;

      return {
        month: new Date(monthDate).toLocaleString('en-US', { month: 'short' }),
        enrollments: monthlyMap[monthDate]?.enrollments || 0,
        views: monthlyMap[monthDate]?.views || 0,
        completions: monthlyMap[monthDate]?.completions || 0
      };
    });

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



// exports.getanalyticsAdminDashboard = async (req, res) => {
//   try {

//     const result = await pool.query(`

//       SELECT 
//         -- =======================
//         -- 🔹 OVERVIEW
//         -- =======================
//         (SELECT COUNT(*) FROM tbl_student_course) AS total_students,
//         (SELECT COUNT(DISTINCT tutor_id) FROM tbl_course) AS active_tutors,
//         (SELECT COUNT(*) FROM tbl_course) AS total_courses,
//         (SELECT COALESCE(SUM(order_amount::numeric), 0) FROM tbl_student_course) AS total_revenue,

//         -- =======================
//         -- 🔹 STUDENT METRICS
//         -- =======================
//         (SELECT COUNT(*) FROM tbl_student_course) AS enrolled_students,
//         (SELECT COUNT(*) FROM tbl_student_final_assignment WHERE is_unlocked = true) AS completed_students,
//         (SELECT COUNT(*) FROM tbl_student_final_assignment WHERE is_unlocked = false) AS in_progress_students,
//         (SELECT ROUND(AVG(total_marks::numeric), 2) FROM tbl_student_final_assignment) AS avg_percentage,

//         -- =======================
//         -- 🔹 ENGAGEMENT METRICS
//         -- =======================
//         (SELECT ROUND(AVG(total_marks::numeric), 2) 
//          FROM tbl_student_final_assignment) AS avg_assignment_score,

//       (SELECT ROUND(AVG(total_hours), 2)
//         FROM (
//           SELECT 
//             student_id, 
//             SUM(EXTRACT(EPOCH FROM watched::interval)) / 3600.0 AS total_hours
//           FROM tbl_student_course_progress
//           GROUP BY student_id
//         ) t) AS avg_learning_hours,

//         (SELECT ROUND(
//             (COUNT(DISTINCT CASE WHEN is_unlocked = true THEN student_id END) * 100.0)
//             / NULLIF(COUNT(DISTINCT student_id), 0),
//          2)
//          FROM tbl_student_final_assignment) AS completion_rate,

//         (SELECT ROUND(AVG(rating::numeric), 1)
//          FROM tbl_feedback) AS student_satisfaction

//     `);

//     const studentPurchases = await pool.query(`
//           SELECT 
//             sc.student_course_id,
//             sc.course_id,
//             c.course_title,

//             sc.student_id,
//             u.full_name,
//             u.phone_number,
//             u.email,
//             u.student_reg_number,

//             sc.order_amount,
//             sc.transaction_id,
//             sc.payment_status,
//             TO_CHAR(sc.created_at, 'DD-MM-YYYY') AS submitted_at

//           FROM tbl_student_course sc
//           JOIN tbl_user u 
//             ON sc.student_id = u.user_id
//           JOIN tbl_course c 
//             ON sc.course_id = c.course_id

//           ORDER BY sc.created_at DESC
//         `);
//     // =======================
//     // 📊 GRAPH DATA
//     // =======================
//     // 1️⃣ Get last 6 months (including current)
//     const monthsResult = await pool.query(`
//       SELECT 
//         generate_series(
//           DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
//           DATE_TRUNC('month', CURRENT_DATE),
//           INTERVAL '1 month'
//         ) AS month_date
//     `);

//     // 2️⃣ Platform Growth
//     const platformGrowth = await pool.query(`
//       SELECT 
//         DATE_TRUNC('month', created_at) AS month_date,
//         COUNT(*) FILTER (WHERE role = 'student') AS students,
//         COUNT(*) FILTER (WHERE role = 'tutor') AS tutors
//       FROM tbl_user
//       WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
//       AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
//       GROUP BY month_date
//     `);

//     // 3️⃣ Course Growth
//     const courseGrowth = await pool.query(`
//      SELECT 
//       DATE_TRUNC('month', course_created_at) AS month_date,
//       COUNT(*) AS courses
//     FROM tbl_course
//     WHERE course_created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
//     AND course_created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
//     GROUP BY month_date
//     `);

//     // 4️⃣ Convert query results to maps
//     const platformMap = {};
//     platformGrowth.rows.forEach(row => {
//       const key = row.month_date.toISOString().slice(0, 7);
//       platformMap[key] = {
//         students: parseInt(row.students),
//         tutors: parseInt(row.tutors)
//       };
//     });

//     const courseMap = {};
//     courseGrowth.rows.forEach(row => {
//       const key = row.month_date.toISOString().slice(0, 7); // ✅ FIX
//       courseMap[key] = parseInt(row.courses);
//     });

//     // 5️⃣ Build final fixed 6 months data
//       const finalData = monthsResult.rows.map(row => {
//         const monthDate = row.month_date; // ✅ FIX
//         const key = new Date(monthDate).toISOString().slice(0, 7);

//         return {
//           month: new Date(monthDate).toLocaleString('en-US', { month: 'short' }),
//           students: platformMap[key]?.students || 0,
//           tutors: platformMap[key]?.tutors || 0,
//           courses: courseMap[key] || 0
//         };
//       });

//     const ratingDistribution = await pool.query(`
//         SELECT 
//           c.course_id,
//           c.course_title,

//           COUNT(*) FILTER (WHERE f.rating = 5) AS five_star,
//           COUNT(*) FILTER (WHERE f.rating = 4) AS four_star,
//           COUNT(*) FILTER (WHERE f.rating = 3) AS three_star,
//           COUNT(*) FILTER (WHERE f.rating = 2) AS two_star,
//           COUNT(*) FILTER (WHERE f.rating = 1) AS one_star

//         FROM tbl_course c
//         LEFT JOIN tbl_feedback f 
//           ON c.course_id = f.course_id
//           WHERE c.status = 'Published'
//         GROUP BY c.course_id, c.course_title
//         ORDER BY c.course_id
//       `);


//     const coursePerformance = await pool.query(`
//         SELECT 
//           c.course_id,
//           c.course_title,

//           COUNT(DISTINCT sc.student_id) AS enrolled,

//           COUNT(DISTINCT sfa.student_id) 
//             FILTER (WHERE sfa.is_unlocked = true) AS completed

//         FROM tbl_course c

//         LEFT JOIN tbl_student_course sc 
//           ON c.course_id = sc.course_id

//         LEFT JOIN tbl_student_final_assignment sfa 
//           ON c.course_id = sfa.course_id

//         WHERE c.status = 'Published'

//         GROUP BY c.course_id, c.course_title
//       `);

//     const monthsResults = await pool.query(`
//           SELECT 
//             generate_series(
//               DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '4 months',
//               DATE_TRUNC('month', CURRENT_DATE),
//               INTERVAL '1 month'
//             ) AS month_date
//         `);


//     const trendData = await pool.query(`
//         SELECT 
//           DATE_TRUNC('month', created_at) AS month_date,
//           COUNT(*) FILTER (WHERE is_unlocked = true) AS completed,
//           COUNT(*) FILTER (WHERE is_unlocked = false) AS in_progress
//         FROM tbl_student_final_assignment
//         WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '4 months'
//         AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
//         GROUP BY month_date
//       `);

//     // 3️⃣ Convert to map
//     const trendMap = {};
//     trendData.rows.forEach(row => {
//       const key = row.month_date.toISOString().slice(0, 7); // ✅ FIX
//       trendMap[key] = {
//         completed: parseInt(row.completed),
//         in_progress: parseInt(row.in_progress)
//       };
//     });

//     // 4️⃣ Build final fixed 5 months data
//     const finaltrendData = monthsResults.rows.map(row => {
//       const monthDate = row.month_date;
//       const key = new Date(monthDate).toISOString().slice(0, 7);

//       return {
//         month: new Date(monthDate).toLocaleString('en-US', { month: 'short' }),
//         completed: trendMap[key]?.completed || 0,
//         in_progress: trendMap[key]?.in_progress || 0
//       };
//     });


//     const courseAvgScores = await pool.query(`
//           SELECT 
//             c.course_title,
//             ROUND(AVG(a.total_marks::numeric), 2) AS avg_score
//           FROM tbl_course c
//           JOIN tbl_student_final_assignment a 
//             ON c.course_id = a.course_id
//           GROUP BY c.course_title
//           ORDER BY avg_score DESC
//         `);

//     return res.status(200).json({
//       statusCode: 200,
//       data: {
//         overview: {
//           total_students: result.rows[0].total_students,
//           active_tutors: result.rows[0].active_tutors,
//           total_courses: result.rows[0].total_courses,
//           total_revenue: result.rows[0].total_revenue,
//         },

//         studentMetrics: {
//           enrolled_students: result.rows[0].enrolled_students,
//           completed_students: result.rows[0].completed_students,
//           in_progress_students: result.rows[0].in_progress_students,
//           avg_percentage: result.rows[0].avg_percentage,
//         },

//         engagementMetrics: {
//           avg_assignment_score: result.rows[0].avg_assignment_score,
//           avg_learning_hours: result.rows[0].avg_learning_hours,
//           completion_rate: result.rows[0].completion_rate,
//           student_satisfaction: result.rows[0].student_satisfaction,

//         },

//         studentPurchases: studentPurchases.rows,

//         charts: {
//           platformGrowth: finalData,
//           coursePerformance: coursePerformance.rows,
//           ratingDistribution: ratingDistribution.rows,
//           completionTrend: finaltrendData,
//           courseAvgScores: courseAvgScores.rows
//         }
//       }
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       statusCode: 500,
//       message: "Internal Server Error"
//     });
//   }
// };



exports.getanalyticsAdminDashboard = async (req, res) => {
  try {
    // =======================
    // 🔹 OVERVIEW + METRICS
    // =======================
    const result = await pool.query(`
      SELECT 
       (SELECT COUNT(DISTINCT student_id) 
              FROM tbl_student_course) AS total_students,
        (SELECT COUNT(DISTINCT tutor_id) FROM tbl_course) AS active_tutors,
        (SELECT COUNT(*) FROM tbl_course) AS total_courses,
        (SELECT COALESCE(SUM(order_amount::numeric), 0) FROM tbl_student_course) AS total_revenue,

        (SELECT COUNT(DISTINCT student_id) 
          FROM tbl_student_course) AS enrolled_students,
        (SELECT COUNT(*) FROM tbl_student_final_assignment WHERE status='Completed') AS completed_students,
        (SELECT COUNT(*) FROM tbl_student_final_assignment WHERE is_unlocked = false) AS in_progress_students,
        (SELECT ROUND(AVG(total_marks::numeric), 2) 
        FROM tbl_student_final_assignment
        WHERE is_unlocked = true) AS avg_percentage,

        (SELECT ROUND(AVG(total_marks::numeric), 2) 
        FROM tbl_student_final_assignment
        WHERE is_unlocked = true) AS avg_assignment_score,
        
        (SELECT ROUND(AVG(total_hours), 2)
          FROM (
            SELECT 
              student_id, 
              SUM(EXTRACT(EPOCH FROM watched::interval)) / 3600.0 AS total_hours
            FROM tbl_student_course_progress
            GROUP BY student_id
          ) t) AS avg_learning_hours,

        (SELECT ROUND(
            (COUNT(DISTINCT CASE WHEN is_unlocked = true THEN student_id END) * 100.0)
            / NULLIF(COUNT(DISTINCT student_id), 0),
         2)
         FROM tbl_student_final_assignment) AS completion_rate,

        (SELECT ROUND(AVG(rating::numeric), 1)
         FROM tbl_feedback) AS student_satisfaction
    `);

  
    // =======================
    // 📊 MONTH SERIES (FIXED)
    // =======================
    const monthsResult = await pool.query(`
      SELECT 
        TO_CHAR(month_date, 'YYYY-MM') AS month_key,
        month_date
      FROM generate_series(
        DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
        DATE_TRUNC('month', CURRENT_DATE),
        INTERVAL '1 month'
      ) AS month_date
    `);

    // =======================
    // 📊 PLATFORM GROWTH
    // =======================
    const platformGrowth = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month_key,
        COUNT(*) FILTER (WHERE role = 'student') AS students,
        COUNT(*) FILTER (WHERE role = 'tutor') AS tutors
      FROM tbl_user
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
      AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      GROUP BY month_key
    `);

    // =======================
    // 📊 COURSE GROWTH
    // =======================
    const courseGrowth = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', course_created_at), 'YYYY-MM') AS month_key,
        COUNT(*) AS courses
      FROM tbl_course
      WHERE course_created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
      AND course_created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      GROUP BY month_key
    `);

    // =======================
    // 📊 MAP DATA
    // =======================
    const platformMap = {};
    platformGrowth.rows.forEach(row => {
      platformMap[row.month_key] = {
        students: parseInt(row.students),
        tutors: parseInt(row.tutors)
      };
    });

    const courseMap = {};
    courseGrowth.rows.forEach(row => {
      courseMap[row.month_key] = parseInt(row.courses);
    });

    // =======================
    // 📊 FINAL PLATFORM DATA
    // =======================
    const finalData = monthsResult.rows.map(row => ({
      month: new Date(row.month_date).toLocaleString('en-IN', {
        month: 'short',
        timeZone: 'Asia/Kolkata'
      }),
      students: platformMap[row.month_key]?.students || 0,
      tutors: platformMap[row.month_key]?.tutors || 0,
      courses: courseMap[row.month_key] || 0
    }));

    // =======================
    // ⭐ RATING DISTRIBUTION
    // =======================
    const ratingDistribution = await pool.query(`
      SELECT 
        c.course_id,
        c.course_title,
        COUNT(*) FILTER (WHERE f.rating = 5) AS five_star,
        COUNT(*) FILTER (WHERE f.rating = 4) AS four_star,
        COUNT(*) FILTER (WHERE f.rating = 3) AS three_star,
        COUNT(*) FILTER (WHERE f.rating = 2) AS two_star,
        COUNT(*) FILTER (WHERE f.rating = 1) AS one_star
      FROM tbl_course c
      LEFT JOIN tbl_feedback f ON c.course_id = f.course_id
      WHERE c.status = 'Published'
      GROUP BY c.course_id, c.course_title
      ORDER BY c.course_id
    `);

    // =======================
    // 📊 COURSE PERFORMANCE
    // =======================
    const coursePerformance = await pool.query(`
      SELECT 
        c.course_id,
        c.course_title,
        COUNT(DISTINCT sc.student_id) AS enrolled,
        COUNT(DISTINCT sfa.student_id) FILTER (WHERE sfa.status = 'Completed') AS completed
      FROM tbl_course c
      LEFT JOIN tbl_student_course sc ON c.course_id = sc.course_id
      LEFT JOIN tbl_student_final_assignment sfa ON c.course_id = sfa.course_id
      WHERE c.status = 'Published'
      GROUP BY c.course_id, c.course_title
    `);

    // =======================
    // 📊 COMPLETION TREND
    // =======================
    const trendMonths = await pool.query(`
      SELECT 
        TO_CHAR(month_date, 'YYYY-MM') AS month_key,
        month_date
      FROM generate_series(
        DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '4 months',
        DATE_TRUNC('month', CURRENT_DATE),
        INTERVAL '1 month'
      ) AS month_date
    `);

    const trendData = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month_key,
        COUNT(*) FILTER (WHERE status='Completed') AS completed,
        COUNT(*) FILTER (WHERE is_unlocked = false) AS in_progress
      FROM tbl_student_final_assignment
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '4 months'
      AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      GROUP BY month_key
    `);

    const trendMap = {};
    trendData.rows.forEach(row => {
      trendMap[row.month_key] = {
        completed: parseInt(row.completed),
        in_progress: parseInt(row.in_progress)
      };
    });

    const finaltrendData = trendMonths.rows.map(row => ({
      month: new Date(row.month_date).toLocaleString('en-IN', {
        month: 'short',
        timeZone: 'Asia/Kolkata'
      }),
      completed: trendMap[row.month_key]?.completed || 0,
      in_progress: trendMap[row.month_key]?.in_progress || 0
    }));

    // =======================
    // 📊 COURSE AVG SCORES
    // =======================
    const courseAvgScores = await pool.query(`
      SELECT 
        c.course_title,
        ROUND(AVG(a.total_marks::numeric), 2) AS avg_score
      FROM tbl_course c
      JOIN tbl_student_final_assignment a 
        ON c.course_id = a.course_id
      GROUP BY c.course_title
      ORDER BY avg_score DESC
    `);

  const studentcourseprogress = await pool.query(`
  SELECT 
    sc.student_course_id,
    sc.course_id,
    c.course_title,
    sc.student_id,
    u.full_name,
    u.phone_number,
    u.email,
    u.student_reg_number,

    -- ✅ Assignment Status (use status column)
    CASE 
      WHEN sfa.status = 'Completed' THEN 'Completed'
      ELSE 'In Progress'
    END AS course_completion,

    -- ✅ Certificate Status
    CASE 
      WHEN cert.certificate_id IS NOT NULL THEN 'Issued'
      ELSE 'Pending'
    END AS certificate_status,

    -- ✅ Internship Status
    CASE 
      WHEN i.internship_id IS NOT NULL THEN 'Applied'
      ELSE 'Pending'
    END AS internship_status

  FROM tbl_student_course sc

  JOIN tbl_user u 
    ON sc.student_id = u.user_id

  JOIN tbl_course c 
    ON sc.course_id = c.course_id

  -- ✅ Assignment table
  LEFT JOIN tbl_student_final_assignment sfa 
    ON sc.student_id = sfa.student_id 
    AND sc.course_id = sfa.course_id

  -- ✅ Certificate table
  LEFT JOIN tbl_certificates cert 
    ON sc.student_id = cert.student_id 
    AND sc.course_id = cert.course_id

  -- ✅ Internship table (IMPORTANT FIX)
  LEFT JOIN tbl_internship i 
    ON sc.student_id = i.student_id

  ORDER BY 
    (sfa.status = 'Completed') DESC,     -- Completed first
    (cert.certificate_id IS NOT NULL) DESC, -- Issued first
    (i.internship_id IS NOT NULL) DESC,  -- Applied first
    sc.created_at DESC
`);
    // =======================
    // ✅ RESPONSE
    // =======================
    return res.status(200).json({
      statusCode: 200,
      data: {
        overview: {
          total_students: result.rows[0].total_students,
          active_tutors: result.rows[0].active_tutors,
          total_courses: result.rows[0].total_courses,
          total_revenue: result.rows[0].total_revenue,
        },
        studentMetrics: {
          enrolled_students: result.rows[0].enrolled_students,
          completed_students: result.rows[0].completed_students,
          in_progress_students: result.rows[0].in_progress_students,
          avg_percentage: result.rows[0].avg_percentage,
        },
        engagementMetrics: {
          avg_assignment_score: result.rows[0].avg_assignment_score,
          avg_learning_hours: result.rows[0].avg_learning_hours,
          completion_rate: result.rows[0].completion_rate,
          student_satisfaction: result.rows[0].student_satisfaction,
        },
      
           studentcourseprogress: studentcourseprogress.rows,
        charts: {
          platformGrowth: finalData,
          coursePerformance: coursePerformance.rows,
          ratingDistribution: ratingDistribution.rows,
          completionTrend: finaltrendData,
          courseAvgScores: courseAvgScores.rows
        }
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};


exports.getTutorAnalyticsDashboard = async (req, res) => {
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
        COUNT(DISTINCT sc.student_id) AS total_students,
        COUNT(DISTINCT c.course_id) AS total_course,

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

        COALESCE(ROUND(
          (COUNT(*) FILTER (WHERE fa.is_unlocked = true) * 100.0) /
          NULLIF(COUNT(fa.final_assignment_id),0), 2
        ),0) AS avg_completion,

       (
          SELECT COALESCE(
            ROUND(AVG(f2.rating), 2),
            0
          )
          FROM tbl_feedback f2
          JOIN tbl_course c2
            ON f2.course_id = c2.course_id
          WHERE c2.tutor_id = $1
        ) AS avg_rating

      FROM tbl_course c
      LEFT JOIN tbl_student_course sc ON c.course_id = sc.course_id
      LEFT JOIN tbl_student_final_assignment fa ON c.course_id = fa.course_id
      LEFT JOIN tbl_feedback f ON c.course_id = f.course_id
      WHERE c.tutor_id = $1
    `, [tutor_id]);

    // =========================
    // 2️⃣ MONTHLY GRAPH
    // =========================
    const monthsResult = await pool.query(`
        SELECT 
        generate_series(
          DATE_TRUNC('month', NOW()) - INTERVAL '3 months',
          DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
          INTERVAL '1 month'
        ) AS month_date,
        TO_CHAR(
          generate_series(
            DATE_TRUNC('month', NOW()) - INTERVAL '3 months',
            DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
            INTERVAL '1 month'
          ),
          'YYYY-MM'
        ) AS month_key
    `);


    const monthlyData = await pool.query(`
    SELECT 
      TO_CHAR(m.month_date, 'YYYY-MM') AS month_key,
      m.month_date,
      (
    SELECT json_agg(course_data)
    FROM (
      SELECT 
        c.course_title,
        COUNT(DISTINCT sc.student_id) AS enrollments
      FROM tbl_student_course sc
      JOIN tbl_course c ON sc.course_id = c.course_id
      WHERE c.tutor_id = $1
      AND sc.created_at >= m.month_date
      AND sc.created_at < m.month_date + INTERVAL '1 month'
      GROUP BY c.course_id, c.course_title
    ) course_data
  ) AS courses,
      -- Enrollments
      (
        SELECT COUNT(DISTINCT sc.student_id)
        FROM tbl_student_course sc
        JOIN tbl_course c ON sc.course_id = c.course_id
        WHERE c.tutor_id = $1
        AND sc.created_at >= m.month_date
        AND sc.created_at < m.month_date + INTERVAL '1 month'
      ) AS enrollments,

      -- Views
      (
        SELECT COUNT(DISTINCT u.user_id)
        FROM tbl_user u
        WHERE u.role = 'student'
        AND u.created_at >= m.month_date
        AND u.created_at < m.month_date + INTERVAL '1 month'
      ) AS views,

      -- Completions
      (
        SELECT COUNT(DISTINCT fa.student_id)
        FROM tbl_student_final_assignment fa
        JOIN tbl_course c ON fa.course_id = c.course_id
        WHERE c.tutor_id = $1
        AND fa.is_unlocked = true
        AND fa.created_at >= m.month_date
        AND fa.created_at < m.month_date + INTERVAL '1 month'
      ) AS completions

      FROM (
      SELECT generate_series(
      DATE_TRUNC('month', NOW()) - INTERVAL '4 months',  -- start
      DATE_TRUNC('month', NOW()),                        -- end (current month)
      INTERVAL '1 month'
       ) AS month_date
    ) m

    ORDER BY m.month_date
    `, [tutor_id]);


    // const monthlyMap = {};

    // monthlyData.rows.forEach(row => {
    //   monthlyMap[row.month_key] = {
    //     enrollments: parseInt(row.enrollments),
    //     views: parseInt(row.views),
    //     completions: parseInt(row.completions)
    //   };
    // });

const monthlyGraph = monthlyData.rows.map(row => ({
  month: new Date(row.month_key + '-01')
            .toLocaleString('en-US', { month: 'short' }),
  enrollments: parseInt(row.enrollments),
  views: parseInt(row.views),
  completions: parseInt(row.completions),
  courses: row.courses || []   // ✅ course-wise data
}));

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
    // 4️⃣ TOP COURSES
    // =========================
    const coursesQuery = await pool.query(`
      SELECT 
        c.course_title,

        COUNT(DISTINCT sc.student_id) AS students,
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
    // 5️⃣ STUDENT PERFORMANCE
    // =========================
    const studentPerformanceQuery = await pool.query(`
            SELECT 
        u.full_name AS student_name,
        c.course_title,
      fa.grade,
      fa.total_marks,
        ROUND(
            (
              COUNT(*) FILTER (WHERE fa.status = 'Completed')::decimal
              /
              COUNT(*) 
            ) * 100,
          0) AS progress,

       ROUND(
          COALESCE(
            AVG(fa.total_marks::int)
            FILTER (
              WHERE 
                fa.status = 'Completed' 
                AND fa.total_marks ~ '^[0-9]+$'
            ),
          0),
        2) AS avg_score,
        

        CASE 
          WHEN MAX(fa.created_at) >= NOW() - INTERVAL '7 days'
          THEN 'Active'
          ELSE 'Inactive'
        END AS activity_status

      FROM tbl_student_final_assignment fa
      JOIN tbl_user u ON fa.student_id = u.user_id
      JOIN tbl_course c ON fa.course_id = c.course_id
      WHERE c.tutor_id = $1

      GROUP BY u.full_name, c.course_title,fa.grade,fa.total_marks
      ORDER BY avg_score DESC
      LIMIT 10;
    `, [tutor_id]);

    const engagementMetrics = await pool.query(`
  SELECT 

    -- ✅ Active Students
    (
      SELECT COUNT(DISTINCT sc.student_id)
      FROM tbl_student_course sc
      JOIN tbl_course c ON sc.course_id = c.course_id
      WHERE c.tutor_id = $1
    ) AS active_students,

    -- ✅ Assignment Completion %
    (
      SELECT COALESCE(ROUND(
        (COUNT(*) FILTER (WHERE fa.status = 'Completed') * 100.0) /
        NULLIF(COUNT(*),0), 2
      ), 0)
      FROM tbl_student_final_assignment fa
      JOIN tbl_course c ON fa.course_id = c.course_id
      WHERE c.tutor_id = $1
    ) AS assignment_completion,

    -- ✅ Avg Study Time
(
  SELECT COALESCE(
    TO_CHAR(
      make_interval(
        secs => (
          SUM(EXTRACT(EPOCH FROM scp.watched::time))
          /
          NULLIF(
            COUNT(DISTINCT scp.student_id),
            0
          )
        )::int
      ),
      'HH24:MI:SS'
    ),
    '00:00:00'
  )

  FROM tbl_student_course_progress scp
  JOIN tbl_course c
    ON scp.course_id = c.course_id

  WHERE c.tutor_id = $1
  AND scp.watched IS NOT NULL

) AS avg_study_time
`, [tutor_id]);

    // =========================
    // FINAL RESPONSE
    // =========================
    return res.status(200).json({
      statusCode: 200,
      dashboard: {
        stats: statsQuery.rows[0],
        monthlyGraph,
        gradeChart,
        topCourses: coursesQuery.rows,

        studentPerformance: studentPerformanceQuery.rows,
        engagementMetrics: engagementMetrics.rows[0]
      }
    });

  } catch (error) {
    console.log(error)
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};


exports.studentpurchaselist = async (req, res) => {
  try {

    // ✅ 1. Get stats
    const statsResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT sc.student_id)::int AS total_students,

        COUNT(*) FILTER (
          WHERE sc.created_at >= NOW() - INTERVAL '7 days'
        )::int AS last_week_purchases,

       COUNT(*)::int AS total_purchased_courses,

        COALESCE(SUM(sc.order_amount), 0)::numeric AS total_revenue

      FROM tbl_student_course sc
    `);

    // ✅ 2. Get purchase list
    const studentPurchases = await pool.query(`
      SELECT 
        sc.student_course_id,
        sc.course_id,
        c.course_title,
        sc.student_id,
        u.full_name,
        u.phone_number,
        u.email,
        u.student_reg_number,
        sc.order_amount,
        sc.transaction_id,
        sc.payment_status,
        TO_CHAR(sc.created_at AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY') AS submitted_at
      FROM tbl_student_course sc
      JOIN tbl_user u ON sc.student_id = u.user_id
      JOIN tbl_course c ON sc.course_id = c.course_id
      ORDER BY sc.created_at DESC
    `);

    return res.status(200).json({
      statusCode: 200,
      stats: statsResult.rows[0],
      data: studentPurchases.rows
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
    });
  }
};