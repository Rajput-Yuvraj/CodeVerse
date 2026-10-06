const workspaceRepository = require('../repositories/workspaceRepository');
const { checkWorkspaceAccess, isWorkspaceOwner } = require('../utils/accessControl');
const { sendSuccess, sendError, sendCreated, sendNotFound, sendForbidden, sendBadRequest } = require('../utils/responseFormatter');

const createWorkspace = async (req, res) => {
  const { name, description, language } = req.body;
  const userId = req.user.id;

  try {
    if (!name) {
      return sendBadRequest(res, 'Workspace name is required');
    }

    // Create workspace
    const workspace = await workspaceRepository.create({
      name,
      description,
      ownerId: userId,
      language: language || 'javascript'
    });

    // Add owner as member
    await workspaceRepository.addMember(userId, workspace.id, 'owner');

    sendCreated(res, { workspace }, 'Workspace created successfully');
  } catch (error) {
    console.error('Create workspace error:', error);
    sendError(res, 'Server error during workspace creation');
  }
};

const getUserWorkspaces = async (req, res) => {
  const userId = req.user.id;

  try {
    const workspaces = await workspaceRepository.findByUser(userId);

    const formattedWorkspaces = workspaces.map(w => ({
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
    }));

    sendSuccess(res, { workspaces: formattedWorkspaces });
  } catch (error) {
    console.error('Get workspaces error:', error);
    sendError(res, 'Server error fetching workspaces');
  }
};

const getWorkspace = async (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  try {
    // Check workspace access
    const access = await checkWorkspaceAccess(userId, workspaceId);
    if (!access.hasAccess) {
      return sendForbidden(res, 'Access denied to this workspace');
    }

    // Get workspace with owner info
    const workspace = await workspaceRepository.findByIdWithOwner(workspaceId);

    if (!workspace) {
      return sendNotFound(res, 'Workspace not found');
    }

    // Update last accessed
    await workspaceRepository.updateLastAccessed(userId, workspaceId);

    // Get collaborators
    const collaborators = await workspaceRepository.getCollaborators(workspaceId);

    sendSuccess(res, {
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
        userRole: access.role,
        collaborators
      }
    });
  } catch (error) {
    console.error('Get workspace error:', error);
    sendError(res, 'Server error fetching workspace');
  }
};

const joinWorkspace = async (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  try {
    // Check if workspace exists
    const workspace = await workspaceRepository.findById(workspaceId);

    if (!workspace) {
      return sendNotFound(res, 'Workspace not found');
    }

    // Check if already a member
    const isMember = await workspaceRepository.isMember(userId, workspaceId);

    if (isMember) {
      return sendBadRequest(res, 'Already joined this workspace');
    }

    // Add as collaborator
    await workspaceRepository.addMember(userId, workspaceId, 'collaborator');

    sendSuccess(res, { workspaceId }, 'Successfully joined workspace');
  } catch (error) {
    console.error('Join workspace error:', error);
    sendError(res, 'Server error joining workspace');
  }
};

const leaveWorkspace = async (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  try {
    // Check if workspace exists and get owner
    const workspace = await workspaceRepository.findById(workspaceId, false);

    if (!workspace) {
      return sendNotFound(res, 'Workspace not found');
    }

    // Check if user is owner
    if (workspace.owner_id === userId) {
      return sendBadRequest(res, 'Owner cannot leave workspace. Delete it instead.');
    }

    // Remove member
    const removed = await workspaceRepository.removeMember(userId, workspaceId);

    if (!removed) {
      return sendNotFound(res, 'Not a member of this workspace');
    }

    sendSuccess(res, null, 'Successfully left workspace');
  } catch (error) {
    console.error('Leave workspace error:', error);
    sendError(res, 'Server error leaving workspace');
  }
};

const updateWorkspaceCode = async (req, res) => {
  const { workspaceId } = req.params;
  const { code } = req.body;
  const userId = req.user.id;

  try {
    // Check workspace access and edit permission
    const access = await checkWorkspaceAccess(userId, workspaceId, 'collaborator');
    if (!access.hasAccess) {
      return sendForbidden(res, access.role === 'viewer'
        ? 'Viewers cannot edit code'
        : 'Access denied');
    }

    // Update code
    await workspaceRepository.updateCode(workspaceId, code);

    sendSuccess(res, null, 'Code updated successfully');
  } catch (error) {
    console.error('Update code error:', error);
    sendError(res, 'Server error updating code');
  }
};

const deleteWorkspace = async (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  try {
    // Check if user is owner
    const isOwner = await isWorkspaceOwner(userId, workspaceId);

    if (!isOwner) {
      const workspace = await workspaceRepository.findById(workspaceId, false);
      if (!workspace) {
        return sendNotFound(res, 'Workspace not found');
      }
      return sendForbidden(res, 'Only owner can delete workspace');
    }

    // Delete workspace (CASCADE will handle related data)
    await workspaceRepository.delete(workspaceId);

    sendSuccess(res, null, 'Workspace deleted successfully');
  } catch (error) {
    console.error('Delete workspace error:', error);
    sendError(res, 'Server error deleting workspace');
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
