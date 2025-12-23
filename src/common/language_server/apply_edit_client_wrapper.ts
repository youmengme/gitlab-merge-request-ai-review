import * as vscode from 'vscode';
import {
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResult,
  TextDocumentEdit,
} from 'vscode-languageclient';
import { createConverter } from 'vscode-languageclient/lib/common/protocolConverter';
import { Semaphore } from '../utils/semaphore';
import { log } from '../log';

export interface ApplyEditMiddleware {
  process(
    params: ApplyWorkspaceEditParams,
    next: (params: ApplyWorkspaceEditParams) => Promise<ApplyWorkspaceEditResult>,
  ): Promise<ApplyWorkspaceEditResult>;
}

export class ApplyEditClientWrapper {
  #middlewares: ApplyEditMiddleware[] = [];

  #p2c = createConverter(undefined, false, false);

  #workspaceEditLock: Semaphore<vscode.WorkspaceEdit> = new Semaphore(1);

  handleApplyWorkspaceEdit = async (params: ApplyWorkspaceEditParams) => {
    log.debug(`[ApplyEditClientWrapper] Running middlewares`);
    return this.#processWithMiddlewares(params, 0);
  };

  addApplyEditMiddleware(middleware: ApplyEditMiddleware): void {
    this.#middlewares.push(middleware);
  }

  async #processWithMiddlewares(
    params: ApplyWorkspaceEditParams,
    index: number,
  ): Promise<ApplyWorkspaceEditResult> {
    if (index >= this.#middlewares.length) {
      log.debug(`[ApplyEditClientWrapper] Applying edit`);
      return this.#applyEdit(params);
    }

    const middleware = this.#middlewares[index];
    const next = (nextParams: ApplyWorkspaceEditParams) =>
      this.#processWithMiddlewares(nextParams, index + 1);

    return middleware.process(params, next);
  }

  /* this method is taken from https://github.com/microsoft/vscode-languageserver-node/blob/dfdb85d46f212e20de9df17074e84b97c4e7f95e/client/src/common/client.ts#L1963
   *  Copyright (c) Microsoft Corporation. All rights reserved.
   *  Licensed under the MIT License. See LICENSE https://github.com/microsoft/vscode-languageserver-node/blob/60d4ecb5d6034d628bcc3a70b3c9359232360f07/License.txt
   */
  async #applyEdit(params: ApplyWorkspaceEditParams) {
    const workspaceEdit = params.edit;
    // Make sure we convert workspace edits one after the other. Otherwise
    // we might execute a workspace edit received first after we received another
    // one since the conversion might race.
    const converted = await this.#workspaceEditLock.lock(() => {
      return this.#p2c.asWorkspaceEdit(workspaceEdit);
    });

    // This is some sort of workaround since the version check should be done by VS Code in the Workspace.applyEdit.
    // However doing it here adds some safety since the server can lag more behind then an extension.
    const openTextDocuments = new Map<string, vscode.TextDocument>();
    vscode.workspace.textDocuments.forEach(document =>
      openTextDocuments.set(document.uri.toString(), document),
    );
    let versionMismatch = false;
    if (workspaceEdit.documentChanges) {
      for (const change of workspaceEdit.documentChanges) {
        if (
          TextDocumentEdit.is(change) &&
          change.textDocument.version &&
          change.textDocument.version >= 0
        ) {
          const changeUri = this.#p2c.asUri(change.textDocument.uri).toString();
          const textDocument = openTextDocuments.get(changeUri);
          if (textDocument && textDocument.version !== change.textDocument.version) {
            versionMismatch = true;
            break;
          }
        }
      }
    }
    if (versionMismatch) {
      return Promise.resolve({ applied: false });
    }
    return vscode.workspace.applyEdit(converted).then(value => {
      return { applied: value };
    });
  }
}
