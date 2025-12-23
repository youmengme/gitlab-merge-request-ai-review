import { CancellationToken } from 'vscode';

export const waitForCancellationToken = (token: CancellationToken) =>
  new Promise<void>(resolve => {
    token.onCancellationRequested(resolve);
  });
