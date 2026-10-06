const { GoogleGenerativeAI } = require('@google/generative-ai');
const chatRepository = require('../repositories/chatRepository');
const workspaceRepository = require('../repositories/workspaceRepository');
const { sendSuccess, sendError, sendNotFound, sendForbidden, sendBadRequest } = require('../utils/responseFormatter');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.sendMessage = async (req, res) => {
  try {
    const { workspaceId, message } = req.body;
    const userId = req.user.id;

    if (!message || !workspaceId) {
      return sendBadRequest(res, 'Message and workspace ID are required');
    }

    // Get previous chat history for context
    const chatHistory = await chatRepository.getAIChatHistory(workspaceId, 10);

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Build conversation prompt with history
    let prompt = '';
    if (chatHistory.length > 0) {
      prompt = 'Previous conversation:\n';
      chatHistory.reverse().forEach(chat => {
        prompt += `User: ${chat.message}\n`;
        if (chat.response) {
          prompt += `Assistant: ${chat.response}\n`;
        }
      });
      prompt += `\nUser: ${message}\nAssistant:`;
    } else {
      prompt = message;
    }

    // Get AI response
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    // Save user message to database
    await chatRepository.createAIUserMessage({
      workspaceId,
      userId,
      message
    });

    // Save AI response to database
    await chatRepository.createAIAssistantMessage({
      workspaceId,
      userId,
      message,
      response: aiResponse
    });

    sendSuccess(res, { response: aiResponse }, 'Message sent successfully');

  } catch (error) {
    console.error('Error in AI chat:', error.response?.data || error.message);
    sendError(res, 'Failed to get AI response');
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    // Verify user has access to workspace
    const access = await workspaceRepository.getUserWorkspaceRole(userId, workspaceId);

    if (!access) {
      return sendForbidden(res, 'You do not have access to this workspace');
    }

    // Get chat history
    const chatHistory = await chatRepository.getAIChatHistoryWithUser(workspaceId);

    sendSuccess(res, { chatHistory });

  } catch (error) {
    console.error('Error fetching chat history:', error);
    sendError(res, 'Failed to fetch chat history');
  }
};

exports.clearChatHistory = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    // Verify workspace exists
    const workspace = await workspaceRepository.findById(workspaceId, false);

    if (!workspace) {
      return sendNotFound(res, 'Workspace not found');
    }

    // Delete chat history
    await chatRepository.clearAIChatHistory(workspaceId);

    sendSuccess(res, null, 'Chat history cleared successfully');

  } catch (error) {
    console.error('Error clearing chat history:', error);
    sendError(res, 'Failed to clear chat history');
  }
};
