import * as vscode from 'vscode';

export interface EnvInfo {
  isMacOS: boolean;
  isRemote: boolean;
}

// Environment
// TODO: Remove process reference in common constants
// https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/1615
export const getEnvInfo = (): EnvInfo => ({
  isMacOS: 'process' in globalThis && process?.platform === 'darwin',
  isRemote: Boolean(vscode.env.remoteName),
});
