import * as vscode from 'vscode';
import { versionRequest } from '../gitlab/check_version';
import { GitLabPlatformManager } from '../platform/gitlab_platform';
import { log } from '../log';
import { VersionProvider } from './version_state_provider';

export class GitLabInstanceVersionProvider implements VersionProvider {
  #version: string | undefined;

  #platformManager: GitLabPlatformManager;

  #eventEmitter = new vscode.EventEmitter<{ version: string | undefined }>();

  onChange = this.#eventEmitter.event;

  constructor(platformManager: GitLabPlatformManager) {
    this.#platformManager = platformManager;
    platformManager.onAccountChange(async () => {
      await this.updateVersion();
    });
  }

  async updateVersion() {
    try {
      const platform = await this.#platformManager.getForActiveAccount(false);

      const versionResponse = await platform?.fetchFromApi(versionRequest);
      this.#version = versionResponse?.version;
    } catch (e) {
      log.warn(
        'Failed to fetch GitLab version from API; the extension will keep working but some features might be limited, you can re-try by restarting the GitLab extension',
        e,
      );
      this.#version = undefined;
    }
    this.#eventEmitter.fire({ version: this.#version });
  }

  get version(): string | undefined {
    return this.#version;
  }
}
