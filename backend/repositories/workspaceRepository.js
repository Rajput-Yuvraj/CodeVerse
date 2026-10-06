const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class WorkspaceRepository {
  /**
   * Create a new workspace
   * @param {Object} workspaceData
   * @param {string} workspaceData.name
   * @param {string} workspaceData.description
   * @param {number} workspaceData.ownerId
   * @param {string} workspaceData.language
   * @returns {Promise<Object>} Created workspace
   */
  async create({ name, description, ownerId, language }) {
    try {
      const workspaceId = uuidv4();

      await pool.query(
        'INSERT INTO workspaces (id, name, description, owner_id, language) VALUES (?, ?, ?, ?, ?)',
        [workspaceId, name, description || '', ownerId, language || 'javascript']
      );

      return {
        id: workspaceId,
        name,
        description,
        owner_id: ownerId,
        language: language || 'javascript'
      };
    } catch (error) {
      console.error('Error creating workspace:', error);
      throw error;
    }
  }

  /**
   * Find workspace by ID
   * @param {string} workspaceId
   * @param {boolean} activeOnly - Only return active workspaces
   * @returns {Promise<Object|null>} Workspace object or null
   */
  async findById(workspaceId, activeOnly = true) {
    try {
      const query = activeOnly
        ? 'SELECT * FROM workspaces WHERE id = ? AND is_active = true'
        : 'SELECT * FROM workspaces WHERE id = ?';

      const [workspaces] = await pool.query(query, [workspaceId]);
      return workspaces.length > 0 ? workspaces[0] : null;
    } catch (error) {
      console.error('Error finding workspace by ID:', error);
      throw error;
    }
  }

  /**
   * Find workspace by ID with owner information
   * @param {string} workspaceId
   * @returns {Promise<Object|null>} Workspace with owner name or null
   */
  async findByIdWithOwner(workspaceId) {
    try {
      const [workspaces] = await pool.query(
        `SELECT w.*, u.username as owner_name
         FROM workspaces w
         INNER JOIN users u ON w.owner_id = u.id
         WHERE w.id = ? AND w.is_active = true`,
        [workspaceId]
      );
      return workspaces.length > 0 ? workspaces[0] : null;
    } catch (error) {
      console.error('Error finding workspace with owner:', error);
      throw error;
    }
  }

  /**
   * Get all workspaces for a user
   * @param {number} userId
   * @returns {Promise<Array>} Array of workspaces
   */
  async findByUser(userId) {
    try {
      const [workspaces] = await pool.query(
        `SELECT w.*, uw.role, uw.joined_at, uw.last_accessed,
                u.username as owner_name
         FROM workspaces w
         INNER JOIN user_workspaces uw ON w.id = uw.workspace_id
         INNER JOIN users u ON w.owner_id = u.id
         WHERE uw.user_id = ? AND w.is_active = true
         ORDER BY uw.last_accessed DESC`,
        [userId]
      );
      return workspaces;
    } catch (error) {
      console.error('Error finding workspaces by user:', error);
      throw error;
    }
  }

  /**
   * Update workspace code
   * @param {string} workspaceId
   * @param {string} code
   * @returns {Promise<boolean>} Success status
   */
  async updateCode(workspaceId, code) {
    try {
      const [result] = await pool.query(
        'UPDATE workspaces SET code = ? WHERE id = ?',
        [code, workspaceId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating workspace code:', error);
      throw error;
    }
  }

  /**
   * Update workspace information
   * @param {string} workspaceId
   * @param {Object} updates
   * @returns {Promise<boolean>} Success status
   */
  async update(workspaceId, updates) {
    try {
      const allowedFields = ['name', 'description', 'language', 'code', 'is_active'];
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

      updateValues.push(workspaceId);

      const [result] = await pool.query(
        `UPDATE workspaces SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating workspace:', error);
      throw error;
    }
  }

  /**
   * Delete a workspace
   * @param {string} workspaceId
   * @returns {Promise<boolean>} Success status
   */
  async delete(workspaceId) {
    try {
      const [result] = await pool.query(
        'DELETE FROM workspaces WHERE id = ?',
        [workspaceId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting workspace:', error);
      throw error;
    }
  }

  // ========== User Workspace Relationship Methods ==========

  /**
   * Get user's role in workspace
   * @param {number} userId
   * @param {string} workspaceId
   * @returns {Promise<Object|null>} Role object or null
   */
  async getUserWorkspaceRole(userId, workspaceId) {
    try {
      const [access] = await pool.query(
        'SELECT role FROM user_workspaces WHERE user_id = ? AND workspace_id = ?',
        [userId, workspaceId]
      );
      return access.length > 0 ? access[0] : null;
    } catch (error) {
      console.error('Error getting user workspace role:', error);
      throw error;
    }
  }

  /**
   * Check if user is a member of workspace
   * @param {number} userId
   * @param {string} workspaceId
   * @returns {Promise<boolean>} True if user is a member
   */
  async isMember(userId, workspaceId) {
    try {
      const [members] = await pool.query(
        'SELECT * FROM user_workspaces WHERE user_id = ? AND workspace_id = ?',
        [userId, workspaceId]
      );
      return members.length > 0;
    } catch (error) {
      console.error('Error checking workspace membership:', error);
      throw error;
    }
  }

  /**
   * Add user as member to workspace
   * @param {number} userId
   * @param {string} workspaceId
   * @param {string} role - 'owner' | 'collaborator' | 'viewer'
   * @returns {Promise<boolean>} Success status
   */
  async addMember(userId, workspaceId, role = 'collaborator') {
    try {
      await pool.query(
        'INSERT INTO user_workspaces (user_id, workspace_id, role) VALUES (?, ?, ?)',
        [userId, workspaceId, role]
      );
      return true;
    } catch (error) {
      console.error('Error adding workspace member:', error);
      throw error;
    }
  }

  /**
   * Remove user from workspace
   * @param {number} userId
   * @param {string} workspaceId
   * @returns {Promise<boolean>} Success status
   */
  async removeMember(userId, workspaceId) {
    try {
      const [result] = await pool.query(
        'DELETE FROM user_workspaces WHERE user_id = ? AND workspace_id = ?',
        [userId, workspaceId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error removing workspace member:', error);
      throw error;
    }
  }

  /**
   * Update last accessed timestamp for user workspace
   * @param {number} userId
   * @param {string} workspaceId
   * @returns {Promise<boolean>} Success status
   */
  async updateLastAccessed(userId, workspaceId) {
    try {
      const [result] = await pool.query(
        'UPDATE user_workspaces SET last_accessed = CURRENT_TIMESTAMP WHERE user_id = ? AND workspace_id = ?',
        [userId, workspaceId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating last accessed:', error);
      throw error;
    }
  }

  /**
   * Get all collaborators for a workspace
   * @param {string} workspaceId
   * @returns {Promise<Array>} Array of collaborators
   */
  async getCollaborators(workspaceId) {
    try {
      const [collaborators] = await pool.query(
        `SELECT u.id, u.username, uw.role, uw.joined_at
         FROM user_workspaces uw
         INNER JOIN users u ON uw.user_id = u.id
         WHERE uw.workspace_id = ?`,
        [workspaceId]
      );
      return collaborators;
    } catch (error) {
      console.error('Error getting workspace collaborators:', error);
      throw error;
    }
  }
}

module.exports = new WorkspaceRepository();
