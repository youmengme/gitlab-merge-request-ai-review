import * as vscode from 'vscode';
import { initializeLogging } from '../log';
import { USER_COMMANDS } from '../command_names';
import { handleError } from './handle_error';
import { UiError } from './ui_error';

const waitForPromises = () => new Promise(process.nextTick);

describe('handleError', () => {
  const message = 'Uncaught TypeError: NetworkError when attempting to fetch resource.';
  const showErrorMessage = vscode.window.showErrorMessage as jest.Mock;

  let logFunction: jest.Mock;

  beforeEach(() => {
    logFunction = jest.fn();
    initializeLogging(logFunction);
  });

  const getLoggedMessage = () => logFunction.mock.calls[0][0];

  it('passes the argument to the handler', () => {
    handleError(new Error(message));

    expect(getLoggedMessage()).toContain(message);
  });

  it('prompts the user to show the logs', () => {
    handleError(new Error(message));

    expect(showErrorMessage).toBeCalledWith(message, 'Show Logs');
  });

  it('shows the logs when the user confirms the prompt', async () => {
    const executeCommand = vscode.commands.executeCommand as jest.Mock;
    showErrorMessage.mockResolvedValue('Show Logs');

    handleError(new Error(message));

    await waitForPromises();

    expect(executeCommand).toBeCalledWith(USER_COMMANDS.SHOW_LOGS);
  });

  describe('when handling an UI Error', () => {
    let showUiMock: jest.Func;

    beforeEach(() => {
      const error = new Error('test');
      showUiMock = jest.fn().mockResolvedValueOnce(undefined);
      const testError: UiError = { ...error, showUi: showUiMock };

      handleError(testError);
    });

    it('shows UI error', async () => {
      expect(showUiMock).toHaveBeenCalled();
    });

    it('does not show the generic error UI', async () => {
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });
  });
});
