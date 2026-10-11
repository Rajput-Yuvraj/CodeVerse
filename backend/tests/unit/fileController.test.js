const mockFileRepository = {
  findByWorkspace: jest.fn(),
  findById: jest.fn(),
  getParentPath: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  rename: jest.fn(),
  getChildren: jest.fn(),
  updatePath: jest.fn(),
  delete: jest.fn(),
  addSaveEvent: jest.fn(),
  getLanguageStats: jest.fn(),
  getSystemStatus: jest.fn(),
  getSaveActivity: jest.fn(),
};
jest.mock('../../repositories/fileRepository', () => mockFileRepository);

const mockVersionRepository = {
  createVersion: jest.fn(),
};
jest.mock('../../repositories/versionRepository', () => mockVersionRepository);

const mockAccessControl = {
  checkWorkspaceAccess: jest.fn(),
};
jest.mock('../../utils/accessControl', () => mockAccessControl);

const mockResponseFormatter = {
  sendSuccess: jest.fn(),
  sendError: jest.fn(),
  sendCreated: jest.fn(),
  sendNotFound: jest.fn(),
  sendForbidden: jest.fn(),
  sendBadRequest: jest.fn(),
};
jest.mock('../../utils/responseFormatter', () => mockResponseFormatter);

const {
  createFileOrFolder,
  updateFile,
  getFile,
  getWorkspaceFiles,
  deleteFileOrFolder,
  renameFileOrFolder,
  getLanguageStats,
  getSaveActivity,
} = require('../../controllers/fileController');

const mockReq = (params = {}, body = {}, query = {}, user = { id: 1 }) => ({
  params,
  body,
  query,
  user,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockVersionRepository.createVersion.mockResolvedValue(true);
});


