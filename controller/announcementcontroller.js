const pool = require('../config/db');

exports.createAnnouncement = async (req, res) => {
  const { tutor_id, course_id, title, message, priority } = req.body;

  if (!tutor_id || !course_id || !title || !message) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    // 1. Create announcement
    const announcementResult = await pool.query(
      `
      INSERT INTO tbl_announcements
      (tutor_id, course_id, title, message, priority)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING announcement_id
      `,
      [tutor_id, course_id, title, message, priority]
    );

    const announcementId = announcementResult.rows[0].announcement_id;

    // 2. Get students of course
    const students = await pool.query(
      `SELECT student_id FROM tbl_student_course WHERE course_id=$1`,
      [course_id]
    );

    // 3. Map students to announcement
    const inserts = students.rows.map(s =>
      pool.query(
        `INSERT INTO tbl_announcement_students (announcement_id, student_id)
         VALUES ($1,$2)`,
        [announcementId, s.student_id]
      )
    );

    await Promise.all(inserts);

    res.status(200).json({
      statusCode:200,
      message: "Announcement published successfully"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};



exports.getStudentAnnouncements = async (req, res) => {
  const { student_id } = req.body;

  try {
    const result = await pool.query(
      `
      SELECT 
        a.announcement_id,
        a.title,
        a.message,
        a.priority,
        a.created_at,
        c.course_title,
        s.is_read
      FROM tbl_announcement_students s
      JOIN tbl_announcements a ON a.announcement_id = s.announcement_id
      JOIN tbl_course c ON c.course_id = a.course_id
      WHERE s.student_id = $1
      ORDER BY a.created_at DESC
      `,
      [student_id]
    );

    res.status(200).json({
      statusCode:200,
      message:'Fetched Sucessfully',
      data:result.rows
  });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: "Internal Server Error" });
  }
};



exports.getTutorAnnouncements = async (req, res) => {
  const { tutor_id } = req.body;

  try {
    const result = await pool.query(
      `
      SELECT 
        a.announcement_id,
        a.title,
        a.priority,
        a.created_at,
        c.course_title,
        a.message,
        a.status,
        COUNT(s.student_id) AS total_students
      FROM tbl_announcements a
      LEFT JOIN tbl_announcement_students s
        ON a.announcement_id = s.announcement_id
      JOIN tbl_course c ON c.course_id = a.course_id
      WHERE a.tutor_id = $1
      GROUP BY a.announcement_id, c.course_title
      ORDER BY a.created_at DESC
      `,
      [tutor_id]
    );

    
    res.status(200).json({
      statusCode:200,
      message:'Fetched Sucessfully',
      data:result.rows

    })
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};


exports.markAnnouncementRead = async (req, res) => {
  const { announcement_id, student_id } = req.body;

  await pool.query(
    `
    UPDATE tbl_announcement_students
    SET is_read = true
    WHERE announcement_id = $1 AND student_id = $2
    `,
    [announcement_id, student_id]
  );

  res.json({ message: "Marked as read" });
};

 exports.updateAnnouncement = async (req, res) => {
  const { announcement_id, tutor_id, title, message } = req.body;

  if (!announcement_id || !tutor_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "announcement_id and tutor_id are required"
    });
  }

  if (!title && !message) {
    return res.status(400).json({
      statusCode: 400,
      message: "Nothing to update"
    });
  }

  try {
    const result = await pool.query(
      `
      UPDATE tbl_announcements
      SET 
        title = COALESCE($1, title),
        message = COALESCE($2, message)
      WHERE announcement_id = $3
        AND tutor_id = $4
      RETURNING announcement_id, title, message, created_at
      `,
      [title, message, announcement_id, tutor_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Announcement not found or unauthorized"
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Announcement updated successfully",
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


exports.deleteAnnouncement = async (req, res) => {
  const { announcement_id } = req.body;

  if (!announcement_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "announcement_id is required"
    });
  }

  try {
    /* -------- Delete from announcement_students first -------- */
    await pool.query(
      `
      DELETE FROM tbl_announcement_students
      WHERE announcement_id = $1
      `,
      [announcement_id]
    );

    /* -------- Then delete from announcements -------- */
    const result = await pool.query(
      `
      DELETE FROM tbl_announcements
      WHERE announcement_id = $1
      `,
      [announcement_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Announcement not found"
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Announcement deleted successfully"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};


 