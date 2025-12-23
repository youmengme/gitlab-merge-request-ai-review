import * as vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { diagnosticsCommand } from './diagnostics_command';
import { DIAGNOSTICS_URI } from './diagnostics_document_provider';

describe('diagnosticsCommand', () => {
  let mockDocument: vscode.TextDocument;
  let mockEditor: vscode.TextEditor;

  beforeEach(() => {
    mockDocument = createFakePartial<vscode.TextDocument>({
      uri: DIAGNOSTICS_URI,
      fileName: 'GitLab Diagnostic.md',
    });
    mockEditor = createFakePartial<vscode.TextEditor>({});
  });

  it('should open diagnostics document and show it', async () => {
    jest.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument);
    jest.mocked(vscode.window.showTextDocument).mockResolvedValue(mockEditor);

    await diagnosticsCommand();

    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(DIAGNOSTICS_URI);
    expect(vscode.window.showTextDocument).toHaveBeenCalledWith(mockDocument, { preview: false });
  });
});
