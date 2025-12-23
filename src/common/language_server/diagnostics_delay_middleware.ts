import {
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResult,
  TextDocumentEdit,
  WorkspaceEdit,
} from 'vscode-languageclient';
import { ApplyEditMiddleware } from './apply_edit_client_wrapper';
import { waitForDiagnosticsUpdate } from './wait_for_diagnostics';

/**
 * A middleware that resolves a race condition between files being edited, vscode recalculating diagnostics, and
 * the Language Server requesting those diagnostics.
 * After editing the file, if there are diagnostic issues in the file, there will be a delay (anywhere from 200ms - 2000ms)
 * before vscode recalculates them and `onDidChangeDiagnostics` fires to update our DocumentQualityService cache.
 * This middleware waits until it sees an event fire after editing before resolving, to ensure the cache is ready
 * for the next request.
 */
export class DiagnosticsDelayMiddleware implements ApplyEditMiddleware {
  async process(
    params: ApplyWorkspaceEditParams,
    next: (params: ApplyWorkspaceEditParams) => Promise<ApplyWorkspaceEditResult>,
  ): Promise<ApplyWorkspaceEditResult> {
    const workspaceEdit: WorkspaceEdit = params.edit;
    const editedUris = this.#extractFileUrisFromWorkspaceEdit(workspaceEdit);

    if (editedUris.length === 0) {
      return next(params);
    }

    const waitForDiagnosticsPromise = waitForDiagnosticsUpdate(editedUris);

    const result = await next(params);

    if (result.applied) {
      await waitForDiagnosticsPromise;
    }

    return result;
  }

  #extractFileUrisFromWorkspaceEdit(workspaceEdit: WorkspaceEdit): string[] {
    const fileUris: string[] = [];

    if (workspaceEdit.documentChanges) {
      for (const change of workspaceEdit.documentChanges) {
        if ('textDocument' in change && 'edits' in change) {
          const textDocumentEdit = change as TextDocumentEdit;
          if (textDocumentEdit.edits && textDocumentEdit.edits.length > 0) {
            fileUris.push(textDocumentEdit.textDocument.uri);
          }
        }
      }
    }

    return fileUris;
  }
}
