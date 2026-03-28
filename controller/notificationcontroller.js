const pool=require('../config/db');


exports.getnotification = async (req, res) => {
  const { receiver_id } = req.body;

  try {
    const result = await pool.query(
      `SELECT 
         n.*, 
         u.full_name AS sender_name
       FROM tbl_notifications n
       JOIN tbl_user u 
         ON n.sender_id = u.user_id
       WHERE n.receiver_id = $1
       ORDER BY n.notification_id ASC`,
      [receiver_id]
    );

    return res.status(200).json({
      statusCode: 200,
      notification_data: result.rows
    });

  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
    });
  }
};

 

 exports.markNotificationAsRead = async (req, res) => {
  const { notification_id } = req.body;

  try {
    // 1️⃣ Validate input
    if (!notification_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "notification_id is required"
      });
    }

    // 2️⃣ Update query
    const result = await pool.query(
      `UPDATE tbl_notifications
       SET is_read = true
       WHERE notification_id = $1
       RETURNING *`,
      [notification_id]
    );

    // 3️⃣ Check if notification exists
    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Notification not found"
      });
    }

    // 4️⃣ Success response
    return res.status(200).json({
      statusCode: 200,
      message: "Notification marked as read"
  
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};


exports.deleteNotification = async (req, res) => {
  const { notification_id } = req.body;

  try {
    if (!notification_id) {
      return res.status(400).json({
        statusCode: 400,
        message: "notification_id is required"
      });
    }

    const result = await pool.query(
      `DELETE FROM tbl_notifications
       WHERE notification_id = $1
       RETURNING *`,
      [notification_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Notification not found"
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Notification deleted successfully"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};


exports.gettutorNotificationDashboard = async (req, res) => {
  const { tutor_id } = req.body  

  if (!tutor_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "tutor_id is required"
    });
  }

  try {

    // ✅ Run both queries in parallel
    const [countsResult, notificationsResult] = await Promise.all([

      // 📊 Dashboard Counts
      pool.query(`
        SELECT 
          COUNT(*) AS total_notifications,

          COUNT(*) FILTER (WHERE type = 'assignment') AS assignments,

          COUNT(*) FILTER (WHERE type = 'query') AS queries,
 

          COUNT(*) FILTER (WHERE type = 'feedback') AS feedbacks,

          COUNT(*) FILTER (WHERE is_read = false) AS unread_count

        FROM tbl_notifications
        WHERE receiver_id = $1
      `, [tutor_id]),


      // 🔔 Notifications List
   pool.query(`
          SELECT 
            notification_id,
            sender_id,
            type,
            message,
            is_read,

            -- ✅ Time Ago Format
            CASE
              WHEN NOW() - created_at < INTERVAL '1 minute'
                THEN CONCAT(EXTRACT(SECOND FROM NOW() - created_at)::int, ' sec ago')

              WHEN NOW() - created_at < INTERVAL '1 hour'
                THEN CONCAT(EXTRACT(MINUTE FROM NOW() - created_at)::int, ' min ago')

              WHEN NOW() - created_at < INTERVAL '1 day'
                THEN CONCAT(EXTRACT(HOUR FROM NOW() - created_at)::int, ' hr ago')

              WHEN NOW() - created_at < INTERVAL '7 days'
                THEN CONCAT(EXTRACT(DAY FROM NOW() - created_at)::int, ' days ago')

              ELSE TO_CHAR(created_at, 'DD Mon YYYY')
            END AS time_ago,

            created_at,
            type_id

          FROM tbl_notifications
          WHERE receiver_id = $1
          ORDER BY notification_id ASC
        `, [tutor_id])

    ]);

    return res.json({
      statusCode: 200,
      data: {
        dashboard: countsResult.rows[0],     // 📊 counts
        notifications: notificationsResult.rows // 🔔 list
      }
    });

  } catch (err) {
  
    res.status(500).json({
      message: "Internal Server Error"
    });
  }
};