describe('createFileOrFolder() — White Box Tests', () => {

  test('TC F-01: Non-member user → sendForbidden "Access denied"', async () => {
    const req = mockReq(
      { workspaceId: 'ws-abc' },
      { name: 'app.js', type: 'file' }
    );
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
      hasAccess: false, role: null,
    });

    await createFileOrFolder(req, res);

    expect(mockAccessControl.checkWorkspaceAccess).toHaveBeenCalledWith(1, 'ws-abc', 'collaborator');
    expect(mockResponseFormatter.sendForbidden).toHaveBeenCalledWith(
      res, 'Access denied to this workspace'
    );
    expect(mockFileRepository.create).not.toHaveBeenCalled();
  });

  test('TC F-02: Viewer role → sendForbidden "No permission"', async () => {
    const req = mockReq(
      { workspaceId: 'ws-abc' },
      { name: 'app.js', type: 'file' }
    );
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
      hasAccess: false, role: 'viewer',
    });

    await createFileOrFolder(req, res);

    expect(mockResponseFormatter.sendForbidden).toHaveBeenCalledWith(
      res, 'You do not have permission to create files'
    );
  });

  describe('Path P3 — Invalid name/type', () => {

    test('TC F-03: Empty name → sendBadRequest', async () => {
      const req = mockReq(
        { workspaceId: 'ws-abc' },
        { name: '', type: 'file' }
      );
      const res = mockRes();

      mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
        hasAccess: true, role: 'collaborator',
      });

      await createFileOrFolder(req, res);

      expect(mockResponseFormatter.sendBadRequest).toHaveBeenCalledWith(
        res, 'Invalid request. Name and type are required'
      );
    });

    test('TC F-04: Invalid type "image" → sendBadRequest', async () => {
      const req = mockReq(
        { workspaceId: 'ws-abc' },
        { name: 'photo.png', type: 'image' }
      );
      const res = mockRes();

      mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
        hasAccess: true, role: 'collaborator',
      });

      await createFileOrFolder(req, res);

      expect(mockResponseFormatter.sendBadRequest).toHaveBeenCalledWith(
        res, 'Invalid request. Name and type are required'
      );
    });
  });

  test('TC F-05: Invalid parentId → sendNotFound "Parent not found"', async () => {
    const req = mockReq(
      { workspaceId: 'ws-abc' },
      { name: 'app.js', type: 'file', parentId: 9999 }
    );
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
      hasAccess: true, role: 'collaborator',
    });
    mockFileRepository.getParentPath.mockResolvedValue(null);

    await createFileOrFolder(req, res);

    expect(mockFileRepository.getParentPath).toHaveBeenCalledWith(9999, 'ws-abc');
    expect(mockResponseFormatter.sendNotFound).toHaveBeenCalledWith(
      res, 'Parent folder not found'
    );
    expect(mockFileRepository.create).not.toHaveBeenCalled();
  });

  test('TC F-06: Valid parentId → creates file with nested path', async () => {
    const req = mockReq(
      { workspaceId: 'ws-abc' },
      { name: 'app.js', type: 'file', parentId: 1, content: 'code', language: 'javascript' }
    );
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
      hasAccess: true, role: 'collaborator',
    });
    mockFileRepository.getParentPath.mockResolvedValue('src');
    mockFileRepository.create.mockResolvedValue({
      id: 10, workspace_id: 'ws-abc', name: 'app.js', type: 'file',
      path: 'src/app.js', parent_id: 1,
    });

    await createFileOrFolder(req, res);

    expect(mockFileRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'src/app.js',
        parentId: 1,
        workspaceId: 'ws-abc',
      })
    );
    expect(mockResponseFormatter.sendCreated).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ file: expect.any(Object) }),
      'File created successfully'
    );
  });

  test('TC F-07: No parentId → creates file at root with path = name', async () => {
    const req = mockReq(
      { workspaceId: 'ws-abc' },
      { name: 'README.md', type: 'file' }
    );
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
      hasAccess: true, role: 'owner',
    });
    mockFileRepository.create.mockResolvedValue({
      id: 11, name: 'README.md', type: 'file', path: 'README.md',
    });

    await createFileOrFolder(req, res);

    expect(mockFileRepository.getParentPath).not.toHaveBeenCalled();
    expect(mockFileRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'README.md' })
    );
    expect(mockResponseFormatter.sendCreated).toHaveBeenCalled();
  });

  test('TC F-07b: type=folder → sendCreated with "Folder created"', async () => {
    const req = mockReq(
      { workspaceId: 'ws-abc' },
      { name: 'src', type: 'folder' }
    );
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
      hasAccess: true, role: 'owner',
    });
    mockFileRepository.create.mockResolvedValue({
      id: 12, name: 'src', type: 'folder', path: 'src',
    });

    await createFileOrFolder(req, res);

    expect(mockResponseFormatter.sendCreated).toHaveBeenCalledWith(
      res, expect.any(Object), 'Folder created successfully'
    );
  });

  test('TC F-08: Duplicate file → sendBadRequest', async () => {
    const req = mockReq(
      { workspaceId: 'ws-abc' },
      { name: 'app.js', type: 'file' }
    );
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
      hasAccess: true, role: 'collaborator',
    });

    const dupError = new Error('Duplicate entry');
    dupError.code = 'ER_DUP_ENTRY';
    mockFileRepository.create.mockRejectedValue(dupError);

    await createFileOrFolder(req, res);

    expect(mockResponseFormatter.sendBadRequest).toHaveBeenCalledWith(
      res, 'A file or folder with this name already exists in this location'
    );
  });

  test('TC F-09: Generic DB error → sendError', async () => {
    const req = mockReq(
      { workspaceId: 'ws-abc' },
      { name: 'app.js', type: 'file' }
    );
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
      hasAccess: true, role: 'collaborator',
    });
    mockFileRepository.create.mockRejectedValue(new Error('Connection lost'));

    await createFileOrFolder(req, res);

    expect(mockResponseFormatter.sendError).toHaveBeenCalledWith(
      res, 'Server error creating file/folder'
    );
  });
});


