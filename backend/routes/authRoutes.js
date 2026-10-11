const express = require('express');
const router = express.Router();
const { register, login, logout, getProfile, getSessions, logoutAll } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);

router.post('/logout', authMiddleware, logout);
router.post('/logout-all', authMiddleware, logoutAll);
router.get('/profile', authMiddleware, getProfile);
router.get('/sessions', authMiddleware, getSessions);

module.exports = router;
