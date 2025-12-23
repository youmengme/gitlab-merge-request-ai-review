import * as vscode from 'vscode';
import { WEB_IDE_AUTH_PROVIDER_ID, WEB_IDE_AUTH_SCOPE } from '../../common/platform/web_ide';
import { Authentication } from './authentication';

export const getWebIdeAuthSession = () =>
  vscode.authentication.getSession(WEB_IDE_AUTH_PROVIDER_ID, [WEB_IDE_AUTH_SCOPE], {
    createIfNone: false,
    silent: true,
  });

export class WebIdeAuthentication implements Authentication {
  #onChangeEmitter: vscode.EventEmitter<void>;

  #authSession: vscode.AuthenticationSession;

  constructor(authSession: vscode.AuthenticationSession) {
    this.#authSession = authSession;
    this.#onChangeEmitter = new vscode.EventEmitter<void>();

    vscode.authentication.onDidChangeSessions(async e => {
      if (e.provider.id === WEB_IDE_AUTH_PROVIDER_ID) {
        await this.#refreshAuthSession();

        this.#onChangeEmitter.fire();
      }
    });
  }

  get onChange() {
    return this.#onChangeEmitter.event;
  }

  getSession() {
    return this.#authSession;
  }

  async #refreshAuthSession() {
    const authSession = await getWebIdeAuthSession();

    if (authSession) {
      this.#authSession = authSession;
    }
  }
}
