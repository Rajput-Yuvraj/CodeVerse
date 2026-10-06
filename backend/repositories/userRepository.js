const { pool } = require('../config/db');

class UserRepository {
  /**
   * Find user by ID
   * @param {number} userId
   * @returns {Promise<Object|null>} User object or null
   */
  async findById(userId) {
    try {
      const [users] = await pool.query(
        'SELECT id, username, email, created_at, updated_at FROM users WHERE id = ?',
        [userId]
      );
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  /**
   * Find user by ID with password (for authentication)
   * @param {number} userId
   * @returns {Promise<Object|null>} User object with password or null
   */
  async findByIdWithPassword(userId) {
    try {
      const [users] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error finding user by ID with password:', error);
      throw error;
    }
  }

  /**
   * Find user by email
   * @param {string} email
   * @returns {Promise<Object|null>} User object or null
   */
  async findByEmail(email) {
    try {
      const [users] = await pool.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  /**
   * Find user by username
   * @param {string} username
   * @returns {Promise<Object|null>} User object or null
   */
  async findByUsername(username) {
    try {
      const [users] = await pool.query(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error finding user by username:', error);
      throw error;
    }
  }

  /**
   * Find user by email or username
   * @param {string} email
   * @param {string} username
   * @returns {Promise<Object|null>} User object or null
   */
  async findByEmailOrUsername(email, username) {
    try {
      const [users] = await pool.query(
        'SELECT * FROM users WHERE email = ? OR username = ?',
        [email, username]
      );
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error finding user by email or username:', error);
      throw error;
    }
  }

  /**
   * Create a new user
   * @param {Object} userData
   * @param {string} userData.username
   * @param {string} userData.email
   * @param {string} userData.password - Hashed password
   * @returns {Promise<Object>} Created user with ID
   */
  async create({ username, email, password }) {
    try {
      const [result] = await pool.query(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, password]
      );

      return {
        id: result.insertId,
        username,
        email
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update user information
   * @param {number} userId
   * @param {Object} updates
   * @returns {Promise<boolean>} Success status
   */
  async update(userId, updates) {
    try {
      const allowedFields = ['username', 'email', 'password'];
      const updateFields = [];
      const updateValues = [];

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          updateFields.push(`${key} = ?`);
          updateValues.push(updates[key]);
        }
      });

      if (updateFields.length === 0) {
        return false;
      }

      updateValues.push(userId);

      const [result] = await pool.query(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete a user
   * @param {number} userId
   * @returns {Promise<boolean>} Success status
   */
  async delete(userId) {
    try {
      const [result] = await pool.query(
        'DELETE FROM users WHERE id = ?',
        [userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}

module.exports = new UserRepository();
