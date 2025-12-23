import * as vscode from 'vscode';
import { UiError } from '../../common/errors/ui_error';

/** When this error bubbles up to the `handleError` logic,
 * we show it to the user as a warning.
 *
 * Create it the same way as the plain error (`new WarningError(message)`)
 */
export class WarningError extends Error implements UiError {
  async showUi(): Promise<void> {
    await vscode.window.showWarningMessage(this.message);
  }
}
