import * as vscode from 'vscode';

export interface Authentication {
  readonly onChange: vscode.Event<void>;

  getSession(): vscode.AuthenticationSession;
}
