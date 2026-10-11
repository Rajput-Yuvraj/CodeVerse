const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const mockUserRepository = {
  findByEmailOrUsername: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};
jest.mock('../../repositories/userRepository', () => mockUserRepository);

const mockSessionManager = {
  createSession: jest.fn(),
  deleteSessionByToken: jest.fn(),
  deleteUserSessions: jest.fn(),
  getUserSessions: jest.fn(),
};
jest.mock('../../utils/sessionManager', () => mockSessionManager);

const mockResponseFormatter = {
  sendSuccess: jest.fn(),
  sendError: jest.fn(),
  sendCreated: jest.fn(),
  sendNotFound: jest.fn(),
  sendUnauthorized: jest.fn(),
  sendBadRequest: jest.fn(),
};
jest.mock('../../utils/responseFormatter', () => mockResponseFormatter);

process.env.JWT_SECRET = 'test-secret-key-for-white-box-testing';

const { register, login, logout, getProfile, getSessions, logoutAll } = require('../../controllers/authController');

const mockReq = (body = {}, headers = {}, user = null) => ({
  body,
  header: jest.fn((name) => headers[name]),
  user,
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' },
  get: jest.fn((name) => headers[name.toLowerCase()] || ''),
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('register() — White Box Tests', () => {

  describe('Path P1 — Missing required fields', () => {

    test('TC R-01: Empty username → sendBadRequest', async () => {
      const req = mockReq({ username: '', email: 'a@b.com', password: '123456' });
      const res = mockRes();

      await register(req, res);

      expect(mockResponseFormatter.sendBadRequest).toHaveBeenCalledWith(
        res, 'All fields are required'
      );
      expect(mockUserRepository.findByEmailOrUsername).not.toHaveBeenCalled();
    });

    test('TC R-02: Missing password field → sendBadRequest', async () => {
      const req = mockReq({ username: 'testuser', email: 'a@b.com' });
      const res = mockRes();

      await register(req, res);

      expect(mockResponseFormatter.sendBadRequest).toHaveBeenCalledWith(
        res, 'All fields are required'
      );
    });

    test('TC R-02b: All fields missing → sendBadRequest', async () => {
      const req = mockReq({});
      const res = mockRes();

      await register(req, res);

      expect(mockResponseFormatter.sendBadRequest).toHaveBeenCalledWith(
        res, 'All fields are required'
      );
    });
  });

  describe('Path P2 — User already exists', () => {

    test('TC R-03: Duplicate email/username → sendBadRequest', async () => {
      const req = mockReq({
        username: 'existingUser',
        email: 'exists@test.com',
        password: '123456',
      });
      const res = mockRes();

      mockUserRepository.findByEmailOrUsername.mockResolvedValue({
        id: 1, username: 'existingUser', email: 'exists@test.com',
      });

      await register(req, res);

      expect(mockUserRepository.findByEmailOrUsername).toHaveBeenCalledWith(
        'exists@test.com', 'existingUser'
      );
      expect(mockResponseFormatter.sendBadRequest).toHaveBeenCalledWith(
        res, 'User already exists with this email or username'
      );
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('Path P3 — Successful registration', () => {

    test('TC R-04: Valid new user → sendCreated with token & user', async () => {
      const req = mockReq({
        username: 'newuser',
        email: 'new@test.com',
        password: 'secure123',
      });
      const res = mockRes();

      mockUserRepository.findByEmailOrUsername.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        id: 42, username: 'newuser', email: 'new@test.com',
      });
      mockSessionManager.createSession.mockResolvedValue({
        sessionId: 'sess-abc', expiresAt: new Date('2026-04-08'),
      });

      await register(req, res);

      expect(mockUserRepository.findByEmailOrUsername).toHaveBeenCalledWith(
        'new@test.com', 'newuser'
      );
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'newuser',
          email: 'new@test.com',
          password: expect.any(String),
        })
      );
      const createdUser = mockUserRepository.create.mock.calls[0][0];
      expect(createdUser.password).not.toBe('secure123');
      expect(createdUser.password.length).toBeGreaterThan(20);

      expect(mockSessionManager.createSession).toHaveBeenCalled();

      expect(mockResponseFormatter.sendCreated).toHaveBeenCalledWith(
        res,
        expect.objectContaining({
          token: expect.any(String),
          sessionId: 'sess-abc',
          user: expect.objectContaining({
            id: 42,
            username: 'newuser',
            email: 'new@test.com',
          }),
        }),
        'User registered successfully'
      );
    });
  });

  describe('Path P4 — Server error (exception)', () => {

    test('TC R-05: DB connection failure → sendError', async () => {
      const req = mockReq({
        username: 'newuser',
        email: 'new@test.com',
        password: 'secure123',
      });
      const res = mockRes();

      mockUserRepository.findByEmailOrUsername.mockRejectedValue(
        new Error('ECONNREFUSED')
      );

      await register(req, res);

      expect(mockResponseFormatter.sendError).toHaveBeenCalledWith(
        res, 'Server error during registration'
      );
    });
  });
});


describe('login() — White Box Tests', () => {

  describe('Path P1 — Missing fields', () => {

    test('TC L-01: Empty email → sendBadRequest', async () => {
      const req = mockReq({ email: '', password: '123' });
      const res = mockRes();

      await login(req, res);

      expect(mockResponseFormatter.sendBadRequest).toHaveBeenCalledWith(
        res, 'Email and password are required'
      );
      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
    });

    test('TC L-02: Missing password → sendBadRequest', async () => {
      const req = mockReq({ email: 'a@b.com' });
      const res = mockRes();

      await login(req, res);

      expect(mockResponseFormatter.sendBadRequest).toHaveBeenCalledWith(
        res, 'Email and password are required'
      );
    });
  });

  describe('Path P2 — User not found', () => {

    test('TC L-03: Non-existent email → sendUnauthorized', async () => {
      const req = mockReq({ email: 'noone@test.com', password: 'any' });
      const res = mockRes();

      mockUserRepository.findByEmail.mockResolvedValue(null);

      await login(req, res);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('noone@test.com');
      expect(mockResponseFormatter.sendUnauthorized).toHaveBeenCalledWith(
        res, 'Invalid credentials'
      );
    });
  });

  describe('Path P3 — Wrong password', () => {

    test('TC L-04: Valid email but wrong password → sendUnauthorized', async () => {
      const req = mockReq({ email: 'real@test.com', password: 'wrongpass' });
      const res = mockRes();

      const hashedCorrect = await bcrypt.hash('correct123', 10);
      mockUserRepository.findByEmail.mockResolvedValue({
        id: 1, username: 'realuser', email: 'real@test.com', password: hashedCorrect,
      });

      await login(req, res);

      expect(mockResponseFormatter.sendUnauthorized).toHaveBeenCalledWith(
        res, 'Invalid credentials'
      );
      expect(mockSessionManager.createSession).not.toHaveBeenCalled();
    });
  });

  describe('Path P4 — Successful login', () => {

    test('TC L-05: Valid credentials → sendSuccess with token', async () => {
      const req = mockReq({ email: 'real@test.com', password: 'correct123' });
      const res = mockRes();

      const hashedPassword = await bcrypt.hash('correct123', 10);
      mockUserRepository.findByEmail.mockResolvedValue({
        id: 1, username: 'realuser', email: 'real@test.com', password: hashedPassword,
      });
      mockSessionManager.createSession.mockResolvedValue({
        sessionId: 'sess-xyz', expiresAt: new Date('2026-04-08'),
      });

      await login(req, res);

      expect(mockSessionManager.createSession).toHaveBeenCalled();
      expect(mockResponseFormatter.sendSuccess).toHaveBeenCalledWith(
        res,
        expect.objectContaining({
          token: expect.any(String),
          sessionId: 'sess-xyz',
          user: expect.objectContaining({
            id: 1,
            username: 'realuser',
            email: 'real@test.com',
          }),
        }),
        'Login successful'
      );
    });
  });

  describe('Exception path — Server error', () => {

    test('TC L-06: DB error → sendError', async () => {
      const req = mockReq({ email: 'a@b.com', password: '123456' });
      const res = mockRes();

      mockUserRepository.findByEmail.mockRejectedValue(new Error('DB down'));

      await login(req, res);

      expect(mockResponseFormatter.sendError).toHaveBeenCalledWith(
        res, 'Server error during login'
      );
    });
  });
});


describe('logout() — White Box Tests', () => {

  test('TC LO-01: With token → deletes session and sends success', async () => {
    const req = mockReq({}, { 'Authorization': 'Bearer valid-token-123' });
    const res = mockRes();

    mockSessionManager.deleteSessionByToken.mockResolvedValue(true);

    await logout(req, res);

    expect(mockSessionManager.deleteSessionByToken).toHaveBeenCalledWith('valid-token-123');
    expect(mockResponseFormatter.sendSuccess).toHaveBeenCalledWith(
      res, null, 'Logout successful'
    );
  });

  test('TC LO-02: Without token → still sends success', async () => {
    const req = mockReq({}, {});
    const res = mockRes();

    await logout(req, res);

    expect(mockSessionManager.deleteSessionByToken).not.toHaveBeenCalled();
    expect(mockResponseFormatter.sendSuccess).toHaveBeenCalledWith(
      res, null, 'Logout successful'
    );
  });

  test('TC LO-03: Session delete throws → sendError', async () => {
    const req = mockReq({}, { 'Authorization': 'Bearer err-token' });
    const res = mockRes();

    mockSessionManager.deleteSessionByToken.mockRejectedValue(new Error('fail'));

    await logout(req, res);

    expect(mockResponseFormatter.sendError).toHaveBeenCalledWith(
      res, 'Server error during logout'
    );
  });
});


describe('getProfile() — White Box Tests', () => {

  test('TC GP-01: User found → sendSuccess with user data', async () => {
    const req = mockReq({}, {}, { id: 1 });
    const res = mockRes();

    mockUserRepository.findById.mockResolvedValue({
      id: 1, username: 'testuser', email: 'test@test.com',
    });

    await getProfile(req, res);

    expect(mockUserRepository.findById).toHaveBeenCalledWith(1);
    expect(mockResponseFormatter.sendSuccess).toHaveBeenCalledWith(
      res, { user: expect.objectContaining({ id: 1 }) }
    );
  });

  test('TC GP-02: User not found → sendNotFound', async () => {
    const req = mockReq({}, {}, { id: 999 });
    const res = mockRes();

    mockUserRepository.findById.mockResolvedValue(null);

    await getProfile(req, res);

    expect(mockResponseFormatter.sendNotFound).toHaveBeenCalledWith(res, 'User not found');
  });

  test('TC GP-03: DB error → sendError', async () => {
    const req = mockReq({}, {}, { id: 1 });
    const res = mockRes();

    mockUserRepository.findById.mockRejectedValue(new Error('DB fail'));

    await getProfile(req, res);

    expect(mockResponseFormatter.sendError).toHaveBeenCalledWith(
      res, 'Server error fetching profile'
    );
  });
});


describe('getSessions() — White Box Tests', () => {

  test('TC GS-01: Returns sessions array', async () => {
    const req = mockReq({}, {}, { id: 1 });
    const res = mockRes();

    mockSessionManager.getUserSessions.mockResolvedValue([
      { id: 'sess1', ip_address: '127.0.0.1' },
    ]);

    await getSessions(req, res);

    expect(mockResponseFormatter.sendSuccess).toHaveBeenCalledWith(
      res, { sessions: expect.any(Array) }
    );
  });

  test('TC GS-02: DB error → sendError', async () => {
    const req = mockReq({}, {}, { id: 1 });
    const res = mockRes();

    mockSessionManager.getUserSessions.mockRejectedValue(new Error('fail'));

    await getSessions(req, res);

    expect(mockResponseFormatter.sendError).toHaveBeenCalledWith(
      res, 'Server error fetching sessions'
    );
  });
});


describe('logoutAll() — White Box Tests', () => {

  test('TC LA-01: Deletes all sessions → sendSuccess', async () => {
    const req = mockReq({}, {}, { id: 1 });
    const res = mockRes();

    mockSessionManager.deleteUserSessions.mockResolvedValue(true);

    await logoutAll(req, res);

    expect(mockSessionManager.deleteUserSessions).toHaveBeenCalledWith(1);
    expect(mockResponseFormatter.sendSuccess).toHaveBeenCalledWith(
      res, null, 'Logged out from all devices successfully'
    );
  });

  test('TC LA-02: Error → sendError', async () => {
    const req = mockReq({}, {}, { id: 1 });
    const res = mockRes();

    mockSessionManager.deleteUserSessions.mockRejectedValue(new Error('fail'));

    await logoutAll(req, res);

    expect(mockResponseFormatter.sendError).toHaveBeenCalledWith(
      res, 'Server error during logout'
    );
  });
});
