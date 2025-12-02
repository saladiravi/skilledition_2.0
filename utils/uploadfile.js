const path = require('path');
const multer = require('multer');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads');

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // use absolute path, not 'uploads/'
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const allowedMimeTypes = [
  'image/jpeg', 'image/png', 'image/jpg',
  'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm', 'video/quicktime',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only image, video, and document files are allowed!'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 1000 * 1024 * 1024 } // 1000 MB
});

module.exports = upload;
