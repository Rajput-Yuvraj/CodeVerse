const mockWorkspaceRepository = {
  getUserWorkspaceRole: jest.fn(),
  findById: jest.fn(),
};
jest.mock('../../repositories/workspaceRepository', () => mockWorkspaceRepository);

const {
  checkWorkspaceAccess,
  isWorkspaceOwner,
  canEditWorkspace,
  canViewWorkspace,
  ROLE_HIERARCHY,
} = require('../../utils/accessControl');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ROLE_HIERARCHY — Structure Verification', () => {

  test('Hierarchy levels: owner(3) > collaborator(2) > viewer(1)', () => {
    expect(ROLE_HIERARCHY.owner).toBe(3);
    expect(ROLE_HIERARCHY.collaborator).toBe(2);
    expect(ROLE_HIERARCHY.viewer).toBe(1);
    expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.collaborator);
    expect(ROLE_HIERARCHY.collaborator).toBeGreaterThan(ROLE_HIERARCHY.viewer);
  });
});


describe('checkWorkspaceAccess() — White Box Tests', () => {

  test('TC A-01: Non-member user → { hasAccess: false, role: null }', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockResolvedValue(null);

    const result = await checkWorkspaceAccess(999, 'ws-abc', null);

    expect(result).toEqual({ hasAccess: false, role: null });
    expect(mockWorkspaceRepository.getUserWorkspaceRole).toHaveBeenCalledWith(999, 'ws-abc');
  });

  test('TC A-02: Member, no required role → { hasAccess: true, role: "viewer" }', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockResolvedValue({ role: 'viewer' });

    const result = await checkWorkspaceAccess(1, 'ws-abc', null);

    expect(result).toEqual({ hasAccess: true, role: 'viewer' });
  });

  test('TC A-02b: Member (owner), no required role → { hasAccess: true, role: "owner" }', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockResolvedValue({ role: 'owner' });

    const result = await checkWorkspaceAccess(1, 'ws-abc');

    expect(result).toEqual({ hasAccess: true, role: 'owner' });
  });

  test('TC A-03: Viewer needs collaborator → hasAccess: false (1 < 2)', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockResolvedValue({ role: 'viewer' });

    const result = await checkWorkspaceAccess(1, 'ws-abc', 'collaborator');

    expect(result).toEqual({ hasAccess: false, role: 'viewer' });
  });

  test('TC A-04: Collaborator needs collaborator → hasAccess: true (2 >= 2)', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockResolvedValue({ role: 'collaborator' });

    const result = await checkWorkspaceAccess(2, 'ws-abc', 'collaborator');

    expect(result).toEqual({ hasAccess: true, role: 'collaborator' });
  });

  test('TC A-05: Owner needs collaborator → hasAccess: true (3 >= 2)', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockResolvedValue({ role: 'owner' });

    const result = await checkWorkspaceAccess(3, 'ws-abc', 'collaborator');

    expect(result).toEqual({ hasAccess: true, role: 'owner' });
  });

  test('TC A-06: Owner needs owner → hasAccess: true (3 >= 3)', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockResolvedValue({ role: 'owner' });

    const result = await checkWorkspaceAccess(3, 'ws-abc', 'owner');

    expect(result).toEqual({ hasAccess: true, role: 'owner' });
  });

  test('TC A-07: Collaborator needs owner → hasAccess: false (2 < 3)', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockResolvedValue({ role: 'collaborator' });

    const result = await checkWorkspaceAccess(2, 'ws-abc', 'owner');

    expect(result).toEqual({ hasAccess: false, role: 'collaborator' });
  });

  test('TC A-08: Unknown role → falls back to level 0', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockResolvedValue({ role: 'guest' });

    const result = await checkWorkspaceAccess(1, 'ws-abc', 'viewer');

    expect(result).toEqual({ hasAccess: false, role: 'guest' });
  });

  test('TC A-09: DB error → throws', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockRejectedValue(new Error('DB down'));

    await expect(checkWorkspaceAccess(1, 'ws-abc')).rejects.toThrow('DB down');
  });
});


describe('isWorkspaceOwner() — White Box Tests', () => {

  test('TC IO-01: User is owner → returns true', async () => {
    mockWorkspaceRepository.findById.mockResolvedValue({ owner_id: 1 });

    const result = await isWorkspaceOwner(1, 'ws-abc');

    expect(result).toBe(true);
  });

  test('TC IO-02: User is NOT owner → returns false', async () => {
    mockWorkspaceRepository.findById.mockResolvedValue({ owner_id: 2 });

    const result = await isWorkspaceOwner(1, 'ws-abc');

    expect(result).toBe(false);
  });

  test('TC IO-03: Workspace not found → returns falsy', async () => {
    mockWorkspaceRepository.findById.mockResolvedValue(null);

    const result = await isWorkspaceOwner(1, 'ws-nonexistent');

    expect(result).toBeFalsy();
  });
});


describe('canEditWorkspace() — White Box Tests', () => {

  test('TC CE-01: Collaborator → true', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockResolvedValue({ role: 'collaborator' });

    expect(await canEditWorkspace(1, 'ws-abc')).toBe(true);
  });

  test('TC CE-02: Viewer → false', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockResolvedValue({ role: 'viewer' });

    expect(await canEditWorkspace(1, 'ws-abc')).toBe(false);
  });

  test('TC CE-03: Owner → true', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockResolvedValue({ role: 'owner' });

    expect(await canEditWorkspace(1, 'ws-abc')).toBe(true);
  });
});


describe('canViewWorkspace() — White Box Tests', () => {

  test('TC CV-01: Any member → true', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockResolvedValue({ role: 'viewer' });

    expect(await canViewWorkspace(1, 'ws-abc')).toBe(true);
  });

  test('TC CV-02: Non-member → false', async () => {
    mockWorkspaceRepository.getUserWorkspaceRole.mockResolvedValue(null);

    expect(await canViewWorkspace(999, 'ws-abc')).toBe(false);
  });
});
