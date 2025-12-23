import * as vscode from 'vscode';
import { FLOW_BUILDER_WEBVIEW_ID } from '../../common/constants';

export const openFlowBuilderCommand = async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'yaml') {
    await vscode.window.showErrorMessage('Please open a YAML file to use the Flow Builder.');
    return;
  }

  const uri = editor.document.uri.toString();

  await vscode.commands.executeCommand(
    `gl.webview.${FLOW_BUILDER_WEBVIEW_ID.replace('/', '.')}.show`,
    { uri },
  );
};
