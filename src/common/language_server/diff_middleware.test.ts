import * as vscode from 'vscode';
import { ApplyWorkspaceEditParams, ApplyWorkspaceEditResult } from 'vscode-languageclient';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { getLocalFeatureFlagService } from '../feature_flags/local_feature_flag_service';
import * as extensionConfiguration from '../utils/extension_configuration';
import { DiffMiddleware } from './diff_middleware';
import { FileSnapshotProvider } from './file_snapshot_provider';

jest.mock('../feature_flags/local_feature_flag_service');

describe('DiffMiddleware', () => {
  let middleware: DiffMiddleware;
  let mockFileSnapshotProvider: FileSnapshotProvider;
  let mockNext: jest.Mock;

  const mockFileUri = vscode.Uri.parse('file:///test/file.ts');
  const mockSnapshotUri = vscode.Uri.parse('gitlab-snapshot:/test/file-snapshot.ts');

  const createTestParams = (): ApplyWorkspaceEditParams =>
    createFakePartial<ApplyWorkspaceEditParams>({
      edit: {
        documentChanges: [
          {
            textDocument: { uri: mockFileUri.toString(), version: 1 },
            edits: [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                newText: 'test',
              },
            ],
          },
        ],
      },
    });

  beforeEach(() => {
    mockFileSnapshotProvider = createFakePartial<FileSnapshotProvider>({
      takeSnapshot: jest.fn().mockResolvedValue({ dispose: jest.fn() }),
      hasContent: jest.fn().mockReturnValue(true),
      snapshotUri: jest.fn().mockReturnValue(mockSnapshotUri),
    });

    middleware = new DiffMiddleware(mockFileSnapshotProvider);

    mockNext = jest.fn().mockResolvedValue(
      createFakePartial<ApplyWorkspaceEditResult>({
        applied: true,
      }),
    );

    vscode.commands.executeCommand = jest.fn().mockResolvedValue(undefined);
    vscode.window.showTextDocument = jest.fn().mockResolvedValue(undefined);

    jest.mocked(getLocalFeatureFlagService).mockReturnValue(
      createFakePartial({
        isEnabled: jest.fn().mockReturnValue(true),
      }),
    );

    // Mock default configuration
    jest.spyOn(extensionConfiguration, 'getAgentPlatformConfiguration').mockReturnValue({
      enabled: true,
      connectionType: 'websocket',
      defaultNamespace: 'gitlab-org',
      editFileDiffBehavior: 'foreground',
    });
  });

  it('should take snapshots, apply edits, and open the diff in foreground by default', async () => {
    const params = createTestParams();

    const result = await middleware.process(params, mockNext);

    // Verify snapshots were taken
    expect(mockFileSnapshotProvider.takeSnapshot).toHaveBeenCalledWith(mockFileUri);

    // Verify next middleware was called
    expect(mockNext).toHaveBeenCalledWith(params);

    // Verify diff view was opened in foreground (no options passed)
    expect(mockFileSnapshotProvider.hasContent).toHaveBeenCalledWith(mockFileUri);
    expect(mockFileSnapshotProvider.snapshotUri).toHaveBeenCalledWith(mockFileUri);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.diff',
      mockSnapshotUri,
      mockFileUri,
      'file.ts: Original ↔ Edited',
      undefined,
    );

    // Verify result is returned
    expect(result).toEqual({ applied: true });
  });

  it('should open diff in background when editFileDiffBehavior is "background"', async () => {
    jest.spyOn(extensionConfiguration, 'getAgentPlatformConfiguration').mockReturnValue({
      enabled: true,
      connectionType: 'websocket',
      defaultNamespace: 'gitlab-org',
      editFileDiffBehavior: 'background',
    });

    const params = createTestParams();

    await middleware.process(params, mockNext);

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.diff',
      mockSnapshotUri,
      mockFileUri,
      'file.ts: Original ↔ Edited',
      { preview: false, preserveFocus: true, background: true },
    );
  });

  it('should not open diff when editFileDiffBehavior is "none"', async () => {
    jest.spyOn(extensionConfiguration, 'getAgentPlatformConfiguration').mockReturnValue({
      enabled: true,
      connectionType: 'websocket',
      defaultNamespace: 'gitlab-org',
      editFileDiffBehavior: 'none',
    });

    const params = createTestParams();

    await middleware.process(params, mockNext);

    // Verify snapshots were still taken
    expect(mockFileSnapshotProvider.takeSnapshot).toHaveBeenCalledWith(mockFileUri);

    // Verify next middleware was called
    expect(mockNext).toHaveBeenCalledWith(params);

    // Verify diff view was NOT opened
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('should defer disposal when opening diff in background', async () => {
    jest.spyOn(extensionConfiguration, 'getAgentPlatformConfiguration').mockReturnValue({
      enabled: true,
      connectionType: 'websocket',
      defaultNamespace: 'gitlab-org',
      editFileDiffBehavior: 'background',
    });

    const mockDispose = jest.fn();
    jest.mocked(mockFileSnapshotProvider.takeSnapshot).mockResolvedValue({ dispose: mockDispose });

    const params = createTestParams();

    await middleware.process(params, mockNext);

    // Verify dispose was NOT called immediately for background opening
    expect(mockDispose).not.toHaveBeenCalled();
  });

  it('should dispose snapshots immediately when editFileDiffBehavior is "none"', async () => {
    jest.spyOn(extensionConfiguration, 'getAgentPlatformConfiguration').mockReturnValue({
      enabled: true,
      connectionType: 'websocket',
      defaultNamespace: 'gitlab-org',
      editFileDiffBehavior: 'none',
    });

    const mockDispose = jest.fn();
    jest.mocked(mockFileSnapshotProvider.takeSnapshot).mockResolvedValue({ dispose: mockDispose });

    const params = createTestParams();

    await middleware.process(params, mockNext);

    // Verify dispose WAS called immediately since diff won't be opened
    expect(mockDispose).toHaveBeenCalled();
  });

  it('should not dispose snapshots immediately when opening diff in foreground', async () => {
    jest.spyOn(extensionConfiguration, 'getAgentPlatformConfiguration').mockReturnValue({
      enabled: true,
      connectionType: 'websocket',
      defaultNamespace: 'gitlab-org',
      editFileDiffBehavior: 'foreground',
    });

    const mockDispose = jest.fn();
    jest.mocked(mockFileSnapshotProvider.takeSnapshot).mockResolvedValue({ dispose: mockDispose });

    const params = createTestParams();

    await middleware.process(params, mockNext);

    // Verify dispose was NOT called immediately even in foreground mode
    // (disposal happens when the editor changes to the diff tab, which is handled by VS Code event)
    expect(mockDispose).not.toHaveBeenCalled();
  });

  it('should bypass diff logic when feature flag is disabled', async () => {
    jest.mocked(getLocalFeatureFlagService).mockReturnValue(
      createFakePartial({
        isEnabled: jest.fn().mockReturnValue(false),
      }),
    );

    const params = createFakePartial<ApplyWorkspaceEditParams>({
      edit: { documentChanges: [] },
    });

    const result = await middleware.process(params, mockNext);

    // Verify no snapshots were taken
    expect(mockFileSnapshotProvider.takeSnapshot).not.toHaveBeenCalled();

    // Verify next middleware was still called
    expect(mockNext).toHaveBeenCalledWith(params);

    // Verify no diff views were opened
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();

    expect(result).toEqual({ applied: true });
  });
});
