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
       WHERE n.receiver_id = $1`,
      [receiver_id]
    );

    return res.status(200).json({
      statusCode: 200,
      message: result.rows
    });

  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error'
    });
  }
};

 