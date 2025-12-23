import * as vscode from 'vscode';
import { ExtensionStateProvider, StateKey } from './extension_state_service';

export interface VersionProvider {
  version: string | undefined;
  onChange: vscode.Event<{ version: string | undefined }>;
}
export interface VersionDetails {
  vscodeAppName: string;
  vscodeVersion: string;
  extensionVersion: string;
  languageServerVersion: string | undefined;
  gitlabInstanceVersion: string | undefined;
}

export const VersionDetailsStateKey = 'VersionDetailsState' as StateKey<VersionDetails>;

export class VersionStateProvider implements ExtensionStateProvider<VersionDetails> {
  #eventEmitter = new vscode.EventEmitter<VersionDetails>();

  onChange = this.#eventEmitter.event;

  #state: VersionDetails;

  constructor(
    workflowVersion: string,
    lsVersionProvider: VersionProvider | undefined,
    glVersionProvider: VersionProvider | undefined,
  ) {
    this.#state = {
      vscodeAppName: vscode.env.appName,
      vscodeVersion: vscode.version,
      extensionVersion: workflowVersion,
      languageServerVersion: lsVersionProvider?.version,
      gitlabInstanceVersion: glVersionProvider?.version,
    };

    lsVersionProvider?.onChange(({ version }) => {
      this.#state.languageServerVersion = version;
      this.#eventEmitter.fire(this.#state);
    });

    glVersionProvider?.onChange(({ version }) => {
      this.#state.gitlabInstanceVersion = version;
      this.#eventEmitter.fire(this.#state);
    });
  }

  get state(): VersionDetails {
    return this.#state;
  }
}
