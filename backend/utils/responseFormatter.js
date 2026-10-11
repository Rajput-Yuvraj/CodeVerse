/**
 * Format successful response
 * @param {any} data - Response data
 * @param {string|null} message - Optional success message
 * @returns {Object} Formatted response object
 */
function success(data, message = null) {
  const response = { success: true };

  if (message) {
    response.message = message;
  }

  // If data is an object, spread it into the response
  // Otherwise, wrap it in a data property
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return { ...response, ...data };
  } else if (data !== undefined) {
    response.data = data;
  }

  return response;
}

/**
 * Format error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (for reference, not set here)
 * @returns {Object} Formatted error object
 */
function error(message, statusCode = 500) {
  return {
    success: false,
    error: message,
    statusCode
  };
}

/**
 * Send successful response
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @param {string|null} message - Optional success message
 * @param {number} statusCode - HTTP status code
 */
function sendSuccess(res, data, message = null, statusCode = 200) {
  res.status(statusCode).json(success(data, message));
}

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 */
function sendError(res, message, statusCode = 500) {
  res.status(statusCode).json(error(message, statusCode));
}

/**
 * Send created response (201)
 * @param {Object} res - Express response object
 * @param {any} data - Created resource data
 * @param {string} message - Success message
 */
function sendCreated(res, data, message = 'Resource created successfully') {
  sendSuccess(res, data, message, 201);
}

/**
 * Send not found response (404)
 * @param {Object} res - Express response object
 * @param {string} message - Not found message
 */
function sendNotFound(res, message = 'Resource not found') {
  sendError(res, message, 404);
}

/**
 * Send forbidden response (403)
 * @param {Object} res - Express response object
 * @param {string} message - Forbidden message
 */
function sendForbidden(res, message = 'Access denied') {
  sendError(res, message, 403);
}

/**
 * Send bad request response (400)
 * @param {Object} res - Express response object
 * @param {string} message - Bad request message
 */
function sendBadRequest(res, message = 'Invalid request') {
  sendError(res, message, 400);
}

/**
 * Send unauthorized response (401)
 * @param {Object} res - Express response object
 * @param {string} message - Unauthorized message
 */
function sendUnauthorized(res, message = 'Unauthorized') {
  sendError(res, message, 401);
}

module.exports = {
  success,
  error,
  sendSuccess,
  sendError,
  sendCreated,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendUnauthorized
};
