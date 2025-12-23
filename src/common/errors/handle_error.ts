import * as vscode from 'vscode';
import { log } from '../log';
import { USER_COMMANDS } from '../command_names';
import { isUiError } from './ui_error';

export const handleError = (e: Error): void => {
  log.error(e);
  if (isUiError(e)) {
    e.showUi().catch(log.error);
    return;
  }
  const showErrorMessage = async () => {
    const choice = await vscode.window.showErrorMessage(e.message, 'Show Logs');
    if (choice === 'Show Logs') {
      await vscode.commands.executeCommand(USER_COMMANDS.SHOW_LOGS);
    }
  };
  // This is probably the only place where we want to ignore a floating promise.
  // We don't want to block the app and wait for user click on the "Show Logs"
  // button or close the message However, for testing this method, we need to
  // keep the promise.
  showErrorMessage().catch(log.error);
};
