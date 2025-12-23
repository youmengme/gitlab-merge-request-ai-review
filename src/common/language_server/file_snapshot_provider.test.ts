import * as vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { FileSnapshotProviderImpl } from './file_snapshot_provider';

jest.mock('../log');

describe('FileSnapshotProvider', () => {
  let provider: FileSnapshotProviderImpl;
  const mockFileUri = vscode.Uri.parse('file:///test/file.ts');
  const mockFileContent = 'const hello = "world";';

  beforeEach(() => {
    provider = new FileSnapshotProviderImpl();

    // Mock vscode.workspace.textDocuments as empty array (no open documents)
    Object.defineProperty(vscode.workspace, 'textDocuments', {
      value: [],
      writable: true,
    });

    // Mock vscode.workspace.fs.readFile to return test content
    vscode.workspace.fs.readFile = jest
      .fn()
      .mockResolvedValue(Buffer.from(mockFileContent, 'utf8'));
  });

  it('should take snapshot, provide content, and return disposable for cleanup', async () => {
    // Take a snapshot
    const disposable = await provider.takeSnapshot(mockFileUri);

    // Verify snapshot content is available immediately
    expect(provider.hasContent(mockFileUri)).toBe(true);
    expect(provider.getContent(mockFileUri)).toBe(mockFileContent);

    // Verify snapshot URI content is available via provideTextDocumentContent
    const snapshotUri = provider.snapshotUri(mockFileUri);
    expect(provider.provideTextDocumentContent(snapshotUri)).toBe(mockFileContent);

    // Dispose the snapshot
    disposable.dispose();

    // Verify content is cleaned up
    expect(provider.hasContent(mockFileUri)).toBe(false);
    expect(provider.getContent(mockFileUri)).toBe('');
    expect(provider.provideTextDocumentContent(snapshotUri)).toBe('');
  });

  it('should read from open document when available', async () => {
    const openDocumentContent = 'const from = "open document";';
    const mockOpenDocument = createFakePartial<vscode.TextDocument>({
      uri: mockFileUri,
      getText: jest.fn().mockReturnValue(openDocumentContent),
    });

    // Mock an open document
    Object.defineProperty(vscode.workspace, 'textDocuments', {
      value: [mockOpenDocument],
      writable: true,
    });

    await provider.takeSnapshot(mockFileUri);

    // Verify it used content from open document, not file system
    expect(provider.getContent(mockFileUri)).toBe(openDocumentContent);
    expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
    expect(mockOpenDocument.getText).toHaveBeenCalled();
  });

  it('should create snapshot URI with correct scheme and file extension', () => {
    const snapshotUri = provider.snapshotUri(mockFileUri);

    expect(snapshotUri.scheme).toBe(FileSnapshotProviderImpl.SCHEME);
    expect(snapshotUri.path).toBe('/test/file-snapshot.ts');
  });

  it('should create unique snapshot URIs for files with same name in different directories', () => {
    const fileUri1 = vscode.Uri.parse('file:///project/src/index.js');
    const fileUri2 = vscode.Uri.parse('file:///project/tests/index.js');

    const snapshotUri1 = provider.snapshotUri(fileUri1);
    const snapshotUri2 = provider.snapshotUri(fileUri2);

    expect(snapshotUri1.path).toBe('/project/src/index-snapshot.js');
    expect(snapshotUri2.path).toBe('/project/tests/index-snapshot.js');
  });

  it('should handle concurrent snapshot creations by sharing promise and only calling getFileContent once', async () => {
    let resolveReadFile: (value: Buffer) => void = jest.fn();
    const readFilePromise = new Promise<Buffer>(resolve => {
      resolveReadFile = resolve;
    });

    jest.mocked(vscode.workspace.fs.readFile).mockReturnValue(readFilePromise);

    const promise1 = provider.takeSnapshot(mockFileUri);
    const promise2 = provider.takeSnapshot(mockFileUri);

    // only one of the two calls gets to ask for file content
    // this verifies that the promise caching works, otherwise the readFile would be called twice
    expect(vscode.workspace.fs.readFile).toHaveBeenCalledTimes(1);

    resolveReadFile(Buffer.from(mockFileContent, 'utf8'));

    const [disposable1, disposable2] = await Promise.all([promise1, promise2]);

    expect(provider.getContent(mockFileUri)).toBe(mockFileContent);

    // here we werify that the two calls successfully set the shapshot counter and diposing one only decrements it
    disposable1.dispose();
    expect(provider.getContent(mockFileUri)).toBe(mockFileContent);

    disposable2.dispose();
    expect(provider.hasContent(mockFileUri)).toBe(false);
    expect(provider.getContent(mockFileUri)).toBe('');
  });
});
