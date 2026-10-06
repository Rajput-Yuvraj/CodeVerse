const fileRepository = require('../repositories/fileRepository');
const versionRepository = require('../repositories/versionRepository');
const { checkWorkspaceAccess } = require('../utils/accessControl');
const { sendSuccess, sendError, sendCreated, sendNotFound, sendForbidden, sendBadRequest } = require('../utils/responseFormatter');

const getSaveActivity = async (req, res) => {
  const userId = Number(req.user.id);
  const days = Math.min(Math.max(Number(req.query.days) || 140, 1), 365);

  if (!Number.isFinite(userId)) {
    return sendBadRequest(res, 'Invalid user context for save activity');
  }

  try {
    const rows = await fileRepository.getSaveActivity(userId, days);

    const counts = rows.reduce((acc, row) => {
      acc[row.save_date] = Number(row.save_count);
      return acc;
    }, {});

    sendSuccess(res, { counts, days });
  } catch (error) {
    console.error('Get save activity error:', error);
    sendError(res, 'Server error fetching save activity');
  }
};

// Get all files and folders for a workspace
const getWorkspaceFiles = async (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  try {
    // Check workspace access
    const access = await checkWorkspaceAccess(userId, workspaceId);
    if (!access.hasAccess) {
      return sendForbidden(res, 'Access denied to this workspace');
    }

    // Get all files and folders
    const files = await fileRepository.findByWorkspace(workspaceId);

    sendSuccess(res, { files });
  } catch (error) {
    console.error('Get workspace files error:', error);
    sendError(res, 'Server error fetching files');
  }
};

// Get a specific file
const getFile = async (req, res) => {
  const { workspaceId, fileId } = req.params;
  const userId = req.user.id;

  try {
    // Check workspace access
    const access = await checkWorkspaceAccess(userId, workspaceId);
    if (!access.hasAccess) {
      return sendForbidden(res, 'Access denied to this workspace');
    }

    // Get the file
    const file = await fileRepository.findById(fileId, workspaceId);

    if (!file) {
      return sendNotFound(res, 'File not found');
    }

    sendSuccess(res, { file });
  } catch (error) {
    console.error('Get file error:', error);
    sendError(res, 'Server error fetching file');
  }
};

// Create a new file or folder
const createFileOrFolder = async (req, res) => {
  const { workspaceId } = req.params;
  const { name, type, parentId, content, language } = req.body;
  const userId = req.user.id;

  try {
    // Check workspace access and edit permission
    const access = await checkWorkspaceAccess(userId, workspaceId, 'collaborator');
    if (!access.hasAccess) {
      return sendForbidden(res, access.role === 'viewer'
        ? 'You do not have permission to create files'
        : 'Access denied to this workspace');
    }

    // Validate required fields
    if (!name || !type || (type !== 'file' && type !== 'folder')) {
      return sendBadRequest(res, 'Invalid request. Name and type are required');
    }

    // Build the path
    let path = name;
    if (parentId) {
      const parentPath = await fileRepository.getParentPath(parentId, workspaceId);

      if (!parentPath) {
        return sendNotFound(res, 'Parent folder not found');
      }

      path = `${parentPath}/${name}`;
    }

    // Create the file or folder
    const file = await fileRepository.create({
      workspaceId,
      name,
      type,
      content,
      language,
      parentId,
      path
    });

    sendCreated(res, {
      file
    }, `${type === 'file' ? 'File' : 'Folder'} created successfully`);
  } catch (error) {
    console.error('Create file/folder error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return sendBadRequest(res, 'A file or folder with this name already exists in this location');
    }
    sendError(res, 'Server error creating file/folder');
  }
};

// Update a file's content
const updateFile = async (req, res) => {
  const { workspaceId, fileId } = req.params;
  const { content, language } = req.body;
  const userId = req.user.id;

  try {
    // Check workspace access and edit permission
    const access = await checkWorkspaceAccess(userId, workspaceId, 'collaborator');
    if (!access.hasAccess) {
      return sendForbidden(res, access.role === 'viewer'
        ? 'You do not have permission to edit files'
        : 'Access denied to this workspace');
    }

    // Update the file
    const updated = await fileRepository.update(fileId, workspaceId, content, language);

    if (!updated) {
      return sendNotFound(res, 'File not found');
    }

    // Track save event (non-blocking)
    await fileRepository.addSaveEvent(workspaceId, fileId, userId);

    // Auto-create version snapshot (non-blocking)
    versionRepository.createVersion(fileId, workspaceId, content, language, userId)
      .catch(err => console.error('Auto-version creation failed:', err));

    sendSuccess(res, null, 'File updated successfully');
  } catch (error) {
    console.error('Update file error:', error);
    sendError(res, 'Server error updating file');
  }
};

