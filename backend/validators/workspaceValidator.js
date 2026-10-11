const { body, param } = require('express-validator');

/**
 * Validation rules for creating a workspace
 */
const createWorkspaceValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Workspace name is required')
    .isLength({ min: 1, max: 100 }).withMessage('Workspace name must be between 1 and 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),

  body('language')
    .optional()
    .isIn(['javascript', 'python', 'java', 'cpp', 'c', 'go', 'rust', 'typescript', 'ruby', 'php'])
    .withMessage('Invalid programming language')
];

/**
 * Validation rules for workspace ID parameter
 */
const workspaceIdValidator = [
  param('workspaceId')
    .notEmpty().withMessage('Workspace ID is required')
    .isUUID().withMessage('Workspace ID must be a valid UUID')
];

/**
 * Validation rules for updating workspace code
 */
const updateWorkspaceCodeValidator = [
  ...workspaceIdValidator,
  body('code')
    .optional()
    .isString().withMessage('Code must be a string')
];

module.exports = {
  createWorkspaceValidator,
  workspaceIdValidator,
  updateWorkspaceCodeValidator
};
