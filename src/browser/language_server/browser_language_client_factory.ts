import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/browser';
import {
  LANGUAGE_SERVER_ID,
  LANGUAGE_SERVER_NAME,
  LanguageClientFactory,
} from '../../common/language_server/client_factory';

export const browserLanguageClientFactory: LanguageClientFactory = {
  createLanguageClient(context, clientOptions) {
    const module = vscode.Uri.joinPath(
      context.extensionUri,
      './assets/language-server/browser/main-bundle.js',
    );
    const worker = new Worker(module.toString(true));

    return new LanguageClient(LANGUAGE_SERVER_ID, LANGUAGE_SERVER_NAME, clientOptions, worker);
  },
};
