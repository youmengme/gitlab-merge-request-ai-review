import * as vscode from 'vscode';
import {
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResult,
  TextDocumentEdit,
  WorkspaceEdit,
} from 'vscode-languageclient';
import { createConverter } from 'vscode-languageclient/lib/common/protocolConverter';
import { log } from '../log';
import { openDiffWithBehavior } from '../utils/diff_utils';
import { getAgentPlatformConfiguration } from '../utils/extension_configuration';
import { ApplyEditMiddleware } from './apply_edit_client_wrapper';
import { FileSnapshotProvider } from './file_snapshot_provider';

export class DiffMiddleware implements ApplyEditMiddleware {
  #p2c = createConverter(undefined, false, false);

  #fileSnapshotProvider: FileSnapshotProvider;

  // Store disposables for cleanup
  #pendingDisposables = new Map<string, vscode.Disposable>();

  #listener;

  constructor(fileSnapshotProvider: FileSnapshotProvider) {
    this.#fileSnapshotProvider = fileSnapshotProvider;
    this.#listener = vscode.window.onDidChangeActiveTextEditor(
      this.#onDidChangeActiveTextEditor,
      this,
    );
  }

  dispose() {
    this.#listener.dispose();
  }

  async process(
    params: ApplyWorkspaceEditParams,
    next: (params: ApplyWorkspaceEditParams) => Promise<ApplyWorkspaceEditResult>,
  ): Promise<ApplyWorkspaceEditResult> {
    const editedUris = this.#extractEditedUris(params.edit);
    const disposables = await this.#takeSnapshots(editedUris);

    // Store disposables for later cleanup
    disposables.forEach((disposable, index) => {
      const uri = editedUris[index];
      this.#pendingDisposables.set(uri.toString(), disposable);
    });

    const result = await next(params);

    if (result.applied) {
      await this.#showDiffForEditedFiles(editedUris);
    }

    return result;
  }

  #onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined): void {
    if (!editor) return;
    const docUri = editor.document.uri;

    // VS Code only populates diffs once they are opened, so we must wait before disposing of snapshots.
    this.#disposeActiveDiffTab(docUri);
  }

  #disposeActiveDiffTab(fileUri: vscode.Uri): void {
    const { activeTab } = vscode.window.tabGroups.activeTabGroup;
    if (!activeTab) return;

    if (activeTab.input instanceof vscode.TabInputTextDiff) {
      if (activeTab.input.modified.toString() === fileUri.toString()) {
        this.#disposeSnapshotIfExists(activeTab.input.modified);
      }
    }
  }

  #disposeSnapshotIfExists(uri: vscode.Uri) {
    const disposable = this.#pendingDisposables.get(uri.toString());
    if (disposable) {
      log.debug(`[DiffMiddleware] disposing of diff snapshot for ${uri.fsPath}.`);
      disposable.dispose();
    }
    this.#pendingDisposables.delete(uri.toString());
  }

  #extractEditedUris(workspaceEdit: WorkspaceEdit): vscode.Uri[] {
    if (!workspaceEdit.documentChanges) return [];

    return workspaceEdit.documentChanges
      .filter(TextDocumentEdit.is)
      .map(change => this.#p2c.asUri(change.textDocument.uri));
  }

  async #takeSnapshots(uris: vscode.Uri[]): Promise<vscode.Disposable[]> {
    return Promise.all(
      uris.map(async uri => {
        try {
          return await this.#fileSnapshotProvider.takeSnapshot(uri);
        } catch (e) {
          log.error(
            `[DiffMiddleware] Failed to take a snapshot for ${uri.fsPath}. Will use empty content.`,
            e,
          );
          return { dispose() {} };
        }
      }),
    );
  }

  async #showDiffForEditedFiles(uris: vscode.Uri[]): Promise<void> {
    const { editFileDiffBehavior } = getAgentPlatformConfiguration();

    await Promise.all(
      uris
        .filter(uri => this.#fileSnapshotProvider.hasContent(uri))
        .map(async uri => {
          try {
            await this.#openDiffView(uri);

            // For 'none' behavior, dispose immediately since diff won't be opened
            if (editFileDiffBehavior === 'none') {
              this.#disposeSnapshotIfExists(uri);
            }
          } catch (e) {
            log.error(`[DiffMiddleware] Failed to show diff for ${uri.fsPath}.`, e);
          }
        }),
    );
  }

  async #openDiffView(fileUri: vscode.Uri): Promise<void> {
    const fileName = fileUri.path.split('/').pop() || 'untitled';
    const snapshotUri = this.#fileSnapshotProvider.snapshotUri(fileUri);
    const diffTitle = `${fileName}: Original ↔ Edited`;

    const { editFileDiffBehavior } = getAgentPlatformConfiguration();

    await openDiffWithBehavior(snapshotUri, fileUri, diffTitle, editFileDiffBehavior);

    if (editFileDiffBehavior !== 'none') {
      log.debug(
        `[DiffMiddleware] Opened diff view: "${diffTitle}" (behavior: ${editFileDiffBehavior})`,
      );
    }
  }
}
