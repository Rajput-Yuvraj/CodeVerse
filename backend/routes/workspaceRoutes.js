const express = require('express');
const router = express.Router();
const {
  createWorkspace,
  getUserWorkspaces,
  getWorkspace,
  joinWorkspace,
  leaveWorkspace,
  updateWorkspaceCode,
  deleteWorkspace
} = require('../controllers/workspaceController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', createWorkspace);
router.get('/', getUserWorkspaces);
router.get('/:workspaceId', getWorkspace);
router.post('/:workspaceId/join', joinWorkspace);
router.post('/:workspaceId/leave', leaveWorkspace);
router.patch('/:workspaceId/code', updateWorkspaceCode);
router.delete('/:workspaceId', deleteWorkspace);

module.exports = router;
