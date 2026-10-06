const versionRepository = require('../repositories/versionRepository');
const fileRepository = require('../repositories/fileRepository');
const { checkWorkspaceAccess } = require('../utils/accessControl');
const { sendSuccess, sendError, sendCreated, sendNotFound, sendForbidden, sendBadRequest } = require('../utils/responseFormatter');

/**
 * GET /:workspaceId/files/:fileId/versions
 * List all versions for a file.
 */
const getFileVersions = async (req, res) => {
  const { workspaceId, fileId } = req.params;
  const userId = req.user.id;

  try {
    const access = await checkWorkspaceAccess(userId, workspaceId);
    if (!access.hasAccess) {
      return sendForbidden(res, 'Access denied to this workspace');
    }

    // Verify file belongs to workspace
    const file = await fileRepository.findById(fileId, workspaceId);
    if (!file) {
      return sendNotFound(res, 'File not found');
    }

    const versions = await versionRepository.getVersionsByFile(fileId, workspaceId);
    sendSuccess(res, { versions, fileName: file.name });
  } catch (error) {
    console.error('Get file versions error:', error);
    sendError(res, 'Server error fetching version history');
  }
};

/**
 * GET /:workspaceId/files/:fileId/versions/:versionId
 * Get a single version's content (for preview / diff).
 */
const getVersion = async (req, res) => {
  const { workspaceId, fileId, versionId } = req.params;
  const userId = req.user.id;

  try {
    const access = await checkWorkspaceAccess(userId, workspaceId);
    if (!access.hasAccess) {
      return sendForbidden(res, 'Access denied to this workspace');
    }

    const version = await versionRepository.getVersionById(versionId);
    if (!version || String(version.file_id) !== String(fileId)) {
      return sendNotFound(res, 'Version not found');
    }

    sendSuccess(res, { version });
  } catch (error) {
    console.error('Get version error:', error);
    sendError(res, 'Server error fetching version');
  }
};

/**
 * POST /:workspaceId/files/:fileId/versions/:versionId/restore
 * Restore a file to a previous version.
 */
const restoreVersion = async (req, res) => {
  const { workspaceId, fileId, versionId } = req.params;
  const userId = req.user.id;

  try {
    const access = await checkWorkspaceAccess(userId, workspaceId, 'collaborator');
    if (!access.hasAccess) {
      return sendForbidden(res, access.role === 'viewer'
        ? 'You do not have permission to restore versions'
        : 'Access denied to this workspace');
    }

    const version = await versionRepository.getVersionById(versionId);
    if (!version || String(version.file_id) !== String(fileId)) {
      return sendNotFound(res, 'Version not found');
    }

    // Update the file content to the version's content
    const updated = await fileRepository.update(fileId, workspaceId, version.content, version.language);
    if (!updated) {
      return sendNotFound(res, 'File not found');
    }

    // Create a new version snapshot for the restore action
    const newVersion = await versionRepository.createVersion(
      fileId, workspaceId, version.content, version.language, userId
    );

    // Track save event
    await fileRepository.addSaveEvent(workspaceId, fileId, userId);

    sendSuccess(res, {
      restoredFromVersion: version.version_number,
      newVersionNumber: newVersion.version_number
    }, `Restored to version ${version.version_number}`);
  } catch (error) {
    console.error('Restore version error:', error);
    sendError(res, 'Server error restoring version');
  }
};

/**
 * POST /:workspaceId/files/:fileId/versions/:versionId/label
 * Add a named label to a version.
 */
const addLabel = async (req, res) => {
  const { workspaceId, fileId, versionId } = req.params;
  const { label } = req.body;
  const userId = req.user.id;

  try {
    const access = await checkWorkspaceAccess(userId, workspaceId, 'collaborator');
    if (!access.hasAccess) {
      return sendForbidden(res, 'Access denied to this workspace');
    }

    if (!label || !label.trim()) {
      return sendBadRequest(res, 'Label is required');
    }

    const version = await versionRepository.getVersionById(versionId);
    if (!version || String(version.file_id) !== String(fileId)) {
      return sendNotFound(res, 'Version not found');
    }

    const created = await versionRepository.addLabel(versionId, label.trim(), userId);
    sendCreated(res, { label: created }, 'Label added successfully');
  } catch (error) {
    console.error('Add label error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return sendBadRequest(res, 'This label already exists on this version');
    }
    sendError(res, 'Server error adding label');
  }
};

/**
 * DELETE /:workspaceId/files/:fileId/versions/labels/:labelId
 * Remove a label.
 */
const removeLabel = async (req, res) => {
  const { workspaceId, labelId } = req.params;
  const userId = req.user.id;

  try {
    const access = await checkWorkspaceAccess(userId, workspaceId, 'collaborator');
    if (!access.hasAccess) {
      return sendForbidden(res, 'Access denied to this workspace');
    }

    const removed = await versionRepository.removeLabel(labelId);
    if (!removed) {
      return sendNotFound(res, 'Label not found');
    }

    sendSuccess(res, null, 'Label removed successfully');
  } catch (error) {
    console.error('Remove label error:', error);
    sendError(res, 'Server error removing label');
  }
};

module.exports = {
  getFileVersions,
  getVersion,
  restoreVersion,
  addLabel,
  removeLabel,
};