describe('updateFile() — White Box Tests', () => {

  test('TC U-01: Non-member → sendForbidden "Access denied"', async () => {
    const req = mockReq(
      { workspaceId: 'ws-abc', fileId: '5' },
      { content: 'new code' }
    );
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
      hasAccess: false, role: null,
    });

    await updateFile(req, res);

    expect(mockResponseFormatter.sendForbidden).toHaveBeenCalledWith(
      res, 'Access denied to this workspace'
    );
  });

  test('TC U-02: Viewer → sendForbidden "No permission to edit"', async () => {
    const req = mockReq(
      { workspaceId: 'ws-abc', fileId: '5' },
      { content: 'new code' }
    );
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
      hasAccess: false, role: 'viewer',
    });

    await updateFile(req, res);

    expect(mockResponseFormatter.sendForbidden).toHaveBeenCalledWith(
      res, 'You do not have permission to edit files'
    );
  });

  test('TC U-03: Non-existent file → sendNotFound', async () => {
    const req = mockReq(
      { workspaceId: 'ws-abc', fileId: '999' },
      { content: 'code' }
    );
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
      hasAccess: true, role: 'collaborator',
    });
    mockFileRepository.update.mockResolvedValue(false);

    await updateFile(req, res);

    expect(mockResponseFormatter.sendNotFound).toHaveBeenCalledWith(res, 'File not found');
    expect(mockFileRepository.addSaveEvent).not.toHaveBeenCalled();
  });

  test('TC U-04: Valid update → sendSuccess + save event + auto-version', async () => {
    const req = mockReq(
      { workspaceId: 'ws-abc', fileId: '5' },
      { content: 'const x = 42;', language: 'javascript' }
    );
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
      hasAccess: true, role: 'owner',
    });
    mockFileRepository.update.mockResolvedValue(true);
    mockFileRepository.addSaveEvent.mockResolvedValue(true);

    await updateFile(req, res);

    expect(mockFileRepository.update).toHaveBeenCalledWith(
      '5', 'ws-abc', 'const x = 42;', 'javascript'
    );
    expect(mockFileRepository.addSaveEvent).toHaveBeenCalledWith('ws-abc', '5', 1);
    expect(mockVersionRepository.createVersion).toHaveBeenCalledWith(
      '5', 'ws-abc', 'const x = 42;', 'javascript', 1
    );
    expect(mockResponseFormatter.sendSuccess).toHaveBeenCalledWith(
      res, null, 'File updated successfully'
    );
  });

  test('TC U-05: DB error → sendError', async () => {
    const req = mockReq(
      { workspaceId: 'ws-abc', fileId: '5' },
      { content: 'code' }
    );
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockRejectedValue(new Error('DB down'));

    await updateFile(req, res);

    expect(mockResponseFormatter.sendError).toHaveBeenCalledWith(
      res, 'Server error updating file'
    );
  });
});


describe('getFile() — White Box Tests', () => {

  test('TC GF-01: No access → sendForbidden', async () => {
    const req = mockReq({ workspaceId: 'ws-abc', fileId: '1' });
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({ hasAccess: false });

    await getFile(req, res);

    expect(mockResponseFormatter.sendForbidden).toHaveBeenCalledWith(
      res, 'Access denied to this workspace'
    );
  });

  test('TC GF-02: File not found → sendNotFound', async () => {
    const req = mockReq({ workspaceId: 'ws-abc', fileId: '999' });
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({ hasAccess: true });
    mockFileRepository.findById.mockResolvedValue(null);

    await getFile(req, res);

    expect(mockResponseFormatter.sendNotFound).toHaveBeenCalledWith(res, 'File not found');
  });

  test('TC GF-03: File found → sendSuccess', async () => {
    const req = mockReq({ workspaceId: 'ws-abc', fileId: '1' });
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({ hasAccess: true });
    mockFileRepository.findById.mockResolvedValue({ id: 1, name: 'app.js' });

    await getFile(req, res);

    expect(mockResponseFormatter.sendSuccess).toHaveBeenCalledWith(
      res, { file: expect.objectContaining({ id: 1 }) }
    );
  });

  test('TC GF-04: DB error → sendError', async () => {
    const req = mockReq({ workspaceId: 'ws-abc', fileId: '1' });
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockRejectedValue(new Error('fail'));

    await getFile(req, res);

    expect(mockResponseFormatter.sendError).toHaveBeenCalledWith(
      res, 'Server error fetching file'
    );
  });
});


