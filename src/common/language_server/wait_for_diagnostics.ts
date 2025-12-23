import * as vscode from 'vscode';

export const MAX_TIME_TO_WAIT_FOR_DIAGNOSTICS_MS = 3000;

export async function waitForDiagnosticsUpdate(uris: string[]): Promise<void> {
  const urisToWaitFor = new Set(uris);

  if (urisToWaitFor.size === 0) {
    return Promise.resolve();
  }

  return new Promise<void>(resolve => {
    let timeout: NodeJS.Timeout;
    let disposable: vscode.Disposable | undefined;

    const disposeAndResolve = () => {
      disposable?.dispose();
      clearTimeout(timeout);
      resolve();
    };

    disposable = vscode.languages.onDidChangeDiagnostics(event => {
      event.uris.forEach(uri => urisToWaitFor.delete(uri.toString()));

      if (urisToWaitFor.size === 0) {
        disposeAndResolve();
      }
    });

    timeout = setTimeout(() => {
      // If we reach this timeout it means the file had no diagnostic issues before editing, and had none after editing
      disposeAndResolve();
    }, MAX_TIME_TO_WAIT_FOR_DIAGNOSTICS_MS);
  });
}
