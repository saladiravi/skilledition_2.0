const pool = require('../config/db'); // adjust path

const sendNotification = async ({
  sender_id,
  receiver_id,
  type,
  message,
  type_id
}) => {
  try {
    const result = await pool.query(
      `INSERT INTO tbl_notifications
       (sender_id, receiver_id, type, message, type_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [sender_id, receiver_id, type, message, type_id]
    );

    return result.rows[0];

  } catch (error) {
    console.error('Notification Error:', error);
    return null;
  }
};

module.exports = { sendNotification };