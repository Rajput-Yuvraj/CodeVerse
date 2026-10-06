const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const {
  createSession,
  deleteSessionByToken,
  deleteUserSessions,
  getUserSessions
} = require('../utils/sessionManager');
const { sendSuccess, sendError, sendCreated, sendNotFound, sendUnauthorized, sendBadRequest } = require('../utils/responseFormatter');

const register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    if (!username || !email || !password) {
      return sendBadRequest(res, 'All fields are required');
    }

    // Check if user already exists
    const existingUser = await userRepository.findByEmailOrUsername(email, username);

    if (existingUser) {
      return sendBadRequest(res, 'User already exists with this email or username');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await userRepository.create({
      username,
      email,
      password: hashedPassword
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Create session
    const { sessionId, expiresAt } = await createSession(user.id, token, req);

    sendCreated(res, {
      token,
      sessionId,
      expiresAt,
      user: {
        id: user.id,
        username,
        email
      }
    }, 'User registered successfully');
  } catch (error) {
    console.error('Registration error:', error);
    sendError(res, 'Server error during registration');
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return sendBadRequest(res, 'Email and password are required');
    }

    // Find user by email
    const user = await userRepository.findByEmail(email);

    if (!user) {
      return sendUnauthorized(res, 'Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return sendUnauthorized(res, 'Invalid credentials');
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Create session
    const { sessionId, expiresAt } = await createSession(user.id, token, req);

    sendSuccess(res, {
      token,
      sessionId,
      expiresAt,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, 'Server error during login');
  }
};

const logout = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      await deleteSessionByToken(token);
    }

    sendSuccess(res, null, 'Logout successful');
  } catch (error) {
    console.error('Logout error:', error);
    sendError(res, 'Server error during logout');
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await userRepository.findById(req.user.id);

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    sendSuccess(res, { user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    sendError(res, 'Server error fetching profile');
  }
};

const getSessions = async (req, res) => {
  try {
    const sessions = await getUserSessions(req.user.id);
    sendSuccess(res, { sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    sendError(res, 'Server error fetching sessions');
  }
};

const logoutAll = async (req, res) => {
  try {
    await deleteUserSessions(req.user.id);
    sendSuccess(res, null, 'Logged out from all devices successfully');
  } catch (error) {
    console.error('Logout all error:', error);
    sendError(res, 'Server error during logout');
  }
};

module.exports = { register, login, logout, getProfile, getSessions, logoutAll };