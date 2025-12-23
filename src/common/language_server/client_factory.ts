import * as vscode from 'vscode';
import { BaseLanguageClient, LanguageClientOptions } from 'vscode-languageclient';

export const LANGUAGE_SERVER_ID = 'gitlab-lsp';
export const LANGUAGE_SERVER_NAME = 'GitLab Language Server';

export interface LanguageClientFactory {
  /**
   * createLanguageClient encapsulates platform-specific logic to create LanguageClient.
   *
   * @param context we need VS Code Extension to locate the LS JavaScript file
   * */
  createLanguageClient(
    context: vscode.ExtensionContext,
    clientOptions: LanguageClientOptions,
  ): BaseLanguageClient;
}
