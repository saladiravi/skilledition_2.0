const express = require("express");
const router = express.Router();
const chatController = require("../controller/chatController");
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const upload = require('../utils/uploadfile');


router.post('/sendmessage',upload.fields([
    { name: "file_url", maxCount: 1 }]), verifyToken, allowRoles("admin","student","tutor"),chatController.sendMessage);
router.post('/getMessages', verifyToken, allowRoles("admin","student","tutor"),chatController.getMessages);
router.post('/getChatList', verifyToken, allowRoles("admin","student","tutor"),chatController.getChatList);


module.exports = router;
