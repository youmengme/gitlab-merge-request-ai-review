import * as vscode from 'vscode';

export const setFeatureFlagContext = (name: string, enabled: boolean) =>
  vscode.commands.executeCommand('setContext', `gitlab.featureFlags.${name}`, enabled);
