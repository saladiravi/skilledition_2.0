const pool = require("../config/db");
const { uploadToS3, getSignedVideoUrl, deletefroms3 } = require('../utils/s3upload');


exports.sendMessage = async (req, res) => {
  const { user_id, course_id, message, student_id } = req.body;

  if (!user_id || !course_id) {
    return res.status(400).json({
      statusCode: 400,
      message: "user_id and course_id are required"
    });
  }

  try {
    // 1️⃣ Get User Role
    const userResult = await pool.query(
      `SELECT role FROM tbl_user WHERE user_id = $1`,
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "User not found"
      });
    }

    const role = userResult.rows[0].role;
    let chatRoomId;

    // =====================================================
    // 🟢 STUDENT LOGIC
    // =====================================================
    if (role === "student") {

      const existingRoom = await pool.query(
        `SELECT chat_room_id 
         FROM tbl_chat_room 
         WHERE course_id = $1 AND student_id = $2`,
        [course_id, user_id]
      );

      if (existingRoom.rows.length > 0) {
        chatRoomId = existingRoom.rows[0].chat_room_id;
      } else {
        const newRoom = await pool.query(
          `INSERT INTO tbl_chat_room (course_id, student_id, status)
           VALUES ($1, $2, 'active')
           RETURNING chat_room_id`,
          [course_id, user_id]
        );

        chatRoomId = newRoom.rows[0].chat_room_id;
      }
    }

    // =====================================================
    // 🔵 TUTOR / ADMIN LOGIC
    // =====================================================
    else {

      if (!student_id) {
        return res.status(400).json({
          statusCode: 400,
          message: "student_id is required for tutor/admin message"
        });
      }

      const room = await pool.query(
        `SELECT chat_room_id 
         FROM tbl_chat_room 
         WHERE course_id = $1 AND student_id = $2`,
        [course_id, student_id]
      );

      if (room.rows.length === 0) {
        return res.status(404).json({
          statusCode: 404,
          message: "Chat room not found for this student"
        });
      }

      chatRoomId = room.rows[0].chat_room_id;
    }

    const pauseCheck = await pool.query(
      `SELECT pause_chat 
       FROM tbl_chat_room
       WHERE chat_room_id=$1`,
      [chatRoomId]
    );

    if (pauseCheck.rows[0].pause_chat === true) {
      return res.status(403).json({
        statusCode: 403,
        message: "Chat is paused. You cannot send messages."
      });
    }

    // =====================================================
    // 📎 FILE / IMAGE UPLOAD
    // =====================================================
    let fileUrl = null;
    let fileType = "text";

    if (req.files?.file_url?.length > 0) {

      const uploadedKey = await uploadToS3(
        req.files.file_url[0],
        "chat/files"
      );

      fileUrl = uploadedKey;

      const mimeType = req.files.file_url[0].mimetype;

      if (mimeType.startsWith("image/")) {
        fileType = "image";
      } else {
        fileType = "file";
      }
    }

    // =====================================================
    // 💬 INSERT MESSAGE
    // =====================================================
    await pool.query(
      `INSERT INTO tbl_chat_messages
       (chat_room_id, sender_id, message, file_url, message_type, status)
       VALUES ($1, $2, $3, $4, $5, 'sent')`,
      [chatRoomId, user_id, message || null, fileUrl, fileType]
    );

    return res.status(200).json({
      statusCode: 200,
      message: "Message sent successfully",
      chat_room_id: chatRoomId
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};



exports.getMessages = async (req, res) => {
  const { chat_room_id } = req.body;

  try {

    const chatRoomResult = await pool.query(
      `SELECT pause_chat
       FROM tbl_chat_room
       WHERE chat_room_id = $1`,
      [chat_room_id]
    );

    const pauseChat = chatRoomResult.rows[0]?.pause_chat || false;

    const messagesResult = await pool.query(
      `SELECT m.chat_id,
              m.message,
              m.file_url,
              m.message_type,
              m.file_url AS file,
             TO_CHAR(m.created_at AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12-MI AM'),
              u.full_name,
              u.role
              
       FROM tbl_chat_messages m
       JOIN tbl_user u ON m.sender_id = u.user_id
          
       WHERE m.chat_room_id = $1
       ORDER BY m.created_at ASC`,
      [chat_room_id]
    );

    const messages = messagesResult.rows;

    // 🔥 Add signed URL for files/images
    for (let msg of messages) {

      if (msg.file_url && msg.message_type !== "text") {

        const signedUrl = await getSignedVideoUrl(msg.file_url);

        msg.file_url = signedUrl; // replace S3 key with signed URL
      }
    }

    res.status(200).json({
      statusCode: 200,
       pause_chat: pauseChat,
      messages
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};



// exports.getChatList = async (req, res) => {
//   const { user_id } = req.body;

//   try {

//     // 1️⃣ Get role
//     const userResult = await pool.query(
//       `SELECT role FROM tbl_user WHERE user_id = $1`,
//       [user_id]
//     );

//     if (userResult.rows.length === 0)
//       return res.status(404).json({
//         statusCode: 404,
//         message: "User not found"
//       });

//     const role = userResult.rows[0].role;

//     let result;

//     // ===================================================
//     // 🎓 STUDENT → Get Tutors From Purchased Courses
//     // ===================================================
//     if (role === "student") {

//       result = await pool.query(
//         `SELECT 
//             sc.course_id,
//             c.course_title,
//             c.tutor_id,
//             u.full_name AS tutor_name,

//             cr.chat_room_id

//          FROM tbl_student_course sc

//          JOIN tbl_course c 
//            ON sc.course_id = c.course_id

//          JOIN tbl_user u 
//            ON c.tutor_id = u.user_id

//          LEFT JOIN tbl_chat_room cr
//            ON cr.course_id = sc.course_id
//            AND cr.student_id = sc.student_id

//          WHERE sc.student_id = $1`,
//         [user_id]
//       );
//     }

//     // ===================================================
//     // 👨‍🏫 TUTOR → Get Students Who Purchased His Course
//     // ===================================================
//     else if (role === "tutor") {

//       result = await pool.query(
//         `SELECT 
//             sc.course_id,
//             c.course_title,
//             sc.student_id,
//             u.full_name AS student_name,

//             cr.chat_room_id

//          FROM tbl_student_course sc

//          JOIN tbl_course c 
//            ON sc.course_id = c.course_id

//          JOIN tbl_user u 
//            ON sc.student_id = u.user_id

//          LEFT JOIN tbl_chat_room cr
//            ON cr.course_id = sc.course_id
//            AND cr.student_id = sc.student_id

//          WHERE c.tutor_id = $1`,
//         [user_id]
//       );
//     }

//     else {
//       return res.status(403).json({
//         statusCode: 403,
//         message: "Invalid role"
//       });
//     }

//     return res.status(200).json({
//       statusCode: 200,
//       chatList: result.rows
//     });

//   } catch (error) {

//     res.status(500).json({
//       statusCode: 500,
//       message: "Internal Server Error"
//     });
//   }
// };





exports.getChatList = async (req, res) => {
  const { user_id } = req.body;

  try {
    // 1️⃣ Get role
    const userResult = await pool.query(
      `SELECT role FROM tbl_user WHERE user_id = $1`,
      [user_id]
    );

    if (userResult.rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    const role = userResult.rows[0].role;

    let result;

    // ===================================================
    // 🎓 STUDENT
    // ===================================================
    if (role === "student") {

      result = await pool.query(
        `SELECT 
            sc.course_id,
            c.course_title,
            c.tutor_id,
            u.full_name AS tutor_name,
            cr.chat_room_id
         FROM tbl_student_course sc
         JOIN tbl_course c ON sc.course_id = c.course_id
         JOIN tbl_user u ON c.tutor_id = u.user_id
         LEFT JOIN tbl_chat_room cr
           ON cr.course_id = sc.course_id
           AND cr.student_id = sc.student_id
         WHERE sc.student_id = $1`,
        [user_id]
      );
    }

    // ===================================================
    // 👨‍🏫 TUTOR
    // ===================================================
    else if (role === "tutor") {

      result = await pool.query(
        `SELECT 
            sc.course_id,
            c.course_title,
            sc.student_id,
            u.full_name AS student_name,
            cr.chat_room_id
         FROM tbl_student_course sc
         JOIN tbl_course c ON sc.course_id = c.course_id
         JOIN tbl_user u ON sc.student_id = u.user_id
         LEFT JOIN tbl_chat_room cr
           ON cr.course_id = sc.course_id
           AND cr.student_id = sc.student_id
         WHERE c.tutor_id = $1`,
        [user_id]
      );
    }

    // ===================================================
    // 👑 ADMIN → Get ALL student-tutor chats
    // ===================================================
    else if (role === "admin") {

      result = await pool.query(
        `SELECT 
            sc.course_id,
            c.course_title,
            c.tutor_id,
            t.full_name AS tutor_name,
            sc.student_id,
            s.full_name AS student_name,
            cr.chat_room_id
         FROM tbl_student_course sc
         JOIN tbl_course c ON sc.course_id = c.course_id
         JOIN tbl_user t ON c.tutor_id = t.user_id
         JOIN tbl_user s ON sc.student_id = s.user_id
         LEFT JOIN tbl_chat_room cr
           ON cr.course_id = sc.course_id
           AND cr.student_id = sc.student_id`
      );
    }

    else {
      return res.status(403).json({ message: "Invalid role" });
    }

    return res.status(200).json({
      statusCode: 200,
      chatList: result.rows
    });

  } catch (error) {

    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.updateMessage = async (req, res) => {
  const { chat_id, message } = req.body;

  try {

    let fileUrl = null;
    let messageType = "text";

    // ✅ If file uploaded
    if (req.files?.file_url?.length > 0) {

      const uploadedKey = await uploadToS3(
        req.files.file_url[0],
        "chat/files"
      );

      fileUrl = uploadedKey;

      const mimeType = req.files.file_url[0].mimetype;

      messageType = mimeType.startsWith("image/")
        ? "image"
        : "file";

      const result = await pool.query(
        `UPDATE tbl_chat_messages
         SET message = NULL,
             file_url = $1,
             message_type = $2
         WHERE chat_id = $3
         RETURNING *`,
        [fileUrl, messageType, chat_id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Message not found" });
      }

      return res.status(200).json({
        statusCode: 200,
        message: "File updated successfully"

      });
    }

    // ✅ If only message update
    if (message) {

      const result = await pool.query(
        `UPDATE tbl_chat_messages
         SET message = $1,
             file_url = NULL,
             message_type = 'text'
         WHERE chat_id = $2
         RETURNING *`,
        [message, chat_id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          statusCode: 404,
          message: "Message not found"
        });
      }

      return res.status(200).json({
        statusCode: 200,
        message: "Message updated successfully"

      });
    }

    return res.status(400).json({
      statusCode: 400,
      message: "Nothing to update"
    });

  } catch (error) {

    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};



exports.updatepausechat = async (req, res) => {
  const { chat_room_id, pause_chat } = req.body;

  try {

    const result = await pool.query(
      `UPDATE tbl_chat_room
         SET pause_chat = $1
           WHERE chat_room_id = $2
         RETURNING *`,
      [pause_chat, chat_room_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        statusCode: 404,
        message: "Message not found"
      });
    }

    return res.status(200).json({
      statusCode: 200,
      message: "pause chat successfully",
      data: result.rows[0]
    });
  }
  catch (error) {
    console.log(error);
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
}