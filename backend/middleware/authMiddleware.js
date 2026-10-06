const jwt = require('jsonwebtoken');
const { verifySession } = require('../utils/sessionManager');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const sessionData = await verifySession(token);

    if (!sessionData) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    req.user = sessionData.user;
    req.sessionId = sessionData.sessionId;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(401).json({ error: 'Token is not valid' });
  }
};

const protect = authMiddleware;

module.exports = { protect, authMiddleware };
