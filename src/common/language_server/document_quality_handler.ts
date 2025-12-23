import * as vscode from 'vscode';
import { Disposable } from 'vscode';
import { Diagnostic } from 'vscode-languageclient';
import { createConverter as createCodeConverter } from 'vscode-languageclient/lib/common/codeConverter';
import { log } from '../log';
import { waitForDiagnosticsUpdate } from './wait_for_diagnostics';

export const GET_DIAGNOSTICS_REQUEST_METHOD = '$/gitlab/document-quality/get-diagnostics';

type GetDiagnosticsParams = { fileUri: string };
type GetDiagnosticsResult = Diagnostic[];

export class DocumentQualityHandler implements Disposable {
  #c2p = createCodeConverter(undefined);

  #diagnosticsCache = new Map<string, vscode.Diagnostic[]>();

  #onDidChangeDiagnosticsDisposable: vscode.Disposable;

  #documentCloseDisposable: vscode.Disposable;

  constructor() {
    this.#onDidChangeDiagnosticsDisposable = vscode.languages.onDidChangeDiagnostics(event => {
      event.uris.forEach(uri => {
        const uriString = uri.toString();
        const diagnostics = vscode.languages.getDiagnostics(uri);
        this.#diagnosticsCache.set(uriString, diagnostics);
      });
    });

    this.#documentCloseDisposable = vscode.workspace.onDidCloseTextDocument(doc => {
      const uriString = doc.uri.toString();
      this.#diagnosticsCache.delete(uriString);
    });
  }

  getDiagnostics = async ({ fileUri }: GetDiagnosticsParams): Promise<GetDiagnosticsResult> => {
    if (this.#diagnosticsCache.has(fileUri)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const cached = this.#diagnosticsCache.get(fileUri)!;
      return this.#c2p.asDiagnostics(cached);
    }

    const uri = vscode.Uri.parse(fileUri);
    try {
      // If we don't have a diagnostics cache entry already, it most likely means the file is not currently open in the editor.
      // VSCode only calculates diagnostics when the file is opened or edited, so we open the file and wait for diagnostics
      const diagnostics = await this.#tryTriggerDiagnostics(uri);
      return await this.#c2p.asDiagnostics(diagnostics);
    } catch (error) {
      log.error(`[DocumentQualityHandler] Failed to update diagnostics for "${uri}"`, error);
      return [];
    }
  };

  async #tryTriggerDiagnostics(uri: vscode.Uri): Promise<vscode.Diagnostic[]> {
    const uriString = uri.toString();

    const currentActiveUri = vscode.window.activeTextEditor?.document.uri;
    const isDocumentOpen = vscode.workspace.textDocuments.some(
      doc => doc.uri.toString() === uriString,
    );
    if (!isDocumentOpen) {
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document, {
        preview: true,
        preserveFocus: true,
      });
      if (currentActiveUri) {
        // Try to preserve the users focus if we can - while we have to open the document to
        // re-trigger calculation of vscode diagnostics we should try to avoid being disruptive
        await vscode.window.showTextDocument(currentActiveUri);
      }
    }

    await waitForDiagnosticsUpdate([uriString]);

    return this.#diagnosticsCache.get(uriString) || [];
  }

  dispose() {
    this.#onDidChangeDiagnosticsDisposable?.dispose();
    this.#documentCloseDisposable?.dispose();
    this.#diagnosticsCache.clear();
  }
}
