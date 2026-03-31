exports.validateCertificateFiles = (req, res, next) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf"
  ];

const maxSize = 5 * 1024 * 1024; // 5MB

  if (!req.files || !req.files.certificate_file) {
    return res.status(400).json({
      message: "Certificate files are required"
    });
  }

  const files = req.files.certificate_file;

  for (let file of files) {
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        statusCode:400,
        message: "Only image and PDF files are allowed for certificates"
      });
    }

    if (file.size > maxSize) {
      return res.status(400).json({
        statusCode:400,
        message: "Certificate file size should not exceed 5MB"
      });
    }
  }

  next();
};

exports.updatevalidateCertificateFiles = (req, res, next) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf"
  ];

  const maxSize = 10 * 1024 * 1024;

  if (!req.files || req.files.length === 0) {
    return next(); // allow update without new files
  }

  for (const file of req.files) {
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        statusCode: 400,
        message: "Only image and PDF files are allowed"
      });
    }

    if (file.size > maxSize) {
      return res.status(400).json({
        statusCode: 400,
        message: "Certificate file size should not exceed 10MB"
      });
    }
  }

  next();
};




exports.validateProfilePic = (req, res, next) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg"
  ];

  const maxSize = 50 * 1024; // 50KB

  // if (!req.files || !req.files.profile_pic) {
  //   return res.status(400).json({
  //       statusCode:400,
  //     message: "Profile picture is required"
  //   });
  // }

  const file = req.files.profile_pic[0];

  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
        statusCode:400,
      message: "Only JPG, JPEG, PNG images are allowed for profile picture"
    });
  }

  if (file.size > maxSize) {
    return res.status(400).json({
        statusCode:400,
      message: "Profile picture size should not exceed 50KB"
    });
  }

  next();
};


exports.validateDemoVideos = (req, res, next) => {
  const allowedTypes = [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",   // .mov
    "video/x-msvideo",   // .avi
    "video/x-matroska",  // .mkv
    "video/webm"
  ];

  const maxSize = 100 * 1024 * 1024; // 100MB

  if (!req.files || !req.files.video_file || req.files.video_file.length === 0) {
    return res.status(400).json({
      statusCode: 400,
      message: "Video file is required"
    });
  }

  const files = req.files.video_file;

  for (const file of files) {
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        statusCode: 400,
        message: "Only video files are allowed (mp4, mov, avi, mkv, webm)"
      });
    }

    if (file.size > maxSize) {
      return res.status(400).json({
        statusCode: 400,
        message: "Video file size should not exceed 100MB"
      });
    }
  }

  next();
};


exports.studentvalidateProfilePic = (req, res, next) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  const maxSize = 50 * 1024; // 50KB

  // ✅ IMPORTANT: handle no file case
  if (!req.file) {
    return next(); // or throw error if mandatory
  }

  const file = req.file;

  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      statusCode: 400,
      message: "Only JPG, JPEG, PNG allowed"
    });
  }

  if (file.size > maxSize) {
    return res.status(400).json({
      statusCode: 400,
      message: "Profile picture size should not exceed 50KB"
    });
  }

  next();
};

exports.tutorvalidateProfilePic = (req, res, next) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  const maxSize = 50 * 1024; // 50KB

  // ✅ Check if file exists
  // if (!req.files || !req.files.profile_pic || req.files.profile_pic.length === 0) {
  //   return res.status(400).json({
  //     statusCode: 400,
  //     message: "Profile picture is required"
  //   });
  // }

  const file = req.files.profile_pic[0];

  // ✅ Type validation
  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      statusCode: 400,
      message: "Only JPG, JPEG, PNG images are allowed"
    });
  }

  // ✅ Size validation
  if (file.size > maxSize) {
    return res.status(400).json({
      statusCode: 400,
      message: "Profile picture size should not exceed 50KB"
    });
  }

  next();
};

exports.validateTutorProfilePic = (req, res, next) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  const maxSize = 50 * 1024; // 50KB

  // ✅ If no file uploaded → allow (optional upload)
  if (!req.files || !req.files.profile_pic || req.files.profile_pic.length === 0) {
    return next();
  }

  const file = req.files.profile_pic[0];

  // ✅ File type check
  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      statusCode: 400,
      message: "Only JPG, JPEG, PNG images are allowed"
    });
  }

  // ✅ File size check
  if (file.size > maxSize) {
    return res.status(400).json({
      statusCode: 400,
      message: "Profile picture size should not exceed 50KB"
    });
  }

  next();
};