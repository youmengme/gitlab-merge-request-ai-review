import * as vscode from 'vscode';
import { waitForCancellationToken } from './wait_for_cancellation_token';

describe('common/utils/wait_for_cancellation_token', () => {
  it('resolves when cancellation token is canceled', async () => {
    const tokenSource = new vscode.CancellationTokenSource();

    const result = waitForCancellationToken(tokenSource.token);

    tokenSource.cancel();

    await expect(result).resolves.toEqual(expect.anything());
  });
});
