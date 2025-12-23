import * as vscode from 'vscode';

export const copyContent = async (content: string) => {
  try {
    await vscode.env.clipboard.writeText(content);
    await vscode.window.showInformationMessage('Copied to clipboard.');
  } catch (error) {
    await vscode.window.showErrorMessage(
      `Error copying: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};
