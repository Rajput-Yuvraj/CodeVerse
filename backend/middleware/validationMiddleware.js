const { validationResult } = require('express-validator');


const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).json({
      success: false,
      error: firstError.msg,
      field: firstError.param,
      errors: errors.array() // Include all errors for debugging
    });
  }

  next();
};

module.exports = { handleValidationErrors };
