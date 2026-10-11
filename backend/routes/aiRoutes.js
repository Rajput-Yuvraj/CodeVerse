const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Send message to AI and get response
router.post('/chat', authMiddleware, aiController.sendMessage);

// Get chat history for a workspace
router.get('/chat/:workspaceId', authMiddleware, aiController.getChatHistory);

// Clear chat history for a workspace
router.delete('/chat/:workspaceId', authMiddleware, aiController.clearChatHistory);

module.exports = router;
