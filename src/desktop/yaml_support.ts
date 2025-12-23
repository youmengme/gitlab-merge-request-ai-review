import * as vscode from 'vscode';
import { UserMessage } from '../common/user_message';
import { DO_NOT_SHOW_YAML_SUGGESTION } from './constants';

export const setupYamlSupport = (context: vscode.ExtensionContext) => {
  if (vscode.extensions.getExtension('redhat.vscode-yaml')) return;

  const yamlMessage = new UserMessage(
    context.globalState,
    DO_NOT_SHOW_YAML_SUGGESTION,
    "Would you like to install Red Hat's YAML extension to get real-time linting on the .gitlab-ci.yml file?",
    [
      {
        title: 'Yes',
        callback: async () => {
          await vscode.commands.executeCommand(
            'workbench.extensions.installExtension',
            'redhat.vscode-yaml',
          );
        },
      },
      {
        title: 'Not now',
        callback: () => {}, // No-op
      },
    ],
  );

  vscode.workspace.onDidOpenTextDocument(async document => {
    if (document.fileName.endsWith('.gitlab-ci.yml')) {
      await yamlMessage.trigger();
    }
  });
};
