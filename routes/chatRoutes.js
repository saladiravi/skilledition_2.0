const express = require("express");
const router = express.Router();
const chatController = require("../controller/chatController");
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");


router.post('/sendmessage', verifyToken, allowRoles("admin","student","tutor"),chatController.sendMessage);
router.post('/getMessages', verifyToken, allowRoles("admin","student","tutor"),chatController.getMessages);
router.post('/getChatList', verifyToken, allowRoles("admin","student","tutor"),chatController.getChatList);


module.exports = router;
