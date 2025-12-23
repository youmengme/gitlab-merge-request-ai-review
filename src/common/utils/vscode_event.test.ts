import vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { onDidSaveActiveTextDocument } from './vscode_event';

jest.mock('vscode');

const simulateSave = (savedDoc: vscode.TextDocument) => {
  jest.mocked(vscode.workspace.onDidSaveTextDocument).mock.calls.forEach(([listener]) => {
    listener(savedDoc);
  });
};

const createTextDocument = (path: string, text: string) => {
  return createFakePartial<vscode.TextDocument>({
    uri: vscode.Uri.file(path),
    getText: jest.fn().mockReturnValue(text),
  });
};

describe('onDidSaveActiveTextDocument', () => {
  let mockCallback: jest.Mock;
  let mockDisposable: vscode.Disposable;

  const activeDocument = createTextDocument('/path/to/active.ts', 'active file');

  beforeEach(() => {
    jest.clearAllMocks();
    mockCallback = jest.fn();
    mockDisposable = { dispose: jest.fn() };

    jest.mocked(vscode.workspace.onDidSaveTextDocument).mockReturnValue(mockDisposable);

    vscode.window.activeTextEditor = createFakePartial<vscode.TextEditor>({
      document: activeDocument,
    });
  });

  it('should register a document save listener', () => {
    onDidSaveActiveTextDocument(mockCallback);
    expect(vscode.workspace.onDidSaveTextDocument).toHaveBeenCalled();
  });

  it('should call callback when active document is saved', () => {
    onDidSaveActiveTextDocument(mockCallback);

    // Simulate active document save
    simulateSave(activeDocument);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should not call callback when saved document is not active', () => {
    const inactiveDoc = createTextDocument('/path/to/inactive.ts', 'inactive file');
    onDidSaveActiveTextDocument(mockCallback);

    // Simulate inactive document save
    simulateSave(inactiveDoc);

    expect(mockCallback).not.toHaveBeenCalled();
  });

  it('should not call callback when there is no active editor', () => {
    vscode.window.activeTextEditor = undefined;
    const mockDoc = createTextDocument('path/to/file.ts', 'file');

    onDidSaveActiveTextDocument(mockCallback);

    // Simulate document save
    simulateSave(mockDoc);
    expect(mockCallback).not.toHaveBeenCalled();
  });

  it('should return a disposable', () => {
    const result = onDidSaveActiveTextDocument(mockCallback);
    expect(result).toBe(mockDisposable);
  });
});
