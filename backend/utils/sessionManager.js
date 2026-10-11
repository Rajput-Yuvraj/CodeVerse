const crypto = require('crypto');
const { pool } = require('../config/db');

const generateSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

const createSession = async (userId, token, req) => {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent') || '';

  try {
    await pool.query(
      'INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, userId, token, ipAddress, userAgent, expiresAt]
    );

    return { sessionId, expiresAt };
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
};

const verifySession = async (token) => {
  try {
    const [sessions] = await pool.query(
      `SELECT s.id as session_id, s.user_id, u.username, u.email 
       FROM sessions s
       INNER JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > NOW()
       LIMIT 1`,
      [token]
    );

    if (sessions.length === 0) {
      return null;
    }

    await pool.query(
      'UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ?',
      [sessions[0].session_id]
    );

    return {
      sessionId: sessions[0].session_id,
      user: {
        id: sessions[0].user_id,
        username: sessions[0].username,
        email: sessions[0].email
      }
    };
  } catch (error) {
    console.error('Error verifying session:', error);
    return null;
  }
};

const deleteSession = async (sessionId) => {
  try {
    await pool.query('DELETE FROM sessions WHERE id = ?', [sessionId]);
    return true;
  } catch (error) {
    console.error('Error deleting session:', error);
    return false;
  }
};

const deleteUserSessions = async (userId) => {
  try {
    await pool.query('DELETE FROM sessions WHERE user_id = ?', [userId]);
    return true;
  } catch (error) {
    console.error('Error deleting user sessions:', error);
    return false;
  }
};

const deleteSessionByToken = async (token) => {
  try {
    await pool.query('DELETE FROM sessions WHERE token = ?', [token]);
    return true;
  } catch (error) {
    console.error('Error deleting session by token:', error);
    return false;
  }
};

const cleanupExpiredSessions = async () => {
  try {
    const [result] = await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
    console.log(`Cleaned up ${result.affectedRows} expired sessions`);
    return result.affectedRows;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    return 0;
  }
};

const getUserSessions = async (userId) => {
  try {
    const [sessions] = await pool.query(
      `SELECT id, ip_address, user_agent, created_at, last_activity, expires_at 
       FROM sessions 
       WHERE user_id = ? AND expires_at > NOW()
       ORDER BY last_activity DESC`,
      [userId]
    );
    return sessions;
  } catch (error) {
    console.error('Error getting user sessions:', error);
    return [];
  }
};

module.exports = {
  generateSessionId,
  createSession,
  verifySession,
  deleteSession,
  deleteUserSessions,
  deleteSessionByToken,
  cleanupExpiredSessions,
  getUserSessions
};
