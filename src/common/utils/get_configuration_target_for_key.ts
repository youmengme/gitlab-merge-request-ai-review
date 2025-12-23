import * as vscode from 'vscode';

export const getConfigurationTargetForKey = (
  config: vscode.WorkspaceConfiguration,
  key: string,
) => {
  const inspection = config.inspect(key);

  if (!inspection) {
    return vscode.ConfigurationTarget.Global;
  }

  const {
    workspaceFolderValue,
    workspaceFolderLanguageValue,
    workspaceValue,
    workspaceLanguageValue,
  } = inspection;

  if (workspaceFolderValue !== undefined || workspaceFolderLanguageValue !== undefined) {
    return vscode.ConfigurationTarget.WorkspaceFolder;
  }
  if (workspaceValue !== undefined || workspaceLanguageValue !== undefined) {
    return vscode.ConfigurationTarget.Workspace;
  }

  return vscode.ConfigurationTarget.Global;
};
