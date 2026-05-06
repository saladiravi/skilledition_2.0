// const sanitizeInput = (req, res, next) => {
//   const sanitize = (obj) => {
//     for (let key in obj) {
//       if (typeof obj[key] === "string") {
//         obj[key] = obj[key].trim();
//       }
//     }
//   };

//   if (req.body) sanitize(req.body);
//   if (req.query) sanitize(req.query);
//   if (req.params) sanitize(req.params);

//   next();
// };

// module.exports = sanitizeInput;



const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (!obj) return;

    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === "string") {
        obj[key] = obj[key].trim();
      }
    });
  };

  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);

  console.log("Sanitized Body:", req.body);

  next();
};

module.exports = sanitizeInput;