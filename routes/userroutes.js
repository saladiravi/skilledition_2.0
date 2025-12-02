// routes/userroutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controller/usercontroller');

router.post('/adduser', userController.addUser);
router.post('/loginuser',userController.loginUser);

module.exports = router;