// Rename a file or folder
const renameFileOrFolder = async (req, res) => {
  const { workspaceId, fileId } = req.params;
  const { name } = req.body;
  const userId = req.user.id;

  try {
    // Check workspace access and edit permission
    const access = await checkWorkspaceAccess(userId, workspaceId, 'collaborator');
    if (!access.hasAccess) {
      return sendForbidden(res, access.role === 'viewer'
        ? 'You do not have permission to rename files'
        : 'Access denied to this workspace');
    }

    if (!name) {
      return sendBadRequest(res, 'Name is required');
    }

    // Get current file info
    const file = await fileRepository.findById(fileId, workspaceId);

    if (!file) {
      return sendNotFound(res, 'File or folder not found');
    }

    const oldPath = file.path;

    // Build new path
    let newPath = name;
    if (file.parent_id) {
      const parentPath = await fileRepository.getParentPath(file.parent_id, workspaceId);
      newPath = `${parentPath}/${name}`;
    }

    // Update the file/folder name and path
    await fileRepository.rename(fileId, name, newPath);

    // If it's a folder, update all children paths
    if (file.type === 'folder') {
      const children = await fileRepository.getChildren(oldPath, workspaceId);

      for (const child of children) {
        const updatedPath = child.path.replace(oldPath, newPath);
        await fileRepository.updatePath(child.id, updatedPath);
      }
    }

    sendSuccess(res, null, 'Renamed successfully');
  } catch (error) {
    console.error('Rename file/folder error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return sendBadRequest(res, 'A file or folder with this name already exists in this location');
    }
    sendError(res, 'Server error renaming file/folder');
  }
};

// Delete a file or folder
const deleteFileOrFolder = async (req, res) => {
  const { workspaceId, fileId } = req.params;
  const userId = req.user.id;

  try {
    // Check workspace access and edit permission
    const access = await checkWorkspaceAccess(userId, workspaceId, 'collaborator');
    if (!access.hasAccess) {
      return sendForbidden(res, access.role === 'viewer'
        ? 'You do not have permission to delete files'
        : 'Access denied to this workspace');
    }

    // Delete the file/folder (CASCADE will handle children)
    const deleted = await fileRepository.delete(fileId, workspaceId);

    if (!deleted) {
      return sendNotFound(res, 'File or folder not found');
    }

    sendSuccess(res, null, 'Deleted successfully');
  } catch (error) {
    console.error('Delete file/folder error:', error);
    sendError(res, 'Server error deleting file/folder');
  }
};

const getLanguageStats = async (req, res) => {
  const userId = Number(req.user.id);

  if (!Number.isFinite(userId)) {
    return sendBadRequest(res, 'Invalid user context');
  }

  try {
    const rows = await fileRepository.getLanguageStats(userId);

    // Calculate percentages
    const totalFiles = rows.reduce((sum, r) => sum + Number(r.file_count), 0);
    const stats = rows.map((r) => ({
      name: r.language,
      fileCount: Number(r.file_count),
      percentage: totalFiles > 0 ? Math.round((Number(r.file_count) / totalFiles) * 100) : 0,
    }));

    sendSuccess(res, { stats, totalFiles });
  } catch (error) {
    console.error('Get language stats error:', error);
    sendError(res, 'Server error fetching language stats');
  }
};

const getSystemStatus = async (req, res) => {
  try {
    const status = await fileRepository.getSystemStatus();
    sendSuccess(res, { status });
  } catch (error) {
    console.error('Get system status error:', error);
    sendError(res, 'Server error fetching system status');
  }
};

module.exports = {
  getSaveActivity,
  getWorkspaceFiles,
  getFile,
  createFileOrFolder,
  updateFile,
  renameFileOrFolder,
  deleteFileOrFolder,
  getLanguageStats,
  getSystemStatus
};
