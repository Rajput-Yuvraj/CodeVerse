const workspaceRepository = require('../repositories/workspaceRepository');

/**
 * Role hierarchy for permission checking
 */
const ROLE_HIERARCHY = {
  owner: 3,
  collaborator: 2,
  viewer: 1
};

/**
 * Check if user has access to a workspace
 * @param {number} userId
 * @param {string} workspaceId
 * @param {string|null} requiredRole - Minimum role required (null = any role)
 * @returns {Promise<Object>} { hasAccess: boolean, role: string|null }
 */
async function checkWorkspaceAccess(userId, workspaceId, requiredRole = null) {
  try {
    const accessData = await workspaceRepository.getUserWorkspaceRole(userId, workspaceId);

    if (!accessData) {
      return { hasAccess: false, role: null };
    }

    const userRole = accessData.role;

    // If no specific role is required, just check membership
    if (!requiredRole) {
      return { hasAccess: true, role: userRole };
    }

    // Check if user's role meets the minimum required role
    const userRoleLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole] || 0;

    return {
      hasAccess: userRoleLevel >= requiredRoleLevel,
      role: userRole
    };
  } catch (error) {
    console.error('Error checking workspace access:', error);
    throw error;
  }
}

/**
 * Check if user is the owner of a workspace
 * @param {number} userId
 * @param {string} workspaceId
 * @returns {Promise<boolean>} True if user is owner
 */
async function isWorkspaceOwner(userId, workspaceId) {
  try {
    const workspace = await workspaceRepository.findById(workspaceId, false);
    return workspace && workspace.owner_id === userId;
  } catch (error) {
    console.error('Error checking workspace ownership:', error);
    throw error;
  }
}

/**
 * Check if user has edit permission (owner or collaborator)
 * @param {number} userId
 * @param {string} workspaceId
 * @returns {Promise<boolean>} True if user can edit
 */
async function canEditWorkspace(userId, workspaceId) {
  try {
    const access = await checkWorkspaceAccess(userId, workspaceId, 'collaborator');
    return access.hasAccess;
  } catch (error) {
    console.error('Error checking edit permission:', error);
    throw error;
  }
}

/**
 * Check if user has view permission (any role)
 * @param {number} userId
 * @param {string} workspaceId
 * @returns {Promise<boolean>} True if user can view
 */
async function canViewWorkspace(userId, workspaceId) {
  try {
    const access = await checkWorkspaceAccess(userId, workspaceId);
    return access.hasAccess;
  } catch (error) {
    console.error('Error checking view permission:', error);
    throw error;
  }
}

module.exports = {
  checkWorkspaceAccess,
  isWorkspaceOwner,
  canEditWorkspace,
  canViewWorkspace,
  ROLE_HIERARCHY
};
