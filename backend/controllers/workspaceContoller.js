const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const createWorkspace = async (req, res) => {
  const { name, description, language } = req.body;
  const userId = req.user.id;

  try {
    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const workspaceId = uuidv4();

    await pool.query(
      'INSERT INTO workspaces (id, name, description, owner_id, language) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, name, description || '', userId, language || 'javascript']
    );

    await pool.query(
      'INSERT INTO user_workspaces (user_id, workspace_id, role) VALUES (?, ?, ?)',
      [userId, workspaceId, 'owner']
    );

    res.status(201).json({
      message: 'Workspace created successfully',
      workspace: {
        id: workspaceId,
        name,
        description,
        language: language || 'javascript',
        owner_id: userId
      }
    });
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Server error during workspace creation' });
  }
};

const getUserWorkspaces = async (req, res) => {
  const userId = req.user.id;

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

    res.json({
      workspaces: workspaces.map(w => ({
        id: w.id,
        name: w.name,
        description: w.description,
        language: w.language,
        owner_id: w.owner_id,
        owner_name: w.owner_name,
        role: w.role,
        joined_at: w.joined_at,
        last_accessed: w.last_accessed,
        created_at: w.created_at
      }))
    });
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ error: 'Server error fetching workspaces' });
  }
};

const getWorkspace = async (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  try {
    const [access] = await pool.query(
      'SELECT role FROM user_workspaces WHERE user_id = ? AND workspace_id = ?',
      [userId, workspaceId]
    );

    if (access.length === 0) {
      return res.status(403).json({ error: 'Access denied to this workspace' });
    }

    const [workspaces] = await pool.query(
      `SELECT w.*, u.username as owner_name
       FROM workspaces w
       INNER JOIN users u ON w.owner_id = u.id
       WHERE w.id = ? AND w.is_active = true`,
      [workspaceId]
    );

    if (workspaces.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    await pool.query(
      'UPDATE user_workspaces SET last_accessed = CURRENT_TIMESTAMP WHERE user_id = ? AND workspace_id = ?',
      [userId, workspaceId]
    );

    const [collaborators] = await pool.query(
      `SELECT u.id, u.username, uw.role, uw.joined_at
       FROM user_workspaces uw
       INNER JOIN users u ON uw.user_id = u.id
       WHERE uw.workspace_id = ?`,
      [workspaceId]
    );

    const workspace = workspaces[0];
    res.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        code: workspace.code,
        language: workspace.language,
        owner_id: workspace.owner_id,
        owner_name: workspace.owner_name,
        created_at: workspace.created_at,
        updated_at: workspace.updated_at,
        userRole: access[0].role,
        collaborators
      }
    });
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Server error fetching workspace' });
  }
};

const joinWorkspace = async (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  try {
    const [workspaces] = await pool.query(
      'SELECT * FROM workspaces WHERE id = ? AND is_active = true',
      [workspaceId]
    );

    if (workspaces.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const [existing] = await pool.query(
      'SELECT * FROM user_workspaces WHERE user_id = ? AND workspace_id = ?',
      [userId, workspaceId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Already joined this workspace' });
    }

    await pool.query(
      'INSERT INTO user_workspaces (user_id, workspace_id, role) VALUES (?, ?, ?)',
      [userId, workspaceId, 'collaborator']
    );

    res.json({
      message: 'Successfully joined workspace',
      workspaceId
    });
  } catch (error) {
    console.error('Join workspace error:', error);
    res.status(500).json({ error: 'Server error joining workspace' });
  }
};

const leaveWorkspace = async (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  try {
    const [workspaces] = await pool.query(
      'SELECT owner_id FROM workspaces WHERE id = ?',
      [workspaceId]
    );

    if (workspaces.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    if (workspaces[0].owner_id === userId) {
      return res.status(400).json({ error: 'Owner cannot leave workspace. Delete it instead.' });
    }

    const [result] = await pool.query(
      'DELETE FROM user_workspaces WHERE user_id = ? AND workspace_id = ?',
      [userId, workspaceId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Not a member of this workspace' });
    }

    res.json({ message: 'Successfully left workspace' });
  } catch (error) {
    console.error('Leave workspace error:', error);
    res.status(500).json({ error: 'Server error leaving workspace' });
  }
};

const updateWorkspaceCode = async (req, res) => {
  const { workspaceId } = req.params;
  const { code } = req.body;
  const userId = req.user.id;

  try {
    const [access] = await pool.query(
      'SELECT role FROM user_workspaces WHERE user_id = ? AND workspace_id = ?',
      [userId, workspaceId]
    );

    if (access.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (access[0].role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot edit code' });
    }

    await pool.query(
      'UPDATE workspaces SET code = ? WHERE id = ?',
      [code, workspaceId]
    );

    res.json({ message: 'Code updated successfully' });
  } catch (error) {
    console.error('Update code error:', error);
    res.status(500).json({ error: 'Server error updating code' });
  }
};

const deleteWorkspace = async (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  try {
    const [workspaces] = await pool.query(
      'SELECT owner_id FROM workspaces WHERE id = ?',
      [workspaceId]
    );

    if (workspaces.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    if (workspaces[0].owner_id !== userId) {
      return res.status(403).json({ error: 'Only owner can delete workspace' });
    }

    await pool.query(
      'UPDATE workspaces SET is_active = false WHERE id = ?',
      [workspaceId]
    );

    res.json({ message: 'Workspace deleted successfully' });
  } catch (error) {
    console.error('Delete workspace error:', error);
    res.status(500).json({ error: 'Server error deleting workspace' });
  }
};

module.exports = {
  createWorkspace,
  getUserWorkspaces,
  getWorkspace,
  joinWorkspace,
  leaveWorkspace,
  updateWorkspaceCode,
  deleteWorkspace
};