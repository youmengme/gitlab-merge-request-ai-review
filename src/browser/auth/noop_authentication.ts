import * as vscode from 'vscode';
import { Authentication } from './authentication';

const NOOP_AUTHENTICATION_SESSION: vscode.AuthenticationSession = {
  accessToken: '',
  scopes: [],
  id: '',
  account: {
    label: '',
    id: '',
  },
};

export class NoopAuthentication implements Authentication {
  #onChangeEmitter: vscode.EventEmitter<void>;

  constructor() {
    this.#onChangeEmitter = new vscode.EventEmitter<void>();
  }

  get onChange() {
    return this.#onChangeEmitter.event;
  }

  getSession(): vscode.AuthenticationSession {
    return NOOP_AUTHENTICATION_SESSION;
  }
}
