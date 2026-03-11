exports.validateCertificateFiles = (req, res, next) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf"
  ];

const maxSize = 10 * 1024 * 1024; // 10MB

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
        message: "Certificate file size should not exceed 10MB"
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

  const maxSize = 100 * 1024; // 100KB

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
      message: "Profile picture size should not exceed 100KB"
    });
  }

  next();
};