describe('deleteFileOrFolder() — White Box Tests', () => {

  test('TC DF-01: Viewer → sendForbidden', async () => {
    const req = mockReq({ workspaceId: 'ws-abc', fileId: '1' });
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({
      hasAccess: false, role: 'viewer',
    });

    await deleteFileOrFolder(req, res);

    expect(mockResponseFormatter.sendForbidden).toHaveBeenCalledWith(
      res, 'You do not have permission to delete files'
    );
  });

  test('TC DF-02: File not found → sendNotFound', async () => {
    const req = mockReq({ workspaceId: 'ws-abc', fileId: '999' });
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({ hasAccess: true, role: 'owner' });
    mockFileRepository.delete.mockResolvedValue(false);

    await deleteFileOrFolder(req, res);

    expect(mockResponseFormatter.sendNotFound).toHaveBeenCalledWith(
      res, 'File or folder not found'
    );
  });

  test('TC DF-03: Success → sendSuccess', async () => {
    const req = mockReq({ workspaceId: 'ws-abc', fileId: '5' });
    const res = mockRes();

    mockAccessControl.checkWorkspaceAccess.mockResolvedValue({ hasAccess: true, role: 'owner' });
    mockFileRepository.delete.mockResolvedValue(true);

    await deleteFileOrFolder(req, res);

    expect(mockResponseFormatter.sendSuccess).toHaveBeenCalledWith(
      res, null, 'Deleted successfully'
    );
  });
});


describe('getLanguageStats() — White Box Tests', () => {

  test('TC LS-01: Invalid userId → sendBadRequest', async () => {
    const req = mockReq({}, {}, {}, { id: 'not-a-number' });
    const res = mockRes();

    await getLanguageStats(req, res);

    expect(mockResponseFormatter.sendBadRequest).toHaveBeenCalledWith(
      res, 'Invalid user context'
    );
  });

  test('TC LS-02: Returns stats with percentages', async () => {
    const req = mockReq({}, {}, {}, { id: 1 });
    const res = mockRes();

    mockFileRepository.getLanguageStats.mockResolvedValue([
      { language: 'javascript', file_count: 6 },
      { language: 'python', file_count: 4 },
    ]);

    await getLanguageStats(req, res);

    expect(mockResponseFormatter.sendSuccess).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        totalFiles: 10,
        stats: expect.arrayContaining([
          expect.objectContaining({ name: 'javascript', percentage: 60 }),
          expect.objectContaining({ name: 'python', percentage: 40 }),
        ]),
      })
    );
  });

  test('TC LS-03: Zero files → percentage = 0', async () => {
    const req = mockReq({}, {}, {}, { id: 1 });
    const res = mockRes();

    mockFileRepository.getLanguageStats.mockResolvedValue([]);

    await getLanguageStats(req, res);

    expect(mockResponseFormatter.sendSuccess).toHaveBeenCalledWith(
      res, expect.objectContaining({ totalFiles: 0, stats: [] })
    );
  });
});


describe('getSaveActivity() — White Box Tests', () => {

  test('TC SA-01: Invalid userId → sendBadRequest', async () => {
    const req = mockReq({}, {}, { days: '30' }, { id: undefined });
    const res = mockRes();

    await getSaveActivity(req, res);

    expect(mockResponseFormatter.sendBadRequest).toHaveBeenCalledWith(
      res, 'Invalid user context for save activity'
    );
  });

  test('TC SA-02: Valid request → returns counts object', async () => {
    const req = mockReq({}, {}, { days: '7' }, { id: 1 });
    const res = mockRes();

    mockFileRepository.getSaveActivity.mockResolvedValue([
      { save_date: '2026-03-30', save_count: 5 },
      { save_date: '2026-03-31', save_count: 3 },
    ]);

    await getSaveActivity(req, res);

    expect(mockResponseFormatter.sendSuccess).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        counts: { '2026-03-30': 5, '2026-03-31': 3 },
        days: 7,
      })
    );
  });

  test('TC SA-03: days clamped to max 365', async () => {
    const req = mockReq({}, {}, { days: '999' }, { id: 1 });
    const res = mockRes();

    mockFileRepository.getSaveActivity.mockResolvedValue([]);

    await getSaveActivity(req, res);

    expect(mockResponseFormatter.sendSuccess).toHaveBeenCalledWith(
      res, expect.objectContaining({ days: 365 })
    );
  });
});
