const { pool } = require('../config/db');
const os = require('os');

class FileRepository {
  /**
   * Get save activity for a user (for dashboard heatmap)
   * @param {number} userId
   * @param {number} days - Number of days to fetch
   * @returns {Promise<Array>} Array of save activity records
   */
  async getSaveActivity(userId, days = 140) {
    try {
      const [rows] = await pool.query(
        `SELECT DATE_FORMAT(saved_at, '%Y-%m-%d') AS save_date, COUNT(*) AS save_count
         FROM file_save_events
         WHERE user_id = ?
           AND saved_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY DATE_FORMAT(saved_at, '%Y-%m-%d')
         ORDER BY save_date ASC`,
        [userId, days]
      );
      return rows;
    } catch (error) {
      console.error('Error getting save activity:', error);
      throw error;
    }
  }

  /**
   * Add a save event
   * @param {string} workspaceId
   * @param {number} fileId
   * @param {number} userId
   * @returns {Promise<boolean>} Success status
   */
  async addSaveEvent(workspaceId, fileId, userId) {
    try {
      await pool.query(
        'INSERT INTO file_save_events (workspace_id, file_id, user_id) VALUES (?, ?, ?)',
        [workspaceId, fileId, userId]
      );
      return true;
    } catch (error) {
      console.error('Error adding save event:', error);
      // Don't throw - save events are analytics and shouldn't break file operations
      return false;
    }
  }

  /**
   * Get all files and folders for a workspace
   * @param {string} workspaceId
   * @returns {Promise<Array>} Array of files and folders
   */
  async findByWorkspace(workspaceId) {
    try {
      const [files] = await pool.query(
        `SELECT id, workspace_id, name, type, content, language, parent_id, path, created_at, updated_at
         FROM workspace_files
         WHERE workspace_id = ?
         ORDER BY type DESC, name ASC`,
        [workspaceId]
      );
      return files;
    } catch (error) {
      console.error('Error finding files by workspace:', error);
      throw error;
    }
  }

  /**
   * Get a specific file or folder by ID
   * @param {number} fileId
   * @param {string} workspaceId
   * @returns {Promise<Object|null>} File object or null
   */
  async findById(fileId, workspaceId) {
    try {
      const [files] = await pool.query(
        `SELECT id, workspace_id, name, type, content, language, parent_id, path, created_at, updated_at
         FROM workspace_files
         WHERE id = ? AND workspace_id = ?`,
        [fileId, workspaceId]
      );
      return files.length > 0 ? files[0] : null;
    } catch (error) {
      console.error('Error finding file by ID:', error);
      throw error;
    }
  }

  /**
   * Get parent folder path
   * @param {number} parentId
   * @param {string} workspaceId
   * @returns {Promise<string|null>} Parent path or null
   */
  async getParentPath(parentId, workspaceId) {
    try {
      const [parent] = await pool.query(
        'SELECT path FROM workspace_files WHERE id = ? AND workspace_id = ?',
        [parentId, workspaceId]
      );
      return parent.length > 0 ? parent[0].path : null;
    } catch (error) {
      console.error('Error getting parent path:', error);
      throw error;
    }
  }

