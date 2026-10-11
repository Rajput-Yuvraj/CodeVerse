const { body, param } = require('express-validator');

/**
 * Validation rules for workspace and file IDs
 */
const fileIdsValidator = [
  param('workspaceId')
    .notEmpty().withMessage('Workspace ID is required')
    .isUUID().withMessage('Workspace ID must be a valid UUID'),

  param('fileId')
    .notEmpty().withMessage('File ID is required')
    .isInt({ min: 1 }).withMessage('File ID must be a positive integer')
    .toInt()
];

/**
 * Validation rules for creating a file or folder
 */
const createFileValidator = [
  param('workspaceId')
    .notEmpty().withMessage('Workspace ID is required')
    .isUUID().withMessage('Workspace ID must be a valid UUID'),

  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 1, max: 255 }).withMessage('Name must be between 1 and 255 characters')
    .matches(/^[^/\\:*?"<>|]+$/).withMessage('Name contains invalid characters'),

  body('type')
    .notEmpty().withMessage('Type is required')
    .isIn(['file', 'folder']).withMessage('Type must be either "file" or "folder"'),

  body('content')
    .optional()
    .isString().withMessage('Content must be a string'),

  body('language')
    .optional()
    .isLength({ max: 50 }).withMessage('Language must not exceed 50 characters'),

  body('parentId')
    .optional()
    .isInt({ min: 1 }).withMessage('Parent ID must be a positive integer')
    .toInt()
];

/**
 * Validation rules for updating a file
 */
const updateFileValidator = [
  ...fileIdsValidator,

  body('content')
    .optional()
    .isString().withMessage('Content must be a string'),

  body('language')
    .optional()
    .isLength({ max: 50 }).withMessage('Language must not exceed 50 characters')
];

/**
 * Validation rules for renaming a file or folder
 */
const renameFileValidator = [
  ...fileIdsValidator,

  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 1, max: 255 }).withMessage('Name must be between 1 and 255 characters')
    .matches(/^[^/\\:*?"<>|]+$/).withMessage('Name contains invalid characters')
];

module.exports = {
  fileIdsValidator,
  createFileValidator,
  updateFileValidator,
  renameFileValidator
};
