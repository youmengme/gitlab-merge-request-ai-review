import * as vscode from 'vscode';
import { IClientContext } from '@gitlab-org/gitlab-lsp';

export const getClientContext = (): IClientContext => {
  const extension = vscode.extensions.getExtension('Gitlab.gitlab-workflow');
  return {
    ide: {
      name: 'GitLab Web IDE',
      vendor: 'GitLab',
      version: vscode.version,
    },
    extension: {
      name: 'GitLab Workflow',
      version: extension?.packageJSON?.version,
    },
  };
};
