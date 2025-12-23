import * as vscode from 'vscode';
import { WarningError } from './warning_error';

describe('WarningError', () => {
  it('shows VS Code warning message', async () => {
    const error = new WarningError('Test warning');

    await error.showUi();

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('Test warning');
  });
});
