const express = require('express');
const router = express.Router();
const {
  getFileVersions,
  getVersion,
  restoreVersion,
  addLabel,
  removeLabel,
} = require('../controllers/versionController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// List all versions for a file
router.get('/:workspaceId/files/:fileId/versions', getFileVersions);

// Get a single version's content
router.get('/:workspaceId/files/:fileId/versions/:versionId', getVersion);

// Restore a file to a previous version
router.post('/:workspaceId/files/:fileId/versions/:versionId/restore', restoreVersion);

// Add a label to a version
router.post('/:workspaceId/files/:fileId/versions/:versionId/label', addLabel);

// Remove a label
router.delete('/:workspaceId/files/:fileId/versions/labels/:labelId', removeLabel);

module.exports = router;
