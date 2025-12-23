import * as vscode from 'vscode';
import { GitLabTelemetryEnvironment } from '../../common/platform/gitlab_telemetry_environment';
import {
  IDE_EXTENSION_VERSION_SCHEMA_URL,
  IdeExtensionContext,
} from '../../common/snowplow/snowplow_options';

export class GitLabTelemetryEnvironmentDesktop implements GitLabTelemetryEnvironment {
  #subscriptions: vscode.Disposable[] = [];

  constructor() {
    this.#emitTelemetryStatus(vscode.env.isTelemetryEnabled);

    this.#subscriptions.push(
      vscode.env.onDidChangeTelemetryEnabled(enabled => this.#emitTelemetryStatus(enabled)),
    );
  }

  isTelemetryEnabled(): boolean {
    return vscode.env.isTelemetryEnabled;
  }

  buildIdeExtensionContext(extVersion: string): IdeExtensionContext {
    return {
      schema: IDE_EXTENSION_VERSION_SCHEMA_URL,
      data: {
        ide_name: 'Visual Studio Code',
        ide_vendor: 'Microsoft Corporation',
        ide_version: vscode.version,
        extension_name: 'GitLab Workflow',
        extension_version: extVersion,
      },
    };
  }

  get onDidChangeTelemetryEnabled() {
    return this.#onDidChangeTelemetryEnabled.event;
  }

  #onDidChangeTelemetryEnabled: vscode.EventEmitter<boolean> = new vscode.EventEmitter<boolean>();

  #emitTelemetryStatus(isEnabled: boolean) {
    this.#onDidChangeTelemetryEnabled.fire(isEnabled);
  }

  dispose() {
    this.#subscriptions.forEach(s => s.dispose());
  }
}