  /**
   * Create a new file or folder
   * @param {Object} fileData
   * @param {string} fileData.workspaceId
   * @param {string} fileData.name
   * @param {string} fileData.type - 'file' or 'folder'
   * @param {string} fileData.content
   * @param {string} fileData.language
   * @param {number} fileData.parentId
   * @param {string} fileData.path
   * @returns {Promise<Object>} Created file with ID
   */
  async create({ workspaceId, name, type, content, language, parentId, path }) {
    try {
      const [result] = await pool.query(
        `INSERT INTO workspace_files (workspace_id, name, type, content, language, parent_id, path)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [workspaceId, name, type, content || null, language || null, parentId || null, path]
      );

      return {
        id: result.insertId,
        workspace_id: workspaceId,
        name,
        type,
        content: content || null,
        language: language || null,
        parent_id: parentId || null,
        path
      };
    } catch (error) {
      console.error('Error creating file/folder:', error);
      throw error;
    }
  }

  /**
   * Update file content and language
   * @param {number} fileId
   * @param {string} workspaceId
   * @param {string} content
   * @param {string} language
   * @returns {Promise<boolean>} Success status
   */
  async update(fileId, workspaceId, content, language) {
    try {
      const [result] = await pool.query(
        `UPDATE workspace_files
         SET content = ?, language = ?
         WHERE id = ? AND workspace_id = ? AND type = 'file'`,
        [content, language || null, fileId, workspaceId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating file:', error);
      throw error;
    }
  }

  /**
   * Rename a file or folder
   * @param {number} fileId
   * @param {string} newName
   * @param {string} newPath
   * @returns {Promise<boolean>} Success status
   */
  async rename(fileId, newName, newPath) {
    try {
      const [result] = await pool.query(
        'UPDATE workspace_files SET name = ?, path = ? WHERE id = ?',
        [newName, newPath, fileId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error renaming file:', error);
      throw error;
    }
  }

  /**
   * Get all children of a folder (files/folders with path starting with parent path)
   * @param {string} folderPath
   * @param {string} workspaceId
   * @returns {Promise<Array>} Array of child files/folders
   */
  async getChildren(folderPath, workspaceId) {
    try {
      const [children] = await pool.query(
        'SELECT id, path FROM workspace_files WHERE path LIKE ? AND workspace_id = ?',
        [`${folderPath}/%`, workspaceId]
      );
      return children;
    } catch (error) {
      console.error('Error getting folder children:', error);
      throw error;
    }
  }

  /**
   * Update child file/folder path
   * @param {number} fileId
   * @param {string} newPath
   * @returns {Promise<boolean>} Success status
   */
  async updatePath(fileId, newPath) {
    try {
      const [result] = await pool.query(
        'UPDATE workspace_files SET path = ? WHERE id = ?',
        [newPath, fileId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating file path:', error);
      throw error;
    }
  }

  /**
   * Delete a file or folder
   * @param {number} fileId
   * @param {string} workspaceId
   * @returns {Promise<boolean>} Success status
   */
  async delete(fileId, workspaceId) {
    try {
      const [result] = await pool.query(
        'DELETE FROM workspace_files WHERE id = ? AND workspace_id = ?',
        [fileId, workspaceId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting file/folder:', error);
      throw error;
    }
  }

  /**
   * Get language distribution across all workspaces a user has access to
   * @param {number} userId
   * @returns {Promise<Array>} Array of { language, file_count }
   */
  async getLanguageStats(userId) {
    try {
      const [rows] = await pool.query(
        `SELECT wf.language, COUNT(*) AS file_count
         FROM workspace_files wf
         INNER JOIN user_workspaces uw ON wf.workspace_id = uw.workspace_id
         WHERE uw.user_id = ? AND wf.type = 'file' AND wf.language IS NOT NULL AND wf.language != ''
         GROUP BY wf.language
         ORDER BY file_count DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting language stats:', error);
      throw error;
    }
  }

  /**
   * Get system status metrics (DB pool info + server uptime)
   * @returns {Promise<Object>} System status metrics
   */
  async getSystemStatus() {
    try {
      const start = Date.now();
      await pool.query('SELECT 1');
      const latency = Date.now() - start;

      // Get active connection count from pool
      const poolInfo = pool.pool;
      const activeConnections = poolInfo?._allConnections?.length || 0;

      const uptimeSeconds = process.uptime();
      const uptimeHours = (uptimeSeconds / 3600).toFixed(1);

      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const memoryUsage = (((totalMemory - freeMemory) / totalMemory) * 100).toFixed(1);

      return {
        dbLatency: `${latency}ms`,
        dbLatencyStatus: latency < 100 ? 'Optimal' : latency < 300 ? 'Normal' : 'Slow',
        serverUptime: `${uptimeHours}h`,
        serverUptimeStatus: 'Stable',
        activeConnections: activeConnections.toString(),
        activeConnectionsStatus: activeConnections < 8 ? 'Healthy' : 'High',
        memoryUsage: `${memoryUsage}%`,
        memoryUsageStatus: parseFloat(memoryUsage) < 70 ? 'Normal' : parseFloat(memoryUsage) < 90 ? 'Warning' : 'Critical',
      };
    } catch (error) {
      console.error('Error getting system status:', error);
      throw error;
    }
  }
}

module.exports = new FileRepository();
