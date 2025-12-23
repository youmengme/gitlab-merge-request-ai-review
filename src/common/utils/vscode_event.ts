import * as vscode from 'vscode';

/**
 * Creates a disposable event listener that triggers when the active text document is saved
 * @param callback Function to execute when the active document is saved
 * @returns Disposable event subscription
 */
export const onDidSaveActiveTextDocument = (
  callback: (e: vscode.TextDocument) => void,
): vscode.Disposable => {
  return vscode.workspace.onDidSaveTextDocument(document => {
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor?.document.uri === document.uri) {
      callback(document);
    }
  });
};
