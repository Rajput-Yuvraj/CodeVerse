const jwt = require('jsonwebtoken');

const mockVerifySession = jest.fn();
jest.mock('../../utils/sessionManager', () => ({
  verifySession: mockVerifySession,
}));

process.env.JWT_SECRET = 'test-secret-key-for-white-box-testing';

const { authMiddleware } = require('../../middleware/authMiddleware');

const mockReq = (authHeader = null) => ({
  header: jest.fn((name) => {
    if (name === 'Authorization') return authHeader;
    return null;
  }),
  user: null,
  sessionId: null,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authMiddleware() — White Box Tests', () => {

  test('TC M-01: No Authorization header → 401 "No token"', async () => {
    const req = mockReq(null);
    const res = mockRes();

    await authMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token, authorization denied' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('TC M-01b: Empty Bearer string → 401 "No token"', async () => {
    const req = mockReq('Bearer ');
    const res = mockRes();

    await authMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('TC M-02: Expired JWT → 401 "Token expired"', async () => {
    const expiredToken = jwt.sign(
      { id: 1, username: 'user', email: 'u@t.com' },
      process.env.JWT_SECRET,
      { expiresIn: '0s' }
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    const req = mockReq(`Bearer ${expiredToken}`);
    const res = mockRes();

    await authMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('TC M-03: Malformed/random token → 401 "Token is not valid"', async () => {
    const req = mockReq('Bearer this-is-a-garbage-token-12345');
    const res = mockRes();

    await authMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token is not valid' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('TC M-04: Valid JWT but session not in DB → 401 "Session expired"', async () => {
    const validToken = jwt.sign(
      { id: 1, username: 'user', email: 'u@t.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const req = mockReq(`Bearer ${validToken}`);
    const res = mockRes();

    mockVerifySession.mockResolvedValue(null);

    await authMiddleware(req, res, mockNext);

    expect(mockVerifySession).toHaveBeenCalledWith(validToken);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Session expired or invalid' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('TC M-05: Valid JWT + active session → sets req.user, calls next()', async () => {
    const validToken = jwt.sign(
      { id: 1, username: 'user', email: 'u@t.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const req = mockReq(`Bearer ${validToken}`);
    const res = mockRes();

    const sessionData = {
      sessionId: 'sess-valid-123',
      user: { id: 1, username: 'user', email: 'u@t.com' },
    };
    mockVerifySession.mockResolvedValue(sessionData);

    await authMiddleware(req, res, mockNext);

    expect(req.user).toEqual({ id: 1, username: 'user', email: 'u@t.com' });
    expect(req.sessionId).toBe('sess-valid-123');
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
