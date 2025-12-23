import * as vscode from 'vscode';
import {
  ApiRequest,
  COMMAND_FETCH_FROM_API,
  COMMAND_MEDIATOR_TOKEN,
} from '../../common/platform/web_ide';
import type { ApiClient } from '../../common/gitlab/api/api_client';

export class MediatorCommandsApiClient implements ApiClient {
  #mediatorToken: string;

  constructor() {
    this.#mediatorToken = '';
  }

  async fetchFromApi<T>(request: ApiRequest<T>): Promise<T> {
    const token = await this.#getMediatorToken();

    return vscode.commands.executeCommand(COMMAND_FETCH_FROM_API, token, request);
  }

  async #getMediatorToken() {
    if (!this.#mediatorToken) {
      this.#mediatorToken = await vscode.commands.executeCommand(COMMAND_MEDIATOR_TOKEN);
    }

    return this.#mediatorToken;
  }
}
