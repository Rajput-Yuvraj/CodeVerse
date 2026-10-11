const { pool } = require('../config/db');

class ChatRepository {
  // ========== AI Chat Methods (chat_messages table) ==========

  /**
   * Create an AI chat user message
   * @param {Object} messageData
   * @param {string} messageData.workspaceId
   * @param {number} messageData.userId
   * @param {string} messageData.message
   * @returns {Promise<Object>} Created message with ID
   */
  async createAIUserMessage({ workspaceId, userId, message }) {
    try {
      const [result] = await pool.query(
        `INSERT INTO chat_messages (workspace_id, user_id, message, role)
         VALUES (?, ?, ?, 'user')`,
        [workspaceId, userId, message]
      );

      return {
        id: result.insertId,
        workspace_id: workspaceId,
        user_id: userId,
        message,
        role: 'user'
      };
    } catch (error) {
      console.error('Error creating AI user message:', error);
      throw error;
    }
  }

  /**
   * Create an AI chat assistant message
   * @param {Object} messageData
   * @param {string} messageData.workspaceId
   * @param {number} messageData.userId
   * @param {string} messageData.message
   * @param {string} messageData.response
   * @returns {Promise<Object>} Created message with ID
   */
  async createAIAssistantMessage({ workspaceId, userId, message, response }) {
    try {
      const [result] = await pool.query(
        `INSERT INTO chat_messages (workspace_id, user_id, message, response, role)
         VALUES (?, ?, ?, ?, 'assistant')`,
        [workspaceId, userId, message, response]
      );

      return {
        id: result.insertId,
        workspace_id: workspaceId,
        user_id: userId,
        message,
        response,
        role: 'assistant'
      };
    } catch (error) {
      console.error('Error creating AI assistant message:', error);
      throw error;
    }
  }

  /**
   * Get AI chat history for a workspace (limited)
   * @param {string} workspaceId
   * @param {number} limit - Number of messages to retrieve
   * @returns {Promise<Array>} Array of chat messages
   */
  async getAIChatHistory(workspaceId, limit = 10) {
    try {
      const [chatHistory] = await pool.query(
        `SELECT message, response, role
         FROM chat_messages
         WHERE workspace_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [workspaceId, limit]
      );
      return chatHistory;
    } catch (error) {
      console.error('Error getting AI chat history:', error);
      throw error;
    }
  }

  /**
   * Get full AI chat history with user details
   * @param {string} workspaceId
   * @returns {Promise<Array>} Array of chat messages with user info
   */
  async getAIChatHistoryWithUser(workspaceId) {
    try {
      const [chatHistory] = await pool.query(
        `SELECT cm.*, u.username
         FROM chat_messages cm
         LEFT JOIN users u ON cm.user_id = u.id
         WHERE cm.workspace_id = ?
         ORDER BY cm.created_at ASC`,
        [workspaceId]
      );
      return chatHistory;
    } catch (error) {
      console.error('Error getting AI chat history with user:', error);
      throw error;
    }
  }

  /**
   * Clear all AI chat history for a workspace
   * @param {string} workspaceId
   * @returns {Promise<boolean>} Success status
   */
  async clearAIChatHistory(workspaceId) {
    try {
      const [result] = await pool.query(
        'DELETE FROM chat_messages WHERE workspace_id = ?',
        [workspaceId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error clearing AI chat history:', error);
      throw error;
    }
  }

  // ========== User Chat Methods (user_chat_messages table) ==========

  /**
   * Create a user chat message
   * @param {Object} messageData
   * @param {string} messageData.workspaceId
   * @param {number} messageData.userId
   * @param {string} messageData.username
   * @param {string} messageData.message
   * @param {string} messageData.timestamp - ISO timestamp
   * @returns {Promise<Object>} Created message with ID and db timestamp
   */
  async createUserMessage({ workspaceId, userId, username, message, timestamp }) {
    try {
      // Convert ISO timestamp to MySQL DATETIME format
      const mysqlTimestamp = new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ');

      const [result] = await pool.query(
        `INSERT INTO user_chat_messages (workspace_id, user_id, username, message, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [workspaceId, userId, username, message, mysqlTimestamp]
      );

      // Get the database-generated timestamp for consistency
      const [msgRows] = await pool.query(
        'SELECT created_at FROM user_chat_messages WHERE id = ?',
        [result.insertId]
      );

      return {
        id: result.insertId,
        user_id: userId,
        username,
        message,
        timestamp: msgRows[0].created_at
      };
    } catch (error) {
      console.error('Error creating user message:', error);
      throw error;
    }
  }

  /**
   * Get user chat message by ID
   * @param {number} messageId
   * @param {string} workspaceId
   * @returns {Promise<Object|null>} Message object or null
   */
  async getUserMessageById(messageId, workspaceId) {
    try {
      const [messageRows] = await pool.query(
        'SELECT * FROM user_chat_messages WHERE id = ? AND workspace_id = ?',
        [messageId, workspaceId]
      );
      return messageRows.length > 0 ? messageRows[0] : null;
    } catch (error) {
      console.error('Error getting user message by ID:', error);
      throw error;
    }
  }

  /**
   * Get user chat history for a workspace
   * @param {string} workspaceId
   * @returns {Promise<Array>} Array of messages
   */
  async getUserChatHistory(workspaceId) {
    try {
      const [rows] = await pool.query(
        `SELECT id, user_id as userId, username, message, created_at as timestamp
         FROM user_chat_messages
         WHERE workspace_id = ?
         ORDER BY created_at ASC`,
        [workspaceId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting user chat history:', error);
      throw error;
    }
  }

  /**
   * Delete a specific user chat message
   * @param {number} messageId
   * @param {string} workspaceId
   * @returns {Promise<boolean>} Success status
   */
  async deleteUserMessage(messageId, workspaceId) {
    try {
      const [result] = await pool.query(
        'DELETE FROM user_chat_messages WHERE id = ? AND workspace_id = ?',
        [messageId, workspaceId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting user message:', error);
      throw error;
    }
  }

  /**
   * Delete all user chat messages for a workspace
   * @param {string} workspaceId
   * @returns {Promise<boolean>} Success status
   */
  async deleteAllUserMessages(workspaceId) {
    try {
      const [result] = await pool.query(
        'DELETE FROM user_chat_messages WHERE workspace_id = ?',
        [workspaceId]
      );
      return result.affectedRows >= 0; // Return true even if 0 messages deleted
    } catch (error) {
      console.error('Error deleting all user messages:', error);
      throw error;
    }
  }

  /**
   * Get message details for permission checking
   * @param {number} messageId
   * @param {string} workspaceId
   * @returns {Promise<Object|null>} Message with user_id and created_at
   */
  async getMessageDetails(messageId, workspaceId) {
    try {
      const [messageRows] = await pool.query(
        'SELECT user_id, created_at FROM user_chat_messages WHERE id = ? AND workspace_id = ?',
        [messageId, workspaceId]
      );
      return messageRows.length > 0 ? messageRows[0] : null;
    } catch (error) {
      console.error('Error getting message details:', error);
      throw error;
    }
  }
}

module.exports = new ChatRepository();
