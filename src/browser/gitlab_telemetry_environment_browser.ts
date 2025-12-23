import vscode from 'vscode';
import { GitLabTelemetryEnvironment } from '../common/platform/gitlab_telemetry_environment';
import { WebIDEExtension } from '../common/platform/web_ide';
import {
  IDE_EXTENSION_VERSION_SCHEMA_URL,
  IdeExtensionContext,
} from '../common/snowplow/snowplow_options';

export class GitLabTelemetryEnvironmentBrowser implements GitLabTelemetryEnvironment {
  readonly #webIdeExtension: WebIDEExtension | undefined;

  constructor(webIdeExtension: WebIDEExtension) {
    this.#webIdeExtension = webIdeExtension;
  }

  isTelemetryEnabled(): boolean {
    return this.#webIdeExtension?.isTelemetryEnabled() || false;
  }

  buildIdeExtensionContext(extVersion: string): IdeExtensionContext {
    return {
      schema: IDE_EXTENSION_VERSION_SCHEMA_URL,
      data: {
        ide_name: 'GitLab Web IDE',
        ide_vendor: 'GitLab Inc.',
        ide_version: vscode.version,
        extension_name: 'GitLab Workflow',
        extension_version: extVersion,
      },
    };
  }

  get onDidChangeTelemetryEnabled() {
    return this.#onDidChangeTelemetryEnabled.event;
  }

  // FIXME: implement emitting event when telemetry enabled state changes
  // sync of the extension config with the LS happens on this event
  // https://gitlab.com/gitlab-org/gitlab-web-ide/-/issues/352
  #onDidChangeTelemetryEnabled: vscode.EventEmitter<boolean> = new vscode.EventEmitter<boolean>();
}
