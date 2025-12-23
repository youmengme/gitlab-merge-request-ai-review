import * as vscode from 'vscode';
import { createInterfaceId } from '@gitlab/needle';

export interface LSGitProvider {
  getDiffWithHead(repositoryUri: vscode.Uri): Promise<string | undefined>;
  getDiffWithBranch(repositoryUri: vscode.Uri, branch: string): Promise<string | undefined>;
}

export const LSGitProviderId = createInterfaceId<LSGitProvider>('LSGitProvider');

export class DefaultLSGitProvider implements LSGitProvider {
  async getDiffWithHead(): Promise<string | undefined> {
    throw new Error('Not implemented');
  }

  async getDiffWithBranch(): Promise<string | undefined> {
    throw new Error('Not implemented');
  }
}
