import * as vscode from 'vscode';
import {
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResult,
  TextDocumentEdit,
  WorkspaceEdit,
} from 'vscode-languageclient';
import { log } from '../log';
import { ApplyEditMiddleware } from './apply_edit_client_wrapper';

export class SaveFileMiddleware implements ApplyEditMiddleware {
  async process(
    params: ApplyWorkspaceEditParams,
    next: (params: ApplyWorkspaceEditParams) => Promise<ApplyWorkspaceEditResult>,
  ): Promise<ApplyWorkspaceEditResult> {
    const workspaceEdit: WorkspaceEdit = params.edit;
    const fileUrisToSave = this.#extractFileUrisFromWorkspaceEdit(workspaceEdit);

    log.debug(
      `[SaveFileMiddleware] Processing workspace/applyEdit for files: ${Array.from(fileUrisToSave).join(',')}`,
    );

    // make the edit
    const result = await next(params);

    // After successful edit, save all modified files
    if (result.applied) {
      try {
        await this.#saveFiles(Array.from(fileUrisToSave));
      } catch (error) {
        log.error('[SaveFileMiddleware] Error saving files after workspace edit:', error);
      }
    }

    return result;
  }

  #extractFileUrisFromWorkspaceEdit(workspaceEdit: WorkspaceEdit): Set<string> {
    const fileUrisToSave = new Set<string>();

    // We ignore the legacy `workspaceEdit.changes` since the server always use the modern format
    // Check documentChanges property (modern format)
    if (workspaceEdit.documentChanges) {
      for (const change of workspaceEdit.documentChanges) {
        if ('textDocument' in change && 'edits' in change) {
          const textDocumentEdit = change as TextDocumentEdit;
          if (textDocumentEdit.edits && textDocumentEdit.edits.length > 0) {
            fileUrisToSave.add(textDocumentEdit.textDocument.uri);
          }
        }
      }
    }

    return fileUrisToSave;
  }

  async #saveFiles(uris: string[]): Promise<void> {
    const savePromises = uris.map(async uri => {
      try {
        const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri);
        if (document && document.isDirty) {
          await document.save();
          log.debug(`[SaveFileMiddleware] Saved file: ${uri}`);
        }
      } catch (error) {
        log.error(`[SaveFileMiddleware] Failed to save file ${uri}:`, error);
      }
    });

    await Promise.all(savePromises);
  }
}
