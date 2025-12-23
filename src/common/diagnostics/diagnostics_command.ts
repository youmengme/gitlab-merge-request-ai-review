import * as vscode from 'vscode';
import { DIAGNOSTICS_URI } from './diagnostics_document_provider';

export const diagnosticsCommand = async () => {
  const doc = await vscode.workspace.openTextDocument(DIAGNOSTICS_URI);
  await vscode.window.showTextDocument(doc, { preview: false });
};
