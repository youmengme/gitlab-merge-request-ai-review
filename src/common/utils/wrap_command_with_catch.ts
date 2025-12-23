import vscode from 'vscode';
import { handleError } from '../errors/handle_error';

type commandType = Parameters<typeof vscode.commands.registerCommand>[1];

export const wrapCommandWithCatch =
  (command: commandType): commandType =>
  async (...args) => {
    try {
      await command(...args);
    } catch (e) {
      handleError(e);
    }
  };
