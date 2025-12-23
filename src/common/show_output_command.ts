import * as vscode from 'vscode';

export const createShowOutputCommand = (outputChannel: vscode.OutputChannel) => () =>
  outputChannel.show();
