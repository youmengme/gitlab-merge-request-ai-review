import * as vscode from 'vscode';
import { insertCodeSnippet } from './insert_code_snippet';

describe('insertCodeSnippet', () => {
  let mockEditor: vscode.TextEditor;
  beforeEach(() => {
    mockEditor = {
      insertSnippet: jest.fn(),
    } as unknown as vscode.TextEditor;
  });

  it('should replace $ with \\$', async () => {
    Object.defineProperty(vscode.window, 'activeTextEditor', {
      get: jest.fn().mockReturnValue(mockEditor),
      configurable: true,
    });
    const snippet = 'echo $RICK_ROLL_LYRICS=never gonna give you up';
    await insertCodeSnippet(snippet);
    expect(mockEditor.insertSnippet).toHaveBeenCalledWith(
      new vscode.SnippetString(snippet.replace(/\$/g, '\\$')),
    );
  });

  it('should display a warning message if there is no active editor', async () => {
    jest.spyOn(vscode.window, 'showWarningMessage');
    Object.defineProperty(vscode.window, 'activeTextEditor', {
      get: jest.fn().mockReturnValue(null),
      configurable: true,
    });
    const snippet = 'console.log("never gonna let you down");';
    await insertCodeSnippet(snippet);
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "There's no active editor to insert the snippet into.",
    );
  });

  it('should display an error message if there is an error inserting the snippet', async () => {
    jest.spyOn(vscode.window, 'showErrorMessage');
    jest.mocked(mockEditor.insertSnippet).mockRejectedValue(new Error('Test error'));
    Object.defineProperty(vscode.window, 'activeTextEditor', {
      get: jest.fn().mockReturnValue(mockEditor),
      configurable: true,
    });
    const snippet = 'console.log("never gonna tell a lie, and hurt you");';
    await insertCodeSnippet(snippet);
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Error inserting snippet: Test error',
    );
  });
});
