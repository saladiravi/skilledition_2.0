const express = require('express');
const router = express.Router();
const contactController = require('../controller/contactcontroller');

router.post('/addcontact', contactController.addContact);

module.exports = router;
